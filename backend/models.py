from pydantic import BaseModel, ConfigDict
from typing import Optional

class Project(BaseModel):
    id: str
    title: str
    category: str
    subtitle: Optional[str] = ""
    description: str = ""
    team_name: Optional[str] = ""
    writeup_url: Optional[str] = ""
    video_url: Optional[str] = ""
    project_links: Optional[str] = ""
    # TrueSkill ratings
    mu: float = 25.0
    mu: float = 25.0
    sigma: float = 8.333
    active: bool = True
    
    model_config = ConfigDict(arbitrary_types_allowed=True)

class VoteRequest(BaseModel):
    winner_id: str
    loser_id: str

class PairResponse(BaseModel):
    project_a: Project
    project_b: Project
