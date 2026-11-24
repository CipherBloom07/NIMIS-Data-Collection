"""Disposable-PostgreSQL integration test for the secure staging sync adapter.

Runs ONLY against explicit local nimis_collect_dev with NIMIS_TEST_POSTGRES_URL.
All fabricated users, assignments and submissions are deleted afterwards.
Does not exercise real OIDC or approved institutional registry provisioning.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4
import os

import pytest
from fastapi.testclient import TestClient

from server.reference_app import app
from server import secure_sync, secure_review

psycopg = pytest.importorskip("psycopg")


def _local_test_url() -> str:
    url = os.environ.get("NIMIS_TEST_POSTGRES_URL", "")
    if not url:
        pytest.skip("No isolated PostgreSQL test database")
    parsed = urlparse(url)
    if (parsed.scheme not in ("postgresql", "postgres") or
            parsed.hostname not in ("localhost", "127.0.0.1") or
            parsed.path.strip("/") != "nimis_collect_dev"):
        pytest.fail("Refusing to test any non-local or non-dedicated PostgreSQL database")
    return url


def test_staging_secure_sync_idempotency_scope_and_revocation(monkeypatch):
    url = _local_test_url()
    # This disposable test creates the ICT-supplied view ONLY in the throwaway
    # CI database. The staging migration does not create any scope source.
    ddl = Path("server/postgres/005_secure_sync_foundation_REVIEW.sql").read_text(encoding="utf-8")
    review_ddl = Path("server/postgres/006_district_review_REVIEW.sql").read_text(encoding="utf-8")
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(ddl)
        conn.execute(review_ddl)
        conn.execute(
            """CREATE TABLE IF NOT EXISTS nimis_sync.test_actor_scope (
                 user_id uuid NOT NULL, scheme_id text NOT NULL, role text NOT NULL,
                 active boolean NOT NULL
               )"""
        )
        conn.execute(
            """CREATE OR REPLACE VIEW nimis_sync.current_actor_scope AS
               SELECT user_id, scheme_id, role, active FROM nimis_sync.test_actor_scope"""
        )

    collector, district, outsider, device = uuid4(), uuid4(), uuid4(), uuid4()
    scheme = "CI-SCHEME-" + uuid4().hex[:12]
    unassigned = "CI-OTHER-" + uuid4().hex[:12]
    form_id = "ci_form_" + uuid4().hex[:12]
    event_id, record_id = uuid4(), uuid4()
    now = datetime.now(timezone.utc).isoformat()

    def payload(*, event=event_id, sequence=1, scheme_id=scheme, form_version=1, amount=4.2):
        return {
            "event_id": str(event), "record_id": str(record_id),
            "user_id": str(collector), "device_id": str(device),
            "local_sequence": sequence, "scheme_id": scheme_id,
            "form_id": form_id, "form_version": form_version,
            "captured_at": now, "action": "submit",
            "data": {"functional_area_ha": amount},
        }

    def api_for(actor):
        original = app.dependency_overrides.copy()
        app.dependency_overrides[secure_sync._actor] = lambda: actor
        return original

    def isolated_configuration():
        return ("https://ci.example.invalid/", "test-api",
                "https://ci.example.invalid/jwks.json", url)
    monkeypatch.setattr(secure_sync, "_config", isolated_configuration)
    monkeypatch.setattr(secure_review, "_config", isolated_configuration)
    client = TestClient(app)

    try:
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO nimis_sync.enrolled_device(device_id,user_id)
                       VALUES (%s,%s)""", (device, collector),
                )
                cur.execute(
                    """INSERT INTO nimis_sync.approved_form(form_id,form_version,approved_at)
                       VALUES (%s,1,now())""", (form_id,),
                )
                cur.executemany(
                    """INSERT INTO nimis_sync.test_actor_scope(user_id,scheme_id,role,active)
                       VALUES (%s,%s,%s,true)""",
                    [(collector, scheme, "data_collector"),
                     (district, scheme, "district_officer")],
                )

        original = api_for(collector)
        try:
            def submit(row):
                return client.post("/api/v1/secure/sync/push", json={
                    "device_id": str(device), "operations": [row]})

            first = submit(payload())
            assert first.status_code == 200, first.text
            assert first.json()["results"][0]["outcome"] == "accepted"
            assert first.json()["results"][0]["received_at"]

            repeated = submit(payload())
            assert repeated.status_code == 200, repeated.text
            assert repeated.json()["results"][0]["outcome"] == "duplicate"

            changed_payload = submit(payload(amount=7.9))
            assert changed_payload.status_code == 200, changed_payload.text
            assert changed_payload.json()["results"][0]["outcome"] == "conflict"

            reused_sequence = submit(payload(event=uuid4()))
            assert reused_sequence.status_code == 200, reused_sequence.text
            assert reused_sequence.json()["results"][0]["outcome"] == "conflict"

            not_assigned = submit(payload(event=uuid4(), sequence=2, scheme_id=unassigned))
            assert not_assigned.status_code == 200, not_assigned.text
            assert not_assigned.json()["results"][0]["outcome"] == "rejected"

            no_form = submit(payload(event=uuid4(), sequence=3, form_version=999))
            assert no_form.status_code == 200, no_form.text
            assert no_form.json()["results"][0]["outcome"] == "rejected"

            with psycopg.connect(url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT count(*) FROM nimis_sync.operation
                           WHERE event_id=%s""", (event_id,),
                    )
                    assert cur.fetchone()[0] == 1
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(original)

        original = api_for(district)
        try:
            inbox = client.get("/api/v1/secure/district/inbox")
            assert inbox.status_code == 200, inbox.text
            assert [i["event_id"] for i in inbox.json()["items"]
                    if i["event_id"] == str(event_id)] == [str(event_id)]
            decision_id = uuid4()
            endpoint = f"/api/v1/secure/district/submissions/{event_id}/decisions"
            approved = client.post(endpoint, json={
                "decision_id": str(decision_id), "action": "VERIFY", "reason": ""})
            assert approved.status_code == 200, approved.text
            assert approved.json()["status"] == "VERIFIED"
            duplicate_decision = client.post(endpoint, json={
                "decision_id": str(decision_id), "action": "VERIFY", "reason": ""})
            assert duplicate_decision.status_code == 200, duplicate_decision.text
            assert duplicate_decision.json()["outcome"] == "duplicate"
            forbidden_second_decision = client.post(endpoint, json={
                "decision_id": str(uuid4()), "action": "RETURN", "reason": "late review"})
            assert forbidden_second_decision.status_code == 409
            inbox_after = client.get("/api/v1/secure/district/inbox")
            assert next(i for i in inbox_after.json()["items"]
                        if i["event_id"] == str(event_id))["status"] == "VERIFIED"
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(original)

        original = api_for(outsider)
        try:
            empty = client.get("/api/v1/secure/district/inbox")
            assert empty.status_code == 200, empty.text
            assert not any(i["event_id"] == str(event_id) for i in empty.json()["items"])
            forbidden = client.post(
                f"/api/v1/secure/district/submissions/{event_id}/decisions",
                json={"decision_id": str(uuid4()), "action": "VERIFY"})
            assert forbidden.status_code == 403
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(original)

        # Simultaneous retry requests must collapse to one immutable server row.
        # This uses the same canonical event UUID and device-wide sequence.
        from concurrent.futures import ThreadPoolExecutor
        concurrent_event = uuid4()
        identical = secure_sync.Operation.model_validate(
            payload(event=concurrent_event, sequence=5))
        with ThreadPoolExecutor(max_workers=6) as pool:
            outcomes = list(pool.map(
                lambda _: secure_sync._accept_one(url, collector, identical)["outcome"],
                range(6),
            ))
        assert outcomes.count("accepted") == 1
        assert outcomes.count("duplicate") == 5

        # Two authorized reviewers racing the same record must not both succeed.
        from server.secure_review import DistrictDecision, decide_district
        from fastapi import HTTPException
        competing = [
            DistrictDecision(decision_id=uuid4(), action="VERIFY"),
            DistrictDecision(decision_id=uuid4(), action="RETURN",
                             reason="Incomplete irrigation inspection"),
        ]
        def race(decision):
            try:
                return decide_district(concurrent_event, decision, actor=district)["outcome"]
            except HTTPException as error:
                return error.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            review_results = list(pool.map(race, competing))
        assert review_results.count("accepted") == 1
        assert review_results.count(409) == 1

        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT count(*) FROM nimis_sync.review_decision
                       WHERE event_id=%s""", (concurrent_event,))
                assert cur.fetchone()[0] == 1

        with psycopg.connect(url) as conn:
            conn.execute(
                """UPDATE nimis_sync.enrolled_device SET revoked_at=now()
                   WHERE device_id=%s""", (device,),
            )
        original = api_for(collector)
        try:
            revoked = client.post("/api/v1/secure/sync/push", json={
                "device_id": str(device),
                "operations": [payload(event=uuid4(), sequence=4)],
            })
            assert revoked.status_code == 403, revoked.text
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(original)
    finally:
        app.dependency_overrides.clear()
        # Test data only. Keep schema for the remaining isolated tests.
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """DELETE FROM nimis_sync.review_decision
                       WHERE event_id IN (SELECT event_id FROM nimis_sync.operation WHERE device_id=%s)""",
                    (device,),
                )
                cur.execute(
                    """DELETE FROM nimis_sync.review_state
                       WHERE event_id IN (SELECT event_id FROM nimis_sync.operation WHERE device_id=%s)""",
                    (device,),
                )
                cur.execute("DELETE FROM nimis_sync.operation WHERE device_id=%s", (device,))
                cur.execute("DELETE FROM nimis_sync.test_actor_scope WHERE user_id=ANY(%s)",
                            ([collector, district, outsider],))
                cur.execute("DELETE FROM nimis_sync.approved_form WHERE form_id=%s", (form_id,))
                cur.execute("DELETE FROM nimis_sync.enrolled_device WHERE device_id=%s", (device,))
