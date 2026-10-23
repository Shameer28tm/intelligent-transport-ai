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
  ShieldCheck,
  Compass,
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
    <div className="space-y-5">
      {/* Operational Provenance & Verification Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>
            Operational Intelligence Platform: Verified telemetry synced from SQLite persistence.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5">
            Sample incidents: SIMULATED DEMO DATA
          </span>
          <span className="rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40 px-2 py-0.5">
            Geospatial: MapLibre + Mappls Proxy
          </span>
        </div>
      </div>

      {/* Top Operational KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
          change={critical > 0 ? 'Active Dispatch' : 'Nominal'}
          isPositiveChange={critical === 0}
          variant={critical > 0 ? 'critical' : 'default'}
          icon={<Flame className="h-5 w-5" />}
        />

        <StatCard
          title="Corridor Congestion"
          value={`${avgCongestion}%`}
          subtitle="Network-wide delay index"
          change="-3.4% 24h trend"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
                Geographic Traffic Operations Map
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spatial telemetry • Mappls Geocoding & Routing • Fallback Basemap Architecture
              </p>
            </div>
            <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] px-2.5 py-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 shadow-xs">
              Grid: SF Metro / Dynamic Coordinates
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

        <div className="h-[620px]">
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
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                24-Hour Network Incident & Congestion Curve
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hourly distribution of detected incidents and arterial congestion percentages
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Incidents
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Congestion %
              </span>
            </div>
          </div>

          {/* Sparkline Histogram */}
          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 items-end h-24 pt-2">
            {statistics.hourly_trends.map((item, idx) => {
              const heightPct = Math.min(100, Math.max(15, item.congestion_pct));
              return (
                <div
                  key={idx}
                  className="group relative flex flex-col items-center justify-end h-full"
                >
                  <div
                    className="w-full rounded-t transition-all group-hover:brightness-110 cursor-pointer bg-gradient-to-t from-sky-200 to-sky-500 dark:from-sky-900/60 dark:to-sky-400/80"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="mt-1 text-[9px] text-slate-400 font-mono hidden md:block">
                    {item.hour.split(':')[0]}
                  </span>

                  {/* Tooltip */}
                  <div className="absolute -top-12 hidden group-hover:flex flex-col items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-[10px] text-slate-900 dark:text-white font-mono shadow-md z-20 whitespace-nowrap pointer-events-none">
                    <span>{item.hour}</span>
                    <span className="text-amber-600 dark:text-amber-400">{item.congestion_pct}% Congestion</span>
                    <span className="text-sky-600 dark:text-sky-300">{item.incident_count} Incidents</span>
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
