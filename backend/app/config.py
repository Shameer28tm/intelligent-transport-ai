from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Intelligent Transport AI"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Server
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True
    
    # Persistence
    DATABASE_URL: str = "sqlite:///./transport.db"
    
    # Security & CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Vision & Upload limits
    MAX_UPLOAD_SIZE_BYTES: int = 20 * 1024 * 1024  # 20 MB
    UPLOAD_DIR: str = "./uploads"
    VISION_ADAPTER: str = "simulator"  # "simulator" or "real"
    
    # Demo configuration
    DEMO_DATA_TAG: str = "SIMULATED DEMO DATA"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
