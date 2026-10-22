import React, { useState } from 'react';
import {
  FileSearch,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  MapPin,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Incident, IncidentCategory, IncidentSeverity, IncidentStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

interface IncidentExplorerPageProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onUpdateStatus: (id: string, newStatus: IncidentStatus) => Promise<void>;
}

export const IncidentExplorerPage: React.FC<IncidentExplorerPageProps> = ({
  incidents,
  onSelectIncident,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof Incident>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.corridor && inc.corridor.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = categoryFilter === 'ALL' || inc.category === categoryFilter;
    const matchesSev = severityFilter === 'ALL' || inc.severity === severityFilter;
    const matchesStat = statusFilter === 'ALL' || inc.status === statusFilter;

    return matchesSearch && matchesCat && matchesSev && matchesStat;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Category', 'Severity', 'Status', 'Location', 'Lat', 'Lng', 'Congestion %', 'Date'];
    const rows = sorted.map((i) => [
      i.id,
      `"${i.title.replace(/"/g, '""')}"`,
      i.category,
      i.severity,
      i.status,
      `"${i.location_name.replace(/"/g, '""')}"`,
      i.latitude,
      i.longitude,
      i.congestion_level_pct,
      i.created_at,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transport_incidents_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sorted, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `transport_incidents_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide font-mono">
            Incident Explorer & Audit Archive
          </h2>
          <p className="text-xs text-slate-400">
            Query, filter, export, and inspect operational records across the transit grid
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-600 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-600 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-4 shadow-xl">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, corridor, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="ACCIDENT">Accident</option>
            <option value="CONGESTION">Congestion</option>
            <option value="ROADWORK">Roadwork</option>
            <option value="HAZARD">Hazard</option>
            <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown</option>
            <option value="PEDESTRIAN_CROSSING_RISK">Pedestrian Safety</option>
            <option value="WEATHER_EVENT">Weather Event</option>
          </select>
        </div>

        <div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="VERIFIED">Verified</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Severity / Category</th>
                <th className="py-3 px-4">Incident Title</th>
                <th className="py-3 px-4">Corridor & Location</th>
                <th className="py-3 px-4 text-center">Delay %</th>
                <th className="py-3 px-4">Status Workflow</th>
                <th className="py-3 px-4 text-right">Reported Time</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No matching incidents found for the selected query.
                  </td>
                </tr>
              ) : (
                sorted.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                    onClick={() => onSelectIncident(inc)}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusBadge severity={inc.severity} size="sm" />
                        <span className="text-[10px] text-slate-400 font-mono">
                          {inc.category.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-white max-w-xs truncate group-hover:text-sky-300">
                      {inc.title}
                    </td>

                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      <div>
                        <span>{inc.location_name}</span>
                        {inc.corridor && (
                          <p className="text-[10px] text-slate-400">{inc.corridor}</p>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      <span
                        className={`font-bold ${
                          inc.congestion_level_pct > 75
                            ? 'text-rose-400'
                            : inc.congestion_level_pct > 40
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {inc.congestion_level_pct}%
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={inc.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-right text-[11px] font-mono text-slate-400 whitespace-nowrap">
                      {new Date(inc.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
