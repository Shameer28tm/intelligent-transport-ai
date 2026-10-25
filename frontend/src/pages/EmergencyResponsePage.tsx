import React, { useEffect, useMemo, useState } from 'react';
import { Ambulance, Clock, ExternalLink, Hospital, Navigation, Phone, Siren, Info } from 'lucide-react';
import { FacilitiesResponse, Incident, TnContext } from '../types';
import { api } from '../services/api';

interface EmergencyResponsePageProps {
  incidents: Incident[];
}

const card = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-4 shadow-xs';
const GOLDEN_HOUR_MIN = 60;

const isActiveCrash = (i: Incident) =>
  (i.category === 'ACCIDENT' || i.category === 'PEDESTRIAN_CROSSING_RISK') && i.status !== 'RESOLVED';

const directionsUrl = (fromLat: number, fromLng: number, toLat: number, toLng: number) =>
  `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;

export const EmergencyResponsePage: React.FC<EmergencyResponsePageProps> = ({ incidents }) => {
  const active = useMemo(
    () => incidents.filter(isActiveCrash).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [incidents]
  );
  const [selectedId, setSelectedId] = useState<string | 'custom' | null>(null);
  const [customLat, setCustomLat] = useState('13.0067');
  const [customLng, setCustomLng] = useState('80.2045');
  const [facilities, setFacilities] = useState<FacilitiesResponse | null>(null);
  const [context, setContext] = useState<TnContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (selectedId === null && active.length > 0) setSelectedId(active[0].id);
  }, [active, selectedId]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    api.getSafetyContext().then(setContext).catch(() => setContext(null));
  }, []);

  const selected = selectedId && selectedId !== 'custom' ? active.find((i) => i.id === selectedId) ?? null : null;
  const origin = useMemo(() => {
    if (selected) return { lat: selected.latitude, lng: selected.longitude };
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }, [selected, customLat, customLng]);

  useEffect(() => {
    if (!origin) {
      setFacilities(null);
      return;
    }
    let cancelled = false;
    setError(null);
    api
      .getNearestFacilities(origin.lat, origin.lng, 5)
      .then((res) => !cancelled && setFacilities(res))
      .catch((e) => !cancelled && setError(e.message || 'Facility lookup failed'));
    return () => {
      cancelled = true;
    };
  }, [origin?.lat, origin?.lng]);

  const minutesSince = selected?.created_at ? Math.max(0, Math.floor((now - new Date(selected.created_at).getTime()) / 60000)) : null;
  const withinGoldenHour = minutesSince !== null && minutesSince < GOLDEN_HOUR_MIN;
  const helplines = context?.helplines ?? [
    { number: '108', label: 'Emergency ambulance (Tamil Nadu)' },
    { number: '112', label: 'National emergency number' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Siren className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            Emergency Response
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Golden-hour support for crash incidents: nearest government trauma hospitals, helplines and directions.
          </p>
        </div>
        <div className="flex gap-2">
          {helplines.map((h) => (
            <a
              key={h.number}
              href={`tel:${h.number}`}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
              title={h.label}
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Call {h.number}
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident picker */}
        <section className={`${card} space-y-3`} aria-labelledby="active-crashes">
          <h3 id="active-crashes" className="text-sm font-semibold text-slate-900 dark:text-white">Active crash incidents</h3>
          {active.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No unresolved crash incidents. Use a custom location below.</p>
          ) : (
            <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {active.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(i.id)}
                    aria-pressed={selectedId === i.id}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
                      selectedId === i.id
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">{i.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {i.location_name} · {i.severity.toLowerCase()} · {i.status.toLowerCase()}
                      {i.is_simulated ? ' · simulated' : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
            <button
              type="button"
              onClick={() => setSelectedId('custom')}
              aria-pressed={selectedId === 'custom'}
              className={`text-xs font-medium ${selectedId === 'custom' ? 'text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300'} hover:underline`}
            >
              Use a custom location
            </button>
            {selectedId === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Latitude
                  <input value={customLat} onChange={(e) => setCustomLat(e.target.value)} inputMode="decimal"
                    className="mt-0.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white" />
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">
                  Longitude
                  <input value={customLng} onChange={(e) => setCustomLng(e.target.value)} inputMode="decimal"
                    className="mt-0.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white" />
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Golden hour + facilities */}
        <section className={`${card} lg:col-span-2 space-y-4`} aria-labelledby="nearest-heading">
          {selected && (
            <div
              role="status"
              className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${
                withinGoldenHour
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Clock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="text-xs">
                <div className="font-semibold">
                  {minutesSince === null
                    ? 'Report time unknown'
                    : withinGoldenHour
                      ? `${minutesSince} min since report: ${GOLDEN_HOUR_MIN - minutesSince} min left in the golden hour`
                      : `${minutesSince} min since report: golden hour has passed`}
                </div>
                <div className="opacity-80">
                  Time is measured from when the incident was recorded, which may be later than the crash itself.
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 id="nearest-heading" className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Hospital className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              Nearest government trauma hospitals
            </h3>
            {origin && <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}</span>}
          </div>

          {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
          {!origin ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Pick an incident or enter a valid location.</p>
          ) : !facilities ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Finding hospitals…</p>
          ) : (
            <ol className="space-y-2">
              {facilities.facilities.map((f, idx) => (
                <li key={f.name} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {f.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {f.city}, {f.district} · {f.straight_line_km} km straight-line
                    </div>
                  </div>
                  <a
                    href={directionsUrl(origin.lat, origin.lng, f.lat, f.lng)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="shrink-0 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                    Road directions
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          )}
          {facilities && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
              {facilities.note} Road directions open in Google Maps.
            </p>
          )}
        </section>
      </div>

      {context && (
        <section className={`${card} flex items-start gap-3`} aria-labelledby="scheme-heading">
          <Ambulance className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <h3 id="scheme-heading" className="font-semibold text-slate-900 dark:text-white">{context.golden_hour_scheme.name}</h3>
            <p>{context.golden_hour_scheme.summary}</p>
            <a href={context.golden_hour_scheme.source_url} target="_blank" rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-300 hover:underline">
              Source: {context.golden_hour_scheme.source}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </section>
      )}
    </div>
  );
};

export default EmergencyResponsePage;
