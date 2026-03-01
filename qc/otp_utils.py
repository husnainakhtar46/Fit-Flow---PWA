import secrets
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from qc.models import OTPVerification
from qc.gmail_service import send_gmail_message

User = get_user_model()

def generate_and_send_otp(user):
    """
    Generate a 6-digit OTP, save it to the database with a 15-minute expiration,
    and send it to the user's email via the Gmail API.
    """
    # Generate a cryptographically secure 6-digit string
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Expiration set to 15 minutes as per requirements
    expires_at = timezone.now() + timedelta(minutes=15)
    
    # Invalidate any previously active OTPs for this user to ensure only the latest works
    OTPVerification.objects.filter(user=user, is_used=False).update(is_used=True)
    
    # Create new OTP record
    OTPVerification.objects.create(
        user=user,
        otp_code=otp_code,
        expires_at=expires_at
    )
    
    # Format and send the email
    subject = "Fit Flow - Password Reset Code"
    body = f"""Hello,

You recently requested to reset your password for your Fit Flow account.
Your 6-digit verification code is: {otp_code}

This code will expire in 15 minutes.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Thanks,
Fit Flow Team
"""
    try:
        send_gmail_message(
            to_emails=[user.email],
            subject=subject,
            body=body
        )
        return True, "OTP sent successfully"
    except Exception as e:
        print(f"Error sending OTP email to {user.email}: {e}")
        return False, "Failed to send email. Please try again later."
