"""Web push subscription endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.push import PushPublicKeyResponse, PushSubscribeRequest, PushUnsubscribeRequest
from app.services import push_service

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/public-key", response_model=PushPublicKeyResponse)
async def get_public_key() -> PushPublicKeyResponse:
    """The VAPID public key browsers subscribe with; ``enabled: false`` while push is off."""
    settings = get_settings()
    if not settings.push_enabled:
        return PushPublicKeyResponse(enabled=False)
    return PushPublicKeyResponse(enabled=True, public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/hour")
async def subscribe(
    request: Request,
    payload: PushSubscribeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Save this device's subscription for the signed-in member (moving it from anyone else)."""
    await push_service.save_subscription(
        db=db,
        user=current_user,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/hour")
async def unsubscribe(
    request: Request,
    payload: PushUnsubscribeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete the signed-in member's subscription for this device, if they have one."""
    await push_service.delete_subscription(db=db, user=current_user, endpoint=payload.endpoint)
    await db.commit()
