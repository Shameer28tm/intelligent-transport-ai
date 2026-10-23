import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Crosshair, HelpCircle, Info, Radar } from 'lucide-react';
import {
  PremonitionEvent,
  PremonitionMeasurements,
  PremonitionPathPoint,
  PremonitionResult,
  PremonitionState,
  PremonitionTrack,
} from '../../types';

// Shared colour language for the panel and the video overlay.
// Observed = solid, projected = dashed. Red is intentionally unused: no validated high-risk tier exists.
export const PREMONITION_COLORS = {
  neutral: '#0284c7', // sky-600: monitoring / normal projection
  concern: '#d97706', // amber-600: potential conflict
  unknown: '#94a3b8', // slate-400: insufficient evidence
};

const STATE_META: Record<PremonitionState, { label: string; tone: string; dot: string; summary: string }> = {
  MONITORING: {
    label: 'Monitoring',
    tone: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900',
    dot: 'bg-sky-500',
    summary: 'Waiting for vehicles to appear in the frame.',
  },
  NO_CONFLICT_DETECTED: {
    label: 'No Conflict Detected',
    tone: 'text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-500',
    summary: 'Projected paths of nearby vehicles stay above the separation threshold.',
  },
  POTENTIAL_CONFLICT: {
    label: 'Potential Conflict',
    tone: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
    summary: 'Two vehicles project unusually close within the horizon. Review the evidence.',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Insufficient Evidence',
    tone: 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600',
    dot: 'bg-slate-400',
    summary: 'Not enough consistent observations yet to project vehicle paths.',
  },
};

const fmt = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(digits);

interface TrafficPremonitionPanelProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  result: PremonitionResult | null;
  isLiveActive: boolean;
  onInspectMoment: (timestampSec: number) => void;
}

