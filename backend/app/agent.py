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

from app.shelf_life import calculate_dynamic_discount, COMPOST_THRESHOLD_DAYS

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

# Used to turn a UI language code into a name the LLM can follow reliably.
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "pa": "Punjabi",
}

SYSTEM_PROMPT_TEMPLATE = """You are a supply-chain decision agent for a fresh produce \
rescue marketplace in India. Given a batch of produce with its estimated \
remaining shelf life, quantity, and location, decide the single best action.

Respond with ONLY a JSON object (no markdown, no preamble) in this exact shape:
{{
  "action": "hold" | "markdown" | "donate" | "fast_track" | "compost",
  "discount_pct": <integer 0-90, 0 if action is not markdown>,
  "reasoning": "<one or two plain-language sentences a non-technical mandi trader can understand>"
}}

Guidelines:
- remaining_days > 3 -> usually "hold"
- remaining_days between 1 and 3 -> usually "markdown" (higher discount as days decrease)
- remaining_days <= 1 and quantity is large -> "fast_track" (needs to move NOW, possibly bulk deal)
- remaining_days <= 0 (just past shelf life) or produce is clearly unsellable -> "donate"
- remaining_days significantly negative (rotten, spoiled well past shelf life, not fit even
  for donation) -> "compost" so it's kept out of landfill instead of wasted entirely
- Keep reasoning short, practical, and specific to the numbers given.
- IMPORTANT: Write the "reasoning" value in {language_name}, using the Devanagari/native \
script for that language where applicable (not transliterated English). Keep "action" and \
all other JSON keys/values in English exactly as specified above - only "reasoning" is translated.
"""

