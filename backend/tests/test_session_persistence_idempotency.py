"""
Automated Tests for Live Session Persistence Idempotency, Concurrency Safety,
and Legacy Historical Record Handling.
"""
import concurrent.futures
import json
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import get_db
from app.main import app
from app.models.vision_analysis import VisionAnalysisRecord
from app.services.vision.real_adapter import get_or_create_live_tracker, reset_live_tracker
from tests.conftest import engine, TestingSessionLocal


def test_repeated_save_requests_idempotent(client: TestClient, db_session: Session):
    """Verify that multiple consecutive saves for the same session ID do not create duplicate rows."""
    session_id = f"test-idem-{uuid.uuid4().hex[:10]}"

    # Populate in-memory live tracking state
    tracker = get_or_create_live_tracker(session_id)
    tracker.update_frame(
        [{"id": "d1", "box": {"x_min": 0.1, "y_min": 0.1, "x_max": 0.2, "y_max": 0.2}, "class_name": "car", "confidence": 0.90}],
        timestamp_sec=0.5,
    )

    try:
        # First save
        resp1 = client.post(
            f"/api/vision/live-session/summary?session_id={session_id}&video_filename=test_video.mp4&duration_seconds=5.0&fps_processed=3.5&processing_time_ms=120.0"
        )
        assert resp1.status_code == 200, f"First save failed: {resp1.text}"
        data1 = resp1.json()
        analysis_id_1 = data1["analysis_id"]

        # Verify 1 record in database
        records_after_first = db_session.query(VisionAnalysisRecord).filter(
            VisionAnalysisRecord.session_id == session_id
        ).all()
        assert len(records_after_first) == 1
        assert records_after_first[0].id == analysis_id_1
        assert records_after_first[0].fps_processed == 3.5
        assert records_after_first[0].processing_time_ms == 120.0

        # Second save (e.g. repeated click or extended session)
        resp2 = client.post(
            f"/api/vision/live-session/summary?session_id={session_id}&video_filename=test_video.mp4&duration_seconds=10.0&fps_processed=4.0&processing_time_ms=115.0"
        )
        assert resp2.status_code == 200, f"Second save failed: {resp2.text}"
        data2 = resp2.json()

        # Both return the same canonical analysis_id
        assert data2["analysis_id"] == analysis_id_1

        # Still exactly 1 record in database
        records_after_second = db_session.query(VisionAnalysisRecord).filter(
            VisionAnalysisRecord.session_id == session_id
        ).all()
        assert len(records_after_second) == 1
        # Metrics were updated idempotently
        assert records_after_second[0].duration_seconds == 10.0
        assert records_after_second[0].fps_processed == 4.0
        assert records_after_second[0].processing_time_ms == 115.0

    finally:
        reset_live_tracker(session_id)


def test_concurrent_saves_no_duplicates(client: TestClient, db_session: Session):
    """Verify that multiple concurrent save requests serialize cleanly and produce exactly 1 record."""
    session_id = f"test-conc-{uuid.uuid4().hex[:10]}"

    tracker = get_or_create_live_tracker(session_id)
    tracker.update_frame(
        [{"id": "d1", "box": {"x_min": 0.2, "y_min": 0.2, "x_max": 0.3, "y_max": 0.3}, "class_name": "truck", "confidence": 0.88}],
        timestamp_sec=1.0,
    )

    def do_save(thread_idx: int):
        return client.post(
            f"/api/vision/live-session/summary?session_id={session_id}&video_filename=concurrent_video.mp4&duration_seconds={5.0 + thread_idx}&fps_processed=3.8&processing_time_ms=125.0"
        )

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(do_save, i) for i in range(4)]
            responses = [f.result() for f in concurrent.futures.as_completed(futures)]

        for r in responses:
            assert r.status_code == 200, f"Concurrent save failed: {r.text}"

        analysis_ids = {r.json()["analysis_id"] for r in responses}
        assert len(analysis_ids) == 1, f"Expected 1 canonical analysis_id, got {analysis_ids}"

        records = db_session.query(VisionAnalysisRecord).filter(
            VisionAnalysisRecord.session_id == session_id
        ).all()
        assert len(records) == 1, f"Expected exactly 1 record, got {len(records)}"

    finally:
        reset_live_tracker(session_id)


def test_history_deduplication_and_legacy_flag(client: TestClient, db_session: Session):
    """Verify that historical duplicates with the same session_id are deduplicated in history, and uninstrumented records are marked is_legacy=True."""
    dup_session_id = f"live_dup_{uuid.uuid4().hex[:8]}"

    # Insert 3 historical duplicate records for the same session (simulating pre-audit legacy state)
    for i in range(3):
        rec = VisionAnalysisRecord(
            id=str(uuid.uuid4()),
            session_id=dup_session_id,
            filename="legacy_duplicate.mp4",
            media_type="live_session",
            file_size_bytes=1000,
            duration_seconds=5.0,
            frame_count_sampled=10,
            status="COMPLETED",
            adapter_name="YOLOv8n ONNX",
            is_simulated=False,
            data_source="TEST",
            total_vehicles=5,
            unique_vehicles_tracked=5,
            total_frame_detections=15,
            tracking_summary_json=json.dumps({"tracks": [{"track_id": 1, "class_name": "car"}]}),
            time_buckets_json="[]",
            events_json="[]",
            fps_processed=3.2,
            processing_time_ms=130.0,
        )
        db_session.add(rec)

    # Insert 1 legacy record without tracking metadata (session_id is None, no tracking tracks)
    legacy_rec = VisionAnalysisRecord(
        id=str(uuid.uuid4()),
        session_id=None,
        filename="legacy_uninstrumented_video.mp4",
        media_type="video",
        file_size_bytes=2000,
        duration_seconds=12.0,
        frame_count_sampled=24,
        status="COMPLETED",
        adapter_name="Simulator",
        is_simulated=True,
        data_source="TEST",
        total_vehicles=8,
        unique_vehicles_tracked=0,
        total_frame_detections=8,
        tracking_summary_json="{}",
        time_buckets_json="[]",
        events_json="[]",
        fps_processed=0.0,
        processing_time_ms=0.0,
    )
    db_session.add(legacy_rec)
    db_session.commit()

    # Query history
    hist_resp = client.get("/api/vision/history")
    assert hist_resp.status_code == 200
    items = hist_resp.json()

    # Assert that dup_session_id only appears ONCE in history list
    matching_dup_items = [it for it in items if it.get("session_id") == dup_session_id]
    assert len(matching_dup_items) == 1, f"Expected 1 deduplicated item for session, got {len(matching_dup_items)}"
    assert matching_dup_items[0]["is_legacy"] is False
    assert matching_dup_items[0]["fps_processed"] == 3.2
    assert matching_dup_items[0]["processing_time_ms"] == 130.0

    # Assert that legacy_rec is flagged is_legacy=True
    matching_legacy_items = [it for it in items if it["id"] == legacy_rec.id]
    assert len(matching_legacy_items) == 1
    assert matching_legacy_items[0]["is_legacy"] is True
    assert matching_legacy_items[0]["has_tracking"] is False
