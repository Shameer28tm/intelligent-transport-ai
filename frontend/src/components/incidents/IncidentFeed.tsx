import React, { useState } from 'react';
import { Search, Filter, AlertTriangle, ArrowUpRight, Gauge, MapPin } from 'lucide-react';
import { Incident, IncidentSeverity } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface IncidentFeedProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  isLoading?: boolean;
}

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.corridor && inc.corridor.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322]/80 backdrop-blur-md p-4 shadow-xs dark:shadow-xl transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            Live Incident Stream
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {filtered.length} active events in monitored transit grid
          </p>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search corridor or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors"
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-sky-500 focus:outline-none transition-colors"
        >
          <option value="ALL">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Scrollable Feed List */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">Loading incident stream...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
            No incidents matching search filter.
          </div>
        ) : (
          filtered.map((incident) => {
            const isSelected = selectedIncident?.id === incident.id;
            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident(incident)}
                className={`group cursor-pointer rounded-xl border p-3 transition-all ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge severity={incident.severity} size="sm" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {incident.category.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {new Date(incident.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <h4 className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors">
                  {incident.title}
                </h4>

                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3 w-3 text-sky-500 dark:text-sky-400 shrink-0" />
                  <span className="truncate">{incident.location_name}</span>
                </div>

                <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    Congestion: <strong className="text-amber-600 dark:text-amber-400">{incident.congestion_level_pct}%</strong>
                  </span>
                  <span>
                    Speed: <strong className="text-slate-800 dark:text-white">{incident.current_speed_kmh ?? 0} km/h</strong>
                  </span>
                  <StatusBadge status={incident.status} size="sm" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
