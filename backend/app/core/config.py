import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

# Get the directory of the current file (backend/app/core/config.py)
# and go up three levels to reach the project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

class Settings(BaseSettings):
    PROJECT_NAME: str = "StandupSync"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "DEVELOPMENT_SECRET_KEY_CHANGE_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "standupsync"
    DATABASE_URL: Optional[str] = None

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis & Celery
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # AI API Keys
    GEMINI_API_KEY: Optional[str] = None

    # CORS — comma-separated origins allowed to call the API
    # e.g. "http://localhost:5173,https://app.yourdomain.com"
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    model_config = SettingsConfigDict(case_sensitive=True, env_file=ENV_PATH, env_file_encoding='utf-8')

settings = Settings()
