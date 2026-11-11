"""Turn a libpq-style DATABASE_URL into what SQLAlchemy's asyncpg driver accepts.

SQLAlchemy passes each URL query parameter to ``asyncpg.connect()`` as a
keyword, and asyncpg rejects libpq's (``sslmode``, ``sslrootcert``,
``application_name``, …). Those are handed to asyncpg as a ``dsn`` instead,
which it reads the way libpq does: SSL modes, root and client certificates,
revocation lists and the PGSSL* variables, with any other parameter sent as a
server setting. Parameters that are asyncpg or SQLAlchemy keywords stay in the
URL. What asyncpg can't honour is refused, never emulated:
``channel_binding=require``, ``sslrootcert=system``, service files and a nested ``dsn``.
"""

import inspect
import ssl
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg"}
# Taken from the URL as keywords by asyncpg.connect() or SQLAlchemy's dialect.
# dsn= would let the URL carry a second, unchecked connection string.
_REFUSED = {"dsn", "service", "servicefile"}
_KEYWORDS = (set(inspect.signature(asyncpg.connect).parameters) - _REFUSED) | {
    "prepared_statement_cache_size",
    "prepared_statement_name_func",
}
_TLS_PARAMS = {
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslpassword",
    "sslcrl",
    "sslnegotiation",
    "ssl_min_protocol_version",
    "ssl_max_protocol_version",
}

VERIFIED_TLS_HINT = "sslmode=verify-full&sslrootcert=<CA bundle file>, e.g. /etc/ssl/certs/ca-certificates.crt"

REQUIRED_BINDING_MESSAGE = (
    "DATABASE_URL: asyncpg cannot do channel binding, so channel_binding=require can't be honoured. "
    f"Replace it with {VERIFIED_TLS_HINT}, which checks the server certificate and hostname instead."
)


def _system_roots_message() -> str:
    """Why sslrootcert=system is refused, naming this machine's default CA bundle."""
    cafile = ssl.get_default_verify_paths().cafile
    here = f"; this machine's default is sslrootcert={cafile}" if cafile else ""
    return (
        "DATABASE_URL: asyncpg has no sslrootcert=system, and loading the system store outside asyncpg "
        f"would skip its client-certificate and CRL handling. Give the CA bundle file instead{here}."
    )


def asyncpg_url(raw_url: str) -> tuple[str, dict[str, str]]:
    """Return the asyncpg URL for a libpq-style one, and the matching connect_args.

    ``postgres://`` and ``postgresql://`` become ``postgresql+asyncpg://``. The
    database name and credentials are kept as written. Raises ValueError for a
    URL that is not PostgreSQL or asks for something asyncpg cannot honour.
    """
    parts = urlsplit(raw_url)
    if parts.scheme not in _SCHEMES:
        raise ValueError(f"DATABASE_URL must be a postgresql:// URL, not {parts.scheme or 'no scheme'}")

    query = parse_qsl(parts.query, keep_blank_values=True)
    # asyncpg reads a service file only while parsing a DSN, and not at all
    # before 0.31, so its settings (TLS included) could silently not apply; a
    # nested dsn= would bypass every check here.
    if refused := sorted(_REFUSED & {key for key, _ in query}):
        raise ValueError(
            f"DATABASE_URL: {', '.join(refused)} isn't supported; put the connection settings in the URL itself"
        )
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

    # asyncpg would read "system" as a file name and fail to connect.
    if libpq.get("sslrootcert") == "system":
        raise ValueError(_system_roots_message())

    url = urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return url, ({"dsn": f"postgresql://?{urlencode(libpq)}"} if libpq else {})
