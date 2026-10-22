import os
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.config import get_settings
from app.schemas.vision import (
    VisionAnalysisResult,
    VisionSupportedFormatsResponse,
)
from app.services.vision import get_vision_service

router = APIRouter(prefix="/vision", tags=["Computer Vision & Road Safety AI"])
settings = get_settings()

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".avi"}
ALL_SUPPORTED_EXTS = SUPPORTED_IMAGE_EXTS.union(SUPPORTED_VIDEO_EXTS)


@router.get("/supported-formats", response_model=VisionSupportedFormatsResponse)
def get_supported_formats():
    """Return supported media formats and upload configuration."""
    service = get_vision_service()
    return VisionSupportedFormatsResponse(
        supported_images=sorted(list(SUPPORTED_IMAGE_EXTS)),
        supported_videos=sorted(list(SUPPORTED_VIDEO_EXTS)),
        max_file_size_mb=int(settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)),
        active_adapter=service.adapter_name,
        hardware_acceleration="NVIDIA CUDA Available (Phase 2 Weights Pending)",
    )


@router.get("/status")
def get_vision_subsystem_status():
    """Returns active vision adapter status, availability, and simulated demo flags."""
    service = get_vision_service()
    return {
        "adapter_name": service.adapter_name,
        "is_simulated": service.is_simulated,
        "is_available": service.is_available(),
        "mode": "Demonstration Simulator" if service.is_simulated else "Production Inference Pipeline",
        "description": (
            "Extensible Vision Service Layer. The deterministic demo simulator provides realistic "
            "bounding boxes, vehicle classification, and collision risk indexing without requiring "
            "multi-gigabyte weights during stage-1 setup."
        ),
    }


@router.post("/analyze", response_model=VisionAnalysisResult)
async def analyze_road_media(file: UploadFile = File(...)):
    """
    Upload road CCTV snapshot, dashcam footage frame, or traffic drone media
    for computer vision safety analysis and vehicle detection.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing or empty.",
        )

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALL_SUPPORTED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file format '{ext}'. Supported formats are: "
                f"{', '.join(sorted(ALL_SUPPORTED_EXTS))}"
            ),
        )

    # Read bytes safely in chunks to avoid unbounded memory exhaustion
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload limit of {max_mb} MB.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    service = get_vision_service()
    try:
        result = await service.analyze_media(
            file_bytes=contents,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
        )
        return result
    except RuntimeError as re:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(re),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision processing failed: {str(exc)}",
        )
