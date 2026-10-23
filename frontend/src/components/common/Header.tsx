import React from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  PlusCircle,
  ScanEye,
  RefreshCw,
  Menu,
  Shield,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import { SystemHealth } from '../../types';

interface HeaderProps {
  health: SystemHealth | null;
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
  theme = 'light',
  onToggleTheme,
  onOpenReportModal,
  onOpenVisionModal,
  onRefresh,
  isRefreshing,
  onToggleMobileSidebar,
}) => {
  const isHealthy = health?.status === 'healthy';
  const runtimeProvider =
    health?.vision_subsystem?.execution_provider ||
    health?.hardware_detection?.inference_runtime ||
    'ONNX CPUExecutionProvider';
  const hostGpu = health?.hardware_detection?.host_gpu || health?.hardware_detection?.gpu_detected;

  return (
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
                P4 PRODUCTION
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Enterprise Transport Intelligence • Mappls • Vision AI
            </p>
          </div>
        </div>

        {/* Operational Provenance Tag */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-600/30 px-2.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-300 font-mono">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>SIMULATED DEMO DATA</span>
        </div>
      </div>

      {/* Right: Telemetry Badges & Primary Actions */}
      <div className="flex items-center gap-2.5">
        {/* Real Hardware & Runtime Provider Badge */}
        <div
          className="hidden lg:flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300"
          title={`Inference Runtime: ${runtimeProvider} (Host: ${hostGpu || 'Intel/AMD CPU'})`}
        >
          <Cpu className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="text-slate-500 dark:text-slate-400">Inference:</span>
          <span className="font-mono text-slate-800 dark:text-white text-[11px]">
            {runtimeProvider.includes('CPU') ? 'CPUExecutionProvider' : runtimeProvider}
          </span>
        </div>

        {/* Backend Health Badge */}
        <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthy ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
            {isHealthy ? 'API Online' : 'Connecting...'}
          </span>
          {health?.database && (
            <span className="hidden md:inline text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              ({health.database.latency_ms > 0 ? `${health.database.latency_ms}ms` : 'local'})
            </span>
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
  );
};
