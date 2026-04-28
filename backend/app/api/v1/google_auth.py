"""Google OAuth authentication endpoints."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.auth import GoogleLoginRequest, GoogleSignupRequest, TokenResponse, UserInfo
from app.services import auth_service, google_auth_service, invite_service, notification_service

settings = get_settings()
router = APIRouter(prefix="/auth/google", tags=["auth"])


@limiter.limit("10/hour")
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def google_signup(
    request: Request,
    signup_data: GoogleSignupRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Register a new user via Google OAuth (invite-only).

    Verifies Google ID token server-side, validates invite code, creates user,
    and returns JWT immediately. Email is auto-verified by Google. No OTP needed.
    """
    # Validate invite code first (cheap check before network call)
    await invite_service.validate_and_use_invite(db, signup_data.invite_code)

    # Verify Google ID token (fetches Google's public keys; runs in executor)
    google_payload = await google_auth_service.verify_google_token(signup_data.id_token)

    # Create user (raises DuplicateException if email/phone/sub already exists)
    user = await google_auth_service.create_google_user(db, signup_data, google_payload)

    # Issue JWT tokens
    access_token, refresh_token = await auth_service.create_tokens(db, user)

    await db.commit()

    # Send welcome email in background
    background_tasks.add_task(notification_service.send_welcome_email, user.email, user.name)

    # Set refresh token in httpOnly cookie
    response.set_cookie(
        key="healall_refresh",
        value=refresh_token,
        httponly=True,
        secure=not settings.APP_DEBUG,
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfo(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            city=user.city,
            age_range=user.age_range,
            roles=user.roles,
            verification_level=user.verification_level,
            avatar_url=user.avatar_url,
        ),
    )


@limiter.limit("20/minute")
@router.post("/login", response_model=TokenResponse)
async def google_login(
    request: Request,
    login_data: GoogleLoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Login with Google ID token.

    Verifies token, finds matching HealAll account (by google_sub or email),
    and automatically links google_sub on first Google login for OTP-registered users.
    """
    # Verify token
    google_payload = await google_auth_service.verify_google_token(login_data.id_token)

    # Find or link user
    user = await google_auth_service.resolve_google_login(db, google_payload)

    # Issue tokens
    access_token, refresh_token = await auth_service.create_tokens(db, user)

    await db.commit()

    response.set_cookie(
        key="healall_refresh",
        value=refresh_token,
        httponly=True,
        secure=not settings.APP_DEBUG,
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfo(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            city=user.city,
            age_range=user.age_range,
            roles=user.roles,
            verification_level=user.verification_level,
            avatar_url=user.avatar_url,
        ),
    )
