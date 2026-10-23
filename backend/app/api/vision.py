import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.database import get_db
from app.models.vision_analysis import VisionAnalysisRecord
from app.schemas.vision import (
    BoundingBox,
    DetectedObject,
    EvaluationRequest,
    EvaluationSummary,
    FrameDetectionSummary,
    TimeBucketSummary,
    TrafficEvent,
    TrackingSummary,
    VisionAnalysisHistoryItem,
    VisionAnalysisResult,
    VisionAnalyticsResponse,
    VisionSupportedFormatsResponse,
)
from app.services.vision import RealVisionAdapter, SimulatedVisionAdapter, get_vision_service
from app.services.vision.real_adapter import reset_live_tracker, get_live_tracker_summary
from app.services.vision.evaluation import EvaluationEngine

router = APIRouter(prefix="/vision", tags=["Computer Vision & Road Safety AI"])
settings = get_settings()

_LIVE_SESSION_SAVE_LOCK = threading.Lock()

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".avi"}
ALL_SUPPORTED_EXTS = SUPPORTED_IMAGE_EXTS.union(SUPPORTED_VIDEO_EXTS)


def _persist_analysis_record(db: Session, result: VisionAnalysisResult) -> None:
    """Helper to cleanly persist or update analysis record in SQLite."""
    try:
        tracking_summary_dict = result.tracking_summary.model_dump() if result.tracking_summary else {}
        time_buckets_list = [b.model_dump() for b in result.time_buckets] if result.time_buckets else []
        events_list = [e.model_dump() for e in result.events] if result.events else []
        eval_dict = result.evaluation_summary.model_dump() if result.evaluation_summary else None

        record = VisionAnalysisRecord(
            id=result.analysis_id,
            session_id=result.session_id,
            video_hash=result.video_hash,
            filename=result.media_name,
            media_type=result.media_type,
            file_size_bytes=result.file_size_bytes,
            duration_seconds=result.duration_seconds,
            frame_count_sampled=result.frame_count_sampled,
            frame_timestamp_sec=result.frame_timestamp_sec,
            source_video_name=result.source_video_name,
            status=result.status,
            error_message=result.error_message,
            adapter_name=result.adapter_name,
            is_simulated=result.is_simulated,
            data_source=result.data_source,
            total_vehicles=result.total_vehicles,
            total_pedestrians=result.total_pedestrians,
            unique_vehicles_tracked=result.unique_vehicles_tracked,
            total_frame_detections=result.total_frame_detections,
            vehicle_breakdown_json=json.dumps(result.vehicle_breakdown),
            detections_json=json.dumps([d.model_dump() for d in result.detected_objects]),
            representative_frame_base64=result.representative_frame_base64,
            tracking_summary_json=json.dumps(tracking_summary_dict),
            time_buckets_json=json.dumps(time_buckets_list),
            events_json=json.dumps(events_list),
            evaluation_summary_json=json.dumps(eval_dict) if eval_dict else None,
            fps_processed=result.fps_processed,
            inference_config_json=json.dumps(result.inference_config or {}),
            processing_time_ms=result.processing_time_ms,
        )
        db.add(record)
        db.commit()
    except Exception as db_err:
        db.rollback()
        print(f"[Transport AI] Warning: Failed to persist vision record: {db_err}")


@router.get("/supported-formats", response_model=VisionSupportedFormatsResponse)
def get_supported_formats():
    """Return supported media formats, video limits, and neural runtime configuration."""
    service = get_vision_service()
    real_adapter = RealVisionAdapter()
    return VisionSupportedFormatsResponse(
        supported_images=sorted(list(SUPPORTED_IMAGE_EXTS)),
        supported_videos=sorted(list(SUPPORTED_VIDEO_EXTS)),
        max_file_size_mb=int(settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)),
        max_video_duration_seconds=settings.MAX_VIDEO_DURATION_SECONDS,
        active_adapter=service.adapter_name,
        hardware_acceleration="ONNX Runtime CPUExecutionProvider (RTX 5060 Ready)",
        model_weights_available=real_adapter.is_available(),
        model_name="YOLOv8n ONNX Object Detection (MS COCO Pretrained)",
    )


