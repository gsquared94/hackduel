from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import pandas as pd
import trueskill
import random
import logging
import os
import time
import asyncio
import concurrent.futures

try:
    from .models import Project, VoteRequest, PairResponse, JudgeInteraction
    from .db_abstraction import InMemoryRepository, FirestoreRepository
except ImportError:
    from models import Project, VoteRequest, PairResponse, JudgeInteraction
    from db_abstraction import InMemoryRepository, FirestoreRepository

# --- Configuration ---
app = FastAPI(title="HackDuel")

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon/dev convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("uvicorn")

# Serve Frontend Static Files
static_dir = os.path.join(os.path.dirname(__file__), "static")

# --- State ---
# Decide repository based on Env
if os.getenv("USE_FIRESTORE") == "true":
    logger.info("Using Firestore Repository")
    repo = FirestoreRepository()
else:
    logger.info("Using In-Memory Repository")
    repo = InMemoryRepository()

env = trueskill.TrueSkill()

# --- Async Vote Processing ---
vote_queue = asyncio.Queue()

async def process_votes():
    """Background task to process votes sequentially."""
    logger.info("Vote processor started.")
    while True:
        vote = await vote_queue.get()
        try:
            # Define the update logic (Pure Function)
            def calculate_ratings(winner: Project, loser: Project):
                 # 0. Race Condition Check inside transaction
                if not winner.active or not loser.active:
                    logger.warning(f"Vote discarded in transaction: Project(s) disqualified (W: {winner.active}, L: {loser.active})")
                    return winner, loser

                # 2. Calculate new ratings
                w_rating = env.create_rating(mu=winner.mu, sigma=winner.sigma)
                l_rating = env.create_rating(mu=loser.mu, sigma=loser.sigma)
                new_ratings = env.rate([[w_rating], [l_rating]], ranks=[0, 1])
                new_w, new_l = new_ratings[0], new_ratings[1]

                # 3. Update Objects
                winner.mu = new_w[0].mu
                winner.sigma = new_w[0].sigma
                winner.matches_played += 1
                
                loser.mu = new_l[0].mu
                loser.sigma = new_l[0].sigma
                loser.matches_played += 1
                
                # 4. Record Judge Interaction
                if vote.judge_email:
                    ts = time.time()
                    winner.judged_by.append(JudgeInteraction(
                        judge_email=vote.judge_email,
                        decision='win',
                        opponent_id=loser.id,
                        timestamp=ts
                    ))
                    loser.judged_by.append(JudgeInteraction(
                        judge_email=vote.judge_email,
                        decision='loss',
                        opponent_id=winner.id,
                        timestamp=ts
                    ))
                
                return winner, loser

            # 1. Execute Atomic Update
            await run_in_threadpool(repo.atomic_vote_update, vote.winner_id, vote.loser_id, calculate_ratings)

        except Exception as e:
            logger.error(f"Error processing vote: {e}")
        finally:
            vote_queue.task_done()

# --- Helpers ---

