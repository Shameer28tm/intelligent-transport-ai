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

export interface VisionAnalysisResult {
  analysis_id: string;
  media_name: string;
  media_type: 'image' | 'video';
  width: number;
  height: number;
  file_size_bytes: number;
  processing_time_ms: number;
  adapter_name: string;
  is_simulated: boolean;
  status: 'COMPLETED' | 'FAILED';
  total_vehicles: number;
  vehicle_breakdown: Record<string, number>;
  total_pedestrians: number;
  estimated_congestion_level: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  collision_risk_score: number;
  lane_blockage_detected: boolean;
  detected_hazards: string[];
  detected_objects: DetectedObject[];
  recommendations: string[];
  timestamp: string;
  provenance_notice: string;
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
  };
  storage: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
  };
  hardware_detection: {
    gpu_detected: string;
    cuda_driver_ready: boolean;
    phase: string;
  };
  notice: string;
}

export type AppModule =
  | 'overview'
  | 'safety'
  | 'traffic'
  | 'explorer'
  | 'planning'
  | 'sustainability'
  | 'accessibility'
  | 'settings';
