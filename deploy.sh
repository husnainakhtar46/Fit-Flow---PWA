#!/bin/bash

# Fit Flow - Quick Deployment Script for Google Cloud Run + Aiven
# This script helps automate the deployment process

echo "🚀 Fit Flow Deployment Script"
echo "================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK not installed!"
    echo "Please install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Get project configuration
echo "📝 Please enter your configuration details:"
echo ""

read -p "Google Cloud Project ID: " PROJECT_ID
read -p "Aiven Database Host: " DB_HOST
read -p "Aiven Database Port [default: 5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Aiven Database Name: " DB_NAME
read -p "Aiven Database User: " DB_USER
read -sp "Aiven Database Password: " DB_PASSWORD
echo ""
read -p "Django Secret Key (press Enter to generate): " SECRET_KEY

# Generate secret key if not provided
if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
    echo "✓ Generated secret key"
fi

# Email Configuration
echo ""
echo "📧 Email Configuration (for sending reports):"
read -p "Email Host [default: smtp.gmail.com]: " EMAIL_HOST
EMAIL_HOST=${EMAIL_HOST:-smtp.gmail.com}
read -p "Email Port [default: 587]: " EMAIL_PORT
EMAIL_PORT=${EMAIL_PORT:-587}
read -p "Email User (e.g., your@gmail.com): " EMAIL_USER
read -sp "Email Password (App Password if Gmail): " EMAIL_PASSWORD
echo ""

echo ""
echo "================================"
echo "📋 Configuration Summary:"
echo "Project ID: $PROJECT_ID"
echo "Database Host: $DB_HOST"
echo "Database Port: $DB_PORT"
echo "Database Name: $DB_NAME"
echo "Database User: $DB_USER"
echo "================================"
echo ""

read -p "Proceed with deployment? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Set project
echo "🔧 Setting project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    storage-api.googleapis.com \
    storage-component.googleapis.com \
    secretmanager.googleapis.com

# Store secrets in Secret Manager
echo "🔐 Storing secrets..."
echo -n "$SECRET_KEY" | gcloud secrets create django-secret --data-file=- 2>/dev/null || \
    echo -n "$SECRET_KEY" | gcloud secrets versions add django-secret --data-file=-

echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=- 2>/dev/null || \
    echo -n "$DB_PASSWORD" | gcloud secrets versions add db-password --data-file=-

echo -n "$EMAIL_PASSWORD" | gcloud secrets create email-password --data-file=- 2>/dev/null || \
    echo -n "$EMAIL_PASSWORD" | gcloud secrets versions add email-password --data-file=-

# Build and push Docker image
echo "🐳 Building Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/fitflow-backend

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy fitflow-backend \
    --image gcr.io/$PROJECT_ID/fitflow-backend \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" \
    --set-env-vars "DB_HOST=$DB_HOST" \
    --set-env-vars "DB_PORT=$DB_PORT" \
    --set-env-vars "DB_NAME=$DB_NAME" \
    --set-env-vars "DB_USER=$DB_USER" \
    --set-env-vars "GCS_BUCKET_NAME=fitflow-media-$PROJECT_ID" \
    --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
    --set-env-vars "EMAIL_HOST=$EMAIL_HOST" \
    --set-env-vars "EMAIL_PORT=$EMAIL_PORT" \
    --set-env-vars "EMAIL_USER=$EMAIL_USER" \
    --set-secrets "SECRET_KEY=django-secret:latest" \
    --set-secrets "DB_PASSWORD=db-password:latest" \
    --set-secrets "EMAIL_PASSWORD=email-password:latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe fitflow-backend --region us-central1 --format 'value(status.url)')

echo ""
echo "✅ Backend deployed successfully!"
echo "🌐 Backend URL: $SERVICE_URL"
echo ""

# Create media bucket
echo "📦 Creating media storage bucket..."
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://fitflow-media-$PROJECT_ID/ 2>/dev/null || echo "Bucket already exists"
gsutil cors set cors.json gs://fitflow-media-$PROJECT_ID/

# Create frontend bucket
echo "📦 Creating frontend storage bucket..."
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://fitflow-frontend-$PROJECT_ID/ 2>/dev/null || echo "Bucket already exists"
gsutil iam ch allUsers:objectViewer gs://fitflow-frontend-$PROJECT_ID
gsutil web set -m index.html -e index.html gs://fitflow-frontend-$PROJECT_ID

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "================================"
echo "📋 Next Steps:"
echo "================================"
echo ""
echo "1. Run database migrations:"
echo "   gcloud run jobs create migrate-db \\"
echo "     --image gcr.io/$PROJECT_ID/fitflow-backend \\"
echo "     --region us-central1 \\"
echo "     --set-env-vars 'DJANGO_SETTINGS_MODULE=config.settings_production' \\"
echo "     --set-env-vars 'DB_HOST=$DB_HOST' \\"
echo "     --set-env-vars 'DB_PORT=$DB_PORT' \\"
echo "     --set-env-vars 'DB_NAME=$DB_NAME' \\"
echo "     --set-env-vars 'DB_USER=$DB_USER' \\"
echo "     --set-secrets 'DB_PASSWORD=db-password:latest' \\"
echo "     --command python \\"
echo "     --args manage.py,migrate"
echo ""
echo "   gcloud run jobs execute migrate-db --region us-central1"
echo ""
echo "2. Deploy frontend:"
echo "   cd frontend"
echo "   echo 'VITE_API_URL=$SERVICE_URL' > .env.production"
echo "   npm run build"
echo "   gsutil -m rsync -r -d dist/ gs://fitflow-frontend-$PROJECT_ID/"
echo ""
echo "3. Access your application:"
echo "   Backend API: $SERVICE_URL"
echo "   Frontend: https://storage.googleapis.com/fitflow-frontend-$PROJECT_ID/index.html"
echo ""
echo "================================"