export const TrafficPremonitionPanel: React.FC<TrafficPremonitionPanelProps> = ({
  enabled,
  onToggle,
  result,
  isLiveActive,
  onInspectMoment,
}) => {
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const events = useMemo(() => {
    const list = result?.events ?? [];
    // Active first, then most recent
    return [...list].sort((a, b) => {
      if ((a.status === 'ACTIVE') !== (b.status === 'ACTIVE')) return a.status === 'ACTIVE' ? -1 : 1;
      return b.first_detected_sec - a.first_detected_sec;
    });
  }, [result]);

  const state: PremonitionState = result?.state ?? 'MONITORING';
  const meta = STATE_META[state];
  const topPair = result?.pairs?.[0];

  return (
    <section
      aria-labelledby="premonition-heading"
      className="rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <h3 id="premonition-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
            Traffic Premonition
          </h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
            Risk estimate · prototype
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-sky-600"
          />
          Show trajectory overlay
        </label>
      </header>

      {!enabled ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Overlay hidden. Detection and tracking run exactly as before; the risk estimate is still computed from the
          tracker output.
        </p>
      ) : !result ? (
        <div className="text-xs text-slate-500 dark:text-slate-400 py-3">
          {isLiveActive
            ? 'Waiting for the first tracked frame…'
            : 'Start Live Detection to estimate trajectory conflicts from real tracked vehicles.'}
        </div>
      ) : (
        <>
          {/* Current state */}
          <div
            role="status"
            aria-live="polite"
            className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 transition-colors motion-reduce:transition-none ${meta.tone}`}
          >
            <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
            <div className="space-y-0.5 min-w-0">
              <div className="text-sm font-semibold">{meta.label}</div>
              <p className="text-xs opacity-90">{meta.summary}</p>
              <p className="text-[11px] opacity-75 font-mono">
                t = {fmt(result.timestamp_sec, 2)} s · {result.tracks.length} vehicles in frame ·{' '}
                {result.pairs_evaluated} pairs evaluated
              </p>
            </div>
          </div>

          {topPair && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric
                label="Closest projected gap"
                value={`${fmt(topPair.measurements.closest_projected_separation_fh)} fh`}
                hint={`threshold ${fmt(topPair.measurements.separation_threshold_fh)} fh`}
              />
              <Metric
                label="Time to closest approach"
                value={
                  topPair.measurements.time_to_closest_approach_sec !== null
                    ? `${fmt(topPair.measurements.time_to_closest_approach_sec, 2)} s`
                    : '—'
                }
                hint={`horizon ${topPair.measurements.horizon_sec} s`}
              />
              <Metric
                label="Pair"
                value={`#${topPair.track_ids[0]} · #${topPair.track_ids[1]}`}
                hint={topPair.measurements.interaction_geometry.replace(/_/g, ' ').toLowerCase()}
              />
            </div>
          )}

          {/* Candidate events */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Candidate conflict events</h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{events.length}</span>
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No candidate conflicts in this session yet.</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {events.map((ev) => (
                  <EventRow
                    key={ev.event_id}
                    event={ev}
                    open={openEventId === ev.event_id}
                    onToggle={() => setOpenEventId(openEventId === ev.event_id ? null : ev.event_id)}
                    onInspectMoment={onInspectMoment}
                    reasonText={result.reason_text}
                  />
                ))}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
            Image-plane estimate from tracked boxes. Distances are fractions of frame height (fh), not metres; this is
            not a probability or a collision prediction.
          </p>
        </>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2 py-2">
    <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="text-sm font-semibold text-slate-900 dark:text-white font-mono">{value}</div>
    {hint && <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{hint}</div>}
  </div>
);

const STATUS_STYLE: Record<PremonitionEvent['status'], string> = {
  ACTIVE: 'text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50',
  CLOSED: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800',
  INTERRUPTED: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800',
};

const EventRow: React.FC<{
  event: PremonitionEvent;
  open: boolean;
  onToggle: () => void;
  onInspectMoment: (t: number) => void;
  reasonText: Record<string, string>;
}> = ({ event, open, onToggle, onInspectMoment, reasonText }) => {
  const m = event.peak.measurements;
  const panelId = `premonition-evidence-${event.event_id}`;
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            Vehicles #{event.track_ids[0]} and #{event.track_ids[1]}
            <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${STATUS_STYLE[event.status]}`}>
              {event.status.toLowerCase()}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {fmt(event.first_detected_sec, 2)}–{fmt(event.last_detected_sec, 2)} s · gap {fmt(m.closest_projected_separation_fh)} fh
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="shrink-0 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Why this warning?
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <div id={panelId} className="border-t border-slate-200 dark:border-slate-800 px-3 py-3 space-y-3">
          <EvidencePlot tracks={event.peak.tracks} measurements={m} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onInspectMoment(event.peak.timestamp_sec)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
              Pause at {fmt(event.peak.timestamp_sec, 2)} s
            </button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Evidence snapshot taken at the smallest projected gap.
            </span>
          </div>

          <MeasurementTable m={m} />

          <div>
            <h5 className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">Why it was flagged</h5>
            <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 list-disc pl-4">
              {event.peak.reasons.map((r) => (
                <li key={r}>{reasonText[r] ?? r.replace(/_/g, ' ').toLowerCase()}</li>
              ))}
            </ul>
          </div>

          <QualityTable tracks={event.peak.tracks} />
        </div>
      )}
    </li>
  );
};

const MeasurementTable: React.FC<{ m: PremonitionMeasurements }> = ({ m }) => {
  const below = m.closest_projected_separation_fh < m.separation_threshold_fh;
  const rows: [string, string][] = [
    ['Current separation', `${fmt(m.current_separation_fh)} fh`],
    ['Closest projected separation', `${fmt(m.closest_projected_separation_fh)} fh ${below ? '<' : '≥'} threshold ${fmt(m.separation_threshold_fh)} fh`],
    ['Time to closest approach', m.time_to_closest_approach_sec !== null ? `${fmt(m.time_to_closest_approach_sec, 2)} s (horizon ${m.horizon_sec} s)` : '—'],
    ['Closing speed', `${fmt(m.closing_speed_fh_per_s)} fh/s`],
    ['Projected gap reduction', `${fmt(m.projected_gap_reduction_fh)} fh`],
    ['Interaction geometry', `${m.interaction_geometry.replace(/_/g, ' ').toLowerCase()}${m.heading_difference_deg !== null ? ` (${fmt(m.heading_difference_deg, 0)}°)` : ''}`],
  ];
  return (
    <table className="w-full text-[11px]">
      <caption className="sr-only">Measurements behind this estimate</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
            <th scope="row" className="text-left font-normal text-slate-500 dark:text-slate-400 py-1 pr-2 align-top">
              {k}
            </th>
            <td className="text-right font-mono text-slate-800 dark:text-slate-100 py-1">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const QualityTable: React.FC<{ tracks: PremonitionTrack[] }> = ({ tracks }) => (
  <div>
    <h5 className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">Data quality and limitations</h5>
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-slate-500 dark:text-slate-400">
          <th scope="col" className="text-left font-normal">Track</th>
          <th scope="col" className="text-right font-normal">Quality</th>
          <th scope="col" className="text-right font-normal">Obs.</th>
          <th scope="col" className="text-right font-normal">Span</th>
          <th scope="col" className="text-right font-normal">Fit RMS</th>
          <th scope="col" className="text-right font-normal">Det. conf.</th>
        </tr>
      </thead>
      <tbody className="font-mono text-slate-800 dark:text-slate-100">
        {tracks.map((t) => (
          <tr key={t.track_id}>
            <td>#{t.track_id} {t.class_name}</td>
            <td className="text-right">{t.data_quality.toLowerCase()}</td>
            <td className="text-right">{t.observation_count}</td>
            <td className="text-right">{fmt(t.observed_span_sec, 2)} s</td>
            <td className="text-right">{fmt(t.fit_rms_fh)} fh</td>
            <td className="text-right">{t.mean_detection_confidence !== null ? fmt(t.mean_detection_confidence, 2) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      Detection confidence is the model's per-box score, not the probability of a conflict. Perspective, turning,
      braking and tracker ID switches are not modelled.
    </p>
  </div>
);

// Small 16:9 plot of the evidence snapshot: observed path solid, projection dashed.
const EvidencePlot: React.FC<{ tracks: PremonitionTrack[]; measurements: PremonitionMeasurements }> = ({
  tracks,
  measurements,
}) => {
  const W = 320;
  const H = 180;
  const toPts = (pts: PremonitionPathPoint[]) => pts.map((p) => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' ');

  // Closest-approach markers: the projected point nearest in time to t + TTCA, per track
  const markers = tracks.map((t) => {
    const last = t.observed_path[t.observed_path.length - 1];
    const ttca = measurements.time_to_closest_approach_sec;
    if (!last || ttca === null || t.projected_path.length === 0) return null;
    const target = last.timestamp_sec + Math.min(ttca, measurements.horizon_sec);
    return t.projected_path.reduce((best, p) =>
      Math.abs(p.timestamp_sec - target) < Math.abs(best.timestamp_sec - target) ? p : best
    );
  });

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
        role="img"
        aria-label="Observed trajectories as solid lines and projected trajectories as dashed lines for the two vehicles"
      >
        {tracks.map((t, i) => (
          <g key={t.track_id} className={i === 0 ? 'text-slate-900 dark:text-slate-200' : 'text-sky-600 dark:text-sky-400'}>
            <polyline points={toPts(t.observed_path)} fill="none" stroke="currentColor" strokeWidth={2} />
            {t.projected_path.length > 0 && (
              <polyline
                points={toPts([t.observed_path[t.observed_path.length - 1], ...t.projected_path].filter(Boolean))}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
            {t.observed_path.length > 0 && (
              <>
                <circle
                  cx={t.observed_path[t.observed_path.length - 1].x * W}
                  cy={t.observed_path[t.observed_path.length - 1].y * H}
                  r={3.5}
                  fill="currentColor"
                />
                <text
                  x={t.observed_path[t.observed_path.length - 1].x * W + 6}
                  y={t.observed_path[t.observed_path.length - 1].y * H - 6}
                  fontSize={10}
                  fill="currentColor"
                  fontFamily="ui-monospace, monospace"
                >
                  #{t.track_id}
                </text>
              </>
            )}
          </g>
        ))}
        {markers.map(
          (p, i) =>
            p && (
              <circle
                key={`m${i}`}
                cx={p.x * W}
                cy={p.y * H}
                r={6}
                fill="none"
                stroke={PREMONITION_COLORS.concern}
                strokeWidth={2}
              />
            )
        )}
      </svg>
      <figcaption className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
        <span>— observed</span>
        <span>- - projected ({measurements.horizon_sec} s)</span>
        <span style={{ color: PREMONITION_COLORS.concern }}>○ projected closest approach</span>
      </figcaption>
    </figure>
  );
};

export default TrafficPremonitionPanel;
