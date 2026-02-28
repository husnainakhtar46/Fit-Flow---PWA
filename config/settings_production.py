from quality_check.settings import *
import os
import mimetypes
from django.core.exceptions import ImproperlyConfigured

# Ensure .webp is recognized (some Docker images don't have it)
mimetypes.add_type('image/webp', '.webp')


def get_required_env(var_name):
    """
    Get a required environment variable or raise an error.
    
    In production, the app should fail fast if critical config is missing,
    rather than silently using insecure defaults.
    """
    value = os.environ.get(var_name)
    if not value:
        raise ImproperlyConfigured(
            f"Required environment variable '{var_name}' is not set. "
            f"Set this variable before starting the production server."
        )
    return value


# SECURITY WARNING: keep the secret key used in production secret!
# App will crash on startup if not set - this is intentional for security
SECRET_KEY = get_required_env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = [
    '.run.app',  # Google Cloud Run
    'localhost',
    '127.0.0.1',
]

# Database - Aiven PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': get_required_env('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', 5432),
        'NAME': get_required_env('DB_NAME'),
        'USER': get_required_env('DB_USER'),
        'PASSWORD': get_required_env('DB_PASSWORD'),
        'OPTIONS': {
            'sslmode': 'require',
        }
    }
}


# Static files with WhiteNoise
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files - Google Cloud Storage
GS_BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME', 'fitflow-media')
GS_PROJECT_ID = os.environ.get('GCP_PROJECT_ID')
GS_QUERYSTRING_AUTH = False             # Use direct URLs (bucket IAM grants public read)

# Django 5.x storage configuration (replaces deprecated DEFAULT_FILE_STORAGE / STATICFILES_STORAGE)
# GCS options are read from top-level GS_* settings above
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# CORS for frontend
# CORS for frontend
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
if not CORS_ALLOWED_ORIGINS[0]:  # Handle empty string resulting in ['']
    CORS_ALLOWED_ORIGINS = []


# CSRF
CSRF_TRUSTED_ORIGINS = [
    'https://*.run.app',
    'https://fitflow-backend-226935084519.us-central1.run.app',
]
csrf_env = os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
if csrf_env[0]:
    CSRF_TRUSTED_ORIGINS.extend(csrf_env)


# Security
# Cloud Run terminates SSL at its load balancer and forwards HTTP to Django.
# This header tells Django to trust the proxy's X-Forwarded-Proto header,
# so Django knows the original request was HTTPS (fixes CSRF origin mismatch).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
