from typing import Optional
from app.config import get_settings
from app.services.vision.base import BaseVisionService
from app.services.vision.simulator import SimulatedVisionAdapter
from app.services.vision.real_adapter import RealVisionAdapter

settings = get_settings()


def get_vision_service(adapter_type: Optional[str] = None) -> BaseVisionService:
    """
    Factory function returning the configured or requested vision adapter.
    Explicitly separates genuine neural model inference from deterministic simulation.
    """
    target = (adapter_type or settings.VISION_ADAPTER).strip().lower()
    if target in ("real", "yolo", "onnx"):
        return RealVisionAdapter()
    return SimulatedVisionAdapter()


__all__ = [
    "BaseVisionService",
    "SimulatedVisionAdapter",
    "RealVisionAdapter",
    "get_vision_service",
]
