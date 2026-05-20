"""Application configuration using Pydantic Settings."""

import re
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, field_validator
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

    # Comma-separated string kept as str so pydantic-settings does not try to
    # JSON-decode values like "http://localhost:3000" from environment vars.
    APP_ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Optional regex matched against the Origin header. Useful for Vercel
    # preview deploys (frontend-git-*-*.vercel.app) which have a dynamic
    # hostname per branch. Empty string = no regex match (only the explicit
    # APP_ALLOWED_ORIGINS list is honored).
    APP_ALLOWED_ORIGIN_REGEX: str = ""

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

    # SMS
    SMS_PROVIDER: str = "stub"
    SMS_API_KEY: str = ""
    SMS_SENDER_ID: str = "HEALAL"

    # Email
    EMAIL_PROVIDER: str = "stub"
    EMAIL_SMTP_HOST: str = ""
    EMAIL_SMTP_PORT: int = 587
    EMAIL_SMTP_USER: str = ""
    EMAIL_SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@healall.in"

    # MSG91
    MSG91_API_KEY: str | None = None
    MSG91_SENDER_ID: str | None = "HEALLL"
    MSG91_TEMPLATE_ID_OTP: str | None = None

    # SMTP
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = "noreply@healall.in"
    SMTP_FROM_NAME: str | None = "HealAll"

    # WhatsApp
    WHATSAPP_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
    WHATSAPP_OTP_TEMPLATE_NAME: str | None = None

    # Aadhaar
    AADHAAR_PROVIDER: str = "stub"
    AADHAAR_API_KEY: str = ""
    AADHAAR_API_URL: str = ""

    # Resend
    RESEND_API_KEY: str | None = None

    # Issue-report fan-out (landing-page feedback form)
    # GITHUB_TOKEN is a fine-grained PAT with Issues: read-and-write
    GITHUB_TOKEN: str | None = None
    GITHUB_REPO: str = "HealAll-India/HealAll"
    ISSUE_REPORT_EMAIL_TO: str | None = None

    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = None

    # Sentry
    SENTRY_DSN: str = ""

    # Metrics
    METRICS_ENABLED: bool = True

    # Community verification
    COMMUNITY_VERIFY_THRESHOLD: int = Field(default=3, ge=1)

    @property
    def allowed_origins(self) -> list[str]:
        """Parse comma-separated APP_ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.APP_ALLOWED_ORIGINS.split(",") if o.strip()]

    @field_validator("APP_ALLOWED_ORIGIN_REGEX")
    @classmethod
    def validate_origin_regex(cls, v: str) -> str:
        """Validate regex pattern for allowed origins."""
        if not v:
            return v
        try:
            re.compile(v)
        except re.error as exc:
            raise ValueError(f"Invalid APP_ALLOWED_ORIGIN_REGEX: {exc}") from exc
        return v


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
