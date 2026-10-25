"""
Sarvam AI Service for Speech-to-Text (Saaras v4) and Text-to-Speech (Bulbul v4 Flash).
Supports Tamil (ta-IN), Indian English (en-IN), and conversational Thanglish code-mix.
"""

from __future__ import annotations

import base64
import logging
from typing import Optional, Tuple
import httpx

from app.config import get_settings

logger = logging.getLogger("transport.voice.sarvam")

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"


class SarvamService:
    def __init__(self, api_key: Optional[str] = None):
        settings = get_settings()
        self.api_key = (api_key or settings.SARVAM_API_KEY or "").strip()
        self.stt_model = settings.SARVAM_STT_MODEL or "saaras:v4"
        self.tts_model = settings.SARVAM_TTS_MODEL or "bulbul:v4-flash"
        self.tts_speaker = settings.SARVAM_TTS_SPEAKER or "gokul_ta_narration"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        language_preference: str = "auto",
        timeout_sec: float = 20.0,
    ) -> Tuple[str, str]:
        """Transcribe audio bytes using Sarvam Saaras v4 STT.
        
        Returns:
            (transcript, detected_or_resolved_language_code)
        """
        if not self.is_configured:
            raise ValueError("SARVAM_API_KEY is not configured on the server.")

        if not audio_bytes or len(audio_bytes) < 100:
            return "", language_preference

        # Map language preference to Sarvam language_code
        # ta-IN: Tamil, en-IN: English, unknown: Auto-detect
        lang_pref = (language_preference or "auto").lower()
        if lang_pref in ("ta", "tamil", "ta-in"):
            sarvam_lang = "ta-IN"
            mode = "codemix"
        elif lang_pref in ("en", "english", "en-in"):
            sarvam_lang = "en-IN"
            mode = "transcribe"
        else:
            sarvam_lang = "unknown"
            mode = "codemix"

        mime_type = "audio/wav"
        if filename.endswith(".webm") or audio_bytes.startswith(b"\x1aE\xdf\xa3"):
            mime_type = "audio/webm"
            filename = "audio.webm"
        elif filename.endswith(".ogg") or audio_bytes.startswith(b"OggS"):
            mime_type = "audio/ogg"
            filename = "audio.ogg"
        elif filename.endswith(".mp3") or audio_bytes.startswith(b"ID3") or audio_bytes.startswith(b"\xff\xfb"):
            mime_type = "audio/mp3"
            filename = "audio.mp3"
        elif filename.endswith(".mp4") or b"ftyp" in audio_bytes[:12]:
            mime_type = "audio/mp4"
            filename = "audio.mp4"
        elif filename.endswith(".wav") or (audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:16]):
            mime_type = "audio/wav"
            filename = "audio.wav"

        headers = {
            "api-subscription-key": self.api_key,
        }
        files = {
            "file": (filename, audio_bytes, mime_type),
        }
        data = {
            "model": self.stt_model,
            "mode": mode,
        }
        if sarvam_lang != "unknown":
            data["language_code"] = sarvam_lang

        try:
            async with httpx.AsyncClient(timeout=timeout_sec) as client:
                resp = await client.post(
                    SARVAM_STT_URL,
                    headers=headers,
                    files=files,
                    data=data,
                )

            if resp.status_code == 200:
                payload = resp.json()
                transcript = payload.get("transcript", "").strip()
                detected_lang = payload.get("language_code") or sarvam_lang
                return transcript, detected_lang
            elif resp.status_code == 401 or resp.status_code == 403:
                logger.error("[SarvamService] Authentication error (401/403)")
                raise RuntimeError("Sarvam API authentication failed. Verify server SARVAM_API_KEY.")
            elif resp.status_code == 429:
                logger.warning("[SarvamService] Rate limit or quota exceeded (429)")
                raise RuntimeError("Sarvam API quota exceeded or rate limited. Please try again shortly.")
            else:
                logger.error(f"[SarvamService] STT failed HTTP {resp.status_code}: {resp.text[:200]}")
                raise RuntimeError(f"Sarvam STT failed with status {resp.status_code}.")
        except httpx.TimeoutException:
            logger.error("[SarvamService] STT request timed out")
            raise TimeoutError("Sarvam STT request timed out. Please speak again.")
        except Exception as e:
            if isinstance(e, (RuntimeError, ValueError, TimeoutError)):
                raise
            logger.error(f"[SarvamService] Unexpected error: {type(e).__name__} {e}")
            raise RuntimeError(f"Speech recognition error: {str(e)}")

    async def synthesize_speech(
        self,
        text: str,
        language: str = "ta",
        speaker: Optional[str] = None,
        timeout_sec: float = 15.0,
    ) -> Tuple[str, str]:
        """Synthesize text to speech using Sarvam Bulbul v4 Flash.
        
        Returns:
            (base64_audio_str, mime_type) e.g. ("UklGRi...", "audio/wav")
        """
        if not self.is_configured:
            return "", ""

        clean_text = (text or "").strip()
        if not clean_text:
            return "", ""

        # Limit text length to avoid excessive latency in conversational voice (max 500 chars)
        if len(clean_text) > 500:
            clean_text = clean_text[:497] + "..."

        lang = (language or "ta").lower()
        if lang in ("en", "english", "en-in"):
            target_lang = "en-IN"
        else:
            target_lang = "ta-IN"

        eff_speaker = speaker or self.tts_speaker

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json",
        }
        body = {
            "inputs": [clean_text],
            "target_language_code": target_lang,
            "speaker": eff_speaker,
            "model": self.tts_model,
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_sec) as client:
                resp = await client.post(
                    SARVAM_TTS_URL,
                    headers=headers,
                    json=body,
                )

            if resp.status_code == 200:
                payload = resp.json()
                audios = payload.get("audios", [])
                if audios and isinstance(audios, list) and audios[0]:
                    return audios[0], "audio/wav"
                return "", ""
            else:
                logger.warning(f"[SarvamService] TTS synthesis non-200 ({resp.status_code}): {resp.text[:150]}")
                return "", ""
        except Exception as e:
            logger.warning(f"[SarvamService] TTS synthesis error (continuing without audio): {type(e).__name__} {e}")
            return "", ""
