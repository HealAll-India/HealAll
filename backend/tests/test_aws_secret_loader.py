"""APP_SECRETS_ARN: settings come from one Secrets Manager secret on Lambda."""

import json

import pytest

from app.core import config


class _FakeSecrets:
    def __init__(self, value):
        self.value = value
        self.calls = []

    def get_secret_value(self, SecretId):  # noqa: N803 - boto3's argument name
        self.calls.append(SecretId)
        return {"SecretString": self.value}


@pytest.fixture
def fake_boto3(monkeypatch):
    holder = {}

    def client(service, region_name=None):
        assert service == "secretsmanager"
        return holder["client"]

    import boto3

    monkeypatch.setattr(boto3, "client", client)
    return holder


def test_does_nothing_without_arn(monkeypatch, fake_boto3):
    monkeypatch.delenv("APP_SECRETS_ARN", raising=False)
    fake_boto3["client"] = None  # would fail if called
    config.load_aws_secret_into_env()


def test_fills_missing_settings_and_keeps_existing(monkeypatch, fake_boto3):
    monkeypatch.setenv("APP_SECRETS_ARN", "arn:aws:secretsmanager:ap-south-1:1:secret:healall")
    monkeypatch.setenv("JWT_SECRET_KEY", "from-env")
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    fake = _FakeSecrets(json.dumps({"RESEND_API_KEY": "re_123", "JWT_SECRET_KEY": "from-secret", "GROQ_API_KEY": ""}))
    fake_boto3["client"] = fake

    config.load_aws_secret_into_env()

    import os

    assert fake.calls == ["arn:aws:secretsmanager:ap-south-1:1:secret:healall"]
    assert os.environ["RESEND_API_KEY"] == "re_123"
    assert os.environ["JWT_SECRET_KEY"] == "from-env"
    assert "GROQ_API_KEY" not in os.environ
    monkeypatch.delenv("RESEND_API_KEY")


def test_rejects_a_non_object_secret(monkeypatch, fake_boto3):
    monkeypatch.setenv("APP_SECRETS_ARN", "healall")
    fake_boto3["client"] = _FakeSecrets(json.dumps(["not", "an", "object"]))
    with pytest.raises(ValueError):
        config.load_aws_secret_into_env()


def test_s3_client_uses_role_when_keys_are_empty(monkeypatch):
    from app.services import upload_service

    seen = {}

    def client(service, **kwargs):
        seen.update(kwargs)
        return object()

    monkeypatch.setattr(upload_service.settings, "S3_ACCESS_KEY", "")
    monkeypatch.setattr(upload_service.settings, "S3_SECRET_KEY", "")
    monkeypatch.setattr(upload_service.boto3, "client", client)
    upload_service._s3_client()
    assert seen["aws_access_key_id"] is None
    assert seen["aws_secret_access_key"] is None
