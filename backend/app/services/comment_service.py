"""Services for post comments."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.comment import Comment
from app.models.post import Post, PostStatus
from app.models.privacy import UserBlock
from app.models.user import User
from app.services import user_service


async def _get_visible_post(db: AsyncSession, post_id: UUID) -> Post:
    result = await db.execute(
        select(Post).where(
            Post.id == post_id,
            Post.deleted_at.is_(None),
            Post.status.in_([PostStatus.ACTIVE.value, PostStatus.RESOLVED.value]),
        )
    )
    post = result.scalar_one_or_none()

    if not post:
        raise NotFoundException("Post not found")

    return post


async def _get_hidden_author_ids(db: AsyncSession, viewer_id: UUID) -> set[UUID]:
    blocked_result = await db.execute(select(UserBlock.blocked_id).where(UserBlock.blocker_id == viewer_id))
    blocked_ids = set(blocked_result.scalars().all())

    blocked_by_result = await db.execute(select(UserBlock.blocker_id).where(UserBlock.blocked_id == viewer_id))
    blocked_ids.update(blocked_by_result.scalars().all())

    return blocked_ids


async def create_comment(db: AsyncSession, post_id: UUID, current_user: User, body: str) -> Comment:
    """Create comment if post is visible and user is not blocked by post author."""
    post = await _get_visible_post(db, post_id)

    if await user_service.is_user_blocked(db, current_user.id, post.author_id):
        raise ForbiddenException("You cannot comment due to a block relationship")

    comment = Comment(post_id=post.id, author_id=current_user.id, body=body)
    db.add(comment)
    await db.flush()
    await db.refresh(comment)

    return comment


async def list_comments(db: AsyncSession, post_id: UUID, current_user: User) -> list[Comment]:
    """List comments while hiding blocked users from the viewer."""
    await _get_visible_post(db, post_id)

    hidden_ids = await _get_hidden_author_ids(db, current_user.id)

    query = select(Comment).where(
        Comment.post_id == post_id,
        Comment.deleted_at.is_(None),
    )
    if hidden_ids:
        query = query.where(Comment.author_id.notin_(list(hidden_ids)))

    result = await db.execute(query.order_by(Comment.created_at.asc()))
    return list(result.scalars().all())


async def delete_comment(db: AsyncSession, comment_id: UUID, current_user: User) -> Comment:
    """Soft delete comment (author/admin/head_admin)."""
    result = await db.execute(select(Comment).where(Comment.id == comment_id, Comment.deleted_at.is_(None)))
    comment = result.scalar_one_or_none()

    if not comment:
        raise NotFoundException("Comment not found")

    is_admin = any(role in {UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value} for role in current_user.roles)
    if comment.author_id != current_user.id and not is_admin:
        raise ForbiddenException("Only author/admin can delete this comment")

    from datetime import UTC, datetime

    comment.deleted_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(comment)

    return comment
