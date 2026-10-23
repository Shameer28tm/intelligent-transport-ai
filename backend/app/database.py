import os
from pathlib import Path
from typing import Generator, Dict, Any
from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import get_settings

settings = get_settings()

def get_normalized_database_url(raw_url: str) -> str:
    """Normalize database connection string for SQLAlchemy compatibility."""
    if not raw_url:
        raise ValueError("DATABASE_URL is empty or not configured.")

    # SQLAlchemy 2.0 requires 'postgresql://' or 'postgresql+psycopg2://' instead of legacy 'postgres://'
    if raw_url.startswith("postgres://"):
        return "postgresql+psycopg2://" + raw_url[len("postgres://"):]
    
    if raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+"):
        return "postgresql+psycopg2://" + raw_url[len("postgresql://"):]

    if raw_url.startswith("sqlite"):
        prefix = "sqlite:///"
        if raw_url.startswith(prefix):
            raw_path = raw_url[len(prefix):]
            if not os.path.isabs(raw_path):
                clean_rel = raw_path.lstrip("./\\")
                backend_dir = Path(__file__).resolve().parent.parent
                canonical_db_path = (backend_dir / clean_rel).resolve()
                return f"sqlite:///{canonical_db_path.as_posix()}"
        return raw_url

    return raw_url


def create_app_engine(database_url: str):
    """Create SQLAlchemy engine with appropriate connection parameters per dialect."""
    norm_url = get_normalized_database_url(database_url)
    is_sqlite = norm_url.startswith("sqlite")
    is_postgres = "postgresql" in norm_url

    if is_sqlite:
        return create_engine(
            norm_url,
            connect_args={"check_same_thread": False, "timeout": 10},
            echo=False,
            future=True,
        )
    elif is_postgres:
        return create_engine(
            norm_url,
            connect_args={"connect_timeout": 5},
            pool_pre_ping=True,      # Vital for Neon serverless idle connection recovery
            pool_recycle=300,        # Recycle idle connections every 5 minutes
            pool_size=5,
            max_overflow=10,
            echo=False,
            future=True,
        )
    else:
        # Generic fallback for other valid SQLAlchemy database URLs
        return create_engine(
            norm_url,
            pool_pre_ping=True,
            echo=False,
            future=True,
        )


db_url = get_normalized_database_url(settings.DATABASE_URL)
engine = create_app_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()


def get_db_info(raw_url: str | None = None) -> Dict[str, Any]:
    """Safe diagnostic metadata about the current active database engine (no credentials exposed)."""
    target_url = raw_url or get_settings().DATABASE_URL
    norm_url = get_normalized_database_url(target_url)
    if norm_url.startswith("sqlite"):
        return {
            "dialect": "sqlite",
            "is_postgres": False,
            "engine": "SQLite (Local Development / Isolated Tests)",
        }
    parsed = urlparse(norm_url)
    is_neon = "neon.tech" in (parsed.hostname or "")
    return {
        "dialect": "postgresql",
        "is_postgres": True,
        "is_neon": is_neon,
        "engine": f"Neon PostgreSQL ({parsed.hostname})" if is_neon else "PostgreSQL Server",
    }


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing database sessions to request handlers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

