#!/bin/bash
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
APP_NAME="hackduel"
REPO_NAME="hackduel-repo"
IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$APP_NAME"

echo "🚀 Deploying [$APP_NAME] to Project [$PROJECT_ID] in [$REGION]..."

# 1. Enable Services
echo "🔌 Enabling required services..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 2. Create Artifact Registry if not exists
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION &>/dev/null; then
    echo "📦 Creating Artifact Registry repository [$REPO_NAME]..."
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker repository for HackDuel"
else
    echo "✅ Repository [$REPO_NAME] exists."
fi

# 3. Configure Docker Auth
echo "🔑 Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# Check for --skip-build argument
SKIP_BUILD=false
if [[ "$1" == "--skip-build" ]]; then
    SKIP_BUILD=true
    echo "⏩ Skipping build step as requested..."
fi

if [ "$SKIP_BUILD" = false ]; then
    # 4. Build and Push (using local Docker)
    echo "🏗️ Building Docker image (AMD64)..."
    # Force AMD64 for Cloud Run compatibility
    docker build --platform linux/amd64 -t $IMAGE_URI .

    echo "Pushing image to registry..."
    docker push $IMAGE_URI
fi

# 5. Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy $APP_NAME \
    --image $IMAGE_URI \
    --region $REGION \
    --platform managed \
    --no-allow-unauthenticated \
    --set-env-vars "USE_FIRESTORE=true" \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --port 8080

echo "🎉 Deployment Complete!"
gcloud run services describe $APP_NAME --region $REGION --format 'value(status.url)'
