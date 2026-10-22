"""Fail when the migrated schema is missing tables or columns the ORM uses.

Tests build their tables with ``Base.metadata.create_all``, so a model column
that no migration creates passes every test and then breaks production
queries (migration 008 shipped ``post_verification_votes`` without
``updated_at``, and every community vote failed). CI runs this right after
``alembic upgrade head``.

Only drift that breaks queries is reported: a model table or column the
database lacks, or a NOT NULL database column without a default that the model
never writes. Index names, constraint styles and equivalent types are ignored.

Usage: DATABASE_URL=postgresql+asyncpg://... python scripts/check_schema_drift.py
"""

from __future__ import annotations

import asyncio
import importlib
import os
import pkgutil
import re
import sys

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.ext.asyncio import create_async_engine

import app.models
from app.models.base import Base


def _load_models() -> None:
    """Import every app.models module so Base.metadata holds all tables."""
    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")


def _breaking(diff: tuple) -> str | None:
    """Describe a diff that would break queries, or return None for cosmetic drift."""
    kind = diff[0]
    if kind == "add_table":
        return f"table {diff[1].name} is missing"
    if kind == "add_column":
        return f"column {diff[2]}.{diff[3].name} is missing"
    if kind == "remove_column":
        column = diff[3]
        if not column.nullable and column.server_default is None:
            return f"column {diff[2]}.{column.name} is NOT NULL without a default, and the model never sets it"
    return None


def _compare(connection) -> list[str]:
    """Return the breaking drift between the connected database and the models."""
    context = MigrationContext.configure(connection)
    diffs = compare_metadata(context, Base.metadata)
    # Column-level changes come back as lists of tuples; only top-level tuples matter here.
    return [problem for diff in diffs if isinstance(diff, tuple) and (problem := _breaking(diff))]


async def main() -> int:
    """Check DATABASE_URL's schema; exit 0 when it matches, 1 on drift, 2 when unset."""
    raw_url = os.environ.get("DATABASE_URL", "")
    if not raw_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 2
    # Same handling as alembic/env.py: asyncpg takes ssl via connect_args, not sslmode=.
    url = re.sub(r"[?&]sslmode=\w+", "", raw_url).rstrip("?&")
    connect_args = {"ssl": "require"} if "sslmode=" in raw_url else {}

    _load_models()
    engine = create_async_engine(url, connect_args=connect_args)
    try:
        async with engine.connect() as connection:
            problems = await connection.run_sync(_compare)
    finally:
        await engine.dispose()

    if problems:
        print("Schema drift: the models need a migration for:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("Schema matches the models (tables and columns).")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
