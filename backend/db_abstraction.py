from abc import ABC, abstractmethod
from typing import List, Optional, Dict
import logging
try:
    from .models import Project
except ImportError:
    from models import Project
from google.cloud import firestore
import threading

logger = logging.getLogger("uvicorn")

class ProjectRepository(ABC):
    @abstractmethod
    def get_all(self) -> List[Project]:
        pass

    @abstractmethod
    def get(self, project_id: str) -> Optional[Project]:
        pass

    @abstractmethod
    def update(self, project: Project) -> None:
        """Updates a project."""
        pass
        
    @abstractmethod
    def bulk_create(self, projects: List[Project]) -> None:
        pass

    @abstractmethod
    def atomic_vote_update(self, winner_id: str, loser_id: str, update_logic: callable) -> None:
        """
        Atomically updates the winner and loser projects using the provided update_logic.
        update_logic(winner: Project, loser: Project) -> (updated_winner: Project, updated_loser: Project)
        """
        pass

    @abstractmethod
    def set_active(self, project_id: str, active: bool) -> None:
        """Updates only the active status of a project."""
        pass

class InMemoryRepository(ProjectRepository):
    def __init__(self):
        self._db: Dict[str, Project] = {}
        self._lock = threading.Lock()
        
    def get_all(self) -> List[Project]:
        with self._lock:
            return list(self._db.values())

    def get(self, project_id: str) -> Optional[Project]:
        with self._lock:
            return self._db.get(project_id)

    def update(self, project: Project) -> None:
        with self._lock:
            self._db[project.id] = project
        
    def bulk_create(self, projects: List[Project]) -> None:
        with self._lock:
            for p in projects:
                self._db[p.id] = p

    def update_cache_only(self, project: Project) -> None:
        self.update(project)

    def persist(self, project: Project) -> None:
        pass # No-op for in-memory

    def atomic_vote_update(self, winner_id: str, loser_id: str, update_logic: callable) -> None:
        with self._lock:
            winner = self._db.get(winner_id)
            loser = self._db.get(loser_id)
            
            if not winner or not loser:
                logging.warning(f"Atomic update failed: Project not found (W:{winner_id}, L:{loser_id})")
                return

            # Apply logic
            updated_winner, updated_loser = update_logic(winner, loser)
            
            # Commit (just updating in-memory dict)
            self._db[winner_id] = updated_winner
            self._db[loser_id] = updated_loser

    def set_active(self, project_id: str, active: bool) -> None:
        with self._lock:
            if project_id in self._db:
                self._db[project_id].active = active

class FirestoreRepository(ProjectRepository):
    def __init__(self, collection_name="projects"):
        self.db = firestore.Client()
        logger.info(f"Initialized Firestore Client for Project ID: {self.db.project}")
        self.collection_ref = self.db.collection(collection_name)
        # Read-Through Cache
        self._cache_repo = InMemoryRepository()
        self._initialized = False
        self._init_lock = threading.Lock()
        
    def _ensure_loaded(self):
        """Loads data from Firestore to Cache on first access."""
        with self._init_lock:
            if self._initialized:
                return
            
            logger.info("Loading projects from Firestore...")
        try:
            docs = self.collection_ref.stream()
            projects = []
            for doc in docs:
                data = doc.to_dict()
                # Ensure models match
                try:
                    p = Project(**data)
                    projects.append(p)
                except Exception as e:
                    logger.warning(f"Skipping bad doc {doc.id}: {e}")
                    
            self._cache_repo.bulk_create(projects)
            self._initialized = True
            logger.info(f"Loaded {len(projects)} projects from Firestore.")
        except Exception as e:
            logger.error(f"Firestore load failed: {e}")

    def get_all(self) -> List[Project]:
        self._ensure_loaded()
        return self._cache_repo.get_all()

    def get(self, project_id: str) -> Optional[Project]:
        self._ensure_loaded()
        return self._cache_repo.get(project_id)

    def update(self, project: Project) -> None:
        """Full synchronous update (Cache + Firestore)."""
        self.update_cache_only(project)
        self.persist(project)

    def update_cache_only(self, project: Project) -> None:
        """Updates only the in-memory cache."""
        self._cache_repo.update(project)

    def persist(self, project: Project) -> None:
        """Writes to Firestore (Blocking)."""
        try:
            self.collection_ref.document(project.id).set(project.model_dump())
        except Exception as e:
            logger.error(f"Firestore write failed for {project.id}: {e}")

    def bulk_create(self, projects: List[Project]) -> None:
        # Update Cache
        self._cache_repo.bulk_create(projects)
        self._initialized = True
        
        # Batch write to Firestore
        batch = self.db.batch()
        count = 0
        for p in projects:
            doc_ref = self.collection_ref.document(p.id)
            batch.set(doc_ref, p.model_dump())
            count += 1
            if count >= 400: # Limit per batch
                batch.commit()
                batch = self.db.batch()
                count = 0
        if count > 0:
            batch.commit()

    def atomic_vote_update(self, winner_id: str, loser_id: str, update_logic: callable) -> None:
        """
        Uses Firestore Transaction to atomic read-modify-write.
        """
        transaction = self.db.transaction()
        winner_ref = self.collection_ref.document(winner_id)
        loser_ref = self.collection_ref.document(loser_id)

        @firestore.transactional
        def update_in_transaction(transaction, winner_ref, loser_ref):
            winner_snapshot = winner_ref.get(transaction=transaction)
            loser_snapshot = loser_ref.get(transaction=transaction)

            if not winner_snapshot.exists or not loser_snapshot.exists:
                # Should ideally handle missing docs gracefully or raise error
                return 

            # Convert to Models
            winner_data = winner_snapshot.to_dict()
            loser_data = loser_snapshot.to_dict()
            # Ensure ID is present if not in dict (it should be though)
            winner_data['id'] = winner_snapshot.id
            loser_data['id'] = loser_snapshot.id
            
            winner = Project(**winner_data)
            loser = Project(**loser_data)

            # Apply Logic
            updated_winner, updated_loser = update_logic(winner, loser)
            
            # Write back to Firestore
            transaction.set(winner_ref, updated_winner.model_dump())
            transaction.set(loser_ref, updated_loser.model_dump())
            
            return updated_winner, updated_loser

        try:
            # Execute Transaction
            updated_winner, updated_loser = update_in_transaction(transaction, winner_ref, loser_ref)
            
            # Update Cache after successful commit
            self.update_cache_only(updated_winner)
            self.update_cache_only(updated_loser)
            
        except Exception as e:
            logger.error(f"Transaction failed: {e}")

    def set_active(self, project_id: str, active: bool) -> None:
        """Partially updates the active field."""
        # Update Cache
        if self._initialized:
             p = self._cache_repo.get(project_id)
             if p:
                 p.active = active
                 self._cache_repo.update(p)
        
        # Update Firestore (Merge)
        try:
            self.collection_ref.document(project_id).update({"active": active})
        except Exception as e:
            logger.error(f"Failed to set active={active} for {project_id}: {e}")
