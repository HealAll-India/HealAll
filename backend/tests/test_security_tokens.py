"""Access tokens: issued tokens verify, and anything else is refused."""

from datetime import timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token


def test_issued_token_round_trips():
    token = create_access_token("user-1", ["seeker"], 1, session_id="s1")
    payload = decode_access_token(token)
    assert payload["sub"] == "user-1"
    assert payload["roles"] == ["seeker"]
    assert payload["sid"] == "s1"


def test_tampered_token_is_refused():
    token = create_access_token("user-1", ["seeker"], 1)
    head, body, sig = token.split(".")
    with pytest.raises(ValueError):
        decode_access_token(f"{head}.{body}.{sig[:-2]}AA")


def test_unsigned_token_is_refused():
    forged = jwt.encode({"sub": "admin", "roles": ["admin"]}, key=None, algorithm="none")
    with pytest.raises(ValueError):
        decode_access_token(forged)


def test_token_signed_with_another_key_is_refused():
    forged = jwt.encode({"sub": "admin", "roles": ["admin"]}, "not-the-real-key-0000000000000000", algorithm="HS256")
    with pytest.raises(ValueError):
        decode_access_token(forged)


def test_expired_token_is_refused():
    token = create_access_token("user-1", ["seeker"], 1, expires_delta=timedelta(seconds=-5))
    with pytest.raises(ValueError):
        decode_access_token(token)


def test_algorithm_is_pinned():
    assert get_settings().JWT_ALGORITHM == "HS256"
