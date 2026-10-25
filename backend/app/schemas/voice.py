from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class VoiceAction(BaseModel):
    type: str = Field(..., description="Action type: navigate_to_page, focus_map_location, select_incident")
    action_type: Optional[str] = Field(None, description="Action type alias for frontend compatibility")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Action arguments")

    def __init__(self, **data):
        super().__init__(**data)
        if not self.action_type:
            self.action_type = self.type


class VoiceAssistantResponse(BaseModel):
    transcript: str = Field(..., description="Recognized speech transcript or original text")
    response_text: str = Field(..., description="Grounded natural language response")
    detected_language: str = Field(..., description="Detected or used language: ta, en, or thanglish")
    audio_base64: Optional[str] = Field(None, description="Base64 encoded WAV audio from Sarvam TTS")
    audio_mime_type: Optional[str] = Field("audio/wav", description="MIME type of synthesized audio")
    action: Optional[VoiceAction] = Field(None, description="Validated dashboard UI action to execute")
    tool_invoked: Optional[str] = Field(None, description="Name of the backend grounded tool invoked")
    data_grounded: bool = Field(True, description="Whether response is strictly grounded in real system data")


class VoiceStatusResponse(BaseModel):
    sarvam_configured: bool = Field(..., description="Whether SARVAM_API_KEY is configured")
    gemini_configured: bool = Field(..., description="Whether GEMINI_API_KEY is configured")
    stt_model: str = Field(..., description="Active STT model (saaras:v4)")
    tts_model: str = Field(..., description="Active TTS model (bulbul:v4-flash)")
    tts_speaker: str = Field(..., description="Configured TTS speaker")
    gemini_model: str = Field(..., description="Configured Gemini model")
    supported_languages: List[str] = Field(default_factory=list, description="Supported languages")
    supported_actions: List[str] = Field(default_factory=list, description="Allowlisted dashboard actions")
