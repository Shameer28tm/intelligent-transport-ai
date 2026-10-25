export type IncidentCategory =
  | 'ACCIDENT'
  | 'CONGESTION'
  | 'ROADWORK'
  | 'HAZARD'
  | 'VEHICLE_BREAKDOWN'
  | 'PEDESTRIAN_CROSSING_RISK'
  | 'WEATHER_EVENT';

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentStatus = 'REPORTED' | 'VERIFIED' | 'DISPATCHED' | 'RESOLVED';

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  location_name: string;
  corridor: string | null;
  speed_limit_kmh: number | null;
  current_speed_kmh: number | null;
  congestion_level_pct: number;
  affected_lanes: number;
  tags: string[];
  is_simulated: boolean;
  data_source: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface PaginatedIncidentsResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  is_simulated_notice: string;
}

export interface HourlyTrend {
  timestamp: string;
  hour: string;
  incident_count: number;
  congestion_pct: number;
  average_speed_kmh: number;
}

export interface IncidentStatistics {
  total_incidents: number;
  active_incidents: number;
  critical_incidents: number;
  high_priority_incidents: number;
  average_congestion_pct: number;
  monitored_corridors_count: number;
  severity_breakdown: Record<IncidentSeverity, number>;
  category_breakdown: Record<IncidentCategory, number>;
  status_breakdown: Record<IncidentStatus, number>;
  hourly_trends: HourlyTrend[];
  simulated_data_tag: string;
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface DetectedObject {
  id: string;
  class_name: string;
  confidence: number;
  box: BoundingBox;
  track_id?: number;
  speed_estimate_kmh?: number;
  hazard_flag: boolean;
}

export interface FrameDetectionSummary {
  frame_index: number;
  timestamp_sec: number;
  vehicle_count: number;
  pedestrian_count: number;
  objects?: DetectedObject[];
}

export interface TrafficEvent {
  event_id: string;
  track_id: number;
  class_name: string;
  event_type: string;
  timestamp_sec: number;
  direction?: string;
  confidence?: number;
  cordon_y?: number;
}

export interface TimeBucketSummary {
  bucket_index: number;
  start_sec: number;
  end_sec: number;
  total_detections: number;
  unique_vehicles: number;
  class_breakdown: Record<string, number>;
  pedestrian_count: number;
  average_congestion: string;
}

export interface TrackTrajectoryPoint {
  x: number;
  y: number;
  timestamp_sec: number;
}

export interface TrackedVehicleItem {
  track_id: number;
  class_name: string;
  first_seen_sec: number;
  last_seen_sec: number;
  duration_sec: number;
  detection_count: number;
  trajectory: TrackTrajectoryPoint[];
  last_box?: BoundingBox;
}

export interface TrackingSummary {
  unique_vehicles_tracked: number;
  unique_pedestrians_tracked: number;
  vehicle_breakdown: Record<string, number>;
  total_tracks_assigned: number;
  tracks: TrackedVehicleItem[];
  events: TrafficEvent[];
  tracking_algorithm: string;
  limitations_notice: string;
  risk_events?: PremonitionEvent[];
  rider_safety_events?: RiderSafetyEvent[];
}

// ==========================================
// Traffic Premonition (trajectory risk estimate)
// Distances are image-plane "fh" units (fraction of frame height), not metres.
// ==========================================
export type PremonitionState =
  | 'MONITORING'
  | 'POTENTIAL_CONFLICT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_CONFLICT_DETECTED';

export type PremonitionDataQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface PremonitionPathPoint {
  x: number;
  y: number;
  timestamp_sec: number;
}

export interface PremonitionTrack {
  track_id: number;
  class_name: string | null;
  data_quality: PremonitionDataQuality;
  quality_reasons: string[];
  observation_count: number;
  observed_span_sec: number;
  fit_rms_fh: number | null;
  mean_detection_confidence: number | null;
  velocity_fh_per_s: { vx: number; vy: number } | null;
  observed_path: PremonitionPathPoint[];
  projected_path: PremonitionPathPoint[];
}

export interface PremonitionMeasurements {
  current_separation_fh: number;
  closest_projected_separation_fh: number;
  separation_threshold_fh: number;
  time_to_closest_approach_sec: number | null;
  closing_speed_fh_per_s: number;
  relative_speed_fh_per_s: number;
  projected_gap_reduction_fh: number;
  heading_difference_deg: number | null;
  interaction_geometry: string;
  horizon_sec: number;
}

export interface PremonitionPair {
  track_ids: [number, number];
  class_names: (string | null)[];
  state: PremonitionState;
  reasons: string[];
  measurements: PremonitionMeasurements;
}

export interface PremonitionEvent {
  event_id: string;
  track_ids: [number, number];
  class_names: (string | null)[];
  first_detected_sec: number;
  last_detected_sec: number;
  status: 'ACTIVE' | 'CLOSED' | 'INTERRUPTED';
  update_count: number;
  kind: string;
  is_prediction: true;
  peak: {
    timestamp_sec: number;
    measurements: PremonitionMeasurements;
    reasons: string[];
    tracks: PremonitionTrack[];
  };
}

export interface PremonitionResult {
  engine: string;
  state: PremonitionState;
  reasons: string[];
  reason_text: Record<string, string>;
  timestamp_sec: number | null;
  units: Record<string, string>;
  pairs_evaluated: number;
  pairs_pruned: number;
  pairs: PremonitionPair[];
  tracks: PremonitionTrack[];
  active_event_ids: string[];
  events: PremonitionEvent[];
  config: Record<string, number>;
  limitations: string[];
  is_prediction: true;
}

export interface ClassEvaluationMetrics {
  ground_truth_count: number;
  predicted_count: number;
  true_positives: number;
  false_positives: number;
  missed_detections: number;
  precision: number;
  recall: number;
  f1_score: number;
  mean_iou: number;
}

export interface EvaluationPerformance {
  total_inference_time_ms: number;
  avg_frame_latency_ms: number;
  effective_processing_fps: number;
}

export interface EvaluationSummary {
  status: string;
  iou_threshold: number;
  evaluated_frames_count: number;
  total_ground_truth_objects: number;
  total_predicted_objects: number;
  true_positives: number;
  false_positives: number;
  missed_detections: number;
  precision: number;
  recall: number;
  f1_score: number;
  mean_iou: number;
  class_metrics: Record<string, ClassEvaluationMetrics>;
  performance?: EvaluationPerformance;
  evaluation_conditions: Record<string, any>;
}

export interface VisionAnalysisResult {
  analysis_id: string;
  media_name: string;
  media_type: 'image' | 'video' | 'frame';
  width: number;
  height: number;
  file_size_bytes: number;
  processing_time_ms: number;
  adapter_name: string;
  is_simulated: boolean;
  status: 'COMPLETED' | 'FAILED';
  error_message?: string | null;
  session_id?: string | null;
  video_hash?: string | null;
  duration_seconds?: number | null;
  frame_count_sampled?: number;
  frame_timestamp_sec?: number | null;
  source_video_name?: string | null;
  representative_frame_base64?: string | null;
  frame_timeline?: FrameDetectionSummary[] | null;
  total_vehicles: number;
  vehicle_breakdown: Record<string, number>;
  total_pedestrians: number;
  unique_vehicles_tracked: number;
  total_frame_detections: number;
  estimated_congestion_level: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  collision_risk_score: number;
  lane_blockage_detected: boolean;
  detected_hazards: string[];
  detected_objects: DetectedObject[];
  tracking_summary?: TrackingSummary | null;
  time_buckets?: TimeBucketSummary[] | null;
  events?: TrafficEvent[] | null;
  evaluation_summary?: EvaluationSummary | null;
  fps_processed?: number;
  inference_config?: Record<string, any>;
  premonition?: PremonitionResult | null;
  rider_safety?: RiderSafetyResult | null;
  recommendations: string[];
  timestamp: string;
  data_source?: string;
  provenance_notice: string;
}

export interface VisionAnalysisHistoryItem {
  id: string;
  filename: string;
  media_type: string;
  file_size_bytes: number;
  duration_seconds?: number | null;
  frame_count_sampled: number;
  frame_timestamp_sec?: number | null;
  source_video_name?: string | null;
  session_id?: string | null;
  status: string;
  error_message?: string | null;
  adapter_name: string;
  is_simulated: boolean;
  data_source: string;
  total_vehicles: number;
  total_pedestrians: number;
  unique_vehicles_tracked: number;
  total_frame_detections: number;
  events_count: number;
  fps_processed: number;
  has_tracking: boolean;
  has_evaluation: boolean;
  is_legacy?: boolean;
  vehicle_breakdown: Record<string, number>;
  processing_time_ms: number;
  created_at: string;
  representative_frame_base64?: string | null;
}

export interface VisionAnalyticsResponse {
  analysis_id: string;
  session_id?: string | null;
  filename: string;
  media_type: string;
  duration_seconds?: number | null;
  frame_count_sampled: number;
  fps_processed: number;
  unique_vehicles_tracked: number;
  total_frame_detections: number;
  vehicle_breakdown: Record<string, number>;
  total_pedestrians: number;
  estimated_congestion_level: string;
  time_buckets: TimeBucketSummary[];
  events: TrafficEvent[];
  tracking_summary?: TrackingSummary | null;
  evaluation_summary?: EvaluationSummary | null;
  inference_config: Record<string, any>;
  limitations_notice: string;
}

export interface EvaluationRequest {
  analysis_id?: string;
  ground_truth_json: Record<string, any>;
  iou_threshold?: number;
}

export interface VisionSubsystemStatus {
  adapter_name: string;
  is_simulated: boolean;
  is_available: boolean;
  mode: string;
  real_model?: {
    name: string;
    weights_path: string;
    is_available: boolean;
    execution_provider: string;
    supported_classes: string[];
  };
  simulator?: {
    name: string;
    is_available: boolean;
  };
  description: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'offline';
  service: string;
  version: string;
  timestamp: string;
  database: {
    status: string;
    latency_ms: number;
    engine: string;
  };
  vision_subsystem: {
    active_adapter: string;
    is_simulated: boolean;
    is_available: boolean;
    execution_provider?: string;
    available_providers?: string[];
  };
  storage: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  hardware_detection: {
    gpu_detected: string;
    host_gpu?: string;
    inference_runtime?: string;
    execution_provider?: string;
    cuda_driver_ready: boolean;
    phase: string;
  };
  notice: string;
}

export interface MapplsStatus {
  provider: string;
  status: 'OPERATIONAL' | 'AUTH_FAILED' | 'NOT_CONFIGURED' | 'SERVICE_UNAVAILABLE';
  is_configured: boolean;
  is_operational: boolean;
  client_id_present: boolean;
  client_secret_present: boolean;
  rest_key_present: boolean;
  masked_client_id: string;
  http_status_code: number | null;
  diagnostic_message: string;
  entitled_capabilities: string[];
  fallback_active: boolean;
  fallback_provider: string;
  attribution: string;
}

export interface MapplsGeocodeItem {
  formatted_address: string;
  latitude: number;
  longitude: number;
  place_id?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface MapplsGeocodeResponse {
  success: boolean;
  provider: string;
  query?: string;
  results_count?: number;
  results: MapplsGeocodeItem[];
  http_status_code?: number;
  error?: string;
  attribution?: string;
  fallback_active?: boolean;
}

export interface MapplsRouteResponse {
  success: boolean;
  provider: string;
  distance_meters?: number;
  duration_seconds?: number;
  geometry?: any;
  http_status_code?: number;
  error?: string;
  attribution?: string;
  fallback_active?: boolean;
}

export interface TomTomStatus {
  provider: string;
  status: 'OPERATIONAL' | 'AUTH_FAILED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'NOT_CONFIGURED' | 'NETWORK_ERROR' | string;
  http_status_code?: number;
  is_operational: boolean;
  is_configured: boolean;
  masked_key: string;
  fallback_active: boolean;
  error?: string | null;
  products_available: {
    traffic_flow: boolean;
    traffic_incidents: boolean;
  };
  attribution: string;
  data_source: string;
  timestamp: string;
}

export interface TomTomFlowResponse {
  success: boolean;
  provider: string;
  current_speed_kmh?: number;
  free_flow_speed_kmh?: number;
  current_travel_time_sec?: number;
  free_flow_travel_time_sec?: number;
  congestion_pct?: number;
  confidence?: number;
  road_closure?: boolean;
  functional_road_class?: string;
  coordinates?: { latitude: number; longitude: number }[];
  retrieval_time?: string;
  attribution?: string;
  data_source?: string;
  error?: string;
  http_status_code?: number;
  fallback_active?: boolean;
}

export interface TomTomIncidentsResponse {
  success: boolean;
  provider: string;
  count: number;
  incidents: Incident[];
  bbox?: [number, number, number, number];
  attribution?: string;
  data_source?: string;
  retrieval_time?: string;
  error?: string;
  http_status_code?: number;
  fallback_active?: boolean;
}

export type AppModule =
  | 'overview'
  | 'map'
  | 'traffic-intelligence'
  | 'safety'
  | 'traffic'
  | 'explorer'
  | 'planning'
  | 'sustainability'
  | 'accessibility'
  | 'emergency'
  | 'settings';

// ==========================================
// Tamil Nadu Road Safety (computed from stored incidents; reference data carries provenance)
// ==========================================
export interface SafetyDistrictRow {
  district: string;
  total: number;
  crashes: number;
  serious: number;
}

export interface SafetySummary {
  total_incidents: number;
  simulated_incidents: number;
  by_district: SafetyDistrictRow[];
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_hour_ist: number[];
  tagged_two_wheeler: number;
  tagged_no_helmet: number;
  pedestrian_related: number;
  generated_at: string;
  district_note: string;
}

export interface SafetyHotspot {
  rank: number;
  latitude: number;
  longitude: number;
  radius_m: number;
  district: string | null;
  incident_count: number;
  serious_count: number;
  severity_score: number;
  meets_black_corridor_rule: boolean;
  location_names: string[];
  top_tags: string[];
  incident_ids: string[];
  is_simulated: boolean;
}

export interface SafetyHotspotsResponse {
  radius_m: number;
  min_incidents: number;
  days: number | null;
  count: number;
  hotspots: SafetyHotspot[];
  method: string;
  district_note: string;
}

export interface TraumaFacility {
  name: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  straight_line_km: number;
}

export interface FacilitiesResponse {
  origin: { lat: number; lng: number };
  facilities: TraumaFacility[];
  distance_type: 'straight_line';
  note: string;
  helplines: { number: string; label: string }[];
}

export interface TnContext {
  statewide_2024: {
    road_accidents: number;
    road_deaths: number;
    deaths_without_helmet: number;
    national_rank_accidents: number;
    national_rank_deaths: number;
    source: string;
    source_url: string;
  };
  black_corridors: {
    definition: string;
    top_tn_locations: { location: string; corridors: number; national_rank?: number }[];
    source: string;
    source_url: string;
  };
  golden_hour_scheme: { name: string; summary: string; launched: string; source: string; source_url: string };
  helplines: { number: string; label: string }[];
}

// Rider Safety (rule-based candidates from live tracked frames; always needs human review)
export interface RiderSafetyEvent {
  event_id: string;
  kind: 'TRIPLE_RIDING' | 'WRONG_SIDE';
  track_id: number;
  class_name: string | null;
  first_detected_sec: number;
  last_detected_sec: number;
  status: 'NEEDS_REVIEW';
  is_observation_candidate: true;
  update_count: number;
  evidence: Record<string, any>;
  reasons: string[];
  status_note?: string;
}

export interface RiderSafetyResult {
  engine: string;
  timestamp_sec: number | null;
  note: string | null;
  motorcycles_in_frame: number;
  riders_matched: number;
  triple_riding_now: { track_id: number; rider_count: number }[];
  wrong_side_now: { track_id: number; direction_cosine: number }[];
  wrong_side_enabled: boolean;
  permitted_direction: string | null;
  helmet_detection: 'NOT_AVAILABLE';
  events: RiderSafetyEvent[];
  active_event_ids: string[];
  limitations: string[];
}

// ==========================================
// Multilingual Voice Assistant Types
// ==========================================
export interface VoiceAction {
  type: 'navigate_to_page' | 'focus_map_location' | 'select_incident' | 'apply_supported_filter' | string;
  action_type?: string;
  payload: Record<string, any>;
}

export interface VoiceAssistantResponse {
  transcript: string;
  response_text: string;
  detected_language: string;
  audio_base64: string | null;
  audio_mime_type: string | null;
  action: VoiceAction | null;
  tool_invoked: string | null;
  data_grounded: boolean;
}

export interface VoiceStatusResponse {
  sarvam_configured: boolean;
  gemini_configured: boolean;
  stt_model: string;
  tts_model: string;
  tts_speaker: string;
  gemini_model: string;
  supported_languages: string[];
  supported_actions: string[];
}

