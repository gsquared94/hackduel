import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import trueskill
import random
import statistics

# TrueSkill setup (matching backend/main.py)
env = trueskill.TrueSkill(mu=25.0, sigma=8.333, beta=4.167, tau=0.083, draw_probability=0.0)

NUM_PROJECTS = 4000
TARGET_SIGMA = 3.0  # The threshold we used for "High Confidence" in the UI

class Project:
    def __init__(self, id, true_quality):
        self.id = id
        self.true_quality = true_quality
        self.rating = env.create_rating()

# 1. Generate Projects with latent "True Quality" (Normal dist)
projects = [Project(i, random.gauss(25, 8.333)) for i in range(NUM_PROJECTS)]

print(f"Simulating {NUM_PROJECTS} projects...")

votes_cast = 0
avg_sigma = 8.333

# We track checkpoints
checkpoints = [8.0, 7.0, 6.0, 5.0, 4.0, 3.5, 3.0]
next_checkpoint_idx = 0

while avg_sigma > TARGET_SIGMA and next_checkpoint_idx < len(checkpoints):
    # Pick two random projects
    p1, p2 = random.sample(projects, 2)
    
    # Decide winner based on true quality
    # A simple probabilistic model: P(1 wins) = sigmoid(q1 - q2)
    # Using TrueSkill's quality check for "correct" probability
    delta = p1.true_quality - p2.true_quality
    # Probability that p1 wins (simplification)
    import math
    prob_p1_wins = 1 / (1 + math.exp(-delta / 4.167)) # Beta scale
    
    if random.random() < prob_p1_wins:
        winner, loser = p1, p2
    else:
        winner, loser = p2, p1
        
    # Update ratings
    new_r1, new_r2 = env.rate_1vs1(winner.rating, loser.rating)
    winner.rating = new_r1
    loser.rating = new_r2
    
    votes_cast += 1
    
    if votes_cast % 1000 == 0:
        # Calculate stats
        sigmas = [p.rating.sigma for p in projects]
        avg_sigma = statistics.mean(sigmas)
        
        target = checkpoints[next_checkpoint_idx]
        if avg_sigma <= target:
            print(f"Reached Avg Sigma < {target:.1f} after {votes_cast} votes ({votes_cast/NUM_PROJECTS:.2f} votes/project)")
            next_checkpoint_idx += 1
            
print(f"DONE. Total votes to reach Sigma={TARGET_SIGMA}: {votes_cast}")
print(f"Average votes per project: {votes_cast / NUM_PROJECTS:.2f}")
