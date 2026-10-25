"""
Google Gemini Service for Intent Classification, Tool Calling, and Grounded Multilingual Answering.
Supports Tamil, English, and Thanglish with strict grounding against backend tool results.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.config import get_settings
from app.services.voice.tools import TOOL_DEFINITIONS

logger = logging.getLogger("transport.voice.gemini")

GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_INSTRUCTION = """You are the Intelligent Transport AI Voice Assistant (முனைவர் போக்குவரத்து உதவியாளர்).
You serve traffic managers, drivers, and citizens in Tamil Nadu, India.

CRITICAL RULES:
1. NEVER invent, hallucinate, or fabricate accident data, hospital locations, casualty figures, live traffic speeds, or safety rankings.
2. Ground all facts strictly in the tool outputs provided. If data is not available, explicitly state so in the user's language.
3. LANGUAGE HANDLING:
   - If the user asks in Tamil (தமிழ் script), reply in natural, concise Tamil.
   - If the user asks in Thanglish (Tamil written in English/Latin script, e.g., "Ippo entha area romba critical-ah irukku?", "Road safety page open pannu"):
     REPLY IN CONVERSATIONAL THANGLISH (Tamil words in Latin script, e.g., "Ippo Kathipara junction-la CRITICAL accident report aagi irukku...").
   - If the user asks in English, reply in English.
