"""
Produce Vision - image-based fruit/vegetable identification + quality grading.

Lets a seller snap/upload ONE photo of a batch instead of typing the produce
type by hand, and grades visible freshness (bruising, mould, discoloration,
shrivelling) so the shelf-life estimate can be nudged by what the produce
actually looks like today, not just by harvest date math.

FALLBACK CHAIN (same reliability philosophy as app/agent.py):
  1. Gemini    (gemini-2.0-flash, multimodal)  - free tier, primary vision model
  2. Groq       (llama-3.2-11b-vision-preview)  - free tier, different provider
  3. Classical CV (OpenCV, no API/network)       - always works, fully offline

Each step only runs if the previous one fails (missing key, rate limit,
network issue, bad JSON). Step 3 needs no API key and no network access,
so image analysis NEVER fully breaks, even fully offline.
"""

import base64
import io
import json
import os

import numpy as np
from PIL import Image

from groq import Groq, GroqError
from google import genai
from google.genai.errors import APIError as GeminiAPIError

# ---- Client setup (only initialized if the relevant key is present) ----
groq_client = None
groq_api_key = os.getenv("GROQ_API_KEY")
if groq_api_key:
    groq_client = Groq(api_key=groq_api_key)

gemini_client = None
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    gemini_client = genai.Client(api_key=gemini_api_key)

GEMINI_MODEL = "gemini-2.0-flash"
GROQ_VISION_MODEL = "llama-3.2-11b-vision-preview"

# Known produce types the rest of the app understands (shelf_life.py /
# BASE_SHELF_LIFE_DAYS + the AddBatchForm dropdown). The model is nudged
# towards these so downstream shelf-life lookups hit real data instead of
# the generic 5-day default, but "produce_type" can still fall outside this
# list for anything unusual the seller photographs.
KNOWN_PRODUCE_TYPES = [
    "tomato", "banana", "mango", "apple", "potato", "onion",
    "spinach", "cauliflower", "grapes", "papaya",
]

QUALITY_LABELS = ["excellent", "good", "fair", "poor", "spoiled"]

# How much a quality grade should nudge the shelf-life-days estimate that
# app/shelf_life.py computes from harvest date alone. Produce that LOOKS
# worse than its age suggests loses days; produce that looks great keeps
# its full estimate. Kept conservative (small effect) since harvest date
# is still the primary, more reliable signal.
QUALITY_SHELF_LIFE_ADJUSTMENT = {
    "excellent": 0.10,
    "good": 0.0,
    "fair": -0.20,
    "poor": -0.50,
    "spoiled": -0.95,
}

SYSTEM_PROMPT = f"""You are a produce inspection agent for a fresh-produce rescue \
marketplace. You are shown ONE photo of a batch of fruit or vegetables. Identify \
what it is and grade its visible quality.

Respond with ONLY a JSON object (no markdown, no preamble) in this exact shape:
{{
  "produce_type": "<lowercase single word/phrase, e.g. tomato, banana, mango>",
  "produce_confidence": <float 0-1>,
  "quality_label": "excellent" | "good" | "fair" | "poor" | "spoiled",
  "quality_score": <integer 0-100, 100 = perfect, 0 = fully rotten>,
  "defects_observed": ["<short phrase>", ...],
  "reasoning": "<one plain-language sentence a mandi trader can understand>"
}}

Guidelines:
- Look for bruising, mould, dark/soft spots, shrivelling, discoloration, pest damage.
- If multiple items are visible, grade the batch as a whole (worst-affected pieces \
  pull the score down, but a few perfect items among mostly-good ones shouldn't \
  tank an otherwise fine batch).
- If you cannot identify the produce with reasonable confidence, still return your \
  best guess and set produce_confidence low rather than refusing.
- Prefer common produce names from this list when applicable: {", ".join(KNOWN_PRODUCE_TYPES)}. \
  If it's something else entirely, name it anyway - do not force a bad match.
"""


