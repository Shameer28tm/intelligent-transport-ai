import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  Zap,
  ArrowRight,
  TrendingDown,
  Camera,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { Incident } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

interface RoadSafetyPageProps {
  incidents: Incident[];
  onOpenVisionModal: () => void;
  onSelectIncident: (incident: Incident) => void;
}

export const RoadSafetyPage: React.FC<RoadSafetyPageProps> = ({
  incidents,
  onOpenVisionModal,
  onSelectIncident,
}) => {
  // Safety critical incidents
  const safetyIncidents = incidents.filter(
    (i) =>
      i.category === 'ACCIDENT' ||
      i.category === 'PEDESTRIAN_CROSSING_RISK' ||
      i.severity === 'CRITICAL' ||
      i.severity === 'HIGH'
  );

  const blackspots = [
    {
      corridor: 'Market St & 5th St',
      riskScore: 89,
      incidentsPastMonth: 14,
      primaryConflict: 'Pedestrian Crossing & Bus Turn Conflict',
      recommendedIntervention: 'Install Leading Pedestrian Interval (LPI +4s)',
    },
    {
      corridor: 'I-80 Westbound Approach',
      riskScore: 84,
      incidentsPastMonth: 11,
      primaryConflict: 'High-speed Lane Merging & Tailgating',
      recommendedIntervention: 'Ramp Metering Optimization & Dynamic Speed Warning',
    },
    {
      corridor: 'US-101 at Cesar Chavez St',
      riskScore: 78,
      incidentsPastMonth: 9,
      primaryConflict: 'Heavy Freight Shoulder Incursions',
      recommendedIntervention: 'Active Shoulder Management & Thermal Warning Signs',
    },
    {
      corridor: 'Castro St & 18th St',
      riskScore: 72,
      incidentsPastMonth: 7,
      primaryConflict: 'Intersection Left-Turn Red Light Running',
      recommendedIntervention: 'Protected Left Turn Signal Phase Conversion',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Safety Banner */}
      <div className="rounded-2xl border border-rose-950/60 bg-gradient-to-r from-red-950/40 via-slate-900/60 to-slate-900/40 p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide font-mono">
                Vision Zero & Municipal Road Safety Analytics
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Automated detection of collision risks, pedestrian conflicts, high-hazard corridors, and predictive interventions based on real-time sensor and vision feeds.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenVisionModal}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-950 shrink-0"
          >
            <Camera className="h-4 w-4" />
            <span>Audit Road Feed with Vision AI</span>
          </button>
        </div>
      </div>

      {/* Safety Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Critical Safety Alerts
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-red-400">
              {safetyIncidents.filter((i) => i.severity === 'CRITICAL').length}
            </span>
            <span className="text-xs text-red-400 font-semibold">Immediate Dispatch</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Accidents & pedestrian hazard zones</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Vulnerable Road User Index
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-yellow-400">74.2 / 100</span>
            <span className="text-xs text-emerald-400 font-semibold">+3.1% safety compliance</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Pedestrian & cyclist conflict index</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Automated Speed Enforcement
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">91.8%</span>
            <span className="text-xs text-slate-400">Compliance</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Corridor speed limits respected</p>
        </div>
      </div>

      {/* High-Collision Blackspot Prioritization Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Prioritized Collision Blackspots & Remediation
            </h3>
            <p className="text-xs text-slate-400">
              Ranked by frequency of near-miss events and severity index
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                <th className="pb-3">Corridor Location</th>
                <th className="pb-3 text-center">Risk Index</th>
                <th className="pb-3 text-center">Monthly Incidents</th>
                <th className="pb-3">Primary Conflict Mechanism</th>
                <th className="pb-3">Recommended Infrastructure Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {blackspots.map((spot, i) => (
                <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3 font-semibold text-white">{spot.corridor}</td>
                  <td className="py-3 text-center font-mono">
                    <span className="inline-block rounded px-2 py-0.5 font-bold text-xs bg-red-950 text-red-300 border border-red-800">
                      {spot.riskScore} / 100
                    </span>
                  </td>
                  <td className="py-3 text-center font-mono text-slate-300">
                    {spot.incidentsPastMonth}
                  </td>
                  <td className="py-3 text-slate-300">{spot.primaryConflict}</td>
                  <td className="py-3 text-sky-300 font-medium">{spot.recommendedIntervention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Road Safety Incidents Feed */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3">
          Active Safety Conflicts in Monitored Area ({safetyIncidents.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {safetyIncidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <StatusBadge severity={inc.severity} />
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(inc.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white">{inc.title}</h4>
              <p className="text-[11px] text-slate-400 mt-1">{inc.location_name}</p>
              <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                <span>Speed: {inc.current_speed_kmh ?? 0} km/h</span>
                <span className="text-amber-400">{inc.congestion_level_pct}% Delay</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
