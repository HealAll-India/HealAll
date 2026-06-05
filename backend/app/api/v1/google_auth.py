"""Google OAuth authentication endpoints."""

import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache
from app.core.config import get_settings
from app.core.exceptions import DuplicateException, UnauthenticatedException
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.auth import (
    GoogleLoginRequest,
    GoogleNonceResponse,
    GoogleSignupRequest,
    TokenResponse,
    UserInfo,
)
from app.services import auth_service, google_auth_service, invite_service, notification_service

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/auth/google", tags=["auth"])

# Server-issued Google OAuth nonce TTL. Long enough to cover the multi-step
# Google signup flow (click Google -> fill phone form -> submit) without the
# nonce expiring mid-flow.
_NONCE_TTL_SECONDS = 30 * 60
_NONCE_KEY_PREFIX = "google_nonce:"


async def _verify_with_nonce(id_token: str, nonce: str | None) -> dict:
    """Consume a server-issued nonce (single-use) and verify the ID token.

    Security model:
      * The nonce must have been issued by GET /auth/google/nonce, stored in
        Redis, and not yet consumed or expired (single-use, time-boxed).
      * The token's `nonce` claim must equal the same value (replay binding).

    Degradation:
      * If the client sends no nonce (deploy skew with an older frontend) the
        token is still verified by signature + aud + exp + email_verified.
      * If Redis itself is unreachable, the single-use check is skipped but the
        token-claim binding is NOT — we never drop below the existing baseline.
    """
    if not nonce:
        logger.info("google_auth: request without nonce; verifying token only")
        return await google_auth_service.verify_google_token(id_token)

    consumed = await cache.consume_single_use(_NONCE_KEY_PREFIX + nonce)
    if consumed is False:
        # Definitively absent: never issued, already used, or expired.
        raise UnauthenticatedException("Login session expired. Please try again.")
    # consumed is None -> Redis unreachable: fall through, still enforce the
    # token-claim binding below.
    return await google_auth_service.verify_google_token(id_token, expected_nonce=nonce)


@limiter.limit("30/hour")
@router.get("/nonce", response_model=GoogleNonceResponse)
async def google_nonce(request: Request) -> GoogleNonceResponse:
    """Issue a single-use nonce for the Google Sign-In flow.

    The frontend passes this to Google Identity Services, which embeds it in
    the returned ID token. On login/signup the backend verifies the same
    nonce, then consumes it so it cannot be replayed.
    """
    nonce = secrets.token_urlsafe(24)
    await cache.set_single_use(_NONCE_KEY_PREFIX + nonce, _NONCE_TTL_SECONDS)
    return GoogleNonceResponse(nonce=nonce)


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

    Verifies Google ID token server-side. Existing users are logged in; new
    users must have a valid invite code and are created fully verified.
    """
    # Verify Google ID token (fetches Google's public keys; runs in executor)
    google_payload = await _verify_with_nonce(signup_data.id_token, signup_data.nonce)

    # Existing users sometimes land on signup. Treat that as Google login and
    # do not consume an invite code.
    user = await google_auth_service.resolve_existing_google_user(db, google_payload)
    created_user = False
    if user is None:
        if await google_auth_service.get_user_by_phone(db, signup_data.phone):
            raise DuplicateException("Phone number already registered")
        await invite_service.validate_and_use_invite(db, signup_data.invite_code)
        user = await google_auth_service.create_google_user(db, signup_data, google_payload)
        created_user = True

    access_token, refresh_token = await auth_service.create_tokens(db, user)

    await db.commit()

    if created_user:
        background_tasks.add_task(notification_service.send_welcome_email, user.email, user.name)
    else:
        response.status_code = status.HTTP_200_OK

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
    # Verify token (single-use nonce + signature/aud/exp)
    google_payload = await _verify_with_nonce(login_data.id_token, login_data.nonce)

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
