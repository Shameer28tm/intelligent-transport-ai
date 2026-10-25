"""
Rider Safety — observed violation *candidates* from live tracked detections.

Built for the dominant Tamil Nadu crash pattern (two-wheelers), using only what the
bundled YOLOv8n COCO model can actually see:

- TRIPLE_RIDING: three or more `pedestrian` (COCO person) boxes riding one tracked
  motorcycle for several consecutive frames.
- WRONG_SIDE: a tracked vehicle whose sustained image-plane motion opposes the
  operator-configured permitted traffic direction for this camera.

Not detected (and never claimed): helmet use. COCO has no helmet class; helmet
compliance needs a dedicated helmet model, which is not included.

Every event is a candidate for human review (status NEEDS_REVIEW), carries its
measurements as evidence, and is never written to incident history automatically.
The module is framework-free and deterministic so it can be unit-tested directly.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, Iterable, List, Optional, Tuple

TWO_WHEELERS = frozenset({"motorcycle", "bicycle"})
MOTOR_VEHICLES = frozenset({"car", "bus", "truck", "motorcycle"})
PERSON = "pedestrian"  # COCO "person" is mapped to "pedestrian" by the adapter

LIMITATIONS: List[str] = [
    "Candidates for human review, not confirmed offences or e-challan evidence.",
    "Helmet use is NOT checked: the bundled COCO model has no helmet class.",
    "Triple riding counts person boxes over a motorcycle; occlusion can hide or merge riders.",
    "Wrong-side detection depends on the permitted direction configured for this camera view.",
    "Image-plane geometry only; camera angle and perspective affect both rules.",
]

DIRECTION_VECTORS: Dict[str, Tuple[float, float]] = {
    # Image-plane unit vectors (x right, y down)
    "down": (0.0, 1.0),
    "up": (0.0, -1.0),
    "right": (1.0, 0.0),
    "left": (-1.0, 0.0),
}


@dataclass(frozen=True)
class RiderSafetyConfig:
    triple_min_riders: int = 3
    triple_min_frames: int = 3              # consecutive frames before an event is raised
    rider_box_overlap_min: float = 0.25     # fraction of the person box inside the expanded motorcycle box
    rider_x_expand: float = 0.20            # widen the motorcycle box by this fraction of its width per side
    rider_top_expand: float = 1.30          # extend upwards by this multiple of the motorcycle box height
    wrong_side_window_sec: float = 1.5
    wrong_side_min_span_sec: float = 0.6
    wrong_side_min_obs: int = 4
    wrong_side_min_displacement: float = 0.05   # normalised frame units over the window
    wrong_side_max_cos: float = -0.5            # motion within ±60° of the opposite direction
    wrong_side_min_frames: int = 2
    stale_after_sec: float = 1.5
    reset_backstep_sec: float = 0.05
    max_events: int = 100


def _area(b: Dict[str, float]) -> float:
    return max(0.0, b["x_max"] - b["x_min"]) * max(0.0, b["y_max"] - b["y_min"])


def _intersection(a: Dict[str, float], b: Dict[str, float]) -> float:
    w = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"])
    h = min(a["y_max"], b["y_max"]) - max(a["y_min"], b["y_min"])
    return max(0.0, w) * max(0.0, h)


def _valid_box(box) -> Optional[Dict[str, float]]:
    try:
        b = {k: float(box[k]) for k in ("x_min", "y_min", "x_max", "y_max")}
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(v) for v in b.values()):
        return None
    if not (-0.01 <= b["x_min"] < b["x_max"] <= 1.01 and -0.01 <= b["y_min"] < b["y_max"] <= 1.01):
        return None
    return b


def _r(v: Optional[float], nd: int = 3) -> Optional[float]:
    return None if v is None else round(float(v), nd)


class RiderSafetyMonitor:
    """Per-session monitor. Call ``process_frame`` once per tracked live frame."""

    def __init__(self, config: Optional[RiderSafetyConfig] = None):
        self.config = config or RiderSafetyConfig()
        self.reset()

    def reset(self) -> None:
        self._last_ts: Optional[float] = None
        self._triple_streak: Dict[int, int] = {}
        self._wrong_streak: Dict[int, int] = {}
        self._paths: Dict[int, Deque[Tuple[float, float, float]]] = {}
        self._classes: Dict[int, str] = {}
        self._events: Dict[str, Dict] = {}
        self._open: Dict[Tuple[str, int], str] = {}
        self._seq = 0
        self._epoch = 0

    def _soft_reset(self) -> None:
        self._triple_streak.clear()
        self._wrong_streak.clear()
        self._paths.clear()
        self._classes.clear()
        for key, eid in list(self._open.items()):
            self._events[eid]["status_note"] = "Interrupted by seek"
        self._open.clear()
        self._epoch += 1

    # ------------------------------------------------------------ triple riding
    def _assign_riders(self, motos: List[Tuple[int, Dict]], persons: List[Tuple[Optional[int], Dict]]):
        cfg = self.config
        riders: Dict[int, List[Dict]] = {tid: [] for tid, _ in motos}
        for pid, pbox in persons:
            parea = _area(pbox)
            if parea <= 0:
                continue
            best, best_frac = None, 0.0
            for mid, mbox in motos:
                w = mbox["x_max"] - mbox["x_min"]
                h = mbox["y_max"] - mbox["y_min"]
                zone = {
                    "x_min": mbox["x_min"] - cfg.rider_x_expand * w,
                    "x_max": mbox["x_max"] + cfg.rider_x_expand * w,
                    "y_min": mbox["y_min"] - cfg.rider_top_expand * h,
                    "y_max": mbox["y_max"],
                }
                foot_x = (pbox["x_min"] + pbox["x_max"]) / 2
                # A rider's lower body sits on the motorcycle: feet/hips inside the bike's vertical extent
                if not (zone["x_min"] <= foot_x <= zone["x_max"] and mbox["y_min"] - 0.1 * h <= pbox["y_max"] <= mbox["y_max"] + 0.15 * h):
                    continue
                frac = _intersection(pbox, zone) / parea
                if frac > best_frac:
                    best, best_frac = mid, frac
            if best is not None and best_frac >= cfg.rider_box_overlap_min:
                riders[best].append({"track_id": pid, "box": {k: _r(v, 4) for k, v in pbox.items()}, "overlap": _r(best_frac)})
        return riders

    # --------------------------------------------------------------- events
    def _raise(self, kind: str, track_id: int, ts: float, evidence: Dict, reasons: List[str]) -> None:
        key = (kind, track_id)
        eid = self._open.get(key)
        if eid is None:
            self._seq += 1
            eid = f"RS-{self._epoch:02d}-{self._seq:04d}"
            self._open[key] = eid
            self._events[eid] = {
                "event_id": eid,
                "kind": kind,
                "track_id": track_id,
                "class_name": self._classes.get(track_id),
                "first_detected_sec": _r(ts),
                "last_detected_sec": _r(ts),
                "status": "NEEDS_REVIEW",
                "is_observation_candidate": True,
                "update_count": 1,
                "evidence": evidence,
                "reasons": reasons,
            }
        else:
            ev = self._events[eid]
            ev["last_detected_sec"] = _r(ts)
            ev["update_count"] += 1
            # Keep the strongest evidence snapshot
            if kind == "TRIPLE_RIDING" and evidence.get("rider_count", 0) > ev["evidence"].get("rider_count", 0):
                ev["evidence"] = evidence
            if kind == "WRONG_SIDE" and (evidence.get("direction_cosine", 0) < ev["evidence"].get("direction_cosine", 0)):
                ev["evidence"] = evidence
        if len(self._events) > self.config.max_events:
            open_ids = set(self._open.values())
            for old in sorted(self._events, key=lambda e: self._events[e]["first_detected_sec"]):
                if len(self._events) <= self.config.max_events:
                    break
                if old not in open_ids:
                    del self._events[old]

    def events(self) -> List[Dict]:
        return sorted(self._events.values(), key=lambda e: (e["first_detected_sec"], e["event_id"]))

    # ------------------------------------------------------------------ main
    def process_frame(
        self,
        detections: Iterable[Dict],
        timestamp_sec: Optional[float],
        permitted_direction: Optional[str] = None,
    ) -> Dict:
        cfg = self.config
        if timestamp_sec is None or not isinstance(timestamp_sec, (int, float)) or not math.isfinite(timestamp_sec) or timestamp_sec < 0:
            return self._result(None, [], [], permitted_direction, note="INVALID_TIMESTAMP")
        ts = float(timestamp_sec)
        if self._last_ts is not None and ts < self._last_ts - cfg.reset_backstep_sec:
            self._soft_reset()
        self._last_ts = ts

        motos: List[Tuple[int, Dict]] = []
        persons: List[Tuple[Optional[int], Dict]] = []
        vehicles: List[Tuple[int, Dict]] = []
        for det in detections:
            box = _valid_box(det.get("box"))
            if box is None:
                continue
            cls = det.get("class_name")
            tid = det.get("track_id")
            if cls == PERSON:
                persons.append((tid if isinstance(tid, int) else None, box))
                continue
            if not isinstance(tid, int) or isinstance(tid, bool):
                continue
            self._classes[tid] = cls
            if cls in MOTOR_VEHICLES or cls in TWO_WHEELERS:
                vehicles.append((tid, box))
            if cls == "motorcycle":
                motos.append((tid, box))

        # Triple riding
        riders = self._assign_riders(motos, persons)
        triple_now: List[Dict] = []
        for mid, mbox in motos:
            count = len(riders.get(mid, []))
            if count >= cfg.triple_min_riders:
                self._triple_streak[mid] = self._triple_streak.get(mid, 0) + 1
                if self._triple_streak[mid] >= cfg.triple_min_frames:
                    evidence = {
                        "timestamp_sec": _r(ts),
                        "rider_count": count,
                        "consecutive_frames": self._triple_streak[mid],
                        "motorcycle_box": {k: _r(v, 4) for k, v in mbox.items()},
                        "rider_boxes": riders[mid],
                    }
                    self._raise("TRIPLE_RIDING", mid, ts, evidence,
                                [f"{count} person boxes overlap motorcycle #{mid}",
                                 f"Seen in {self._triple_streak[mid]} consecutive frames (minimum {cfg.triple_min_frames})"])
                    triple_now.append({"track_id": mid, "rider_count": count})
            else:
                self._triple_streak[mid] = 0

        # Wrong side
        direction = DIRECTION_VECTORS.get((permitted_direction or "").lower())
        wrong_now: List[Dict] = []
        seen_ids = set()
        for tid, box in vehicles:
            seen_ids.add(tid)
            cx, cy = (box["x_min"] + box["x_max"]) / 2, (box["y_min"] + box["y_max"]) / 2
            path = self._paths.setdefault(tid, deque(maxlen=16))
            if path and abs(path[-1][0] - ts) < 1e-6:
                path[-1] = (ts, cx, cy)
            else:
                path.append((ts, cx, cy))
            if direction is None:
                continue
            window = [p for p in path if ts - p[0] <= cfg.wrong_side_window_sec]
            if len(window) < cfg.wrong_side_min_obs or window[-1][0] - window[0][0] < cfg.wrong_side_min_span_sec:
                self._wrong_streak[tid] = 0
                continue
            dx, dy = window[-1][1] - window[0][1], window[-1][2] - window[0][2]
            disp = math.hypot(dx, dy)
            if disp < cfg.wrong_side_min_displacement:
                self._wrong_streak[tid] = 0
                continue
            cos = (dx * direction[0] + dy * direction[1]) / disp
            if cos <= cfg.wrong_side_max_cos:
                self._wrong_streak[tid] = self._wrong_streak.get(tid, 0) + 1
                if self._wrong_streak[tid] >= cfg.wrong_side_min_frames:
                    evidence = {
                        "timestamp_sec": _r(ts),
                        "permitted_direction": permitted_direction,
                        "observed_motion": {"dx": _r(dx, 4), "dy": _r(dy, 4)},
                        "displacement": _r(disp, 4),
                        "direction_cosine": _r(cos),
                        "window_sec": _r(window[-1][0] - window[0][0], 2),
                        "path": [{"x": _r(p[1], 4), "y": _r(p[2], 4), "timestamp_sec": _r(p[0])} for p in window],
                        "box": {k: _r(v, 4) for k, v in box.items()},
                    }
                    angle = math.degrees(math.acos(max(-1.0, min(1.0, cos))))
                    self._raise("WRONG_SIDE", tid, ts, evidence,
                                [f"Moving {angle:.0f}° away from the permitted '{permitted_direction}' direction",
                                 f"Sustained over {evidence['window_sec']} s and {self._wrong_streak[tid]} evaluations"])
                    wrong_now.append({"track_id": tid, "direction_cosine": _r(cos)})
            else:
                self._wrong_streak[tid] = 0

        # Drop stale tracks and close their open events
        for tid in [t for t, p in self._paths.items() if not p or ts - p[-1][0] > cfg.stale_after_sec]:
            self._paths.pop(tid, None)
            self._wrong_streak.pop(tid, None)
            self._triple_streak.pop(tid, None)
        for key, eid in list(self._open.items()):
            if ts - self._events[eid]["last_detected_sec"] > cfg.stale_after_sec:
                del self._open[key]

        return self._result(ts, triple_now, wrong_now, permitted_direction,
                            riders_on_screen=sum(len(v) for v in riders.values()), motorcycles=len(motos))

    def _result(self, ts, triple_now, wrong_now, permitted_direction, note: Optional[str] = None,
                riders_on_screen: int = 0, motorcycles: int = 0) -> Dict:
        return {
            "engine": "Rule-based rider safety monitor (COCO person + motorcycle, tracked)",
            "timestamp_sec": _r(ts),
            "note": note,
            "motorcycles_in_frame": motorcycles,
            "riders_matched": riders_on_screen,
            "triple_riding_now": triple_now,
            "wrong_side_now": wrong_now,
            "wrong_side_enabled": (permitted_direction or "").lower() in DIRECTION_VECTORS,
            "permitted_direction": permitted_direction,
            "helmet_detection": "NOT_AVAILABLE",
            "events": self.events()[-20:],
            "active_event_ids": sorted(self._open.values()),
            "limitations": LIMITATIONS,
        }