# Rule-based fallback reasoning strings, per language, keyed the same as the
# English f-strings below. Used when every LLM provider is unavailable, so
# the app still speaks the seller's language even fully offline.
FALLBACK_STRINGS = {
    "en": {
        "donate": "Shelf life has run out, so this batch should be routed to donation immediately to avoid a total loss.",
        "urgent": "Less than a day of shelf life remains, so this batch needs to move immediately.",
        "markdown": "Shelf life is getting short ({days} days left), so a {discount}% discount will help move stock before it spoils.",
        "hold": "Plenty of shelf life remains, so this batch can be held at normal price for now.",
        "compost": "This batch is well past its shelf life and no longer fit for donation, so it should be composted instead of thrown away.",
    },
    "hi": {
        "donate": "शेल्फ लाइफ समाप्त हो चुकी है, इसलिए नुकसान से बचने के लिए इस बैच को तुरंत दान में भेजा जाना चाहिए।",
        "urgent": "एक दिन से भी कम शेल्फ लाइफ बची है, इसलिए इस बैच को तुरंत बेचना जरूरी है।",
        "markdown": "शेल्फ लाइफ कम हो रही है ({days} दिन बचे हैं), इसलिए {discount}% छूट से माल जल्दी बिकने में मदद मिलेगी।",
        "hold": "अभी काफी शेल्फ लाइफ बची है, इसलिए इस बैच को सामान्य कीमत पर रोका जा सकता है।",
        "compost": "यह बैच शेल्फ लाइफ से काफी आगे निकल चुका है और अब दान के लायक भी नहीं है, इसलिए इसे फेंकने के बजाय खाद बनाने के लिए भेजा जाना चाहिए।",
    },
    "bn": {
        "donate": "মেয়াদ শেষ হয়ে গেছে, তাই সম্পূর্ণ ক্ষতি এড়াতে এই ব্যাচটি অবিলম্বে দান করা উচিত।",
        "urgent": "এক দিনেরও কম মেয়াদ বাকি আছে, তাই এই ব্যাচটি এখনই বিক্রি করা দরকার।",
        "markdown": "মেয়াদ কমে আসছে ({days} দিন বাকি), তাই {discount}% ছাড় দিলে মাল দ্রুত বিক্রি হতে সাহায্য করবে।",
        "hold": "এখনও যথেষ্ট মেয়াদ আছে, তাই এই ব্যাচটি স্বাভাবিক দামে রাখা যেতে পারে।",
        "compost": "এই ব্যাচটি মেয়াদের অনেক পরে চলে গেছে এবং আর দানের যোগ্য নয়, তাই ফেলে না দিয়ে এটি কম্পোস্ট করা উচিত।",
    },
    "ta": {
        "donate": "ஆயுட்காலம் முடிந்துவிட்டது, எனவே முழு இழப்பைத் தவிர்க்க இந்த தொகுதி உடனடியாக நன்கொடையாக அனுப்பப்பட வேண்டும்.",
        "urgent": "ஒரு நாளுக்கும் குறைவான ஆயுட்காலம் மட்டுமே உள்ளது, எனவே இந்த தொகுதி உடனடியாக விற்கப்பட வேண்டும்.",
        "markdown": "ஆயுட்காலம் குறைந்து வருகிறது ({days} நாட்கள் மீதம்), எனவே {discount}% தள்ளுபடி பொருளை விற்பனை செய்ய உதவும்.",
        "hold": "இன்னும் போதுமான ஆயுட்காலம் உள்ளது, எனவே இந்த தொகுதியை சாதாரண விலையில் வைத்திருக்கலாம்.",
        "compost": "இந்த தொகுதி ஆயுட்காலத்தை தாண்டிவிட்டது, நன்கொடைக்கும் தகுதியற்றது, எனவே இதை வீணாக்காமல் உரமாக்க வேண்டும்.",
    },
    "te": {
        "donate": "షెల్ఫ్ లైఫ్ ముగిసిపోయింది, కాబట్టి పూర్తి నష్టాన్ని నివారించడానికి ఈ బ్యాచ్‌ని వెంటనే దానం చేయాలి.",
        "urgent": "ఒక రోజు కంటే తక్కువ షెల్ఫ్ లైఫ్ మిగిలి ఉంది, కాబట్టి ఈ బ్యాచ్‌ని వెంటనే అమ్మాలి.",
        "markdown": "షెల్ఫ్ లైఫ్ తగ్గుతోంది ({days} రోజులు మిగిలి ఉన్నాయి), కాబట్టి {discount}% డిస్కౌంట్ సరుకును త్వరగా అమ్మడానికి సహాయపడుతుంది.",
        "hold": "ఇంకా తగినంత షెల్ఫ్ లైఫ్ ఉంది, కాబట్టి ఈ బ్యాచ్‌ని సాధారణ ధరకే ఉంచవచ్చు.",
        "compost": "ఈ బ్యాచ్ షెల్ఫ్ లైఫ్‌ను చాలా దాటిపోయింది మరియు దానం చేయడానికి కూడా పనికిరాదు, కాబట్టి పారేయకుండా కంపోస్ట్ చేయాలి.",
    },
    "mr": {
        "donate": "शेल्फ लाइफ संपली आहे, त्यामुळे संपूर्ण नुकसान टाळण्यासाठी हा बॅच त्वरित दान करावा.",
        "urgent": "एका दिवसापेक्षा कमी शेल्फ लाइफ शिल्लक आहे, त्यामुळे हा बॅच त्वरित विकणे आवश्यक आहे.",
        "markdown": "शेल्फ लाइफ कमी होत आहे ({days} दिवस शिल्लक), त्यामुळे {discount}% सवलतीमुळे माल लवकर विकण्यास मदत होईल.",
        "hold": "अजून पुरेशी शेल्फ लाइफ शिल्लक आहे, त्यामुळे हा बॅच सध्या सामान्य किमतीत ठेवता येईल.",
        "compost": "हा बॅच शेल्फ लाइफच्या खूप पुढे गेला आहे आणि आता दानासाठीही योग्य नाही, त्यामुळे तो फेकण्याऐवजी कंपोस्ट करावा.",
    },
    "gu": {
        "donate": "શેલ્ફ લાઇફ પૂરી થઈ ગઈ છે, તેથી સંપૂર્ણ નુકસાન ટાળવા આ બેચ તાત્કાલિક દાનમાં આપવો જોઈએ.",
        "urgent": "એક દિવસ કરતાં ઓછી શેલ્ફ લાઇફ બાકી છે, તેથી આ બેચ તાત્કાલિક વેચવો જરૂરી છે.",
        "markdown": "શેલ્ફ લાઇફ ઘટી રહી છે ({days} દિવસ બાકી), તેથી {discount}% ડિસ્કાઉન્ટ માલ ઝડપથી વેચવામાં મદદ કરશે.",
        "hold": "હજુ પૂરતી શેલ્ફ લાઇફ બાકી છે, તેથી આ બેચ સામાન્ય ભાવે રાખી શકાય છે.",
        "compost": "આ બેચ શેલ્ફ લાઇફ કરતાં ઘણો આગળ નીકળી ગયો છે અને હવે દાન માટે પણ યોગ્ય નથી, તેથી તેને ફેંકવાને બદલે ખાતર બનાવવું જોઈએ.",
    },
    "kn": {
        "donate": "ಶೆಲ್ಫ್ ಲೈಫ್ ಮುಗಿದಿದೆ, ಆದ್ದರಿಂದ ಸಂಪೂರ್ಣ ನಷ್ಟ ತಪ್ಪಿಸಲು ಈ ಬ್ಯಾಚ್ ಅನ್ನು ತಕ್ಷಣ ದಾನ ಮಾಡಬೇಕು.",
        "urgent": "ಒಂದು ದಿನಕ್ಕಿಂತ ಕಡಿಮೆ ಶೆಲ್ಫ್ ಲೈಫ್ ಉಳಿದಿದೆ, ಆದ್ದರಿಂದ ಈ ಬ್ಯಾಚ್ ಅನ್ನು ತಕ್ಷಣ ಮಾರಾಟ ಮಾಡಬೇಕು.",
        "markdown": "ಶೆಲ್ಫ್ ಲೈಫ್ ಕಡಿಮೆಯಾಗುತ್ತಿದೆ ({days} ದಿನಗಳು ಉಳಿದಿವೆ), ಆದ್ದರಿಂದ {discount}% ರಿಯಾಯಿತಿ ಸರಕನ್ನು ಬೇಗ ಮಾರಾಟ ಮಾಡಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
        "hold": "ಇನ್ನೂ ಸಾಕಷ್ಟು ಶೆಲ್ಫ್ ಲೈಫ್ ಉಳಿದಿದೆ, ಆದ್ದರಿಂದ ಈ ಬ್ಯಾಚ್ ಅನ್ನು ಸಾಮಾನ್ಯ ಬೆಲೆಯಲ್ಲಿ ಇರಿಸಬಹುದು.",
        "compost": "ಈ ಬ್ಯಾಚ್ ಶೆಲ್ಫ್ ಲೈಫ್ ಅನ್ನು ಬಹಳ ಮೀರಿದೆ ಮತ್ತು ಈಗ ದಾನಕ್ಕೂ ಯೋಗ್ಯವಿಲ್ಲ, ಆದ್ದರಿಂದ ಎಸೆಯುವ ಬದಲು ಕಾಂಪೋಸ್ಟ್ ಮಾಡಬೇಕು.",
    },
    "pa": {
        "donate": "ਸ਼ੈਲਫ ਲਾਈਫ ਖਤਮ ਹੋ ਗਈ ਹੈ, ਇਸ ਲਈ ਪੂਰੇ ਨੁਕਸਾਨ ਤੋਂ ਬਚਣ ਲਈ ਇਸ ਬੈਚ ਨੂੰ ਤੁਰੰਤ ਦਾਨ ਕਰ ਦੇਣਾ ਚਾਹੀਦਾ ਹੈ।",
        "urgent": "ਇੱਕ ਦਿਨ ਤੋਂ ਵੀ ਘੱਟ ਸ਼ੈਲਫ ਲਾਈਫ ਬਾਕੀ ਹੈ, ਇਸ ਲਈ ਇਸ ਬੈਚ ਨੂੰ ਤੁਰੰਤ ਵੇਚਣਾ ਜ਼ਰੂਰੀ ਹੈ।",
        "markdown": "ਸ਼ੈਲਫ ਲਾਈਫ ਘੱਟ ਹੋ ਰਹੀ ਹੈ ({days} ਦਿਨ ਬਾਕੀ), ਇਸ ਲਈ {discount}% ਛੋਟ ਮਾਲ ਨੂੰ ਜਲਦੀ ਵੇਚਣ ਵਿੱਚ ਮਦਦ ਕਰੇਗੀ।",
        "hold": "ਹਾਲੇ ਵੀ ਕਾਫ਼ੀ ਸ਼ੈਲਫ ਲਾਈਫ ਬਾਕੀ ਹੈ, ਇਸ ਲਈ ਇਸ ਬੈਚ ਨੂੰ ਆਮ ਕੀਮਤ 'ਤੇ ਰੋਕਿਆ ਜਾ ਸਕਦਾ ਹੈ।",
        "compost": "ਇਹ ਬੈਚ ਸ਼ੈਲਫ ਲਾਈਫ ਤੋਂ ਬਹੁਤ ਅੱਗੇ ਲੰਘ ਚੁੱਕਾ ਹੈ ਅਤੇ ਹੁਣ ਦਾਨ ਦੇ ਯੋਗ ਵੀ ਨਹੀਂ, ਇਸ ਲਈ ਇਸਨੂੰ ਸੁੱਟਣ ਦੀ ਬਜਾਏ ਖਾਦ ਬਣਾਉਣਾ ਚਾਹੀਦਾ ਹੈ।",
    },
}


