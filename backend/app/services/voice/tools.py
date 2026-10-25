"""
Allowlisted, typed tool registry for Voice Assistant.
Every tool operates strictly on the existing backend services and database records.
No LLM hallucinations or synthetic data invention.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.incident import Incident, IncidentCategory, IncidentSeverity, IncidentStatus
from app.repositories.incident_repository import IncidentRepository
from app.services.safety.analytics import district_summary, find_hotspots, nearest_facilities
from app.services.safety.tn_reference import TN_CONTEXT, TN_TRAUMA_FACILITIES

logger = logging.getLogger("transport.voice.tools")

# Allowlisted tools metadata definition for Gemini
TOOL_DEFINITIONS = [
    {
        "name": "get_critical_areas",
        "description": "Retrieve the most critical road safety areas and corridors ranked by incident severity, congestion, and status from the incident database.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of critical records to retrieve (default 5, max 10)",
                }
            },
        },
    },
    {
        "name": "get_area_traffic",
        "description": "Check current traffic congestion, speed, and status for a specific road, junction, or corridor (e.g. Kathipara, Anna Salai, GST Road, OMR, Vikravandi, Madurai, Coimbatore).",
        "parameters": {
            "type": "object",
            "properties": {
                "location_query": {
                    "type": "string",
                    "description": "The name of the location, road, or corridor to check (e.g., 'Kathipara', 'Anna Salai', 'GST Road', 'Vikravandi')",
                }
            },
            "required": ["location_query"],
        },
    },
    {
        "name": "get_incidents",
        "description": "List traffic incidents from the ledger, optionally filtered by category (ACCIDENT, CONGESTION, ROADWORK, HAZARD, PEDESTRIAN_CROSSING_RISK) or severity.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Filter by category: ACCIDENT, CONGESTION, ROADWORK, HAZARD, PEDESTRIAN_CROSSING_RISK",
                },
                "severity": {
                    "type": "string",
                    "description": "Filter by severity: CRITICAL, HIGH, MEDIUM, LOW",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of records to return (default 5)",
                },
            },
        },
    },
    {
        "name": "get_road_safety_hotspots",
        "description": "Retrieve Tamil Nadu crash hotspot clusters and black-corridor candidates evaluated using the MoRTH-style rule (5+ serious crashes in 500m over 3 years).",
        "parameters": {
            "type": "object",
            "properties": {
                "radius_m": {
                    "type": "number",
                    "description": "Clustering radius in meters (default 500.0)",
                }
            },
        },
    },
    {
        "name": "get_nearby_facilities",
        "description": "Find nearest government trauma care hospitals and emergency contacts (108 / 112) for an incident or coordinates.",
        "parameters": {
            "type": "object",
            "properties": {
                "latitude": {
                    "type": "number",
                    "description": "Latitude coordinate of the location or incident",
                },
                "longitude": {
                    "type": "number",
                    "description": "Longitude coordinate of the location or incident",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of trauma care hospitals to return (default 3)",
                },
            },
            "required": ["latitude", "longitude"],
        },
    },
    {
        "name": "get_capabilities",
        "description": "Explain available Intelligent Transport AI features, data provenance, supported languages, and system modules.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
]


def execute_tool(tool_name: str, arguments: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """Execute an allowlisted tool against real backend services and database models."""
    tool_name = (tool_name or "").strip()
    arguments = arguments or {}

    if tool_name == "get_critical_areas":
        limit = min(max(1, int(arguments.get("limit", 5))), 10)
        # Query database for CRITICAL and HIGH severity incidents
        critical_records = (
            db.query(Incident)
            .filter(Incident.severity.in_([IncidentSeverity.CRITICAL, IncidentSeverity.HIGH]))
            .order_by(Incident.created_at.desc())
            .limit(limit)
            .all()
        )
        if not critical_records:
            # Fallback to any recent incidents
            critical_records = db.query(Incident).order_by(Incident.created_at.desc()).limit(limit).all()

        items = []
        for inc in critical_records:
            items.append({
                "id": inc.id,
                "title": inc.title,
                "location_name": inc.location_name,
                "corridor": inc.corridor,
                "severity": inc.severity.value,
                "category": inc.category.value,
                "status": inc.status.value,
                "congestion_level_pct": inc.congestion_level_pct,
                "current_speed_kmh": inc.current_speed_kmh,
                "is_simulated": bool(inc.is_simulated),
                "latitude": inc.latitude,
                "longitude": inc.longitude,
            })
        return {
            "total_found": len(items),
            "critical_areas": items,
            "data_source": "Incident Database Ledger",
        }

    elif tool_name == "get_area_traffic":
        query = str(arguments.get("location_query", "")).strip().lower()
        if not query:
            return {"error": "location_query is required"}

        # Search database incidents by location_name or corridor
        matches = (
            db.query(Incident)
            .filter(
                (Incident.location_name.ilike(f"%{query}%")) |
                (Incident.corridor.ilike(f"%{query}%")) |
                (Incident.title.ilike(f"%{query}%"))
            )
            .order_by(Incident.created_at.desc())
            .limit(4)
            .all()
        )

        if matches:
            results = []
            for m in matches:
                results.append({
                    "location_name": m.location_name,
                    "corridor": m.corridor,
                    "current_speed_kmh": m.current_speed_kmh,
                    "speed_limit_kmh": m.speed_limit_kmh,
                    "congestion_level_pct": m.congestion_level_pct,
                    "category": m.category.value,
                    "severity": m.severity.value,
                    "is_simulated": bool(m.is_simulated),
                    "latitude": m.latitude,
                    "longitude": m.longitude,
                })
            return {
                "matched": len(results),
                "query": query,
                "corridors": results,
                "data_source": "Stored Traffic Corridor Records",
            }
        else:
            return {
                "matched": 0,
                "query": query,
                "message": f"No stored incident or corridor data found for '{query}'.",
                "known_supported_areas": ["Kathipara Guindy", "Anna Salai", "GST Road", "OMR", "NH-45 Vikravandi", "Madurai", "Trichy", "Coimbatore"],
            }

    elif tool_name == "get_incidents":
        repo = IncidentRepository(db)
        cat_str = arguments.get("category")
        sev_str = arguments.get("severity")
        limit = min(max(1, int(arguments.get("limit", 5))), 20)

        cat_enum = None
        if cat_str:
            try:
                cat_enum = IncidentCategory(cat_str.upper())
            except ValueError:
                pass

        sev_enum = None
        if sev_str:
            try:
                sev_enum = IncidentSeverity(sev_str.upper())
            except ValueError:
                pass

        incidents, total = repo.list(category=cat_enum, severity=sev_enum, limit=limit)
        return {
            "total_matches": total,
            "items": [
                {
                    "id": i.id,
                    "title": i.title,
                    "location_name": i.location_name,
                    "category": i.category.value,
                    "severity": i.severity.value,
                    "status": i.status.value,
                    "is_simulated": bool(i.is_simulated),
                    "latitude": i.latitude,
                    "longitude": i.longitude,
                }
                for i in incidents
            ],
            "data_source": "Incident Database Ledger",
        }

    elif tool_name == "get_road_safety_hotspots":
        radius_m = float(arguments.get("radius_m", 500.0))
        all_incidents = [i.to_dict() for i in db.query(Incident).all()]
        hotspots = find_hotspots(all_incidents, radius_m=radius_m, min_incidents=2)
        top_hotspots = hotspots[:5]
        return {
            "total_hotspots_clustered": len(hotspots),
            "radius_m": radius_m,
            "top_hotspots": [
                {
                    "rank": h.get("rank"),
                    "location_names": h.get("location_names"),
                    "district": h.get("district"),
                    "incident_count": h.get("incident_count"),
                    "serious_count": h.get("serious_count"),
                    "meets_black_corridor_rule": h.get("meets_black_corridor_rule"),
                    "is_simulated": h.get("is_simulated"),
                    "latitude": h.get("latitude"),
                    "longitude": h.get("longitude"),
                }
                for h in top_hotspots
            ],
            "criteria": "MoRTH-style: 5+ serious crashes in 500m over 3 years",
        }

    elif tool_name == "get_nearby_facilities":
        lat = float(arguments.get("latitude", 13.0067))
        lng = float(arguments.get("longitude", 80.2045))
        limit = min(max(1, int(arguments.get("limit", 3))), 5)
        facs = nearest_facilities(lat, lng, limit=limit)
        return {
            "origin": {"lat": lat, "lng": lng},
            "facilities": facs,
            "helplines": TN_CONTEXT.get("helplines", [
                {"number": "108", "label": "Emergency ambulance (Tamil Nadu)"},
                {"number": "112", "label": "National emergency number"},
            ]),
            "note": "Government trauma-care hospitals at city-level locations. Straight-line distance.",
        }

    elif tool_name == "get_capabilities":
        return {
            "system_name": "Intelligent Transport AI",
            "region_focus": "Tamil Nadu, India",
            "available_modules": [
                {"id": "overview", "label": "Overview Dashboard"},
                {"id": "map", "label": "Interactive Map & TomTom Live Traffic"},
                {"id": "traffic-intelligence", "label": "Traffic Intelligence & Rider Safety Vision"},
                {"id": "safety", "label": "Tamil Nadu Road Safety & Hotspots"},
                {"id": "emergency", "label": "Emergency Response & Golden Hour Tracking"},
                {"id": "traffic", "label": "Corridor Performance & Congestion"},
                {"id": "explorer", "label": "Incident Explorer"},
            ],
            "voice_capabilities": {
                "speech_recognition": "Sarvam Saaras v4 (Tamil, English, Thanglish)",
                "speech_synthesis": "Sarvam Bulbul v4 Flash (Gokul voice)",
                "intelligence": "Google Gemini 2.5 Flash with tool grounding",
                "navigation_actions": ["navigate_to_page", "focus_map_location", "select_incident"],
            },
            "data_provenance": "Real incident ledger with clear demo/simulated vs live tags; verified MoRTH statistics.",
        }

    else:
        return {"error": f"Unknown tool: '{tool_name}'"}
