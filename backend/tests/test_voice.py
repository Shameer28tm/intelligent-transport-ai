"""
Tests for Multilingual Voice Assistant Pipeline (Sarvam STT/TTS + Gemini Intent Tool Calling).
Covers validation, status, grounded tool execution, language parsing (Tamil/English/Thanglish),
action allowlisting, provider error handling, and zero-hallucination provenance.
"""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.incident import Incident, IncidentCategory, IncidentSeverity, IncidentStatus
from app.services.voice.tools import execute_tool, TOOL_DEFINITIONS
from app.services.voice.orchestrator import VoiceOrchestrator
from app.services.voice.gemini_service import GeminiVoiceService


def test_voice_status_endpoint(client: TestClient):
    """Status endpoint must return provider status, supported languages, models, without leaking secrets."""
    response = client.get("/api/voice/status")
    assert response.status_code == 200
    data = response.json()
    assert "sarvam_configured" in data
    assert "gemini_configured" in data
    assert isinstance(data["sarvam_configured"], bool)
    assert isinstance(data["gemini_configured"], bool)
    assert "ta" in data["supported_languages"]
    assert "en" in data["supported_languages"]
    assert "auto" in data["supported_languages"]
    assert "thanglish" in data["supported_languages"]
    assert "navigate_to_page" in data["supported_actions"]
    assert "stt_model" in data
    assert "tts_model" in data
    # Ensure no secrets or tokens are in any string values
    raw_str = str(data)
    assert "sk-" not in raw_str


def test_voice_assistant_validation(client: TestClient):
    """Empty requests or invalid payloads must be rejected with 400 or 413."""
    # Neither audio nor text
    res = client.post("/api/voice/assistant", data={})
    assert res.status_code == 400
    assert "audio file or text query must be provided" in res.json()["detail"].lower()

    # Empty whitespace text
    res = client.post("/api/voice/assistant", data={"text": "   "})
    assert res.status_code == 400

    # Oversized audio > 10MB
    huge_payload = b"0" * (10 * 1024 * 1024 + 1024)
    res = client.post(
        "/api/voice/assistant",
        files={"audio": ("huge.wav", huge_payload, "audio/wav")}
    )
    assert res.status_code == 413


def test_tools_grounded_execution(db_session: Session):
    """All tools must query real database models and return verifiable provenance without inventing facts."""
    # 1. get_critical_areas
    res = execute_tool("get_critical_areas", {}, db_session)
    assert "total_found" in res
    assert "critical_areas" in res
    assert res["data_source"] == "Incident Database Ledger"

    # 2. get_area_traffic for known corridor
    res_traffic = execute_tool("get_area_traffic", {"location_query": "Kathipara"}, db_session)
    assert "matched" in res_traffic
    assert res_traffic["query"] == "kathipara"

    # 3. get_nearby_facilities
    res_fac = execute_tool("get_nearby_facilities", {"latitude": 13.0067, "longitude": 80.2045}, db_session)
    assert len(res_fac["facilities"]) > 0
    assert any(h["number"] == "108" for h in res_fac["helplines"])

    # 4. get_capabilities
    res_cap = execute_tool("get_capabilities", {}, db_session)
    assert "Sarvam" in res_cap["voice_capabilities"]["speech_recognition"]
    assert "overview" in [m["id"] for m in res_cap["available_modules"]]

    # 5. unknown tool
    res_unknown = execute_tool("invalid_tool_name", {}, db_session)
    assert "error" in res_unknown
    assert "Unknown tool" in res_unknown["error"]


def test_tools_empty_database_no_fabrication(db_session: Session):
    """When no incidents exist, get_critical_areas and hotspots must NOT fabricate fake data."""
    # Delete all incidents from test session
    db_session.query(Incident).delete()
    db_session.commit()

    res = execute_tool("get_critical_areas", {}, db_session)
    assert res["total_found"] == 0
    assert res["critical_areas"] == []

    hotspots = execute_tool("get_road_safety_hotspots", {}, db_session)
    assert hotspots["total_hotspots_clustered"] == 0
    assert hotspots["top_hotspots"] == []


def test_language_detection_tamil_english_thanglish():
    """Verify robust recognition of Tamil script, English, and Thanglish code-mix queries."""
    gemini = GeminiVoiceService(api_key="mock")

    # Native Tamil script
    assert gemini._detect_reply_language("எந்த பகுதி தீவிரமாக பாதிக்கப்பட்டுள்ளது?", "auto") == "ta"
    assert gemini._detect_reply_language("விபத்து விவரங்கள்", "ta") == "ta"

    # Conversational Thanglish (Latin script with Tamil vocabulary)
    assert gemini._detect_reply_language("Ippo entha area romba critical-ah irukku?", "auto") == "thanglish"
    assert gemini._detect_reply_language("Road safety page open pannu", "auto") == "thanglish"
    assert gemini._detect_reply_language("Enna traffic status?", "auto") == "thanglish"

    # English query
    assert gemini._detect_reply_language("Explain this in English", "auto") == "en"
    assert gemini._detect_reply_language("Show critical incident count", "en") == "en"


