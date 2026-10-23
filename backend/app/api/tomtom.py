from typing import Optional
from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.services.tomtom import get_tomtom_service

router = APIRouter(prefix="/tomtom", tags=["TomTom Traffic Integration"])


@router.get("/status")
def get_tomtom_status(force_refresh: bool = Query(False, description="Bypass cache and probe TomTom API")):
    """
    Returns real-time verification of TomTom credentials, connectivity, and product entitlements.
    Confirms whether credentials are operational, unauthorized (HTTP 401), rate limited (HTTP 429),
    or missing, without ever leaking raw API keys in response or server logs.
    """
    service = get_tomtom_service()
    return service.get_status(force_refresh=force_refresh)


@router.get("/flow")
def get_traffic_flow(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude of road fragment"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude of road fragment"),
    zoom: int = Query(10, ge=0, le=22, description="Tile zoom level"),
    unit: str = Query("Kmh", description="Speed unit: Kmh or Mph"),
):
    """
    Retrieves real-time traffic flow speed, travel time, and congestion level
    for the road segment closest to (lat, lng).
    Conforms to TomTom Traffic Flow API v4.
    """
    service = get_tomtom_service()
    result = service.get_flow_segment(latitude=lat, longitude=lng, zoom=zoom, unit=unit)
    return result


@router.get("/incidents")
def get_traffic_incidents(
    min_lon: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Bounding box min longitude"),
    min_lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Bounding box min latitude"),
    max_lon: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Bounding box max longitude"),
    max_lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Bounding box max latitude"),
):
    """
    Retrieves real-time traffic incidents inside bounding box (min_lon, min_lat, max_lon, max_lat).
    Defaults to the operational corridor (San Francisco Metropolitan area).
    Normalizes returned data into the application's Incident schema with source attribution.
    """
    service = get_tomtom_service()
    bbox = None
    if None not in (min_lon, min_lat, max_lon, max_lat):
        if min_lon >= max_lon or min_lat >= max_lat:
            return {
                "success": False,
                "provider": "tomtom",
                "error": "Invalid bounding box: min coordinates must be strictly less than max coordinates.",
                "http_status_code": 400,
                "incidents": [],
            }
        bbox = (min_lon, min_lat, max_lon, max_lat)

    result = service.get_incidents(bbox=bbox)
    return result
