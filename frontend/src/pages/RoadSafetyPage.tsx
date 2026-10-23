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
  ShieldCheck,
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
    <div className="space-y-5">
      {/* Hero Safety Banner */}
      <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#0b1120] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/40 p-2.5 text-red-600 dark:text-red-400 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
                  Vision Zero & Municipal Road Safety Analytics
                </h2>
                <span className="rounded bg-red-50 dark:bg-red-950/80 px-2 py-0.5 text-[10px] font-mono text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                  CRITICAL CORRIDORS
                </span>
                <span className="rounded bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  BLACKSPOTS: BENCHMARK DEMO DATA
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Active priority hazards reflect live database incidents. Blackspot risk rankings and recommended geometric interventions represent municipal historical planning benchmarks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenVisionModal}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors shadow-xs shrink-0"
          >
            <Camera className="h-4 w-4" />
            <span>Launch Vision Workspace</span>
          </button>
        </div>
      </div>

      {/* Safety Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            Active Priority Hazards
          </span>
          <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
            {safetyIncidents.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Accidents and high-risk safety alerts</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            Vision Zero Target Status
          </span>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">Pending Feed</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Requires police crash records (FIR / Form-54)</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            Adaptive Signal Interventions
          </span>
          <p className="text-xl font-bold font-mono text-slate-500 dark:text-slate-400 mt-1">Unconnected</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Requires SCATS / SCOOT / NTCIP controller feed</p>
        </div>
      </div>

      {/* High-Hazard Corridor Blackspots Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                High-Hazard Roadway Blackspot Register
              </h3>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                ILLUSTRATIVE SAMPLE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Corridor benchmarks pending city collision GIS database integration
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5">
            Sample Register
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {blackspots.map((spot, i) => (
            <div key={i} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{spot.corridor}</span>
                  <span className="rounded bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                    Risk Index: {spot.riskScore}/100
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Conflict: <span className="text-slate-500 dark:text-slate-400">{spot.primaryConflict}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="text-sky-700 dark:text-sky-300 font-mono text-[11px]">
                  Intervention: {spot.recommendedIntervention}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {spot.incidentsPastMonth} historical conflict records
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
