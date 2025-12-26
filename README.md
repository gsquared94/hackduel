# HackDuel

An intelligent pairwise voting application designed to rank hackathon projects using the TrueSkill algorithm. This application was built to judge large-scale AI Hackathons.

## Overview

**HackDuel** presents judges with pairs of projects to compare based on criteria like Impact, Technical Complexity, Creativity, and Presentation. Unlike traditional 1-10 scoring, pairwise comparison reduces bias and cognitive load. The backend uses the **TrueSkill** ranking system (similar to Xbox Live's matchmaking) to converge on an accurate global leaderboard efficiently.

### Key Features
- **Pairwise Voting**: Simple "Left vs Right" interface.
- **TrueSkill Ranking**: Real-time updates to project ratings ($\mu$) and uncertainty ($\sigma$).
- **Active Learning**: Intelligently selects the next pair to maximize information gain (pairing projects with similar rank).
- **Dual Persistence**: High-performance in-memory caching with asynchronous Firestore persistence.
- **Cloud Ready**: Designed for deployment on Google Cloud Run.

## Architecture

- **Frontend**: React, TypeScript, TailwindCSS.
- **Backend**: FastAPI (Python), TrueSkill library, Pandas.
- **Database**: Google Cloud Firestore (Native Mode).
- **Infrastructure**: Python scripts and Shell scripts for automated provisioning.

## Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- Google Cloud SDK (`gcloud` CLI)

### 1. Data Preparation
Ensure your project data is provided in CSV format. This project's dataset schema is based on the CSV export of [Kaggle's Gemini 3 Writeups](https://www.kaggle.com/competitions/gemini-3/writeups).

The app specifically expects columns like `Id`, `Project_Title`, `Video_Links`, `Tracks`, `Project_Description`, `Team_Name`, and `WriteUpUrl`.

### 2. Infrastructure Setup
Run the setup script to provision the Firestore database and seed it with data.
```bash
# Make sure you are in the judging-app directory
cd judging-app

# Run setup (prompts for GCP Project ID and Region)
./infra/setup.sh --data-file ../data/full_dataset.csv
```
This script will:
- Enable the Firestore API on your GCP project.
- Create the Firestore database (if missing).
- Set up Application Default Credentials.
- Seed the database using the provided CSV.

### 3. Running Locally
Use the helper script to run both backend and frontend. You must provide the path to your dataset via the `DATASET_PATH` environment variable.
```bash
# Example for local development
export DATASET_PATH="/Users/yourname/data/full_dataset.csv"
./start_dev.sh
```
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Environment Variables**:
    - `USE_FIRESTORE`: Set to `true` to use Firestore (default: `false` for local dev).
    - `DATASET_PATH`: Absolute path to a CSV file to seed the In-Memory repository on startup (required if not using Firestore).

### 4. Running Verification Simulations
To verify the ranking algorithm integrity:
```bash
cd backend
python -m pytest test_simulation.py
```

### 5. Containerization
To build the Docker image for Cloud Run (or local testing):
```bash
# Build the image
docker build -t hackduel .

# Run the container locally (with Firestore enabled)
# Assumes GOOGLE_APPLICATION_CREDENTIALS points to your JSON key
docker run \
  -p 8080:8080 \
  -e PORT=8080 \
  -e USE_FIRESTORE=true \
  -e GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-your-project-id}" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-credentials.json \
  -v "${GOOGLE_APPLICATION_CREDENTIALS}:/app/gcp-credentials.json" \
  hackduel
```

## Directory Structure
```
judging-app/
├── backend/            # FastAPI application
├── frontend/           # React application
├── infra/              # Setup and seeding scripts
├── start_dev.sh        # Local development startup script
├── Dockerfile          # Container definition
└── README.md           # This file
```

## Acknowledgements

This project is inspired by the article [Designing a better judging system](https://anishathalye.com/designing-a-better-judging-system/) by Anish Athalye, and is entirely vibe-coded with Antigravity.
