import React from 'react';
import { Incident } from '../types';
import { TransportMap } from '../components/map/TransportMap';
import { Compass, ShieldCheck } from 'lucide-react';

interface LiveMapPageProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onUpdateStatus: (id: string, newStatus: any) => Promise<void>;
  isLoading?: boolean;
}

export const LiveMapPage: React.FC<LiveMapPageProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onUpdateStatus,
  isLoading,
}) => {
  return (
    <div className="h-full flex flex-col space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase flex items-center gap-2">
              <Compass className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              Live Geospatial Operations Map
            </h2>
            <span className="rounded bg-sky-50 dark:bg-sky-950/80 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
              MapLibre GL JS
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Full-bleed incident GIS tracking, corridor congestion layers, and multi-provider basemap support
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="rounded bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-slate-600 dark:text-slate-400 shadow-xs">
            Active Markers: <span className="text-slate-900 dark:text-white font-bold">{incidents.length}</span>
          </span>
          <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 shadow-xs">
            Esri Canvas Active
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 min-h-[580px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs relative">
        <TransportMap
          incidents={incidents}
          selectedIncident={selectedIncident}
          onSelectIncident={onSelectIncident}
          onUpdateStatus={onUpdateStatus}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
