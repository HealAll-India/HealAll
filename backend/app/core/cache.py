"""Lightweight async Redis cache wrapper used by best-effort public reads.

A Redis outage must NOT take down the public landing page. Every helper
in here degrades to "call the producer directly" on any client error,
and write failures are swallowed. Keys are namespaced by caller and
should be versioned so a schema change can invalidate by bumping the
version without writing a migration.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()
_client: redis.Redis = redis.from_url(
    _settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
    # Sub-second socket timeouts so a degraded Redis cannot stall a public
    # request — the try/except in get_or_set falls back to the producer
    # immediately on TimeoutError instead of waiting on a hung socket.
    socket_connect_timeout=0.5,
    socket_timeout=0.5,
)


async def get_or_set(
    key: str,
    ttl_seconds: int,
    producer: Callable[[], Awaitable[Any]],
) -> Any:
    """Return cached value or compute via ``producer`` and cache it.

    ``producer`` must return JSON-serialisable data (UUIDs and datetimes
    are stringified via ``default=str``). On any Redis error the cache
    is treated as a miss and the producer runs directly — the caller is
    never surfaced a Redis failure.
    """
    try:
        cached = await _client.get(key)
        if cached is not None:
            return json.loads(cached)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cache: GET %s failed (%s); bypassing", key, exc)
        return await producer()

    value = await producer()

    try:
        await _client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cache: SET %s failed (%s); ignoring", key, exc)

    return value