def test_rule_based_fallback_and_deterministic_response():
    """Verify deterministic grounded responses for Tamil, English, and Thanglish without hallucinations."""
    gemini = GeminiVoiceService(api_key="mock")

    # Critical query -> get_critical_areas
    tool_name, args, action = gemini._rule_based_fallback("Ippo entha area romba critical-ah irukku?")
    assert tool_name == "get_critical_areas"
    assert action is not None
    assert action["type"] == "navigate_to_page"
    assert action["payload"]["page"] == "overview"

    # Navigation query -> hotspots
    tool_name, args, action = gemini._rule_based_fallback("Hotspot areas and black corridors kaatu")
    assert tool_name == "get_road_safety_hotspots"
    assert action["payload"]["page"] == "safety"

    # Grounded response formatting when empty
    empty_tool_result = {"total_found": 0, "critical_areas": []}
    resp_ta = gemini._format_deterministic_response("query", "get_critical_areas", empty_tool_result, "ta")
    assert "தீவிர விபத்து" in resp_ta

    resp_th = gemini._format_deterministic_response("query", "get_critical_areas", empty_tool_result, "thanglish")
    assert "critical incidents-um record aagala" in resp_th

    resp_en = gemini._format_deterministic_response("query", "get_critical_areas", empty_tool_result, "en")
    assert "No critical or high-severity" in resp_en


def test_end_to_end_voice_assistant_mocked(client: TestClient):
    """Full end-to-end endpoint test with mocked Sarvam STT and TTS using synchronous TestClient."""
    with patch("app.services.voice.sarvam_service.SarvamService.transcribe_audio", new_callable=AsyncMock) as mock_stt, \
         patch("app.services.voice.sarvam_service.SarvamService.synthesize_speech", new_callable=AsyncMock) as mock_tts:

        mock_stt.return_value = ("Road safety page open pannu", "ta")
        mock_tts.return_value = ("UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "audio/wav")

        audio_content = b"RIFF" + b"\x00" * 300
        res = client.post(
            "/api/voice/assistant",
            files={"audio": ("mic.wav", audio_content, "audio/wav")},
            data={"language": "auto"},
        )

        assert res.status_code == 200
        body = res.json()
        assert body["transcript"] == "Road safety page open pannu"
        assert body["action"] is not None
        assert body["action"]["action_type"] == "navigate_to_page"
        assert body["audio_base64"] is not None


def test_text_only_assistant_query(client: TestClient):
    """Text-only query executes tools and returns grounded answers without requiring microphone audio."""
    res = client.post(
        "/api/voice/assistant",
        data={"text": "Ippo entha area romba critical-ah irukku?", "language": "auto"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["transcript"] == "Ippo entha area romba critical-ah irukku?"
    assert body["data_grounded"] is True
    assert body["action"] is not None
    assert body["action"]["action_type"] == "navigate_to_page"


def test_provider_timeout_handling(client: TestClient):
    """If Sarvam STT times out, endpoint returns 504 Gateway Timeout gracefully."""
    with patch("app.services.voice.sarvam_service.SarvamService.transcribe_audio", new_callable=AsyncMock) as mock_stt:
        mock_stt.side_effect = TimeoutError("Sarvam STT request timed out.")

        res = client.post(
            "/api/voice/assistant",
            files={"audio": ("slow.wav", b"12345678" * 50, "audio/wav")},
        )
        assert res.status_code == 504
        assert "timed out" in res.json()["detail"].lower()


def test_provider_quota_handling(client: TestClient):
    """If Sarvam STT returns quota exceeded (429), endpoint returns 502 Bad Gateway gracefully."""
    with patch("app.services.voice.sarvam_service.SarvamService.transcribe_audio", new_callable=AsyncMock) as mock_stt:
        mock_stt.side_effect = RuntimeError("Sarvam API quota exceeded or rate limited. Please try again shortly.")

        res = client.post(
            "/api/voice/assistant",
            files={"audio": ("quota.wav", b"12345678" * 50, "audio/wav")},
        )
        assert res.status_code == 502
        assert "quota exceeded" in res.json()["detail"].lower()


def test_webm_audio_upload_and_magic_bytes_detection(client: TestClient):
    """Verify that WebM audio uploads (even if uploaded with generic name) are correctly classified as webm."""
    with patch("app.services.voice.sarvam_service.SarvamService.transcribe_audio", new_callable=AsyncMock) as mock_stt, \
         patch("app.services.voice.sarvam_service.SarvamService.synthesize_speech", new_callable=AsyncMock) as mock_tts:

        mock_stt.return_value = ("Kathipara traffic status", "en")
        mock_tts.return_value = ("UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "audio/wav")

        # WebM EBML header magic bytes
        webm_payload = b"\x1aE\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01" + b"\x00" * 300

        # Upload with generic/blob filename and webm content_type
        res = client.post(
            "/api/voice/assistant",
            files={"audio": ("blob", webm_payload, "audio/webm")},
            data={"language": "auto"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["transcript"] == "Kathipara traffic status"

        # Verify transcribe_audio was called with filename ending in .webm
        call_kwargs = mock_stt.call_args.kwargs
        assert call_kwargs["filename"] == "voice.webm"
