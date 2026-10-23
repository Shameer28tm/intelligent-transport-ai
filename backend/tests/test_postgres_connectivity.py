import os
import uuid
from pathlib import Path
import pytest
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from alembic.config import Config
from alembic import command

from app.config import get_settings
from app.database import create_app_engine, Base
from app.models.incident import Incident, IncidentCategory, IncidentSeverity, IncidentStatus


def is_postgres_configured() -> bool:
    settings = get_settings()
    url = settings.DATABASE_URL
    return bool(url) and ("postgresql" in url or "postgres" in url)


@pytest.mark.skipif(not is_postgres_configured(), reason="DATABASE_URL is not configured for PostgreSQL")
def test_postgres_connectivity_and_crud():
    settings = get_settings()
    raw_url = settings.DATABASE_URL
    engine = create_app_engine(raw_url)

    # 1. Real SELECT 1 verification against Neon PostgreSQL
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1")).scalar()
        assert res == 1

    # 2. Run migrations only AFTER SELECT 1 succeeds
    backend_dir = Path(__file__).resolve().parent.parent
    ini_path = str(backend_dir / "alembic.ini")
    script_dir = str(backend_dir / "alembic")

    cfg = Config(ini_path)
    cfg.set_main_option("script_location", script_dir)
    command.upgrade(cfg, "head")

    # 3. Test isolated record creation and retrieval on live PostgreSQL
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSession()
    test_id = str(uuid.uuid4())
    try:
        incident = Incident(
            id=test_id,
            title="P5 Neon Automated Verification Incident",
            description="Testing live Neon PostgreSQL persistence",
            category=IncidentCategory.ACCIDENT,
            severity=IncidentSeverity.MEDIUM,
            status=IncidentStatus.VERIFIED,
            latitude=37.7749,
            longitude=-122.4194,
            location_name="San Francisco Market St Test Node",
            is_simulated=True,
            data_source="AUTOMATED NEON TEST",
        )
        session.add(incident)
        session.commit()

        # 4. Retrieve and verify
        retrieved = session.query(Incident).filter(Incident.id == test_id).first()
        assert retrieved is not None
        assert retrieved.title == "P5 Neon Automated Verification Incident"
        assert retrieved.category == IncidentCategory.ACCIDENT
        assert retrieved.severity == IncidentSeverity.MEDIUM
        assert retrieved.status == IncidentStatus.VERIFIED
    except Exception:
        session.rollback()
        raise
    finally:
        # 5. Clean up only the isolated test record
        try:
            session.query(Incident).filter(Incident.id == test_id).delete()
            session.commit()
        except Exception:
            session.rollback()
        finally:
            session.close()
            engine.dispose()


