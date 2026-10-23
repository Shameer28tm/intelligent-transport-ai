"""
Lightweight Multi-Object Tracker (IoU Tracker) for Sequential Traffic Video.
Provides deterministic, high-efficiency vehicle tracking across consecutive video frames
using Intersection-over-Union (IoU) association in pure Python and NumPy.
No heavy external tracking dependencies required.
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
import uuid


def box_iou(box_a: Dict[str, float], box_b: Dict[str, float]) -> float:
    """
    Calculate IoU between two normalized bounding boxes:
    Each box is a dict with keys: x_min, y_min, x_max, y_max
    """
    xA = max(box_a["x_min"], box_b["x_min"])
    yA = max(box_a["y_min"], box_b["y_min"])
    xB = min(box_a["x_max"], box_b["x_max"])
    yB = min(box_a["y_max"], box_b["y_max"])

    inter_width = max(0.0, xB - xA)
    inter_height = max(0.0, yB - yA)
    inter_area = inter_width * inter_height

    area_a = max(0.0, box_a["x_max"] - box_a["x_min"]) * max(0.0, box_a["y_max"] - box_a["y_min"])
    area_b = max(0.0, box_b["x_max"] - box_b["x_min"]) * max(0.0, box_b["y_max"] - box_b["y_min"])

    union_area = area_a + area_b - inter_area
    if union_area <= 1e-7:
        return 0.0
    return inter_area / union_area


class Track:
    """Represents a single tracked vehicle identity over time."""

    def __init__(
        self,
        track_id: int,
        class_name: str,
        initial_box: Dict[str, float],
        initial_confidence: float,
        timestamp_sec: float,
    ):
        self.track_id: int = track_id
        self.class_name: str = class_name
        self.current_box: Dict[str, float] = initial_box
        self.confidence: float = initial_confidence
        self.first_seen_sec: float = timestamp_sec
        self.last_seen_sec: float = timestamp_sec
        self.hits: int = 1
        self.time_since_update: int = 0
        self.is_active: bool = True
        self.crossed_cordon: bool = False

        cx = (initial_box["x_min"] + initial_box["x_max"]) / 2.0
        cy = (initial_box["y_min"] + initial_box["y_max"]) / 2.0
        self.trajectory: List[Dict[str, float]] = [
            {"x": round(cx, 4), "y": round(cy, 4), "timestamp_sec": round(timestamp_sec, 2)}
        ]

    def update(self, box: Dict[str, float], confidence: float, timestamp_sec: float):
        """Update track with a newly matched detection."""
        self.current_box = box
        self.confidence = confidence
        self.last_seen_sec = timestamp_sec
        self.hits += 1
        self.time_since_update = 0

        cx = (box["x_min"] + box["x_max"]) / 2.0
        cy = (box["y_min"] + box["y_max"]) / 2.0
        self.trajectory.append(
            {"x": round(cx, 4), "y": round(cy, 4), "timestamp_sec": round(timestamp_sec, 2)}
        )

    def mark_missed(self):
        """Increment time since last detection."""
        self.time_since_update += 1

    @property
    def duration_sec(self) -> float:
        return max(0.0, round(self.last_seen_sec - self.first_seen_sec, 2))

    def to_dict(self) -> Dict:
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "first_seen_sec": self.first_seen_sec,
            "last_seen_sec": self.last_seen_sec,
            "duration_sec": self.duration_sec,
            "detection_count": self.hits,
            "trajectory": self.trajectory,
            "last_box": self.current_box,
        }


class IoUTracker:
    """
    Lightweight IoU Tracker with Virtual Cordon Crossing Detection.
    Maintains persistent track IDs across sequentially ordered video frames.
    """

    def __init__(
        self,
        iou_threshold: float = 0.25,
        max_lost: int = 2,
        min_hits_for_unique: int = 1,
        cordon_y: float = 0.60,
    ):
        self.iou_threshold = iou_threshold
        self.max_lost = max_lost
        self.min_hits_for_unique = min_hits_for_unique
        self.cordon_y = cordon_y

        self.next_track_id: int = 1
        self.active_tracks: List[Track] = []
        self.closed_tracks: List[Track] = []
        self.events: List[Dict] = []

    def update_frame(
        self,
        detections: List[Dict],
        timestamp_sec: float,
    ) -> List[Dict]:
        """
        Process a list of detections for the current frame:
        detections: List of dicts with keys:
            - 'id': str
            - 'class_name': str
            - 'confidence': float
            - 'box': {'x_min': float, 'y_min': float, 'x_max': float, 'y_max': float}
        Returns the detections list augmented with assigned 'track_id'.
        """
        updated_detections: List[Dict] = []

        if not self.active_tracks:
            # Initialize all detections as new tracks
            for det in detections:
                track = Track(
                    track_id=self.next_track_id,
                    class_name=det["class_name"],
                    initial_box=det["box"],
                    initial_confidence=det["confidence"],
                    timestamp_sec=timestamp_sec,
                )
                self.next_track_id += 1
                self.active_tracks.append(track)
                det["track_id"] = track.track_id
                updated_detections.append(det)
            return updated_detections

        # Compute IoU matrix between active tracks and current frame detections
        num_tracks = len(self.active_tracks)
        num_dets = len(detections)

        if num_dets == 0:
            for track in self.active_tracks:
                track.mark_missed()
            self._prune_lost_tracks()
            return []

        # Candidate pairs (iou, track_idx, det_idx)
        candidates: List[Tuple[float, int, int]] = []
        for t_idx, track in enumerate(self.active_tracks):
            for d_idx, det in enumerate(detections):
                # Compatible vehicle categories or matching class
                if track.class_name == det["class_name"] or {track.class_name, det["class_name"]}.issubset(
                    {"car", "bus", "truck", "motorcycle", "bicycle"}
                ):
                    iou = box_iou(track.current_box, det["box"])
                    
                    # Calculate centroid distance
                    t_cx = (track.current_box["x_min"] + track.current_box["x_max"]) / 2.0
                    t_cy = (track.current_box["y_min"] + track.current_box["y_max"]) / 2.0
                    d_cx = (det["box"]["x_min"] + det["box"]["x_max"]) / 2.0
                    d_cy = (det["box"]["y_min"] + det["box"]["y_max"]) / 2.0
                    c_dist = ((t_cx - d_cx) ** 2 + (t_cy - d_cy) ** 2) ** 0.5

                    score = iou
                    if c_dist < 0.25:
                        proximity = max(0.0, 1.0 - (c_dist / 0.25))
                        score = max(iou, 0.60 * proximity)

                    if score >= self.iou_threshold:
                        candidates.append((score, t_idx, d_idx))

        # Sort descending by IoU
        candidates.sort(key=lambda x: x[0], reverse=True)

        matched_tracks = set()
        matched_dets = set()

        for iou, t_idx, d_idx in candidates:
            if t_idx in matched_tracks or d_idx in matched_dets:
                continue

            track = self.active_tracks[t_idx]
            det = detections[d_idx]

            # Check cordon crossing before updating box
            prev_cy = (track.current_box["y_min"] + track.current_box["y_max"]) / 2.0
            new_cy = (det["box"]["y_min"] + det["box"]["y_max"]) / 2.0

            if not track.crossed_cordon:
                if (prev_cy < self.cordon_y <= new_cy) or (prev_cy > self.cordon_y >= new_cy):
                    direction = "SOUTHBOUND" if new_cy > prev_cy else "NORTHBOUND"
                    self.events.append({
                        "event_id": str(uuid.uuid4()),
                        "track_id": track.track_id,
                        "class_name": track.class_name,
                        "event_type": "CORDON_CROSSING",
                        "timestamp_sec": round(timestamp_sec, 2),
                        "direction": direction,
                        "confidence": det["confidence"],
                        "cordon_y": self.cordon_y,
                    })
                    track.crossed_cordon = True

            track.update(det["box"], det["confidence"], timestamp_sec)
            det["track_id"] = track.track_id
            matched_tracks.add(t_idx)
            matched_dets.add(d_idx)
            updated_detections.append(det)

        # Unmatched detections become new tracks
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_dets:
                track = Track(
                    track_id=self.next_track_id,
                    class_name=det["class_name"],
                    initial_box=det["box"],
                    initial_confidence=det["confidence"],
                    timestamp_sec=timestamp_sec,
                )
                self.next_track_id += 1
                self.active_tracks.append(track)
                det["track_id"] = track.track_id
                updated_detections.append(det)

        # Unmatched active tracks are marked missed
        for t_idx, track in enumerate(self.active_tracks):
            if t_idx not in matched_tracks:
                track.mark_missed()

        self._prune_lost_tracks()
        return updated_detections

    def _prune_lost_tracks(self):
        """Move tracks that have exceeded max_lost to closed_tracks."""
        surviving: List[Track] = []
        for track in self.active_tracks:
            if track.time_since_update > self.max_lost:
                track.is_active = False
                self.closed_tracks.append(track)
            else:
                surviving.append(track)
        self.active_tracks = surviving

    def finalize(self):
        """Close all remaining active tracks at end of video."""
        for track in self.active_tracks:
            track.is_active = False
            self.closed_tracks.append(track)
        self.active_tracks = []

    def get_summary(self) -> Dict:
        """
        Return comprehensive tracking summary:
        - unique_vehicles_tracked: distinct vehicles observed with sufficient hits
        - vehicle_breakdown: unique vehicle counts by category
        - all_tracks: serializable list of tracked vehicle histories
        - events: cordon crossing and zone events
        """
        all_tracks = self.closed_tracks + self.active_tracks
        valid_tracks = [t for t in all_tracks if t.hits >= self.min_hits_for_unique]

        vehicle_classes = {"car", "bus", "truck", "motorcycle", "bicycle"}
        unique_vehicle_tracks = [t for t in valid_tracks if t.class_name in vehicle_classes]
        unique_pedestrians = [t for t in valid_tracks if t.class_name == "pedestrian"]

        breakdown = {c: 0 for c in vehicle_classes}
        for t in unique_vehicle_tracks:
            if t.class_name in breakdown:
                breakdown[t.class_name] += 1

        return {
            "unique_vehicles_tracked": len(unique_vehicle_tracks),
            "unique_pedestrians_tracked": len(unique_pedestrians),
            "vehicle_breakdown": breakdown,
            "total_tracks_assigned": self.next_track_id - 1,
            "events": self.events,
            "tracks": [t.to_dict() for t in valid_tracks],
            "tracking_algorithm": "Sequential IoU Tracker (Greedy Bipartite Association)",
            "limitations_notice": (
                "Tracking identities are scoped to the current video analysis session. "
                "Track IDs may reset or drift following significant occlusion, sharp camera movement, "
                "or vehicle re-entry."
            ),
        }
