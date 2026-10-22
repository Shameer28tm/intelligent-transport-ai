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
    assert "RTX 5060" in data["hardware_detection"]["gpu_detected"]
