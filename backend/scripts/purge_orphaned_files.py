"""Remove uploads whose owner no longer exists.

Account deletion clears a member's files right away, but that pass is
best-effort: an S3 error, or a photo uploaded through a presigned URL issued
just before the deletion, can leave files with no owner. This finds folders
under profile-photos/, identity/ and post-attachments/ whose user or post row
is gone and, with --apply, deletes them. Storage is listed before the
database is read, and folders written in the last hour are skipped, so a
member who signs up while it runs keeps their files. It exits 1 if any
folder could not be deleted, so a scheduler can alert on it. Run it at least
weekly; the account-deletion page promises photos are gone within 30 days.

Usage (dry run first, then apply):
  DATABASE_URL=... S3_*=... python scripts/purge_orphaned_files.py
  DATABASE_URL=... S3_*=... python scripts/purge_orphaned_files.py --apply
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid

from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.post import Post
from app.models.user import User
from app.services import upload_service


async def _existing_ids(owner: str, ids: list[str]) -> set[str]:
    """Which of ``ids`` still have a user (or post) row, read fresh each time."""
    model = User if owner == "user" else Post
    valid = []
    for raw in ids:
        try:
            valid.append(uuid.UUID(raw))
        except ValueError:
            continue  # not a row id, so it can't have an owner
    if not valid:
        return set()
    async with async_session_maker() as db:
        rows = await db.execute(select(model.id).where(model.id.in_(valid)))
        return {str(i) for i in rows.scalars()}


async def main(apply: bool) -> int:
    orphans, failed = await upload_service.purge_orphaned_files(_existing_ids, apply=apply)
    if not apply:
        for folder in orphans:
            print(f"Would delete {folder}")  # noqa: T201
        print(f"Would delete {len(orphans)} orphaned folder(s).")  # noqa: T201
        return 0
    for folder in orphans:
        print(f"{'Could not delete' if folder in failed else 'Deleted'} {folder}")  # noqa: T201
    print(f"Deleted {len(orphans) - len(failed)} of {len(orphans)} orphaned folder(s).")  # noqa: T201
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="delete the folders (default: dry run)")
    sys.exit(asyncio.run(main(parser.parse_args().apply)))
