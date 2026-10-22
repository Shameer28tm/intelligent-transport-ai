import io
import pytest
from PIL import Image
from app.services.vision.real_adapter import RealVisionAdapter


def create_test_image_bytes(width=640, height=480, color=(50, 100, 150)) -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_vision_supported_formats(client):
    response = client.get("/api/vision/supported-formats")
    assert response.status_code == 200
    data = response.json()
    assert ".jpg" in data["supported_images"]
    assert ".mp4" in data["supported_videos"]
    assert data["max_file_size_mb"] == 20


def test_vision_status(client):
    response = client.get("/api/vision/status")
    assert response.status_code == 200
    data = response.json()
    assert data["is_simulated"] is True
    assert "Deterministic Demo Simulator" in data["adapter_name"]


def test_vision_analyze_valid_image(client):
    img_bytes = create_test_image_bytes(800, 600)
    files = {"file": ("cctv_frame_01.jpg", img_bytes, "image/jpeg")}
    
    response = client.post("/api/vision/analyze", files=files)
    assert response.status_code == 200
    result = response.json()
    
    assert result["status"] == "COMPLETED"
    assert result["is_simulated"] is True
    assert result["width"] == 800
    assert result["height"] == 600
    assert result["total_vehicles"] >= 0
    assert len(result["detected_objects"]) > 0
    assert 0.0 <= result["collision_risk_score"] <= 1.0
    assert "SIMULATED DEMO DATA" in result["provenance_notice"]


def test_vision_analyze_unsupported_format(client):
    files = {"file": ("script.sh", b"#!/bin/bash\necho 1", "application/x-sh")}
    response = client.post("/api/vision/analyze", files=files)
    assert response.status_code == 415
    assert "Unsupported file format" in response.json()["error"]


def test_vision_analyze_empty_file(client):
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    response = client.post("/api/vision/analyze", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["error"]


def test_real_vision_adapter_unavailable_graceful_handling():
    import asyncio
    adapter = RealVisionAdapter(weights_path="non_existent_weights.pt")
    assert adapter.is_available() is False
    assert adapter.is_simulated is False
    
    with pytest.raises(RuntimeError) as exc_info:
        asyncio.run(adapter.analyze_media(b"test", "test.jpg", "image/jpeg"))
    assert "Production Vision Model is currently unavailable" in str(exc_info.value)

