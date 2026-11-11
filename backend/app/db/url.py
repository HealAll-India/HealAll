"""Turn a libpq-style DATABASE_URL into what SQLAlchemy's asyncpg driver accepts.

SQLAlchemy hands every query parameter to ``asyncpg.connect()``, which rejects
libpq-only ones (``sslmode``, ``sslrootcert``, ``channel_binding``,
``application_name``). They are translated into asyncpg's ``ssl=`` and
``server_settings=`` arguments here, except ``channel_binding=require``, which
asyncpg cannot honour and is refused. Any other parameter is kept in the URL.
"""

import ssl
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import certifi

_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg"}
_TRANSLATED = {"sslmode", "sslrootcert", "channel_binding", "application_name"}
_VERIFIED = {"verify-ca", "verify-full"}


REQUIRED_BINDING_MESSAGE = (
    "DATABASE_URL: asyncpg cannot do channel binding, so channel_binding=require can't be honoured. "
    "Replace it with sslmode=verify-full&sslrootcert=system, which checks the server certificate "
    "and hostname instead (for Neon: ?sslmode=verify-full&sslrootcert=system)."
)


def _ssl_argument(mode: str | None, rootcert: str | None) -> str | ssl.SSLContext | None:
    """asyncpg's ``ssl=`` value for libpq's sslmode and sslrootcert."""
    if rootcert == "system":
        # libpq: the system roots imply verify-full, and weaker modes are an error.
        if mode not in (None, "verify-full"):
            raise ValueError("DATABASE_URL: sslrootcert=system needs sslmode=verify-full")
        mode = "verify-full"

    # libpq ignores the root certificate below require, and require with one
    # behaves like verify-ca.
    if rootcert and mode in {"require", *_VERIFIED}:
        context = ssl.create_default_context(cafile=certifi.where() if rootcert == "system" else rootcert)
        context.check_hostname = mode == "verify-full"
        return context
    return mode


def asyncpg_url(raw_url: str) -> tuple[str, dict[str, Any]]:
    """Return the asyncpg URL for a libpq-style one, and the matching connect_args.

    ``postgres://`` and ``postgresql://`` become ``postgresql+asyncpg://``. The
    database name and the remaining parameters are kept as written, and the SSL
    mode is passed through, never weakened. Raises ValueError for a URL that is
    not PostgreSQL or asks for something asyncpg cannot honour (such as
    ``channel_binding=require``).
    """
    parts = urlsplit(raw_url)
    if parts.scheme not in _SCHEMES:
        raise ValueError(f"DATABASE_URL must be a postgresql:// URL, not {parts.scheme or 'no scheme'}")

    query = parse_qsl(parts.query, keep_blank_values=True)
    libpq = {key: value for key, value in query if key in _TRANSLATED}
    kept = urlencode([(key, value) for key, value in query if key not in _TRANSLATED])

    # asyncpg has no SCRAM-SHA-256-PLUS. A verified certificate is not a
    # substitute (a mis-issued one for the host passes it), so a URL that
    # requires channel binding is refused rather than quietly downgraded.
    # "prefer" and "disable" accept a login without it, so they are dropped.
    if libpq.get("channel_binding") == "require":
        raise ValueError(REQUIRED_BINDING_MESSAGE)

    connect_args: dict[str, Any] = {}
    ssl_arg = _ssl_argument(libpq.get("sslmode"), libpq.get("sslrootcert"))
    if ssl_arg is not None:
        connect_args["ssl"] = ssl_arg
    if libpq.get("application_name"):
        connect_args["server_settings"] = {"application_name": libpq["application_name"]}

    url = urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, kept, parts.fragment))
    return url, connect_args
