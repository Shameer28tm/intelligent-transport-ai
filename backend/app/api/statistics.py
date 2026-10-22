from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.incident import IncidentStatisticsResponse
from app.services.statistics_service import StatisticsService

router = APIRouter(prefix="/statistics", tags=["Traffic & Safety Analytics"])


@router.get("", response_model=IncidentStatisticsResponse)
def get_transport_statistics(db: Session = Depends(get_db)):
    """
    Retrieve real-time aggregated metrics for dashboard KPIs,
    active alerts, severity breakdown, category distribution, and 24h trends.
    """
    service = StatisticsService(db)
    return service.get_dashboard_statistics()