4. Keep spoken responses short, clear, and natural (1 to 3 sentences max) so they sound great when read aloud by Text-to-Speech.
5. TECHNICAL NAMES: Keep road names (Anna Salai, GST Road, OMR, Kathipara), district names, and severity labels (CRITICAL, HIGH) accurate and recognizable.
6. ACTIONS: If the user wants to navigate or inspect an area, include an action recommendation (e.g., page: 'safety', 'emergency', 'map', 'overview', 'traffic-intelligence').
"""


class GeminiVoiceService:
    def __init__(self, api_key: Optional[str] = None):
        settings = get_settings()
        self.api_key = (api_key or settings.GEMINI_API_KEY or "").strip()
        model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
        if "live" in model_name.lower():
            model_name = "gemini-2.5-flash"
        self.model = model_name

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def decide_intent(
        self,
        query: str,
        language_preference: str = "auto",
        timeout_sec: float = 12.0,
    ) -> Tuple[Optional[str], Dict[str, Any], Optional[Dict[str, Any]]]:
        """First turn: Ask Gemini whether a tool should be executed, or a direct action taken.
        
        Returns:
            (tool_name_to_call, tool_args, direct_action)
        """
        clean_query = (query or "").strip()
        if not clean_query:
            return None, {}, None

        # Check for immediate obvious navigation rules first (high speed, zero latency)
        q_lower = clean_query.lower()
        if any(w in q_lower for w in ["road safety", "safety page", "road safety page", "black corridor", "hotspot"]):
            if any(w in q_lower for w in ["open", "go to", "navigate", "kaatu", "paaru", "view"]):
                return None, {}, {"type": "navigate_to_page", "payload": {"page": "safety"}}

        if any(w in q_lower for w in ["emergency", "trauma", "108", "hospital", "maruthuvamanai"]):
            if any(w in q_lower for w in ["open", "go to", "navigate", "kaatu", "view"]):
                return None, {}, {"type": "navigate_to_page", "payload": {"page": "emergency"}}

        if any(w in q_lower for w in ["map", "live map", "traffic map"]):
            if any(w in q_lower for w in ["open", "go to", "navigate", "kaatu", "view"]):
                return None, {}, {"type": "navigate_to_page", "payload": {"page": "map"}}

        if any(w in q_lower for w in ["traffic intelligence", "camera", "video", "rider safety", "triple riding"]):
            if any(w in q_lower for w in ["open", "go to", "navigate", "kaatu", "view"]):
                return None, {}, {"type": "navigate_to_page", "payload": {"page": "traffic-intelligence"}}

        if not self.is_configured:
            return self._rule_based_fallback(clean_query)

        # Call Gemini Function Calling
        url = GEMINI_API_URL_TEMPLATE.format(model=self.model)
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        
        # Format tools for Gemini API
        gemini_tools = [
            {
                "function_declarations": [
                    {
                        "name": t["name"],
                        "description": t["description"],
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                p_name: {
                                    "type": p_spec.get("type", "STRING").upper(),
                                    "description": p_spec.get("description", ""),
                                }
                                for p_name, p_spec in t["parameters"].get("properties", {}).items()
                            },
                            "required": t["parameters"].get("required", []),
                        },
                    }
                    for t in TOOL_DEFINITIONS
                ]
            }
        ]

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": clean_query}],
                }
            ],
            "system_instruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "tools": gemini_tools,
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_sec) as client:
                resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code == 200:
                body = resp.json()
                candidates = body.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    for p in parts:
                        if "functionCall" in p:
                            fc = p["functionCall"]
                            tool_name = fc.get("name")
                            args = fc.get("args") or {}
                            return tool_name, args, None
            else:
                logger.warning(f"[GeminiService] Turn 1 non-200 ({resp.status_code}): {resp.text[:150]}")
        except Exception as e:
            logger.warning(f"[GeminiService] Turn 1 error: {type(e).__name__} {e}")

        # Fallback if Gemini did not trigger a function call or timed out
        return self._rule_based_fallback(clean_query)

    async def generate_grounded_answer(
        self,
        query: str,
        tool_name: Optional[str],
        tool_result: Optional[Dict[str, Any]],
        detected_language: str = "ta",
        direct_action: Optional[Dict[str, Any]] = None,
        timeout_sec: float = 12.0,
    ) -> Tuple[str, str, Optional[Dict[str, Any]]]:
        """Second turn: Synthesize final concise spoken text and packaged UI action grounded in real tool data.
        
        Returns:
            (response_text, response_language, action_dict)
        """
        clean_query = (query or "").strip()
        lang = self._detect_reply_language(clean_query, detected_language)

        # Build action if applicable
        action = direct_action
        if not action and tool_name == "get_critical_areas":
            action = {"type": "navigate_to_page", "payload": {"page": "overview"}}
        elif not action and tool_name == "get_road_safety_hotspots":
            action = {"type": "navigate_to_page", "payload": {"page": "safety"}}
        elif not action and tool_name == "get_nearby_facilities":
            action = {"type": "navigate_to_page", "payload": {"page": "emergency"}}

        # If Gemini is not configured, format deterministically
        if not self.is_configured:
            text = self._format_deterministic_response(clean_query, tool_name, tool_result, lang)
            return text, lang, action

        # Call Gemini Turn 2 to produce natural phrasing grounded strictly in tool_result
        url = GEMINI_API_URL_TEMPLATE.format(model=self.model)
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        
        context_str = json.dumps(tool_result, ensure_ascii=False) if tool_result else "No external tool required."
        prompt = (
            f"User asked: '{clean_query}'\n"
            f"Tool invoked: '{tool_name}'\n"
            f"Tool output (GROUND TRUTH): {context_str}\n"
            f"Desired reply language: {lang} (Tamil, English, or conversational Thanglish).\n\n"
            "Produce a concise, spoken response (1 to 2 sentences) grounded strictly in this tool output. "
            "Do NOT invent numbers or names not in the tool output. Keep it natural and ready for speech."
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "system_instruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_sec) as client:
                resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code == 200:
                body = resp.json()
                candidates = body.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        ans = parts[0]["text"].strip()
                        return ans, lang, action
            else:
                logger.warning(f"[GeminiService] Turn 2 non-200 ({resp.status_code}): {resp.text[:150]}")
        except Exception as e:
            logger.warning(f"[GeminiService] Turn 2 error: {type(e).__name__} {e}")

        # Fallback to deterministic formatted response
        text = self._format_deterministic_response(clean_query, tool_name, tool_result, lang)
        return text, lang, action

    def _rule_based_fallback(self, query: str) -> Tuple[Optional[str], Dict[str, Any], Optional[Dict[str, Any]]]:
        """Deterministic intent resolution when Gemini is unconfigured or unavailable."""
        q = query.lower()
        if any(w in q for w in ["critical", "mukkiyamaana", "mukkiyam", "accident", "apayam"]):
            return "get_critical_areas", {"limit": 5}, {"type": "navigate_to_page", "payload": {"page": "overview"}}
        if any(w in q for w in ["hotspot", "black corridor", "danger area", "viluppuram", "vikravandi"]):
            return "get_road_safety_hotspots", {"radius_m": 500.0}, {"type": "navigate_to_page", "payload": {"page": "safety"}}
        if any(w in q for w in ["hospital", "maruthuvamanai", "trauma", "108", "112", "ambulance"]):
            return "get_nearby_facilities", {"latitude": 13.0067, "longitude": 80.2045}, {"type": "navigate_to_page", "payload": {"page": "emergency"}}
        if any(w in q for w in ["traffic", "congestion", "kathipara", "anna salai", "gst", "omr", "speed"]):
            area = "Kathipara"
            if "anna salai" in q:
                area = "Anna Salai"
            elif "gst" in q:
                area = "GST Road"
            elif "omr" in q:
                area = "OMR"
            elif "vikravandi" in q:
                area = "Vikravandi"
            return "get_area_traffic", {"location_query": area}, None
        if any(w in q for w in ["feature", "capability", "enna panna mudiyum", "what can you do"]):
            return "get_capabilities", {}, None
        return "get_critical_areas", {"limit": 3}, None

    def _detect_reply_language(self, query: str, detected_language: str) -> str:
        """Determines whether reply should be native Tamil, English, or Thanglish."""
        q = query.lower()
        # Has native Tamil characters?
        if any("\u0b80" <= c <= "\u0bff" for c in query):
            return "ta"
        
        # Thanglish conversational markers
        thanglish_tokens = [
            "ippo", "entha", "romba", "irukku", "pannanum", "pannu", "kaatu", "sollu", "sollunga",
            "ungalluku", "ungalukku", "enna", "venum", "sari", "apdi", "epdi", "illai", "aama",
            "mudiyala", "mudiyum", "maruthuvamanai", "mukkiyam", "naalaikku"
        ]
        if any(t in q for t in thanglish_tokens) or detected_language in ("ta", "thanglish"):
            # If query is in Latin script with Tamil keywords, respond in Thanglish!
            return "thanglish"

        # Explicit English request
        if "in english" in q or "english-la" in q:
            return "en"

        if detected_language == "en":
            return "en"

        return "thanglish"

    def _format_deterministic_response(
        self,
        query: str,
        tool_name: Optional[str],
        tool_result: Optional[Dict[str, Any]],
        lang: str,
    ) -> str:
        """Constructs an accurate, grounded string response without LLM when needed."""
        if not tool_result:
            if lang == "ta":
                return "மன்னிக்கவும், தற்போது தகவல் கிடைக்கவில்லை. கணினியில் உள்ள தகவல்களை சரிபார்க்கவும்."
            elif lang == "en":
                return "Current data is not available. Please check the active dashboard views."
            else:
                return "Current data ippo available illa. Dashboard-la irukkura active records-a check pannunga."

        if tool_name == "get_critical_areas":
            crit = tool_result.get("critical_areas", [])
            if not crit:
                if lang == "ta":
                    return "தற்போது தீவிர விபத்து அல்லது ஆபத்தான பகுதிகள் எதுவும் பதிவாகவில்லை."
                elif lang == "en":
                    return "No critical or high-severity incidents are currently recorded in the ledger."
                else:
                    return "Ippo entha critical incidents-um record aagala. System normal-ah irukku."
            top = crit[0]
            loc = top.get("location_name") or top.get("title")
            sev = top.get("severity")
            sim = " (simulated demo data)" if top.get("is_simulated") else ""
            if lang == "ta":
                return f"தற்போது மிகவும் தீவிரமான பகுதி: {loc}. இதன் ஆபத்து நிலை {sev}{sim}."
            elif lang == "en":
                return f"The most critical area is {loc} with {sev} severity{sim}. Opening overview page."
            else:
                return f"Ippo romba critical-ana area {loc}. Idhoda severity level {sev}{sim}."

        elif tool_name == "get_road_safety_hotspots":
            total = tool_result.get("total_hotspots_clustered", 0)
            top = (tool_result.get("top_hotspots") or [{}])[0]
            names = ", ".join(top.get("location_names") or [])
            dist = top.get("district")
            if lang == "ta":
                return f"தமிழ்நாட்டில் {total} விபத்து பகுதிகள் கண்டறியப்பட்டுள்ளன. முக்கிய பகுதி: {names} ({dist})."
            elif lang == "en":
                return f"{total} crash hotspot clusters identified. Top corridor is {names} in {dist}."
            else:
                return f"Tamil Nadu-la {total} crash hotspots cluster aagi irukku. Top area {names} ({dist})."

        elif tool_name == "get_nearby_facilities":
            facs = tool_result.get("facilities", [])
            if facs:
                f0 = facs[0]
                fname = f0.get("name")
                km = f0.get("straight_line_km")
                if lang == "ta":
                    return f"அருகிலுள்ள அரசு மருத்துவமனை: {fname} (சுமார் {km} கி.மீ தூரம்). அவசர உதவிக்கு 108 அழைக்கவும்."
                elif lang == "en":
                    return f"Nearest government trauma hospital is {fname} ({km} km straight-line). Emergency: Call 108."
                else:
                    return f"Nearest trauma hospital {fname}, approx {km} km distance. Emergency-ku 108 call pannunga."

        elif tool_name == "get_area_traffic":
            matched = tool_result.get("matched", 0)
            if matched > 0 and tool_result.get("corridors"):
                c = tool_result["corridors"][0]
                loc = c.get("location_name")
                spd = c.get("current_speed_kmh")
                cong = c.get("congestion_level_pct")
                if lang == "ta":
                    return f"{loc} பகுதியில் தற்போதைய வேகம் {spd} கி.மீ/மணி, நெரிசல் {cong}%."
                elif lang == "en":
                    return f"At {loc}, current speed is {spd} km/h with {cong}% congestion."
                else:
                    return f"{loc}-la current speed {spd} km/h, congestion level {cong}%-ah irukku."

        # Default fallback response
        if lang == "ta":
            return "தகவல் சரிபார்க்கப்பட்டது. தொடர்புடைய பக்கம் திறக்கப்பட்டுள்ளது."
        elif lang == "en":
            return "Query processed and grounded in available transport data. Opened relevant view."
        else:
            return "Information retrieve aaiduchu. Relevant dashboard view-va open panrom."
