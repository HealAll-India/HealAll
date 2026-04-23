"""Schemas for presigned upload URLs."""

from pydantic import BaseModel, Field


class PresignedUploadRequest(BaseModel):
    """Request to generate a presigned upload URL."""

    file_name: str = Field(..., min_length=1, max_length=200)
    content_type: str = Field(..., min_length=1, max_length=100)


class PresignedUploadResponse(BaseModel):
    """Response containing a presigned PUT URL."""

    upload_url: str
    object_key: str
    bucket: str
    expires_in: int