def _parse_json_response(text: str) -> dict:
    text = text.strip().replace("```json", "").replace("```", "").strip()
    parsed = json.loads(text)
    if parsed.get("quality_label") not in QUALITY_LABELS:
        raise ValueError("invalid quality_label from model")
    if not isinstance(parsed.get("produce_type"), str) or not parsed["produce_type"]:
        raise ValueError("missing produce_type from model")
    parsed["quality_score"] = max(0, min(100, int(parsed.get("quality_score", 50))))
    parsed["produce_confidence"] = max(0.0, min(1.0, float(parsed.get("produce_confidence", 0.5))))
    parsed.setdefault("defects_observed", [])
    parsed.setdefault("reasoning", "")
    return parsed


def _try_gemini(image_bytes: bytes, mime_type: str) -> dict:
    if gemini_client is None:
        raise RuntimeError("Gemini not configured (no GEMINI_API_KEY)")
    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            {"text": SYSTEM_PROMPT},
            {"inline_data": {"mime_type": mime_type, "data": image_bytes}},
        ],
        config={"response_mime_type": "application/json"},
    )
    parsed = _parse_json_response(response.text)
    parsed["source"] = f"gemini:{GEMINI_MODEL}"
    return parsed


def _try_groq(image_bytes: bytes, mime_type: str) -> dict:
    if groq_client is None:
        raise RuntimeError("Groq not configured (no GROQ_API_KEY)")
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    response = groq_client.chat.completions.create(
        model=GROQ_VISION_MODEL,
        max_tokens=400,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": SYSTEM_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
                ],
            }
        ],
    )
    parsed = _parse_json_response(response.choices[0].message.content)
    parsed["source"] = f"groq:{GROQ_VISION_MODEL}"
    return parsed


def _classical_cv_fallback(image_bytes: bytes) -> dict:
    """
    Zero-dependency, offline quality + TYPE heuristic using only OpenCV/PIL/
    numpy - no API key, no network call, so this step always succeeds. Used
    when both LLM vision providers are unavailable (missing keys, rate-
    limited, offline demo).

    Quality: dark/brown-spot ratio + low-saturation "dull" ratio, the same
    core technique used by classical fruit-freshness CV projects.

    Type: NOT a trained classifier (no labeled dataset available in this
    fallback path) - instead a color + shape descriptor matcher. It segments
    the produce from the background, measures its dominant hue/saturation
    and its shape (aspect ratio, circularity, blob count), and scores that
    against a small reference profile per known produce type. This is
    deliberately capped at a modest confidence (see TYPE_CONFIDENCE_CAP)
    because it's much weaker than a real trained model or the LLM vision
    providers above - it's a reasonable guess, not a strong one, so the
    frontend only auto-fills the dropdown when the match is convincing and
    otherwise leaves it for the seller to confirm.
    """
    import cv2

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((512, 512))
    arr = np.array(img)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    total_px = h.size

    # ---- Quality heuristic (unchanged) ----
    dark_mask = v < 60
    brown_mask = ((h >= 5) & (h <= 25) & (v < 130) & (s > 60))
    defect_mask = dark_mask | brown_mask
    defect_ratio = float(np.count_nonzero(defect_mask)) / total_px

    dull_mask = (s < 40) & (v > 60) & (v < 200)
    dull_ratio = float(np.count_nonzero(dull_mask)) / total_px

    defect_score = min(1.0, defect_ratio * 3.0 + dull_ratio * 0.5)
    quality_score = round(max(0, 100 - defect_score * 100))

    if quality_score >= 85:
        label = "excellent"
    elif quality_score >= 65:
        label = "good"
    elif quality_score >= 40:
        label = "fair"
    elif quality_score >= 15:
        label = "poor"
    else:
        label = "spoiled"

    defects = []
    if defect_ratio > 0.03:
        defects.append("dark/brown spotting detected on part of the surface")
    if dull_ratio > 0.25:
        defects.append("dulled color, possible dehydration or ageing")
    if not defects:
        defects.append("no significant surface defects detected")

    # ---- Type heuristic (color + shape matching) ----
    guessed_type, type_confidence, shape_note = _guess_produce_type_classical(hsv)

    reasoning = (
        f"Offline image analysis found {defect_ratio * 100:.1f}% of the surface "
        f"showing dark/brown discoloration - graded as '{label}'."
    )
    if guessed_type != "unknown":
        reasoning += (
            f" Color/shape analysis (no AI model available) suggests this is most "
            f"likely {guessed_type} ({shape_note}) - please confirm."
        )
    else:
        reasoning += " Could not confidently guess the produce type - please select it manually."

    return {
        "produce_type": guessed_type,
        "produce_confidence": type_confidence,
        "quality_label": label,
        "quality_score": int(quality_score),
        "defects_observed": defects,
        "reasoning": reasoning,
        "source": "classical_cv",
    }


