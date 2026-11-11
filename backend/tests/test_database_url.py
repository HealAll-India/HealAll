"""DATABASE_URL parsing for asyncpg (app, migrations and the schema drift check)."""

from urllib.parse import parse_qsl, urlsplit

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.url import asyncpg_url
from tests.conftest import TEST_DATABASE_URL, ensure_test_database_exists

NEON = "postgresql+asyncpg://user:pw@ep-x.ap-southeast-1.aws.neon.tech/neondb"


def _dsn_params(connect_args: dict[str, str]) -> dict[str, str]:
    """The libpq parameters handed to asyncpg as its dsn."""
    dsn = urlsplit(connect_args["dsn"])
    assert (dsn.scheme, dsn.netloc, dsn.path) == ("postgresql", "", "")
    return dict(parse_qsl(dsn.query))


@pytest.mark.parametrize("mode", ["disable", "require", "verify-ca", "verify-full"])
def test_required_channel_binding_is_refused_whatever_the_ssl_mode(mode):
    # asyncpg can't do channel binding, and a certificate check is no substitute.
    with pytest.raises(ValueError, match="sslmode=verify-full&sslrootcert=<CA bundle file>"):
        asyncpg_url(f"{NEON}?sslmode={mode}&sslrootcert=/ca.pem&channel_binding=require")


@pytest.mark.parametrize("binding", ["prefer", "disable"])
def test_optional_channel_binding_is_dropped(binding):
    url, connect_args = asyncpg_url(f"{NEON}?sslmode=require&channel_binding={binding}")
    assert url == NEON
    assert _dsn_params(connect_args) == {"sslmode": "require"}


def test_neon_with_verified_tls_reaches_asyncpg_unchanged():
    ca = "/etc/ssl/certs/ca-certificates.crt"
    url, connect_args = asyncpg_url(f"{NEON}?sslmode=verify-full&sslrootcert={ca}")
    assert url == NEON
    assert _dsn_params(connect_args) == {"sslmode": "verify-full", "sslrootcert": ca}


def test_system_roots_are_refused_with_the_bundle_to_use(tmp_path, monkeypatch):
    # asyncpg has no "system"; emulating it would bypass its own TLS set-up.
    bundle = tmp_path / "ca-certificates.crt"
    bundle.write_text("")
    monkeypatch.setenv("SSL_CERT_FILE", str(bundle))
    with pytest.raises(ValueError, match=f"has no sslrootcert=system.*sslrootcert={bundle}"):
        asyncpg_url(f"{NEON}?sslmode=verify-full&sslrootcert=system")


def test_service_file_reaches_asyncpg():
    # service= is an asyncpg keyword: it reads the service file, TLS settings included, itself.
    url, connect_args = asyncpg_url(f"{NEON}?service=healall&application_name=api")
    assert url == f"{NEON}?service=healall"
    assert _dsn_params(connect_args) == {"application_name": "api"}


@pytest.mark.parametrize("tls", ["sslmode=verify-full", "sslrootcert=/ca.pem", "sslcert=/c.crt"])
def test_asyncpg_ssl_keyword_cannot_override_libpq_tls(tls):
    # asyncpg's ssl= wins over the DSN, so "ssl=disable" would switch TLS off.
    with pytest.raises(ValueError, match="not together with ssl="):
        asyncpg_url(f"{NEON}?{tls}&ssl=disable")


def test_asyncpg_ssl_keyword_alone_stays_in_the_url():
    assert asyncpg_url(f"{NEON}?ssl=require") == (f"{NEON}?ssl=require", {})


def test_tls_files_reach_asyncpg_unchanged():
    # asyncpg loads root and client certificates, keys and CRLs itself, as libpq does.
    tls = {
        "sslmode": "verify-ca",
        "sslrootcert": "/certs/ca.pem",
        "sslcert": "/certs/client.crt",
        "sslkey": "/certs/client.key",
        "sslcrl": "/certs/root.crl",
    }
    url, connect_args = asyncpg_url(f"{NEON}?" + "&".join(f"{k}={v}" for k, v in tls.items()))
    assert url == NEON
    assert _dsn_params(connect_args) == tls


def test_application_name_goes_to_asyncpg_and_driver_keywords_stay_in_the_url():
    url, connect_args = asyncpg_url(f"{NEON}?application_name=api&prepared_statement_cache_size=0&command_timeout=30")
    assert url == f"{NEON}?prepared_statement_cache_size=0&command_timeout=30"
    assert _dsn_params(connect_args) == {"application_name": "api"}


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+asyncpg"])
def test_libpq_schemes_use_asyncpg(scheme):
    assert asyncpg_url(f"{scheme}://user:pw@db.example.com/app")[0] == "postgresql+asyncpg://user:pw@db.example.com/app"


def test_other_schemes_are_rejected():
    with pytest.raises(ValueError, match="must be a postgresql:// URL"):
        asyncpg_url("mysql://user:pw@db.example.com/app")


def test_url_without_parameters_is_unchanged():
    assert asyncpg_url(NEON) == (NEON, {})


def test_percent_encoded_password_is_untouched():
    url, connect_args = asyncpg_url("postgresql+asyncpg://user:p%40ss@db.example.com:5432/app?sslmode=require")
    assert url == "postgresql+asyncpg://user:p%40ss@db.example.com:5432/app"
    assert _dsn_params(connect_args) == {"sslmode": "require"}


@pytest.mark.asyncio
async def test_libpq_style_url_connects():
    await ensure_test_database_exists(TEST_DATABASE_URL)
    libpq_url = TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    query = "sslmode=disable&channel_binding=prefer&application_name=healall-test&prepared_statement_cache_size=0"
    url, connect_args = asyncpg_url(f"{libpq_url}?{query}")
    engine = create_async_engine(url, connect_args=connect_args)
    try:
        async with engine.connect() as conn:
            row = (await conn.execute(text("SELECT current_database(), current_setting('application_name')"))).one()
            assert tuple(row) == ("healall_test", "healall-test")
    finally:
        await engine.dispose()
