
import sys
import os
import pandas as pd
import logging

# Add backend directory to path to allow importing backend modules
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.append(backend_dir)

from db_abstraction import FirestoreRepository
from models import Project

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_firestore")

def seed_data(csv_path: str):
    if not os.path.exists(csv_path):
        logger.error(f"File not found: {csv_path}")
        sys.exit(1)

    logger.info(f"Reading data from {csv_path}...")
    df = pd.read_csv(csv_path)

    # Fill NaN values with empty strings for string fields
    str_cols = ['Project_Subtitle', 'Project_Description', 'Team_Name', 
                'WriteUpUrl', 'Video_Links', 'Project_Links', 'Tracks']
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].fillna('')
    
    # Ensure ID is string
    df['Id'] = df['Id'].astype(str)

    projects = []
    logger.info("Converting rows to Project objects...")
    
    for _, row in df.iterrows():
        try:
            # Map CSV columns to Project fields
            project = Project(
                id=str(row['Id']),
                title=row['Project_Title'],
                category=row['Tracks'],
                subtitle=row['Project_Subtitle'],
                description=row['Project_Description'],
                team_name=row['Team_Name'],
                writeup_url=row['WriteUpUrl'],
                video_url=row['Video_Links'],
                project_links=row['Project_Links'],
                mu=25.0,
                sigma=8.333
            )
            projects.append(project)
        except Exception as e:
            logger.warning(f"Skipping row {row.get('Id', 'unknown')}: {e}")

    logger.info(f"Prepared {len(projects)} projects for insertion.")

    repo = FirestoreRepository()
    
    logger.info("Starting bulk upload to Firestore...")
    repo.bulk_create(projects)
    logger.info("Bulk upload complete.")

import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Firestore with project data.")
    parser.add_argument("--dataset-path", required=True, help="Path to the full_dataset.csv file")
    
    args = parser.parse_args()
    csv_path = os.path.abspath(args.dataset_path)
    
    seed_data(csv_path)
