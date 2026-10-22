from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.incident import IncidentCategory, IncidentSeverity, IncidentStatus
from app.schemas.incident import (
    IncidentCreate,
    IncidentUpdate,
    IncidentResponse,
    PaginatedIncidentsResponse,
)
from app.services.incident_service import IncidentService

router = APIRouter(prefix="/incidents", tags=["Road Incidents & Safety"])


@router.get("", response_model=PaginatedIncidentsResponse)
def list_incidents(
    category: Optional[IncidentCategory] = Query(None, description="Filter by category"),
    severity: Optional[IncidentSeverity] = Query(None, description="Filter by severity level"),
    status: Optional[IncidentStatus] = Query(None, description="Filter by operational status"),
    search: Optional[str] = Query(None, min_length=1, description="Search keyword in title or address"),
    min_lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Spatial bounding box min latitude"),
    max_lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Spatial bounding box max latitude"),
    min_lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Spatial bounding box min longitude"),
    max_lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Spatial bounding box max longitude"),
    corridor: Optional[str] = Query(None, description="Filter by corridor name"),
    sort_by: str = Query("created_at", description="Field to sort by: created_at, severity, congestion_level_pct"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),

    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db),
):
    """
    Retrieve paginated transport incidents with geographic bounding-box and operational filters.
    """
    service = IncidentService(db)
    items, total, total_pages = service.list_incidents(
        category=category,
        severity=severity,
        status=status,
        search=search,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lng=min_lng,
        max_lng=max_lng,
        corridor=corridor,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )

    response_items = []
    for item in items:
        tags_list = item.tags.split(",") if item.tags else []
        response_items.append(
            IncidentResponse(
                id=item.id,
                title=item.title,
                description=item.description,
                category=item.category,
                severity=item.severity,
                status=item.status,
                latitude=item.latitude,
                longitude=item.longitude,
                location_name=item.location_name,
                corridor=item.corridor,
                speed_limit_kmh=item.speed_limit_kmh,
                current_speed_kmh=item.current_speed_kmh,
                congestion_level_pct=item.congestion_level_pct,
                affected_lanes=item.affected_lanes,
                tags=tags_list,
                is_simulated=item.is_simulated,
                data_source=item.data_source,
                created_at=item.created_at,
                updated_at=item.updated_at,
                resolved_at=item.resolved_at,
            )
        )

    return PaginatedIncidentsResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Retrieve detailed information for a specific incident."""
    service = IncidentService(db)
    incident = service.get_incident(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    tags_list = incident.tags.split(",") if incident.tags else []
    return IncidentResponse(
        id=incident.id,
        title=incident.title,
        description=incident.description,
        category=incident.category,
        severity=incident.severity,
        status=incident.status,
        latitude=incident.latitude,
        longitude=incident.longitude,
        location_name=incident.location_name,
        corridor=incident.corridor,
        speed_limit_kmh=incident.speed_limit_kmh,
        current_speed_kmh=incident.current_speed_kmh,
        congestion_level_pct=incident.congestion_level_pct,
        affected_lanes=incident.affected_lanes,
        tags=tags_list,
        is_simulated=incident.is_simulated,
        data_source=incident.data_source,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        resolved_at=incident.resolved_at,
    )


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    """
    Log a new road safety or traffic incident.
    Validates geographic coordinates and operational parameters.
    """
    service = IncidentService(db)
    incident = service.create_incident(payload)
    tags_list = incident.tags.split(",") if incident.tags else []
    return IncidentResponse(
        id=incident.id,
        title=incident.title,
        description=incident.description,
        category=incident.category,
        severity=incident.severity,
        status=incident.status,
        latitude=incident.latitude,
        longitude=incident.longitude,
        location_name=incident.location_name,
        corridor=incident.corridor,
        speed_limit_kmh=incident.speed_limit_kmh,
        current_speed_kmh=incident.current_speed_kmh,
        congestion_level_pct=incident.congestion_level_pct,
        affected_lanes=incident.affected_lanes,
        tags=tags_list,
        is_simulated=incident.is_simulated,
        data_source=incident.data_source,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        resolved_at=incident.resolved_at,
    )


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: str, payload: IncidentUpdate, db: Session = Depends(get_db)):
    """
    Update incident status (e.g. REPORTED -> VERIFIED -> DISPATCHED -> RESOLVED)
    or modify operational parameters.
    """
    service = IncidentService(db)
    incident = service.update_incident(incident_id, payload)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    tags_list = incident.tags.split(",") if incident.tags else []
    return IncidentResponse(
        id=incident.id,
        title=incident.title,
        description=incident.description,
        category=incident.category,
        severity=incident.severity,
        status=incident.status,
        latitude=incident.latitude,
        longitude=incident.longitude,
        location_name=incident.location_name,
        corridor=incident.corridor,
        speed_limit_kmh=incident.speed_limit_kmh,
        current_speed_kmh=incident.current_speed_kmh,
        congestion_level_pct=incident.congestion_level_pct,
        affected_lanes=incident.affected_lanes,
        tags=tags_list,
        is_simulated=incident.is_simulated,
        data_source=incident.data_source,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        resolved_at=incident.resolved_at,
    )


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(incident_id: str, db: Session = Depends(get_db)):
    """Delete an incident record."""
    service = IncidentService(db)
    deleted = service.delete_incident(incident_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID '{incident_id}' not found.",
        )
    return None
