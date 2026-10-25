import React from 'react';
import { Leaf, Zap, Bike, Wind, ShieldCheck } from 'lucide-react';

export const SustainableMobilityPage: React.FC = () => {
  const evHubs = [
    { name: 'SOMA Fast DC Supercharging Hub', stalls: '24 / 24 Occupied (100%)', throughput: '1,420 kWh/day', waitTime: '4 min' },
    { name: 'Civic Center Public Charging Depot', stalls: '16 / 20 Occupied (80%)', throughput: '980 kWh/day', waitTime: 'None' },
    { name: 'Mission Bay Electrification Facility', stalls: '12 / 16 Occupied (75%)', throughput: '720 kWh/day', waitTime: 'None' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
            Sustainable Mobility & Decarbonization
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Electric vehicle infrastructure telemetry, micro-mobility trips, and greenhouse gas offset metrics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 text-[11px] font-mono">
            SYNTHETIC BENCHMARK ESTIMATES
          </span>
          <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-mono">
            Target Baseline: Net Zero 2040
          </span>
        </div>
      </div>

      {/* Explicit Data Requirements Banner */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 shrink-0">
          DATA REQUIREMENTS
        </span>
        <p className="leading-relaxed text-[11px]">
          Live EV charging telemetry requires <strong>OCPP 1.6 / 2.0.1</strong> protocol connectivity or commercial network APIs (e.g., ChargePoint, EVgo).
          Micro-mobility trip analytics require regional <strong>GBFS (General Bikeshare Feed Specification)</strong> feeds.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">Averted Emissions (Estimated)</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">1,840 tCO2e</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Model estimate via transit electrification</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">EV Fast-Charge Utilization</span>
          <p className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">86.4%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sample hub occupancy benchmark</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">Shared Micro-Mobility Trips</span>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">32,840</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sample municipal operator estimate</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Metropolitan High-Power EV Charging Hubs
        </h3>
        <div className="space-y-3">
          {evHubs.map((hub, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 p-4 gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{hub.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">Throughput: {hub.throughput}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-sky-700 dark:text-sky-300 font-medium">{hub.stalls}</span>
                <span className="rounded bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Wait: {hub.waitTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
