"""
Gmail API Email Sender using OAuth2

This module provides a function to send emails via the Gmail API
using OAuth2 credentials instead of SMTP with app passwords.
"""

import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from django.conf import settings

# Gmail API scope for sending emails
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def get_gmail_credentials():
    """
    Get or refresh Gmail API credentials.
    
    Uses token.json if available, otherwise uses credentials.json to perform OAuth flow.
    For production (Cloud Run), credentials should be loaded from environment variables.
    """
    creds = None
    
    # Check for environment variables (for Cloud Run deployment)
    token_json = os.getenv('GMAIL_TOKEN_JSON')
    if token_json:
        import json
        token_data = json.loads(token_json)
        creds = Credentials.from_authorized_user_info(token_data, SCOPES)
    
    # Check for token file (local development)
    token_path = getattr(settings, 'GMAIL_TOKEN_PATH', 'gmail-token.json')
    if not creds and os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    
    # If credentials are expired, refresh them
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Save refreshed token
        if os.path.exists(token_path):
            with open(token_path, 'w') as token:
                token.write(creds.to_json())
    
    # If no valid credentials, raise error (setup not complete)
    if not creds or not creds.valid:
        raise Exception(
            "Gmail credentials not found or invalid. "
            "Run 'python scripts/setup_gmail_oauth.py' to set up OAuth."
        )
    
    return creds


def send_gmail_message(to_emails, subject, body, attachments=None, cc_emails=None, from_email=None):
    """
    Send an email using the Gmail API.
    
    Args:
        to_emails: List of recipient email addresses
        subject: Email subject
        body: Email body (plain text)
        attachments: List of tuples (filename, content_bytes, mime_type)
        cc_emails: List of CC email addresses (optional)
        from_email: Sender email (uses GMAIL_SENDER_EMAIL from settings if not provided)
    
    Returns:
        dict: API response with message ID
    
    Raises:
        Exception: If credentials are invalid or sending fails
    """
    creds = get_gmail_credentials()
    service = build('gmail', 'v1', credentials=creds)
    
    # Create message
    message = MIMEMultipart()
    message['to'] = ', '.join(to_emails)
    message['subject'] = subject
    
    # Set sender (me = authenticated account)
    sender = from_email or getattr(settings, 'GMAIL_SENDER_EMAIL', 'me')
    message['from'] = sender
    
    if cc_emails:
        message['cc'] = ', '.join(cc_emails)
    
    # Attach body
    message.attach(MIMEText(body, 'plain'))
    
    # Attach files
    if attachments:
        for filename, content, mime_type in attachments:
            maintype, subtype = mime_type.split('/', 1)
            part = MIMEBase(maintype, subtype)
            part.set_payload(content)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', 'attachment', filename=filename)
            message.attach(part)
    
    # Encode message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    
    # Send
    result = service.users().messages().send(
        userId='me',
        body={'raw': raw_message}
    ).execute()
    
    return result
