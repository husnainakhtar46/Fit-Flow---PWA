import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.getenv("DEBUG", "1") == "1"

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

# In production, SECRET_KEY is mandatory. In dev, we can use a fallback.
# STARTUP DEBUG
print(f"DEBUG: Loading settings. DJANGO_SECRET_KEY present? {bool(os.getenv('DJANGO_SECRET_KEY'))}")
print(f"DEBUG: Parsing ALLOWED_HOSTS: {os.getenv('ALLOWED_HOSTS')}")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

if not SECRET_KEY:
    print("WARNING: DJANGO_SECRET_KEY not found. Using ephemeral fallback key.")
    SECRET_KEY = "django-insecure-fallback-key-for-debugging-deployment"


ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
# Cloud Run / App Engine automatically sets K_SERVICE
if os.getenv("K_SERVICE"):
    ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    # default apps...
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # third party
    "rest_framework",
    "corsheaders",
    "django_filters",

    # local
    "qc.apps.QcConfig",
]

ROOT_URLCONF = "quality_check.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "quality_check.wsgi.application"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Serve static files in production
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
CSRF_TRUSTED_ORIGINS = os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:3000").split(",")


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
import dj_database_url
from urllib.parse import quote_plus

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL and os.getenv("DB_HOST"):
    # Construct from individual vars (Cloud Run / Vercel style)
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "postgres")
    
    # Safely encode credentials to handle special chars like '@'
    safe_user = quote_plus(db_user)
    safe_password = quote_plus(db_password)
    
    DATABASE_URL = f"postgres://{safe_user}:{safe_password}@{db_host}:{db_port}/{db_name}"

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600
    )
}

# Static & Media
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Email (dev; put real creds in env)
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_PASSWORD", "")

# File storage - use S3 in prod if you want (configure django-storages)
