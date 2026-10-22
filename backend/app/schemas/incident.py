from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from app.models.incident import IncidentCategory, IncidentSeverity, IncidentStatus


class IncidentBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Short descriptive title of the incident")
    description: Optional[str] = Field(None, max_length=2000, description="Detailed description")
    category: IncidentCategory = Field(..., description="Classification category")
    severity: IncidentSeverity = Field(..., description="Severity level")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 Latitude between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 Longitude between -180 and 180")
    location_name: str = Field(..., min_length=2, max_length=255, description="Street address or intersection name")
    corridor: Optional[str] = Field(None, max_length=100, description="Transit/Highway corridor identifier")
    speed_limit_kmh: Optional[float] = Field(None, ge=0.0, le=300.0)
    current_speed_kmh: Optional[float] = Field(None, ge=0.0, le=300.0)
    congestion_level_pct: float = Field(0.0, ge=0.0, le=100.0, description="Congestion percentage 0-100")
    affected_lanes: int = Field(1, ge=0, le=16)
    tags: Optional[List[str]] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Title cannot be blank or whitespace only")
        return stripped


class IncidentCreate(IncidentBase):
    status: IncidentStatus = Field(default=IncidentStatus.REPORTED)
    is_simulated: bool = Field(default=True, description="Flag indicating simulated demonstration data")
    data_source: str = Field(default="USER_REPORTED_DEMO", description="Source of incident record")


class IncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[IncidentCategory] = None
    severity: Optional[IncidentSeverity] = None
    status: Optional[IncidentStatus] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    location_name: Optional[str] = Field(None, min_length=2, max_length=255)
    corridor: Optional[str] = None
    speed_limit_kmh: Optional[float] = Field(None, ge=0.0, le=300.0)
    current_speed_kmh: Optional[float] = Field(None, ge=0.0, le=300.0)
    congestion_level_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    affected_lanes: Optional[int] = Field(None, ge=0, le=16)
    tags: Optional[List[str]] = None


class IncidentResponse(IncidentBase):
    id: str
    status: IncidentStatus
    is_simulated: bool
    data_source: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PaginatedIncidentsResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    is_simulated_notice: str = "Records may include SIMULATED DEMO DATA for operational testing."


class IncidentStatisticsResponse(BaseModel):
    total_incidents: int
    active_incidents: int
    critical_incidents: int
    high_priority_incidents: int
    average_congestion_pct: float
    monitored_corridors_count: int
    severity_breakdown: Dict[str, int]
    category_breakdown: Dict[str, int]
    status_breakdown: Dict[str, int]
    hourly_trends: List[Dict[str, Any]]
    simulated_data_tag: str = "SIMULATED DEMO DATA"
