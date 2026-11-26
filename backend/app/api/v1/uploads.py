"""Presigned upload URL endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.exceptions import ForbiddenException
from app.db.session import get_db
from app.models.user import User
from app.schemas.upload import PresignedUploadRequest, PresignedUploadResponse
from app.services import post_service, upload_service
from app.services.upload_limits import validate_upload

settings = get_settings()
router = APIRouter(prefix="/uploads", tags=["uploads"])

_EXPIRES_IN = 300  # 5 minutes


@router.post("/profile-photo", response_model=PresignedUploadResponse)
async def presign_profile_photo(
    body: PresignedUploadRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PresignedUploadResponse:
    """Return a presigned PUT URL to upload the current user's profile photo.

    Profile photos are the one upload kind served publicly (they are shown as
    avatars), so this is the only endpoint that returns ``public_url``.
    """
    safe_name = validate_upload("profile_photo", body.content_type, body.size_bytes)
    key = upload_service.profile_photo_key(str(current_user.id), safe_name)
    url = upload_service.generate_presigned_put(
        settings.S3_BUCKET_MEDIA, key, body.content_type, _EXPIRES_IN, content_length=body.size_bytes
    )
    return PresignedUploadResponse(
        upload_url=url,
        object_key=key,
        bucket=settings.S3_BUCKET_MEDIA,
        expires_in=_EXPIRES_IN,
        public_url=upload_service.public_object_url(settings.S3_BUCKET_MEDIA, key),
    )


@router.post("/post-attachment", response_model=PresignedUploadResponse)
async def presign_post_attachment(
    post_id: UUID,
    body: PresignedUploadRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PresignedUploadResponse:
    """Return a presigned PUT URL to upload a file attachment for one of the caller's posts.

    Only the post's author may upload to it. No public URL is returned:
    attachments are not meant to be readable straight from the bucket.
    """
    post = await post_service.get_post_by_id(db, post_id)
    if post.author_id != current_user.id:
        raise ForbiddenException("You can only add attachments to your own posts")
    safe_name = validate_upload("post_attachment", body.content_type, body.size_bytes)
    key = upload_service.post_attachment_key(str(post.id), safe_name)
    url = upload_service.generate_presigned_put(
        settings.S3_BUCKET_MEDIA, key, body.content_type, _EXPIRES_IN, content_length=body.size_bytes
    )
    return PresignedUploadResponse(
        upload_url=url,
        object_key=key,
        bucket=settings.S3_BUCKET_MEDIA,
        expires_in=_EXPIRES_IN,
    )


@router.post("/identity-document", response_model=PresignedUploadResponse)
async def presign_identity_document(
    body: PresignedUploadRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PresignedUploadResponse:
    """Return a presigned PUT URL for uploading an identity document (Aadhaar).

    Uploads go to the identity-ephemeral bucket — shorter retention, stricter ACL.
    """
    safe_name = validate_upload("identity_document", body.content_type, body.size_bytes)
    key = upload_service.identity_document_key(str(current_user.id), safe_name)
    url = upload_service.generate_presigned_put(
        settings.S3_BUCKET_IDENTITY, key, body.content_type, _EXPIRES_IN, content_length=body.size_bytes
    )
    return PresignedUploadResponse(
        upload_url=url,
        object_key=key,
        bucket=settings.S3_BUCKET_IDENTITY,
        expires_in=_EXPIRES_IN,
    )
