"""Unit tests for upload type and size limits and the signed PUT URL."""

from urllib.parse import parse_qs, urlparse

import pytest

from app.core.exceptions import ValidationException
from app.services.upload_limits import UPLOAD_LIMITS, validate_upload
from app.services.upload_service import generate_presigned_put


@pytest.mark.parametrize(
    ("kind", "content_type", "expected"),
    [
        ("profile_photo", "image/jpeg", "upload.jpg"),
        ("profile_photo", "IMAGE/PNG", "upload.png"),
        ("post_attachment", "image/webp", "upload.webp"),
        ("identity_document", "application/pdf", "upload.pdf"),
    ],
)
def test_allowed_types_get_a_safe_name(kind: str, content_type: str, expected: str) -> None:
    assert validate_upload(kind, content_type, 1024) == expected


@pytest.mark.parametrize(
    ("kind", "content_type"),
    [
        ("profile_photo", "text/html"),
        ("profile_photo", "image/svg+xml"),
        ("profile_photo", "application/pdf"),
        ("post_attachment", "video/mp4"),
        ("identity_document", "application/x-msdownload"),
    ],
)
def test_disallowed_types_are_rejected(kind: str, content_type: str) -> None:
    with pytest.raises(ValidationException):
        validate_upload(kind, content_type, 1024)


@pytest.mark.parametrize("kind", sorted(UPLOAD_LIMITS))
def test_size_cap_is_enforced(kind: str) -> None:
    allowed, max_bytes = UPLOAD_LIMITS[kind]
    content_type = next(iter(allowed))
    assert validate_upload(kind, content_type, max_bytes)
    with pytest.raises(ValidationException):
        validate_upload(kind, content_type, max_bytes + 1)
    with pytest.raises(ValidationException):
        validate_upload(kind, content_type, 0)


def test_presigned_put_signs_size_and_type() -> None:
    url = generate_presigned_put("healall-media", "profile-photos/u/x.png", "image/png", 300, content_length=1234)
    query = parse_qs(urlparse(url).query)
    signed = query.get("X-Amz-SignedHeaders", [""])[0].split(";")
    assert "content-length" in signed
    assert "content-type" in signed