def bootstrap_from_file(csv_path: str):
    """Bootstraps the repository from a CSV file."""
    if not os.path.exists(csv_path):
        logger.warning(f"Dataset path set but file not found: {csv_path}")
        return

    # Check if empty
    if len(repo.get_all()) > 0:
        logger.info("Repository not empty, skipping bootstrap.")
        return

    try:
        logger.info(f"Loading data from {csv_path}...")
        full_df = pd.read_csv(csv_path)
        full_df['Id'] = full_df['Id'].astype(str)
        
        # Helper to avoid nan
        def safe_str(val):
            return str(val) if val and str(val) != 'nan' else ""

        def get_ai_studio_link(raw_links: str) -> str:
            if not raw_links:
                return ""
            # Split by newline or comma (common CSV multiline separators)
            links = [l.strip() for l in raw_links.replace(',', '\n').split('\n') if l.strip()]
            
            # 1. Prefer AI Studio
            for l in links:
                if "ai.studio" in l or "aistudio.google.com" in l:
                    return l
            
            # 2. Fallback to first link
            return links[0] if links else ""

        projects_to_create = []
        for _, row in full_df.iterrows():
            video_links = str(row.get('Video_Links', ''))
            video_url = video_links.split(',')[0] if video_links and video_links != 'nan' else ""
            
            p = Project(
                id=str(row['Id']),
                title=safe_str(row.get('Project_Title')),
                subtitle=safe_str(row.get('Project_Subtitle')),
                category=safe_str(row.get('Tracks')) or "Technology", # Map Tracks to category
                description=safe_str(row.get('Project_Description')),
                team_name=safe_str(row.get('Team_Name')),
                writeup_url=safe_str(row.get('WriteUpUrl')),
                video_url=video_url,
                project_links=get_ai_studio_link(safe_str(row.get('Project_Links')))
            )
            projects_to_create.append(p)
            
        repo.bulk_create(projects_to_create)
        logger.info(f"Bootstrapped {len(projects_to_create)} projects from file.")
    except Exception as e:
        logger.error(f"Failed to bootstrap from file: {e}")

def get_quality(p1: Project, p2: Project):
    r1 = env.create_rating(mu=p1.mu, sigma=p1.sigma)
    r2 = env.create_rating(mu=p2.mu, sigma=p2.sigma)
    return env.quality([[r1], [r2]])

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(process_votes())
    
    dataset_path = os.getenv("DATASET_PATH")
    if dataset_path:
        bootstrap_from_file(dataset_path)

# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok", "project_count": len(repo.get_all())}

@app.get("/projects/next-pair", response_model=PairResponse)
def get_next_pair(request: Request, category_filter: Optional[str] = None):
    iap_email = request.headers.get("X-Goog-Authenticated-User-Email")
    judge_email = None
    if iap_email:
        # Format: accounts.google.com:user@example.com
        if ":" in iap_email:
            iap_email = iap_email.split(":")[-1]
        judge_email = iap_email

    projects_list = repo.get_all()
    if len(projects_list) < 2:
        raise HTTPException(status_code=500, detail="Not enough projects")

    candidates = [p for p in projects_list if p.active]
    if category_filter and category_filter != "All":
        candidates = [p for p in candidates if p.category == category_filter]
        
    if len(candidates) < 2:
         candidates = projects_list

    # 1. Pick first project randomly
    p1 = random.choice(candidates)
    
    # 2. Pick second project - Active Learning with History Penalty
    best_opponent = None
    best_quality = -1.0
    
    # Increase sample size to find fresh pairs
    opponents = random.sample(candidates, min(len(candidates), 50))
    
    p1_history = getattr(p1, 'judged_by', [])
    
    for p2 in opponents:
        if p1.id == p2.id:
            continue
        
        # A. Strict Personal History Filter
        # If THIS judge has already judged this pair, skip entirely.
        if judge_email and judge_email.lower() != "unknown":
            has_seen = any(
                j.opponent_id == p2.id and j.judge_email == judge_email 
                for j in p1_history
            )
            if has_seen:
                continue

        # B. Global History Penalty
        # Deprioritize pairs that have been judged by *anyone*
        times_played_global = sum(1 for j in p1_history if j.opponent_id == p2.id)
        
        # Decay factor: 0.1 ^ matches (1 -> 0.1, 2 -> 0.01)
        penalty = 0.1 ** times_played_global
        
        raw_quality = get_quality(p1, p2)
        final_score = raw_quality * penalty
        
        if final_score > best_quality:
            best_quality = final_score
            best_opponent = p2
            
    if not best_opponent:
        remaining = [p for p in candidates if p.id != p1.id]
        if not remaining:
             raise HTTPException(status_code=500, detail="Not enough projects to pair")
        best_opponent = random.choice(remaining)

    return PairResponse(project_a=p1, project_b=best_opponent)

