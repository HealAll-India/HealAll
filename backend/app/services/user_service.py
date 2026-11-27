"""User profile service."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import UserRole
from app.core.exceptions import DuplicateException, ForbiddenException, NotFoundException
from app.models.post import Post
from app.models.privacy import UserBlock, UserPrivacySettings
from app.models.user import OTPAttempt, User, UserSkill
from app.schemas.user import UpdatePrivacyRequest, UserProfileUpdate


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User:
    """Get user by ID with skills loaded."""
    result = await db.execute(
        select(User).options(selectinload(User.skills)).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundException("User not found")

    return user


async def update_user_profile(
    db: AsyncSession,
    user_id: UUID,
    update_data: UserProfileUpdate,
) -> User:
    """Update user profile."""
    user = await get_user_by_id(db, user_id)

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if field == "age_range" and value:
            setattr(user, field, value.value)
        else:
            setattr(user, field, value)

    await db.flush()
    return await get_user_by_id(db, user_id)


async def add_skill(db: AsyncSession, user_id: UUID, skill: str) -> UserSkill:
    """Add skill to user profile."""
    # Check if skill already exists
    result = await db.execute(select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill == skill))
    existing = result.scalar_one_or_none()

    if existing:
        raise DuplicateException(f"Skill '{skill}' already added")

    user_skill = UserSkill(user_id=user_id, skill=skill)
    db.add(user_skill)
    await db.flush()
    await db.refresh(user_skill)

    return user_skill


async def remove_skill(db: AsyncSession, user_id: UUID, skill_id: UUID) -> None:
    """Remove skill from user profile."""
    result = await db.execute(select(UserSkill).where(UserSkill.id == skill_id, UserSkill.user_id == user_id))
    skill = result.scalar_one_or_none()

    if not skill:
        raise NotFoundException("Skill not found")

    await db.delete(skill)
    await db.flush()


async def get_or_create_privacy_settings(
    db: AsyncSession,
    user_id: UUID,
) -> UserPrivacySettings:
    """Get or create privacy settings for user."""
    result = await db.execute(select(UserPrivacySettings).where(UserPrivacySettings.user_id == user_id))
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserPrivacySettings(user_id=user_id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)

    return settings


async def update_privacy_settings(
    db: AsyncSession,
    user_id: UUID,
    update_data: UpdatePrivacyRequest,
) -> UserPrivacySettings:
    """Update privacy settings."""
    settings = await get_or_create_privacy_settings(db, user_id)

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(settings, field, value)

    await db.flush()
    await db.refresh(settings)

    return settings


async def block_user(db: AsyncSession, blocker_id: UUID, blocked_id: UUID) -> UserBlock:
    """Block a user."""
    if blocker_id == blocked_id:
        raise DuplicateException("Cannot block yourself")

    # Check if already blocked
    result = await db.execute(
        select(UserBlock).where(UserBlock.blocker_id == blocker_id, UserBlock.blocked_id == blocked_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise DuplicateException("User already blocked")

    block = UserBlock(blocker_id=blocker_id, blocked_id=blocked_id)
    db.add(block)
    await db.flush()
    await db.refresh(block)

    return block


async def unblock_user(db: AsyncSession, blocker_id: UUID, blocked_id: UUID) -> None:
    """Unblock a user."""
    result = await db.execute(
        select(UserBlock).where(UserBlock.blocker_id == blocker_id, UserBlock.blocked_id == blocked_id)
    )
    block = result.scalar_one_or_none()

    if not block:
        raise NotFoundException("User not blocked")

    await db.delete(block)
    await db.flush()


async def get_blocked_users(db: AsyncSession, user_id: UUID) -> list[UserBlock]:
    """Get list of blocked users."""
    result = await db.execute(
        select(UserBlock).where(UserBlock.blocker_id == user_id).order_by(UserBlock.created_at.desc())
    )
    return list(result.scalars().all())


async def is_user_blocked(db: AsyncSession, blocker_id: UUID, blocked_id: UUID) -> bool:
    """Check if user is blocked (bidirectional)."""
    result = await db.execute(
        select(UserBlock).where(
            ((UserBlock.blocker_id == blocker_id) & (UserBlock.blocked_id == blocked_id))
            | ((UserBlock.blocker_id == blocked_id) & (UserBlock.blocked_id == blocker_id))
        )
    )
    return result.scalar_one_or_none() is not None


# Staff accounts can't delete themselves in the app: their moderation actions
# reference them with ON DELETE CASCADE, so deleting the account would erase
# the audit trail for every member they acted on. They step down first.
_STAFF_ROLES = {UserRole.MODERATOR.value, UserRole.ADMIN.value, UserRole.HEAD_ADMIN.value}


async def delete_account(db: AsyncSession, user_id: UUID) -> list[UUID]:
    """Permanently delete a member's account and everything tied to it.

    One DELETE on ``users``: the schema's ON DELETE CASCADE / SET NULL foreign
    keys remove their posts, comments, messages, conversations, skills,
    privacy settings, blocks, votes, reports and refresh tokens, and detach
    them from cases. OTP rows are keyed by phone/email, not by user id, so
    they are removed here as well.

    Returns the ids of the member's posts (soft-deleted ones included), so
    the caller can remove their uploaded files once the delete is committed.
    """
    user = await get_user_by_id(db, user_id)

    if _STAFF_ROLES.intersection(user.roles or []):
        raise ForbiddenException(
            "Moderators and admins can't delete their account in the app. "
            "Ask a head admin to remove your staff role first."
        )

    post_ids = list((await db.execute(select(Post.id).where(Post.author_id == user.id))).scalars().all())

    await db.execute(delete(OTPAttempt).where(OTPAttempt.phone_or_email.in_([user.phone, user.email])))
    await db.execute(delete(User).where(User.id == user.id))
    await db.flush()
    return post_ids
