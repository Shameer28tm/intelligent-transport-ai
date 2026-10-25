from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import IncidentStatisticsResponse
from app.models.incident import Incident


class StatisticsService:
    def __init__(self, db: Session):
        self.repo = IncidentRepository(db)

    def get_dashboard_statistics(self) -> IncidentStatisticsResponse:
        aggregates = self.repo.get_aggregate_stats()
        severity_counts = self.repo.count_by_severity()
        category_counts = self.repo.count_by_category()
        status_counts = self.repo.count_by_status()

        # 24-hour trend computed from incidents actually recorded in each hour (no synthetic curve).
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
        recent = (
            self.repo.db.query(Incident.created_at, Incident.congestion_level_pct, Incident.current_speed_kmh)
            .filter(Incident.created_at >= window_start)
            .all()
        )
        buckets: Dict[int, List[Any]] = {}
        for created_at, congestion, speed in recent:
            if created_at is None:
                continue
            ts = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
            idx = int((ts - window_start).total_seconds() // 3600)
            if 0 <= idx < 24:
                buckets.setdefault(idx, []).append((congestion, speed))

        hourly_trends: List[Dict[str, Any]] = []
        for idx in range(24):
            hour_point = window_start + timedelta(hours=idx)
            rows = buckets.get(idx, [])
            cong = [c for c, _ in rows if c is not None]
            spd = [v for _, v in rows if v is not None]
            hourly_trends.append({
                "timestamp": hour_point.isoformat(),
                "hour": hour_point.strftime("%H:00"),
                "incident_count": len(rows),
                "congestion_pct": round(sum(cong) / len(cong), 1) if cong else 0.0,
                "average_speed_kmh": round(sum(spd) / len(spd), 1) if spd else 0.0,
            })

        return IncidentStatisticsResponse(
            total_incidents=aggregates["total_incidents"],
            active_incidents=aggregates["active_incidents"],
            critical_incidents=aggregates["critical_incidents"],
            high_priority_incidents=aggregates["high_priority_incidents"],
            average_congestion_pct=aggregates["average_congestion_pct"],
            monitored_corridors_count=aggregates["monitored_corridors_count"],
            severity_breakdown=severity_counts,
            category_breakdown=category_counts,
            status_breakdown=status_counts,
            hourly_trends=hourly_trends,
            simulated_data_tag="SIMULATED DEMO DATA",
        )
