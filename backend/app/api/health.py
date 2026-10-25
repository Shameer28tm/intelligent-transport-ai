import time
import shutil
import subprocess
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db, get_db_info
from app.config import get_settings
from app.services.vision import get_vision_service

router = APIRouter(tags=["System Health"])
settings = get_settings()


@router.get("/health")
def get_system_health(db: Session = Depends(get_db)):
    """
    Returns system operational health, database connectivity latency,
    storage status, and active vision AI subsystem status.
    Responds within <10s even if external database is unavailable.
    """
    start_db = time.perf_counter()
    db_status = "connected"
    db_latency_ms = -1.0
    try:
        db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - start_db) * 1000, 2)
    except Exception as e:
        db_status = f"unreachable: {type(e).__name__}"
        db_latency_ms = round((time.perf_counter() - start_db) * 1000, 2)

    vision_service = get_vision_service()
    db_info = get_db_info()
    
    # Check disk space in upload dir
    total_gb, used_gb, free_gb = 0, 0, 0
    try:
        total, used, free = shutil.disk_usage(".")
        total_gb = round(total / (1024 ** 3), 1)
        used_gb = round(used / (1024 ** 3), 1)
        free_gb = round(free / (1024 ** 3), 1)
    except Exception:
        pass

    # Guard optional ONNX runtime import
    ort_providers = []
    try:
        import onnxruntime as ort
        ort_providers = ort.get_available_providers()
    except Exception:
        ort_providers = []

    # Dynamic hardware readiness detection (never hardcode GPU models or CUDA readiness)
    cuda_ready = "CUDAExecutionProvider" in ort_providers
    execution_provider = "CUDAExecutionProvider" if cuda_ready else "CPUExecutionProvider"

    detected_gpu = "None (CPU Execution)"
    try:
        smi = shutil.which("nvidia-smi")
        if smi:
            res = subprocess.run(
                [smi, "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=1.0,
            )
            if res.returncode == 0 and res.stdout.strip():
                detected_gpu = res.stdout.strip().splitlines()[0].strip()
    except Exception:
        pass

    if detected_gpu != "None (CPU Execution)" and not cuda_ready:
        inference_runtime = f"ONNX Runtime ({execution_provider}) - Host GPU detected ({detected_gpu}), ONNX executing on CPU"
    elif cuda_ready:
        inference_runtime = f"ONNX Runtime ({execution_provider}) - Hardware Accelerated"
    else:
        inference_runtime = f"ONNX Runtime ({execution_provider})"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "status": db_status,
            "latency_ms": db_latency_ms,
            "engine": db_info.get("engine", "Relational Database"),
            "dialect": db_info.get("dialect", "unknown"),
        },
        "vision_subsystem": {
            "active_adapter": vision_service.adapter_name,
            "is_simulated": vision_service.is_simulated,
            "is_available": vision_service.is_available(),
            "execution_provider": execution_provider,
            "available_providers": ort_providers,
        },
        "storage": {
            "total_gb": total_gb,
            "used_gb": used_gb,
            "free_gb": free_gb,
        },
        "hardware_detection": {
            "gpu_detected": detected_gpu,
            "host_gpu": detected_gpu,
            "inference_runtime": inference_runtime,
            "execution_provider": execution_provider,
            "cuda_driver_ready": cuda_ready,
            "phase": "P2 Release (Enterprise UI/UX + Mappls + Vision Workspace)",
        },
        "notice": "All test feeds default to SIMULATED DEMO DATA for operational testing.",
    }
