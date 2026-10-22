"""The schema drift check reports the mismatches that break ORM writes."""

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, Text, text

from scripts.check_schema_drift import _compare


def _model(*, with_note: bool = True, nullable: bool = True, server_default: str | None = None) -> MetaData:
    """A one-table model; other tables in the test database only show up as removals."""
    metadata = MetaData()
    columns = [Column("id", Integer, primary_key=True)]
    if with_note:
        columns.append(Column("note", Text, nullable=nullable, server_default=server_default))
    Table("drift_probe", metadata, *columns)
    return metadata


async def _drift(engine, columns_sql: str, metadata: MetaData) -> list[str]:
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE TABLE drift_probe (id INTEGER PRIMARY KEY{columns_sql})"))
    try:
        async with engine.connect() as conn:
            return await conn.run_sync(_compare, metadata)
    finally:
        async with engine.begin() as conn:
            await conn.execute(text("DROP TABLE drift_probe"))


@pytest.mark.asyncio
async def test_not_null_column_the_model_lets_be_empty_is_reported(engine):
    problems = await _drift(engine, ", note TEXT NOT NULL", _model(nullable=True))
    assert problems == ["column drift_probe.note is NOT NULL, but the model lets it be empty"]


@pytest.mark.asyncio
async def test_not_null_column_the_model_lets_be_empty_is_reported_despite_a_default(engine):
    # The default only fills an omitted value; an explicit None still fails.
    problems = await _drift(engine, ", note TEXT NOT NULL DEFAULT ''", _model(nullable=True, server_default=""))
    assert problems == ["column drift_probe.note is NOT NULL, but the model lets it be empty"]


@pytest.mark.asyncio
async def test_matching_column_is_not_reported(engine):
    assert await _drift(engine, ", note TEXT NOT NULL", _model(nullable=False)) == []


@pytest.mark.asyncio
async def test_missing_default_the_model_relies_on_is_reported(engine):
    problems = await _drift(engine, ", note TEXT NOT NULL", _model(nullable=False, server_default=""))
    assert problems == ["column drift_probe.note has no server default, but the model relies on one"]


@pytest.mark.asyncio
async def test_missing_column_is_reported(engine):
    assert await _drift(engine, "", _model()) == ["column drift_probe.note is missing"]


@pytest.mark.asyncio
async def test_not_null_column_the_model_never_sets_is_reported(engine):
    problems = await _drift(engine, ", note TEXT NOT NULL", _model(with_note=False))
    assert problems == ["column drift_probe.note is NOT NULL without a default, and the model never sets it"]
