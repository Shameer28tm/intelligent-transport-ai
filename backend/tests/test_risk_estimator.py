"""
Unit + integration tests for the Traffic Premonition risk estimator.

All trajectories in this file are SYNTHETIC (hand-constructed straight-line
motion) and exist only to exercise the estimator's logic. They are not
evidence of real-world predictive accuracy.

Written with unittest.TestCase so the file runs under pytest or plain unittest.
"""

import json
import math
import unittest

from app.services.vision.risk_estimator import (
    STATE_INSUFFICIENT_EVIDENCE,
    STATE_MONITORING,
    STATE_NO_CONFLICT,
    STATE_POTENTIAL_CONFLICT,
    RiskEstimatorConfig,
    TrajectoryRiskEstimator,
)
from app.services.vision.tracker import IoUTracker

DT = 0.28  # matches the frontend live loop target interval (~3.5 FPS)


def det(track_id, cx, cy, w=0.08, h=0.10, cls="car", conf=0.8):
    return {
        "track_id": track_id,
        "class_name": cls,
        "confidence": conf,
        "box": {"x_min": cx - w / 2, "y_min": cy - h / 2, "x_max": cx + w / 2, "y_max": cy + h / 2},
    }


def run(est, frames):
    """frames: list of (timestamp, [detections]); returns list of results."""
    return [est.process_frame(dets, ts) for ts, dets in frames]


def linear_frames(specs, n, t0=0.0):
    """specs: {track_id: (x0, y0, vx, vy)} in normalised units / s."""
    out = []
    for i in range(n):
        t = t0 + i * DT
        out.append((round(t, 3), [det(tid, x0 + vx * t, y0 + vy * t) for tid, (x0, y0, vx, vy) in specs.items()]))
    return out


class TestRiskEstimatorScenarios(unittest.TestCase):
    def test_vehicles_moving_apart(self):
        est = TrajectoryRiskEstimator()
        res = run(est, linear_frames({1: (0.45, 0.5, -0.12, 0.0), 2: (0.55, 0.5, 0.12, 0.0)}, 5))[-1]
        self.assertEqual(res["state"], STATE_NO_CONFLICT)
        self.assertEqual(res["pairs"][0]["reasons"][0], "DIVERGING")
        # Once far enough apart, the pair is pruned as unable to meet within the horizon
        later = run(est, linear_frames({1: (0.45, 0.5, -0.12, 0.0), 2: (0.55, 0.5, 0.12, 0.0)}, 9))[-1]
        self.assertEqual(later["state"], STATE_NO_CONFLICT)
        self.assertEqual(res["events"], [])

    def test_parallel_paths_same_speed(self):
        est = TrajectoryRiskEstimator()
        res = run(est, linear_frames({1: (0.1, 0.46, 0.15, 0.0), 2: (0.1, 0.52, 0.15, 0.0)}, 8))[-1]
        self.assertEqual(res["state"], STATE_NO_CONFLICT)
        self.assertIn("PARALLEL_OR_STATIONARY", res["pairs"][0]["reasons"])
        self.assertEqual(res["pairs"][0]["measurements"]["interaction_geometry"], "SAME_DIRECTION")

    def test_approaching_vehicles_raise_potential_conflict(self):
        est = TrajectoryRiskEstimator()
        # 5 frames end at t=1.12 s, before the centres meet at t=1.667 s
        results = run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 5))
        res = results[-1]
        self.assertEqual(results[2]["state"], STATE_INSUFFICIENT_EVIDENCE)  # warming up
        self.assertEqual(res["state"], STATE_POTENTIAL_CONFLICT)
        pair = res["pairs"][0]
        self.assertEqual(pair["state"], STATE_POTENTIAL_CONFLICT)
        for code in ("CLOSING", "PROJECTED_SEPARATION_BELOW_THRESHOLD", "CLOSEST_APPROACH_WITHIN_HORIZON"):
            self.assertIn(code, pair["reasons"])
        m = pair["measurements"]
        self.assertEqual(m["interaction_geometry"], "OPPOSING")
        # Analytic check: centres meet at x=0.5 at t = 0.25/0.15 = 1.667 s
        expected_ttca = 0.25 / 0.15 - results[-1]["timestamp_sec"]
        self.assertAlmostEqual(m["time_to_closest_approach_sec"], expected_ttca, delta=0.05)
        self.assertLess(m["closest_projected_separation_fh"], m["separation_threshold_fh"])
        self.assertEqual(len(res["events"]), 1)
        self.assertTrue(res["events"][0]["is_prediction"])

    def test_closest_approach_beyond_horizon_retains_accurate_reason(self):
        """When separation drops below threshold within the horizon boundary but t_star > H,
        the reason must state CLOSEST_APPROACH_BEYOND_HORIZON instead of CLOSEST_APPROACH_WITHIN_HORIZON."""
        cfg = RiskEstimatorConfig(horizon_sec=2.0, min_threshold_fh=0.35)
        est = TrajectoryRiskEstimator(cfg)
        results = run(est, linear_frames({1: (0.30, 0.5, 0.05, 0.0), 2: (0.70, 0.5, -0.05, 0.0)}, 5))
        res = results[-1]
        self.assertEqual(res["state"], STATE_POTENTIAL_CONFLICT)
        pair = res["pairs"][0]
        self.assertEqual(pair["state"], STATE_POTENTIAL_CONFLICT)
        self.assertIn("CLOSEST_APPROACH_BEYOND_HORIZON", pair["reasons"])
        self.assertNotIn("CLOSEST_APPROACH_WITHIN_HORIZON", pair["reasons"])
        self.assertGreater(pair["measurements"]["time_to_closest_approach_sec"], 2.0)
        self.assertLess(pair["measurements"]["closest_projected_separation_fh"], pair["measurements"]["separation_threshold_fh"])

    def test_overlapping_stationary_boxes_are_not_a_conflict(self):
        est = TrajectoryRiskEstimator()
        res = run(est, linear_frames({1: (0.50, 0.5, 0.0, 0.0), 2: (0.52, 0.5, 0.0, 0.0)}, 8))[-1]
        self.assertEqual(res["state"], STATE_NO_CONFLICT)
        self.assertIn("BOXES_ALREADY_OVERLAP", res["pairs"][0]["reasons"])

    def test_insufficient_observations(self):
        est = TrajectoryRiskEstimator()
        results = run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 2))
        self.assertEqual(results[-1]["state"], STATE_INSUFFICIENT_EVIDENCE)
        self.assertTrue(all(t["data_quality"] == "INSUFFICIENT" for t in results[-1]["tracks"]))
        self.assertTrue(all(t["projected_path"] == [] for t in results[-1]["tracks"]))

    def test_no_vehicles_is_monitoring(self):
        est = TrajectoryRiskEstimator()
        res = est.process_frame([det(1, 0.5, 0.5, cls="pedestrian")], 0.0)
        self.assertEqual(res["state"], STATE_MONITORING)

    def test_erratic_motion_is_low_quality(self):
        est = TrajectoryRiskEstimator()
        frames = []
        for i in range(8):
            jitter = 0.08 if i % 2 else -0.08
            frames.append((i * DT, [det(1, 0.3, 0.5 + jitter), det(2, 0.7, 0.5)]))
        res = run(est, frames)[-1]
        q = {t["track_id"]: t["data_quality"] for t in res["tracks"]}
        self.assertEqual(q[1], "LOW")
        self.assertEqual(res["state"], STATE_INSUFFICIENT_EVIDENCE)


