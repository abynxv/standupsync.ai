import logging

def send_digest_email(email: str, summary_text: str):
    # In a real app, integrate with SendGrid/SMTP
    logging.info(f"Sending Weekly Digest to {email}")
    logging.info(f"Summary: {summary_text[:100]}...")
    
    # Placeholder for actual email sending logic
    print(f"DEBUG: Email sent to {email} with summary.")
