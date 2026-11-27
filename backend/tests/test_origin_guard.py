"""X-Origin-Verify: only requests that came through Cloudflare get in."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.origin_guard import OriginGuardMiddleware


def _app() -> FastAPI:
    app = FastAPI()

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    app.add_middleware(OriginGuardMiddleware, secret="s3cret-value")
    return app


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("headers", "status"),
    [
        ({"X-Origin-Verify": "s3cret-value"}, 200),
        ({}, 403),
        ({"X-Origin-Verify": "wrong"}, 403),
        ({"X-Origin-Verify": ""}, 403),
    ],
)
async def test_guard(headers, status):
    async with AsyncClient(transport=ASGITransport(app=_app()), base_url="http://test") as client:
        resp = await client.get("/health", headers=headers)
    assert resp.status_code == status
    if status == 403:
        assert resp.json()["error"]["code"] == "FORBIDDEN"


def test_off_by_default():
    from app.core.config import get_settings
    from app.main import app

    assert get_settings().ORIGIN_VERIFY_SECRET is None
    assert not any(m.cls is OriginGuardMiddleware for m in app.user_middleware)
