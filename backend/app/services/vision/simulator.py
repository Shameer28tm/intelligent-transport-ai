import io
import time
import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Dict
from PIL import Image
from app.services.vision.base import BaseVisionService
from app.schemas.vision import (
    VisionAnalysisResult,
    DetectedObject,
    BoundingBox,
)


class SimulatedVisionAdapter(BaseVisionService):
    """
    Deterministic Transport Vision Simulator.
    Used for reliable local testing, CI validation, and demonstration without requiring heavy GPU weights.
    All outputs are explicitly flagged as SIMULATED DEMO DATA.
    """

    @property
    def adapter_name(self) -> str:
        return "Deterministic Demo Simulator (RoadVision-Sim-v1)"

    @property
    def is_simulated(self) -> bool:
        return True

    def is_available(self) -> bool:
        return True

    async def analyze_media(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> VisionAnalysisResult:
        start_time = time.perf_counter()
        
        # Determine media type and extract dimensions safely if image
        is_video = any(filename.lower().endswith(ext) for ext in [".mp4", ".mov", ".webm", ".avi"])
        media_type = "video" if is_video else "image"
        
        width = 1920
        height = 1080
        if not is_video:
            try:
                with Image.open(io.BytesIO(file_bytes)) as img:
                    width, height = img.size
            except Exception:
                # Fallback to default dimensions if Pillow cannot decode (e.g. raw synthetic stream)
                width, height = 1280, 720

        # Generate deterministic seed based on content hash
        digest = hashlib.sha256(file_bytes).hexdigest()
        seed_val = int(digest[:8], 16)

        # Deterministic vehicle & pedestrian counts
        car_count = (seed_val % 7) + 3
        bus_count = (seed_val % 3)
        truck_count = (seed_val % 2)
        motorcycle_count = ((seed_val >> 4) % 3)
        pedestrian_count = ((seed_val >> 8) % 4)
        
        total_vehicles = car_count + bus_count + truck_count + motorcycle_count
        vehicle_breakdown: Dict[str, int] = {
            "car": car_count,
            "bus": bus_count,
            "truck": truck_count,
            "motorcycle": motorcycle_count,
        }

        # Congestion and risk level
        if total_vehicles >= 9:
            congestion_level = "HEAVY"
            collision_risk_score = 0.78
            lane_blockage = True
            hazards = ["Corridor queue spillback detected", "Reduced inter-vehicle headway"]
        elif total_vehicles >= 6:
            congestion_level = "MODERATE"
            collision_risk_score = 0.45
            lane_blockage = False
            hazards = ["Slight queue formation at arterial bottleneck"]
        else:
            congestion_level = "LOW"
            collision_risk_score = 0.18
            lane_blockage = False
            hazards = []

        if pedestrian_count > 1:
            hazards.append("Unsignalized crosswalk activity detected")
            collision_risk_score = min(1.0, collision_risk_score + 0.15)

        # Generate realistic bounding boxes
        detected_objects: List[DetectedObject] = []
        track_counter = 101

        # Add vehicles
        for i in range(min(total_vehicles, 8)):
            x_min = 0.1 + (i * 0.10) % 0.8
            y_min = 0.35 + (i * 0.06) % 0.45
            w = 0.12 if i % 3 != 1 else 0.18  # larger for buses/trucks
            h = 0.10 if i % 3 != 1 else 0.15
            cls_name = "bus" if i == 1 and bus_count > 0 else ("truck" if i == 2 and truck_count > 0 else "car")

            detected_objects.append(
                DetectedObject(
                    id=f"obj-{i+1}",
                    class_name=cls_name,
                    confidence=round(0.88 + ((seed_val + i) % 11) * 0.01, 2),
                    box=BoundingBox(
                        x_min=round(x_min, 3),
                        y_min=round(y_min, 3),
                        x_max=round(min(0.98, x_min + w), 3),
                        y_max=round(min(0.95, y_min + h), 3),
                    ),
                    track_id=track_counter + i,
                    speed_estimate_kmh=round(42.0 + ((seed_val + i * 7) % 35) - (total_vehicles * 1.5), 1),
                    hazard_flag=False,
                )
            )

        # Add pedestrians if present
        for p in range(pedestrian_count):
            px_min = 0.05 + (p * 0.25) % 0.8
            py_min = 0.60 + (p * 0.05) % 0.25
            detected_objects.append(
                DetectedObject(
                    id=f"ped-{p+1}",
                    class_name="pedestrian",
                    confidence=round(0.85 + (p * 0.04), 2),
                    box=BoundingBox(
                        x_min=round(px_min, 3),
                        y_min=round(py_min, 3),
                        x_max=round(px_min + 0.04, 3),
                        y_max=round(py_min + 0.12, 3),
                    ),
                    track_id=track_counter + 20 + p,
                    speed_estimate_kmh=round(4.5 + (p * 0.5), 1),
                    hazard_flag=True,
                )
            )

        # Generate intelligent recommendations
        recommendations = []
        if collision_risk_score > 0.6:
            recommendations.append("Trigger dynamic speed warning sign (VMS) reduction to 40 km/h.")
        if lane_blockage:
            recommendations.append("Dispatch incident response unit (IRU) to verify right-lane blockage.")
        if pedestrian_count > 0:
            recommendations.append("Extend pedestrian green interval at downstream signal by +6 seconds.")
        if not recommendations:
            recommendations.append("Nominal traffic flow. Maintain standard adaptive green split.")

        processing_time_ms = round((time.perf_counter() - start_time) * 1000 + 12.0, 2)

        return VisionAnalysisResult(
            analysis_id=str(uuid.uuid4()),
            media_name=filename,
            media_type=media_type,
            width=width,
            height=height,
            file_size_bytes=len(file_bytes),
            processing_time_ms=processing_time_ms,
            adapter_name=self.adapter_name,
            is_simulated=self.is_simulated,
            status="COMPLETED",
            total_vehicles=total_vehicles,
            vehicle_breakdown=vehicle_breakdown,
            total_pedestrians=pedestrian_count,
            estimated_congestion_level=congestion_level,
            collision_risk_score=collision_risk_score,
            lane_blockage_detected=lane_blockage,
            detected_hazards=hazards,
            detected_objects=detected_objects,
            recommendations=recommendations,
            timestamp=datetime.now(timezone.utc),
            provenance_notice="SIMULATED DEMO DATA: Generated by Deterministic Demo Adapter for Phase 1.",
        )
