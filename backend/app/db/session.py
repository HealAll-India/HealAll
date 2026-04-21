"""Database session management."""
import re
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

# asyncpg uses connect_args ssl=, not URL sslmode= (psycopg2 syntax).
_raw_url = str(settings.DATABASE_URL)
_db_url = re.sub(r"[?&]sslmode=\w+", "", _raw_url).rstrip("?&")
_connect_args = {"ssl": "require"} if "sslmode=" in _raw_url else {}

# Create async engine
engine = create_async_engine(
    _db_url,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=_connect_args,
)

# Create session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
