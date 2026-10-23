from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x_min: float = Field(..., ge=0.0, le=1.0, description="Normalized X min (0.0 to 1.0)")
    y_min: float = Field(..., ge=0.0, le=1.0, description="Normalized Y min (0.0 to 1.0)")
    x_max: float = Field(..., ge=0.0, le=1.0, description="Normalized X max (0.0 to 1.0)")
    y_max: float = Field(..., ge=0.0, le=1.0, description="Normalized Y max (0.0 to 1.0)")


class DetectedObject(BaseModel):
    id: str
    class_name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    box: BoundingBox
    track_id: Optional[int] = None
    speed_estimate_kmh: Optional[float] = None
    hazard_flag: bool = False


class FrameDetectionSummary(BaseModel):
    frame_index: int
    timestamp_sec: float
    vehicle_count: int
    pedestrian_count: int
    objects: List[DetectedObject] = []


class TrafficEvent(BaseModel):
    event_id: str
    track_id: int
    class_name: str
    event_type: str  # CORDON_CROSSING, ZONE_ENTRY, ZONE_EXIT
    timestamp_sec: float
    direction: Optional[str] = None  # SOUTHBOUND, NORTHBOUND
    confidence: Optional[float] = None
    cordon_y: Optional[float] = None


class TimeBucketSummary(BaseModel):
    bucket_index: int
    start_sec: float
    end_sec: float
    total_detections: int
    unique_vehicles: int
    class_breakdown: Dict[str, int] = {}
    pedestrian_count: int = 0
    average_congestion: str = "LOW"


class TrackTrajectoryPoint(BaseModel):
    x: float
    y: float
    timestamp_sec: float


class TrackedVehicleItem(BaseModel):
    track_id: int
    class_name: str
    first_seen_sec: float
    last_seen_sec: float
    duration_sec: float
    detection_count: int
    trajectory: List[TrackTrajectoryPoint] = []
    last_box: Optional[BoundingBox] = None


class TrackingSummary(BaseModel):
    unique_vehicles_tracked: int = 0
    unique_pedestrians_tracked: int = 0
    vehicle_breakdown: Dict[str, int] = {}
    total_tracks_assigned: int = 0
    tracks: List[TrackedVehicleItem] = []
    events: List[TrafficEvent] = []
    tracking_algorithm: str = "Sequential IoU Tracker"
    # Traffic Premonition candidate events (image-plane risk estimates, never confirmed incidents)
    risk_events: List[Dict[str, Any]] = []
    limitations_notice: str = (
        "Tracking identities are scoped to the current video analysis session. "
        "Track IDs may reset after occlusion or vehicle re-entry."
    )


class ClassEvaluationMetrics(BaseModel):
    ground_truth_count: int
    predicted_count: int
    true_positives: int
    false_positives: int
    missed_detections: int
    precision: float
    recall: float
    f1_score: float
    mean_iou: float


class EvaluationPerformance(BaseModel):
    total_inference_time_ms: float
    avg_frame_latency_ms: float
    effective_processing_fps: float


class EvaluationSummary(BaseModel):
    status: str = "EVALUATED_AGAINST_GROUND_TRUTH"
    iou_threshold: float = 0.50
    evaluated_frames_count: int = 0
    total_ground_truth_objects: int = 0
    total_predicted_objects: int = 0
    true_positives: int = 0
    false_positives: int = 0
    missed_detections: int = 0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    mean_iou: float = 0.0
    class_metrics: Dict[str, ClassEvaluationMetrics] = {}
    performance: Optional[EvaluationPerformance] = None
    evaluation_conditions: Dict[str, Any] = {}


