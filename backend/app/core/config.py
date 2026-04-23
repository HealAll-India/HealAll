"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_ENV: Literal["development", "staging", "production"] = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str
    APP_ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Database
    DATABASE_URL: PostgresDsn

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # S3
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_MEDIA: str = "healall-media"
    S3_BUCKET_IDENTITY: str = "healall-identity-ephemeral"
    S3_REGION: str = "us-east-1"

    # SMS (legacy stub config — kept for backward compat)
    SMS_PROVIDER: str = "stub"
    SMS_API_KEY: str = ""
    SMS_SENDER_ID: str = "HEALAL"

    # Email (legacy stub config — kept for backward compat)
    EMAIL_PROVIDER: str = "stub"
    EMAIL_SMTP_HOST: str = ""
    EMAIL_SMTP_PORT: int = 587
    EMAIL_SMTP_USER: str = ""
    EMAIL_SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@healall.in"

    # MSG91 (real SMS provider)
    MSG91_API_KEY: str | None = None
    MSG91_SENDER_ID: str | None = "HEALLL"
    MSG91_TEMPLATE_ID_OTP: str | None = None

    # SMTP (real email provider)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = "noreply@healall.in"
    SMTP_FROM_NAME: str | None = "HealAll"

    # WhatsApp (Meta Cloud API — replaces SMS)
    WHATSAPP_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None

    # Aadhaar
    AADHAAR_PROVIDER: str = "stub"
    AADHAAR_API_KEY: str = ""
    AADHAAR_API_URL: str = ""

    # Sentry
    SENTRY_DSN: str = ""

    @field_validator("APP_ALLOWED_ORIGINS")
    @classmethod
    def parse_cors_origins(cls, v: str) -> list[str]:
        """Parse comma-separated CORS origins."""
        return [origin.strip() for origin in v.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()  # type: ignore[call-arg]
