import google.generativeai as genai
from app.core.config import settings
from app.db.models import StandupEntry
from typing import List

def generate_summary(entries: List[StandupEntry]) -> str:
    if not settings.GEMINI_API_KEY:
        return "AI Summary: API Key missing. Please configure GEMINI_API_KEY."

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')
    
    # Format entries for the prompt
    entries_text = ""
    for entry in entries:
        entries_text += f"- Date: {entry.date.date()}\n"
        entries_text += f"  Did: {entry.did_yesterday}\n"
        entries_text += f"  Doing: {entry.doing_today}\n"
        entries_text += f"  Blockers: {entry.blockers or 'None'}\n\n"
    
    prompt = f"""
    You are an AI assistant helping a developer summarize their weekly standups.
    Below are the standup entries for the past week:
    
    {entries_text}
    
    Please provide a concise, professional paragraph summarizing the key accomplishments, 
    upcoming focus, and any persistent blockers. Keep it clean and readable for a team lead.
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI Summary: Failed to generate summary. Error: {str(e)}"
