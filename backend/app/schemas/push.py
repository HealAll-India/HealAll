"""Web push schemas."""

import re
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator

from app.models.push import AUTH_MAX_LENGTH, ENDPOINT_MAX_LENGTH, P256DH_MAX_LENGTH

# The browsers' push services. The API posts to a subscription's endpoint, so
# any other host would let a member point the server at an address of their
# choosing. Chrome, Edge (Chromium), Samsung Internet, Opera and the Android
# app (a Trusted Web Activity in Chrome) use FCM; Firefox uses Mozilla's
# service; Safari uses Apple's; legacy Edge used WNS.
PUSH_SERVICE_HOST_SUFFIXES = (
    "fcm.googleapis.com",
    "android.googleapis.com",
    "push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
)

_BASE64URL = re.compile(r"^[A-Za-z0-9_-]+={0,2}$")


def _is_push_service_host(host: str) -> bool:
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in PUSH_SERVICE_HOST_SUFFIXES)


class PushPublicKeyResponse(BaseModel):
    """Whether push is on, and the VAPID public key browsers subscribe with."""

    enabled: bool
    public_key: str | None = None


class PushSubscriptionKeys(BaseModel):
    """The keys a browser gives for encrypting payloads (PushSubscription.toJSON().keys)."""

    p256dh: str = Field(min_length=1, max_length=P256DH_MAX_LENGTH)
    auth: str = Field(min_length=1, max_length=AUTH_MAX_LENGTH)

    @field_validator("p256dh", "auth")
    @classmethod
    def validate_base64url(cls, value: str) -> str:
        if not _BASE64URL.fullmatch(value):
            raise ValueError("must be base64url")
        return value


class PushEndpoint(BaseModel):
    """A push endpoint: https, on a known browser push service."""

    endpoint: str = Field(min_length=1, max_length=ENDPOINT_MAX_LENGTH)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        try:
            parts = urlsplit(value)
            host = (parts.hostname or "").lower()
            port = parts.port
        except ValueError:
            raise ValueError("must be a valid URL") from None
        if parts.scheme != "https" or not host or parts.username or parts.password:
            raise ValueError("must be an https URL")
        if port not in (None, 443) or not _is_push_service_host(host):
            raise ValueError("must be a browser push service URL")
        return value


class PushSubscribeRequest(PushEndpoint):
    """Save this device's push subscription for the signed-in member."""

    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    """Remove this device's push subscription. Not host-checked, so a row
    saved before a host left the allowlist can still be removed."""

    endpoint: str = Field(min_length=1, max_length=ENDPOINT_MAX_LENGTH)
