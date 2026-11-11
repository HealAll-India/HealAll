"""Turn a libpq-style DATABASE_URL into what SQLAlchemy's asyncpg driver accepts.

SQLAlchemy passes each URL query parameter to ``asyncpg.connect()`` as a
keyword, and asyncpg rejects libpq's (``sslmode``, ``sslrootcert``,
``application_name``, …). Those are handed to asyncpg as a ``dsn`` instead,
which it reads the way libpq does: SSL modes, root and client certificates,
revocation lists and the PGSSL* variables, with any other parameter sent as a
server setting. Parameters that are asyncpg or SQLAlchemy keywords stay in the
URL.
"""

import inspect
import ssl
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


_CLIENT_TLS = {"sslcert", "sslkey", "sslpassword", "sslcrl"}


def _use_system_roots(libpq: dict[str, str]) -> dict[str, Any]:
    """Point libpq["sslrootcert"] at OpenSSL's default trust store.

    A CA bundle file (SSL_CERT_FILE when set) is handed to asyncpg as the root
    certificate. A store that is only a hashed CA directory (SSL_CERT_DIR)
    can't be, as asyncpg takes a file, so it is returned as an SSL context
    verifying the chain and hostname, the extra connect_args.
    """
    paths = ssl.get_default_verify_paths()
    if paths.cafile:
        libpq["sslrootcert"] = paths.cafile
        return {}
    if paths.capath:
        # asyncpg loads client certificates and CRLs only for contexts it
        # builds itself; refuse rather than drop them.
        if _CLIENT_TLS & libpq.keys():
            raise ValueError(
                "DATABASE_URL: the system trust store is a CA directory, which can't be combined with "
                "sslcert, sslkey, sslpassword or sslcrl. Give sslrootcert a CA file instead."
            )
        del libpq["sslrootcert"], libpq["sslmode"]
        return {"ssl": ssl.create_default_context()}
    raise ValueError(
        "DATABASE_URL: sslrootcert=system, but no system CA bundle was found. "
        "Install ca-certificates or set SSL_CERT_FILE."
    )


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

    # asyncpg has no SCRAM-SHA-256-PLUS, and a verified certificate is no
    # substitute (one mis-issued for the host passes it), so a URL that
    # requires channel binding is refused rather than quietly downgraded.
    # "prefer" and "disable" accept a login without it; left in, asyncpg would
    # send it as a server setting, which PostgreSQL rejects.
    if libpq.pop("channel_binding", None) == "require":
        raise ValueError(REQUIRED_BINDING_MESSAGE)

    # libpq reads "system" as the default trust store and verify-full;
    # asyncpg has no such value.
    connect_args: dict[str, Any] = {}
    if libpq.get("sslrootcert") == "system":
        if libpq.setdefault("sslmode", "verify-full") != "verify-full":
            raise ValueError("DATABASE_URL: sslrootcert=system needs sslmode=verify-full")
        connect_args = _use_system_roots(libpq)

    if libpq:
        connect_args["dsn"] = f"postgresql://?{urlencode(libpq)}"
    url = urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return url, connect_args
