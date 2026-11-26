"""Database session management."""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.url import asyncpg_url

settings = get_settings()

_db_url, _connect_args = asyncpg_url(str(settings.DATABASE_URL))

# A Lambda instance serves one request at a time, so a bigger pool only keeps
# idle connections open against Neon's connection limit while it is frozen.
# AWS_LAMBDA_FUNCTION_NAME is set for every Lambda function.
_ON_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

# Create async engine
engine = create_async_engine(
    _db_url,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
    pool_size=1 if _ON_LAMBDA else 5,
    max_overflow=2 if _ON_LAMBDA else 10,
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
