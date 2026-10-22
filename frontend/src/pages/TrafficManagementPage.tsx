import React from 'react';
import { TrafficCone, Gauge, Zap, Clock, Activity, ArrowUpRight } from 'lucide-react';
import { Incident } from '../types';

interface TrafficManagementPageProps {
  incidents: Incident[];
}

export const TrafficManagementPage: React.FC<TrafficManagementPageProps> = ({ incidents }) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide font-mono">
            Traffic Management & Corridor Performance
          </h2>
          <p className="text-xs text-slate-400">
            Arterial speeds, Level of Service (LOS), signal timing splits, and automated congestion relief
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300 font-mono">
            Adaptive Signal Control: ACTIVE
          </span>
        </div>
      </div>

      {/* Corridor Performance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {corridors.map((corridor, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-4 space-y-3 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-bold text-white leading-snug">{corridor.name}</h4>
                <span
                  className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded ${
                    corridor.los.includes('LOS F')
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : corridor.los.includes('LOS D')
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {corridor.los}
                </span>
              </div>
              <Gauge className="h-4 w-4 text-sky-400" />
            </div>

            <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Operating Speed</span>
                <span className="text-white font-bold">
                  {corridor.speed} km/h{' '}
                  <span className="text-slate-400 font-normal">/ {corridor.limit} km/h</span>
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Congestion Index</span>
                  <span className="text-amber-400 font-mono font-bold">{corridor.congestion}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      corridor.congestion > 75
                        ? 'bg-rose-500'
                        : corridor.congestion > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${corridor.congestion}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>{corridor.signals}</span>
              <span className="text-rose-400 font-mono">{corridor.transitDelay}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