class VisionAnalysisResult(BaseModel):
    analysis_id: str
    media_name: str
    media_type: str  # "image", "video", "frame"
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: int
    processing_time_ms: float
    adapter_name: str
    is_simulated: bool
    status: str  # "COMPLETED", "FAILED"
    error_message: Optional[str] = None
    
    # Session & Deduplication
    session_id: Optional[str] = None
    video_hash: Optional[str] = None
    
    # Video-specific metadata
    duration_seconds: Optional[float] = None
    frame_count_sampled: int = 1
    frame_timestamp_sec: Optional[float] = None
    source_video_name: Optional[str] = None
    representative_frame_base64: Optional[str] = None
    frame_timeline: Optional[List[FrameDetectionSummary]] = None
    
    # Traffic & Safety metrics (Differentiated)
    total_vehicles: int
    vehicle_breakdown: Dict[str, int]
    total_pedestrians: int
    unique_vehicles_tracked: int = 0
    total_frame_detections: int = 0
    estimated_congestion_level: str  # "LOW", "MODERATE", "HEAVY", "SEVERE"
    collision_risk_score: float = Field(..., ge=0.0, le=1.0)
    lane_blockage_detected: bool
    detected_hazards: List[str]
    
    # P3 Advanced Traffic Intelligence & Validation
    tracking_summary: Optional[TrackingSummary] = None
    time_buckets: Optional[List[TimeBucketSummary]] = None
    events: Optional[List[TrafficEvent]] = None
    evaluation_summary: Optional[EvaluationSummary] = None
    fps_processed: float = 0.0
    inference_config: Optional[Dict[str, Any]] = None

    # Traffic Premonition: deterministic trajectory risk estimate for live tracked frames.
    # Image-plane units (fraction of frame height); not a probability and not an incident record.
    premonition: Optional[Dict[str, Any]] = None
    
    detected_objects: List[DetectedObject]
    recommendations: List[str]
    timestamp: datetime
    data_source: str = "GENUINE PRETRAINED MODEL INFERENCE"
    provenance_notice: str = "Analysis generated by extensible AI Vision Service layer."


class VisionSupportedFormatsResponse(BaseModel):
    supported_images: List[str] = [".jpg", ".jpeg", ".png", ".webp"]
    supported_videos: List[str] = [".mp4", ".mov", ".webm", ".avi"]
    max_file_size_mb: int = 50
    max_video_duration_seconds: float = 60.0
    active_adapter: str
    hardware_acceleration: str
    model_weights_available: bool = False
    model_name: str = "YOLOv8n ONNX Object Detection (MS COCO)"


class VisionAnalysisHistoryItem(BaseModel):
    id: str
    filename: str
    media_type: str
    file_size_bytes: int
    duration_seconds: Optional[float] = None
    frame_count_sampled: int
    frame_timestamp_sec: Optional[float] = None
    source_video_name: Optional[str] = None
    session_id: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    adapter_name: str
    is_simulated: bool
    data_source: str
    total_vehicles: int
    total_pedestrians: int
    unique_vehicles_tracked: int = 0
    total_frame_detections: int = 0
    events_count: int = 0
    fps_processed: float = 0.0
    has_tracking: bool = False
    has_evaluation: bool = False
    is_legacy: bool = False
    vehicle_breakdown: Dict[str, int]
    processing_time_ms: float
    created_at: str
    representative_frame_base64: Optional[str] = None


class VisionAnalyticsResponse(BaseModel):
    analysis_id: str
    session_id: Optional[str] = None
    filename: str
    media_type: str
    duration_seconds: Optional[float] = None
    frame_count_sampled: int
    fps_processed: float
    unique_vehicles_tracked: int
    total_frame_detections: int
    vehicle_breakdown: Dict[str, int]
    total_pedestrians: int
    estimated_congestion_level: str
    time_buckets: List[TimeBucketSummary]
    events: List[TrafficEvent]
    tracking_summary: Optional[TrackingSummary] = None
    evaluation_summary: Optional[EvaluationSummary] = None
    inference_config: Dict[str, Any] = {}
    limitations_notice: str


class EvaluationRequest(BaseModel):
    analysis_id: Optional[str] = None
    ground_truth_json: Dict[str, Any]
    iou_threshold: float = 0.50
