"""Authentication endpoints."""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    ResendOTPRequest,
    ResendOTPResponse,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserInfo,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from app.services import auth_service, invite_service, notification_service

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


@limiter.limit("5/hour")
@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    signup_data: SignupRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SignupResponse:
    """
    Register a new user (invite-only).

    Requires a valid invite code. Sends OTP to phone and email for verification.
    """
    await invite_service.validate_and_use_invite(db, signup_data.invite_code)
    user = await auth_service.create_user(db, signup_data)

    phone_otp, _ = await auth_service.create_otp(db, user.phone, purpose="signup")
    email_otp, _ = await auth_service.create_otp(db, user.email, purpose="signup")

    await db.commit()

    # Send OTPs after response — keeps request fast
    background_tasks.add_task(notification_service.send_otp_sms, user.phone, phone_otp, "signup")
    background_tasks.add_task(notification_service.send_otp_email, user.email, email_otp, "signup")

    pending = []
    if not user.phone_verified:
        pending.append("phone")
    if not user.email_verified:
        pending.append("email")

    return SignupResponse(
        id=user.id,
        name=user.name,
        verification_level=user.verification_level,
        pending_verification=pending,
        message="OTP sent to phone and email. Please verify to continue.",
    )


@limiter.limit("10/minute")
@router.post("/verify-otp", response_model=VerifyOTPResponse)
async def verify_otp(
    request: Request,
    verify_data: VerifyOTPRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VerifyOTPResponse:
    """
    Verify OTP for phone or email.

    After both phone and email are verified, user reaches verification level 1.
    """
    # Verify OTP
    await auth_service.verify_otp_code(db, verify_data.phone_or_email, verify_data.otp_code)

    # Get user
    user = await auth_service.get_user_by_phone_or_email(db, verify_data.phone_or_email)

    # Mark as verified
    if verify_data.phone_or_email.startswith("+"):
        user = await auth_service.mark_phone_verified(db, user)
    else:
        user = await auth_service.mark_email_verified(db, user)

    await db.commit()

    return VerifyOTPResponse(
        verified=True,
        verification_level=user.verification_level,
        message=f"{'Phone' if verify_data.phone_or_email.startswith('+') else 'Email'} verified successfully!",
    )


@limiter.limit("5/hour")
@router.post("/resend-otp", response_model=ResendOTPResponse)
async def resend_otp(
    request: Request,
    resend_data: ResendOTPRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResendOTPResponse:
    """
    Resend OTP to phone or email.

    Rate limited to 5 requests per hour.
    """
    otp, _ = await auth_service.create_otp(db, resend_data.phone_or_email, purpose="login")

    await db.commit()

    if resend_data.phone_or_email.startswith("+"):
        background_tasks.add_task(notification_service.send_otp_sms, resend_data.phone_or_email, otp)
        medium = "phone"
    else:
        background_tasks.add_task(notification_service.send_otp_email, resend_data.phone_or_email, otp)
        medium = "email"

    return ResendOTPResponse(message=f"OTP sent to {medium}")


@limiter.limit("10/minute")
@router.post("/token", response_model=TokenResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Login with phone/email and OTP.

    Returns access token and sets refresh token in httpOnly cookie.
    """
    # Verify OTP
    await auth_service.verify_otp_code(db, login_data.phone_or_email, login_data.otp_code)

    # Get user
    user = await auth_service.get_user_by_phone_or_email(db, login_data.phone_or_email)

    # Create tokens
    access_token, refresh_token = await auth_service.create_tokens(db, user)

    # Set refresh token in httpOnly cookie
    response.set_cookie(
        key="healall_refresh",
        value=refresh_token,
        httponly=True,
        secure=not settings.APP_DEBUG,  # True in production
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    await db.commit()

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


@router.post("/logout")
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """
    Logout current user.

    Revokes all refresh tokens and clears cookie.
    """
    await auth_service.revoke_all_user_tokens(db, current_user.id)
    await db.commit()

    # Clear refresh token cookie
    response.delete_cookie(key="healall_refresh")

    return {"message": "Logged out successfully"}
