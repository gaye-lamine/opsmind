#!/bin/bash

# OpsMind — Automated Production Deployment Script (Phase 5)
# Target Project: yonipacks-dev-6bd18
# Target Platform: Google Cloud Run & Secret Manager

set -e

# Curated HSL Glowing console styles
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}================================================================${NC}"
echo -e "${CYAN}🚀 OpsMind — Production deployment to Google Cloud Run${NC}"
echo -e "${PURPLE}================================================================${NC}"

PROJECT_ID="yonipacks-dev-6bd18"
LOCATION="us-central1"
APP_NAME="opsmind"

# 1. Verify gcloud configuration
echo -e "\n${BLUE}[1/7] Configuring Google Cloud Project...${NC}"
gcloud config set project $PROJECT_ID
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")

if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo -e "${RED}⚠️ No active Google Cloud account found. Starting auth login...${NC}"
  gcloud auth login
else
  echo -e "${GREEN}✓ Authenticated as: $ACTIVE_ACCOUNT${NC}"
fi

# 2. Read variables from local .env
echo -e "\n${BLUE}[2/7] Parsing local .env for partner secrets...${NC}"
if [ ! -f .env ]; then
  echo -e "${RED}❌ Error: .env file not found. Copy .env.example to .env and fill in variables first.${NC}"
  exit 1
fi

# Helper to read env variables securely
get_env_var() {
  local var_name=$1
  local value=$(grep -E "^${var_name}=" .env | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  echo "$value"
}

MONGODB_URI=$(get_env_var "MONGODB_URI")
GITLAB_TOKEN=$(get_env_var "GITLAB_TOKEN")
VOYAGE_API_KEY=$(get_env_var "VOYAGE_API_KEY")
ATLAS_MCP_CLIENT_ID=$(get_env_var "ATLAS_MCP_CLIENT_ID")
ATLAS_MCP_CLIENT_SECRET=$(get_env_var "ATLAS_MCP_CLIENT_SECRET")

if [ -z "$MONGODB_URI" ]; then
  echo -e "${RED}❌ Error: MONGODB_URI is required in .env${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Local secrets parsed successfully${NC}"

# 3. Enable GCP Services
echo -e "\n${BLUE}[3/7] Enabling necessary GCP Services (Run, Artifact Registry, Secret Manager, Vertex AI)...${NC}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com

echo -e "${GREEN}✓ GCP Services active${NC}"

# 4. Upload secrets to Secret Manager
echo -e "\n${BLUE}[4/7] Uploading secrets to Google Cloud Secret Manager...${NC}"

upload_secret() {
  local name=$1
  local value=$2
  
  if [ -z "$value" ]; then
    echo -e "${CYAN}ℹ Skipping empty secret $name${NC}"
    return
  fi

  # Create secret container if it doesn't exist
  if ! gcloud secrets describe "$name" &>/dev/null; then
    gcloud secrets create "$name" --replication-policy="automatic" >/dev/null
    echo -e "Created secret container: $name"
  fi
  
  # Add value version
  echo -n "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  echo -e "${GREEN}✓ Secret $name updated in Secret Manager${NC}"
}

upload_secret "MONGODB_URI" "$MONGODB_URI"
upload_secret "GITLAB_TOKEN" "$GITLAB_TOKEN"
upload_secret "VOYAGE_API_KEY" "$VOYAGE_API_KEY"
upload_secret "ATLAS_MCP_CLIENT_ID" "$ATLAS_MCP_CLIENT_ID"
upload_secret "ATLAS_MCP_CLIENT_SECRET" "$ATLAS_MCP_CLIENT_SECRET"

# 4.5. Grant Secret Manager + Vertex AI Access to the default Cloud Run Service Account
echo -e "\n${BLUE}[4.5/7] Granting Secret Manager & Vertex AI Access to Cloud Run Service Account...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --quiet
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user" --quiet
echo -e "${GREEN}✓ Secret Manager & Vertex AI access granted${NC}"

# 5. Create Artifact Registry
echo -e "\n${BLUE}[5/7] Preparing Artifact Registry Repository...${NC}"
REPO_NAME="opsmind-docker"
if ! gcloud artifacts repositories describe $REPO_NAME --location=$LOCATION &>/dev/null; then
  gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$LOCATION \
    --description="OpsMind Production Docker Images" >/dev/null
  echo -e "Created Docker Artifact Registry repository: $REPO_NAME"
else
  echo -e "${GREEN}✓ Artifact Registry repository $REPO_NAME already exists${NC}"
fi

# Configure docker to authenticate with Artifact Registry
gcloud auth configure-docker ${LOCATION}-docker.pkg.dev --quiet

# 6. Build and Deploy API Backend
echo -e "\n${BLUE}[6/7] Building and deploying API Backend...${NC}"
API_IMAGE="${LOCATION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${APP_NAME}-api:latest"

echo "Building local API Docker image..."
docker build --platform linux/amd64 -t $API_IMAGE -f apps/api/Dockerfile .

echo "Pushing API image to Artifact Registry..."
docker push $API_IMAGE

echo "Deploying API service to Cloud Run..."
gcloud run deploy "${APP_NAME}-api" \
  --image=$API_IMAGE \
  --region=$LOCATION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="USE_VERTEX_AI=true,GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${LOCATION},NODE_ENV=production,CORS_ORIGINS=*" \
  --update-secrets="MONGODB_URI=MONGODB_URI:latest,GITLAB_TOKEN=GITLAB_TOKEN:latest,VOYAGE_API_KEY=VOYAGE_API_KEY:latest,ATLAS_MCP_CLIENT_ID=ATLAS_MCP_CLIENT_ID:latest,ATLAS_MCP_CLIENT_SECRET=ATLAS_MCP_CLIENT_SECRET:latest"

API_URL=$(gcloud run services describe "${APP_NAME}-api" --region=$LOCATION --format="value(status.url)")
echo -e "${GREEN}✓ API Backend successfully deployed at: $API_URL${NC}"

# 7. Build and Deploy Web Frontend
echo -e "\n${BLUE}[7/7] Building and deploying Next.js Frontend Dashboard...${NC}"
WEB_IMAGE="${LOCATION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${APP_NAME}-web:latest"

echo "Building local Web Docker image (with static injection of API URL: $API_URL/api)..."
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL="$API_URL/api" \
  -t $WEB_IMAGE \
  -f apps/web/Dockerfile .

echo "Pushing Web image to Artifact Registry..."
docker push $WEB_IMAGE

echo "Deploying Web service to Cloud Run..."
gcloud run deploy "${APP_NAME}-web" \
  --image=$WEB_IMAGE \
  --region=$LOCATION \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000

WEB_URL=$(gcloud run services describe "${APP_NAME}-web" --region=$LOCATION --format="value(status.url)")

echo -e "\n${PURPLE}================================================================${NC}"
echo -e "${GREEN}🎉 CONGRATULATIONS! OPSMIND DEPLOYMENT COMPLETED!${NC}"
echo -e "${PURPLE}================================================================${NC}"
echo -e "🖥️  ${CYAN}API Backend URL:${NC}  $API_URL"
echo -e "🌐  ${CYAN}Web Console URL:${NC}  $WEB_URL"
echo -e "${PURPLE}================================================================${NC}"
