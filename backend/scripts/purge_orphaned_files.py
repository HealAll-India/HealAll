"""Remove uploads whose owner no longer exists.

Account deletion clears a member's files right away, but that pass is
best-effort: an S3 error, or a photo uploaded through a presigned URL issued
just before the deletion, can leave files with no owner. This finds folders
under profile-photos/, identity/ and post-attachments/ whose user or post row
is gone and, with --apply, deletes them. Run it at least monthly; the
account-deletion page promises photos are gone within 30 days.

Usage (dry run first, then apply):
  DATABASE_URL=... S3_*=... python scripts/purge_orphaned_files.py
  DATABASE_URL=... S3_*=... python scripts/purge_orphaned_files.py --apply
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.db.session import async_session_maker
from app.models.post import Post
from app.models.user import User
from app.services import upload_service


async def main(apply: bool) -> int:
    async with async_session_maker() as db:
        user_ids = {str(i) for i in (await db.execute(select(User.id))).scalars()}
        post_ids = {str(i) for i in (await db.execute(select(Post.id))).scalars()}
    orphans = await upload_service.purge_orphaned_files(user_ids, post_ids, apply=apply)
    verb = "Deleted" if apply else "Would delete"
    for folder in orphans:
        print(f"{verb} {folder}")  # noqa: T201
    print(f"{verb} {len(orphans)} orphaned folder(s).")  # noqa: T201
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="delete the folders (default: dry run)")
    sys.exit(asyncio.run(main(parser.parse_args().apply)))
