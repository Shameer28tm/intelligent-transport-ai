import React, { useState } from 'react';
import { Bike, ChevronDown, ChevronUp, Crosshair, Info, MoveVertical } from 'lucide-react';
import { RiderSafetyEvent, RiderSafetyResult } from '../../types';

export type PermittedDirection = 'none' | 'up' | 'down' | 'left' | 'right';

interface RiderSafetyPanelProps {
  result: RiderSafetyResult | null;
  isLiveActive: boolean;
  permittedDirection: PermittedDirection;
  onChangeDirection: (d: PermittedDirection) => void;
  onInspectMoment: (timestampSec: number) => void;
}

const KIND_LABEL: Record<RiderSafetyEvent['kind'], string> = {
  TRIPLE_RIDING: 'Triple riding',
  WRONG_SIDE: 'Wrong-side driving',
};

const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d));

export const RiderSafetyPanel: React.FC<RiderSafetyPanelProps> = ({
  result,
  isLiveActive,
  permittedDirection,
  onChangeDirection,
  onInspectMoment,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const events = [...(result?.events ?? [])].sort((a, b) => b.first_detected_sec - a.first_detected_sec);

  return (
    <section
      aria-labelledby="rider-safety-heading"
      className="rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <h3 id="rider-safety-heading" className="text-sm font-semibold text-slate-900 dark:text-white">Rider Safety</h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
            Candidates for review
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <MoveVertical className="h-3.5 w-3.5" aria-hidden="true" />
          Permitted direction in this view
          <select
            value={permittedDirection}
            onChange={(e) => onChangeDirection(e.target.value as PermittedDirection)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
          >
            <option value="none">Not set (wrong-side off)</option>
            <option value="down">Towards camera bottom</option>
            <option value="up">Towards camera top</option>
            <option value="right">Left to right</option>
            <option value="left">Right to left</option>
          </select>
        </label>
      </header>

      {!result ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isLiveActive ? 'Waiting for the first tracked frame…' : 'Start Live Detection to check for triple riding and wrong-side driving.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Motorcycles in frame" value={String(result.motorcycles_in_frame)} />
            <Metric label="Riders matched" value={String(result.riders_matched)} />
            <Metric label="Helmet check" value="Not available" hint="needs a helmet model" />
          </div>

          {!result.wrong_side_enabled && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Set the permitted direction for this camera view to enable wrong-side checks.
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Flagged for review</h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{events.length}</span>
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nothing flagged in this session yet.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {events.map((ev) => {
                  const open = openId === ev.event_id;
                  const id = `rider-evidence-${ev.event_id}`;
                  return (
                    <li key={ev.event_id} className="rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white">
                            {KIND_LABEL[ev.kind]} · {ev.class_name ?? 'vehicle'} #{ev.track_id}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {fmt(ev.first_detected_sec)}–{fmt(ev.last_detected_sec)} s
                            {ev.kind === 'TRIPLE_RIDING' && ` · ${ev.evidence.rider_count} riders`}
                            {ev.status_note ? ` · ${ev.status_note.toLowerCase()}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : ev.event_id)}
                          aria-expanded={open}
                          aria-controls={id}
                          className="shrink-0 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1"
                        >
                          Evidence
                          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {open && (
                        <div id={id} className="border-t border-slate-200 dark:border-slate-800 px-3 py-3 space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {ev.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                          {ev.kind === 'WRONG_SIDE' && (
                            <p className="font-mono">
                              direction cosine {fmt(ev.evidence.direction_cosine)} · displacement {fmt(ev.evidence.displacement, 3)} over {fmt(ev.evidence.window_sec)} s
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => onInspectMoment(ev.evidence.timestamp_sec ?? ev.first_detected_sec)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                          >
                            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                            Pause at {fmt(ev.evidence.timestamp_sec ?? ev.first_detected_sec)} s
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
            Rule-based candidates from YOLO person and motorcycle boxes. They need human review and are not offence records or
            e-challan evidence. Helmet use is not checked.
          </p>
        </>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2 py-2">
    <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    {hint && <div className="text-[10px] text-slate-500 dark:text-slate-400">{hint}</div>}
  </div>
);

export default RiderSafetyPanel;
