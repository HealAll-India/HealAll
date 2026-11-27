"""Unit tests for deleting a member's uploads (no S3 needed)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.services import upload_service


class _FakeS3:
    def __init__(self, objects: dict[str, list[str]], errors: int = 0, recent: tuple[str, ...] = ()):
        self.objects = objects  # prefix -> keys
        self.errors = errors
        self.recent = recent  # keys written just now; the rest are a day old
        self.deleted: list[str] = []

    def _modified(self, key: str) -> datetime:
        return datetime.now(UTC) - (timedelta(seconds=5) if key in self.recent else timedelta(days=1))

    def get_paginator(self, _name):
        fake = self

        class _Paginator:
            def paginate(self, Bucket, Prefix, Delimiter=None):  # noqa: N803, ARG002
                keys = [k for p, ks in fake.objects.items() if p.startswith(Prefix) for k in ks]
                if Delimiter:
                    folders = sorted({Prefix + k[len(Prefix) :].split("/")[0] + "/" for k in keys})
                    return [{"CommonPrefixes": [{"Prefix": f} for f in folders]}]
                return [{"Contents": [{"Key": k, "LastModified": fake._modified(k)} for k in keys]}]

        return _Paginator()

    def delete_objects(self, Bucket, Delete):  # noqa: N803, ARG002
        keys = [o["Key"] for o in Delete["Objects"]]
        failed = keys[: self.errors]
        self.deleted += keys[self.errors :]
        return {"Errors": [{"Key": k, "Code": "AccessDenied"} for k in failed]}


def test_delete_prefix_raises_on_partial_failure(monkeypatch: pytest.MonkeyPatch):
    s3 = _FakeS3({"profile-photos/u1/": ["profile-photos/u1/a.jpg", "profile-photos/u1/b.jpg"]}, errors=1)
    monkeypatch.setattr(upload_service, "_s3_client", lambda: s3)
    with pytest.raises(RuntimeError, match="1 of 2"):
        upload_service._delete_prefix("media", "profile-photos/u1/")
    assert s3.deleted == ["profile-photos/u1/b.jpg"]


def test_delete_prefix_counts_deleted(monkeypatch: pytest.MonkeyPatch):
    s3 = _FakeS3({"identity/u1/": ["identity/u1/a.pdf"]})
    monkeypatch.setattr(upload_service, "_s3_client", lambda: s3)
    assert upload_service._delete_prefix("identity", "identity/u1/") == 1


def _exists(alive: set[str]):
    async def existing_ids(_owner: str, ids: list[str]) -> set[str]:
        return {i for i in ids if i in alive}

    return existing_ids


@pytest.mark.asyncio
async def test_purge_orphaned_files_only_touches_missing_owners(monkeypatch: pytest.MonkeyPatch):
    s3 = _FakeS3(
        {
            "profile-photos/alive/": ["profile-photos/alive/a.jpg"],
            "profile-photos/gone/": ["profile-photos/gone/a.jpg"],
            "post-attachments/p-alive/": ["post-attachments/p-alive/x.jpg"],
            "post-attachments/p-gone/": ["post-attachments/p-gone/x.jpg"],
        }
    )
    monkeypatch.setattr(upload_service, "_s3_client", lambda: s3)
    alive = _exists({"alive", "p-alive"})

    dry, failed = await upload_service.purge_orphaned_files(alive, apply=False)
    assert sorted(f.split("/", 1)[1] for f in dry) == ["post-attachments/p-gone/", "profile-photos/gone/"]
    assert failed == []
    assert s3.deleted == []

    await upload_service.purge_orphaned_files(alive, apply=True)
    assert sorted(s3.deleted) == ["post-attachments/p-gone/x.jpg", "profile-photos/gone/a.jpg"]


@pytest.mark.asyncio
async def test_purge_orphaned_files_reads_owners_after_listing(monkeypatch: pytest.MonkeyPatch):
    """A member who signs up while the sweep lists storage keeps their files."""
    s3 = _FakeS3({"profile-photos/new/": ["profile-photos/new/a.jpg"]})
    monkeypatch.setattr(upload_service, "_s3_client", lambda: s3)
    asked: list[list[str]] = []

    async def existing_ids(_owner: str, ids: list[str]) -> set[str]:
        asked.append(ids)
        return {"new"}  # the row exists by the time the database is read

    orphans, _ = await upload_service.purge_orphaned_files(existing_ids, apply=True)
    assert ["new"] in asked
    assert orphans == []
    assert s3.deleted == []


@pytest.mark.asyncio
async def test_purge_orphaned_files_skips_recent_uploads(monkeypatch: pytest.MonkeyPatch):
    s3 = _FakeS3({"profile-photos/gone/": ["profile-photos/gone/a.jpg"]}, recent=("profile-photos/gone/a.jpg",))
    monkeypatch.setattr(upload_service, "_s3_client", lambda: s3)
    orphans, _ = await upload_service.purge_orphaned_files(_exists(set()), apply=True)
    assert orphans == []
    assert s3.deleted == []


@pytest.mark.asyncio
async def test_purge_orphaned_files_reports_failures(monkeypatch: pytest.MonkeyPatch):
    s3 = _FakeS3({"identity/gone/": ["identity/gone/a.pdf"]}, errors=1)
    monkeypatch.setattr(upload_service, "_s3_client", lambda: s3)
    orphans, failed = await upload_service.purge_orphaned_files(_exists(set()), apply=True)
    assert len(orphans) == 1
    assert failed == orphans
