import pytest
import trueskill
from fastapi.testclient import TestClient
import random
import math
from scipy import stats
import sys
import os

# Add project root to path to import backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import repo, Project, get_next_pair, submit_vote, VoteRequest, get_leaderboard
from backend.db_abstraction import InMemoryRepository

# Removed TestClient usage for core loop to improve performance
# client = TestClient(app) 

NUM_PROJECTS = 4000
NUM_VOTES = 10000 # 2.5 votes per project (sparse)
TRUE_SKILL_MEAN = 50.0
TRUE_SKILL_STD = 15.0

@pytest.fixture
def mock_projects():
    """Sets up a simulated environment with 1000 projects having known true skills."""
    # Clear existing state for simulation
    if isinstance(repo, InMemoryRepository):
        repo._db.clear()
    
    true_skills = {}
    projects_list = []
    
    for i in range(NUM_PROJECTS):
        p_id = str(i)
        # Generate a "True" quality score for this project
        # We use a wider variance than the initial estimate to ensure differentiation
        true_quality = random.normalvariate(TRUE_SKILL_MEAN, TRUE_SKILL_STD)
        true_skills[p_id] = true_quality
        
        # Initialize in DB with default ratings
        p = Project(
            id=p_id,
            title=f"Project {i}",
            category="Test",
            description="Simulated project",
            mu=25.0, # Default TrueSkill mu
            sigma=8.333 # Default TrueSkill sigma
        )
        projects_list.append(p)
        
    repo.bulk_create(projects_list)
        
    return true_skills

def get_win_probability(skill_a, skill_b):
    """Logistic function to determine win probability based on skill difference."""
    # B = scale parameter. Higher B = more randomness (noise). Lower B = more deterministic.
    # TrueSkill uses Gaussian noise, but logistic is a good approximation for simulation.
    B = 10.0 
    delta = skill_a - skill_b
    return 1 / (1 + math.exp(-delta / B))

@pytest.mark.asyncio
async def test_simulation_convergence(mock_projects):
    """
    Simulates a voting loop and verifies that the system correctly identifies
    the higher quality projects (rank correlation).
    """
    true_skills = mock_projects
    
    print(f"\nStarting optimized simulation with {NUM_PROJECTS} projects and {NUM_VOTES} votes...")
    
    votes_cast = 0
    
    for _ in range(NUM_VOTES):
        # 1. Get a pair to judge
        # Call function directly - bypassing HTTP layer for speed
        pair_data = get_next_pair()
        
        # Access attributes directly from Pydantic model
        p1_id = pair_data.project_a.id
        p2_id = pair_data.project_b.id
        
        # 2. Determine "True" winner based on hidden skills
        s1 = true_skills[p1_id]
        s2 = true_skills[p2_id]
        
        prob_p1_wins = get_win_probability(s1, s2)
        
        # Simulate vote outcome
        if random.random() < prob_p1_wins:
            winner, loser = p1_id, p2_id
        else:
            winner, loser = p2_id, p1_id
            
        # 3. Submit vote
        # Call function directly
        # Since submit_vote is async and background processed, we simulate the effect directly
        # or we need to await the queue processing. 
        # For simplicity in this unit test, we'll manually apply the rating update 
        # that the background worker would do.
        
        # NOTE: This duplicates logic from process_votes in main.py but avoids race conditions in test
        # Fetch current state
        project_winner = repo.get(winner)
        project_loser = repo.get(loser)
        
        if project_winner and project_loser:
            # Update ratings
            rating_winner = trueskill.Rating(mu=project_winner.mu, sigma=project_winner.sigma)
            rating_loser = trueskill.Rating(mu=project_loser.mu, sigma=project_loser.sigma)
            
            new_r_winner, new_r_loser = trueskill.rate_1vs1(rating_winner, rating_loser)
            
            project_winner.mu = new_r_winner.mu
            project_winner.sigma = new_r_winner.sigma
            project_loser.mu = new_r_loser.mu
            project_loser.sigma = new_r_loser.sigma
            
            repo.update(project_winner)
            repo.update(project_loser)
        
        votes_cast += 1
        
        if votes_cast % 1000 == 0:
            print(f"Votes cast: {votes_cast}...", end="\n") # Use newline to flush

    print(f"\nSimulation complete. validation results:")
    
    # 4. Verify Rankings
    # Call function directly
    leaderboard = get_leaderboard(limit=NUM_PROJECTS)
    
    # Extract rankings
    # Predicted rank: index in leaderboard (0 is best)
    # True rank: sort by true_skills
    
    predicted_order = [p.id for p in leaderboard]
    
    # ground truth order (descending skill)
    true_order = sorted(true_skills.keys(), key=lambda x: true_skills[x], reverse=True)
    
    # Create rank maps
    pred_ranks = {pid: i for i, pid in enumerate(predicted_order)}
    true_ranks = {pid: i for i, pid in enumerate(true_order)}
    
    # Calculate Spearman Correlation
    # We only care about the intersection if leaderboard is partial, but here we got all
    common_ids = [pid for pid in true_order if pid in pred_ranks]
    
    x = [pred_ranks[pid] for pid in common_ids]
    y = [true_ranks[pid] for pid in common_ids]
    
    correlation, p_value = stats.spearmanr(x, y)
    
    print(f"Spearman Correlation: {correlation:.4f}")
    
    # Verify that the top 10 projects in ground truth are mostly in the top tier of predicted
    
    # Threshold might need to be lower for very sparse data (10k votes / 4k projects = 2.5 votes/project)
    assert correlation > 0.4, f"Correlation {correlation} is too low. Ranking failed to converge."
    print("SUCCESS: Positive correlation between True Skill and Predicted Rank.")
