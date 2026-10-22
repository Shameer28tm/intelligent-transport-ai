from app.config import get_settings
from app.services.vision.base import BaseVisionService
from app.services.vision.simulator import SimulatedVisionAdapter
from app.services.vision.real_adapter import RealVisionAdapter

settings = get_settings()


def get_vision_service() -> BaseVisionService:
    """
    Factory function returning the configured vision adapter.
    Defaults to SimulatedVisionAdapter in development/Phase 1.
    """
    if settings.VISION_ADAPTER.lower() == "real":
        return RealVisionAdapter()
    return SimulatedVisionAdapter()


__all__ = [
    "BaseVisionService",
    "SimulatedVisionAdapter",
    "RealVisionAdapter",
    "get_vision_service",
]