def _rule_based_fallback(
    remaining_days: float,
    quantity_kg: float,
    produce_type: str,
    storage_condition: str,
    language: str = "en",
) -> dict:
    """
    Deterministic backup logic - used if every LLM provider fails.
    Discount is computed with a smooth urgency curve (see shelf_life.py)
    instead of jumping between a couple of fixed numbers, so the offline
    fallback still looks "smart" on stage. Reasoning strings are translated
    (see FALLBACK_STRINGS), so this still works offline in the seller's language.
    """
    strings = FALLBACK_STRINGS.get(language, FALLBACK_STRINGS["en"])

    if remaining_days <= COMPOST_THRESHOLD_DAYS:
        return {
            "action": "compost",
            "discount_pct": 0,
            "reasoning": strings["compost"],
            "source": "rule_based",
        }
    elif remaining_days <= 0:
        return {
            "action": "donate",
            "discount_pct": 100,
            "reasoning": strings["donate"],
            "source": "rule_based",
        }
    elif remaining_days <= 1:
        action = "fast_track" if quantity_kg > 20 else "markdown"
        discount = calculate_dynamic_discount(remaining_days, produce_type, storage_condition) if action == "markdown" else 0
        return {
            "action": action,
            "discount_pct": discount,
            "reasoning": strings["urgent"],
            "source": "rule_based",
        }
    elif remaining_days <= 3:
        discount = calculate_dynamic_discount(remaining_days, produce_type, storage_condition)
        return {
            "action": "markdown",
            "discount_pct": discount,
            "reasoning": strings["markdown"].format(days=remaining_days, discount=discount),
            "source": "rule_based",
        }
    else:
        return {
            "action": "hold",
            "discount_pct": 0,
            "reasoning": strings["hold"],
            "source": "rule_based",
        }


