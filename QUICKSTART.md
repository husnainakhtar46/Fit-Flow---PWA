# 🚀 Quick Start - Deploy Fit Flow to Google Cloud

## Files Created for You:

✅ **DEPLOYMENT_GUIDE.md** - Complete step-by-step deployment guide
✅ **Dockerfile** - Container configuration for backend
✅ **.dockerignore** - Files to exclude from Docker image
✅ **config/settings_production.py** - Production Django settings
✅ **cors.json** - CORS configuration for Cloud Storage
✅ **frontend/.env.production** - Frontend environment variables template
✅ **requirements.txt** - Updated with production dependencies
✅ **deploy.sh** - Automated deployment script (optional)

---

## Prerequisites - Sign Up First:

### 1. **Google Cloud Platform**
- Visit: https://console.cloud.google.com
- Sign up with Gmail
- **Free**: $300 credit for 90 days
- Add credit card (won't charge without permission)

### 2. **Aiven Database**
- Visit: https://aiven.io/signup
- Sign up and verify email
- **Free**: $300 credit for new users
- Choose PostgreSQL Hobbyist plan

### 3. **Install Tools**
```bash
# Download and install:
# 1. Google Cloud SDK: https://cloud.google.com/sdk/docs/install
# 2. Docker Desktop: https://www.docker.com/products/docker-desktop
```

---

## Simple 3-Step Deployment:

### Step 1: Set Up Aiven Database (5 minutes)
1. Log in to Aiven
2. Click "Create Service" → PostgreSQL
3. Choose:
   - Cloud: **Google Cloud Platform**
   - Region: **us-central1** (Iowa)
   - Plan: **Hobbyist** (uses free credits)
4. Name: `fitflow-db`
5. Wait ~5 minutes for database to start
6. Copy connection details from "Overview" tab

### Step 2: Deploy Backend to Cloud Run (10 minutes)
```bash
# Open terminal and navigate to project
cd c:\Users\husna\Music\Dapp\quality_check_project

# Login to Google Cloud
gcloud auth login

# Create project (or use existing)
gcloud projects create fitflow-production
gcloud config set project fitflow-production

# Build and deploy (replace values with your Aiven credentials)
gcloud builds submit --tag gcr.io/fitflow-production/fitflow-backend

gcloud run deploy fitflow-backend \
  --image gcr.io/fitflow-production/fitflow-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" \
  --set-env-vars "SECRET_KEY=change-this-to-random-string" \
  --set-env-vars "DB_HOST=your-aiven-host.aivencloud.com" \
  --set-env-vars "DB_PORT=12345" \
  --set-env-vars "DB_NAME=fitflow_production" \
  --set-env-vars "DB_USER=avnadmin" \
  --set-env-vars "DB_PASSWORD=your-aiven-password"

# Save the backend URL shown after deployment
```

### Step 3: Deploy Frontend (5 minutes)
```bash
cd frontend

# Update .env.production with your backend URL
echo "VITE_API_URL=https://fitflow-backend-xyz.run.app" > .env.production

# Build
npm run build

# Create bucket and deploy
gsutil mb gs://fitflow-frontend
gsutil iam ch allUsers:objectViewer gs://fitflow-frontend
gsutil -m rsync -r dist/ gs://fitflow-frontend/

# Your frontend is live at:
# https://storage.googleapis.com/fitflow-frontend/index.html
```

---

## After Deployment:

### Run Database Migrations
```bash
# Create one-time migration job
gcloud run jobs create migrate \
  --image gcr.io/fitflow-production/fitflow-backend \
  --region us-central1 \
  --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" \
  --set-env-vars "DB_HOST=..." \
  --set-env-vars "DB_PASSWORD=..." \
  --command python \
  --args manage.py,migrate

# Run it
gcloud run jobs execute migrate --region us-central1
```

### Create Admin User
```bash
gcloud run jobs create createsuperuser \
  --image gcr.io/fitflow-production/fitflow-backend \
  --region us-central1 \
  --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" \
  --command python \
  --args manage.py,createsuperuser,--noinput,--username=admin,--email=admin@fitflow.com
```

---

## 📚 Need More Help?

- **Complete Guide**: See `DEPLOYMENT_GUIDE.md`
- **Automated Script**: Run `deploy.sh` (for Linux/Mac)
- **Troubleshooting**: Check logs with `gcloud run services logs read fitflow-backend`

---

## 💰 Estimated Costs:

**First 3 months**: **FREE** (using free credits)
**After credits**: **$15-30/month** for small usage

---

## ✅ Your Application URLs:

After deployment, you'll have:
- **Backend API**: `https://fitflow-backend-[random].run.app`
- **Frontend**: `https://storage.googleapis.com/fitflow-frontend/index.html`
- **Database**: Managed by Aiven (automatic backups)

---

## 🎉 You're Ready!

All configuration files are created. Follow the steps above to deploy your Fit Flow application to the cloud!

**Questions?** Check the detailed DEPLOYMENT_GUIDE.md file.
