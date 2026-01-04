# HackDuel

An intelligent pairwise voting application designed to rank hackathon projects using the TrueSkill algorithm. This application was built to judge large-scale AI Hackathons.

## Overview

**HackDuel** presents judges with pairs of projects to compare based on criteria like Impact, Technical Complexity, Creativity, and Presentation. Unlike traditional 1-10 scoring, pairwise comparison reduces bias and cognitive load. The backend uses the **TrueSkill** ranking system (similar to Xbox Live's matchmaking) to converge on an accurate global leaderboard efficiently.

### Key Features
- **Pairwise Voting**: Simple "Left vs Right" interface.
- **TrueSkill Ranking**: Real-time updates to project ratings ($\mu$) and uncertainty ($\sigma$).
- **Active Learning**: Intelligently selects the next pair to maximize information gain (pairing projects with similar rank).
- **Smart Pairing Diversity**: Heavily penalizes repeated pairings and strictly prevents judges from seeing the same pair twice to maximize broad coverage.
- **Dual Persistence**: High-performance in-memory caching with asynchronous Firestore persistence.
- **Cloud Ready**: Designed for deployment on Google Cloud Run with IAP authentication integration.

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
- Docker

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
python -m pytest tests/test_simulation.py
```

Additional simulations and utility scripts can be found in `tests/`:
- `tests/simulate_convergence.py`: Runs a fast simulation of the pairing/ranking loop.

### 5. Cloud Deployment
To deploy to Google Cloud Run:
```bash
# Deploys using Cloud Build + Cloud Run
./infra/deploy.sh
```
This script handles building the Docker image, pushing to Artifact Registry, and deploying to Cloud Run with Firestore integration enabled. It enforces `no-allow-unauthenticated`, so you should set up IAP or an HTTP Load Balancer in front of it.

## Directory Structure
```
judging-app/
├── backend/            # FastAPI application
├── frontend/           # React application
├── infra/              # Setup, seeding, and deployment scripts
├── tests/              # Validations and simulations
├── start_dev.sh        # Local development startup script
├── Dockerfile          # Container definition
└── README.md           # This file
```

## Acknowledgements

This project is inspired by the article [Designing a better judging system](https://anishathalye.com/designing-a-better-judging-system/) by Anish Athalye, and is entirely vibe-coded with Antigravity.
