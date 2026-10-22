from abc import ABC, abstractmethod
from typing import BinaryIO
from app.schemas.vision import VisionAnalysisResult


class BaseVisionService(ABC):
    """
    Abstract interface for Road Safety & Transport Computer Vision analysis.
    Implementations may be deterministic simulators, local ONNX/YOLO models, or remote vision microservices.
    """

    @property
    @abstractmethod
    def adapter_name(self) -> str:
        """Name of the active vision adapter."""
        pass

    @property
    @abstractmethod
    def is_simulated(self) -> bool:
        """Returns True if this adapter is a simulated or demo implementation."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if the required weights, runtime, or hardware are ready."""
        pass

    @abstractmethod
    async def analyze_media(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> VisionAnalysisResult:
        """
        Analyze an image or video frame stream to detect vehicles, vulnerable road users,
        measure congestion, and evaluate collision risk factors.
        """
        pass
