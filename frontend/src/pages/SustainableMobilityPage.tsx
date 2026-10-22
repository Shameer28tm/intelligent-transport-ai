import React from 'react';
import { Leaf, Zap, Bike, Wind, ShieldCheck } from 'lucide-react';

export const SustainableMobilityPage: React.FC = () => {
  const evHubs = [
    { name: 'SOMA Fast DC Supercharging Hub', stalls: '24 / 24 Occupied (100%)', throughput: '1,420 kWh/day', waitTime: '4 min' },
    { name: 'Civic Center Public Charging Depot', stalls: '16 / 20 Occupied (80%)', throughput: '980 kWh/day', waitTime: 'None' },
    { name: 'Mission Bay Electrification Facility', stalls: '12 / 16 Occupied (75%)', throughput: '720 kWh/day', waitTime: 'None' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-wide font-mono">
          Sustainable Mobility & Decarbonization
        </h2>
        <p className="text-xs text-slate-400">
          Electric vehicle infrastructure telemetry, micro-mobility trips, and greenhouse gas offset metrics
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">Emissions Averted</span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">1,840 tCO2e</p>
          <p className="text-xs text-slate-400 mt-1">This month via transit & electrification</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">EV Charging Utilization</span>
          <p className="text-2xl font-bold font-mono text-sky-400 mt-1">86.4%</p>
          <p className="text-xs text-slate-400 mt-1">Average municipal fast-charge stall occupancy</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">Shared E-Bike / Scooter Trips</span>
          <p className="text-2xl font-bold font-mono text-yellow-400 mt-1">32,840</p>
          <p className="text-xs text-emerald-400 mt-1">+12% vs prior week</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          Metropolitan High-Power EV Charging Hubs
        </h3>
        <div className="space-y-3">
          {evHubs.map((hub, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 gap-2">
              <div>
                <h4 className="text-xs font-bold text-white">{hub.name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Throughput: {hub.throughput}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-sky-300">{hub.stalls}</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-700">
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
