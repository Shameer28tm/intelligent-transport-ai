import io
import json
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

from app.config import get_settings
from app.services.tomtom import get_tomtom_service, mask_secret, sanitize_url


def test_mask_secret():
    assert mask_secret(None) == "not_configured"
    assert mask_secret("") == "not_configured"
    assert mask_secret("short") == "configured"
    assert mask_secret("1234567890abcdef") == "configured"


def test_sanitize_url():
    raw = "https://api.tomtom.com/traffic/4/flow?key=SECRET_KEY_12345&point=10,20"
    sanitized = sanitize_url(raw)
    assert "SECRET_KEY_12345" not in sanitized
    assert "key=REDACTED" in sanitized


def test_tomtom_status_not_configured(client, monkeypatch):
    """When TOMTOM_API_KEY is not set, status returns NOT_CONFIGURED without errors."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "")
    service._status_cache = None

    response = client.get("/api/tomtom/status?force_refresh=true")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "TomTom Traffic"
    assert data["status"] == "NOT_CONFIGURED"
    assert data["is_operational"] is False
    assert data["is_configured"] is False
    assert data["fallback_active"] is True
    assert "attribution" in data


def test_tomtom_status_operational_200(client, monkeypatch):
    """When TomTom API returns 200, status reports OPERATIONAL and live data source."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_valid_key_12345678")
    service._status_cache = None

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = b'{"flowSegmentData": {"currentSpeed": 50}}'

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    response = client.get("/api/tomtom/status?force_refresh=true")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert data["is_operational"] is True
    assert data["fallback_active"] is False
    assert data["products_available"]["traffic_flow"] is True
    assert data["products_available"]["traffic_incidents"] is True
    assert "test_valid_key_12345678" not in response.text


def test_tomtom_status_auth_failure_401(client, monkeypatch):
    """When TomTom returns 401 Unauthorized, status reports AUTH_FAILED without leaking keys."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "invalid_key_87654321")
    service._status_cache = None

    def mock_urlopen_401(req, timeout):
        err_body = io.BytesIO(b'{"detailedError": {"code": "Unauthorized", "message": "Invalid API Key"}}')
        raise urllib.error.HTTPError(
            url="https://api.tomtom.com/traffic",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=err_body,
        )

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_401)

    response = client.get("/api/tomtom/status?force_refresh=true")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "AUTH_FAILED"
    assert data["is_operational"] is False
    assert data["fallback_active"] is True
    assert "401" in data["error"]
    assert "invalid_key_87654321" not in response.text


def test_tomtom_status_forbidden_403(client, monkeypatch):
    """When TomTom returns 403 Forbidden, status reports FORBIDDEN."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_unentitled")
    service._status_cache = None

    def mock_urlopen_403(req, timeout):
        err_body = io.BytesIO(b'{"detailedError": {"code": "Forbidden", "message": "Not entitled to Traffic API"}}')
        raise urllib.error.HTTPError(
            url="https://api.tomtom.com/traffic",
            code=403,
            msg="Forbidden",
            hdrs={},
            fp=err_body,
        )

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_403)

    response = client.get("/api/tomtom/status?force_refresh=true")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "FORBIDDEN"
    assert data["is_operational"] is False


def test_tomtom_status_rate_limit_429(client, monkeypatch):
    """When TomTom returns 429, status reports RATE_LIMITED."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_qps")
    service._status_cache = None

    def mock_urlopen_429(req, timeout):
        err_body = io.BytesIO(b'{"detailedError": {"code": "TooManyRequests", "message": "QPS Limit Exceeded"}}')
        raise urllib.error.HTTPError(
            url="https://api.tomtom.com/traffic",
            code=429,
            msg="Too Many Requests",
            hdrs={},
            fp=err_body,
        )

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_429)

    response = client.get("/api/tomtom/status?force_refresh=true")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "RATE_LIMITED"


def test_tomtom_flow_segment_success(client, monkeypatch):
    """Valid flow segment response is correctly parsed and normalized."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_flow")
    service._flow_cache.clear()

    flow_payload = {
        "flowSegmentData": {
            "frc": "FRC1",
            "currentSpeed": 38,
            "freeFlowSpeed": 60,
            "currentTravelTime": 85,
            "freeFlowTravelTime": 50,
            "confidence": 0.95,
            "roadClosure": False,
            "coordinates": {
                "coordinate": [
                    {"latitude": 37.7749, "longitude": -122.4194},
                    {"latitude": 37.7758, "longitude": -122.4182},
                ]
            },
        }
    }

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = json.dumps(flow_payload).encode("utf-8")

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    response = client.get("/api/tomtom/flow?lat=37.7749&lng=-122.4194")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["current_speed_kmh"] == 38
    assert data["free_flow_speed_kmh"] == 60
    assert data["congestion_pct"] == 36
    assert data["data_source"] == "TOMTOM_LIVE_FLOW"
    assert len(data["coordinates"]) == 2


