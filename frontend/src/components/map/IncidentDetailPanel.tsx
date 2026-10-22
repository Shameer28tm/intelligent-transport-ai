import React, { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Gauge,
  AlertOctagon,
  CheckCircle,
  Truck,
  Layers,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Incident, IncidentStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface IncidentDetailPanelProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus: (id: string, newStatus: IncidentStatus) => Promise<void>;
}

export const IncidentDetailPanel: React.FC<IncidentDetailPanelProps> = ({
  incident,
  onClose,
  onUpdateStatus,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!incident) return null;

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(incident.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedDate = new Date(incident.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="absolute top-4 right-4 z-20 w-96 rounded-xl border border-slate-800 bg-[#0c1322]/95 backdrop-blur-md p-5 shadow-2xl shadow-black/80 flex flex-col gap-4 max-h-[calc(100%-2rem)] overflow-y-auto">
      {/* Header with Title and Close */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <h4 className="text-sm font-semibold text-white leading-snug">{incident.title}</h4>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Description */}
      {incident.description && (
        <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
          {incident.description}
        </p>
      )}

      {/* Spatial & Corridor Attributes */}
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2 text-slate-300">
          <MapPin className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-white">{incident.location_name}</span>
            {incident.corridor && (
              <p className="text-[11px] text-slate-400">{incident.corridor}</p>
            )}
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Lat: {incident.latitude.toFixed(4)}, Lng: {incident.longitude.toFixed(4)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>Reported: {formattedDate}</span>
        </div>
      </div>

      {/* Operational Speed & Congestion Telemetry */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-sky-400" />
            Corridor Speed
          </span>
          <span className="font-mono text-white font-semibold">
            {incident.current_speed_kmh !== null ? `${incident.current_speed_kmh} km/h` : 'N/A'}{' '}
            <span className="text-slate-400 font-normal">
              / {incident.speed_limit_kmh ?? 50} km/h limit
            </span>
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Congestion Impact</span>
            <span className="font-mono text-amber-400 font-bold">
              {incident.congestion_level_pct}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                incident.congestion_level_pct > 75
                  ? 'bg-rose-500'
                  : incident.congestion_level_pct > 40
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, incident.congestion_level_pct)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            Lanes Affected
          </span>
          <span className="font-mono text-slate-200">{incident.affected_lanes} Lane(s)</span>
        </div>
      </div>

      {/* Tags */}
      {incident.tags && incident.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {incident.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 font-mono"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Operational Dispatch Actions */}
      <div className="pt-2 border-t border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Dispatch Status Workflow
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['REPORTED', 'VERIFIED', 'DISPATCHED', 'RESOLVED'] as IncidentStatus[]).map(
            (statusOption) => {
              const isCurrent = incident.status === statusOption;
              return (
                <button
                  key={statusOption}
                  onClick={() => handleStatusChange(statusOption)}
                  disabled={isCurrent || isUpdating}
                  className={`rounded-lg py-1.5 px-2 text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-sky-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {statusOption}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Demo Provenance tag */}
      <div className="text-[10px] text-amber-400/90 font-mono border-t border-slate-800/80 pt-2 flex items-center justify-between">
        <span>DATA SOURCE:</span>
        <span>{incident.data_source}</span>
      </div>
    </div>
  );
};
