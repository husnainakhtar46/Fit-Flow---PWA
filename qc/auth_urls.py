from django.urls import path
from qc.auth_views import RequestOTPView, ResetPasswordView

app_name = 'auth'

urlpatterns = [
    path('request-otp/', RequestOTPView.as_view(), name='request_otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),
]
