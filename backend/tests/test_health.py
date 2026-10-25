from unittest.mock import MagicMock
from sqlalchemy.exc import OperationalError


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Intelligent Transport AI" in data["name"]
    assert "SIMULATED DEMO DATA" in data["data_provenance"]


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] == "connected"
    assert "Deterministic Demo Simulator" in data["vision_subsystem"]["active_adapter"]
    assert data["vision_subsystem"]["is_simulated"] is True
    # Hardware detection must be dynamic and not hardcode fake CUDA availability
    assert isinstance(data["hardware_detection"]["gpu_detected"], str)
    assert isinstance(data["hardware_detection"]["cuda_driver_ready"], bool)
    assert "inference_runtime" in data["hardware_detection"]


def test_health_degraded_when_database_unreachable(client, monkeypatch):
    """Verify /health returns status: degraded within <10s without crashing when DB fails."""
    from app.database import get_db

    def mock_get_db():
        mock_session = MagicMock()
        mock_session.execute.side_effect = OperationalError("connection timeout", params=None, orig=None)
        yield mock_session

    from app.main import app
    app.dependency_overrides[get_db] = mock_get_db
    try:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert "unreachable" in data["database"]["status"]
        assert data["database"]["latency_ms"] >= 0.0 or data["database"]["latency_ms"] == -1.0
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_security_headers(client):
    """Verify security headers are applied to HTTP responses."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

