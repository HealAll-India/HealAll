"""Turn a libpq-style DATABASE_URL into what SQLAlchemy's asyncpg driver accepts."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# asyncpg.connect() rejects libpq-only query parameters. sslmode becomes
# asyncpg's ssl= argument; channel_binding (in Neon's default connection
# strings) has no asyncpg equivalent, so it is dropped and TLS still applies.
_LIBPQ_ONLY = {"sslmode", "channel_binding"}


def asyncpg_url(raw_url: str) -> tuple[str, dict[str, str]]:
    """Return the URL without libpq-only parameters, and the matching connect_args.

    The database name and every other parameter are kept as written, and the
    SSL mode (require, verify-ca, verify-full, …) is passed through rather than
    weakened.
    """
    parts = urlsplit(raw_url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    sslmode = next((value for key, value in query if key == "sslmode"), None)
    kept = urlencode([(key, value) for key, value in query if key not in _LIBPQ_ONLY])
    url = urlunsplit((parts.scheme, parts.netloc, parts.path, kept, parts.fragment))
    return url, ({"ssl": sslmode} if sslmode else {})
