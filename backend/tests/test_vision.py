import io
import os
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
    assert "YOLOv8n" in data["model_name"]


def test_vision_status(client):
    response = client.get("/api/vision/status")
    assert response.status_code == 200
    data = response.json()
    assert data["is_simulated"] is True
    assert "Deterministic Demo Simulator" in data["adapter_name"]
    assert "real_model" in data
    assert data["real_model"]["name"] == "YOLOv8n ONNX"


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


def test_real_vision_adapter_image_inference(client):
    sample_img_path = os.path.join("backend", "uploads", "sample_traffic.jpg")
    if not os.path.exists(sample_img_path):
        sample_img_path = os.path.join("uploads", "sample_traffic.jpg")
    
    if os.path.exists(sample_img_path):
        with open(sample_img_path, "rb") as f:
            img_bytes = f.read()
        
        files = {"file": ("sample_traffic.jpg", img_bytes, "image/jpeg")}
        response = client.post("/api/vision/analyze?adapter=real", files=files)
        assert response.status_code == 200
        result = response.json()
        
        assert result["status"] == "COMPLETED"
        assert result["is_simulated"] is False
        assert "YOLOv8n" in result["adapter_name"]
        assert result["total_vehicles"] >= 1  # Bus detected
        assert result["total_pedestrians"] >= 1  # Pedestrians detected
        assert result["representative_frame_base64"] is not None
        assert result["representative_frame_base64"].startswith("data:image/jpeg;base64,")
        assert "GENUINE MODEL INFERENCE" in result["data_source"]


def test_real_vision_adapter_video_inference(client):
    sample_video_path = os.path.join("backend", "uploads", "sample_traffic_video.mp4")
    if not os.path.exists(sample_video_path):
        sample_video_path = os.path.join("uploads", "sample_traffic_video.mp4")

    if os.path.exists(sample_video_path):
        with open(sample_video_path, "rb") as f:
            video_bytes = f.read()

        files = {"file": ("sample_traffic_video.mp4", video_bytes, "video/mp4")}
        response = client.post("/api/vision/analyze?adapter=real", files=files)
        assert response.status_code == 200
        result = response.json()

        assert result["status"] == "COMPLETED"
        assert result["is_simulated"] is False
        assert result["media_type"] == "video"
        assert result["duration_seconds"] is not None
        assert result["frame_count_sampled"] >= 1
        assert result["representative_frame_base64"] is not None
        assert len(result["detected_objects"]) >= 1
        assert result["total_vehicles"] >= 1
        assert result["total_pedestrians"] >= 1


def test_vision_persistence_and_history(client):
    # Ensure at least one analysis exists
    img_bytes = create_test_image_bytes(640, 480)
    files = {"file": ("persistence_test.jpg", img_bytes, "image/jpeg")}
    post_res = client.post("/api/vision/analyze?adapter=simulator", files=files)
    assert post_res.status_code == 200
    analysis_id = post_res.json()["analysis_id"]

    # Query history
    history_res = client.get("/api/vision/history?limit=10")
    assert history_res.status_code == 200
    history_items = history_res.json()
    assert isinstance(history_items, list)
    assert len(history_items) > 0
    assert any(item["id"] == analysis_id for item in history_items)

    # Query detail
    detail_res = client.get(f"/api/vision/history/{analysis_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == analysis_id
    assert detail["filename"] == "persistence_test.jpg"


def test_vision_analyze_frame_endpoint(client):
    """Test selected-frame inference endpoint with timestamp and source video tracking."""
    img_bytes = create_test_image_bytes(640, 480)
    files = {"file": ("frame_capture_0024.jpg", img_bytes, "image/jpeg")}
    data = {
        "timestamp_sec": "2.40",
        "video_filename": "traffic_corridor_cam01.mp4",
    }
    response = client.post("/api/vision/analyze-frame?adapter=simulator", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "COMPLETED"
    assert res["media_type"] == "frame"
    assert res["frame_timestamp_sec"] == 2.40
    assert res["source_video_name"] == "traffic_corridor_cam01.mp4"
    assert res["representative_frame_base64"] is not None
    assert "SELECTED FRAME INFERENCE" in res["provenance_notice"]


def test_video_analysis_fails_gracefully_when_ffmpeg_missing(client, monkeypatch):
    """P0.1: If FFmpeg is missing/blocked, return HTTP 503, never fabricate frames or save fake records."""
    import subprocess

    initial_history = client.get("/api/vision/history").json()
    initial_count = len(initial_history)

    sample_video_path = os.path.join("backend", "uploads", "sample_traffic_video.mp4")
    if not os.path.exists(sample_video_path):
        sample_video_path = os.path.join("uploads", "sample_traffic_video.mp4")

    if not os.path.exists(sample_video_path):
        return

    with open(sample_video_path, "rb") as f:
        video_bytes = f.read()

    orig_run = subprocess.run

    def mock_subprocess_run(cmd, *args, **kwargs):
        if isinstance(cmd, (list, tuple)) and len(cmd) > 0 and cmd[0] == "ffmpeg":
            raise FileNotFoundError("ffmpeg not found on PATH")
        return orig_run(cmd, *args, **kwargs)

    monkeypatch.setattr(subprocess, "run", mock_subprocess_run)

    files = {"file": ("ffmpeg_fail_test.mp4", video_bytes, "video/mp4")}
    response = client.post("/api/vision/analyze-video?adapter=real&force_reanalyze=true", files=files)

    # Must fail with 503 Service Unavailable, not 200 OK
    assert response.status_code == 503
    res_data = response.json()
    detail = res_data.get("detail") or res_data.get("error") or ""
    assert "ffmpeg" in detail.lower()

    # History count must NOT increase (no misleading successful record persisted)
    post_history = client.get("/api/vision/history").json()
    assert len(post_history) == initial_count


def test_video_analysis_fails_gracefully_when_ffprobe_missing(client, monkeypatch):
    """P0.1: If ffprobe fails/missing, return HTTP 503, never fabricate 3.0s/1280x720."""
    import subprocess

    initial_history = client.get("/api/vision/history").json()
    initial_count = len(initial_history)

    sample_video_path = os.path.join("backend", "uploads", "sample_traffic_video.mp4")
    if not os.path.exists(sample_video_path):
        sample_video_path = os.path.join("uploads", "sample_traffic_video.mp4")

    if not os.path.exists(sample_video_path):
        return

    with open(sample_video_path, "rb") as f:
        video_bytes = f.read()

    orig_run = subprocess.run

    def mock_subprocess_run(cmd, *args, **kwargs):
        if isinstance(cmd, (list, tuple)) and len(cmd) > 0 and cmd[0] == "ffprobe":
            raise FileNotFoundError("ffprobe not found on PATH")
        return orig_run(cmd, *args, **kwargs)

    monkeypatch.setattr(subprocess, "run", mock_subprocess_run)

    files = {"file": ("ffprobe_fail_test.mp4", video_bytes, "video/mp4")}
    response = client.post("/api/vision/analyze-video?adapter=real&force_reanalyze=true", files=files)

    assert response.status_code == 503
    res_data = response.json()
    detail = res_data.get("detail") or res_data.get("error") or ""
    assert "ffprobe" in detail.lower()

    post_history = client.get("/api/vision/history").json()
    assert len(post_history) == initial_count