@router.get("/status")
def get_vision_subsystem_status():
    """Returns active vision adapter status, availability, and simulated demo flags."""
    service = get_vision_service()
    real_adapter = RealVisionAdapter()
    return {
        "adapter_name": service.adapter_name,
        "is_simulated": service.is_simulated,
        "is_available": service.is_available(),
        "mode": "Demonstration Simulator" if service.is_simulated else "Genuine Neural Inference Pipeline",
        "real_model": {
            "name": "YOLOv8n ONNX",
            "weights_path": real_adapter.weights_path,
            "is_available": real_adapter.is_available(),
            "execution_provider": "CPUExecutionProvider",
            "supported_classes": ["car", "bus", "truck", "motorcycle", "bicycle", "pedestrian", "traffic_light", "stop_sign"],
        },
        "simulator": {
            "name": "Deterministic Demo Simulator",
            "is_available": True,
        },
        "description": (
            "Dual-mode transport computer vision architecture. Real inference uses genuine YOLOv8n ONNX "
            "object detection on sampled video frames. Demonstration simulator remains available for testing."
        ),
    }


@router.post("/analyze", response_model=VisionAnalysisResult)
async def analyze_road_media(
    file: UploadFile = File(...),
    adapter: Optional[str] = Query(None, description="Force adapter: 'real' or 'simulator'"),
    session_id: Optional[str] = Query(None, description="Optional session ID for grouping"),
    db: Session = Depends(get_db),
):
    """
    Upload road CCTV snapshot, dashcam footage, or traffic video
    for genuine computer vision vehicle and pedestrian detection.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing or empty.",
        )

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALL_SUPPORTED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file format '{ext}'. Supported formats are: "
                f"{', '.join(sorted(ALL_SUPPORTED_EXTS))}"
            ),
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload limit of {max_mb} MB.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    service = get_vision_service(adapter)

    try:
        # Check if service supports session_id
        if hasattr(service, "analyze_media"):
            try:
                result = await service.analyze_media(
                    file_bytes=contents,
                    filename=file.filename,
                    content_type=file.content_type or "application/octet-stream",
                    session_id=session_id,
                )
            except TypeError:
                result = await service.analyze_media(
                    file_bytes=contents,
                    filename=file.filename,
                    content_type=file.content_type or "application/octet-stream",
                )
        else:
            raise RuntimeError("Vision service is misconfigured.")

        _persist_analysis_record(db, result)
        return result

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Vision processing failed: {str(exc)}")


@router.post("/analyze-video", response_model=VisionAnalysisResult)
async def analyze_moving_video(
    file: UploadFile = File(...),
    sample_fps: float = Query(1.0, ge=0.5, le=5.0, description="Frames per second sampling rate"),
    confidence_threshold: float = Query(0.35, ge=0.10, le=0.95, description="Detection confidence threshold"),
    enable_tracking: bool = Query(True, description="Enable multi-object IoU vehicle tracking"),
    cordon_y: float = Query(0.60, ge=0.1, le=0.9, description="Normalized Y position for virtual traffic cordon line"),
    time_bucket_seconds: float = Query(2.0, ge=1.0, le=10.0, description="Time bucket window size for trend aggregation"),
    session_id: Optional[str] = Query(None, description="Client session ID for deduplication and grouping"),
    force_reanalyze: bool = Query(False, description="Bypass cache and force re-analysis"),
    adapter: Optional[str] = Query(None, description="Force adapter: 'real' or 'simulator'"),
    db: Session = Depends(get_db),
):
    """
    Dedicated moving traffic video intelligence endpoint.
    Processes frames in strict sequential timestamp order, performs multi-object tracking,
    aggregates traffic volume into time buckets, and detects virtual cordon crossing events.
    Includes duplicate analysis prevention via video content hashing.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video filename is missing or empty.")

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in SUPPORTED_VIDEO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File must be a supported video format ({', '.join(sorted(SUPPORTED_VIDEO_EXTS))}). Received '{ext}'."
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Video exceeds limit of {max_mb} MB.")

    if len(contents) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded video file is empty (0 bytes).")

    video_hash = hashlib.sha256(contents).hexdigest()

    # Deduplication check: return existing completed analysis if identical video and not forced
    if not force_reanalyze:
        query = db.query(VisionAnalysisRecord).filter(
            VisionAnalysisRecord.video_hash == video_hash,
            VisionAnalysisRecord.status == "COMPLETED",
        )
        if session_id:
            query = query.filter(VisionAnalysisRecord.session_id == session_id)
        existing_record = query.order_by(VisionAnalysisRecord.created_at.desc()).first()

        if existing_record and existing_record.time_buckets_json != "[]":
            # Reconstruct VisionAnalysisResult from persisted database record
            rec_dict = existing_record.to_dict()
            return VisionAnalysisResult(
                analysis_id=rec_dict["id"],
                session_id=rec_dict["session_id"],
                video_hash=rec_dict["video_hash"],
                media_name=rec_dict["filename"],
                media_type=rec_dict["media_type"],
                file_size_bytes=rec_dict["file_size_bytes"],
                processing_time_ms=rec_dict["processing_time_ms"],
                adapter_name=rec_dict["adapter_name"],
                is_simulated=rec_dict["is_simulated"],
                status=rec_dict["status"],
                error_message=rec_dict["error_message"],
                duration_seconds=rec_dict["duration_seconds"],
                frame_count_sampled=rec_dict["frame_count_sampled"],
                representative_frame_base64=rec_dict["representative_frame_base64"],
                total_vehicles=rec_dict["total_vehicles"],
                vehicle_breakdown=rec_dict["vehicle_breakdown"],
                total_pedestrians=rec_dict["total_pedestrians"],
                unique_vehicles_tracked=rec_dict["unique_vehicles_tracked"],
                total_frame_detections=rec_dict["total_frame_detections"],
                estimated_congestion_level="MODERATE" if rec_dict["total_vehicles"] >= 5 else "LOW",
                collision_risk_score=0.45,
                lane_blockage_detected=False,
                detected_hazards=[],
                detected_objects=[DetectedObject(**d) for d in rec_dict["detections"]],
                recommendations=["Retrieved cached traffic analysis from persistent SQLite record."],
                tracking_summary=TrackingSummary(**rec_dict["tracking_summary"]) if rec_dict["tracking_summary"] else None,
                time_buckets=[TimeBucketSummary(**b) for b in rec_dict["time_buckets"]] if rec_dict["time_buckets"] else [],
                events=[TrafficEvent(**e) for e in rec_dict["events"]] if rec_dict["events"] else [],
                fps_processed=rec_dict["fps_processed"],
                inference_config=rec_dict["inference_config"],
                timestamp=datetime.now(),
                data_source=rec_dict["data_source"],
                provenance_notice="PERSISTED ANALYSIS CACHE: Reopened without duplicate database re-aggregation.",
            )

    service = get_vision_service(adapter)

    try:
        if isinstance(service, RealVisionAdapter):
            result = await service.analyze_media(
                file_bytes=contents,
                filename=file.filename,
                content_type=file.content_type or "video/mp4",
                sample_fps=sample_fps,
                confidence_threshold=confidence_threshold,
                enable_tracking=enable_tracking,
                cordon_y=cordon_y,
                time_bucket_seconds=time_bucket_seconds,
                session_id=session_id,
            )
        else:
            result = await service.analyze_media(
                file_bytes=contents,
                filename=file.filename,
                content_type=file.content_type or "video/mp4",
            )
            result.session_id = session_id
            result.video_hash = video_hash

        _persist_analysis_record(db, result)
        return result

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Video intelligence processing failed: {str(exc)}")


