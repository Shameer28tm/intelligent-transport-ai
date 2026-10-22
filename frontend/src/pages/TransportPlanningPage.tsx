import React from 'react';
import { GitFork, Users, TrendingUp, Bus, ArrowRight } from 'lucide-react';

export const TransportPlanningPage: React.FC = () => {
  const odFlows = [
    { origin: 'Downtown Financial Hub', destination: 'Mission Valley Tech Corridor', volume: '42,500 daily trips', capacityPct: 88, modeSplit: '54% Transit / 32% Auto / 14% Micro' },
    { origin: 'East Bay Metro Approach', destination: 'Civic Cultural Center', volume: '38,100 daily trips', capacityPct: 94, modeSplit: '62% Transit / 30% Auto / 8% Micro' },
    { origin: 'Peninsula South Corridor', destination: 'SOMA Commercial District', volume: '29,400 daily trips', capacityPct: 76, modeSplit: '48% Transit / 42% Auto / 10% Micro' },
    { origin: 'Waterfront Ferry Terminal', destination: 'Market Street Financial Axis', volume: '18,800 daily trips', capacityPct: 62, modeSplit: '78% Active/Transit / 22% Auto' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-wide font-mono">
          Transport Planning & Origin-Destination Modeling
        </h2>
        <p className="text-xs text-slate-400">
          Regional macro-simulation, passenger corridor capacity, and multi-modal modal split analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">Peak Transit Mode Share</span>
          <p className="text-2xl font-bold font-mono text-sky-400 mt-1">58.4%</p>
          <p className="text-xs text-emerald-400 mt-1">+2.8% YoY shift from personal vehicles</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">Regional Flow Capacity</span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">82.1%</p>
          <p className="text-xs text-slate-400 mt-1">Average peak hour bottleneck saturation</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">2030 Demand Growth Projection</span>
          <p className="text-2xl font-bold font-mono text-purple-400 mt-1">+14.2%</p>
          <p className="text-xs text-slate-400 mt-1">Requires additional BRT frequency</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4">
          Major Origin-Destination Travel Corridors
        </h3>
        <div className="space-y-3">
          {odFlows.map((flow, i) => (
            <div key={i} className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-semibold text-white">
                <div className="flex items-center gap-2">
                  <span className="text-sky-400">{flow.origin}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-emerald-400">{flow.destination}</span>
                </div>
                <span className="font-mono text-slate-300">{flow.volume}</span>
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
