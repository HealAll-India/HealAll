"""Upload service — generates presigned PUT URLs for MinIO/S3."""
import uuid

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.core.exceptions import HealAllException

settings = get_settings()


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


def profile_photo_key(user_id: str, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    return f"profile-photos/{user_id}/{uuid.uuid4()}.{ext}"


def post_attachment_key(post_id: str, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    return f"post-attachments/{post_id}/{uuid.uuid4()}.{ext}"


def identity_document_key(user_id: str, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    return f"identity/{user_id}/{uuid.uuid4()}.{ext}"
