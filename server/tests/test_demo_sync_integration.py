"""End-to-end fictional collector -> district inbox test with real PostgreSQL.
CI only: NIMIS_TEST_POSTGRES_URL points to the isolated nimis_collect_dev database.
"""
from pathlib import Path
from uuid import uuid4
import os

import pytest

psycopg = pytest.importorskip("psycopg")


def test_collector_submission_and_district_decision(monkeypatch):
    url = os.environ.get("NIMIS_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("No isolated PostgreSQL test database")
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.path.strip("/") != "nimis_collect_dev" or parsed.hostname not in ("127.0.0.1", "localhost"):
        pytest.fail("Refusing to run against a non-local development database")
    with psycopg.connect(url, autocommit=True) as conn:
        with conn.cursor() as cur:
            # Reference fixture may already exist: migration is idempotent.
            cur.execute(Path("server/postgres/001_dev_reference.sql").read_text(encoding="utf-8"))
            cur.execute(Path("server/postgres/003_fictional_sync.sql").read_text(encoding="utf-8"))

    monkeypatch.setenv("NIMIS_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_POSTGRES_DEMO_MODE", "1")
    monkeypatch.setenv("NIMIS_COLLECT_DATABASE_URL", url)
    monkeypatch.setenv("NIMIS_COLLECT_SYNC_DATABASE_URL", url)
    monkeypatch.setenv("NIMIS_DEV_JWT_SECRET", "fictional-test-jwt-signing-secret-minimum-32-bytes")
    from fastapi.testclient import TestClient
    from server.reference_app import app

    client = TestClient(app)
    def jwt_for(username: str):
        r = client.post("/api/v1/dev/token", json={"username": username})
        assert r.status_code == 200, r.text
        return {"Authorization": "Bearer " + r.json()["access_token"]}

    collector = jwt_for("officer.demo")
    district = jwt_for("district.demo")
    provincial = jwt_for("provincial.demo")
    admin = jwt_for("admin.demo")
    event_id = str(uuid4())
    body = {"event_id": event_id, "scheme_id": "DEMO-SCHEME-001",
            "form_id": "scheme_baseline", "note": "Fictional canal inspection, no real observations"}
    try:
        assert client.get("/api/v1/dev/integration/district-inbox", headers=collector).status_code == 403
        assert client.post("/api/v1/dev/integration/submit", json=body, headers=district).status_code == 403
        sent = client.post("/api/v1/dev/integration/submit", json=body, headers=collector)
        assert sent.status_code == 200, sent.text
        assert sent.json()["outcome"] == "accepted"
        duplicate = client.post("/api/v1/dev/integration/submit", json=body, headers=collector)
        assert duplicate.status_code == 200
        assert duplicate.json()["outcome"] == "duplicate"
        altered = client.post("/api/v1/dev/integration/submit",
                              json={**body, "note": "different payload"}, headers=collector)
        assert altered.status_code == 409

        inbox = client.get("/api/v1/dev/integration/district-inbox", headers=district)
        assert inbox.status_code == 200, inbox.text
        assert inbox.json()["source"] == "FICTIONAL_LOCAL_DEMO"
        assert next(row for row in inbox.json()["items"] if row["event_id"] == event_id)["status"] == "SUBMITTED"

        invalid_return = client.post(f"/api/v1/dev/integration/district-inbox/{event_id}/decision",
                                     json={"action": "RETURN", "reason": ""}, headers=district)
        assert invalid_return.status_code == 422
        decision = client.post(f"/api/v1/dev/integration/district-inbox/{event_id}/decision",
                               json={"action": "VERIFY"}, headers=district)
        assert decision.status_code == 200, decision.text
        assert decision.json()["status"] == "VERIFIED"
        assert client.post(f"/api/v1/dev/integration/district-inbox/{event_id}/decision",
                           json={"action": "RETURN", "reason": "again"}, headers=district).status_code == 409
        assert client.get("/api/v1/dev/integration/provincial-inbox", headers=collector).status_code == 403
        province_page = client.get("/api/v1/dev/integration/provincial-inbox", headers=provincial)
        assert province_page.status_code == 200, province_page.text
        assert next(row for row in province_page.json()["items"] if row["event_id"] == event_id)["status"] == "VERIFIED"
        assert client.post(f"/api/v1/dev/integration/provincial-inbox/{event_id}/decision",
                           json={"action": "PUBLISH"}, headers=provincial).status_code == 422
        province_review = client.post(f"/api/v1/dev/integration/provincial-inbox/{event_id}/decision",
                                      json={"action": "REVIEW"}, headers=provincial)
        assert province_review.status_code == 200, province_review.text
        assert province_review.json()["status"] == "REVIEWED"
        assert client.get("/api/v1/dev/integration/admin-inbox", headers=provincial).status_code == 403
        admin_page = client.get("/api/v1/dev/integration/admin-inbox", headers=admin)
        assert admin_page.status_code == 200
        assert next(row for row in admin_page.json()["items"] if row["event_id"] == event_id)["status"] == "REVIEWED"
        publication = client.post(f"/api/v1/dev/integration/admin-inbox/{event_id}/decision",
                                  json={"action": "PUBLISH"}, headers=admin)
        assert publication.status_code == 200, publication.text
        assert publication.json()["status"] == "PUBLISHED"
        assert publication.json()["publication"] == "demo_only"
        assert client.post(f"/api/v1/dev/integration/admin-inbox/{event_id}/decision",
                           json={"action": "PUBLISH"}, headers=admin).status_code == 409
        with psycopg.connect(url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT action FROM nimis_collect_demo.demo_decision WHERE event_id=%s ORDER BY decided_at",
                    (event_id,),
                )
                assert [row[0] for row in cursor.fetchall()] == ["VERIFY", "REVIEW", "PUBLISH"]
    finally:
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                # Remove only this test's synthetic event, never another submission.
                cur.execute("DELETE FROM nimis_collect_demo.demo_decision WHERE event_id=%s", (event_id,))
                cur.execute("DELETE FROM nimis_collect_demo.field_submission WHERE event_id=%s", (event_id,))


def test_fictional_submission_endpoints_disabled_by_default(monkeypatch):
    monkeypatch.delenv("NIMIS_DEMO_MODE", raising=False)
    monkeypatch.delenv("NIMIS_COLLECT_SYNC_DATABASE_URL", raising=False)
    from fastapi.testclient import TestClient
    from server.reference_app import app
    client = TestClient(app)
    response = client.get("/api/v1/dev/integration/district-inbox")
    assert response.status_code == 401
