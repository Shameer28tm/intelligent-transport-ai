import os
import json
import pytest
from app.services.vision.tracker import IoUTracker, box_iou
from app.services.vision.evaluation import EvaluationEngine
from app.services.vision.real_adapter import RealVisionAdapter, get_or_create_live_tracker


def test_box_iou_calculation():
    # Identical boxes
    box_a = {"x_min": 0.1, "y_min": 0.1, "x_max": 0.5, "y_max": 0.5}
    box_b = {"x_min": 0.1, "y_min": 0.1, "x_max": 0.5, "y_max": 0.5}
    assert box_iou(box_a, box_b) == 1.0

    # Disjoint boxes
    box_c = {"x_min": 0.6, "y_min": 0.6, "x_max": 0.9, "y_max": 0.9}
    assert box_iou(box_a, box_c) == 0.0

    # Partial overlap (half width)
    box_d = {"x_min": 0.3, "y_min": 0.1, "x_max": 0.5, "y_max": 0.5}
    iou = box_iou(box_a, box_d)
    assert 0.45 <= iou <= 0.55


def test_iou_tracker_association_and_cordon_crossing():
    tracker = IoUTracker(iou_threshold=0.3, max_lost=2, cordon_y=0.50)

    # Frame 1: Vehicle above cordon (y < 0.50)
    frame1_dets = [
        {
            "id": "det-1",
            "class_name": "car",
            "confidence": 0.90,
            "box": {"x_min": 0.2, "y_min": 0.3, "x_max": 0.4, "y_max": 0.45},
        }
    ]
    f1_res = tracker.update_frame(frame1_dets, timestamp_sec=0.0)
    assert len(f1_res) == 1
    track_id_1 = f1_res[0]["track_id"]
    assert track_id_1 == 1
    assert len(tracker.events) == 0  # Not crossed yet

    # Frame 2: Same vehicle moves downwards crossing cordon_y (0.50)
    frame2_dets = [
        {
            "id": "det-2",
            "class_name": "car",
            "confidence": 0.92,
            "box": {"x_min": 0.20, "y_min": 0.42, "x_max": 0.40, "y_max": 0.58},
        }
    ]
    f2_res = tracker.update_frame(frame2_dets, timestamp_sec=1.0)
    assert len(f2_res) == 1
    # Should maintain the same track_id
    assert f2_res[0]["track_id"] == track_id_1
    # Should generate a cordon crossing event
    assert len(tracker.events) == 1
    event = tracker.events[0]
    assert event["event_type"] == "CORDON_CROSSING"
    assert event["direction"] == "SOUTHBOUND"
    assert event["track_id"] == track_id_1

    # Finalize tracker
    tracker.finalize()
    summary = tracker.get_summary()
    assert summary["unique_vehicles_tracked"] == 1
    assert summary["vehicle_breakdown"]["car"] == 1
    assert len(summary["events"]) == 1


def test_evaluation_engine_metrics():
    engine = EvaluationEngine(iou_threshold=0.50)

    ground_truth = [
        {
            "frame_index": 1,
            "timestamp_sec": 0.0,
            "objects": [
                {"class_name": "car", "box": {"x_min": 0.1, "y_min": 0.1, "x_max": 0.3, "y_max": 0.3}},
                {"class_name": "bus", "box": {"x_min": 0.4, "y_min": 0.4, "x_max": 0.8, "y_max": 0.8}},
            ],
        }
    ]

    # Predictions: 1 true positive car, 1 false positive truck, 1 missed bus (FN)
    predictions = [
        {
            "frame_index": 1,
            "timestamp_sec": 0.0,
            "objects": [
                {"class_name": "car", "box": {"x_min": 0.11, "y_min": 0.11, "x_max": 0.31, "y_max": 0.31}},
                {"class_name": "truck", "box": {"x_min": 0.0, "y_min": 0.0, "x_max": 0.1, "y_max": 0.1}},
            ],
        }
    ]

    res = engine.evaluate(predicted_frames=predictions, ground_truth_frames=ground_truth)
    assert res["status"] == "EVALUATED_AGAINST_GROUND_TRUTH"
    assert res["total_ground_truth_objects"] == 2
    assert res["total_predicted_objects"] == 2
    assert res["true_positives"] == 1   # matched car
    assert res["false_positives"] == 1  # spurious truck
    assert res["missed_detections"] == 1 # missed bus
    assert res["precision"] == 0.50     # 1 / (1 + 1)
    assert res["recall"] == 0.50        # 1 / (1 + 1)
    assert res["f1_score"] == 0.50


def test_benchmark_sample_endpoint(client):
    res = client.get("/api/vision/benchmark-sample")
    assert res.status_code == 200
    data = res.json()
    assert "frames" in data
    assert len(data["frames"]) >= 1
    assert "conditions" in data


