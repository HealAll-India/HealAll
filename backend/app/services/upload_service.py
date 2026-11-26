"""Upload service — generates presigned PUT URLs for MinIO/S3."""

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlparse

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.core.exceptions import HealAllException

settings = get_settings()
logger = logging.getLogger(__name__)


class UploadException(HealAllException):
    """Raised when presigned URL generation fails."""

    def __init__(self, message: str):
        super().__init__("UPLOAD_ERROR", message)


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def generate_presigned_put(
    bucket: str,
    object_key: str,
    content_type: str,
    expires_in: int = 300,
) -> str:
    """Return a presigned PUT URL for direct client upload."""
    client = _s3_client()
    try:
        url: str = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as exc:
        raise UploadException(f"Failed to generate upload URL: {exc}") from exc


def public_object_url(bucket: str, object_key: str) -> str:
    """Return the public read URL for an object, given the configured endpoint.

    Works for both AWS S3 virtual-hosted style and MinIO path-style endpoints.
    Only meaningful for buckets that allow s3:GetObject from `Principal: *` —
    the identity bucket is private, so callers shouldn't use this for it.
    """
    endpoint = settings.S3_ENDPOINT_URL.rstrip("/")
    # Compare against the parsed hostname so we don't get fooled by an
    # attacker-controlled value like "http://amazonaws.com.evil.tld/..." that
    # happens to contain the substring "amazonaws.com".
    host = (urlparse(endpoint).hostname or "").lower()
    # Percent-encode the key so spaces / unicode / odd characters in
    # filename-derived extensions don't break the resulting URL. safe='/'
    # preserves path separators.
    encoded_key = quote(object_key, safe="/")
    if host == "amazonaws.com" or host.endswith(".amazonaws.com"):
        if not settings.S3_REGION:
            # Without a region we'd emit https://bucket.s3..amazonaws.com/...
            # and silently persist a broken avatar_url. Fail loudly instead.
            raise UploadException("S3_REGION must be configured for AWS endpoints")
        # Virtual-hosted style is the AWS recommendation for new buckets.
        return f"https://{bucket}.s3.{settings.S3_REGION}.amazonaws.com/{encoded_key}"
    return f"{endpoint}/{bucket}/{encoded_key}"


def profile_photo_key(user_id: str, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    return f"profile-photos/{user_id}/{uuid.uuid4()}.{ext}"


def post_attachment_key(post_id: str, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    return f"post-attachments/{post_id}/{uuid.uuid4()}.{ext}"


def identity_document_key(user_id: str, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    return f"identity/{user_id}/{uuid.uuid4()}.{ext}"


def _delete_prefix(bucket: str, prefix: str) -> int:
    """Delete every object under ``prefix`` in ``bucket``; returns how many.

    ``delete_objects`` reports per-key failures in ``Errors`` instead of
    raising, so a partial failure is turned into an exception here.
    """
    client = _s3_client()
    deleted = 0
    failed = 0
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if keys:
            resp = client.delete_objects(Bucket=bucket, Delete={"Objects": keys, "Quiet": True})
            errors = resp.get("Errors", [])
            failed += len(errors)
            deleted += len(keys) - len(errors)
    if failed:
        raise RuntimeError(f"{failed} of {deleted + failed} objects could not be deleted")
    return deleted


async def delete_member_files(user_id: str, post_ids: list[str]) -> None:
    """Best-effort removal of a deleted member's uploads.

    Covers their profile photos, identity documents and the attachments on
    their own posts (see the ``*_key`` helpers above for the layout). A
    failure is logged, never raised: the account itself is already gone.

    Anything this pass misses, including a file uploaded through a presigned
    URL issued just before the deletion, is left with no owner row and is
    removed by ``purge_orphaned_files`` (``scripts/purge_orphaned_files.py``).
    """
    targets = [
        (settings.S3_BUCKET_MEDIA, f"profile-photos/{user_id}/"),
        (settings.S3_BUCKET_IDENTITY, f"identity/{user_id}/"),
        *((settings.S3_BUCKET_MEDIA, f"post-attachments/{post_id}/") for post_id in post_ids),
    ]
    for bucket, prefix in targets:
        try:
            await asyncio.to_thread(_delete_prefix, bucket, prefix)
        except Exception:
            logger.exception("delete_member_files: could not clear %s/%s", bucket, prefix)


# Upload folders keyed by the id of the row that owns them.
_OWNED_FOLDERS = (
    ("media", "profile-photos/", "user"),
    ("identity", "identity/", "user"),
    ("media", "post-attachments/", "post"),
)


def _owner_ids_in(bucket: str, folder: str) -> list[str]:
    """The owner ids that have a sub-folder under ``folder`` in ``bucket``."""
    client = _s3_client()
    ids = []
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=folder, Delimiter="/"):
        for common in page.get("CommonPrefixes", []):
            ids.append(common["Prefix"][len(folder) :].rstrip("/"))
    return ids


def _newest_upload(bucket: str, prefix: str) -> datetime | None:
    """When the newest object under ``prefix`` was written, or None if empty."""
    newest = None
    for page in _s3_client().get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if newest is None or obj["LastModified"] > newest:
                newest = obj["LastModified"]
    return newest


async def purge_orphaned_files(
    existing_ids: Callable[[str, list[str]], Awaitable[set[str]]],
    *,
    apply: bool,
    min_age: timedelta = timedelta(hours=1),
) -> tuple[list[str], list[str]]:
    """Find, and with ``apply`` delete, upload folders whose owner row is gone.

    Storage is listed first and ``existing_ids(owner, ids)`` is asked
    afterwards which of those ``"user"`` or ``"post"`` ids still exist, so an
    owner created while the sweep runs is never mistaken for a missing one.
    Folders written to within ``min_age`` are skipped as well, to leave room
    for an upload or a transaction that is still in flight.

    Returns ``(orphans, failed)`` as ``bucket/prefix`` strings: every orphaned
    folder found, and those that could not be fully deleted.
    """
    buckets = {"media": settings.S3_BUCKET_MEDIA, "identity": settings.S3_BUCKET_IDENTITY}
    cutoff = datetime.now(UTC) - min_age
    orphans: list[tuple[str, str]] = []
    for bucket_key, folder, owner in _OWNED_FOLDERS:
        bucket = buckets[bucket_key]
        candidates = await asyncio.to_thread(_owner_ids_in, bucket, folder)
        if not candidates:
            continue
        alive = await existing_ids(owner, candidates)
        for owner_id in candidates:
            if owner_id in alive:
                continue
            prefix = f"{folder}{owner_id}/"
            newest = await asyncio.to_thread(_newest_upload, bucket, prefix)
            if newest is not None and newest > cutoff:
                continue
            orphans.append((bucket, prefix))
    failed: list[str] = []
    if apply:
        for bucket, prefix in orphans:
            try:
                await asyncio.to_thread(_delete_prefix, bucket, prefix)
            except Exception:
                logger.exception("purge_orphaned_files: could not clear %s/%s", bucket, prefix)
                failed.append(f"{bucket}/{prefix}")
    return [f"{bucket}/{prefix}" for bucket, prefix in orphans], failed