class TestRiskEstimatorRobustness(unittest.TestCase):
    def test_invalid_timestamps_are_rejected(self):
        est = TrajectoryRiskEstimator()
        for bad in (None, float("nan"), float("inf"), -1.0):
            res = est.process_frame([det(1, 0.5, 0.5)], bad)
            self.assertEqual(res["state"], STATE_INSUFFICIENT_EVIDENCE)
            self.assertIn("INVALID_TIMESTAMP", res["reasons"])
        self.assertEqual(est.rejected_observations, 4)

    def test_invalid_coordinates_and_missing_ids(self):
        est = TrajectoryRiskEstimator()
        bad = [
            det(None, 0.5, 0.5),
            {"track_id": 3, "class_name": "car", "confidence": 0.9,
             "box": {"x_min": float("nan"), "y_min": 0.1, "x_max": 0.2, "y_max": 0.2}},
            {"track_id": 4, "class_name": "car", "confidence": 0.9,
             "box": {"x_min": 0.6, "y_min": 0.1, "x_max": 0.2, "y_max": 0.2}},
            {"track_id": 5, "class_name": "car", "confidence": 0.9, "box": {"x_min": 0.1}},
            {"track_id": 6, "class_name": "car", "confidence": 0.9,
             "box": {"x_min": 0.1, "y_min": 0.1, "x_max": 1.8, "y_max": 0.2}},
        ]
        res = est.process_frame(bad, 0.0)
        self.assertEqual(res["state"], STATE_MONITORING)
        self.assertEqual(res["tracks"], [])
        self.assertEqual(est.rejected_observations, 5)

    def test_stale_and_disappearing_tracks(self):
        est = TrajectoryRiskEstimator()
        run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 7))
        self.assertEqual(len(est._open_by_pair), 1)
        # Track 2 disappears; track 1 keeps going for > event_close_after_sec
        t = 6 * DT
        for k in range(1, 6):
            res = est.process_frame([det(1, 0.25 + 0.15 * (t + k * DT), 0.5)], t + k * DT)
        self.assertNotIn(2, est._history)  # stale track dropped
        self.assertEqual(res["events"][0]["status"], "CLOSED")
        self.assertEqual(res["active_event_ids"], [])

    def test_large_gap_restarts_track_history(self):
        est = TrajectoryRiskEstimator()
        run(est, linear_frames({1: (0.2, 0.5, 0.1, 0.0)}, 5))  # last observation at 4*DT
        t = 4 * DT + 0.5
        est.process_frame([det(1, 0.6, 0.5)], t)  # gap 0.5 s < max_gap_sec: appended
        self.assertEqual(len(est._history[1]), 6)
        est.process_frame([det(1, 0.7, 0.5)], t + 1.05)  # gap > max_gap_sec: history restarts
        self.assertEqual(len(est._history[1]), 1)

    def test_seek_backwards_resets_trajectories_and_interrupts_events(self):
        est = TrajectoryRiskEstimator()
        run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 7))
        res = est.process_frame([det(1, 0.25, 0.5), det(2, 0.75, 0.5)], 0.0)
        self.assertEqual(res["state"], STATE_INSUFFICIENT_EVIDENCE)
        self.assertTrue(all(len(h) == 1 for h in est._history.values()))
        self.assertEqual(res["events"][0]["status"], "INTERRUPTED")

    def test_full_reset_clears_everything(self):
        est = TrajectoryRiskEstimator()
        run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 7))
        est.reset()
        self.assertEqual(est.events(), [])
        self.assertEqual(est._history, {})

    def test_duplicate_warnings_are_suppressed(self):
        est = TrajectoryRiskEstimator()
        results = run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 9))
        conflict_frames = [r for r in results if r["state"] == STATE_POTENTIAL_CONFLICT]
        self.assertGreaterEqual(len(conflict_frames), 2)
        events = results[-1]["events"]
        self.assertEqual(len(events), 1)
        self.assertGreaterEqual(events[0]["update_count"], len(conflict_frames))

    def test_same_frame_twice_does_not_add_observation(self):
        est = TrajectoryRiskEstimator()
        est.process_frame([det(1, 0.5, 0.5)], 1.0)
        est.process_frame([det(1, 0.5, 0.5)], 1.0)
        self.assertEqual(len(est._history[1]), 1)

    def test_deterministic_for_identical_inputs(self):
        frames = linear_frames({1: (0.25, 0.5, 0.15, 0.02), 2: (0.75, 0.52, -0.15, 0.0),
                                3: (0.5, 0.2, 0.0, 0.1)}, 9)
        a = json.dumps(run(TrajectoryRiskEstimator(), frames), sort_keys=True)
        b = json.dumps(run(TrajectoryRiskEstimator(), frames), sort_keys=True)
        self.assertEqual(a, b)

    def test_observed_and_projected_paths_are_distinct(self):
        est = TrajectoryRiskEstimator()
        res = run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 7))[-1]
        ts = res["timestamp_sec"]
        for t in res["tracks"]:
            self.assertTrue(all(p["timestamp_sec"] <= ts for p in t["observed_path"]))
            self.assertTrue(t["projected_path"])
            self.assertTrue(all(p["timestamp_sec"] > ts for p in t["projected_path"]))
            self.assertLessEqual(t["projected_path"][-1]["timestamp_sec"], ts + res["config"]["horizon_sec"] + 1e-6)

    def test_pair_evaluation_is_bounded(self):
        cfg = RiskEstimatorConfig(max_pairs=10)
        est = TrajectoryRiskEstimator(cfg)
        specs = {i: (0.1 + 0.03 * i, 0.5, 0.05 * ((-1) ** i), 0.0) for i in range(1, 26)}
        res = run(est, linear_frames(specs, 6))[-1]
        self.assertLessEqual(res["pairs_evaluated"], 10)
        self.assertEqual(res["pairs_evaluated"] + res["pairs_pruned"], 25 * 24 // 2)

    def test_output_contains_no_probability_or_metric_units(self):
        est = TrajectoryRiskEstimator()
        res = run(est, linear_frames({1: (0.25, 0.5, 0.15, 0.0), 2: (0.75, 0.5, -0.15, 0.0)}, 7))[-1]
        blob = json.dumps(res).lower()
        for banned in ("probability\":", "km/h", "kmh", "metres\"", "meters\""):
            self.assertNotIn(banned, blob)
        self.assertTrue(res["is_prediction"])
        self.assertTrue(res["limitations"])


class TestTrackerIntegration(unittest.TestCase):
    """Real data path minus the ONNX model: detections -> IoUTracker -> estimator."""

    def test_tracker_ids_feed_estimator(self):
        tracker = IoUTracker(iou_threshold=0.25, max_lost=3)
        est = TrajectoryRiskEstimator()
        res = None
        for i in range(5):
            t = i * DT
            raw = [
                {"id": f"a{i}", "class_name": "car", "confidence": 0.8,
                 "box": det(0, 0.25 + 0.15 * t, 0.5)["box"]},
                {"id": f"b{i}", "class_name": "car", "confidence": 0.8,
                 "box": det(0, 0.75 - 0.15 * t, 0.5)["box"]},
            ]
            tracked = tracker.update_frame(raw, timestamp_sec=t)
            res = est.process_frame(tracked, t)
        ids = sorted(t["track_id"] for t in res["tracks"])
        self.assertEqual(ids, [1, 2])  # IDs come from the tracker, not invented
        self.assertEqual(res["state"], STATE_POTENTIAL_CONFLICT)

    def test_live_session_reset_clears_estimator(self):
        from app.services.vision import real_adapter as ra

        sid = "test_premonition_reset"
        tracker = ra.get_or_create_live_tracker(sid)
        self.assertIsInstance(tracker.risk_estimator, TrajectoryRiskEstimator)
        res = ra.assess_live_premonition(tracker, [det(1, 0.5, 0.5)], 0.0, 16 / 9)
        self.assertEqual(res["state"], STATE_INSUFFICIENT_EVIDENCE)
        self.assertTrue(ra.reset_live_tracker(sid))
        fresh = ra.get_or_create_live_tracker(sid)
        self.assertIsNot(fresh, tracker)
        self.assertEqual(fresh.risk_estimator._history, {})
        ra.reset_live_tracker(sid)


class TestAnalyzeMediaPremonition(unittest.TestCase):
    """End-to-end through RealVisionAdapter.analyze_media with only the ONNX detector stubbed.

    The stub returns SYNTHETIC boxes; everything downstream (tracker, estimator,
    response schema validation) is the production code path.
    """

    def test_live_frames_return_premonition_payload(self):
        import asyncio
        import io
        from unittest import mock

        from PIL import Image

        from app.schemas.vision import BoundingBox, DetectedObject
        from app.services.vision import real_adapter as ra

        buf = io.BytesIO()
        Image.new("RGB", (640, 360), (40, 40, 40)).save(buf, format="JPEG")
        frame = buf.getvalue()
        adapter = ra.RealVisionAdapter()
        sid = "test_premonition_e2e"
        ra.reset_live_tracker(sid)
        state = {"t": 0.0}

        def fake_detect(_img, confidence_threshold=0.35):
            t = state["t"]
            out = []
            for i, cx in enumerate((0.25 + 0.15 * t, 0.75 - 0.15 * t)):
                b = det(0, cx, 0.5)["box"]
                out.append(DetectedObject(id=f"d{i}", class_name="car", confidence=0.8, box=BoundingBox(**b)))
            return out

        results = []
        with mock.patch.object(ra.RealVisionAdapter, "is_available", return_value=True), \
                mock.patch.object(ra.RealVisionAdapter, "_detect_on_pil_image", side_effect=fake_detect):
            for i in range(5):
                state["t"] = i * DT
                results.append(asyncio.run(adapter.analyze_media(
                    file_bytes=frame, filename="frame.jpg", content_type="image/jpeg",
                    enable_tracking=True, session_id=sid, generate_preview=False,
                    timestamp_sec=state["t"], source_aspect_ratio=16 / 9,
                )))
        ra.reset_live_tracker(sid)

        first, last = results[0], results[-1]
        self.assertEqual(first.premonition["state"], STATE_INSUFFICIENT_EVIDENCE)
        self.assertEqual(last.premonition["state"], STATE_POTENTIAL_CONFLICT)
        self.assertEqual(sorted(d.track_id for d in last.detected_objects), [1, 2])
        json.dumps(last.model_dump(mode="json"))  # serialisable for the API response

    def test_untracked_frames_have_no_premonition(self):
        import asyncio
        import io
        from unittest import mock

        from PIL import Image

        from app.services.vision import real_adapter as ra

        buf = io.BytesIO()
        Image.new("RGB", (64, 36)).save(buf, format="PNG")
        with mock.patch.object(ra.RealVisionAdapter, "is_available", return_value=True), \
                mock.patch.object(ra.RealVisionAdapter, "_detect_on_pil_image", return_value=[]):
            res = asyncio.run(ra.RealVisionAdapter().analyze_media(
                file_bytes=buf.getvalue(), filename="f.png", content_type="image/png",
                enable_tracking=False, generate_preview=False,
            ))
        self.assertIsNone(res.premonition)


if __name__ == "__main__":
    unittest.main()
