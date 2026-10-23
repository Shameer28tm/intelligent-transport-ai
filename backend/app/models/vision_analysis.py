import json
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VisionAnalysisRecord(Base):
    __tablename__ = "vision_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    filename = Column(String(255), nullable=False)
    media_type = Column(String(50), nullable=False)  # "image", "video", "frame"
    file_size_bytes = Column(Integer, nullable=False)
    duration_seconds = Column(Float, nullable=True)
    frame_count_sampled = Column(Integer, default=1, nullable=False)
    frame_timestamp_sec = Column(Float, nullable=True)
    source_video_name = Column(String(255), nullable=True)
    
    # Session, Hash & Deduplication
    session_id = Column(String(36), nullable=True, index=True)
    video_hash = Column(String(64), nullable=True, index=True)
    
    # Execution & provenance
    status = Column(String(30), default="COMPLETED", nullable=False, index=True)  # COMPLETED, FAILED, PROCESSING
    error_message = Column(Text, nullable=True)
    adapter_name = Column(String(150), nullable=False)
    is_simulated = Column(Boolean, default=False, nullable=False, index=True)
    data_source = Column(String(150), nullable=False)
    
    # Traffic metrics (Differentiated)
    total_vehicles = Column(Integer, default=0, nullable=False)
    total_pedestrians = Column(Integer, default=0, nullable=False)
    unique_vehicles_tracked = Column(Integer, default=0, nullable=False)
    total_frame_detections = Column(Integer, default=0, nullable=False)
    vehicle_breakdown_json = Column(Text, default="{}", nullable=False)  # JSON-encoded dict
    
    # Detailed detection timeline and representative preview
    detections_json = Column(Text, default="[]", nullable=False)  # JSON-encoded detections
    representative_frame_base64 = Column(Text, nullable=True)  # Base64-encoded annotated JPEG
    
    # P3 Advanced Traffic Intelligence & Validation
    tracking_summary_json = Column(Text, default="{}", nullable=False)
    time_buckets_json = Column(Text, default="[]", nullable=False)
    events_json = Column(Text, default="[]", nullable=False)
    evaluation_summary_json = Column(Text, nullable=True)
    fps_processed = Column(Float, default=0.0, nullable=False)
    inference_config_json = Column(Text, default="{}", nullable=False)
    
    processing_time_ms = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "media_type": self.media_type,
            "file_size_bytes": self.file_size_bytes,
            "duration_seconds": self.duration_seconds,
            "frame_count_sampled": self.frame_count_sampled,
            "frame_timestamp_sec": self.frame_timestamp_sec,
            "source_video_name": self.source_video_name,
            "session_id": self.session_id,
            "video_hash": self.video_hash,
            "status": self.status,
            "error_message": self.error_message,
            "adapter_name": self.adapter_name,
            "is_simulated": self.is_simulated,
            "data_source": self.data_source,
            "total_vehicles": self.total_vehicles,
            "total_pedestrians": self.total_pedestrians,
            "unique_vehicles_tracked": self.unique_vehicles_tracked,
            "total_frame_detections": self.total_frame_detections,
            "vehicle_breakdown": json.loads(self.vehicle_breakdown_json) if self.vehicle_breakdown_json else {},
            "detections": json.loads(self.detections_json) if self.detections_json else [],
            "representative_frame_base64": self.representative_frame_base64,
            "tracking_summary": json.loads(self.tracking_summary_json) if self.tracking_summary_json else {},
            "time_buckets": json.loads(self.time_buckets_json) if self.time_buckets_json else [],
            "events": json.loads(self.events_json) if self.events_json else [],
            "evaluation_summary": json.loads(self.evaluation_summary_json) if self.evaluation_summary_json else None,
            "fps_processed": self.fps_processed,
            "inference_config": json.loads(self.inference_config_json) if self.inference_config_json else {},
            "processing_time_ms": self.processing_time_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