def test_analyze_video_endpoint_with_tracking(client):
    sample_video_path = os.path.join("backend", "uploads", "sample_traffic_video.mp4")
    if not os.path.exists(sample_video_path):
        sample_video_path = os.path.join("uploads", "sample_traffic_video.mp4")

    if os.path.exists(sample_video_path):
        with open(sample_video_path, "rb") as f:
            v_bytes = f.read()

        files = {"file": ("sample_traffic_video.mp4", v_bytes, "video/mp4")}
        res = client.post(
            "/api/vision/analyze-video?sample_fps=1.0&enable_tracking=true&time_bucket_seconds=2.0&adapter=real",
            files=files,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "COMPLETED"
        assert data["media_type"] == "video"
        assert data["unique_vehicles_tracked"] >= 1
        assert data["total_frame_detections"] >= 1
        assert data["time_buckets"] is not None
        assert len(data["time_buckets"]) >= 1
        assert data["tracking_summary"] is not None
        assert data["fps_processed"] > 0.0

        analysis_id = data["analysis_id"]

        # Test deduplication: identical upload without force_reanalyze returns cached result
        files_cached = {"file": ("sample_traffic_video.mp4", v_bytes, "video/mp4")}
        res_cached = client.post(
            "/api/vision/analyze-video?sample_fps=1.0&enable_tracking=true&time_bucket_seconds=2.0&adapter=real",
            files=files_cached,
        )
        assert res_cached.status_code == 200
        cached_data = res_cached.json()
        assert cached_data["analysis_id"] == analysis_id

        # Test analytics endpoint
        analytics_res = client.get(f"/api/vision/analytics/{analysis_id}")
        assert analytics_res.status_code == 200
        an_data = analytics_res.json()
        assert an_data["analysis_id"] == analysis_id
        assert len(an_data["time_buckets"]) >= 1


def test_evaluate_endpoint_with_ground_truth(client):
    # Fetch sample ground-truth
    bench_res = client.get("/api/vision/benchmark-sample")
    assert bench_res.status_code == 200
    gt_data = bench_res.json()

    # Post evaluation request
    payload = {
        "ground_truth_json": gt_data,
        "iou_threshold": 0.50,
    }
    eval_res = client.post("/api/vision/evaluate", json=payload)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["status"] == "EVALUATED_AGAINST_GROUND_TRUTH"
    assert eval_data["evaluated_frames_count"] >= 1
    assert 0.0 <= eval_data["precision"] <= 1.0
    assert 0.0 <= eval_data["recall"] <= 1.0
    assert 0.0 <= eval_data["f1_score"] <= 1.0
    assert "class_metrics" in eval_data
    assert eval_data["performance"]["effective_processing_fps"] > 0.0


def test_analyze_frame_live_mode_no_persist(client):
    """Verify live-frame streaming with persist=false does not flood the history database."""
    img_path = os.path.join("backend", "uploads", "sample_traffic.jpg")
    if not os.path.exists(img_path):
        img_path = os.path.join("uploads", "sample_traffic.jpg")

    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        initial_history = client.get("/api/vision/history").json()
        initial_count = len(initial_history)

        files = {"file": ("frame_test.jpg", img_bytes, "image/jpeg")}
        data = {"timestamp_sec": "1.25", "session_id": "live-test-session-1"}
        res = client.post(
            "/api/vision/analyze-frame?persist=false&generate_preview=false&adapter=real",
            files=files,
            data=data,
        )
        assert res.status_code == 200
        res_json = res.json()
        assert res_json["status"] == "COMPLETED"
        assert res_json["representative_frame_base64"] is None  # preview skipped for speed
        assert res_json["frame_timestamp_sec"] == 1.25

        # Confirm history count has NOT increased
        post_history = client.get("/api/vision/history").json()
        assert len(post_history) == initial_count


def test_analyze_frame_live_tracking_continuity_and_reset(client):
    """Verify session-scoped live tracking assigns track IDs across frames and resets cleanly."""
    img_path = os.path.join("backend", "uploads", "sample_traffic.jpg")
    if not os.path.exists(img_path):
        img_path = os.path.join("uploads", "sample_traffic.jpg")

    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        session_id = "test-live-track-seq-42"

        # Frame 1 at 0.0s
        files1 = {"file": ("frame_0.jpg", img_bytes, "image/jpeg")}
        res1 = client.post(
            f"/api/vision/analyze-frame?persist=false&enable_tracking=true&adapter=real",
            files=files1,
            data={"timestamp_sec": "0.0", "session_id": session_id},
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert len(data1["detected_objects"]) >= 1
        first_track_id = data1["detected_objects"][0].get("track_id")
        assert first_track_id is not None

        # Frame 2 at 0.5s with same session_id: should maintain track IDs
        files2 = {"file": ("frame_1.jpg", img_bytes, "image/jpeg")}
        res2 = client.post(
            f"/api/vision/analyze-frame?persist=false&enable_tracking=true&adapter=real",
            files=files2,
            data={"timestamp_sec": "0.5", "session_id": session_id},
        )
        assert res2.status_code == 200
        data2 = res2.json()
        second_track_id = data2["detected_objects"][0].get("track_id")
        assert second_track_id == first_track_id  # Track continuity verified!

        # Save summary of the live session to history
        summary_res = client.post(
            f"/api/vision/live-session/summary?session_id={session_id}&video_filename=sample_traffic_video.mp4&duration_seconds=5.0&fps_processed=4.8"
        )
        assert summary_res.status_code == 200
        summary_data = summary_res.json()
        assert summary_data["session_id"] == session_id
        assert summary_data["unique_vehicles_tracked"] >= 1

        # Reset session
        reset_res = client.post(f"/api/vision/live-session/reset?session_id={session_id}")
        assert reset_res.status_code == 200
        assert reset_res.json()["status"] == "RESET"


def test_live_session_summary_save_end_to_end_and_error_handling(client):
    """
    Test Save End-to-End:
    1. Rejects unknown/empty sessions with 400 (prevents false success).
    2. Runs tracked live frames and saves summary successfully with time buckets.
    3. Idempotently updates existing record without duplicate DB row creation.
    4. Confirms record is retrievable via /api/vision/history and /api/vision/history/{id}.
    """
    import uuid
    # 1. Failure handling: unknown session returns 400 Bad Request
    bad_res = client.post(
        "/api/vision/live-session/summary?session_id=nonexistent_session_id_9999&video_filename=test.mp4"
    )
    assert bad_res.status_code == 400
    res_json = bad_res.json()
    err_msg = res_json.get("error") or res_json.get("detail", "")
    assert "No active live tracking session found" in err_msg

    # 2. Setup session with tracked frames
    img_path = os.path.join("backend", "uploads", "sample_traffic.jpg")
    if not os.path.exists(img_path):
        img_path = os.path.join("uploads", "sample_traffic.jpg")

    session_id = f"test_save_{uuid.uuid4().hex[:8]}"

    if os.path.exists(img_path) and RealVisionAdapter().is_available():
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        # Send frame 1
        res1 = client.post(
            "/api/vision/analyze-frame?persist=false&enable_tracking=true&adapter=real",
            files={"file": ("frame1.jpg", img_bytes, "image/jpeg")},
            data={"timestamp_sec": "1.0", "session_id": session_id},
        )
        assert res1.status_code == 200

        # Send frame 2
        res2 = client.post(
            "/api/vision/analyze-frame?persist=false&enable_tracking=true&adapter=real",
            files={"file": ("frame2.jpg", img_bytes, "image/jpeg")},
            data={"timestamp_sec": "2.5", "session_id": session_id},
        )
        assert res2.status_code == 200
    else:
        # Graceful fallback for CI environments where untracked model weights/sample videos are omitted
        tracker = get_or_create_live_tracker(session_id)
        tracker.update_frame(
            [{"id": "d1", "box": {"x_min": 0.1, "y_min": 0.1, "x_max": 0.2, "y_max": 0.2}, "class_name": "car", "confidence": 0.90}],
            timestamp_sec=1.0,
        )
        tracker.update_frame(
            [{"id": "d1", "box": {"x_min": 0.12, "y_min": 0.12, "x_max": 0.22, "y_max": 0.22}, "class_name": "car", "confidence": 0.92}],
            timestamp_sec=2.5,
        )

    # Save session summary
    save_res1 = client.post(
        f"/api/vision/live-session/summary?session_id={session_id}&video_filename=sample_traffic_video.mp4&duration_seconds=3.0&fps_processed=3.6"
    )
    assert save_res1.status_code == 200
    save_data1 = save_res1.json()
    analysis_id = save_data1["analysis_id"]
    assert save_data1["session_id"] == session_id
    assert save_data1["duration_seconds"] == 3.0
    assert save_data1["fps_processed"] == 3.6

    # 3. Idempotency: saving again for the same session updates existing record without duplicate
    save_res2 = client.post(
        f"/api/vision/live-session/summary?session_id={session_id}&video_filename=sample_traffic_video.mp4&duration_seconds=4.0&fps_processed=4.0"
    )
    assert save_res2.status_code == 200
    save_data2 = save_res2.json()
    assert save_data2["analysis_id"] == analysis_id  # Same database record updated!
    assert save_data2["duration_seconds"] == 4.0

    # 4. Confirm in History
    hist_res = client.get(f"/api/vision/history?session_id={session_id}")
    assert hist_res.status_code == 200
    hist_items = hist_res.json()
    assert len(hist_items) == 1
    assert hist_items[0]["id"] == analysis_id
    assert hist_items[0]["duration_seconds"] == 4.0
    assert hist_items[0]["fps_processed"] == 4.0

    # 5. Confirm Detail endpoint returns synthesized time buckets
    detail_res = client.get(f"/api/vision/history/{analysis_id}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["id"] == analysis_id
    assert len(detail_data["time_buckets"]) >= 1
    assert detail_data["time_buckets"][0]["bucket_index"] == 0

    # Clean up session
    client.post(f"/api/vision/live-session/reset?session_id={session_id}")


