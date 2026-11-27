"""Allowed content types and size caps for presigned uploads."""

from app.core.exceptions import ValidationException

_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

#: Allowed content types (mapped to the stored file extension) and the
#: maximum size in bytes, per upload kind.
UPLOAD_LIMITS: dict[str, tuple[dict[str, str], int]] = {
    "profile_photo": (_IMAGE_TYPES, 5 * 1024 * 1024),
    "post_attachment": (_IMAGE_TYPES, 10 * 1024 * 1024),
    "identity_document": ({**_IMAGE_TYPES, "application/pdf": "pdf"}, 10 * 1024 * 1024),
}


def validate_upload(kind: str, content_type: str, size_bytes: int) -> str:
    """Check an upload against the limits for ``kind``.

    Returns a safe file name (``upload.<ext>``) derived from the content type,
    so the stored key never takes its extension from the client's file name.
    Raises ValidationException for a disallowed type or size.
    """
    allowed, max_bytes = UPLOAD_LIMITS[kind]
    normalized = content_type.split(";", 1)[0].strip().lower()
    ext = allowed.get(normalized)
    if ext is None:
        raise ValidationException(
            "This file type is not allowed",
            [{"field": "content_type", "message": f"Allowed types: {', '.join(sorted(allowed))}"}],
        )
    if size_bytes <= 0 or size_bytes > max_bytes:
        raise ValidationException(
            "This file is too large",
            [{"field": "size_bytes", "message": f"Maximum size is {max_bytes // (1024 * 1024)} MB"}],
        )
    return f"upload.{ext}"
