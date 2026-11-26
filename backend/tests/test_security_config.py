"""Production safety switches that don't need a database."""

from app.core.config import Settings
from app.core.limiter import storage_uri
from app.services.issue_report_service import _build_github_body

_BASE = {
    "APP_SECRET_KEY": "x" * 32,
    "JWT_SECRET_KEY": "y" * 32,
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "REDIS_URL": "rediss://default:secret@example.upstash.io:6379",
}


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **{**_BASE, **overrides})


def test_production_forces_debug_off():
    assert _settings(APP_ENV="production", APP_DEBUG=True).APP_DEBUG is False


def test_development_keeps_debug_setting():
    assert _settings(APP_ENV="development", APP_DEBUG=True).APP_DEBUG is True


def test_rate_limits_use_redis_in_production_only():
    assert storage_uri(_settings(APP_ENV="production")) == _BASE["REDIS_URL"]
    assert storage_uri(_settings(APP_ENV="development")) is None
    assert storage_uri(_settings(APP_ENV="staging")) is None


def test_public_issue_hides_contact_email_and_masks_pii():
    body = _build_github_body(
        "Can't sign in. Call me on 98765 43210 or write to asha@example.com",
        "asha@example.com",
        "https://healallindia.com/login",
    )
    assert "asha@example.com" not in body
    assert "98765 43210" not in body
    assert "Can't sign in" in body
    assert "https://healallindia.com/login" in body
