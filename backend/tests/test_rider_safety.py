"""
Tests for rider-safety candidates (triple riding, wrong side) and vehicle-pedestrian
conflicts in Traffic Premonition.

All boxes and trajectories here are SYNTHETIC test fixtures; they exercise rule logic
only and say nothing about real-world detection accuracy.
"""

import json
import unittest

from app.services.vision.rider_safety import RiderSafetyConfig, RiderSafetyMonitor
from app.services.vision.risk_estimator import (
    STATE_MONITORING,
    STATE_POTENTIAL_CONFLICT,
    TrajectoryRiskEstimator,
)

DT = 0.28


def box(cx, cy, w, h):
    return {"x_min": cx - w / 2, "y_min": cy - h / 2, "x_max": cx + w / 2, "y_max": cy + h / 2}


def moto(tid, cx, cy):
    return {"track_id": tid, "class_name": "motorcycle", "confidence": 0.8, "box": box(cx, cy, 0.08, 0.10)}


def riders_on(cx, cy, n, start_id=100):
    """n person boxes seated on a motorcycle centred at (cx, cy): feet inside the bike's extent."""
    out = []
    offsets = [-0.025, 0.0, 0.025, 0.045][:n]
    for i, dx in enumerate(offsets):
        # person box 0.04 wide x 0.14 tall, bottom (feet) at cy + 0.02 (inside the bike box)
        out.append({"track_id": start_id + i, "class_name": "pedestrian", "confidence": 0.7,
                    "box": {"x_min": cx + dx - 0.02, "y_min": cy - 0.12, "x_max": cx + dx + 0.02, "y_max": cy + 0.02}})
    return out


class TestTripleRiding(unittest.TestCase):
    def test_three_riders_for_enough_frames_raise_one_event(self):
        mon = RiderSafetyMonitor()
        res = None
        for i in range(5):
            res = mon.process_frame([moto(1, 0.5, 0.6)] + riders_on(0.5, 0.6, 3), i * DT)
        events = [e for e in res["events"] if e["kind"] == "TRIPLE_RIDING"]
        self.assertEqual(len(events), 1)  # deduplicated across frames
        ev = events[0]
        self.assertEqual(ev["track_id"], 1)
        self.assertEqual(ev["evidence"]["rider_count"], 3)
        self.assertEqual(ev["status"], "NEEDS_REVIEW")
        self.assertGreaterEqual(ev["update_count"], 3)
        self.assertEqual(res["helmet_detection"], "NOT_AVAILABLE")

    def test_two_riders_is_not_triple_riding(self):
        mon = RiderSafetyMonitor()
        for i in range(6):
            res = mon.process_frame([moto(1, 0.5, 0.6)] + riders_on(0.5, 0.6, 2), i * DT)
        self.assertEqual(res["events"], [])
        self.assertEqual(res["riders_matched"], 2)

    def test_brief_three_rider_flicker_is_ignored(self):
        mon = RiderSafetyMonitor()
        frames = [3, 3, 2, 3, 2, 3]  # never 3 consecutive frames
        for i, n in enumerate(frames):
            res = mon.process_frame([moto(1, 0.5, 0.6)] + riders_on(0.5, 0.6, n), i * DT)
        self.assertEqual(res["events"], [])

    def test_pedestrians_beside_a_bike_are_not_riders(self):
        mon = RiderSafetyMonitor()
        walkers = [{"track_id": 200 + i, "class_name": "pedestrian", "confidence": 0.8,
                    "box": box(0.7 + 0.04 * i, 0.55, 0.04, 0.14)} for i in range(3)]
        for i in range(5):
            res = mon.process_frame([moto(1, 0.5, 0.6)] + walkers, i * DT)
        self.assertEqual(res["riders_matched"], 0)
        self.assertEqual(res["events"], [])

    def test_each_person_counts_for_one_bike_only(self):
        mon = RiderSafetyMonitor()
        dets = [moto(1, 0.40, 0.6), moto(2, 0.47, 0.6)] + riders_on(0.435, 0.6, 3)
        for i in range(5):
            res = mon.process_frame(dets, i * DT)
        self.assertEqual(res["riders_matched"], 3)


