"""DATABASE_URL parsing for asyncpg (app, migrations and the schema drift check)."""

import ssl

import certifi
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.url import asyncpg_url
from tests.conftest import TEST_DATABASE_URL, ensure_test_database_exists

NEON = "postgresql+asyncpg://user:pw@ep-x.ap-southeast-1.aws.neon.tech/neondb"


def _verified(arg: object, *, hostname: bool) -> bool:
    return isinstance(arg, ssl.SSLContext) and arg.verify_mode == ssl.CERT_REQUIRED and arg.check_hostname is hostname


def test_neon_connection_string_keeps_the_database_name_and_verifies_the_server():
    # asyncpg can't do channel binding, so the certificate check stands in for it.
    url, connect_args = asyncpg_url(f"{NEON}?sslmode=require&channel_binding=require")
    assert url == NEON
    assert _verified(connect_args["ssl"], hostname=True)


@pytest.mark.parametrize("binding", ["prefer", "disable"])
def test_optional_channel_binding_is_dropped(binding):
    assert asyncpg_url(f"{NEON}?sslmode=require&channel_binding={binding}") == (NEON, {"ssl": "require"})


def test_required_channel_binding_without_tls_is_rejected():
    with pytest.raises(ValueError, match="channel_binding=require needs TLS"):
        asyncpg_url(f"{NEON}?sslmode=disable&channel_binding=require")


@pytest.mark.parametrize("mode", ["disable", "require", "verify-ca", "verify-full"])
def test_ssl_mode_is_passed_through(mode):
    assert asyncpg_url(f"{NEON}?sslmode={mode}") == (NEON, {"ssl": mode})


def test_root_certificate_is_loaded_and_keeps_the_mode():
    ca = certifi.where()  # any readable PEM bundle
    url, full = asyncpg_url(f"{NEON}?sslmode=verify-full&sslrootcert={ca}")
    assert url == NEON
    assert _verified(full["ssl"], hostname=True)
    # verify-ca, and require with a root certificate (as in libpq), skip the hostname check.
    for mode in ("verify-ca", "require"):
        assert _verified(asyncpg_url(f"{NEON}?sslmode={mode}&sslrootcert={ca}")[1]["ssl"], hostname=False)


def test_system_root_certificates_mean_verify_full():
    assert _verified(asyncpg_url(f"{NEON}?sslrootcert=system")[1]["ssl"], hostname=True)
    with pytest.raises(ValueError, match="sslrootcert=system needs sslmode=verify-full"):
        asyncpg_url(f"{NEON}?sslmode=require&sslrootcert=system")


def test_application_name_becomes_a_server_setting_and_other_parameters_stay():
    url, connect_args = asyncpg_url(f"{NEON}?application_name=api&prepared_statement_cache_size=0")
    assert url == f"{NEON}?prepared_statement_cache_size=0"
    assert connect_args == {"server_settings": {"application_name": "api"}}


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+asyncpg"])
def test_libpq_schemes_use_asyncpg(scheme):
    assert asyncpg_url(f"{scheme}://user:pw@db.example.com/app")[0] == "postgresql+asyncpg://user:pw@db.example.com/app"


def test_other_schemes_are_rejected():
    with pytest.raises(ValueError, match="must be a postgresql:// URL"):
        asyncpg_url("mysql://user:pw@db.example.com/app")


def test_url_without_parameters_is_unchanged():
    assert asyncpg_url(NEON) == (NEON, {})


def test_percent_encoded_password_is_untouched():
    raw = "postgresql+asyncpg://user:p%40ss@db.example.com:5432/app?sslmode=require"
    assert asyncpg_url(raw) == ("postgresql+asyncpg://user:p%40ss@db.example.com:5432/app", {"ssl": "require"})


@pytest.mark.asyncio
async def test_libpq_style_url_connects():
    await ensure_test_database_exists(TEST_DATABASE_URL)
    libpq_url = TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    url, connect_args = asyncpg_url(f"{libpq_url}?sslmode=disable&channel_binding=prefer&application_name=healall-test")
    engine = create_async_engine(url, connect_args=connect_args)
    try:
        async with engine.connect() as conn:
            row = (await conn.execute(text("SELECT current_database(), current_setting('application_name')"))).one()
            assert tuple(row) == ("healall_test", "healall-test")
    finally:
        await engine.dispose()
