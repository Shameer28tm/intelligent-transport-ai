import {
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentStatistics,
  PaginatedIncidentsResponse,
  SystemHealth,
  VisionAnalysisResult,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface IncidentFilterOptions {
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  search?: string;
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
  corridor?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export const api = {
  async getHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status: ${res.status}`);
    }
    return res.json();
  },

  async getIncidents(options: IncidentFilterOptions = {}): Promise<PaginatedIncidentsResponse> {
    const query = new URLSearchParams();
    if (options.category) query.append('category', options.category);
    if (options.severity) query.append('severity', options.severity);
    if (options.status) query.append('status', options.status);
    if (options.search) query.append('search', options.search);
    if (options.min_lat !== undefined) query.append('min_lat', options.min_lat.toString());
    if (options.max_lat !== undefined) query.append('max_lat', options.max_lat.toString());
    if (options.min_lng !== undefined) query.append('min_lng', options.min_lng.toString());
    if (options.max_lng !== undefined) query.append('max_lng', options.max_lng.toString());
    if (options.corridor) query.append('corridor', options.corridor);
    if (options.sort_by) query.append('sort_by', options.sort_by);
    if (options.sort_order) query.append('sort_order', options.sort_order);
    if (options.page) query.append('page', options.page.toString());
    if (options.page_size) query.append('page_size', options.page_size.toString());

    const url = `${API_BASE}/incidents${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch incidents: ${res.statusText}`);
    }
    return res.json();
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch incident ${id}`);
    }
    return res.json();
  },

  async createIncident(incidentData: {
    title: string;
    description?: string;
    category: IncidentCategory;
    severity: IncidentSeverity;
    latitude: number;
    longitude: number;
    location_name: string;
    corridor?: string;
    speed_limit_kmh?: number;
    current_speed_kmh?: number;
    congestion_level_pct?: number;
    affected_lanes?: number;
    tags?: string[];
  }): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...incidentData,
        is_simulated: true,
        data_source: 'SIMULATED DEMO DATA',
      }),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const message = errorJson.details?.[0]?.message || errorJson.error || 'Failed to create incident';
      throw new Error(message);
    }
    return res.json();
  },

  async updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update status for incident ${id}`);
    }
    return res.json();
  },

  async deleteIncident(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Failed to delete incident ${id}`);
    }
  },

  async getStatistics(): Promise<IncidentStatistics> {
    const res = await fetch(`${API_BASE}/statistics`);
    if (!res.ok) {
      throw new Error(`Failed to fetch statistics: ${res.statusText}`);
    }
    return res.json();
  },

  async analyzeVisionMedia(file: File): Promise<VisionAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/vision/analyze`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || errorJson.error || 'Vision analysis failed');
    }
    return res.json();
  },
};
