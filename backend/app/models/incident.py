import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Text,
)
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IncidentCategory(str, enum.Enum):
    ACCIDENT = "ACCIDENT"
    CONGESTION = "CONGESTION"
    ROADWORK = "ROADWORK"
    HAZARD = "HAZARD"
    VEHICLE_BREAKDOWN = "VEHICLE_BREAKDOWN"
    PEDESTRIAN_CROSSING_RISK = "PEDESTRIAN_CROSSING_RISK"
    WEATHER_EVENT = "WEATHER_EVENT"


class IncidentSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class IncidentStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    VERIFIED = "VERIFIED"
    DISPATCHED = "DISPATCHED"
    RESOLVED = "RESOLVED"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(SQLEnum(IncidentCategory), nullable=False, index=True)
    severity = Column(SQLEnum(IncidentSeverity), nullable=False, index=True)
    status = Column(SQLEnum(IncidentStatus), nullable=False, default=IncidentStatus.REPORTED, index=True)
    
    # Geographic location
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    location_name = Column(String(255), nullable=False)
    corridor = Column(String(100), nullable=True)
    
    # Transport operational metrics
    speed_limit_kmh = Column(Float, nullable=True)
    current_speed_kmh = Column(Float, nullable=True)
    congestion_level_pct = Column(Float, default=0.0)
    affected_lanes = Column(Integer, default=1)
    
    # Demonstration & provenance integrity
    is_simulated = Column(Boolean, default=True, nullable=False)
    data_source = Column(String(100), default="SIMULATED DEMO DATA", nullable=False)
    
    # Metadata
    tags = Column(String(255), default="")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category.value if isinstance(self.category, IncidentCategory) else self.category,
            "severity": self.severity.value if isinstance(self.severity, IncidentSeverity) else self.severity,
            "status": self.status.value if isinstance(self.status, IncidentStatus) else self.status,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "location_name": self.location_name,
            "corridor": self.corridor,
            "speed_limit_kmh": self.speed_limit_kmh,
            "current_speed_kmh": self.current_speed_kmh,
            "congestion_level_pct": self.congestion_level_pct,
            "affected_lanes": self.affected_lanes,
            "is_simulated": self.is_simulated,
            "data_source": self.data_source,
            "tags": self.tags.split(",") if self.tags else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }
