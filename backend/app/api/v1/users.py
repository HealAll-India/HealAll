"""User profile endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    AddSkillRequest,
    BlockedUserResponse,
    MyUserProfile,
    PrivacySettings,
    PublicUserProfile,
    SkillResponse,
    UpdatePrivacyRequest,
    UserProfileUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=MyUserProfile)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MyUserProfile:
    """Get current user's profile (full access)."""
    user = await user_service.get_user_by_id(db, current_user.id)

    # Get privacy settings
    privacy = await user_service.get_or_create_privacy_settings(db, user.id)

    return MyUserProfile(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        city=user.city,
        age_range=user.age_range,
        bio=user.bio,
        avatar_url=user.avatar_url,
        roles=user.roles,
        verification_level=user.verification_level,
        phone_verified=user.phone_verified,
        email_verified=user.email_verified,
        is_active=user.is_active,
        skills=[skill.skill for skill in user.skills],
        privacy_settings=PrivacySettings(
            show_email=privacy.show_email,
            show_phone=privacy.show_phone,
            show_full_city=privacy.show_full_city,
        ),
    )


@router.patch("/me", response_model=MyUserProfile)
async def update_my_profile(
    update_data: UserProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MyUserProfile:
    """Update current user's profile."""
    user = await user_service.update_user_profile(db, current_user.id, update_data)
    await db.commit()

    privacy = await user_service.get_or_create_privacy_settings(db, user.id)

    return MyUserProfile(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        city=user.city,
        age_range=user.age_range,
        bio=user.bio,
        avatar_url=user.avatar_url,
        roles=user.roles,
        verification_level=user.verification_level,
        phone_verified=user.phone_verified,
        email_verified=user.email_verified,
        is_active=user.is_active,
        skills=[skill.skill for skill in user.skills],
        privacy_settings=PrivacySettings(
            show_email=privacy.show_email,
            show_phone=privacy.show_phone,
            show_full_city=privacy.show_full_city,
        ),
    )


@router.get("/{user_id}", response_model=PublicUserProfile)
async def get_user_profile(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PublicUserProfile:
    """Get public user profile (respects privacy settings)."""
    user = await user_service.get_user_by_id(db, user_id)
    privacy = await user_service.get_or_create_privacy_settings(db, user_id)

    # Check if blocked
    is_blocked = await user_service.is_user_blocked(db, current_user.id, user_id)
    if is_blocked:
        from app.core.exceptions import ForbiddenException

        raise ForbiddenException("Cannot view this profile")

    return PublicUserProfile(
        id=user.id,
        name=user.name,
        city=user.city if privacy.show_full_city else None,
        age_range=user.age_range,
        bio=user.bio,
        avatar_url=user.avatar_url,
        roles=user.roles,
        verification_level=user.verification_level,
        skills=[skill.skill for skill in user.skills],
        email=user.email if privacy.show_email else None,
        phone=user.phone if privacy.show_phone else None,
    )


@router.post("/me/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def add_skill(
    skill_data: AddSkillRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SkillResponse:
    """Add a skill to current user's profile."""
    skill = await user_service.add_skill(db, current_user.id, skill_data.skill)
    await db.commit()

    return SkillResponse(id=skill.id, skill=skill.skill)


@router.delete("/me/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_skill(
    skill_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a skill from current user's profile."""
    await user_service.remove_skill(db, current_user.id, skill_id)
    await db.commit()


@router.patch("/me/privacy", response_model=PrivacySettings)
async def update_privacy_settings(
    update_data: UpdatePrivacyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrivacySettings:
    """Update privacy settings."""
    settings = await user_service.update_privacy_settings(db, current_user.id, update_data)
    await db.commit()

    return PrivacySettings(
        show_email=settings.show_email,
        show_phone=settings.show_phone,
        show_full_city=settings.show_full_city,
    )


@router.post("/{user_id}/block", status_code=status.HTTP_201_CREATED)
async def block_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Block a user."""
    await user_service.block_user(db, current_user.id, user_id)
    await db.commit()

    return {"message": "User blocked successfully"}


@router.delete("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Unblock a user."""
    await user_service.unblock_user(db, current_user.id, user_id)
    await db.commit()


@router.get("/me/blocked", response_model=list[BlockedUserResponse])
async def get_blocked_users(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BlockedUserResponse]:
    """Get list of blocked users."""
    blocks = await user_service.get_blocked_users(db, current_user.id)

    return [
        BlockedUserResponse(
            id=block.id,
            blocked_user_id=block.blocked_id,
            blocked_at=block.created_at.isoformat(),
        )
        for block in blocks
    ]
