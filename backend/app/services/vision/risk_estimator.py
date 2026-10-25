"""
Traffic Premonition — deterministic trajectory conflict-risk estimator.

Consumes the vehicle tracks produced by the existing IoU tracker (track IDs,
normalised boxes, video timestamps) and estimates, for nearby vehicle pairs,
whether their recent image-plane motion projects them unusually close together
within a short horizon.

Important scope notes (surfaced to the UI through ``LIMITATIONS``):
- All geometry is in the image plane. Distances are expressed in
  "frame-height units" (fh): 1.0 fh = the full height of the video frame.
  They are NOT metres, and the derived times are NOT a calibrated
  real-world time-to-collision.
- Motion is a least-squares constant-velocity fit over a short rolling window.
  Turning, braking and perspective foreshortening are not modelled.
- Output is a risk *estimate* with explainable reason codes. It is not a
  probability and not a prediction that a collision will occur.

The module has no framework dependencies so it can be unit-tested in isolation.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Deque, Dict, Iterable, List, Optional, Tuple

# ---------------------------------------------------------------------------
# States and reason codes
# ---------------------------------------------------------------------------
STATE_MONITORING = "MONITORING"
STATE_POTENTIAL_CONFLICT = "POTENTIAL_CONFLICT"
STATE_INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
STATE_NO_CONFLICT = "NO_CONFLICT_DETECTED"

REASON_TEXT: Dict[str, str] = {
    "NO_ACTIVE_VEHICLES": "No vehicles are visible in the current frame.",
    "FEWER_THAN_TWO_QUALIFIED_TRACKS": "Fewer than two vehicles have enough recent observations to project.",
    "INSUFFICIENT_OBSERVATIONS": "Not enough recent observations for this vehicle.",
    "LOW_MOTION_CONSISTENCY": "Observed movement is too irregular for a straight-line projection.",
    "CLOSING": "The two vehicles are getting closer.",
    "PROJECTED_SEPARATION_BELOW_THRESHOLD": "Projected closest separation is below the size-scaled threshold.",
    "CLOSEST_APPROACH_WITHIN_HORIZON": "Closest approach is within the projection horizon.",
    "INVALID_TIMESTAMP": "The frame timestamp was missing or invalid, so it was ignored.",
    "GAP_REDUCTION_SIGNIFICANT": "The projected gap shrinks by a meaningful amount.",
    "DIVERGING": "The vehicles are moving apart.",
    "PARALLEL_OR_STATIONARY": "Relative motion is negligible (parallel travel or both stationary).",
    "CLOSING_TOO_SLOWLY": "The vehicles are closing too slowly to matter within the horizon.",
    "CLOSEST_APPROACH_BEYOND_HORIZON": "Closest approach is beyond the projection horizon.",
    "SEPARATION_ABOVE_THRESHOLD": "Projected separation stays above the threshold.",
    "GAP_REDUCTION_SMALL": "The projected gap barely changes.",
    "BOXES_ALREADY_OVERLAP": "Boxes already overlap in the image; this can be perspective, not contact.",
    "OUT_OF_REACH_WITHIN_HORIZON": "Too far apart to come close within the horizon at current speeds.",
}

VEHICLE_CLASSES = frozenset({"car", "bus", "truck", "motorcycle", "bicycle"})
PEDESTRIAN = "pedestrian"  # COCO person; included for vehicle-pedestrian pairs only

LIMITATIONS: List[str] = [
    "Image-plane estimate: distances are in frame-height units (fh), not metres.",
    "Times are video seconds under a straight-line projection, not a calibrated time-to-collision.",
    "Perspective can make vehicles in different lanes or depths appear to overlap.",
    "Turning, braking and occlusion are not modelled; tracker ID switches can break a trajectory.",
    "This is a risk estimate for review, not a probability or a guarantee that a collision will occur.",
]


@dataclass(frozen=True)
class RiskEstimatorConfig:
    history_size: int = 12              # max observations kept per track
    history_window_sec: float = 2.5     # only observations this recent are used for the fit
    min_observations: int = 4           # observations required before projecting
    min_span_sec: float = 0.5           # time span the observations must cover
    max_gap_sec: float = 1.0            # a larger gap between observations restarts the track history
    stale_after_sec: float = 1.0        # tracks not seen for this long are dropped
    horizon_sec: float = 1.5            # projection horizon
    projection_step_sec: float = 0.25   # spacing of projected points returned for drawing
    separation_factor: float = 0.6      # conflict threshold = factor * mean box size (fh)
    min_threshold_fh: float = 0.02      # floor for the threshold
    min_closing_speed_fh_s: float = 0.04
    min_relative_speed_fh_s: float = 0.02
    min_gap_reduction_fh: float = 0.02
    max_fit_rms_fh: float = 0.025       # above this residual a track is "inconsistent"
    max_pairs: int = 60                 # hard cap on evaluated pairs per frame
    include_pedestrians: bool = True    # evaluate vehicle-pedestrian pairs (never pedestrian-pedestrian)
    reset_backstep_sec: float = 0.05    # timestamp going back by more than this = seek/reset
    event_close_after_sec: float = 1.0  # an event closes after this long without conflict
    max_events: int = 100
    max_observed_points_out: int = 10


@dataclass
class _Obs:
    t: float
    x: float      # aspect-corrected, in frame-height units
    y: float      # frame-height units
    size: float   # sqrt(w*h) of the box, frame-height units
    conf: float


@dataclass
class _Fit:
    x: float
    y: float
    vx: float
    vy: float
    rms: float
    n: int
    span: float
    mean_conf: float
    size: float


@dataclass
class _Event:
    event_id: str
    track_ids: Tuple[int, int]
    class_names: Tuple[str, str]
    first_detected_sec: float
    last_detected_sec: float
    status: str = "ACTIVE"
    update_count: int = 1
    peak: Dict = field(default_factory=dict)


def _finite(*vals: float) -> bool:
    return all(isinstance(v, (int, float)) and math.isfinite(v) for v in vals)


def _r(v: Optional[float], nd: int = 4) -> Optional[float]:
    return None if v is None else round(float(v), nd)


class TrajectoryRiskEstimator:
    """Per-session estimator. Feed one frame at a time with ``process_frame``."""

    def __init__(self, config: Optional[RiskEstimatorConfig] = None):
        self.config = config or RiskEstimatorConfig()
        self.reset()

    # ------------------------------------------------------------------ state
    def reset(self) -> None:
        self._history: Dict[int, Deque[_Obs]] = {}
        self._classes: Dict[int, str] = {}
        self._last_ts: Optional[float] = None
        self._events: Dict[str, _Event] = {}
        self._open_by_pair: Dict[Tuple[int, int], str] = {}
        self._event_seq: int = 0
        self._epoch: int = 0
        self.rejected_observations: int = 0

    def _soft_reset_for_seek(self) -> None:
        """Timestamp moved backwards: clear trajectories, close open events, keep the event log."""
        self._history.clear()
        self._classes.clear()
        for pair, eid in list(self._open_by_pair.items()):
            self._events[eid].status = "INTERRUPTED"
        self._open_by_pair.clear()
        self._epoch += 1

    # --------------------------------------------------------------- ingest
    def _ingest(self, detections: Iterable[Dict], ts: float, aspect: float) -> List[int]:
        cfg = self.config
        seen: List[int] = []
        detections = list(detections)
        # Persons sitting on a two-wheeler are riders, not pedestrians: exclude them so a
        # motorcycle conflict is not double-counted through its rider.
        two_wheeler_boxes = []
        for det in detections:
            if det.get("class_name") in ("motorcycle", "bicycle"):
                b = det.get("box") or {}
                try:
                    two_wheeler_boxes.append(tuple(float(b[k]) for k in ("x_min", "y_min", "x_max", "y_max")))
                except (KeyError, TypeError, ValueError):
                    pass

        def _is_rider(box: Dict) -> bool:
            try:
                cx = (float(box["x_min"]) + float(box["x_max"])) / 2.0
                foot = float(box["y_max"])
            except (KeyError, TypeError, ValueError):
                return False
            for (mx0, my0, mx1, my1) in two_wheeler_boxes:
                h = my1 - my0
                if mx0 <= cx <= mx1 and my0 - 0.1 * h <= foot <= my1 + 0.15 * h:
                    return True
            return False

        for det in detections:
            tid = det.get("track_id")
            cls = det.get("class_name")
            box = det.get("box") or {}
            if cls == PEDESTRIAN:
                if not cfg.include_pedestrians or _is_rider(box):
                    continue
            elif cls not in VEHICLE_CLASSES:
                continue  # signs, traffic lights etc. are out of scope
            if not isinstance(tid, int) or isinstance(tid, bool):
                self.rejected_observations += 1  # missing or malformed track ID
                continue
            try:
                x0, y0, x1, y1 = (float(box[k]) for k in ("x_min", "y_min", "x_max", "y_max"))
                conf = float(det.get("confidence", 0.0))
            except (KeyError, TypeError, ValueError):
                self.rejected_observations += 1
                continue
            if not _finite(x0, y0, x1, y1, conf) or not (-0.01 <= x0 < x1 <= 1.01 and -0.01 <= y0 < y1 <= 1.01):
                self.rejected_observations += 1
                continue
            if tid in seen:  # duplicate ID within one frame: keep the first
                continue

            obs = _Obs(
                t=ts,
                x=((x0 + x1) / 2.0) * aspect,
                y=(y0 + y1) / 2.0,
                size=math.sqrt(max(x1 - x0, 1e-6) * aspect * max(y1 - y0, 1e-6)),
                conf=conf,
            )
            hist = self._history.get(tid)
            if hist is None or self._classes.get(tid) != cls:
                hist = deque(maxlen=cfg.history_size)
                self._history[tid] = hist
                self._classes[tid] = cls
            elif hist and (ts - hist[-1].t) > cfg.max_gap_sec:
                hist.clear()  # dropped frames / re-identified track: restart the trajectory
            if hist and abs(ts - hist[-1].t) < 1e-6:
                hist[-1] = obs  # same frame sent twice
            else:
                hist.append(obs)
            seen.append(tid)

        # Drop stale tracks
        for tid in [t for t, h in self._history.items() if not h or (ts - h[-1].t) > cfg.stale_after_sec]:
            self._history.pop(tid, None)
            self._classes.pop(tid, None)
        return seen

    # ------------------------------------------------------------------ fit
    def _fit(self, tid: int, ts: float) -> Optional[_Fit]:
        cfg = self.config
        pts = [o for o in self._history.get(tid, ()) if ts - o.t <= cfg.history_window_sec]
        n = len(pts)
        if n < 2:
            return None
        t_mean = sum(o.t for o in pts) / n
        dts = [o.t - t_mean for o in pts]
        stt = sum(d * d for d in dts)
        span = pts[-1].t - pts[0].t
        if stt <= 1e-9:
            return None
        x_mean = sum(o.x for o in pts) / n
        y_mean = sum(o.y for o in pts) / n
        vx = sum(d * (o.x - x_mean) for d, o in zip(dts, pts)) / stt
        vy = sum(d * (o.y - y_mean) for d, o in zip(dts, pts)) / stt
        res = [
            (o.x - (x_mean + vx * d)) ** 2 + (o.y - (y_mean + vy * d)) ** 2 for d, o in zip(dts, pts)
        ]
        rms = math.sqrt(sum(res) / n)
        dt_now = ts - t_mean
        return _Fit(
            x=x_mean + vx * dt_now,
            y=y_mean + vy * dt_now,
            vx=vx,
            vy=vy,
            rms=rms,
            n=n,
            span=span,
            mean_conf=sum(o.conf for o in pts) / n,
            size=sum(o.size for o in pts[-3:]) / len(pts[-3:]),
        )

    def _quality(self, fit: Optional[_Fit]) -> Tuple[str, List[str]]:
        cfg = self.config
        if fit is None or fit.n < cfg.min_observations or fit.span < cfg.min_span_sec:
            return "INSUFFICIENT", ["INSUFFICIENT_OBSERVATIONS"]
        if fit.rms > cfg.max_fit_rms_fh:
            return "LOW", ["LOW_MOTION_CONSISTENCY"]
        if fit.rms <= cfg.max_fit_rms_fh * 0.5 and fit.n >= cfg.min_observations + 2 and fit.mean_conf >= 0.5:
            return "HIGH", []
        return "MEDIUM", []

    # ---------------------------------------------------------------- pairs
    def _evaluate_pair(self, a: int, fa: _Fit, b: int, fb: _Fit) -> Dict:
        cfg = self.config
        H = cfg.horizon_sec
        px, py = fb.x - fa.x, fb.y - fa.y
        vx, vy = fb.vx - fa.vx, fb.vy - fa.vy
        dist = math.hypot(px, py)
        rel_speed = math.hypot(vx, vy)
        threshold = max(cfg.min_threshold_fh, cfg.separation_factor * (fa.size + fb.size) / 2.0)
        closing = -(px * vx + py * vy) / dist if dist > 1e-9 else 0.0

        if rel_speed ** 2 > 1e-12:
            t_star = -(px * vx + py * vy) / (rel_speed ** 2)
        else:
            t_star = 0.0
        t_c = min(max(t_star, 0.0), H)
        d_min = math.hypot(px + vx * t_c, py + vy * t_c)
        gap_reduction = dist - d_min

        speed_a, speed_b = math.hypot(fa.vx, fa.vy), math.hypot(fb.vx, fb.vy)
        if speed_a < cfg.min_relative_speed_fh_s or speed_b < cfg.min_relative_speed_fh_s:
            geometry = "ONE_OR_BOTH_STATIONARY"
            heading_diff = None
        else:
            cosang = (fa.vx * fb.vx + fa.vy * fb.vy) / (speed_a * speed_b)
            heading_diff = math.degrees(math.acos(max(-1.0, min(1.0, cosang))))
            geometry = "SAME_DIRECTION" if heading_diff < 30 else "OPPOSING" if heading_diff > 150 else "CROSSING"

        reasons: List[str] = []
        if dist < threshold:
            reasons.append("BOXES_ALREADY_OVERLAP")

        if rel_speed < cfg.min_relative_speed_fh_s:
            state, why = STATE_NO_CONFLICT, ["PARALLEL_OR_STATIONARY"]
        elif t_star <= 0.0:
            state, why = STATE_NO_CONFLICT, ["DIVERGING"]
        elif closing < cfg.min_closing_speed_fh_s:
            state, why = STATE_NO_CONFLICT, ["CLOSING_TOO_SLOWLY"]
        elif t_star > H and d_min >= threshold:
            state, why = STATE_NO_CONFLICT, ["CLOSEST_APPROACH_BEYOND_HORIZON"]
        elif d_min >= threshold:
            state, why = STATE_NO_CONFLICT, ["SEPARATION_ABOVE_THRESHOLD"]
        elif gap_reduction < cfg.min_gap_reduction_fh:
            state, why = STATE_NO_CONFLICT, ["GAP_REDUCTION_SMALL"]
        else:
            state = STATE_POTENTIAL_CONFLICT
            approach_reason = (
                "CLOSEST_APPROACH_WITHIN_HORIZON" if t_star <= H else "CLOSEST_APPROACH_BEYOND_HORIZON"
            )
            why = [
                "CLOSING",
                "PROJECTED_SEPARATION_BELOW_THRESHOLD",
                approach_reason,
                "GAP_REDUCTION_SIGNIFICANT",
            ]
        reasons = why + reasons

        return {
            "track_ids": [a, b],
            "class_names": [self._classes.get(a), self._classes.get(b)],
            "pair_type": "VEHICLE_PEDESTRIAN" if PEDESTRIAN in (self._classes.get(a), self._classes.get(b)) else "VEHICLE_VEHICLE",
            "state": state,
            "reasons": reasons,
            "measurements": {
                "current_separation_fh": _r(dist),
                "closest_projected_separation_fh": _r(d_min),
                "separation_threshold_fh": _r(threshold),
                "time_to_closest_approach_sec": _r(t_star, 2) if t_star > 0 else None,
                "closing_speed_fh_per_s": _r(closing),
                "relative_speed_fh_per_s": _r(rel_speed),
                "projected_gap_reduction_fh": _r(gap_reduction),
                "heading_difference_deg": _r(heading_diff, 1),
                "interaction_geometry": geometry,
                "horizon_sec": H,
            },
        }

    # ----------------------------------------------------------- serialise
    def _track_out(self, tid: int, fit: Optional[_Fit], quality: str, q_reasons: List[str],
                   ts: float, aspect: float) -> Dict:
        cfg = self.config
        hist = list(self._history.get(tid, ()))[-cfg.max_observed_points_out:]
        observed = [{"x": _r(o.x / aspect), "y": _r(o.y), "timestamp_sec": _r(o.t, 3)} for o in hist]
        projected: List[Dict] = []
        if fit is not None and quality in ("HIGH", "MEDIUM"):
            steps = int(round(cfg.horizon_sec / cfg.projection_step_sec))
            for k in range(1, steps + 1):
                dt = k * cfg.projection_step_sec
                projected.append({
                    "x": _r((fit.x + fit.vx * dt) / aspect),
                    "y": _r(fit.y + fit.vy * dt),
                    "timestamp_sec": _r(ts + dt, 3),
                })
        return {
            "track_id": tid,
            "class_name": self._classes.get(tid),
            "data_quality": quality,
            "quality_reasons": q_reasons,
            "observation_count": fit.n if fit else len(hist),
            "observed_span_sec": _r(fit.span, 2) if fit else 0.0,
            "fit_rms_fh": _r(fit.rms) if fit else None,
            "mean_detection_confidence": _r(fit.mean_conf, 3) if fit else None,
            "velocity_fh_per_s": {"vx": _r(fit.vx), "vy": _r(fit.vy)} if fit else None,
            "observed_path": observed,
            "projected_path": projected,
        }

    # --------------------------------------------------------------- events
    def _update_events(self, conflicts: List[Dict], tracks_by_id: Dict[int, Dict], ts: float) -> None:
        cfg = self.config
        for c in conflicts:
            pair = tuple(sorted(c["track_ids"]))
            snapshot = {
                "timestamp_sec": _r(ts, 3),
                "measurements": c["measurements"],
                "reasons": c["reasons"],
                "tracks": [tracks_by_id[t] for t in pair if t in tracks_by_id],
            }
            eid = self._open_by_pair.get(pair)
            if eid is None:
                self._event_seq += 1
                eid = f"PC-{self._epoch:02d}-{self._event_seq:04d}"
                ev = _Event(
                    event_id=eid,
                    track_ids=pair,
                    class_names=tuple(self._classes.get(t) for t in pair),
                    first_detected_sec=_r(ts, 3),
                    last_detected_sec=_r(ts, 3),
                    peak=snapshot,
                )
                self._events[eid] = ev
                self._open_by_pair[pair] = eid
            else:
                ev = self._events[eid]
                ev.last_detected_sec = _r(ts, 3)
                ev.update_count += 1
                prev = ev.peak.get("measurements", {}).get("closest_projected_separation_fh")
                cur = c["measurements"]["closest_projected_separation_fh"]
                if prev is None or (cur is not None and cur < prev):
                    ev.peak = snapshot

        for pair, eid in list(self._open_by_pair.items()):
            if ts - self._events[eid].last_detected_sec > cfg.event_close_after_sec:
                self._events[eid].status = "CLOSED"
                del self._open_by_pair[pair]

        if len(self._events) > cfg.max_events:
            open_ids = set(self._open_by_pair.values())
            for eid in sorted(self._events, key=lambda e: self._events[e].first_detected_sec):
                if len(self._events) <= cfg.max_events:
                    break
                if eid not in open_ids:
                    del self._events[eid]

    def events(self) -> List[Dict]:
        out = []
        for ev in sorted(self._events.values(), key=lambda e: (e.first_detected_sec, e.event_id)):
            d = asdict(ev)
            d["track_ids"] = list(ev.track_ids)
            d["class_names"] = list(ev.class_names)
            d["kind"] = "TRAJECTORY_RISK_ESTIMATE"
            d["is_prediction"] = True
            out.append(d)
        return out

    # ------------------------------------------------------------------ main
    def process_frame(self, detections: Iterable[Dict], timestamp_sec: Optional[float],
                      aspect_ratio: float = 16 / 9) -> Dict:
        """Ingest one frame of tracked detections and return the current risk assessment."""
        cfg = self.config
        if not _finite(aspect_ratio) or aspect_ratio <= 0:
            aspect_ratio = 16 / 9
        if timestamp_sec is None or not _finite(timestamp_sec) or timestamp_sec < 0:
            self.rejected_observations += 1
            return self._result(STATE_INSUFFICIENT_EVIDENCE, ["INVALID_TIMESTAMP"], None, [], [], 0, 0)

        ts = float(timestamp_sec)
        if self._last_ts is not None and ts < self._last_ts - cfg.reset_backstep_sec:
            self._soft_reset_for_seek()
        self._last_ts = ts

        seen = self._ingest(detections, ts, aspect_ratio)
        fits: Dict[int, _Fit] = {}
        tracks_out: List[Dict] = []
        qualified: List[int] = []
        for tid in sorted(seen):
            fit = self._fit(tid, ts)
            quality, q_reasons = self._quality(fit)
            tracks_out.append(self._track_out(tid, fit, quality, q_reasons, ts, aspect_ratio))
            if fit is not None:
                fits[tid] = fit
            if quality in ("HIGH", "MEDIUM"):
                qualified.append(tid)

        if not any(self._classes.get(t) in VEHICLE_CLASSES for t in seen):
            self._update_events([], {}, ts)
            return self._result(STATE_MONITORING, ["NO_ACTIVE_VEHICLES"], ts, tracks_out, [], 0, 0)
        if len(qualified) < 2 or not any(self._classes.get(t) in VEHICLE_CLASSES for t in qualified):
            self._update_events([], {}, ts)
            return self._result(STATE_INSUFFICIENT_EVIDENCE, ["FEWER_THAN_TWO_QUALIFIED_TRACKS"], ts,
                                tracks_out, [], 0, 0)

        # Candidate pairs: prune pairs that cannot meet within the horizon, then cap by distance.
        candidates: List[Tuple[float, int, int]] = []
        pruned = 0
        for i, a in enumerate(qualified):
            fa = fits[a]
            for b in qualified[i + 1:]:
                if self._classes.get(a) == PEDESTRIAN and self._classes.get(b) == PEDESTRIAN:
                    continue  # pedestrian-pedestrian pairs are out of scope
                fb = fits[b]
                dist = math.hypot(fb.x - fa.x, fb.y - fa.y)
                reach = math.hypot(fb.vx - fa.vx, fb.vy - fa.vy) * cfg.horizon_sec
                threshold = max(cfg.min_threshold_fh, cfg.separation_factor * (fa.size + fb.size) / 2.0)
                if dist - reach > threshold:
                    pruned += 1
                    continue
                candidates.append((dist, a, b))
        candidates.sort()
        if len(candidates) > cfg.max_pairs:
            pruned += len(candidates) - cfg.max_pairs
            candidates = candidates[: cfg.max_pairs]

        pairs = [self._evaluate_pair(a, fits[a], b, fits[b]) for _, a, b in candidates]
        conflicts = [p for p in pairs if p["state"] == STATE_POTENTIAL_CONFLICT]
        tracks_by_id = {t["track_id"]: t for t in tracks_out}
        self._update_events(conflicts, tracks_by_id, ts)

        if conflicts:
            state, reasons = STATE_POTENTIAL_CONFLICT, ["CLOSING", "PROJECTED_SEPARATION_BELOW_THRESHOLD"]
        else:
            state, reasons = STATE_NO_CONFLICT, ["SEPARATION_ABOVE_THRESHOLD"]
        pairs.sort(key=lambda p: (p["state"] != STATE_POTENTIAL_CONFLICT,
                                  p["measurements"]["closest_projected_separation_fh"] or 0.0))
        return self._result(state, reasons, ts, tracks_out, pairs[:10], len(pairs), pruned)

    def _result(self, state: str, reasons: List[str], ts: Optional[float], tracks: List[Dict],
                pairs: List[Dict], evaluated: int, pruned: int) -> Dict:
        cfg = self.config
        open_ids = set(self._open_by_pair.values())
        return {
            "engine": "Deterministic constant-velocity trajectory projection (image plane)",
            "state": state,
            "reasons": reasons,
            # Full dictionary so stored events from earlier frames can always be explained
            "reason_text": dict(REASON_TEXT),
            "timestamp_sec": _r(ts, 3),
            "units": {"distance": "fh (fraction of frame height)", "time": "video seconds"},
            "pairs_evaluated": evaluated,
            "pairs_pruned": pruned,
            "pairs": pairs,
            "tracks": tracks,
            "active_event_ids": sorted(open_ids),
            "events": self.events()[-20:],
            "config": {
                "horizon_sec": cfg.horizon_sec,
                "min_observations": cfg.min_observations,
                "min_span_sec": cfg.min_span_sec,
                "separation_factor": cfg.separation_factor,
                "max_fit_rms_fh": cfg.max_fit_rms_fh,
                "min_closing_speed_fh_per_s": cfg.min_closing_speed_fh_s,
            },
            "limitations": LIMITATIONS,
            "is_prediction": True,
        }
