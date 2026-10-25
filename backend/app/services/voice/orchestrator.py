"""
Voice Orchestrator for Intelligent Transport AI.
Glues Audio -> Sarvam Saaras v4 STT -> Gemini Grounded Intent & Tool Execution -> Sarvam Bulbul v4 Flash TTS.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.voice.sarvam_service import SarvamService
from app.services.voice.gemini_service import GeminiVoiceService
from app.services.voice.tools import execute_tool

logger = logging.getLogger("transport.voice.orchestrator")


class VoiceOrchestrator:
    def __init__(
        self,
        sarvam_service: Optional[SarvamService] = None,
        gemini_service: Optional[GeminiVoiceService] = None,
    ):
        self.sarvam = sarvam_service or SarvamService()
        self.gemini = gemini_service or GeminiVoiceService()

    def get_status(self) -> Dict[str, Any]:
        settings = get_settings()
        return {
            "sarvam_configured": self.sarvam.is_configured,
            "gemini_configured": self.gemini.is_configured,
            "stt_model": settings.SARVAM_STT_MODEL,
            "tts_model": settings.SARVAM_TTS_MODEL,
            "tts_speaker": settings.SARVAM_TTS_SPEAKER,
            "gemini_model": settings.GEMINI_MODEL,
            "supported_languages": ["auto", "ta", "en", "thanglish"],
            "supported_actions": ["navigate_to_page", "focus_map_location", "select_incident"],
        }

    async def process_voice_turn(
        self,
        audio_bytes: Optional[bytes] = None,
        text_query: Optional[str] = None,
        language_preference: str = "auto",
        filename: str = "voice.wav",
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Runs the complete conversational voice pipeline.
        
        Accepts raw audio bytes from the browser microphone, or direct text.
        """
        # Step 1: Speech to Text (if audio provided)
        query = (text_query or "").strip()
        detected_lang = "ta"

        if audio_bytes and len(audio_bytes) > 10:
            if not self.sarvam.is_configured:
                raise ValueError("SARVAM_API_KEY is not configured on the server.")
            try:
                transcript, detected_lang = await self.sarvam.transcribe_audio(
                    audio_bytes=audio_bytes,
                    filename=filename,
                    language_preference=language_preference,
                )
                query = transcript.strip()
            except Exception as e:
                logger.error(f"[VoiceOrchestrator] STT transcription failed: {e}")
                raise

        if not query:
            return {
                "transcript": "",
                "response_text": "No speech or text detected. Please try speaking again.",
                "detected_language": language_preference,
                "audio_base64": None,
                "audio_mime_type": None,
                "action": None,
                "tool_invoked": None,
                "data_grounded": True,
            }

        # Step 2: Intent & Tool Decision
        tool_name, tool_args, direct_action = await self.gemini.decide_intent(
            query=query,
            language_preference=language_preference,
        )

        # Step 3: Tool Execution (if tool requested and DB available)
        tool_result = None
        if tool_name and db is not None:
            try:
                tool_result = execute_tool(tool_name, tool_args, db)
            except Exception as e:
                logger.error(f"[VoiceOrchestrator] Tool execution error ({tool_name}): {e}")
                tool_result = {"error": f"Tool execution failed: {str(e)}"}

        # Step 4: Grounded Answer Synthesis
        reply_text, reply_lang, final_action = await self.gemini.generate_grounded_answer(
            query=query,
            tool_name=tool_name,
            tool_result=tool_result,
            detected_language=detected_lang,
            direct_action=direct_action,
        )

        # Step 5: Speech Synthesis (Sarvam TTS)
        audio_b64, mime_type = "", ""
        if self.sarvam.is_configured and reply_text:
            try:
                audio_b64, mime_type = await self.sarvam.synthesize_speech(
                    text=reply_text,
                    language=reply_lang,
                )
            except Exception as e:
                logger.warning(f"[VoiceOrchestrator] TTS error (continuing with text): {e}")

        return {
            "transcript": query,
            "response_text": reply_text,
            "detected_language": reply_lang,
            "audio_base64": audio_b64 if audio_b64 else None,
            "audio_mime_type": mime_type if audio_b64 else None,
            "action": final_action,
            "tool_invoked": tool_name,
            "data_grounded": True,
        }
