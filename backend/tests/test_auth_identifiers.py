"""Sign-in accepts phone numbers and emails the way people type them."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import normalize_phone_or_email
from app.services.auth_service import create_otp


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("9876543210", "+919876543210"),
        ("98765 43210", "+919876543210"),
        ("098765-43210", "+919876543210"),
        ("91 98765 43210", "+919876543210"),
        ("0091 98765 43210", "+919876543210"),
        ("+91 98765-43210", "+919876543210"),
        (" +919876543210 ", "+919876543210"),
        ("(+91) 98765 43210", "+919876543210"),
        ("Priya@Example.COM", "Priya@example.com"),
    ],
)
def test_normalize_phone_or_email(typed: str, stored: str):
    assert normalize_phone_or_email(typed) == stored


@pytest.mark.parametrize("typed", ["12345", "not a number", "priya@", "98765 4321"])
def test_rejects_what_cannot_be_a_phone_or_email(typed: str):
    with pytest.raises(ValueError):
        normalize_phone_or_email(typed)


@pytest.mark.asyncio
async def test_sign_in_with_a_spaced_number_without_country_code(client: AsyncClient, db_session: AsyncSession):
    member = User(
        name="Priya Sharma",
        phone="+919876543210",
        email="priya@example.com",
        city="Delhi",
        age_range="25-34",
        roles=["helper"],
        phone_verified=True,
        email_verified=True,
        verification_level=1,
    )
    db_session.add(member)
    await db_session.commit()

    sent = await client.post("/v1/auth/resend-otp", json={"phone_or_email": "98765 43210"})
    assert sent.status_code == 200

    otp, _ = await create_otp(db_session, "+919876543210", "login")
    await db_session.commit()
    response = await client.post("/v1/auth/token", json={"phone_or_email": "98765 43210", "otp_code": otp})
    assert response.status_code == 200, response.text
    assert response.json()["user"]["id"] == str(member.id)
