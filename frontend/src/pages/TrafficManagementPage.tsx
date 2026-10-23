import React, { useState, useEffect } from 'react';
import { TrafficCone, Gauge, Zap, Clock, Activity, ArrowUpRight, Layers, Scan, Sparkles } from 'lucide-react';
import { Incident, VisionAnalysisHistoryItem } from '../types';
import { api } from '../services/api';

interface TrafficManagementPageProps {
  incidents: Incident[];
  onOpenVisionModal?: () => void;
}

export const TrafficManagementPage: React.FC<TrafficManagementPageProps> = ({ incidents, onOpenVisionModal }) => {
  const [latestVision, setLatestVision] = useState<VisionAnalysisHistoryItem | null>(null);

  useEffect(() => {
    api.getVisionHistory(1)
      .then((records) => {
        if (records && records.length > 0) {
          setLatestVision(records[0]);
        }
      })
      .catch((err) => console.warn('[TrafficPage] Failed to fetch latest vision history:', err));
  }, []);

  const corridors = [
    {
      name: 'Market Street Transit Corridor',
      speed: 18.5,
      limit: 40.0,
      congestion: 76,
      los: 'LOS D (Constrained)',
      signals: '18 / 20 Synchronized',
      transitDelay: '+6.2 min',
    },
    {
      name: 'I-80 Bay Bridge Freeway',
      speed: 28.0,
      limit: 88.0,
      congestion: 88,
      los: 'LOS F (Severe Breakdown)',
      signals: 'Ramp Metering Active',
      transitDelay: '+16.5 min',
    },
    {
      name: 'US Highway 101 Southbound',
      speed: 46.0,
      limit: 105.0,
      congestion: 64,
      los: 'LOS D (High Density)',
      signals: 'Adaptive VSL 60 km/h',
      transitDelay: '+8.0 min',
    },
    {
      name: 'The Embarcadero Waterfront',
      speed: 34.0,
      limit: 48.0,
      congestion: 42,
      los: 'LOS C (Stable Flow)',
      signals: '12 / 12 Synchronized',
      transitDelay: '+2.1 min',
    },
    {
      name: 'Geary Rapid Transit Corridor',
      speed: 38.0,
      limit: 50.0,
      congestion: 32,
      los: 'LOS B (Reasonably Free)',
      signals: 'Transit Signal Priority Active',
      transitDelay: '+1.0 min',
    },
    {
      name: 'Mission Street Boulevard',
      speed: 26.0,
      limit: 40.0,
      congestion: 58,
      los: 'LOS D (Urban Friction)',
      signals: '14 / 16 Synchronized',
      transitDelay: '+4.5 min',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
            Traffic Management & Arterial Corridors
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Arterial speeds, Level of Service (LOS), adaptive signal synchronization, and CCTV traffic intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-amber-300 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] text-amber-800 dark:text-amber-300 font-mono">
            CORRIDOR FEEDS: SIMULATED BENCHMARKS
          </span>
          <span className="rounded-lg border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-[11px] text-sky-800 dark:text-sky-300 font-mono">
            LOOP SENSORS: NOT CONFIGURED
          </span>
        </div>
      </div>

      {/* Real CCTV Vision Intelligence Telemetry Card */}
      {latestVision && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-500/30 bg-white dark:bg-[#0b1120] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                  Active Vision AI Telemetry • {latestVision.filename}
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
                  REAL INFERENCE PERSISTED
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                {latestVision.unique_vehicles_tracked} Unique Tracked Vehicles • {latestVision.total_frame_detections} Total Detections • {latestVision.fps_processed ? `${latestVision.fps_processed.toFixed(1)} FPS` : `${latestVision.processing_time_ms.toFixed(0)} ms`}
              </p>
            </div>
          </div>

          {onOpenVisionModal && (
            <button
              type="button"
              onClick={onOpenVisionModal}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 transition-all self-start md:self-auto shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Open Vision Workspace</span>
            </button>
          )}
        </div>
      )}

      {/* Corridor Performance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {corridors.map((corridor, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{corridor.name}</h4>
                <span
                  className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded ${
                    corridor.los.includes('LOS F')
                      ? 'bg-rose-50 dark:bg-red-950 text-rose-700 dark:text-red-300 border border-rose-200 dark:border-red-800'
                      : corridor.los.includes('LOS D')
                      ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {corridor.los}
                </span>
              </div>

              <div className="text-right">
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {corridor.speed} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">km/h</span>
                </span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Limit: {corridor.limit} km/h</p>
              </div>
            </div>

            {/* Delay & Congestion Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>Congestion Delay Index</span>
                <span className="font-mono text-slate-900 dark:text-white font-bold">{corridor.congestion}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    corridor.congestion > 75
                      ? 'bg-rose-500'
                      : corridor.congestion > 45
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${corridor.congestion}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{corridor.signals}</span>
              <span className="text-sky-300">Delay: {corridor.transitDelay}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
