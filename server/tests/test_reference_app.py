"""Development reference-server tests. Run from repo root: python -m pytest server/tests -q"""
import os

import pytest
from fastapi.testclient import TestClient

from server.reference_app import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def demo_configuration(monkeypatch):
    monkeypatch.setenv("NIMIS_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_DEV_JWT_SECRET", "nonproduction-test-secret-of-at-least-32-characters")

def token():
    response = client.post("/api/v1/dev/token", json={"username": "officer.demo"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

def test_health_and_no_unauthenticated_reference_access():
    assert client.get("/api/v1/health").status_code == 200
    for path in ("/api/v1/me", "/api/v1/reference", "/api/v1/forms", "/api/v1/schemes"):
        assert client.get(path).status_code == 401

def test_individual_identity_and_geographic_scope():
    auth = {"Authorization": f"Bearer {token()}"}
    user = client.get("/api/v1/me", headers=auth)
    assert user.status_code == 200
    assert user.json()["role"] == "field_officer"
    assert user.json()["district_ids"] == ["DEMO-DISTRICT"]
    assert user.headers["cache-control"] == "no-store"
    schemes = client.get("/api/v1/schemes", headers=auth)
    assert schemes.status_code == 200
    assert len(schemes.json()["items"]) == 1
    assert schemes.json()["items"][0]["is_fictional"]

def test_reference_forms_and_locked_writes():
    auth = {"Authorization": f"Bearer {token()}"}
    assert client.get("/api/v1/reference", headers=auth).json()["source"] == "FICTIONAL_DEVELOPMENT_DATA"
    forms = client.get("/api/v1/forms", headers=auth)
    assert forms.status_code == 200
    assert len(forms.json()["definitions"]) == 11
    assert client.post("/api/v1/sync/push", headers=auth, json={}).status_code == 501

def test_test_tokens_disabled_by_default(monkeypatch):
    monkeypatch.delenv("NIMIS_DEMO_MODE", raising=False)
    assert client.post("/api/v1/dev/token", json={"username": "officer.demo"}).status_code == 404
    assert client.get("/api/v1/schemes", headers={"Authorization": "Bearer " + token_value()}).status_code in (401, 403)

def token_value():
    # Invalid token for negative coverage.
    return "not-a-jwt"

def test_role_is_loaded_server_side_not_from_token_claim():
    import jwt
    from server.reference_app import DEMO_USER_ID, ISSUER, AUDIENCE
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    claims = {
        "sub": DEMO_USER_ID, "iss": ISSUER, "aud": AUDIENCE,
        "iat": now, "exp": now + timedelta(minutes=2),
        "role": "administrator",
        "province_ids": ["ALL"],
        "scheme_ids": ["NOT-ASSIGNED"],
    }
    forged_roles = jwt.encode(
        claims, os.environ["NIMIS_DEV_JWT_SECRET"], algorithm="HS256",
    )
    response = client.get(
        "/api/v1/me", headers={"Authorization": "Bearer " + forged_roles},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "field_officer"
    assert response.json()["scheme_ids"] == ["DEMO-SCHEME-001"]


def test_wrong_audience_and_expired_token_rejected():
    import jwt
    from server.reference_app import DEMO_USER_ID, ISSUER
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    for claims in (
        {"sub": DEMO_USER_ID, "iss": ISSUER, "aud": "wrong-audience", "iat": now, "exp": now + timedelta(minutes=2)},
        {"sub": DEMO_USER_ID, "iss": ISSUER, "aud": "nimis-collect-reference-client", "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
    ):
        fake = jwt.encode(claims, os.environ["NIMIS_DEV_JWT_SECRET"], algorithm="HS256")
        assert client.get("/api/v1/me", headers={"Authorization": "Bearer " + fake}).status_code == 401


def test_postgres_scope_uses_server_side_assignments(monkeypatch):
    from server import postgres_reference
    from server.reference_app import DEMO_USER_ID
    monkeypatch.setenv("NIMIS_POSTGRES_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_COLLECT_DATABASE_URL", "postgresql://never-use-real-credentials")
    monkeypatch.setattr(postgres_reference, "get_actor", lambda user_id: {
        "user_id": user_id, "role": "field_officer",
        "province_ids": ["DEMO-PROVINCE"], "district_ids": ["DEMO-DISTRICT"],
        "scheme_ids": ["DEMO-SCHEME-001"],
    })
    monkeypatch.setattr(postgres_reference, "get_schemes", lambda user_id: [{
        "scheme_id": "DEMO-SCHEME-001", "name": "DB fictional scheme",
        "district_code": "DEMO-DISTRICT", "province_code": "DEMO-PROVINCE",
        "master_version": 2, "is_fictional": True,
    }] if user_id == DEMO_USER_ID else [])
    auth = {"Authorization": f"Bearer {token()}"}
    assert client.get("/api/v1/health").json()["reference_source"] == "postgresql_demo"
    actor = client.get("/api/v1/me", headers=auth)
    assert actor.status_code == 200
    assert actor.json()["scheme_ids"] == ["DEMO-SCHEME-001"]
    response = client.get("/api/v1/schemes", headers=auth)
    assert response.status_code == 200
    assert response.json()["items"][0]["name"] == "DB fictional scheme"


def test_postgres_unavailable_fails_closed(monkeypatch):
    from server import postgres_reference
    monkeypatch.setenv("NIMIS_POSTGRES_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_COLLECT_DATABASE_URL", "postgresql://invalid")
    def fail(_user):
        raise postgres_reference.DatabaseUnavailable("connection unavailable")
    monkeypatch.setattr(postgres_reference, "get_actor", fail)
    auth = {"Authorization": f"Bearer {token()}"}
    assert client.get("/api/v1/me", headers=auth).status_code == 503
    assert client.get("/api/v1/schemes", headers=auth).status_code == 503


def test_sql_is_parameterized_and_demo_records_not_production():
    from pathlib import Path
    sql = Path("server/postgres/001_dev_reference.sql").read_text(encoding="utf-8")
    adapter = Path("server/postgres_reference.py").read_text(encoding="utf-8")
    assert "nimis_collect_demo" in sql
    assert "CHECK (is_fictional)" in sql
    assert "ON CONFLICT" in sql
    assert "WHERE a.officer_id = %s" in adapter
    assert "cursor.execute(" in adapter
