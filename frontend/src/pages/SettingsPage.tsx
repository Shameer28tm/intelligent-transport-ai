import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Cpu,
  Server,
  Zap,
  Shield,
  RefreshCw,
  ExternalLink,
  Code2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { SystemHealth, MapplsStatus } from '../types';
import { api } from '../services/api';

interface SettingsPageProps {
  health: SystemHealth | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  health,
  onRefresh,
  isRefreshing,
}) => {
  const [mapplsStatus, setMapplsStatus] = useState<MapplsStatus | null>(null);
  const [isLoadingMappls, setIsLoadingMappls] = useState(false);

  const checkMappls = () => {
    setIsLoadingMappls(true);
    api.getMapplsStatus()
      .then((res) => setMapplsStatus(res))
      .catch((err) => console.warn('[SettingsPage] Mappls check error:', err))
      .finally(() => setIsLoadingMappls(false));
  };

  useEffect(() => {
    checkMappls();
  }, []);

  const handleFullRefresh = () => {
    onRefresh();
    checkMappls();
  };

  const runtimeProvider =
    health?.vision_subsystem?.execution_provider ||
    health?.hardware_detection?.inference_runtime ||
    'ONNX CPUExecutionProvider';
  const hostGpu = health?.hardware_detection?.host_gpu || health?.hardware_detection?.gpu_detected;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
            System Architecture & Telemetry Diagnostics
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Runtime environment, hardware acceleration, Mappls credentials audit, and REST endpoints
          </p>
        </div>

        <button
          type="button"
          onClick={handleFullRefresh}
          disabled={isRefreshing || isLoadingMappls}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:text-white transition-colors shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing || isLoadingMappls ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
          <span>Ping System Status</span>
        </button>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Backend & Database */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sky-600 dark:text-sky-400">
            <Server className="h-4 w-4" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase">FastAPI Backend Engine</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Service:</span>
              <span className="text-slate-900 dark:text-white font-mono">{health?.service || 'Intelligent Transport AI'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Release:</span>
              <span className="text-sky-700 dark:text-sky-300 font-mono font-bold">P3/P4 Enterprise</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Persistence Engine:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                {health?.database.engine || 'SQLite (Canonical transport.db)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">DB Ping Latency:</span>
              <span className="text-slate-900 dark:text-white font-mono">
                {health?.database.latency_ms !== undefined ? `${health.database.latency_ms} ms` : 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Interactive Docs:</span>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                Swagger UI /docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Card 2: Hardware & Model Inference Engine (Honest CPUExecutionProvider) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sky-600 dark:text-sky-400">
            <Cpu className="h-4 w-4" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase">Neural Inference Runtime</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Inference Runtime:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                CPUExecutionProvider
              </span>
            </div>
            {hostGpu && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Detected GPU (not used for inference):</span>
                <span className="text-slate-900 dark:text-white font-mono text-[11px] truncate max-w-[160px]">{hostGpu}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Vision Architecture:</span>
              <span className="text-sky-700 dark:text-sky-300 font-mono">YOLOv8n ONNX (Pretrained)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Mappls Enterprise Integration Audit */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sky-600 dark:text-sky-400">
            <MapPin className="h-4 w-4" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase">Mappls Integration Status</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Mappls Provider:</span>
              <span className="text-slate-900 dark:text-white font-mono">MapmyIndia / Mappls</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Credential Auth:</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  mapplsStatus?.is_operational
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                    : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {isLoadingMappls
                  ? 'Checking'
                  : mapplsStatus?.is_operational
                  ? 'Authenticated'
                  : mapplsStatus?.status === 'AUTH_FAILED'
                  ? 'Invalid credentials (HTTP 401)'
                  : mapplsStatus?.status === 'NOT_CONFIGURED'
                  ? 'Not configured'
                  : mapplsStatus?.status === 'SERVICE_UNAVAILABLE'
                  ? 'Network error'
                  : 'Not configured'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Masked Client ID:</span>
              <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px] flex items-center gap-1">
                <Lock className="h-3 w-3 text-slate-400" />
                {mapplsStatus?.masked_client_id || 'Configured'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Fallback Basemap:</span>
              <span className="text-sky-700 dark:text-sky-300 font-mono text-[11px]">
                Esri Vector Canvas (Active)
              </span>
            </div>
            <div className="pt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
              {mapplsStatus?.diagnostic_message || 'Mappls server credential audit active.'}
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints Catalog */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          Production REST API Endpoint Catalog
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs font-mono">
          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">GET</span>
              <span className="text-slate-900 dark:text-white">/api/health</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">System health, database latency, and execution provider</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">GET</span>
              <span className="text-slate-900 dark:text-white">/api/incidents</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Paginated incidents with spatial bounding box and filters</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">POST</span>
              <span className="text-slate-900 dark:text-white">/api/incidents</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Register incident with geographic boundary validation</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">PATCH</span>
              <span className="text-slate-900 dark:text-white">/api/incidents/&#123;id&#125;</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Dispatch lifecycle status updates</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">GET</span>
              <span className="text-slate-900 dark:text-white">/api/statistics</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Dashboard KPIs and 24-hour network activity curves</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">POST</span>
              <span className="text-slate-900 dark:text-white">/api/vision/analyze</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Whole video & image YOLOv8n ONNX object detection</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">POST</span>
              <span className="text-slate-900 dark:text-white">/api/vision/analyze-frame</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">P2 Feature: Selected paused frame neural inference</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">GET</span>
              <span className="text-slate-900 dark:text-white">/api/vision/history</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Persistent SQLite video and frame analysis records</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">POST</span>
              <span className="text-slate-900 dark:text-white">/api/vision/live-session/summary</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">P3 Feature: Save live tracking session summary to history</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">GET</span>
              <span className="text-slate-900 dark:text-white">/api/mappls/status</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">P2 Feature: Mappls OAuth2 credential verification & diagnostics</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">GET</span>
              <span className="text-slate-900 dark:text-white">/api/mappls/geocode</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">P2 Feature: Mappls Atlas geocode & places search</span>
          </div>

          <div className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">POST</span>
              <span className="text-slate-900 dark:text-white">/api/mappls/route</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">P2 Feature: Mappls Advanced Maps routing proxy</span>
          </div>
        </div>
      </div>
    </div>
  );
};
