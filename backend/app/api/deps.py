"""API dependencies."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import UnauthenticatedException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Get current user ID from JWT token."""
    if not authorization:
        raise UnauthenticatedException("Missing authorization header")

    if not authorization.startswith("Bearer "):
        raise UnauthenticatedException("Invalid authorization header format")

    token = authorization.split(" ")[1]

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            raise UnauthenticatedException("Invalid token payload")
        return user_id
    except ValueError as e:
        raise UnauthenticatedException(str(e)) from e


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> User:
    """Get current authenticated user."""
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthenticatedException("User not found")

    if not user.is_active:
        raise UnauthenticatedException("User account is inactive")

    return user


def require_role(required_role: UserRole):
    """Dependency to require a specific role."""

    async def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if required_role.value not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role.value}' required",
            )
        return current_user

    return role_checker


def require_any_role(required_roles: list[UserRole]):
    """Dependency to require any of the specified roles."""

    async def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if not any(role.value in current_user.roles for role in required_roles):
            role_names = ", ".join(role.value for role in required_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {role_names}",
            )
        return current_user

    return role_checker
