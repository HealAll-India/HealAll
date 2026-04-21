"""Database seeding script for development."""
import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.core.constants import AgeRange, UserRole, VerificationLevel
from app.db.session import async_session_maker
from app.models.invite import InviteCode
from app.models.user import User


async def seed():
    """Seed the database with initial data."""
    async with async_session_maker() as session:
        print("🌱 Seeding database...")

        # Check if admin already exists
        result = await session.execute(
            select(User).where(User.email == "admin@healall.in")
        )
        existing_admin = result.scalar_one_or_none()

        if existing_admin:
            print("✅ Admin user already exists")
            admin_id = existing_admin.id
        else:
            # Create Head Admin user
            admin = User(
                id=uuid4(),
                name="Anupam (Admin)",
                phone="+919999999999",
                email="admin@healall.in",
                city="Delhi",
                age_range=AgeRange.YOUNG_ADULT.value,
                roles=[
                    UserRole.HEAD_ADMIN.value,
                    UserRole.ADMIN.value,
                    UserRole.CASE_VERIFIER.value,
                    UserRole.HELPER.value,
                    UserRole.HELP_SEEKER.value,
                ],
                verification_level=VerificationLevel.ID_VERIFIED,
                phone_verified=True,
                email_verified=True,
                is_active=True,
            )
            session.add(admin)
            await session.flush()
            admin_id = admin.id
            print(f"✅ Created admin user: {admin.email}")

        # Create demo invite codes
        invite_codes_to_create = [
            ("HEAL-DEMO001", 10, 365),  # Multi-use code for testing
            ("HEAL-TEMP001", 1, 30),    # Single-use temp code
        ]

        for code, max_uses, days in invite_codes_to_create:
            result = await session.execute(
                select(InviteCode).where(InviteCode.code == code)
            )
            existing_invite = result.scalar_one_or_none()

            if existing_invite:
                print(f"✅ Invite code already exists: {code}")
            else:
                invite = InviteCode(
                    code=code,
                    created_by=admin_id,
                    max_uses=max_uses,
                    use_count=0,
                    expires_at=datetime.now(UTC) + timedelta(days=days),
                    revoked=False,
                )
                session.add(invite)
                print(f"✅ Created invite code: {code} (max_uses: {max_uses}, expires in {days} days)")

        await session.commit()
        print("\n🎉 Database seeding completed!")
        print("\n📝 You can use these credentials for testing:")
        print("   Invite Code: HEAL-DEMO001 (10 uses)")
        print("   Invite Code: HEAL-TEMP001 (1 use)")


if __name__ == "__main__":
    asyncio.run(seed())
