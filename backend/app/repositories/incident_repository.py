from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import func, or_, desc, asc
from sqlalchemy.orm import Session
from app.models.incident import Incident, IncidentCategory, IncidentSeverity, IncidentStatus
from app.repositories.base import BaseRepository


class IncidentRepository(BaseRepository[Incident]):
    def __init__(self, db: Session):
        super().__init__(Incident, db)

    def filter_incidents(
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
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Incident], int]:
        query = self.db.query(Incident)

        if category:
            query = query.filter(Incident.category == category)
        if severity:
            query = query.filter(Incident.severity == severity)
        if status:
            query = query.filter(Incident.status == status)
        if corridor:
            query = query.filter(Incident.corridor.ilike(f"%{corridor}%"))

        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Incident.title.ilike(search_term),
                    Incident.description.ilike(search_term),
                    Incident.location_name.ilike(search_term),
                    Incident.corridor.ilike(search_term),
                )
            )

        # Spatial bounding box filtering
        if min_lat is not None and max_lat is not None:
            query = query.filter(Incident.latitude.between(min_lat, max_lat))
        if min_lng is not None and max_lng is not None:
            query = query.filter(Incident.longitude.between(min_lng, max_lng))

        total = query.count()

        # Sorting
        sort_column = getattr(Incident, sort_by, Incident.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        items = query.offset(skip).limit(limit).all()
        return items, total

    def count_by_severity(self) -> Dict[str, int]:
        counts = (
            self.db.query(Incident.severity, func.count(Incident.id))
            .group_by(Incident.severity)
            .all()
        )
        result = {sev.value: 0 for sev in IncidentSeverity}
        for sev, count in counts:
            key = sev.value if hasattr(sev, "value") else str(sev)
            result[key] = count
        return result

    def count_by_category(self) -> Dict[str, int]:
        counts = (
            self.db.query(Incident.category, func.count(Incident.id))
            .group_by(Incident.category)
            .all()
        )
        result = {cat.value: 0 for cat in IncidentCategory}
        for cat, count in counts:
            key = cat.value if hasattr(cat, "value") else str(cat)
            result[key] = count
        return result

    def count_by_status(self) -> Dict[str, int]:
        counts = (
            self.db.query(Incident.status, func.count(Incident.id))
            .group_by(Incident.status)
            .all()
        )
        result = {stat.value: 0 for stat in IncidentStatus}
        for stat, count in counts:
            key = stat.value if hasattr(stat, "value") else str(stat)
            result[key] = count
        return result

    def get_aggregate_stats(self) -> Dict[str, Any]:
        total = self.db.query(func.count(Incident.id)).scalar() or 0
        active_count = (
            self.db.query(func.count(Incident.id))
            .filter(Incident.status != IncidentStatus.RESOLVED)
            .scalar()
            or 0
        )
        critical_count = (
            self.db.query(func.count(Incident.id))
            .filter(
                Incident.severity == IncidentSeverity.CRITICAL,
                Incident.status != IncidentStatus.RESOLVED,
            )
            .scalar()
            or 0
        )
        high_count = (
            self.db.query(func.count(Incident.id))
            .filter(
                Incident.severity == IncidentSeverity.HIGH,
                Incident.status != IncidentStatus.RESOLVED,
            )
            .scalar()
            or 0
        )
        avg_congestion = (
            self.db.query(func.avg(Incident.congestion_level_pct)).scalar() or 0.0
        )
        corridors_count = (
            self.db.query(func.count(func.distinct(Incident.corridor))).scalar() or 0
        )

        return {
            "total_incidents": total,
            "active_incidents": active_count,
            "critical_incidents": critical_count,
            "high_priority_incidents": high_count,
            "average_congestion_pct": round(float(avg_congestion), 1),
            "monitored_corridors_count": corridors_count,
        }
