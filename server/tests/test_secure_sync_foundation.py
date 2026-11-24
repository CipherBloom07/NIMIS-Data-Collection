"""Isolated secure-sync behavior tests. No live identity or real Ministry DB used."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from server.reference_app import app
from server import secure_sync


def operation(**overrides):
    row = {
        "event_id": str(uuid4()), "record_id": str(uuid4()),
        "user_id": str(uuid4()), "device_id": str(uuid4()),
        "scheme_id": "AUTHORITATIVE-SCHEME-ID", "form_id": "scheme_baseline",
        "form_version": 1, "local_sequence": 1,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "action": "submit", "data": {"equipped_area_ha": 4.2},
    }
    row.update(overrides)
    return row


def test_endpoint_closed_by_default(monkeypatch):
    monkeypatch.delenv("NIMIS_SECURE_SYNC_ENABLED", raising=False)
    response = TestClient(app).post("/api/v1/secure/sync/push", json={
        "device_id": str(uuid4()), "operations": []})
    assert response.status_code == 404


def test_requires_all_oidc_and_database_settings(monkeypatch):
    monkeypatch.setenv("NIMIS_SECURE_SYNC_ENABLED", "1")
    for key in ("NIMIS_OIDC_ISSUER", "NIMIS_OIDC_AUDIENCE",
                "NIMIS_OIDC_JWKS_URL", "NIMIS_SECURE_SYNC_DATABASE_URL"):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(Exception) as error:
        secure_sync._config()
    assert getattr(error.value, "status_code", None) == 503


def test_fingerprint_stable_across_json_order():
    base = operation()
    one = secure_sync.Operation.model_validate(base)
    two = secure_sync.Operation.model_validate({**base, "data": {"equipped_area_ha": 4.2}})
    assert secure_sync._fingerprint(one) == secure_sync._fingerprint(two)
    assert secure_sync._fingerprint(one) != secure_sync._fingerprint(
        secure_sync.Operation.model_validate({**base, "data": {"equipped_area_ha": 5.0}}))


def test_submit_only_and_timezone_enforced():
    with pytest.raises(ValidationError):
        secure_sync.Operation.model_validate(operation(action="verify"))
    with pytest.raises(ValidationError):
        secure_sync.Operation.model_validate(operation(captured_at="2026-11-24T12:30:00"))


def test_user_and_device_binding_precedes_database(monkeypatch):
    actor_id, device_id = uuid4(), uuid4()
    monkeypatch.setattr(secure_sync, "_config",
                        lambda: ("https://idp.invalid/", "api", "https://idp.invalid/jwks", "postgresql://not-connected"))
    original = app.dependency_overrides.copy()
    app.dependency_overrides[secure_sync._actor] = lambda: actor_id
    def never_call_database(*args, **kwargs):
        raise AssertionError("Storage must not be contacted")
    monkeypatch.setattr(secure_sync, "_accept_one", never_call_database)
    try:
        row = operation(user_id=str(uuid4()), device_id=str(device_id))
        result = TestClient(app).post("/api/v1/secure/sync/push", json={
            "device_id": str(device_id), "operations": [row]})
        assert result.status_code == 403
        row["user_id"] = str(actor_id)
        result = TestClient(app).post("/api/v1/secure/sync/push", json={
            "device_id": str(uuid4()), "operations": [row]})
        assert result.status_code == 403
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)


def test_duplicate_event_ids_inside_batch_rejected(monkeypatch):
    actor_id, device_id = uuid4(), uuid4()
    monkeypatch.setattr(secure_sync, "_config",
                        lambda: ("https://idp.invalid/", "api", "https://idp.invalid/jwks", "postgresql://not-connected"))
    original = app.dependency_overrides.copy()
    app.dependency_overrides[secure_sync._actor] = lambda: actor_id
    monkeypatch.setattr(secure_sync, "_accept_one",
                        lambda *args: (_ for _ in ()).throw(AssertionError("Must reject duplicate event IDs")))
    try:
        row = operation(user_id=str(actor_id), device_id=str(device_id))
        response = TestClient(app).post("/api/v1/secure/sync/push", json={
            "device_id": str(device_id), "operations": [row, row]})
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
