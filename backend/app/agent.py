"""
The AI Agent layer.

Takes batch data (produce type, remaining shelf life, quantity, location)
and returns a structured decision: hold / markdown / donate / fast_track,
with a plain-language reason.

FALLBACK CHAIN (for maximum demo reliability):
  1. Groq primary model   (llama-3.3-70b-versatile) - fast, free tier
  2. Gemini                (gemini-2.0-flash)        - free tier, different provider
  3. Groq backup model     (llama-3.1-8b-instant)    - smaller/faster, different quota
  4. Rule-based logic      (no API, always works)

Each step only runs if the previous one fails (missing key, rate limit,
network issue, bad JSON, etc). This means the demo NEVER breaks on stage,
even if one or two providers are down or rate-limited.
"""
import json
import os

from groq import Groq, GroqError
from google import genai
from google.genai.errors import APIError as GeminiAPIError

from app.shelf_life import calculate_dynamic_discount

# ---- Client setup (only initialized if the relevant key is present) ----

groq_client = None
groq_api_key = os.getenv("GROQ_API_KEY")
if groq_api_key:
    groq_client = Groq(api_key=groq_api_key)

gemini_client = None
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    gemini_client = genai.Client(api_key=gemini_api_key)

GROQ_PRIMARY_MODEL = "llama-3.3-70b-versatile"
GROQ_BACKUP_MODEL = "llama-3.1-8b-instant"
GEMINI_MODEL = "gemini-2.0-flash"

SYSTEM_PROMPT = """You are a supply-chain decision agent for a fresh produce \
rescue marketplace in India. Given a batch of produce with its estimated \
remaining shelf life, quantity, and location, decide the single best action.

Respond with ONLY a JSON object (no markdown, no preamble) in this exact shape:
{
  "action": "hold" | "markdown" | "donate" | "fast_track",
  "discount_pct": <integer 0-90, 0 if action is not markdown>,
  "reasoning": "<one or two plain-language sentences a non-technical mandi trader can understand>"
}

Guidelines:
- remaining_days > 3 -> usually "hold"
- remaining_days between 1 and 3 -> usually "markdown" (higher discount as days decrease)
- remaining_days <= 1 and quantity is large -> "fast_track" (needs to move NOW, possibly bulk deal)
- remaining_days <= 0 or produce is clearly unsellable -> "donate"
- Keep reasoning short, practical, and specific to the numbers given.
"""


def _rule_based_fallback(
    remaining_days: float,
    quantity_kg: float,
    produce_type: str,
    storage_condition: str,
) -> dict:
    """
    Deterministic backup logic - used if every LLM provider fails.
    Discount is computed with a smooth urgency curve (see shelf_life.py)
    instead of jumping between a couple of fixed numbers, so the offline
    fallback still looks "smart" on stage.
    """
    if remaining_days <= 0:
        return {
            "action": "donate",
            "discount_pct": 100,
            "reasoning": "Shelf life has run out, so this batch should be routed to donation immediately to avoid a total loss.",
            "source": "rule_based",
        }
    elif remaining_days <= 1:
        action = "fast_track" if quantity_kg > 20 else "markdown"
        discount = calculate_dynamic_discount(remaining_days, produce_type, storage_condition) if action == "markdown" else 0
        return {
            "action": action,
            "discount_pct": discount,
            "reasoning": "Less than a day of shelf life remains, so this batch needs to move immediately.",
            "source": "rule_based",
        }
    elif remaining_days <= 3:
        discount = calculate_dynamic_discount(remaining_days, produce_type, storage_condition)
        return {
            "action": "markdown",
            "discount_pct": discount,
            "reasoning": f"Shelf life is getting short ({remaining_days} days left), so a {discount}% discount will help move stock before it spoils.",
            "source": "rule_based",
        }
    else:
        return {
            "action": "hold",
            "discount_pct": 0,
            "reasoning": "Plenty of shelf life remains, so this batch can be held at normal price for now.",
            "source": "rule_based",
        }


def _parse_json_response(text: str) -> dict:
    """Shared cleanup + validation for any LLM's raw text output."""
    text = text.strip().replace("```json", "").replace("```", "").strip()
    parsed = json.loads(text)
    if parsed.get("action") not in {"hold", "markdown", "donate", "fast_track"}:
        raise ValueError("invalid action from LLM")
    return parsed


def _try_groq(model: str, user_prompt: str) -> dict:
    if groq_client is None:
        raise RuntimeError("Groq not configured (no GROQ_API_KEY)")

    response = groq_client.chat.completions.create(
        model=model,
        max_tokens=300,
        temperature=0.3,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    parsed = _parse_json_response(response.choices[0].message.content)
    parsed["source"] = f"groq:{model}"
    return parsed


def _try_gemini(user_prompt: str) -> dict:
    if gemini_client is None:
        raise RuntimeError("Gemini not configured (no GEMINI_API_KEY)")

    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=f"{SYSTEM_PROMPT}\n\n{user_prompt}",
        config={"response_mime_type": "application/json"},
    )
    parsed = _parse_json_response(response.text)
    parsed["source"] = f"gemini:{GEMINI_MODEL}"
    return parsed


def get_agent_recommendation(
    produce_type: str,
    remaining_days: float,
    quantity_kg: float,
    location: str,
    storage_condition: str = "room_temp",
) -> dict:
    """
    Returns dict: {action, discount_pct, reasoning, source}
    Tries providers in order: Groq primary -> Gemini -> Groq backup -> rule-based.
    'source' tells you which one actually answered (useful for debugging/demo transparency).
    """
    user_prompt = (
        f"Produce: {produce_type}\n"
        f"Remaining shelf life: {remaining_days} days\n"
        f"Quantity: {quantity_kg} kg\n"
        f"Location: {location}\n"
    )

    attempts = [
        lambda: _try_groq(GROQ_PRIMARY_MODEL, user_prompt),
        lambda: _try_gemini(user_prompt),
        lambda: _try_groq(GROQ_BACKUP_MODEL, user_prompt),
    ]

    for attempt in attempts:
        try:
            return attempt()
        except (GroqError, GeminiAPIError, RuntimeError, json.JSONDecodeError,
                 ValueError, KeyError, IndexError, AttributeError):
            continue  # try the next provider in the chain

    # every provider failed (or none configured) - deterministic fallback
    return _rule_based_fallback(remaining_days, quantity_kg, produce_type, storage_condition)