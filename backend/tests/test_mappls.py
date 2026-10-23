def test_mappls_status_endpoint(client):
    """Verify Mappls status endpoint returns accurate diagnostic info without leaking secrets."""
    response = client.get("/api/mappls/status")
    assert response.status_code == 200
    data = response.json()
    assert "provider" in data
    assert data["provider"] == "Mappls (MapmyIndia)"
    assert "status" in data
    assert "is_configured" in data
    assert "fallback_active" in data
    assert "attribution" in data
    assert "MapmyIndia" in data["attribution"]
    # Verify no raw secrets are in the response
    raw_response_text = response.text
    assert "greaqntuvlycjnoldsvwniusphemeuoictsr" not in raw_response_text


def test_mappls_geocode_endpoint(client):
    """Test Mappls geocoding endpoint handles queries and returns structured responses."""
    # Min length validation
    invalid_resp = client.get("/api/mappls/geocode?query=a")
    assert invalid_resp.status_code == 422  # validation error for min_length 2

    valid_resp = client.get("/api/mappls/geocode?query=Connaught+Place+Delhi")
    assert valid_resp.status_code == 200
    data = valid_resp.json()
    assert "provider" in data
    assert data["provider"] == "mappls"
    assert "success" in data
    assert "results" in data


def test_mappls_route_endpoint(client):
    """Test Mappls routing endpoint handles coordinate requests."""
    payload = {
        "start_lng": 77.2090,
        "start_lat": 28.6139,
        "end_lng": 77.2295,
        "end_lat": 28.6129,
        "profile": "driving",
    }
    response = client.post("/api/mappls/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "provider" in data
    assert data["provider"] == "mappls"
    assert "success" in data
