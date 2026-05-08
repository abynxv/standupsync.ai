import logging
from typing import List

from google import genai
from google.genai import types

from app.core.config import settings
from app.db.models import StandupEntry

logger = logging.getLogger(__name__)


def generate_summary(entries: List[StandupEntry]) -> str:
    if not settings.GEMINI_API_KEY:
        return "AI summary unavailable: GEMINI_API_KEY is not configured."

    entries_text = "\n".join(
        f"- {entry.date.date()}  |  Did: {entry.did_yesterday}  |  "
        f"Doing: {entry.doing_today}  |  Blockers: {entry.blockers or 'None'}"
        for entry in entries
    )

    prompt = (
        "You are an engineering manager writing a brief weekly update for a developer.\n"
        "Given the standup entries below, write a single concise paragraph (3-5 sentences) "
        "covering: key accomplishments, current focus, and any recurring blockers. "
        "Be factual, professional, and skip filler phrases.\n\n"
        f"{entries_text}"
    )

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=300,
                temperature=0.4,
            ),
        )
        return response.text
    except Exception as exc:
        logger.error(f"Gemini API call failed: {exc}", exc_info=True)
        return f"AI summary generation failed: {exc}"
