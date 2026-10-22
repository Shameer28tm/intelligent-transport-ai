import React from 'react';
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
} from 'lucide-react';
import { SystemHealth } from '../types';

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
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide font-mono">
            System Architecture & Telemetry Diagnostics
          </h2>
          <p className="text-xs text-slate-400">
            Runtime environment, hardware acceleration, database engine, and vision subsystem status
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          <span>Ping System Status</span>
        </button>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend & Database */}
        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-5 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800 text-sky-400">
            <Server className="h-5 w-5" />
            <h3 className="text-sm font-bold text-white font-mono">FastAPI Backend Engine</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Service:</span>
              <span className="text-white font-mono">{health?.service || 'Intelligent Transport AI'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">API Version:</span>
              <span className="text-white font-mono">{health?.version || '1.0.0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Persistence Engine:</span>
              <span className="text-emerald-400 font-mono">
                {health?.database.engine || 'SQLite (PostgreSQL / PostGIS ready)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DB Ping Latency:</span>
              <span className="text-white font-mono">
                {health?.database.latency_ms !== undefined ? `${health.database.latency_ms} ms` : 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">API Documentation:</span>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                Swagger UI /docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Hardware & GPU Acceleration */}
        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-5 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800 text-sky-400">
            <Cpu className="h-5 w-5" />
            <h3 className="text-sm font-bold text-white font-mono">Hardware & Acceleration</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">GPU Device:</span>
              <span className="text-white font-mono font-semibold">
                {health?.hardware_detection.gpu_detected || 'NVIDIA GeForce RTX 5060 Laptop GPU'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">VRAM Capacity:</span>
              <span className="text-white font-mono">8151 MiB GDDR6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CUDA Driver Runtime:</span>
              <span className="text-emerald-400 font-mono">CUDA 13.3 / Driver 610.60</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Vision Adapter:</span>
              <span className="text-sky-300 font-mono">
                {health?.vision_subsystem.active_adapter || 'Deterministic Demo Simulator'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Phase Deployment:</span>
              <span className="text-slate-300 font-mono">Phase 1 Foundation</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints Catalog */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-sky-400" />
          Active REST API Endpoint Catalog
        </h3>

        <div className="divide-y divide-slate-800/80 text-xs font-mono">
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-950 px-2 py-0.5 text-sky-300 border border-sky-800 font-bold">GET</span>
              <span className="text-white">/api/health</span>
            </div>
            <span className="text-slate-400 text-[11px]">System and database operational telemetry</span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-950 px-2 py-0.5 text-sky-300 border border-sky-800 font-bold">GET</span>
              <span className="text-white">/api/incidents</span>
            </div>
            <span className="text-slate-400 text-[11px]">Paginated incidents with bounding box and category filters</span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-emerald-300 border border-emerald-800 font-bold">POST</span>
              <span className="text-white">/api/incidents</span>
            </div>
            <span className="text-slate-400 text-[11px]">Register incident with coordinate boundary validation</span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-950 px-2 py-0.5 text-amber-300 border border-amber-800 font-bold">PATCH</span>
              <span className="text-white">/api/incidents/&#123;id&#125;</span>
            </div>
            <span className="text-slate-400 text-[11px]">Dispatch status lifecycle updates</span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-950 px-2 py-0.5 text-sky-300 border border-sky-800 font-bold">GET</span>
              <span className="text-white">/api/statistics</span>
            </div>
            <span className="text-slate-400 text-[11px]">Dashboard KPIs and 24-hour network activity curves</span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-emerald-300 border border-emerald-800 font-bold">POST</span>
              <span className="text-white">/api/vision/analyze</span>
            </div>
            <span className="text-slate-400 text-[11px]">Computer vision object detection and risk estimation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
