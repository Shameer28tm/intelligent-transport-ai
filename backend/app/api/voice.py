"""
Voice Assistant API router for Intelligent Transport AI.
Provides speech recognition, grounded query answering, action packaging, and text-to-speech.
"""

from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.voice import VoiceAssistantResponse, VoiceStatusResponse
from app.services.voice.orchestrator import VoiceOrchestrator

logger = logging.getLogger("transport.api.voice")

router = APIRouter(prefix="/voice", tags=["Voice Assistant"])

_orchestrator = VoiceOrchestrator()

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB limit


@router.get("/status", response_model=VoiceStatusResponse)
def get_voice_status():
    """Returns configuration and capabilities of the voice pipeline without revealing secrets."""
    return _orchestrator.get_status()


@router.post("/assistant", response_model=VoiceAssistantResponse)
async def process_voice_assistant(
    audio: Optional[UploadFile] = File(None, description="Recorded audio file (wav, webm, mp3)"),
    text: Optional[str] = Form(None, description="Optional direct text query (if mic is not used)"),
    language: Optional[str] = Form("auto", description="Language preference: 'auto', 'ta', or 'en'"),
    db: Session = Depends(get_db),
):
    """Processes user voice or text, runs allowlisted grounded tools, and returns spoken response + UI action."""
    audio_bytes = None
    filename = "voice.wav"

    if audio is not None:
        raw = await audio.read()
        if len(raw) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio file exceeds maximum allowed size of 10 MB.",
            )
        audio_bytes = raw
        orig_name = (audio.filename or "").lower()
        content_type = (getattr(audio, "content_type", "") or "").lower()

        # Detect audio container format from magic bytes or content_type
        if raw.startswith(b"\x1aE\xdf\xa3") or "webm" in content_type or orig_name.endswith(".webm"):
            filename = "voice.webm"
        elif raw.startswith(b"OggS") or "ogg" in content_type or orig_name.endswith(".ogg"):
            filename = "voice.ogg"
        elif (raw.startswith(b"RIFF") and b"WAVE" in raw[:16]) or "wav" in content_type or orig_name.endswith(".wav"):
            filename = "voice.wav"
        elif raw.startswith(b"ID3") or raw.startswith(b"\xff\xfb") or "mp3" in content_type or orig_name.endswith(".mp3"):
            filename = "voice.mp3"
        elif "mp4" in content_type or b"ftyp" in raw[:12] or orig_name.endswith(".mp4"):
            filename = "voice.mp4"
        else:
            filename = audio.filename or "voice.webm"

    if not audio_bytes and not (text and text.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either an audio file or text query must be provided.",
        )

    try:
        result = await _orchestrator.process_voice_turn(
            audio_bytes=audio_bytes,
            text_query=text,
            language_preference=language or "auto",
            filename=filename,
            db=db,
        )
        return result
    except ValueError as ve:
        # Configuration or input errors
        logger.warning(f"[VoiceAPI] Configuration error: {ve}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(ve),
        )
    except TimeoutError as te:
        logger.error(f"[VoiceAPI] Timeout error: {te}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(te),
        )
    except RuntimeError as re:
        logger.error(f"[VoiceAPI] Runtime error: {re}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(re),
        )
    except Exception as e:
        logger.error(f"[VoiceAPI] Unexpected error: {type(e).__name__} {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal voice processing error. Please try again.",
        )
