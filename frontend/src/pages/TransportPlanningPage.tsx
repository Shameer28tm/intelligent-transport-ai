import React from 'react';
import { GitFork, Users, TrendingUp, Bus, ArrowRight, ShieldCheck } from 'lucide-react';

export const TransportPlanningPage: React.FC = () => {
  const odFlows = [
    { origin: 'Downtown Financial Hub', destination: 'Mission Valley Tech Corridor', volume: '42,500 daily trips', capacityPct: 88, modeSplit: '54% Transit / 32% Auto / 14% Micro' },
    { origin: 'East Bay Metro Approach', destination: 'Civic Cultural Center', volume: '38,100 daily trips', capacityPct: 94, modeSplit: '62% Transit / 30% Auto / 8% Micro' },
    { origin: 'Peninsula South Corridor', destination: 'SOMA Commercial District', volume: '29,400 daily trips', capacityPct: 76, modeSplit: '48% Transit / 42% Auto / 10% Micro' },
    { origin: 'Waterfront Ferry Terminal', destination: 'Market Street Financial Axis', volume: '18,800 daily trips', capacityPct: 62, modeSplit: '78% Active/Transit / 22% Auto' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
            Transport Planning & Origin-Destination Modeling
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Regional macro-simulation, passenger corridor capacity, and multi-modal split analytics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 text-[11px] font-mono shadow-xs">
            SYNTHETIC DEMO BENCHMARK
          </span>
          <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-mono shadow-xs">
            Baseline: Static Travel Survey Sample
          </span>
        </div>
      </div>

      {/* Explicit Data Requirements Banner */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 shrink-0">
          DATA REQUIREMENTS
        </span>
        <p className="leading-relaxed text-[11px]">
          Dynamic four-step macro-simulation and origin-destination assignment are not yet integrated with live telemetry.
          Live deployment requires regional <strong>GTFS / GTFS-RT</strong> transit feeds, municipal travel demand census matrices, and cellular trajectory datasets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">Transit Mode Share (Sample)</span>
          <p className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">58.4%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Census travel survey benchmark estimate</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">Regional Flow Capacity (Estimated)</span>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">82.1%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Illustrative peak hour bottleneck saturation</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">2030 Growth Scenario (Projected)</span>
          <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">+14.2%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Planning scenario based on regional population models</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider mb-4">
          Major Origin-Destination Travel Corridors
        </h3>
        <div className="space-y-3">
          {odFlows.map((flow, i) => (
            <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-semibold text-slate-900 dark:text-white">
                <div className="flex items-center gap-2">
                  <span className="text-sky-600 dark:text-sky-400">{flow.origin}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">{flow.destination}</span>
                </div>
                <span className="font-mono text-slate-300 text-[11px]">{flow.volume}</span>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Corridor Saturation</span>
                  <span className="font-mono text-amber-400 font-bold">{flow.capacityPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      flow.capacityPct > 85 ? 'bg-rose-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${flow.capacityPct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Modal Distribution:</span>
                <span className="font-mono text-slate-200">{flow.modeSplit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
