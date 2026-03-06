"""Case lifecycle endpoints."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import DuplicateException
from app.db.session import get_db
from app.models.user import User
from app.schemas.case import (
    AddCaseNoteRequest,
    CaseClosureResponse,
    CaseHelperResponse,
    CaseListResponse,
    CaseNoteAuthor,
    CaseNoteResponse,
    CaseOwnerInfo,
    CasePostInfo,
    CaseResponse,
    CloseCaseRequest,
    UpdateCaseRequest,
)
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])


async def _load_user_map(db: AsyncSession, user_ids: list[UUID]) -> dict[UUID, User]:
    if not user_ids:
        return {}

    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    return {user.id: user for user in users_result.scalars().all()}


def _to_case_response(
    case,
    post,
    helper_count: int,
    owner: User | None,
) -> CaseResponse:
    owner_info = None
    if owner:
        owner_info = CaseOwnerInfo(
            id=owner.id,
            name=owner.name,
            verification_level=owner.verification_level,
        )

    return CaseResponse(
        id=case.id,
        post=CasePostInfo(
            id=post.id,
            title=post.title,
            category=post.category,
            urgency=post.urgency,
            city=post.city,
            author_id=post.author_id,
        ),
        owner=owner_info,
        status=case.status,
        helper_count=helper_count,
        closure_requested_by=case.closure_requested_by,
        closure_requested_at=case.closure_requested_at,
        closed_at=case.closed_at,
        created_at=case.created_at,
        updated_at=case.updated_at,
    )


@router.get("", response_model=CaseListResponse)
async def list_my_cases(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
) -> CaseListResponse:
    """List cases visible to current user."""
    rows, total, helper_counts = await case_service.list_cases_for_user(
        db=db,
        current_user=current_user,
        page=page,
        per_page=per_page,
    )

    owner_ids = [case.owner_id for case, _post in rows if case.owner_id is not None]
    owner_map = await _load_user_map(db, owner_ids)

    items = [
        _to_case_response(
            case=case,
            post=post,
            helper_count=helper_counts.get(case.id, 0),
            owner=owner_map.get(case.owner_id) if case.owner_id else None,
        )
        for case, post in rows
    ]

    return CaseListResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        has_next=(page * per_page) < total,
    )


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseResponse:
    """Get case detail by ID."""
    case, post, helper_count = await case_service.get_case_detail(
        db=db,
        case_id=case_id,
        current_user=current_user,
    )

    owner = None
    if case.owner_id:
        owners = await _load_user_map(db, [case.owner_id])
        owner = owners.get(case.owner_id)

    return _to_case_response(
        case=case,
        post=post,
        helper_count=helper_count,
        owner=owner,
    )


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: UUID,
    payload: UpdateCaseRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseResponse:
    """Assign or clear case owner (verifier/admin/head_admin)."""
    case, post, helper_count = await case_service.update_case_owner(
        db=db,
        case_id=case_id,
        current_user=current_user,
        owner_id=payload.owner_id,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated")

    owner = None
    if case.owner_id:
        owners = await _load_user_map(db, [case.owner_id])
        owner = owners.get(case.owner_id)

    return _to_case_response(
        case=case,
        post=post,
        helper_count=helper_count,
        owner=owner,
    )


@router.post(
    "/{case_id}/helpers",
    response_model=CaseHelperResponse,
    status_code=status.HTTP_201_CREATED,
)
async def offer_help(
    case_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseHelperResponse:
    """Offer help on a case."""
    helper = await case_service.offer_help_on_case(
        db=db,
        case_id=case_id,
        current_user=current_user,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated")

    return CaseHelperResponse(
        id=helper.id,
        case_id=helper.case_id,
        user_id=helper.user_id,
        status=helper.status,
        offered_at=helper.offered_at,
        withdrawn_at=helper.withdrawn_at,
    )


@router.delete("/{case_id}/helpers/{user_id}", response_model=CaseHelperResponse)
async def withdraw_help(
    case_id: UUID,
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseHelperResponse:
    """Withdraw helper from a case (self/case-owner/verifier/admin)."""
    helper = await case_service.withdraw_help_from_case(
        db=db,
        case_id=case_id,
        helper_user_id=user_id,
        current_user=current_user,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated")

    return CaseHelperResponse(
        id=helper.id,
        case_id=helper.case_id,
        user_id=helper.user_id,
        status=helper.status,
        offered_at=helper.offered_at,
        withdrawn_at=helper.withdrawn_at,
    )


@router.post("/{case_id}/notes", response_model=CaseNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_case_note(
    case_id: UUID,
    payload: AddCaseNoteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseNoteResponse:
    """Add note to a case (case team only)."""
    note = await case_service.add_case_note(
        db=db,
        case_id=case_id,
        current_user=current_user,
        body=payload.body,
        support_type=payload.support_type,
        hours_contributed=payload.hours_contributed,
        attachment_s3_key=payload.attachment_s3_key,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated")

    return CaseNoteResponse(
        id=note.id,
        case_id=note.case_id,
        author=CaseNoteAuthor(
            id=current_user.id,
            name=current_user.name,
            verification_level=current_user.verification_level,
        ),
        body=note.body,
        support_type=note.support_type,
        hours_contributed=note.hours_contributed,
        attachment_s3_key=note.attachment_s3_key,
        created_at=note.created_at,
    )


@router.get("/{case_id}/notes", response_model=list[CaseNoteResponse])
async def list_case_notes(
    case_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CaseNoteResponse]:
    """List case notes (case team only)."""
    notes = await case_service.list_case_notes(
        db=db,
        case_id=case_id,
        current_user=current_user,
    )

    author_map = await _load_user_map(db, [note.author_id for note in notes])

    return [
        CaseNoteResponse(
            id=note.id,
            case_id=note.case_id,
            author=CaseNoteAuthor(
                id=note.author_id,
                name=author_map[note.author_id].name,
                verification_level=author_map[note.author_id].verification_level,
            ),
            body=note.body,
            support_type=note.support_type,
            hours_contributed=note.hours_contributed,
            attachment_s3_key=note.attachment_s3_key,
            created_at=note.created_at,
        )
        for note in notes
        if note.author_id in author_map
    ]


@router.post("/{case_id}/close", response_model=CaseClosureResponse)
async def close_case(
    case_id: UUID,
    payload: CloseCaseRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseClosureResponse:
    """Request closure (owner/help-seeker) or confirm closure (verifier/admin)."""
    _case, closure = await case_service.close_case(
        db=db,
        case_id=case_id,
        current_user=current_user,
        resolution_type=payload.resolution_type.value,
        closure_remarks=payload.closure_remarks,
        impact_story=payload.impact_story,
        impact_consent=payload.impact_consent,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated")

    return CaseClosureResponse(
        id=closure.id,
        case_id=closure.case_id,
        closed_by=closure.closed_by,
        confirmed_by=closure.confirmed_by,
        resolution_type=closure.resolution_type,
        remarks=closure.remarks,
        impact_story=closure.impact_story,
        impact_consent=closure.impact_consent,
        created_at=closure.created_at,
    )


@router.post("/{case_id}/reopen", response_model=CaseResponse)
async def reopen_case(
    case_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseResponse:
    """Reopen a case (verifier/admin/head_admin only)."""
    case = await case_service.reopen_case(
        db=db,
        case_id=case_id,
        current_user=current_user,
    )

    detail_case, post, helper_count = await case_service.get_case_detail(
        db=db,
        case_id=case.id,
        current_user=current_user,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise DuplicateException("Resource already exists or constraint violated")

    owner = None
    if detail_case.owner_id:
        owners = await _load_user_map(db, [detail_case.owner_id])
        owner = owners.get(detail_case.owner_id)

    return _to_case_response(
        case=detail_case,
        post=post,
        helper_count=helper_count,
        owner=owner,
    )