def test_tomtom_flow_unconfigured_error(client, monkeypatch):
    """Flow endpoint handles unconfigured key gracefully."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "")
    service._flow_cache.clear()

    response = client.get("/api/tomtom/flow?lat=37.7749&lng=-122.4194")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["http_status_code"] == 401
    assert data["fallback_active"] is True


def test_tomtom_incidents_success(client, monkeypatch):
    """Incident Details v5 payload is normalized into application Incident schema."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_incidents")
    service._incidents_cache.clear()

    incidents_payload = {
        "incidents": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-122.4194, 37.7749], [-122.4180, 37.7760]],
                },
                "properties": {
                    "id": "inc_sf_market_st_1",
                    "iconCategory": "jam",
                    "magnitudeOfDelay": 2,
                    "events": [{"description": "Stationary traffic on Market St", "code": 401}],
                    "delay": 320,
                    "length": 500,
                    "roadNumbers": ["Market St", "US-101"],
                    "from": "5th St",
                    "to": "8th St",
                    "startTime": "2026-10-24T03:00:00Z",
                },
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = json.dumps(incidents_payload).encode("utf-8")

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    response = client.get("/api/tomtom/incidents")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 1
    assert len(data["incidents"]) == 1

    item = data["incidents"][0]
    assert item["id"] == "tomtom_inc_sf_market_st_1"
    assert item["category"] == "CONGESTION"
    assert item["severity"] == "HIGH"
    assert item["status"] == "VERIFIED"
    assert item["is_simulated"] is False  # Must be explicitly False for live TomTom incidents
    assert item["data_source"] == "TOMTOM LIVE TRAFFIC"
    assert item["latitude"] == 37.7749
    assert item["longitude"] == -122.4194
    assert "Market St" in item["location_name"]


def test_tomtom_incidents_empty(client, monkeypatch):
    """Empty incident list inside bounding box is handled safely."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_empty")
    service._incidents_cache.clear()

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = b'{"incidents": []}'

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    response = client.get("/api/tomtom/incidents?min_lon=-122.5&min_lat=37.7&max_lon=-122.4&max_lat=37.8")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 0
    assert data["incidents"] == []


def test_tomtom_timeout_handling(client, monkeypatch):
    """Network timeouts return structured error without 500 crash."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_timeout")
    service._incidents_cache.clear()

    def mock_urlopen_timeout(req, timeout):
        raise urllib.error.URLError("timed out")

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_timeout)

    response = client.get("/api/tomtom/incidents")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["http_status_code"] == 503
    assert data["incidents"] == []


def test_tomtom_incidents_tamil_nadu_bbox(client, monkeypatch):
    """Tamil Nadu (Chennai) bounding box and integer iconCategory parsing."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_tamil_nadu")
    service._incidents_cache.clear()

    # Real TomTom incident schema with integer iconCategory 8 (Road Closed) and magnitudeOfDelay 4
    incidents_payload = {
        "incidents": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[80.1246, 13.0721], [80.1250, 13.0730]],
                },
                "properties": {
                    "id": "inc_chennai_anna_salai_1",
                    "iconCategory": 8,  # Integer representation
                    "magnitudeOfDelay": 4,  # Critical magnitude
                    "events": [{"description": "Road closed due to water pipeline repair", "code": 401}],
                    "delay": 600,
                    "length": 350,
                    "roadNumbers": ["Anna Salai"],
                    "from": "Guindy",
                    "to": "Saidapet",
                    "startTime": "2026-10-24T04:00:00Z",
                },
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = json.dumps(incidents_payload).encode("utf-8")

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    # Query with Chennai BBox: [80.12, 12.92, 80.32, 13.18]
    response = client.get("/api/tomtom/incidents?min_lon=80.12&min_lat=12.92&max_lon=80.32&max_lat=13.18")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 1

    item = data["incidents"][0]
    assert item["id"] == "tomtom_inc_chennai_anna_salai_1"
    assert item["category"] == "ROAD_HAZARD"
    assert item["severity"] == "CRITICAL"
    assert item["is_simulated"] is False
    assert item["data_source"] == "TOMTOM LIVE TRAFFIC"
    # Verify coordinate order: GeoJSON [lon, lat] mapped to incident latitude, longitude
    assert abs(item["latitude"] - 13.0721) < 0.001
    assert abs(item["longitude"] - 80.1246) < 0.001
    assert "Anna Salai" in item["location_name"]


def test_tomtom_flow_unit_normalization(client, monkeypatch):
    """Speed units Kmh, kmph, and mph are normalized properly."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_flow_units")
    service._flow_cache.clear()

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = b'{"flowSegmentData": {"currentSpeed": 45, "freeFlowSpeed": 50, "frc": "FRC1"}}'

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    # Test unit=Kmh
    resp_kmh = client.get("/api/tomtom/flow?lat=13.04&lng=80.25&unit=Kmh")
    assert resp_kmh.status_code == 200
    assert resp_kmh.json()["current_speed_kmh"] == 45

    # Test unit=mph
    service._flow_cache.clear()
    resp_mph = client.get("/api/tomtom/flow?lat=13.04&lng=80.25&unit=mph")
    assert resp_mph.status_code == 200
    # 45 mph should be converted to ~72 km/h
    assert resp_mph.json()["current_speed_kmh"] == int(45 * 1.60934)


def test_tomtom_incidents_invalid_bbox(client):
    """Invalid bounding box (min >= max) returns HTTP 400 validation error."""
    response = client.get("/api/tomtom/incidents?min_lon=80.5&min_lat=13.0&max_lon=80.1&max_lat=13.0")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["http_status_code"] == 400
    assert "Invalid bounding box" in data["error"]


def test_tomtom_incident_without_geometry_is_skipped(client, monkeypatch):
    """An incident with no usable coordinates must be dropped, never placed at a default location."""
    service = get_tomtom_service()
    monkeypatch.setattr(service, "api_key", "test_key_no_geometry")
    service._incidents_cache.clear()

    payload = {
        "incidents": [
            {"type": "Feature", "geometry": {"type": "LineString", "coordinates": []},
             "properties": {"id": "no_geom", "iconCategory": 1}},
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [80.2045, 13.0067]},
             "properties": {"id": "kathipara", "iconCategory": 1}},
        ]
    }
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.read.return_value = json.dumps(payload).encode("utf-8")
    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: mock_resp)

    response = client.get("/api/tomtom/incidents?min_lon=80.12&min_lat=12.92&max_lon=80.32&max_lat=13.18")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["incidents"][0]["latitude"] == 13.0067
