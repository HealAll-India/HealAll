"""Refuse requests that did not come through Cloudflare.

When ORIGIN_VERIFY_SECRET is set, every request must carry the header
X-Origin-Verify with that value. Cloudflare adds it (a Transform Rule on the
api hostname), so a client that finds the origin and calls API Gateway
directly, skipping Cloudflare's WAF and rate limiting, gets 403. Unset, the
guard does nothing.
"""

import hmac
import json

from starlette.types import ASGIApp, Receive, Scope, Send

HEADER = b"x-origin-verify"

_BODY = json.dumps({"error": {"code": "FORBIDDEN", "message": "Forbidden"}}).encode()


class OriginGuardMiddleware:
    def __init__(self, app: ASGIApp, secret: str) -> None:
        self.app = app
        self.secret = secret.encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        sent = b""
        for name, value in scope.get("headers", []):
            if name.lower() == HEADER:
                sent = value
                break
        if hmac.compare_digest(sent, self.secret):
            await self.app(scope, receive, send)
            return
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(_BODY)).encode())],
            }
        )
        await send({"type": "http.response.body", "body": _BODY})