def _parse_json_response(text: str) -> dict:
    """Shared cleanup + validation for any LLM's raw text output."""
    text = text.strip().replace("```json", "").replace("```", "").strip()
    parsed = json.loads(text)
    if parsed.get("action") not in {"hold", "markdown", "donate", "fast_track", "compost"}:
        raise ValueError("invalid action from LLM")
    return parsed


def _try_groq(model: str, system_prompt: str, user_prompt: str) -> dict:
    if groq_client is None:
        raise RuntimeError("Groq not configured (no GROQ_API_KEY)")

    response = groq_client.chat.completions.create(
        model=model,
        max_tokens=300,
        temperature=0.3,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    parsed = _parse_json_response(response.choices[0].message.content)
    parsed["source"] = f"groq:{model}"
    return parsed


def _try_gemini(system_prompt: str, user_prompt: str) -> dict:
    if gemini_client is None:
        raise RuntimeError("Gemini not configured (no GEMINI_API_KEY)")

    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=f"{system_prompt}\n\n{user_prompt}",
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
    language: str = "en",
) -> dict:
    """
    Returns dict: {action, discount_pct, reasoning, source}
    Tries providers in order: Groq primary -> Gemini -> Groq backup -> rule-based.
    'source' tells you which one actually answered (useful for debugging/demo transparency).

    'language' is an ISO 639-1 code (e.g. "hi" for Hindi) matching the seller's UI
    language - the LLM is instructed to write "reasoning" in that language, and the
    rule-based fallback uses pre-translated strings so it still works fully offline.
    """
    language = language or "en"
    language_name = LANGUAGE_NAMES.get(language, "English")
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(language_name=language_name)

    user_prompt = (
        f"Produce: {produce_type}\n"
        f"Remaining shelf life: {remaining_days} days\n"
        f"Quantity: {quantity_kg} kg\n"
        f"Location: {location}\n"
    )

    attempts = [
        lambda: _try_groq(GROQ_PRIMARY_MODEL, system_prompt, user_prompt),
        lambda: _try_gemini(system_prompt, user_prompt),
        lambda: _try_groq(GROQ_BACKUP_MODEL, system_prompt, user_prompt),
    ]

    for attempt in attempts:
        try:
            return attempt()
        except (GroqError, GeminiAPIError, RuntimeError, json.JSONDecodeError,
                 ValueError, KeyError, IndexError, AttributeError):
            continue  # try the next provider in the chain

    # every provider failed (or none configured) - deterministic fallback
    return _rule_based_fallback(remaining_days, quantity_kg, produce_type, storage_condition, language)