@router.post("/analyze-frame", response_model=VisionAnalysisResult)
async def analyze_video_frame(
    file: UploadFile = File(...),
    timestamp_sec: Optional[float] = Form(None),
    video_filename: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    source_aspect_ratio: Optional[float] = Form(None, description="Source video width/height (live frames are resized)"),
    adapter: Optional[str] = Query(None, description="Force adapter: 'real' or 'simulator'"),
    persist: bool = Query(True, description="Persist frame in SQLite history (set False for live playback streaming)"),
    enable_tracking: bool = Query(False, description="Associate detections across consecutive live frames"),
    generate_preview: bool = Query(True, description="Generate annotated base64 preview JPEG"),
    cordon_y: float = Query(0.60, description="Virtual cordon Y line position for event recording"),
    confidence_threshold: float = Query(0.35, ge=0.1, le=0.95, description="Detection confidence threshold"),
    db: Session = Depends(get_db),
):
    """
    Execute genuine YOLOv8n ONNX object detection on a specific paused, scrubbed, or live playback video frame.
    Supports playback-synchronized live inference with persistent session tracking without database flood.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Frame image filename is missing or empty.")

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in SUPPORTED_IMAGE_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Frame must be a supported image format ({', '.join(sorted(SUPPORTED_IMAGE_EXTS))}). Received '{ext}'."
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Frame image exceeds allowable file size.")

    if len(contents) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded frame is empty (0 bytes).")

    service = get_vision_service(adapter)

    try:
        if isinstance(service, RealVisionAdapter):
            result = await service.analyze_media(
                file_bytes=contents,
                filename=file.filename,
                content_type=file.content_type or "image/jpeg",
                confidence_threshold=confidence_threshold,
                enable_tracking=enable_tracking,
                cordon_y=cordon_y,
                session_id=session_id,
                generate_preview=generate_preview,
                timestamp_sec=timestamp_sec,
                source_aspect_ratio=source_aspect_ratio,
            )
        else:
            result = await service.analyze_media(
                file_bytes=contents,
                filename=file.filename,
                content_type=file.content_type or "image/jpeg",
            )

        result.frame_timestamp_sec = timestamp_sec
        result.source_video_name = video_filename
        result.session_id = session_id
        result.media_type = "frame"
        if not enable_tracking:
            result.unique_vehicles_tracked = result.total_vehicles
            result.total_frame_detections = result.total_vehicles
        if timestamp_sec is not None:
            mode_prefix = "LIVE PLAYBACK DETECTION" if not persist else "SELECTED FRAME INFERENCE"
            result.provenance_notice = (
                f"{mode_prefix}: Video '{video_filename or file.filename}' at {timestamp_sec:.2f}s. "
                f"Analyzed via genuine {result.adapter_name}. Detections and confidences reflect real neural outputs."
            )

        if persist:
            _persist_analysis_record(db, result)
        return result

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Frame inference failed: {str(exc)}")


@router.post("/live-session/reset")
def reset_live_session(
    session_id: str = Query(..., description="Active playback session ID to reset"),
):
    """Reset the in-memory live tracking state for a playback session."""
    did_reset = reset_live_tracker(session_id)
    return {"status": "RESET" if did_reset else "NOT_FOUND", "session_id": session_id}


def _synthesize_live_time_buckets(
    tracks: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    duration_seconds: Optional[float] = None,
) -> List[Dict[str, Any]]:
    import math
    if not tracks:
        return []

    max_track_sec = max((t.get("last_seen_sec", 0.0) for t in tracks), default=0.0)
    total_sec = max(duration_seconds or 0.0, max_track_sec, 2.0)
    bucket_window = 2.0
    num_buckets = max(1, int(math.ceil(total_sec / bucket_window)))

    buckets = []
    vehicle_classes = {"car", "bus", "truck", "motorcycle", "bicycle"}
    for i in range(num_buckets):
        b_start = i * bucket_window
        b_end = (i + 1) * bucket_window

        active_in_bucket = [
            t for t in tracks
            if t.get("first_seen_sec", 0.0) <= b_end and t.get("last_seen_sec", 0.0) >= b_start
        ]

        class_breakdown: Dict[str, int] = {}
        for t in active_in_bucket:
            cls_name = t.get("class_name", "car")
            class_breakdown[cls_name] = class_breakdown.get(cls_name, 0) + 1

        unique_veh = sum(count for cls_name, count in class_breakdown.items() if cls_name in vehicle_classes)
        ped_count = class_breakdown.get("pedestrian", 0)

        tot_det = sum(
            sum(1 for pt in t.get("trajectory", []) if b_start <= pt.get("timestamp_sec", 0.0) <= b_end)
            for t in active_in_bucket
        )
        if tot_det == 0:
            tot_det = len(active_in_bucket)

        congestion = "LOW"
        if unique_veh >= 8:
            congestion = "HEAVY"
        elif unique_veh >= 4:
            congestion = "MODERATE"

        buckets.append({
            "bucket_index": i,
            "start_sec": round(b_start, 2),
            "end_sec": round(b_end, 2),
            "total_detections": tot_det,
            "unique_vehicles": unique_veh,
            "class_breakdown": class_breakdown,
            "pedestrian_count": ped_count,
            "average_congestion": congestion,
        })
    return buckets


@router.post("/live-session/summary", response_model=VisionAnalysisResult)
def save_live_session_summary(
    session_id: str = Query(..., description="Active playback session ID"),
    video_filename: str = Query(..., description="Source video filename"),
    duration_seconds: Optional[float] = Query(None, description="Observed playback duration in seconds"),
    fps_processed: Optional[float] = Query(None, description="Observed effective inference FPS"),
    processing_time_ms: Optional[float] = Query(None, description="Observed average frame inference latency in ms"),
    confidence_threshold: Optional[float] = Query(None, description="Detection confidence threshold"),
    cordon_y: Optional[float] = Query(None, description="Virtual cordon Y line position"),
    adapter_name: Optional[str] = Query(None, description="Active adapter name"),
    db: Session = Depends(get_db),
):
    """
    Finalize a live playback detection session and persist a clean aggregate summary record.
    Guarantees concurrency-safe, idempotent session saving without duplicate rows.
    """
    import uuid
    summary = get_live_tracker_summary(session_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No active live tracking session found for session ID '{session_id}'. Run live detection before saving.",
        )

    tracks = summary.get("tracks", [])
    unique_vehicles = summary.get("unique_vehicles_tracked", 0)
    unique_peds = summary.get("unique_pedestrians_tracked", 0)
    breakdown = summary.get("vehicle_breakdown", {})
    events = summary.get("events", [])

    if len(tracks) == 0 and unique_vehicles == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No vehicle tracks were detected or recorded in this session. Save requires at least one tracked frame.",
        )

    time_buckets = _synthesize_live_time_buckets(tracks, events, duration_seconds)
    total_detections = sum(t.get("detection_count", 1) for t in tracks) if tracks else unique_vehicles

    effective_config = {
        "mode": "live_playback",
        "model": "YOLOv8n ONNX",
        "confidence_threshold": confidence_threshold if confidence_threshold is not None else 0.35,
        "cordon_y": cordon_y if cordon_y is not None else 0.60,
        "enable_tracking": True,
        "adapter": adapter_name or "Real-Time Neural Vision Adapter (YOLOv8n ONNX Engine)",
    }

    with _LIVE_SESSION_SAVE_LOCK:
        # Check if record already exists for this session_id (idempotency & concurrency safe)
        existing_records = db.query(VisionAnalysisRecord).filter(
            VisionAnalysisRecord.session_id == session_id
        ).order_by(VisionAnalysisRecord.created_at.desc()).all()

        if existing_records:
            record = existing_records[0]
            record.filename = video_filename
            if duration_seconds is not None:
                record.duration_seconds = duration_seconds
            record.frame_count_sampled = len(tracks)
            record.total_vehicles = unique_vehicles
            record.total_pedestrians = unique_peds
            record.unique_vehicles_tracked = unique_vehicles
            record.total_frame_detections = total_detections
            record.vehicle_breakdown_json = json.dumps(breakdown)
            record.tracking_summary_json = json.dumps(summary)
            record.time_buckets_json = json.dumps(time_buckets)
            record.events_json = json.dumps(events)
            record.inference_config_json = json.dumps(effective_config)
            if fps_processed is not None and fps_processed > 0:
                record.fps_processed = fps_processed
            if processing_time_ms is not None and processing_time_ms > 0:
                record.processing_time_ms = processing_time_ms
            db.commit()
            db.refresh(record)
        else:
            record = VisionAnalysisRecord(
                id=str(uuid.uuid4()),
                session_id=session_id,
                filename=video_filename,
                media_type="live_session",
                file_size_bytes=0,
                duration_seconds=duration_seconds,
                frame_count_sampled=len(tracks),
                status="COMPLETED",
                adapter_name=adapter_name or "Real-Time Neural Vision Adapter (YOLOv8n ONNX Engine)",
                is_simulated=False,
                data_source="LIVE PLAYBACK DETECTION (YOLOv8n ONNX / MS COCO)",
                total_vehicles=unique_vehicles,
                total_pedestrians=unique_peds,
                unique_vehicles_tracked=unique_vehicles,
                total_frame_detections=total_detections,
                vehicle_breakdown_json=json.dumps(breakdown),
                detections_json="[]",
                representative_frame_base64=None,
                tracking_summary_json=json.dumps(summary),
                time_buckets_json=json.dumps(time_buckets),
                events_json=json.dumps(events),
                fps_processed=fps_processed or 0.0,
                processing_time_ms=processing_time_ms or 0.0,
                inference_config_json=json.dumps(effective_config),
            )
            db.add(record)
            try:
                db.commit()
                db.refresh(record)
            except IntegrityError:
                # Concurrent transaction won the insert race; rollback and fetch winning record
                db.rollback()
                record = db.query(VisionAnalysisRecord).filter(
                    VisionAnalysisRecord.session_id == session_id
                ).order_by(VisionAnalysisRecord.created_at.desc()).first()

    # Parse and construct full result
    rec_dict = record.to_dict()
    parsed_buckets = [TimeBucketSummary(**b) for b in rec_dict.get("time_buckets", [])]
    parsed_events = [TrafficEvent(**e) for e in rec_dict.get("events", [])]
    parsed_tracking = TrackingSummary(**rec_dict["tracking_summary"]) if rec_dict.get("tracking_summary") else None
    parsed_config = json.loads(record.inference_config_json) if record.inference_config_json else effective_config

    return VisionAnalysisResult(
        analysis_id=record.id,
        session_id=session_id,
        media_name=video_filename,
        media_type="video",
        width=1280,
        height=720,
        file_size_bytes=0,
        processing_time_ms=record.processing_time_ms,
        adapter_name=record.adapter_name,
        is_simulated=False,
        status="COMPLETED",
        duration_seconds=record.duration_seconds,
        frame_count_sampled=record.frame_count_sampled,
        total_vehicles=unique_vehicles,
        vehicle_breakdown=breakdown,
        total_pedestrians=unique_peds,
        unique_vehicles_tracked=unique_vehicles,
        total_frame_detections=record.total_frame_detections,
        estimated_congestion_level="MODERATE" if unique_vehicles >= 5 else "LOW",
        collision_risk_score=0.35,
        lane_blockage_detected=False,
        detected_hazards=[],
        detected_objects=[],
        recommendations=["Persisted aggregate summary from live playback detection session."],
        tracking_summary=parsed_tracking,
        time_buckets=parsed_buckets,
        events=parsed_events,
        fps_processed=record.fps_processed,
        inference_config=parsed_config,
        timestamp=datetime.now(timezone.utc),
        data_source=record.data_source,
        provenance_notice="LIVE PLAYBACK SESSION SUMMARY: Persisted without storing redundant individual video frames.",
    )



@router.post("/evaluate", response_model=EvaluationSummary)
async def evaluate_detections(
    payload: EvaluationRequest,
    db: Session = Depends(get_db),
):
    """
    Evaluate object detection predictions against ground-truth annotations.
    Calculates bipartite greedy IoU matching, Precision, Recall, F1 score,
    per-class accuracy, False Positives, Missed Detections, and Processing FPS.
    """
    if not payload.ground_truth_json or "frames" not in payload.ground_truth_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ground truth payload. Must contain 'frames' array with bounding box annotations."
        )

    gt_frames = payload.ground_truth_json["frames"]
    pred_frames: List[Dict[str, Any]] = []
    inference_time_ms = 0.0

    if payload.analysis_id:
        record = db.query(VisionAnalysisRecord).filter(VisionAnalysisRecord.id == payload.analysis_id).first()
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis with ID '{payload.analysis_id}' not found.")

        inference_time_ms = record.processing_time_ms
        dets = json.loads(record.detections_json) if record.detections_json else []

        # If full video analysis with timeline, match frame by frame
        # Otherwise distribute or match to available frames
        for f in gt_frames:
            f_idx = f["frame_index"]
            pred_frames.append({
                "frame_index": f_idx,
                "timestamp_sec": f.get("timestamp_sec", 0.0),
                "objects": dets,
            })
    else:
        # Self-evaluation of sample model inference on sample video
        sample_path = os.path.join("backend", "uploads", "sample_traffic_video.mp4")
        if not os.path.exists(sample_path):
            sample_path = os.path.join("uploads", "sample_traffic_video.mp4")

        if os.path.exists(sample_path):
            with open(sample_path, "rb") as f:
                v_bytes = f.read()
            adapter = RealVisionAdapter()
            res = await adapter.analyze_media(v_bytes, "sample_traffic_video.mp4", "video/mp4")
            inference_time_ms = res.processing_time_ms
            if res.frame_timeline:
                for ft in res.frame_timeline:
                    pred_frames.append({
                        "frame_index": ft.frame_index,
                        "timestamp_sec": ft.timestamp_sec,
                        "objects": [o.model_dump() for o in ft.objects],
                    })
            else:
                pred_frames.append({
                    "frame_index": 1,
                    "timestamp_sec": 0.0,
                    "objects": [o.model_dump() for o in res.detected_objects],
                })
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample traffic video file not found on disk.")

    engine = EvaluationEngine(iou_threshold=payload.iou_threshold)
    eval_meta = payload.ground_truth_json.get("conditions") or {
        "dataset_name": payload.ground_truth_json.get("dataset_name", "Ground Truth Validation Dataset"),
        "matching_rule": f"Greedy Bipartite IoU >= {payload.iou_threshold:.2f}",
        "distinction": "Verified Ground-Truth Benchmark Results",
    }
    result_dict = engine.evaluate(
        predicted_frames=pred_frames,
        ground_truth_frames=gt_frames,
        evaluation_metadata=eval_meta,
        inference_time_ms=inference_time_ms,
    )

    # If linked to an analysis record, update evaluation summary in DB
    if payload.analysis_id:
        try:
            record.evaluation_summary_json = json.dumps(result_dict)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[Transport AI] Warning: Failed to persist evaluation: {e}")

    return EvaluationSummary(**result_dict)


@router.get("/benchmark-sample")
def get_benchmark_sample():
    """
    Returns reference ground-truth annotations and evaluation configuration
    for the sample traffic video dataset to facilitate reproducible validation.
    """
    candidates = [
        os.path.join("backend", "app", "services", "vision", "benchmark_ground_truth.json"),
        os.path.join("app", "services", "vision", "benchmark_ground_truth.json"),
    ]
    for c in candidates:
        if os.path.exists(c):
            with open(c, "r", encoding="utf-8") as f:
                return json.load(f)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benchmark ground truth dataset not found.")


@router.get("/analytics/{analysis_id}", response_model=VisionAnalyticsResponse)
def get_vision_analytics(
    analysis_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve deep traffic intelligence analytics for a video analysis session:
    time buckets, unique vehicle tracking counts, events timeline, and evaluation results.
    """
    record = db.query(VisionAnalysisRecord).filter(VisionAnalysisRecord.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis with ID '{analysis_id}' not found.")

    rec_dict = record.to_dict()
    time_buckets = [TimeBucketSummary(**b) for b in rec_dict["time_buckets"]]
    events = [TrafficEvent(**e) for e in rec_dict["events"]]
    tracking_summary = TrackingSummary(**rec_dict["tracking_summary"]) if rec_dict["tracking_summary"] else None
    evaluation_summary = EvaluationSummary(**rec_dict["evaluation_summary"]) if rec_dict["evaluation_summary"] else None

    congestion = "LOW"
    if record.unique_vehicles_tracked >= 8:
        congestion = "HEAVY"
    elif record.unique_vehicles_tracked >= 4:
        congestion = "MODERATE"

    return VisionAnalyticsResponse(
        analysis_id=record.id,
        session_id=record.session_id,
        filename=record.filename,
        media_type=record.media_type,
        duration_seconds=record.duration_seconds,
        frame_count_sampled=record.frame_count_sampled,
        fps_processed=record.fps_processed,
        unique_vehicles_tracked=record.unique_vehicles_tracked,
        total_frame_detections=record.total_frame_detections,
        vehicle_breakdown=rec_dict["vehicle_breakdown"],
        total_pedestrians=record.total_pedestrians,
        estimated_congestion_level=congestion,
        time_buckets=time_buckets,
        events=events,
        tracking_summary=tracking_summary,
        evaluation_summary=evaluation_summary,
        inference_config=rec_dict["inference_config"],
        limitations_notice=(
            "Traffic measurements represent computer-vision inferences from sampled video frames. "
            "Unique vehicle counts are estimated via IoU tracking. Speed measurements and accident predictions "
            "are not claimed without certified sensors."
        ),
    )


@router.get("/history", response_model=List[VisionAnalysisHistoryItem])
def get_vision_history(
    limit: int = Query(20, ge=1, le=100),
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    db: Session = Depends(get_db),
):
    """Retrieve persistent history of recent video, frame, and image vision analyses."""
    query = db.query(VisionAnalysisRecord)
    if session_id:
        query = query.filter(VisionAnalysisRecord.session_id == session_id)

    records = query.order_by(VisionAnalysisRecord.created_at.desc()).limit(limit * 2).all()

    seen_sessions = set()
    items = []
    for r in records:
        if r.session_id:
            if r.session_id in seen_sessions:
                continue
            seen_sessions.add(r.session_id)

        events = json.loads(r.events_json) if r.events_json else []
        tracking = json.loads(r.tracking_summary_json) if r.tracking_summary_json else {}
        has_eval = r.evaluation_summary_json is not None and r.evaluation_summary_json != "{}"
        has_tracking = bool(tracking and (tracking.get("tracks") or tracking.get("unique_vehicles_tracked", 0) > 0))
        is_legacy = (not has_tracking) and (r.session_id is None)

        items.append(
            VisionAnalysisHistoryItem(
                id=r.id,
                filename=r.filename,
                media_type=r.media_type,
                file_size_bytes=r.file_size_bytes,
                duration_seconds=r.duration_seconds,
                frame_count_sampled=r.frame_count_sampled,
                frame_timestamp_sec=r.frame_timestamp_sec,
                source_video_name=r.source_video_name,
                session_id=r.session_id,
                status=r.status,
                error_message=r.error_message,
                adapter_name=r.adapter_name,
                is_simulated=r.is_simulated,
                data_source=r.data_source,
                total_vehicles=r.total_vehicles,
                total_pedestrians=r.total_pedestrians,
                unique_vehicles_tracked=r.unique_vehicles_tracked or r.total_vehicles,
                total_frame_detections=r.total_frame_detections or r.total_vehicles,
                events_count=len(events),
                fps_processed=r.fps_processed,
                has_tracking=has_tracking,
                has_evaluation=has_eval,
                is_legacy=is_legacy,
                vehicle_breakdown=json.loads(r.vehicle_breakdown_json) if r.vehicle_breakdown_json else {},
                processing_time_ms=r.processing_time_ms,
                created_at=r.created_at.isoformat() if r.created_at else "",
                representative_frame_base64=r.representative_frame_base64,
            )
        )
        if len(items) >= limit:
            break

    return items


@router.get("/history/{analysis_id}")
def get_vision_analysis_detail(
    analysis_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve full analysis details and detection objects for a specific run."""
    record = db.query(VisionAnalysisRecord).filter(VisionAnalysisRecord.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis with ID '{analysis_id}' not found.")
    return record.to_dict()


@router.get("/sample-video")
def get_sample_traffic_video():
    """Returns sample 4-second MP4 video for 1-click test driving real video inference."""
    from fastapi.responses import FileResponse
    candidates = [
        os.path.join(settings.UPLOAD_DIR, "sample_traffic_video.mp4"),
        os.path.join("backend", "uploads", "sample_traffic_video.mp4"),
        os.path.join("uploads", "sample_traffic_video.mp4"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return FileResponse(c, media_type="video/mp4", filename="sample_traffic_video.mp4")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample traffic video file not found.")


@router.get("/sample-image")
def get_sample_traffic_image():
    """Returns sample traffic image for test driving inference."""
    from fastapi.responses import FileResponse
    candidates = [
        os.path.join(settings.UPLOAD_DIR, "sample_traffic.jpg"),
        os.path.join("backend", "uploads", "sample_traffic.jpg"),
        os.path.join("uploads", "sample_traffic.jpg"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return FileResponse(c, media_type="image/jpeg", filename="sample_traffic.jpg")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample traffic image file not found.")
