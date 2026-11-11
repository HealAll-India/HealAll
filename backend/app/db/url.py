"""Turn a libpq-style DATABASE_URL into what SQLAlchemy's asyncpg driver accepts.

SQLAlchemy hands every query parameter to ``asyncpg.connect()``, which rejects
libpq-only ones (``sslmode``, ``sslrootcert``, ``channel_binding``,
``application_name``). They are translated into asyncpg's ``ssl=`` and
``server_settings=`` arguments here; any other parameter is kept in the URL.
"""

import ssl
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import certifi

_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg"}
_TRANSLATED = {"sslmode", "sslrootcert", "channel_binding", "application_name"}
_VERIFIED = {"verify-ca", "verify-full"}


def _ssl_argument(mode: str | None, rootcert: str | None, binding: str | None) -> str | ssl.SSLContext | None:
    """asyncpg's ``ssl=`` value for libpq's sslmode, sslrootcert and channel_binding."""
    if rootcert == "system":
        # libpq: the system roots imply verify-full, and weaker modes are an error.
        if mode not in (None, "verify-full"):
            raise ValueError("DATABASE_URL: sslrootcert=system needs sslmode=verify-full")
        mode = "verify-full"

    if binding == "require":
        # asyncpg cannot do channel binding (SCRAM-SHA-256-PLUS). It guards
        # against a man in the middle on a TLS link whose certificate is not
        # checked, so the server certificate is checked instead: the
        # connection fails rather than going ahead with neither protection.
        if mode == "disable":
            raise ValueError("DATABASE_URL: channel_binding=require needs TLS, but sslmode=disable turns it off")
        if mode not in _VERIFIED:
            mode, rootcert = "verify-full", rootcert or "system"

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
    not PostgreSQL or asks for something asyncpg cannot honour.
    """
    parts = urlsplit(raw_url)
    if parts.scheme not in _SCHEMES:
        raise ValueError(f"DATABASE_URL must be a postgresql:// URL, not {parts.scheme or 'no scheme'}")

    query = parse_qsl(parts.query, keep_blank_values=True)
    libpq = {key: value for key, value in query if key in _TRANSLATED}
    kept = urlencode([(key, value) for key, value in query if key not in _TRANSLATED])

    connect_args: dict[str, Any] = {}
    ssl_arg = _ssl_argument(libpq.get("sslmode"), libpq.get("sslrootcert"), libpq.get("channel_binding"))
    if ssl_arg is not None:
        connect_args["ssl"] = ssl_arg
    if libpq.get("application_name"):
        connect_args["server_settings"] = {"application_name": libpq["application_name"]}

    url = urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, kept, parts.fragment))
    return url, connect_args
