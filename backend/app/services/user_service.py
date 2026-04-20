"""User profile service."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import DuplicateException, NotFoundException
from app.models.privacy import UserBlock, UserPrivacySettings
from app.models.user import User, UserSkill
from app.schemas.user import UpdatePrivacyRequest, UserProfileUpdate


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User:
    """Get user by ID with skills loaded."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.skills))
        .where(User.id == user_id, User.deleted_at.is_(None))
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
    result = await db.execute(
        select(UserSkill).where(
            UserSkill.user_id == user_id,
            UserSkill.skill == skill
        )
    )
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
    result = await db.execute(
        select(UserSkill).where(
            UserSkill.id == skill_id,
            UserSkill.user_id == user_id
        )
    )
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
    result = await db.execute(
        select(UserPrivacySettings).where(UserPrivacySettings.user_id == user_id)
    )
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
        select(UserBlock).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id
        )
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
        select(UserBlock).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id
        )
    )
    block = result.scalar_one_or_none()

    if not block:
        raise NotFoundException("User not blocked")

    await db.delete(block)
    await db.flush()


async def get_blocked_users(db: AsyncSession, user_id: UUID) -> list[UserBlock]:
    """Get list of blocked users."""
    result = await db.execute(
        select(UserBlock)
        .where(UserBlock.blocker_id == user_id)
        .order_by(UserBlock.created_at.desc())
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
