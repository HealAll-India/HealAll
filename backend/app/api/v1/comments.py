"""Comment endpoints."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import DuplicateException
from app.db.session import get_db
from app.models.user import User
from app.schemas.comment import CommentAuthor, CommentResponse, CreateCommentRequest
from app.services import comment_service

router = APIRouter(tags=["comments"])


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: UUID,
    payload: CreateCommentRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CommentResponse:
    """Create a public comment on a visible post."""
    comment = await comment_service.create_comment(
        db=db,
        post_id=post_id,
        current_user=current_user,
        body=payload.body,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        author=CommentAuthor(
            id=current_user.id,
            name=current_user.name,
            verification_level=current_user.verification_level,
        ),
        body=comment.body,
        created_at=comment.created_at,
    )


@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CommentResponse]:
    """List comments, hiding users blocked by the viewer."""
    comments = await comment_service.list_comments(
        db=db,
        post_id=post_id,
        current_user=current_user,
    )

    author_ids = list({comment.author_id for comment in comments})
    authors_result = await db.execute(select(User).where(User.id.in_(author_ids)))
    author_map = {author.id: author for author in authors_result.scalars().all()}

    return [
        CommentResponse(
            id=comment.id,
            post_id=comment.post_id,
            author=CommentAuthor(
                id=comment.author_id,
                name=author_map[comment.author_id].name,
                verification_level=author_map[comment.author_id].verification_level,
            ),
            body=comment.body,
            created_at=comment.created_at,
        )
        for comment in comments
        if comment.author_id in author_map
    ]


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Soft-delete comment (author/admin/head_admin)."""
    await comment_service.delete_comment(
        db=db,
        comment_id=comment_id,
        current_user=current_user,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated") from None
