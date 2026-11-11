"""DATABASE_URL parsing for asyncpg (app, migrations and the schema drift check)."""

import asyncio
import shutil
import ssl
import subprocess
from urllib.parse import parse_qsl, urlsplit

import certifi
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
    with pytest.raises(ValueError, match="sslmode=verify-full&sslrootcert=system"):
        asyncpg_url(f"{NEON}?sslmode={mode}&sslrootcert=/ca.pem&channel_binding=require")


@pytest.mark.parametrize("binding", ["prefer", "disable"])
def test_optional_channel_binding_is_dropped(binding):
    url, connect_args = asyncpg_url(f"{NEON}?sslmode=require&channel_binding={binding}")
    assert url == NEON
    assert _dsn_params(connect_args) == {"sslmode": "require"}


def _verifies_fully(context: object) -> bool:
    return isinstance(context, ssl.SSLContext) and context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname


def test_neon_with_system_roots_keeps_the_database_name_and_verifies_fully():
    url, connect_args = asyncpg_url(f"{NEON}?sslmode=verify-full&sslrootcert=system")
    assert url == NEON
    context = connect_args.pop("ssl")
    assert _verifies_fully(context)
    assert connect_args == {}  # nothing left for asyncpg's own TLS set-up


def test_system_roots_imply_verify_full_and_refuse_weaker_modes():
    assert _verifies_fully(asyncpg_url(f"{NEON}?sslrootcert=system")[1]["ssl"])
    with pytest.raises(ValueError, match="sslrootcert=system needs sslmode=verify-full"):
        asyncpg_url(f"{NEON}?sslmode=require&sslrootcert=system")


def test_system_roots_fail_closed_without_a_store(monkeypatch):
    monkeypatch.setenv("SSL_CERT_FILE", "/nonexistent/ca.pem")  # neither resolves
    monkeypatch.setenv("SSL_CERT_DIR", "/nonexistent/certs")
    with pytest.raises(ValueError, match="no system CA store"):
        asyncpg_url(f"{NEON}?sslrootcert=system")


@pytest.fixture
def private_ca(tmp_path):
    """A CA in a hashed certificate directory, and a certificate it signed for localhost."""

    def openssl(command: str) -> None:
        subprocess.run(["openssl", *command.split()], cwd=tmp_path, check=True, capture_output=True)

    (tmp_path / "san.ext").write_text("subjectAltName=DNS:localhost\n")
    openssl("req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=Test-CA -keyout ca.key -out ca.pem")
    openssl("req -newkey rsa:2048 -nodes -subj /CN=localhost -keyout server.key -out server.csr")
    openssl(
        "x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days 1 -extfile san.ext -out server.crt"
    )
    (tmp_path / "certs").mkdir()
    shutil.copy(tmp_path / "ca.pem", tmp_path / "certs" / "ca.pem")
    openssl("rehash certs")
    return tmp_path


@pytest.mark.asyncio
@pytest.mark.parametrize("ca_file", ["none", "bundle without the CA"])
async def test_system_roots_trust_the_ca_directory(private_ca, monkeypatch, ca_file):
    # libpq's "system" is OpenSSL's whole default store: its CA file and its hashed directory.
    monkeypatch.setenv("SSL_CERT_FILE", certifi.where() if ca_file != "none" else str(private_ca / "missing.pem"))
    monkeypatch.setenv("SSL_CERT_DIR", str(private_ca / "certs"))
    url, connect_args = asyncpg_url(f"{NEON}?sslrootcert=system&application_name=api")
    assert url == NEON
    assert _dsn_params(connect_args) == {"application_name": "api"}
    client = connect_args["ssl"]

    server_tls = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    server_tls.load_cert_chain(private_ca / "server.crt", private_ca / "server.key")
    server = await asyncio.start_server(lambda _reader, writer: writer.close(), "127.0.0.1", 0, ssl=server_tls)
    port = server.sockets[0].getsockname()[1]
    try:
        _, writer = await asyncio.open_connection("127.0.0.1", port, ssl=client, server_hostname="localhost")
        writer.close()
        with pytest.raises(ssl.SSLCertVerificationError):
            await asyncio.open_connection("127.0.0.1", port, ssl=client, server_hostname="db.example.com")
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.parametrize(
    ("source", "setting"),
    [
        ("url", "sslcert=/c.crt&sslkey=/c.key"),
        ("url", "sslcrl=/root.crl"),
        ("url", "ssl_min_protocol_version=TLSv1.3"),
        ("env", "PGSSLCERT"),
        ("env", "PGSSLCRL"),
        ("file", "postgresql.crt"),
        ("file", "root.crl"),
    ],
)
def test_system_roots_refuse_tls_settings_asyncpg_would_skip(tmp_path, monkeypatch, source, setting):
    # The SSL context replaces asyncpg's TLS set-up, so these would be ignored.
    monkeypatch.setenv("HOME", str(tmp_path))
    query = "sslrootcert=system"
    if source == "url":
        query += f"&{setting}"
    elif source == "env":
        monkeypatch.setenv(setting, "/certs/x")
    else:
        (tmp_path / ".postgresql").mkdir()
        (tmp_path / ".postgresql" / setting).write_text("")
    with pytest.raises(ValueError, match="sslrootcert=system can't be combined with"):
        asyncpg_url(f"{NEON}?{query}")


@pytest.mark.parametrize("tls", ["sslmode=verify-full", "sslrootcert=system", "sslcert=/c.crt"])
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
