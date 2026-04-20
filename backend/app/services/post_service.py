"""Post service."""
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, InvalidStateException, NotFoundException
from app.models.post import Post, PostStatus
from app.models.privacy import UserBlock
from app.schemas.post import CreatePostRequest, UpdatePostRequest


async def create_post(
    db: AsyncSession,
    author_id: UUID,
    post_data: CreatePostRequest,
) -> Post:
    """Create a new post."""
    post = Post(
        author_id=author_id,
        title=post_data.title,
        description=post_data.description,
        category=post_data.category.value,
        urgency=post_data.urgency.value,
        city=post_data.city,
        contact_prefs=post_data.contact_prefs,
        status=PostStatus.DRAFT.value,
    )

    db.add(post)
    await db.flush()
    await db.refresh(post)

    return post


async def get_post_by_id(db: AsyncSession, post_id: UUID) -> Post:
    """Get post by ID."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    post = result.scalar_one_or_none()

    if not post:
        raise NotFoundException("Post not found")

    return post


async def update_post(
    db: AsyncSession,
    post_id: UUID,
    author_id: UUID,
    update_data: UpdatePostRequest,
) -> Post:
    """Update a post (only by author, only if draft or needs_info)."""
    post = await get_post_by_id(db, post_id)

    if post.author_id != author_id:
        raise ForbiddenException("You can only edit your own posts")

    if post.status not in [PostStatus.DRAFT.value, PostStatus.NEEDS_INFO.value]:
        raise InvalidStateException("Can only edit posts in draft or needs_info status")

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if field in ["category", "urgency"] and value:
            setattr(post, field, value.value)
        else:
            setattr(post, field, value)

    await db.flush()
    await db.refresh(post)

    return post


async def delete_post(db: AsyncSession, post_id: UUID, user_id: UUID) -> None:
    """Soft delete a post."""
    post = await get_post_by_id(db, post_id)

    if post.author_id != user_id:
        raise ForbiddenException("You can only delete your own posts")

    post.soft_delete()
    await db.flush()


async def submit_post(db: AsyncSession, post_id: UUID, author_id: UUID) -> Post:
    """Submit a post for verification."""
    post = await get_post_by_id(db, post_id)

    if post.author_id != author_id:
        raise ForbiddenException("You can only submit your own posts")

    if post.status not in {PostStatus.DRAFT.value, PostStatus.NEEDS_INFO.value}:
        raise InvalidStateException("Can only submit posts in draft or needs_info status")

    post.status = PostStatus.SUBMITTED.value
    await db.flush()
    await db.refresh(post)

    return post


async def get_feed(
    db: AsyncSession,
    viewer_id: UUID | None = None,
    city: str | None = None,
    category: str | None = None,
    urgency: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Post], int]:
    """Get feed of active posts with filters."""
    query = select(Post).where(
        Post.status == PostStatus.ACTIVE.value,
        Post.deleted_at.is_(None),
    )

    # Exclude posts from users in a block relationship with the viewer
    if viewer_id:
        blocked_by_viewer = select(UserBlock.blocked_id).where(UserBlock.blocker_id == viewer_id)
        blocked_viewer = select(UserBlock.blocker_id).where(UserBlock.blocked_id == viewer_id)
        query = query.where(
            ~Post.author_id.in_(blocked_by_viewer),
            ~Post.author_id.in_(blocked_viewer),
        )

    # Apply filters
    if city:
        query = query.where(Post.city == city)
    if category:
        query = query.where(Post.category == category)
    if urgency:
        query = query.where(Post.urgency == urgency)
    if search:
        # Simple search for MVP (will use full-text search later)
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Post.title.ilike(search_term),
                Post.description.ilike(search_term),
            )
        )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply pagination and sorting
    query = query.order_by(
        Post.urgency.desc(),
        Post.created_at.desc(),
    ).limit(per_page).offset((page - 1) * per_page)

    result = await db.execute(query)
    posts = list(result.scalars().all())

    return posts, total


async def get_my_posts(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Post], int]:
    """Get user's own posts."""
    query = select(Post).where(
        Post.author_id == user_id,
        Post.deleted_at.is_(None),
    )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply pagination
    query = query.order_by(Post.created_at.desc()).limit(per_page).offset((page - 1) * per_page)

    result = await db.execute(query)
    posts = list(result.scalars().all())

    return posts, total
