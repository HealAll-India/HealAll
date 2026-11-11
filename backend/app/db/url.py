"""Turn a libpq-style DATABASE_URL into what SQLAlchemy's asyncpg driver accepts.

SQLAlchemy passes each URL query parameter to ``asyncpg.connect()`` as a
keyword, and asyncpg rejects libpq's (``sslmode``, ``sslrootcert``,
``application_name``, …). Those are handed to asyncpg as a ``dsn`` instead,
which it reads the way libpq does: SSL modes, root and client certificates,
revocation lists and the PGSSL* variables, with any other parameter sent as a
server setting. Parameters that are asyncpg or SQLAlchemy keywords stay in the
URL. ``sslrootcert=system``, which asyncpg lacks, becomes an SSL context.
"""

import inspect
import os
import ssl
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg"}
# Taken from the URL as keywords by asyncpg.connect() or SQLAlchemy's dialect.
_KEYWORDS = set(inspect.signature(asyncpg.connect).parameters) | {
    "prepared_statement_cache_size",
    "prepared_statement_name_func",
}

REQUIRED_BINDING_MESSAGE = (
    "DATABASE_URL: asyncpg cannot do channel binding, so channel_binding=require can't be honoured. "
    "Replace it with sslmode=verify-full&sslrootcert=system, which checks the server certificate "
    "and hostname instead (for Neon: ?sslmode=verify-full&sslrootcert=system)."
)


# What asyncpg reads only when it builds the SSL context itself.
_NATIVE_TLS_PARAMS = {"sslcert", "sslkey", "sslpassword", "sslcrl", "sslnegotiation"} | {
    "ssl_min_protocol_version",
    "ssl_max_protocol_version",
}
_TLS_PARAMS = {"sslmode", "sslrootcert"} | _NATIVE_TLS_PARAMS
_NATIVE_TLS_ENV = ("PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLMINPROTOCOLVERSION", "PGSSLMAXPROTOCOLVERSION")
_NATIVE_TLS_FILES = ("postgresql.crt", "postgresql.key", "root.crl")


def _system_trust_store(libpq: dict[str, str]) -> ssl.SSLContext:
    """An SSL context for libpq's sslrootcert=system, checking the chain and hostname.

    asyncpg has no "system" and takes a root certificate only as a file, so
    the context is built here from OpenSSL's default store: its CA file and
    hashed directory (SSL_CERT_FILE, SSL_CERT_DIR). asyncpg then skips its
    own TLS set-up, so a client certificate, key, CRL or protocol bound
    configured anywhere would be ignored; that is refused instead.
    """
    configured = sorted(_NATIVE_TLS_PARAMS & libpq.keys())
    configured += [name for name in _NATIVE_TLS_ENV if os.environ.get(name)]
    try:
        dot_postgresql = Path.home() / ".postgresql"
    except (RuntimeError, KeyError):  # no home directory, as asyncpg handles it
        dot_postgresql = None
    if dot_postgresql:
        configured += [f"~/.postgresql/{name}" for name in _NATIVE_TLS_FILES if (dot_postgresql / name).exists()]
    if configured:
        raise ValueError(
            f"DATABASE_URL: sslrootcert=system can't be combined with {', '.join(configured)}. "
            "Give sslrootcert a CA file instead (e.g. /etc/ssl/certs/ca-certificates.crt)."
        )

    paths = ssl.get_default_verify_paths()
    if not (paths.cafile or paths.capath):
        raise ValueError(
            "DATABASE_URL: sslrootcert=system, but no system CA store was found. "
            "Install ca-certificates or set SSL_CERT_FILE."
        )
    return ssl.create_default_context()


def asyncpg_url(raw_url: str) -> tuple[str, dict[str, Any]]:
    """Return the asyncpg URL for a libpq-style one, and the matching connect_args.

    ``postgres://`` and ``postgresql://`` become ``postgresql+asyncpg://``. The
    database name and credentials are kept as written. Raises ValueError for a
    URL that is not PostgreSQL or asks for something asyncpg cannot honour
    (such as ``channel_binding=require``).
    """
    parts = urlsplit(raw_url)
    if parts.scheme not in _SCHEMES:
        raise ValueError(f"DATABASE_URL must be a postgresql:// URL, not {parts.scheme or 'no scheme'}")

    query = parse_qsl(parts.query, keep_blank_values=True)
    kept = [(key, value) for key, value in query if key in _KEYWORDS]
    # An empty value means "use the default" in libpq; asyncpg's parser rejects it.
    libpq = {key: value for key, value in query if key not in _KEYWORDS and value}

    # asyncpg's ssl= keyword overrides every TLS setting in the DSN, so with
    # both, "?sslmode=verify-full&ssl=disable" would turn TLS off.
    if any(key == "ssl" for key, _ in kept) and _TLS_PARAMS & libpq.keys():
        raise ValueError("DATABASE_URL: give TLS settings as sslmode/sslrootcert, not together with ssl=")

    # asyncpg has no SCRAM-SHA-256-PLUS, and a verified certificate is no
    # substitute (one mis-issued for the host passes it), so a URL that
    # requires channel binding is refused rather than quietly downgraded.
    # "prefer" and "disable" accept a login without it; left in, asyncpg would
    # send it as a server setting, which PostgreSQL rejects.
    if libpq.pop("channel_binding", None) == "require":
        raise ValueError(REQUIRED_BINDING_MESSAGE)

    # libpq reads "system" as OpenSSL's default trust store and verify-full.
    connect_args: dict[str, Any] = {}
    if libpq.get("sslrootcert") == "system":
        if libpq.pop("sslmode", "verify-full") != "verify-full":
            raise ValueError("DATABASE_URL: sslrootcert=system needs sslmode=verify-full")
        connect_args["ssl"] = _system_trust_store(libpq)
        del libpq["sslrootcert"]

    if libpq:
        connect_args["dsn"] = f"postgresql://?{urlencode(libpq)}"
    url = urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return url, connect_args
