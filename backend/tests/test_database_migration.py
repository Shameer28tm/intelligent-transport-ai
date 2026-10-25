import os
import tempfile
import sqlite3
import pytest
from sqlalchemy import inspect
from app.database import (
    get_normalized_database_url,
    create_app_engine,
    get_db_info,
    Base,
)
from app.models.incident import Incident, IncidentCategory, IncidentSeverity, IncidentStatus
from app.models.vision_analysis import VisionAnalysisRecord
from alembic.config import Config
from alembic import command


def test_database_url_normalization():
    # SQLite
    sqlite_url = "sqlite:///./transport.db"
    norm_sqlite = get_normalized_database_url(sqlite_url)
    assert norm_sqlite.startswith("sqlite:///")
    assert "transport.db" in norm_sqlite

    # Legacy postgres:// -> postgresql+psycopg2://
    pg_legacy = "postgres://mock_user:mock_pass@mock-db-instance.internal/mockdb?sslmode=require"
    norm_pg = get_normalized_database_url(pg_legacy)
    assert norm_pg.startswith("postgresql+psycopg2://")
    assert "mock-db-instance.internal" in norm_pg

    # postgresql:// -> postgresql+psycopg2://
    pg_std = "postgresql://mock_user:mock_pass@mock-db-instance.internal/mockdb?sslmode=require"
    norm_pg_std = get_normalized_database_url(pg_std)
    assert norm_pg_std.startswith("postgresql+psycopg2://")


def test_database_engine_dialect_isolation():
    # SQLite engine: verify dialect name
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        sqlite_engine = create_app_engine(f"sqlite:///{db_path}")
        assert sqlite_engine.dialect.name == "sqlite"

        # Verify safe metadata
        info = get_db_info()
        assert "dialect" in info
        assert "engine" in info
        assert "password" not in str(info)
    finally:
        sqlite_engine.dispose()
        if os.path.exists(db_path):
            os.unlink(db_path)


def test_alembic_migration_isolated_execution():
    from app.config import get_settings

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    prev_url = os.environ.get("DATABASE_URL")
    try:
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
        get_settings.cache_clear()
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ini_path = os.path.join(backend_dir, "alembic.ini")
        script_dir = os.path.join(backend_dir, "alembic")

        cfg = Config(ini_path)
        cfg.set_main_option("script_location", script_dir)

        # Upgrade head
        command.upgrade(cfg, "head")

        # Inspect tables in the newly migrated database
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
        conn.close()

        assert "incidents" in tables
        assert "vision_analyses" in tables
        assert "alembic_version" in tables
    finally:
        if prev_url:
            os.environ["DATABASE_URL"] = prev_url
        else:
            os.environ.pop("DATABASE_URL", None)
        get_settings.cache_clear()
        if os.path.exists(db_path):
            try:
                os.unlink(db_path)
            except (PermissionError, OSError):
                pass
