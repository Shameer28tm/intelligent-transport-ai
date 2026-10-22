import React from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  PlusCircle,
  ScanEye,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { SystemHealth } from '../../types';

interface HeaderProps {
  health: SystemHealth | null;
  onOpenReportModal: () => void;
  onOpenVisionModal: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  onOpenReportModal,
  onOpenVisionModal,
  onRefresh,
  isRefreshing,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-[#070b13]/90 px-6 backdrop-blur-md">
      {/* Brand & Operational Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wider text-white uppercase font-mono">
                Intelligent Transport AI
              </span>
              <span className="rounded bg-sky-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 border border-sky-800/50">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Urban Traffic Command & Road Safety Analytics
            </p>
          </div>
        </div>

        {/* Operational Provenance Tag */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-amber-950/40 border border-amber-600/40 px-2.5 py-1 text-xs text-amber-300 font-mono">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span>SIMULATED DEMO DATA</span>
        </div>
      </div>

      {/* Telemetry Status Indicators & Actions */}
      <div className="flex items-center gap-3">
        {/* Hardware Telemetry Badge */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300">
          <Cpu className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-slate-400">HW:</span>
          <span className="font-mono text-white text-[11px]">RTX 5060 (8GB)</span>
        </div>

        {/* Backend Health Badge */}
        <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-mono text-slate-300">
            {isHealthy ? 'API Online' : 'Connecting...'}
          </span>
          {health?.database && (
            <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">
              ({health.database.latency_ms > 0 ? `${health.database.latency_ms}ms` : 'local'})
            </span>
          )}
        </div>

        {/* Refresh Action */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
          title="Refresh Transport Telemetry"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
        </button>

        {/* Vision AI Scan CTA */}
        <button
          onClick={onOpenVisionModal}
          className="flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-950/40 px-3.5 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-900/50 hover:border-sky-400 transition-colors shadow-sm"
        >
          <ScanEye className="h-4 w-4 text-sky-400" />
          <span className="hidden sm:inline">Vision AI Scan</span>
        </button>

        {/* Report Incident CTA */}
        <button
          onClick={onOpenReportModal}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors shadow-md shadow-sky-900/30"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Report Incident</span>
        </button>
      </div>
    </header>
  );
};