@app.post("/vote")
async def submit_vote(vote: VoteRequest, request: Request):
    # Extract IAP Identity
    iap_email = request.headers.get("X-Goog-Authenticated-User-Email")
    if iap_email:
        # Format: accounts.google.com:user@example.com
        if ":" in iap_email:
            iap_email = iap_email.split(":")[-1]
        vote.judge_email = iap_email
    else:
        # Fallback for local/dev
        vote.judge_email = "unknown@judge.com"

    # Enqueue the vote for background processing
    await vote_queue.put(vote)
    return {"status": "queued"}

@app.get("/leaderboard", response_model=List[Project])
def get_leaderboard(category: Optional[str] = None, limit: int = 50):
    items = repo.get_all()
    
    if category and category != "All":
        items = [p for p in items if p.category == category]
    
    # Filter active only by default
    items = [p for p in items if p.active]
        
    items.sort(key=lambda p: p.mu - 3*p.sigma, reverse=True)
    
    return items[:limit]

@app.get("/projects/search", response_model=List[Project])
def search_projects(query: str):
    if not query or len(query.strip()) < 2:
        return []
        
    
    items = repo.get_all()
    
    # 1. Calc Global Ranks for ACTIVE projects
    active_sorted = sorted(
        [p for p in items if p.active],
        key=lambda p: p.mu - 3*p.sigma,
        reverse=True
    )
    rank_map = {p.id: i+1 for i, p in enumerate(active_sorted)}
    
    results = []
    q_lower = query.lower()
    
    for p in items:
        if q_lower in p.title.lower():
            # Assign rank if active, else None
            rank = rank_map.get(p.id)
            p_ranked = p.model_copy(update={'rank': rank})
            results.append(p_ranked)
            
    # Sort: Ranked first, then archived
    results.sort(key=lambda p: p.rank if p.rank else 999999)
    
    return results[:50]

@app.post("/projects/{project_id}/unarchive")
def unarchive_project(project_id: str):
    p = repo.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    repo.set_active(project_id, True)
    logger.info(f"Project {project_id} unarchived.")
    return {"status": "unarchived", "project_id": project_id}

@app.get("/projects/{project_id}/pair", response_model=PairResponse)
def get_pair_with(project_id: str, opponent_id: Optional[str] = None):
    p1 = repo.get(project_id)
    if not p1:
         raise HTTPException(status_code=404, detail="Project not found")
    
    # Allow pairing even if inactive? Probably no, unarchive first.
    if not p1.active:
         raise HTTPException(status_code=400, detail="Project is archived. Unarchive first.")

    if opponent_id:
        p2 = repo.get(opponent_id)
        if not p2:
            raise HTTPException(status_code=404, detail="Opponent project not found")
        if not p2.active:
             raise HTTPException(status_code=400, detail="Opponent is archived. Unarchive first.")
        return PairResponse(project_a=p1, project_b=p2)

    # Find opponent logic (Active Learning)
    projects_list = repo.get_all()
    candidates = [p for p in projects_list if p.active and p.id != p1.id]
    
    if not candidates:
        raise HTTPException(status_code=500, detail="Not enough projects")
        
    best_opponent = None
    best_quality = -1.0
    
    # Reuse logic: sample 20 random opponents
    opponents = random.sample(candidates, min(len(candidates), 20))
    for p2 in opponents:
        q = get_quality(p1, p2)
        if q > best_quality:
            best_quality = q
            best_opponent = p2
            
    if not best_opponent:
        best_opponent = random.choice(candidates)

    return PairResponse(project_a=p1, project_b=best_opponent)

@app.post("/projects/{project_id}/ignore")
def ignore_project(project_id: str):
    p = repo.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    repo.set_active(project_id, False)
    logger.info(f"Project {project_id} ignored/disqualified.")
    return {"status": "ignored", "project_id": project_id}

@app.get("/ignored-projects", response_model=List[Project])
def get_ignored_projects():
    items = repo.get_all()
    # Return inactive projects
    items = [p for p in items if not p.active]
    items.sort(key=lambda p: p.mu - 3*p.sigma, reverse=True)
    return items

# SPA Fallback: Serve static files and index.html
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
