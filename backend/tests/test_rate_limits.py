"""Per-route rate limits run, are keyed on the visitor, and answer in the API's envelope."""

import ast
from pathlib import Path

import pytest
from httpx import AsyncClient
from starlette.requests import Request

from app.core.limiter import client_ip

ROUTES_DIR = Path(__file__).resolve().parents[1] / "app" / "api" / "v1"


def _decorator_name(node: ast.expr) -> str:
    return ast.unparse(node.func if isinstance(node, ast.Call) else node)


def test_limits_sit_below_the_route_decorator():
    """With @limiter.limit outermost, FastAPI registers the unlimited function."""
    misplaced = []
    for path in sorted(ROUTES_DIR.glob("*.py")):
        for fn in ast.walk(ast.parse(path.read_text())):
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            names = [_decorator_name(d) for d in fn.decorator_list]
            if "limiter.limit" not in names:
                continue
            route = next((i for i, name in enumerate(names) if name.startswith("router.")), None)
            if route is None or route > names.index("limiter.limit"):
                misplaced.append(f"{path.name}:{fn.lineno} {fn.name}")
    assert misplaced == []


@pytest.mark.asyncio
async def test_sign_in_is_limited_per_visitor(client: AsyncClient):
    body = {"phone_or_email": "nobody@example.com", "otp_code": "123456"}
    visitor = {"cf-connecting-ip": "203.0.113.7"}
    for _ in range(10):
        response = await client.post("/v1/auth/token", json=body, headers=visitor)
        assert response.status_code != 429
    blocked = await client.post("/v1/auth/token", json=body, headers=visitor)
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    other = await client.post("/v1/auth/token", json=body, headers={"cf-connecting-ip": "198.51.100.9"})
    assert other.status_code != 429


def _request(headers: dict[str, str], peer: str = "10.0.0.1") -> Request:
    raw = [(key.encode(), value.encode()) for key, value in headers.items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 1234)})


def test_client_ip_uses_the_visitor_address_from_the_proxies():
    assert client_ip(_request({"cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1"})) == "203.0.113.7"
    assert client_ip(_request({"x-real-ip": "203.0.113.8"})) == "203.0.113.8"
    assert client_ip(_request({"x-forwarded-for": "203.0.113.9, 10.0.0.2"})) == "203.0.113.9"
    assert client_ip(_request({})) == "10.0.0.1"
