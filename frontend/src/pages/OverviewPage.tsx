import React from 'react';
import {
  AlertTriangle,
  Flame,
  Activity,
  Layers,
  Gauge,
  TrendingUp,
  MapPin,
  Clock,
} from 'lucide-react';
import { Incident, IncidentStatistics } from '../types';
import { StatCard } from '../components/common/StatCard';
import { TransportMap } from '../components/map/TransportMap';
import { IncidentFeed } from '../components/incidents/IncidentFeed';

interface OverviewPageProps {
  incidents: Incident[];
  statistics: IncidentStatistics | null;
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onUpdateStatus: (id: string, newStatus: any) => Promise<void>;
  isLoading?: boolean;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  incidents,
  statistics,
  selectedIncident,
  onSelectIncident,
  onUpdateStatus,
  isLoading,
}) => {
  const total = statistics?.total_incidents ?? incidents.length;
  const critical = statistics?.critical_incidents ?? incidents.filter((i) => i.severity === 'CRITICAL').length;
  const avgCongestion = statistics?.average_congestion_pct ?? 54.2;
  const monitoredCorridors = statistics?.monitored_corridors_count ?? 8;

  return (
    <div className="space-y-6">
      {/* Top Operational KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Road Incidents"
          value={total}
          subtitle="Monitored in municipal grid"
          change="+2 vs last hr"
          isPositiveChange={false}
          variant={total > 10 ? 'warning' : 'default'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />

        <StatCard
          title="Critical Emergencies"
          value={critical}
          subtitle="Requires priority dispatch"
          change={critical > 0 ? 'Active Response' : 'Nominal'}
          isPositiveChange={critical === 0}
          variant={critical > 0 ? 'critical' : 'default'}
          icon={<Flame className="h-5 w-5" />}
        />

        <StatCard
          title="Corridor Congestion"
          value={`${avgCongestion}%`}
          subtitle="Average network delay index"
          change="-3.4% trend"
          isPositiveChange={true}
          variant="accent"
          icon={<Gauge className="h-5 w-5" />}
        />

        <StatCard
          title="Monitored Corridors"
          value={monitoredCorridors}
          subtitle="Connected transit arterials"
          change="100% telemetry online"
          isPositiveChange={true}
          variant="default"
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      {/* Main Grid: Interactive Map + Synchronized Live Incident Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide font-mono">
                Geographic Traffic Operations Map
              </h2>
              <p className="text-xs text-slate-400">
                MapLibre GL JS spatial visualization • Color-coded severity pins • Pan, zoom, inspect
              </p>
            </div>
            <span className="rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] font-mono text-slate-400">
              Corridor Focus: SF Metro Grid
            </span>
          </div>

          <TransportMap
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={onSelectIncident}
            onUpdateStatus={onUpdateStatus}
            isLoading={isLoading}
          />
        </div>

        <div className="h-[630px]">
          <IncidentFeed
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={onSelectIncident}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* 24-Hour Network Telemetry Trend Bar */}
      {statistics?.hourly_trends && statistics.hourly_trends.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[#0c1322]/80 backdrop-blur-md p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                24-Hour Network Incident & Congestion Curve
              </h3>
              <p className="text-xs text-slate-400">
                Temporal distribution of detected incidents and arterial congestion percentages
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Incident Events
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Congestion %
              </span>
            </div>
          </div>

          {/* Sparkline Histogram */}
          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 items-end h-28 pt-4">
            {statistics.hourly_trends.map((item, idx) => {
              const heightPct = Math.min(100, Math.max(15, item.congestion_pct));
              return (
                <div
                  key={idx}
                  className="group relative flex flex-col items-center justify-end h-full"
                >
                  <div
                    className="w-full rounded-t transition-all group-hover:brightness-125 cursor-pointer bg-gradient-to-t from-sky-900/60 to-sky-400/80"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="mt-1 text-[9px] text-slate-400 font-mono hidden md:block">
                    {item.hour.split(':')[0]}
                  </span>

                  {/* Tooltip */}
                  <div className="absolute -top-12 hidden group-hover:flex flex-col items-center rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-[10px] text-white font-mono shadow-xl z-20 whitespace-nowrap pointer-events-none">
                    <span>{item.hour}</span>
                    <span className="text-amber-400">{item.congestion_pct}% Congestion</span>
                    <span className="text-sky-300">{item.incident_count} Incidents</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