# Highest confidence the color/shape heuristic is allowed to report - kept
# well below what a real trained classifier or LLM would report, since a
# handful of color/shape descriptors will always be a much weaker signal
# than either of those. Tune down further if false-positive auto-fills
# turn out to be a problem in practice.
TYPE_CONFIDENCE_CAP = 0.58

# Reference color/shape profile per known produce type, built from typical
# real-world appearance. Hue is OpenCV's 0-179 scale (not 0-359).
#   hue_ranges: list of (lo, hi) bands this produce's skin color usually falls in
#   sat_range: typical saturation band (0-255) - low = pale/papery/brownish
#   aspect_range: (min, max) of the longer/shorter side of its bounding box
#     (1.0 = perfectly round/square, higher = more elongated)
#   circularity_range: (min, max) of 4*pi*area/perimeter^2 (1.0 = perfect circle)
_PRODUCE_PROFILES = {
    "tomato":      {"hue": [(0, 8), (170, 179)], "sat": (90, 255), "aspect": (1.0, 1.25), "circ": (0.75, 1.0)},
    "apple":       {"hue": [(0, 10), (170, 179), (35, 85)], "sat": (60, 255), "aspect": (1.0, 1.3), "circ": (0.7, 1.0)},
    "mango":       {"hue": [(15, 35)], "sat": (80, 255), "aspect": (1.2, 1.7), "circ": (0.55, 0.85)},
    "papaya":      {"hue": [(15, 35), (40, 85)], "sat": (60, 220), "aspect": (1.3, 2.2), "circ": (0.4, 0.75)},
    "banana":      {"hue": [(22, 35)], "sat": (70, 255), "aspect": (2.0, 5.0), "circ": (0.15, 0.55)},
    "potato":      {"hue": [(10, 30)], "sat": (20, 110), "aspect": (1.0, 1.4), "circ": (0.6, 0.9)},
    "onion":       {"hue": [(10, 35), (130, 160)], "sat": (10, 120), "aspect": (1.0, 1.3), "circ": (0.65, 0.95)},
    "grapes":      {"hue": [(100, 160), (40, 85)], "sat": (60, 255), "aspect": (1.0, 2.0), "circ": (0.1, 0.6)},
    "spinach":     {"hue": [(40, 85)], "sat": (60, 255), "aspect": (1.0, 2.5), "circ": (0.1, 0.5)},
    "cauliflower": {"hue": [(0, 179)], "sat": (0, 45), "aspect": (1.0, 1.6), "circ": (0.2, 0.6)},
}


def _band_score(value: float, lo: float, hi: float, softness: float) -> float:
    """1.0 inside [lo, hi], decaying linearly to 0 over `softness` units outside it."""
    if lo <= value <= hi:
        return 1.0
    dist = (lo - value) if value < lo else (value - hi)
    return max(0.0, 1.0 - dist / softness)


def _hue_score(hue: float, ranges) -> float:
    best = 0.0
    for lo, hi in ranges:
        best = max(best, _band_score(hue, lo, hi, softness=10))
    return best


