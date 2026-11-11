"""DATABASE_URL parsing for asyncpg (app, migrations and the schema drift check)."""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.url import asyncpg_url
from tests.conftest import TEST_DATABASE_URL

NEON = "postgresql+asyncpg://user:pw@ep-x.ap-southeast-1.aws.neon.tech/neondb"


def test_neon_connection_string_keeps_the_database_name():
    url, connect_args = asyncpg_url(f"{NEON}?sslmode=require&channel_binding=require")
    assert url == NEON
    assert connect_args == {"ssl": "require"}


def test_ssl_mode_is_passed_through_and_other_parameters_are_kept():
    url, connect_args = asyncpg_url(f"{NEON}?application_name=api&sslmode=verify-full")
    assert url == f"{NEON}?application_name=api"
    assert connect_args == {"ssl": "verify-full"}


def test_url_without_parameters_is_unchanged():
    assert asyncpg_url(NEON) == (NEON, {})


def test_percent_encoded_password_is_untouched():
    raw = "postgresql+asyncpg://user:p%40ss@db.example.com:5432/app?sslmode=require"
    assert asyncpg_url(raw) == ("postgresql+asyncpg://user:p%40ss@db.example.com:5432/app", {"ssl": "require"})


@pytest.mark.asyncio
async def test_libpq_style_url_connects():
    url, connect_args = asyncpg_url(f"{TEST_DATABASE_URL}?sslmode=disable&channel_binding=require")
    engine = create_async_engine(url, connect_args=connect_args)
    try:
        async with engine.connect() as conn:
            assert (await conn.execute(text("SELECT current_database()"))).scalar() == "healall_test"
    finally:
        await engine.dispose()
