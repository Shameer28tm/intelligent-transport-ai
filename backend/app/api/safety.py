"""
Tamil Nadu Road Safety API.

All analytics are computed from incidents stored in the database (seeded demo incidents stay
tagged SIMULATED DEMO DATA). Reference data carries its own provenance notes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident
from app.services.safety.analytics import district_summary, find_hotspots, nearest_facilities
from app.services.safety.tn_reference import (
    DISTRICT_ASSIGNMENT_NOTE,
    FACILITY_NOTE,
    TN_CONTEXT,
    TN_DISTRICT_HQS,
)

router = APIRouter(prefix="/safety", tags=["Tamil Nadu Road Safety"])

MAX_INCIDENTS = 10000


def _incident_dicts(db: Session):
    return [i.to_dict() for i in db.query(Incident).order_by(Incident.created_at.desc()).limit(MAX_INCIDENTS).all()]


@router.get("/context")
def get_tn_context():
    """Cited statewide statistics, black-corridor definition, golden-hour scheme and helplines."""
    return TN_CONTEXT


@router.get("/summary")
def get_safety_summary(db: Session = Depends(get_db)):
    """District, severity, category and hour-of-day (IST) breakdown of stored incidents."""
    summary = district_summary(_incident_dicts(db))
    summary["district_note"] = DISTRICT_ASSIGNMENT_NOTE
    return summary


@router.get("/hotspots")
def get_hotspots(
    radius_m: float = Query(500.0, ge=50.0, le=5000.0, description="Clustering radius in metres"),
    min_incidents: int = Query(2, ge=1, le=50, description="Minimum crash records to form a hotspot"),
    days: Optional[int] = Query(1095, ge=1, le=3650, description="Look-back window in days"),
    db: Session = Depends(get_db),
):
    """Crash hotspots clustered from stored ACCIDENT and PEDESTRIAN_CROSSING_RISK incidents."""
    hotspots = find_hotspots(_incident_dicts(db), radius_m=radius_m, min_incidents=min_incidents, days=days)
    return {
        "radius_m": radius_m,
        "min_incidents": min_incidents,
        "days": days,
        "count": len(hotspots),
        "hotspots": hotspots,
        "method": "Density clustering of crash-related incidents (haversine distance). "
                  "Black-corridor flag applies the MoRTH-style rule to stored records only.",
        "district_note": DISTRICT_ASSIGNMENT_NOTE,
    }


@router.get("/facilities")
def get_nearest_facilities(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    limit: int = Query(5, ge=1, le=20),
):
    """Nearest government trauma-care hospitals by straight-line distance (city-level locations)."""
    return {
        "origin": {"lat": lat, "lng": lng},
        "facilities": nearest_facilities(lat, lng, limit),
        "distance_type": "straight_line",
        "note": FACILITY_NOTE,
        "helplines": TN_CONTEXT["helplines"],
    }


@router.get("/districts")
def get_districts():
    """Tamil Nadu district headquarters used for approximate district assignment."""
    return {"districts": TN_DISTRICT_HQS, "note": DISTRICT_ASSIGNMENT_NOTE}
