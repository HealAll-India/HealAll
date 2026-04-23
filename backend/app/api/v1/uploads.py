"""Presigned upload URL endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.upload import PresignedUploadRequest, PresignedUploadResponse
from app.services import upload_service

settings = get_settings()
router = APIRouter(prefix="/uploads", tags=["uploads"])

_EXPIRES_IN = 300  # 5 minutes


@router.post("/profile-photo", response_model=PresignedUploadResponse)
async def presign_profile_photo(
    body: PresignedUploadRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PresignedUploadResponse:
    """Return a presigned PUT URL to upload the current user's profile photo."""
    key = upload_service.profile_photo_key(str(current_user.id), body.file_name)
    url = upload_service.generate_presigned_put(settings.S3_BUCKET_MEDIA, key, body.content_type, _EXPIRES_IN)
    return PresignedUploadResponse(
        upload_url=url,
        object_key=key,
        bucket=settings.S3_BUCKET_MEDIA,
        expires_in=_EXPIRES_IN,
    )


@router.post("/post-attachment", response_model=PresignedUploadResponse)
async def presign_post_attachment(
    post_id: UUID,
    body: PresignedUploadRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PresignedUploadResponse:
    """Return a presigned PUT URL to upload a file attachment for a post."""
    key = upload_service.post_attachment_key(str(post_id), body.file_name)
    url = upload_service.generate_presigned_put(settings.S3_BUCKET_MEDIA, key, body.content_type, _EXPIRES_IN)
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
    key = upload_service.identity_document_key(str(current_user.id), body.file_name)
    url = upload_service.generate_presigned_put(settings.S3_BUCKET_IDENTITY, key, body.content_type, _EXPIRES_IN)
    return PresignedUploadResponse(
        upload_url=url,
        object_key=key,
        bucket=settings.S3_BUCKET_IDENTITY,
        expires_in=_EXPIRES_IN,
    )
