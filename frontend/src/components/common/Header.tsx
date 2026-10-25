import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  PlusCircle,
  ScanEye,
  RefreshCw,
  Menu,
  Shield,
  Layers,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
  Info,
  X,
  Server,
  Database,
  Cpu,
  Clock,
  Sparkles,
} from 'lucide-react';
import { SystemHealth } from '../../types';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'degraded';

interface HeaderProps {
  health: SystemHealth | null;
  connectionStatus?: ConnectionStatus;
  connectionError?: string | null;
  lastCheckedAt?: Date | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenReportModal: () => void;
  onOpenVisionModal: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  connectionStatus = 'connecting',
  connectionError,
  lastCheckedAt,
  theme = 'light',
  onToggleTheme,
  onOpenReportModal,
  onOpenVisionModal,
  onRefresh,
  isRefreshing,
  onToggleMobileSidebar,
}) => {
  const [isHealthPopoverOpen, setIsHealthPopoverOpen] = useState(false);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          dotClass: 'bg-emerald-500 dark:bg-emerald-400 animate-pulse',
          textClass: 'text-emerald-700 dark:text-emerald-300 font-semibold',
          label: 'Connected',
          borderClass: 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20',
        };
      case 'degraded':
        return {
          dotClass: 'bg-amber-500 animate-pulse',
          textClass: 'text-amber-700 dark:text-amber-300 font-semibold',
          label: 'Degraded (DB Offline)',
          borderClass: 'border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20',
        };
      case 'disconnected':
        return {
          dotClass: 'bg-rose-500',
          textClass: 'text-rose-700 dark:text-rose-300 font-semibold',
          label: 'Disconnected',
          borderClass: 'border-rose-200 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-950/20',
        };
      case 'connecting':
      default:
        return {
          dotClass: 'bg-sky-500 animate-pulse',
          textClass: 'text-sky-700 dark:text-sky-300 font-semibold',
          label: 'Connecting...',
          borderClass: 'border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/20',
        };
    }
  };

  const statusStyle = getStatusBadge();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#070b13]/95 px-4 sm:px-6 backdrop-blur-md transition-colors duration-150">
        {/* Left: Mobile Toggle + Brand & Operational Status */}
        <div className="flex items-center gap-3">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-sky-600 dark:text-sky-400 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wider text-slate-900 dark:text-white uppercase font-mono">
                  Intelligent Transport AI
                </span>
                <span className="rounded bg-sky-50 dark:bg-sky-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                  Prototype
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Traffic operations and road-safety intelligence
              </p>
            </div>
          </div>

          {/* Operational Provenance Tag with Explanation Click */}
          <button
            type="button"
            onClick={() => setIsProvenanceModalOpen(true)}
            className="hidden xl:flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-600/30 px-2.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-300 font-mono hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
            title="Click to view simulated vs real data sources"
          >
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span>SIMULATED DEMO DATA</span>
            <Info className="h-3 w-3 ml-0.5 opacity-70" />
          </button>
        </div>

        {/* Right: Telemetry Badges & Primary Actions */}
        <div className="flex items-center gap-2.5">
          {/* Backend Health Badge with Diagnostics Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHealthPopoverOpen((prev) => !prev)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${statusStyle.borderClass}`}
              title="Click to view backend and database health diagnostics"
            >
              <span className={`h-2 w-2 rounded-full ${statusStyle.dotClass}`} />
              <span className={`font-mono text-[11px] ${statusStyle.textClass}`}>
                {statusStyle.label}
              </span>
              {connectionStatus === 'connected' && health?.database && (
                <span className="hidden md:inline text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  ({health.database.latency_ms > 0 ? `${health.database.latency_ms}ms` : 'local'})
                </span>
              )}
              {connectionStatus === 'disconnected' && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  className="ml-1 rounded bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-200 hover:bg-rose-200"
                >
                  Retry
                </span>
              )}
            </button>

            {/* Health Diagnostics Popover */}
            {isHealthPopoverOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] backdrop-blur-md p-4 shadow-xl z-40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white font-mono uppercase">
                    <Server className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    <span>System Health Status</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHealthPopoverOpen(false)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">API Status:</span>
                    <span
                      className={`font-mono font-semibold ${
                        connectionStatus === 'connected'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : connectionStatus === 'degraded'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {connectionStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Database Engine:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] truncate max-w-[170px]">
                      {health?.database?.engine || 'Relational Database'}
                    </span>
                  </div>

                  {health?.database && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Database Latency:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">
                        {health.database.latency_ms > 0 ? `${health.database.latency_ms} ms` : 'Local SQLite'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Vision Model:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">
                      YOLOv8n ONNX
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Inference Runtime:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                      {health?.vision_subsystem?.execution_provider || 'CPUExecutionProvider'}
                    </span>
                  </div>

                  {lastCheckedAt && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                      <span>Last Checked:</span>
                      <span className="font-mono">{lastCheckedAt.toLocaleTimeString()}</span>
                    </div>
                  )}

                  {connectionError && (
                    <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300">
                      {connectionError}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      onRefresh();
                    }}
                    disabled={isRefreshing}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 py-1.5 text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Re-check Connectivity</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle (Light / Dark) */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={theme === 'dark' ? 'Switch to Professional Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-slate-600" />
              )}
            </button>
          )}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Refresh Transport Telemetry"
            aria-label="Refresh telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
          </button>

          {/* Vision AI Workspace CTA */}
          <button
            type="button"
            onClick={onOpenVisionModal}
            className="flex items-center gap-1.5 rounded-lg border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 hover:border-sky-400 transition-colors shadow-xs"
          >
            <ScanEye className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span className="hidden sm:inline">Vision Workspace</span>
          </button>

          {/* Report Incident CTA */}
          <button
            type="button"
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Report Incident</span>
            <span className="sm:hidden">Report</span>
          </button>
        </div>
      </header>

      {/* Provenance & Truthfulness Modal */}
      {isProvenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
                    Data Provenance & Operational Separation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Clear boundary between simulated demonstration data and genuine AI inference
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProvenanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Simulated Demonstration Data */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-mono font-bold uppercase text-[11px]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Simulated Demonstration Feeds</span>
                </div>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
                  <li>
                    <strong>Sample Incident Records:</strong> Seeded initial incidents in the database for testing municipal dispatch workflows.
                  </li>
                  <li>
                    <strong>Travel Demand Matrix:</strong> Regional four-step OD passenger flows and transit mode splits are planning scenarios.
                  </li>
                  <li>
                    <strong>Corridor Congestion & Speed:</strong> Baseline speeds and signal counts are demonstration references (no city loop detectors connected).
                  </li>
                  <li>
                    <strong>Sustainable Mobility:</strong> EV charging hub utilization and emissions offset calculations are benchmark estimates.
                  </li>
                </ul>
              </div>

              {/* Real Operational Engine */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-mono font-bold uppercase text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Genuine AI & Operational Engine</span>
                </div>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
                  <li>
                    <strong>YOLOv8n ONNX Inference:</strong> Real deep learning detection running on captured video frames.
                  </li>
                  <li>
                    <strong>Multi-Vehicle Tracking:</strong> Sequential IoU tracker assigns persistent vehicle IDs and tracks trajectories.
                  </li>
                  <li>
                    <strong>Traffic Premonition:</strong> Real trajectory physics and closest-approach ($t^*, d^*$) collision conflict forecasting.
                  </li>
                  <li>
                    <strong>Database CRUD & Persistence:</strong> Real-time incident reporting, updates, and session saves on Neon PostgreSQL / SQLite.
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 text-[11px] text-slate-600 dark:text-slate-400">
              <p>
                <strong>Operational Policy:</strong> We do not claim real-time arterial traffic speeds or accident predictions without a verified sensor feed. Live corridor detectors are marked <code className="text-amber-700 dark:text-amber-300 font-mono">Not configured</code> rather than inventing live feeds.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsProvenanceModalOpen(false)}
                className="rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
