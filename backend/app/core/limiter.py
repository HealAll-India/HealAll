"""HTTP rate limiter instance shared across the application.

Route limits only apply when ``@router.<method>(...)`` is the OUTER decorator
and ``@limiter.limit(...)`` sits directly above the function. The reverse
order registers the undecorated function with FastAPI, so the limit silently
never runs (tests/test_rate_limits.py guards this).
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# Set by the proxies in front of the API, most specific first: Cloudflare's
# visitor IP, then the client IP from the hosting edge.
_CLIENT_IP_HEADERS = ("cf-connecting-ip", "x-real-ip", "x-forwarded-for")


def client_ip(request: Request) -> str:
    """Rate-limit key: the visitor's IP, not the proxy's.

    Uvicorn sees the proxy's address, so ``get_remote_address`` alone would
    put every visitor in one shared bucket. A caller who reaches the origin
    directly can forge these headers to pick a fresh bucket, which is no
    weaker than having no limit; serving the API only through the proxy
    closes that.
    """
    for header in _CLIENT_IP_HEADERS:
        value = request.headers.get(header, "")
        first = value.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip, default_limits=["200/minute"])
