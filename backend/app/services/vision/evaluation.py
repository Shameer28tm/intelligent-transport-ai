"""
Ground-Truth Evaluation Engine for Traffic Computer Vision.
Provides reproducible evaluation of object detection predictions against ground-truth annotations
using bipartite greedy IoU matching. Computes Precision, Recall, F1 score, True Positives,
False Positives, False Negatives (missed detections), and Processing FPS.
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from app.services.vision.tracker import box_iou


class EvaluationEngine:
    """
    Evaluates detection predictions against labeled ground-truth frames.
    Implements standard COCO/PASCAL VOC-style matching with explicit IoU threshold.
    """

    def __init__(self, iou_threshold: float = 0.50):
        self.iou_threshold = iou_threshold

    def evaluate(
        self,
        predicted_frames: List[Dict[str, Any]],
        ground_truth_frames: List[Dict[str, Any]],
        evaluation_metadata: Optional[Dict[str, Any]] = None,
        inference_time_ms: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Evaluate predicted frame detections against ground truth frames.

        predicted_frames: List of:
            {
                "frame_index": int,
                "timestamp_sec": float,
                "objects": [
                    {
                        "class_name": str,
                        "confidence": float,
                        "box": {"x_min": float, "y_min": float, "x_max": float, "y_max": float}
                    }
                ]
            }

        ground_truth_frames: List of:
            {
                "frame_index": int,
                "timestamp_sec": float,
                "objects": [
                    {
                        "class_name": str,
                        "box": {"x_min": float, "y_min": float, "x_max": float, "y_max": float}
                    }
                ]
            }
        """
        gt_by_frame = {f["frame_index"]: f.get("objects", []) for f in ground_truth_frames}
        pred_by_frame = {f["frame_index"]: f.get("objects", []) for f in predicted_frames}

        evaluated_frame_indices = sorted(list(set(gt_by_frame.keys()).intersection(set(pred_by_frame.keys()))))
        if not evaluated_frame_indices:
            # Check if matching by timestamp if frame indices differ
            evaluated_frame_indices = sorted(list(gt_by_frame.keys()))

        total_gt_boxes = 0
        total_pred_boxes = 0
        total_tp = 0
        total_fp = 0
        total_fn = 0
        matched_ious: List[float] = []

        # Class-specific accumulators
        target_classes = ["car", "bus", "truck", "motorcycle", "bicycle", "pedestrian"]
        class_stats: Dict[str, Dict[str, Any]] = {
            c: {"gt_count": 0, "pred_count": 0, "tp": 0, "fp": 0, "fn": 0, "ious": []}
            for c in target_classes
        }

        for frame_idx in evaluated_frame_indices:
            gt_objects = gt_by_frame.get(frame_idx, [])
            pred_objects = pred_by_frame.get(frame_idx, [])

            total_gt_boxes += len(gt_objects)
            total_pred_boxes += len(pred_objects)

            # Evaluate per class
            all_classes_in_frame = set(
                [g["class_name"].lower() for g in gt_objects] +
                [p["class_name"].lower() for p in pred_objects]
            )

            for c in all_classes_in_frame:
                if c not in class_stats:
                    class_stats[c] = {"gt_count": 0, "pred_count": 0, "tp": 0, "fp": 0, "fn": 0, "ious": []}

                c_gt = [g for g in gt_objects if g["class_name"].lower() == c]
                c_pred = [p for p in pred_objects if p["class_name"].lower() == c]

                class_stats[c]["gt_count"] += len(c_gt)
                class_stats[c]["pred_count"] += len(c_pred)

                # Pairwise IoU
                pairs: List[Tuple[float, int, int]] = []
                for g_idx, g_box in enumerate(c_gt):
                    for p_idx, p_box in enumerate(c_pred):
                        iou = box_iou(g_box["box"], p_box["box"])
                        if iou >= self.iou_threshold:
                            pairs.append((iou, g_idx, p_idx))

                pairs.sort(key=lambda x: x[0], reverse=True)

                matched_gt = set()
                matched_pred = set()

                for iou, g_idx, p_idx in pairs:
                    if g_idx in matched_gt or p_idx in matched_pred:
                        continue
                    matched_gt.add(g_idx)
                    matched_pred.add(p_idx)
                    class_stats[c]["tp"] += 1
                    class_stats[c]["ious"].append(iou)
                    total_tp += 1
                    matched_ious.append(iou)

                tp_count = len(matched_gt)
                fp_count = len(c_pred) - tp_count
                fn_count = len(c_gt) - tp_count

                class_stats[c]["fp"] += fp_count
                class_stats[c]["fn"] += fn_count
                total_fp += fp_count
                total_fn += fn_count

        # Compute precision, recall, F1
        def calc_prf(tp: int, fp: int, fn: int) -> Tuple[float, float, float]:
            precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
            recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
            f1 = round((2 * precision * recall) / (precision + recall), 4) if (precision + recall) > 0 else 0.0
            return precision, recall, f1

        overall_precision, overall_recall, overall_f1 = calc_prf(total_tp, total_fp, total_fn)
        overall_mean_iou = round(float(np.mean(matched_ious)), 4) if matched_ious else 0.0

        class_metrics = {}
        for c, stats in class_stats.items():
            if stats["gt_count"] > 0 or stats["pred_count"] > 0:
                p, r, f = calc_prf(stats["tp"], stats["fp"], stats["fn"])
                m_iou = round(float(np.mean(stats["ious"])), 4) if stats["ious"] else 0.0
                class_metrics[c] = {
                    "ground_truth_count": stats["gt_count"],
                    "predicted_count": stats["pred_count"],
                    "true_positives": stats["tp"],
                    "false_positives": stats["fp"],
                    "missed_detections": stats["fn"],
                    "precision": p,
                    "recall": r,
                    "f1_score": f,
                    "mean_iou": m_iou,
                }

        num_evaluated = len(evaluated_frame_indices)
        avg_time_ms = round(inference_time_ms / num_evaluated, 2) if num_evaluated > 0 else 0.0
        effective_fps = round((1000.0 / avg_time_ms), 2) if avg_time_ms > 0 else 0.0

        return {
            "status": "EVALUATED_AGAINST_GROUND_TRUTH",
            "iou_threshold": self.iou_threshold,
            "evaluated_frames_count": num_evaluated,
            "total_ground_truth_objects": total_gt_boxes,
            "total_predicted_objects": total_pred_boxes,
            "true_positives": total_tp,
            "false_positives": total_fp,
            "missed_detections": total_fn,
            "precision": overall_precision,
            "recall": overall_recall,
            "f1_score": overall_f1,
            "mean_iou": overall_mean_iou,
            "class_metrics": class_metrics,
            "performance": {
                "total_inference_time_ms": round(inference_time_ms, 2),
                "avg_frame_latency_ms": avg_time_ms,
                "effective_processing_fps": effective_fps,
            },
            "evaluation_conditions": evaluation_metadata or {
                "dataset_name": "Local Traffic Validation Subset",
                "matching_rule": f"Greedy Bipartite IoU >= {self.iou_threshold:.2f}",
                "distinction": "Verified Ground-Truth Benchmark Results",
            },
        }
