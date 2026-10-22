from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import IncidentStatisticsResponse


class StatisticsService:
    def __init__(self, db: Session):
        self.repo = IncidentRepository(db)

    def get_dashboard_statistics(self) -> IncidentStatisticsResponse:
        aggregates = self.repo.get_aggregate_stats()
        severity_counts = self.repo.count_by_severity()
        category_counts = self.repo.count_by_category()
        status_counts = self.repo.count_by_status()

        # Generate realistic 24-hour trend series based on real database records + temporal weighting
        now = datetime.now(timezone.utc)
        hourly_trends: List[Dict[str, Any]] = []
        for i in range(23, -1, -1):
            hour_point = now - timedelta(hours=i)
            # hour label e.g. "14:00"
            hour_label = hour_point.strftime("%H:00")
            
            # Baseline dynamic activity curve (morning & evening peaks common in transport systems)
            hour_val = hour_point.hour
            is_peak = (7 <= hour_val <= 9) or (16 <= hour_val <= 19)
            base_incidents = 4 if is_peak else 1
            congestion_base = 65.0 if is_peak else 25.0

            hourly_trends.append({
                "timestamp": hour_point.isoformat(),
                "hour": hour_label,
                "incident_count": base_incidents + (aggregates["total_incidents"] % 3),
                "congestion_pct": min(100.0, round(congestion_base + (aggregates["average_congestion_pct"] * 0.4), 1)),
                "average_speed_kmh": round(max(20.0, 75.0 - (congestion_base * 0.5)), 1),
            })

        return IncidentStatisticsResponse(
            total_incidents=aggregates["total_incidents"],
            active_incidents=aggregates["active_incidents"],
            critical_incidents=aggregates["critical_incidents"],
            high_priority_incidents=aggregates["high_priority_incidents"],
            average_congestion_pct=aggregates["average_congestion_pct"],
            monitored_corridors_count=max(aggregates["monitored_corridors_count"], 6),
            severity_breakdown=severity_counts,
            category_breakdown=category_counts,
            status_breakdown=status_counts,
            hourly_trends=hourly_trends,
            simulated_data_tag="SIMULATED DEMO DATA",
        )
