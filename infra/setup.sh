#!/bin/bash

# Exit on error
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "==================================================="
echo "   HackDuel - Firestore Setup Script"
echo "==================================================="


# Default values
DATA_FILE=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --data-file) DATA_FILE="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Try to find data file if not provided
if [ -z "$DATA_FILE" ]; then
    echo "Error: Base dataset file path must be provided via --data-file argument."
    echo "Usage: ./infra/setup.sh --data-file <path_to_csv>"
    exit 1
fi

echo "Using data file: $DATA_FILE"

# Check for gcloud
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install the Google Cloud SDK."
    exit 1
fi

# Prompt for Project ID
echo ""
echo "Please enter your existing Google Cloud Project ID."
read -p "Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project ID cannot be empty."
    exit 1
fi

# Prompt for Region
echo ""
read -p "Region (default: us-central1): " LOCATION
LOCATION=${LOCATION:-us-central1}

echo ""
echo "Setting up infrastructure for project: $PROJECT_ID in $LOCATION"
echo "---------------------------------------------------"

# Set Project
gcloud config set project "$PROJECT_ID"

# Enable APIs
echo "Enabling Firestore API..."
gcloud services enable firestore.googleapis.com

# Create Database (Native Mode)
echo "Creating Firestore Database (if not exists)..."
# We check if the default database exists first to avoid error spam
if gcloud firestore databases list --project="$PROJECT_ID" --format="value(name)" | grep -q "projects/$PROJECT_ID/databases/(default)"; then
    echo "Verified: Default Firestore database exists."
else
    echo "Creating default Firestore database..."
    gcloud firestore databases create --location="$LOCATION" --type=firestore-native
fi

# Set up ADC for the local seeder script
echo ""
echo "Setting up Application Default Credentials for local python script..."
gcloud auth application-default login

# Install dependencies and run seed
echo ""
echo "Preparing to seed database..."
cd "$PROJECT_ROOT"

# Check for venv in backend/ (where start_dev.sh puts it)
VENV_PATH="backend/venv"

if [ ! -d "$VENV_PATH" ]; then
    echo "Virtual environment not found. Creating one in $VENV_PATH..."
    python3 -m venv "$VENV_PATH"
fi

# Install dependencies and run seed using the venv executables directly
echo "Installing/Updating backend dependencies..."
./$VENV_PATH/bin/pip install -r backend/requirements.txt

echo "Running Python seed script..."
./$VENV_PATH/bin/python3 infra/seed_firestore.py --dataset-path "$DATA_FILE"

echo ""
echo "==================================================="
echo "   Setup Complete! Firestore is ready."
echo "==================================================="