class TestWrongSide(unittest.TestCase):
    def _run(self, vy, direction, n=7, cls="car"):
        mon = RiderSafetyMonitor()
        res = None
        for i in range(n):
            t = i * DT
            res = mon.process_frame([{"track_id": 5, "class_name": cls, "confidence": 0.8,
                                      "box": box(0.5, 0.2 + vy * t, 0.08, 0.1)}], t, direction)
        return res

    def test_vehicle_against_permitted_direction_is_flagged(self):
        res = self._run(vy=-0.12, direction="down")  # moving up the frame
        events = [e for e in res["events"] if e["kind"] == "WRONG_SIDE"]
        self.assertEqual(len(events), 1)
        self.assertLess(events[0]["evidence"]["direction_cosine"], -0.9)
        self.assertTrue(res["wrong_side_enabled"])

    def test_vehicle_with_permitted_direction_is_fine(self):
        res = self._run(vy=0.12, direction="down")
        self.assertEqual(res["events"], [])

    def test_wrong_side_disabled_without_direction(self):
        res = self._run(vy=-0.12, direction=None)
        self.assertFalse(res["wrong_side_enabled"])
        self.assertEqual(res["events"], [])

    def test_stationary_vehicle_is_not_wrong_side(self):
        res = self._run(vy=0.0, direction="down")
        self.assertEqual(res["events"], [])

    def test_backward_seek_resets_paths(self):
        mon = RiderSafetyMonitor()
        for i in range(7):
            t = i * DT
            mon.process_frame([{"track_id": 5, "class_name": "car", "confidence": 0.8,
                                "box": box(0.5, 0.8 - 0.12 * t, 0.08, 0.1)}], t, "down")
        res = mon.process_frame([{"track_id": 5, "class_name": "car", "confidence": 0.8,
                                  "box": box(0.5, 0.8, 0.08, 0.1)}], 0.0, "down")
        self.assertEqual(res["wrong_side_now"], [])
        self.assertEqual(len(mon._paths[5]), 1)


class TestRobustness(unittest.TestCase):
    def test_invalid_inputs_do_not_crash(self):
        mon = RiderSafetyMonitor()
        res = mon.process_frame([{"track_id": None, "class_name": "motorcycle", "box": {"x_min": "a"}}], 0.0)
        self.assertEqual(res["events"], [])
        res = mon.process_frame([], float("nan"))
        self.assertEqual(res["note"], "INVALID_TIMESTAMP")

    def test_deterministic(self):
        frames = [([moto(1, 0.5, 0.6)] + riders_on(0.5, 0.6, 3), i * DT) for i in range(5)]
        a = json.dumps([RiderSafetyMonitor().process_frame(d, t) for d, t in frames], sort_keys=True)
        b = json.dumps([RiderSafetyMonitor().process_frame(d, t) for d, t in frames], sort_keys=True)
        self.assertEqual(a, b)

    def test_config_min_frames(self):
        mon = RiderSafetyMonitor(RiderSafetyConfig(triple_min_frames=1))
        res = mon.process_frame([moto(1, 0.5, 0.6)] + riders_on(0.5, 0.6, 3), 0.0)
        self.assertEqual(len(res["events"]), 1)


class TestPedestrianConflicts(unittest.TestCase):
    def test_car_approaching_crossing_pedestrian(self):
        est = TrajectoryRiskEstimator()
        res = None
        for i in range(5):
            t = i * DT
            dets = [
                {"track_id": 1, "class_name": "car", "confidence": 0.8, "box": box(0.20 + 0.15 * t, 0.55, 0.09, 0.12)},
                {"track_id": 2, "class_name": "pedestrian", "confidence": 0.8, "box": box(0.62, 0.30 + 0.10 * t, 0.03, 0.10)},
            ]
            res = est.process_frame(dets, t)
        self.assertEqual(res["state"], STATE_POTENTIAL_CONFLICT)
        self.assertEqual(res["pairs"][0]["pair_type"], "VEHICLE_PEDESTRIAN")

    def test_pedestrians_only_is_monitoring(self):
        est = TrajectoryRiskEstimator()
        for i in range(5):
            res = est.process_frame([
                {"track_id": 1, "class_name": "pedestrian", "confidence": 0.8, "box": box(0.3 + 0.05 * i, 0.5, 0.03, 0.1)},
                {"track_id": 2, "class_name": "pedestrian", "confidence": 0.8, "box": box(0.7 - 0.05 * i, 0.5, 0.03, 0.1)},
            ], i * DT)
        self.assertEqual(res["state"], STATE_MONITORING)

    def test_rider_is_not_treated_as_pedestrian(self):
        est = TrajectoryRiskEstimator()
        for i in range(5):
            t = i * DT
            dets = [moto(1, 0.3 + 0.1 * t, 0.6)] + riders_on(0.3 + 0.1 * t, 0.6, 1)
            res = est.process_frame(dets, t)
        self.assertEqual([t["track_id"] for t in res["tracks"]], [1])


if __name__ == "__main__":
    unittest.main()
