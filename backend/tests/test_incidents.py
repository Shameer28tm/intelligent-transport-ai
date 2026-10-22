import pytest


def test_list_incidents_seeded(client):
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    assert len(data["items"]) > 0
    assert "SIMULATED DEMO DATA" in data["is_simulated_notice"]


def test_filter_incidents_by_severity(client):
    response = client.get("/api/incidents?severity=CRITICAL")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["severity"] == "CRITICAL"


def test_filter_incidents_by_category(client):
    response = client.get("/api/incidents?category=ACCIDENT")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["category"] == "ACCIDENT"


def test_bounding_box_filter(client):
    # Filter within tight San Francisco Downtown bounding box
    response = client.get(
        "/api/incidents?min_lat=37.77&max_lat=37.80&min_lng=-122.42&max_lng=-122.38"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert 37.77 <= item["latitude"] <= 37.80
        assert -122.42 <= item["longitude"] <= -122.38


def test_create_incident_valid(client):
    payload = {
        "title": "Pedestrian Stalled Crossing Warning",
        "description": "Smart crosswalk thermal sensor flagged stationary pedestrian in roadway.",
        "category": "PEDESTRIAN_CROSSING_RISK",
        "severity": "HIGH",
        "latitude": 37.7812,
        "longitude": -122.4110,
        "location_name": "7th St & Market St",
        "corridor": "Market Street Corridor",
        "speed_limit_kmh": 40.0,
        "current_speed_kmh": 22.0,
        "congestion_level_pct": 55.0,
        "affected_lanes": 1,
        "tags": ["pedestrian", "thermal-sensor"],
        "status": "REPORTED",
        "is_simulated": True,
        "data_source": "SIMULATED DEMO DATA",
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["id"] is not None
    assert created["title"] == payload["title"]
    assert created["latitude"] == 37.7812


def test_create_incident_invalid_coordinates(client):
    # Latitude > 90.0 must be rejected with 422
    payload = {
        "title": "Invalid Lat Test",
        "category": "ACCIDENT",
        "severity": "CRITICAL",
        "latitude": 99.9999,
        "longitude": -122.4110,
        "location_name": "Invalid Location",
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "Validation Error"


def test_get_incident_detail_and_404(client):
    # Get all, take first id
    list_res = client.get("/api/incidents")
    first_id = list_res.json()["items"][0]["id"]

    res = client.get(f"/api/incidents/{first_id}")
    assert res.status_code == 200
    assert res.json()["id"] == first_id

    # Non-existent ID returns 404
    missing_res = client.get("/api/incidents/non-existent-uuid-12345")
    assert missing_res.status_code == 404


def test_patch_incident_status(client):
    list_res = client.get("/api/incidents?status=REPORTED")
    items = list_res.json()["items"]
    if not items:
        # Create one to test status transition
        create_res = client.post(
            "/api/incidents",
            json={
                "title": "Status Transition Incident",
                "category": "HAZARD",
                "severity": "MEDIUM",
                "latitude": 37.77,
                "longitude": -122.41,
                "location_name": "Test St",
                "status": "REPORTED",
            },
        )
        target_id = create_res.json()["id"]
    else:
        target_id = items[0]["id"]

    # Transition to RESOLVED
    patch_res = client.patch(
        f"/api/incidents/{target_id}",
        json={"status": "RESOLVED"},
    )
    assert patch_res.status_code == 200
    resolved_data = patch_res.json()
    assert resolved_data["status"] == "RESOLVED"
    assert resolved_data["resolved_at"] is not None


def test_statistics_endpoint(client):
    response = client.get("/api/statistics")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_incidents"] > 0
    assert stats["monitored_corridors_count"] > 0
    assert "CRITICAL" in stats["severity_breakdown"]
    assert len(stats["hourly_trends"]) == 24
