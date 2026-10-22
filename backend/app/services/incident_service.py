from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.incident import Incident, IncidentCategory, IncidentSeverity, IncidentStatus
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import IncidentCreate, IncidentUpdate


class IncidentService:
    def __init__(self, db: Session):
        self.repo = IncidentRepository(db)

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self.repo.get_by_id(incident_id)

    def list_incidents(
        self,
        category: Optional[IncidentCategory] = None,
        severity: Optional[IncidentSeverity] = None,
        status: Optional[IncidentStatus] = None,
        search: Optional[str] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lng: Optional[float] = None,
        max_lng: Optional[float] = None,
        corridor: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Incident], int, int]:
        skip = (page - 1) * page_size
        items, total = self.repo.filter_incidents(
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
            skip=skip,
            limit=page_size,
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        return items, total, total_pages

    def create_incident(self, payload: IncidentCreate) -> Incident:
        tags_str = ",".join(payload.tags) if payload.tags else ""
        incident = Incident(
            title=payload.title,
            description=payload.description,
            category=payload.category,
            severity=payload.severity,
            status=payload.status,
            latitude=payload.latitude,
            longitude=payload.longitude,
            location_name=payload.location_name,
            corridor=payload.corridor,
            speed_limit_kmh=payload.speed_limit_kmh,
            current_speed_kmh=payload.current_speed_kmh,
            congestion_level_pct=payload.congestion_level_pct,
            affected_lanes=payload.affected_lanes,
            is_simulated=payload.is_simulated,
            data_source=payload.data_source,
            tags=tags_str,
        )
        return self.repo.create(incident)

    def update_incident(self, incident_id: str, payload: IncidentUpdate) -> Optional[Incident]:
        incident = self.repo.get_by_id(incident_id)
        if not incident:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        if "tags" in update_data and update_data["tags"] is not None:
            incident.tags = ",".join(update_data.pop("tags"))

        if "status" in update_data:
            if update_data["status"] == IncidentStatus.RESOLVED and incident.status != IncidentStatus.RESOLVED:
                incident.resolved_at = datetime.now(timezone.utc)
            elif update_data["status"] != IncidentStatus.RESOLVED:
                incident.resolved_at = None

        for field, value in update_data.items():
            setattr(incident, field, value)

        return self.repo.update(incident)

    def delete_incident(self, incident_id: str) -> bool:
        incident = self.repo.get_by_id(incident_id)
        if not incident:
            return False
        self.repo.delete(incident)
        return True
