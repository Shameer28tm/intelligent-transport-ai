import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, MapPin, RefreshCw, ShieldAlert, Info, Bike, Footprints, Camera } from 'lucide-react';
import { Incident, SafetyHotspotsResponse, SafetySummary, TnContext } from '../types';
import { api } from '../services/api';

interface RoadSafetyPageProps {
  incidents: Incident[];
  onOpenVisionModal: () => void;
  onSelectIncident: (incident: Incident) => void;
}

const card = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs';
const fmtInt = (n: number) => n.toLocaleString('en-IN');

export const RoadSafetyPage: React.FC<RoadSafetyPageProps> = ({ incidents, onOpenVisionModal, onSelectIncident }) => {
  const [context, setContext] = useState<TnContext | null>(null);
  const [summary, setSummary] = useState<SafetySummary | null>(null);
  const [hotspots, setHotspots] = useState<SafetyHotspotsResponse | null>(null);
  const [radius, setRadius] = useState<number>(500);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [c, s, h] = await Promise.allSettled([
      api.getSafetyContext(),
      api.getSafetySummary(),
      api.getSafetyHotspots(radius, 2, 1095),
    ]);
    if (c.status === 'fulfilled') setContext(c.value);
    if (s.status === 'fulfilled') setSummary(s.value);
    if (h.status === 'fulfilled') setHotspots(h.value);
    const failed = [c, s, h].filter((r) => r.status === 'rejected').length;
    if (failed > 0) setError(`${failed} of 3 road-safety requests failed. Check that the backend is running.`);
    setLoading(false);
  }, [radius]);

  useEffect(() => {
    load();
  }, [load, incidents.length]);

  const incidentById = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);
  const maxHour = Math.max(1, ...(summary?.by_hour_ist ?? [0]));
  const serious = (summary?.by_severity?.CRITICAL ?? 0) + (summary?.by_severity?.HIGH ?? 0);
  const allSimulated = summary ? summary.simulated_incidents === summary.total_incidents && summary.total_incidents > 0 : false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            Tamil Nadu Road Safety
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Crash hotspots, district breakdown and time-of-day patterns computed from the incident database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <span
              className={`rounded px-2 py-1 text-[11px] font-medium border ${
                allSimulated
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {summary.simulated_incidents} of {summary.total_incidents} records are simulated demo data
            </span>
          )}
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Cited statewide context */}
      {context && (
        <section aria-labelledby="tn-context" className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          <div className={`${card} lg:col-span-2`}>
            <h3 id="tn-context" className="text-xs font-semibold text-slate-900 dark:text-white">Why Tamil Nadu (2024, official figures)</h3>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Stat label="Road accidents" value={fmtInt(context.statewide_2024.road_accidents)} hint={`#${context.statewide_2024.national_rank_accidents} in India`} />
              <Stat label="Road deaths" value={fmtInt(context.statewide_2024.road_deaths)} hint={`#${context.statewide_2024.national_rank_deaths} in India`} />
              <Stat label="Deaths without helmet" value={fmtInt(context.statewide_2024.deaths_without_helmet)} hint="highest in India" />
            </div>
            <SourceLink text={context.statewide_2024.source} url={context.statewide_2024.source_url} />
          </div>
          <div className={card}>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Highway black corridors</h3>
            <ul className="mt-2 space-y-1 text-xs">
              {context.black_corridors.top_tn_locations.map((l) => (
                <li key={l.location} className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>{l.location}{l.national_rank === 1 ? ' (most in India)' : ''}</span>
                  <span className="font-mono font-semibold">{l.corridors}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{context.black_corridors.definition}</p>
            <SourceLink text={context.black_corridors.source} url={context.black_corridors.source_url} />
          </div>
        </section>
      )}

      {/* KPIs from stored incidents */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Incident database indicators">
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Recorded incidents" value={summary ? fmtInt(summary.total_incidents) : '—'} />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Critical or high severity" value={summary ? fmtInt(serious) : '—'} />
        <Kpi icon={<Bike className="h-4 w-4" />} label="Tagged two-wheeler" value={summary ? fmtInt(summary.tagged_two_wheeler) : '—'} hint={summary ? `${summary.tagged_no_helmet} tagged no-helmet (reported)` : undefined} />
        <Kpi icon={<Footprints className="h-4 w-4" />} label="Pedestrian-related" value={summary ? fmtInt(summary.pedestrian_related) : '—'} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Hotspots */}
        <section className={`${card} lg:col-span-3 space-y-3`} aria-labelledby="hotspots-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="hotspots-heading" className="text-sm font-semibold text-slate-900 dark:text-white">Crash hotspots</h3>
            <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
              Cluster radius
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
              >
                <option value={250}>250 m</option>
                <option value={500}>500 m</option>
                <option value={1000}>1 km</option>
              </select>
            </label>
          </div>
          {!hotspots ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{loading ? 'Computing hotspots…' : 'Hotspots unavailable.'}</p>
          ) : hotspots.hotspots.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No location has two or more crash records within {radius} m.</p>
          ) : (
            <ol className="space-y-2">
              {hotspots.hotspots.slice(0, 8).map((h) => {
                const first = h.incident_ids.map((id) => incidentById.get(id)).find(Boolean);
                return (
                  <li key={`${h.latitude},${h.longitude}`} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono text-slate-500">#{h.rank}</span>
                          {h.location_names[0] || 'Unnamed location'}
                          {h.meets_black_corridor_rule && (
                            <span className="rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-medium">
                              Meets black-corridor rule
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {h.district ?? 'District unassigned'} · {h.incident_count} crashes ({h.serious_count} serious) within {Math.max(h.radius_m, 1)} m
                          {h.top_tags.length > 0 && ` · ${h.top_tags.join(', ')}`}
                        </div>
                      </div>
                      {first && (
                        <button
                          type="button"
                          onClick={() => onSelectIncident(first)}
                          className="shrink-0 text-xs text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          View on map
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {hotspots && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hotspots.method}</p>}
        </section>

        {/* Districts + time of day */}
        <section className={`${card} lg:col-span-2 space-y-4`} aria-labelledby="districts-heading">
          <div>
            <h3 id="districts-heading" className="text-sm font-semibold text-slate-900 dark:text-white">By district</h3>
            {summary && summary.by_district.length > 0 ? (
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400">
                    <th scope="col" className="text-left font-normal pb-1">District</th>
                    <th scope="col" className="text-right font-normal pb-1">Crashes</th>
                    <th scope="col" className="text-right font-normal pb-1">Serious</th>
                    <th scope="col" className="text-right font-normal pb-1">All</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800 dark:text-slate-100">
                  {summary.by_district.slice(0, 8).map((d) => (
                    <tr key={d.district} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1">{d.district}</td>
                      <td className="py-1 text-right font-mono">{d.crashes}</td>
                      <td className="py-1 text-right font-mono">{d.serious}</td>
                      <td className="py-1 text-right font-mono">{d.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{loading ? 'Loading…' : 'No incidents recorded.'}</p>
            )}
            {summary && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{summary.district_note}</p>}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Time of day (IST)</h3>
            <div className="mt-2 flex items-end gap-[2px] h-24" role="img" aria-label="Incidents by hour of day, India Standard Time">
              {(summary?.by_hour_ist ?? Array(24).fill(0)).map((v, h) => (
                <div key={h} className="flex-1 flex flex-col justify-end h-full" title={`${String(h).padStart(2, '0')}:00 – ${v} incidents`}>
                  <div className="bg-sky-500 dark:bg-sky-400/80 rounded-t-sm" style={{ height: `${(v / maxHour) * 100}%`, minHeight: v > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>
        </section>
      </div>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          Review camera footage for triple riding, wrong-side driving and vehicle–pedestrian conflicts in Traffic Intelligence.
        </p>
        <button
          type="button"
          onClick={onOpenVisionModal}
          className="rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
        >
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          Open camera analysis
        </button>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="text-xl font-semibold text-slate-900 dark:text-white font-mono">{value}</div>
    {hint && <div className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>}
  </div>
);

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className={card}>
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="text-sky-600 dark:text-sky-400" aria-hidden="true">{icon}</span>
      {label}
    </div>
    <div className="text-xl font-semibold text-slate-900 dark:text-white font-mono mt-1">{value}</div>
    {hint && <div className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>}
  </div>
);

const SourceLink: React.FC<{ text: string; url: string }> = ({ text, url }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer noopener"
    className="mt-2 inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-300 hover:underline"
  >
    Source: {text}
    <ExternalLink className="h-3 w-3" aria-hidden="true" />
  </a>
);

export default RoadSafetyPage;
