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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
            Accessibility Analysis & 15-Minute Isochrones
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Pedestrian catchment, ADA curb ramp compliance, transit proximity, and inclusive mobility index
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 text-[11px] font-mono">
            MUNICIPAL PLANNING BENCHMARK
          </span>
          <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-mono">
            Standard: Universal Design & ADA 2010
          </span>
        </div>
      </div>

      {/* Explicit Data Requirements Banner */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 shrink-0">
          DATA REQUIREMENTS
        </span>
        <p className="leading-relaxed text-[11px]">
          Dynamic 15-minute isochrones require a multi-modal routing engine (OpenTripPlanner / Valhalla) with municipal sidewalk GIS layers and regional <strong>GTFS</strong> feeds.
          Curb ramp compliance metrics require integration with municipal Department of Public Works (DPW) asset inspection databases.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">15-Minute Access (Sample)</span>
          <p className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">87.5%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Illustrative catchment benchmark</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">Curb Ramp Compliance (Audit)</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">93.8%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Audited sample crosswalk tactile ramps</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-mono">Audible Crossings (Register)</span>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-yellow-400 mt-1">420 Signals</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sample inventory of accessible pedestrian signals</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider mb-4">
          Neighborhood Transit Isochrone Catchment
        </h3>
        <div className="space-y-3">
          {isochrones.map((iso, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 p-4 gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{iso.zone}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Curb Accessibility: {iso.curbCompliant}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-sky-700 dark:text-sky-300 font-medium">Walk: {iso.walk15min}</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">Transit: {iso.transit30min}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
