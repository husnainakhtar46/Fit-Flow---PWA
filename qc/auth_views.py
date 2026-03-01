from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from qc.models import OTPVerification
from qc.otp_utils import generate_and_send_otp
from django.utils import timezone

User = get_user_model()

class RequestOTPView(APIView):
    """
    Endpoint for requesting a password reset OTP.
    Accessible by anyone (unauthenticated).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Look up the user by email
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Rejection message explicitly indicating the email doesn't exist, as per plan
            return Response({'error': 'No account found with this email address.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Generate OTP and send email via Gmail API
        success, message = generate_and_send_otp(user)
        
        if success:
            return Response({'message': message}, status=status.HTTP_200_OK)
        else:
            return Response({'error': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ResetPasswordView(APIView):
    """
    Endpoint for validating the OTP and setting a new password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        otp_code = request.data.get('otpCode', '').strip()
        new_password = request.data.get('newPassword', '')

        if not all([email, otp_code, new_password]):
            return Response(
                {'error': 'Email, OTP, and new password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid request.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Verify the OTP
        try:
            otp_record = OTPVerification.objects.get(
                user=user, 
                otp_code=otp_code, 
                is_used=False
            )
        except OTPVerification.DoesNotExist:
            return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not otp_record.is_valid():
            return Response({'error': 'This OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update user's password
        user.set_password(new_password)
        user.save()
        
        # Mark OTP as used
        otp_record.is_used = True
        otp_record.save()
        
        return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)