def _guess_produce_type_classical(hsv: np.ndarray):
    """
    Segments the produce from a plain background, extracts dominant hue/
    saturation + shape descriptors, and scores them against _PRODUCE_PROFILES.
    Returns (produce_type_or_'unknown', confidence 0-TYPE_CONFIDENCE_CAP, note).
    """
    import cv2

    h_ch, s_ch, v_ch = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    # Background = pale/plain surface: low saturation AND bright (typical
    # mandi crate, marble counter, white sheet, etc). Everything else is
    # assumed to be the produce.
    background = (s_ch < 30) & (v_ch > 170)
    foreground = (~background).astype(np.uint8) * 255

    # Clean up small noise / holes so we get one solid blob to measure.
    kernel = np.ones((7, 7), np.uint8)
    foreground = cv2.morphologyEx(foreground, cv2.MORPH_CLOSE, kernel)
    foreground = cv2.morphologyEx(foreground, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(foreground, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return "unknown", 0.0, "no distinct produce shape found against the background"

    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    main = contours[0]
    area = cv2.contourArea(main)
    total_px = h_ch.size
    if area < total_px * 0.03:
        return "unknown", 0.0, "produce too small in frame to analyze shape"

    perimeter = cv2.arcLength(main, True)
    circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0.0

    x, y, w, box_h = cv2.boundingRect(main)
    aspect = max(w, box_h) / max(1, min(w, box_h))

    # How many separate produce-colored blobs are visible (grapes/cauliflower
    # florets tend to show up as several smaller blobs rather than one).
    significant_blobs = sum(1 for c in contours if cv2.contourArea(c) > total_px * 0.005)

    mask = np.zeros(foreground.shape, dtype=np.uint8)
    cv2.drawContours(mask, [main], -1, 255, thickness=cv2.FILLED)
    fg_pixels = mask > 0

    colorful = fg_pixels & (s_ch > 35)
    if np.count_nonzero(colorful) > total_px * 0.01:
        hues = h_ch[colorful].astype(np.float32)
        # Circular mean (hue wraps at 180 in OpenCV) so reds near 0 and near
        # 179 don't cancel out to a false green-ish average.
        angles = hues * (np.pi / 90.0)
        mean_angle = np.arctan2(np.mean(np.sin(angles)), np.mean(np.cos(angles)))
        dominant_hue = float((mean_angle / (np.pi / 90.0)) % 180)
        mean_sat = float(np.mean(s_ch[fg_pixels]))
    else:
        dominant_hue = float(np.mean(h_ch[fg_pixels]))
        mean_sat = float(np.mean(s_ch[fg_pixels]))

    if significant_blobs >= 5:
        aspect_for_scoring = 1.0
        circularity_for_scoring = 0.3
    else:
        aspect_for_scoring = aspect
        circularity_for_scoring = circularity

    scores = {}
    for produce, profile in _PRODUCE_PROFILES.items():
        hue_s = _hue_score(dominant_hue, profile["hue"])
        sat_s = _band_score(mean_sat, *profile["sat"], softness=40)
        aspect_s = _band_score(aspect_for_scoring, *profile["aspect"], softness=0.6)
        circ_s = _band_score(circularity_for_scoring, *profile["circ"], softness=0.25)
        # Color matters more than shape - two similarly-round red things
        # (tomato/apple) are genuinely hard to tell apart by shape alone.
        scores[produce] = hue_s * 0.5 + sat_s * 0.15 + aspect_s * 0.2 + circ_s * 0.15

    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    if best_score < 0.45:
        return "unknown", 0.0, "no confident color/shape match to a known produce type"

    confidence = round(min(TYPE_CONFIDENCE_CAP, best_score * TYPE_CONFIDENCE_CAP), 2)
    note = f"hue~{int(dominant_hue)}, aspect~{aspect_for_scoring:.2f}, circularity~{circularity_for_scoring:.2f}"
    return best_type, confidence, note


def analyze_produce_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Returns dict: {produce_type, produce_confidence, quality_label, quality_score,
                   defects_observed, reasoning, source, shelf_life_adjustment_pct}
    Tries providers in order: Gemini -> Groq vision -> classical CV (always works).
    'source' tells the frontend which one actually answered, for the same
    on-stage transparency the recommendation agent already provides.
    """
    attempts = [
        lambda: _try_gemini(image_bytes, mime_type),
        lambda: _try_groq(image_bytes, mime_type),
    ]
    result = None
    for attempt in attempts:
        try:
            result = attempt()
            break
        except (RuntimeError, GroqError, GeminiAPIError, ValueError, json.JSONDecodeError, Exception):
            continue

    if result is None:
        result = _classical_cv_fallback(image_bytes)

    result["produce_type"] = result["produce_type"].strip().lower()
    result["shelf_life_adjustment_pct"] = QUALITY_SHELF_LIFE_ADJUSTMENT.get(
        result["quality_label"], 0.0
    )
    return result
