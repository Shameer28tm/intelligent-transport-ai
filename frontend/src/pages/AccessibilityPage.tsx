import React from 'react';
import { Accessibility, MapPin, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export const AccessibilityPage: React.FC = () => {
  const isochrones = [
    { zone: 'Financial & Market Axis', walk15min: '94% Population Reached', transit30min: '100% Core Hubs', curbCompliant: '98.2%' },
    { zone: 'Mission Commercial District', walk15min: '88% Population Reached', transit30min: '96% Core Hubs', curbCompliant: '92.5%' },
    { zone: 'Western Sunset Residential', walk15min: '64% Population Reached', transit30min: '78% Core Hubs', curbCompliant: '84.0%' },
    { zone: 'South of Market Waterfront', walk15min: '91% Population Reached', transit30min: '98% Core Hubs', curbCompliant: '96.0%' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-wide font-mono">
          Accessibility Analysis & 15-Minute City Isochrones
        </h2>
        <p className="text-xs text-slate-400">
          Pedestrian catchment, ADA curb ramp compliance, transit proximity, and inclusive mobility index
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">15-Minute City Access Index</span>
          <p className="text-2xl font-bold font-mono text-sky-400 mt-1">87.5%</p>
          <p className="text-xs text-slate-400 mt-1">Residents within 15-min walk of transit & services</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">ADA Curb Ramp Compliance</span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">93.8%</p>
          <p className="text-xs text-slate-400 mt-1">Audited crosswalk tactile pavings & ramps</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1322]/80 p-4">
          <span className="text-xs text-slate-400 uppercase font-mono">Audible Signal Crossings</span>
          <p className="text-2xl font-bold font-mono text-yellow-400 mt-1">420 Signals</p>
          <p className="text-xs text-slate-400 mt-1">Equipped with accessible pedestrian pushbuttons</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4">
          Neighborhood Transit Isochrone Catchment
        </h3>
        <div className="space-y-3">
          {isochrones.map((iso, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4 gap-2">
              <div>
                <h4 className="text-xs font-bold text-white">{iso.zone}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Curb Accessibility: {iso.curbCompliant}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-sky-300">Walk: {iso.walk15min}</span>
                <span className="text-emerald-300">Transit: {iso.transit30min}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
