"""Opt-in OIDC-protected, PostgreSQL-backed NIMIS Collect submission foundation.

This is NOT an approved Ministry deployment or complete mobile synchronization.
No demo JWTs, scheme creation, review decisions or attachments are accepted.
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import urlparse
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

router = APIRouter(prefix="/api/v1/secure", tags=["secure-sync-staging"])


class Operation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: UUID
    record_id: UUID
    user_id: UUID
    device_id: UUID
    scheme_id: str = Field(min_length=1, max_length=100)
    form_id: str = Field(min_length=1, max_length=100)
    form_version: int = Field(ge=1)
    local_sequence: int = Field(ge=1)
    captured_at: datetime
    action: str
    data: dict = Field(default_factory=dict)

    @field_validator("captured_at")
    @classmethod
    def timestamp_has_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("captured_at must contain a timezone")
        return value

    @field_validator("action")
    @classmethod
    def only_submit(cls, value: str) -> str:
        if value != "submit":
            raise ValueError("Only submit operations are supported in this foundation")
        return value


class PushBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: UUID
    operations: list[Operation] = Field(min_length=1, max_length=25)


def _config() -> tuple[str, str, str, str]:
    if os.getenv("NIMIS_SECURE_SYNC_ENABLED") != "1":
        raise HTTPException(404, detail="Secure sync not enabled")
    issuer = os.getenv("NIMIS_OIDC_ISSUER", "")
    audience = os.getenv("NIMIS_OIDC_AUDIENCE", "")
    jwks_url = os.getenv("NIMIS_OIDC_JWKS_URL", "")
    database_url = os.getenv("NIMIS_SECURE_SYNC_DATABASE_URL", "")
    if not all((issuer, audience, jwks_url, database_url)):
        raise HTTPException(503, detail="Secure sync configuration incomplete")
    if (urlparse(issuer).scheme != "https" or
            urlparse(jwks_url).scheme != "https" or
            urlparse(database_url).scheme not in ("postgresql", "postgres")):
        raise HTTPException(503, detail="Secure sync configuration requires approved secure URLs")
    return issuer, audience, jwks_url, database_url


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)


def _actor(authorization: str | None = Header(default=None)) -> UUID:
    issuer, audience, jwks_url, _ = _config()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Bearer token required")
    token = authorization[7:].strip()
    if not token or len(token) > 8192:
        raise HTTPException(401, detail="Invalid token")
    try:
        key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token, key.key, algorithms=["RS256"], issuer=issuer, audience=audience,
            options={"require": ["sub", "iss", "aud", "exp", "iat"]},
            leeway=30,
        )
        return UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, TypeError, KeyError) as error:
        raise HTTPException(401, detail="Invalid or expired identity") from error


def _fingerprint(operation: Operation) -> str:
    value = operation.model_dump(mode="json", exclude_none=True)
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _accept_one(url: str, actor: UUID, operation: Operation) -> dict:
    # Import on demand; the disabled endpoint never requires the driver.
    import psycopg

    result = {"event_id": str(operation.event_id)}
    fingerprint = _fingerprint(operation)
    payload = json.dumps(operation.data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    if len(payload.encode("utf-8")) > 65536:
        return {**result, "outcome": "rejected", "detail": "Survey payload exceeds 64 KB"}

    # One transaction per item: successful acknowledgements are durably committed
    # before the batch continues, and one conflict does not block other records.
    with psycopg.connect(url, connect_timeout=5) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT 1 FROM nimis_sync.enrolled_device
                   WHERE device_id=%s AND user_id=%s AND revoked_at IS NULL""",
                (operation.device_id, actor),
            )
            if cur.fetchone() is None:
                raise HTTPException(403, detail="Device not enrolled or revoked")
            # This VIEW is maintained by ICT and must use the canonical scheme master.
            # No browser-supplied geographic scope or role is ever trusted.
            cur.execute(
                """SELECT 1 FROM nimis_sync.current_actor_scope
                   WHERE user_id=%s AND scheme_id=%s
                     AND role='data_collector' AND active=true LIMIT 1""",
                (actor, operation.scheme_id),
            )
            if cur.fetchone() is None:
                return {**result, "outcome": "rejected", "detail": "Scheme is not assigned to collector"}
            cur.execute(
                """SELECT 1 FROM nimis_sync.approved_form
                   WHERE form_id=%s AND form_version=%s
                     AND approved_at IS NOT NULL AND withdrawn_at IS NULL""",
                (operation.form_id, operation.form_version),
            )
            if cur.fetchone() is None:
                return {**result, "outcome": "rejected", "detail": "Form version is not approved"}
            cur.execute(
                """INSERT INTO nimis_sync.operation
                   (event_id,record_id,user_id,device_id,local_sequence,scheme_id,
                    form_id,form_version,action,captured_at,payload,content_sha256)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s)
                   ON CONFLICT DO NOTHING RETURNING received_at""",
                (operation.event_id, operation.record_id, actor, operation.device_id,
                 operation.local_sequence, operation.scheme_id, operation.form_id,
                 operation.form_version, operation.action, operation.captured_at, payload,
                 fingerprint),
            )
            inserted = cur.fetchone()
            if inserted:
                return {**result, "outcome": "accepted", "received_at": inserted[0].isoformat()}
            cur.execute(
                """SELECT event_id,content_sha256 FROM nimis_sync.operation
                   WHERE event_id=%s OR (device_id=%s AND local_sequence=%s)""",
                (operation.event_id, operation.device_id, operation.local_sequence),
            )
            rows = cur.fetchall()
            if len(rows) == 1 and str(rows[0][0]) == str(operation.event_id) and rows[0][1] == fingerprint:
                return {**result, "outcome": "duplicate"}
            return {**result, "outcome": "conflict",
                    "detail": "Event ID or device sequence was previously used for different data"}


@router.post("/sync/push")
def secure_push(body: PushBatch, actor: UUID = Depends(_actor)):
    _, _, _, url = _config()
    if any(op.device_id != body.device_id or op.user_id != actor for op in body.operations):
        raise HTTPException(403, detail="Operation user or device mismatch")
    if len({op.event_id for op in body.operations}) != len(body.operations):
        raise HTTPException(422, detail="Duplicate event IDs within one batch")
    results = []
    try:
        for operation in body.operations:
            results.append(_accept_one(url, actor, operation))
    except HTTPException:
        raise
    except Exception:
        # Never return database internals or partial data. Already committed items
        # are safe to replay with their original event IDs.
        raise HTTPException(503, detail="Sync database or reference registry unavailable") from None
    return {"server_time": datetime.now(timezone.utc).isoformat(), "results": results}


@router.get("/district/inbox")
def secure_district_inbox(actor: UUID = Depends(_actor)):
    """Read-only preview of submitted records under the district officer's
    authoritative scheme assignments. No approval actions are enabled.
    """
    _, _, _, url = _config()
    try:
        import psycopg
        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT DISTINCT o.event_id, o.record_id, o.scheme_id, o.form_id,
                              o.form_version, o.captured_at, o.received_at
                       FROM nimis_sync.operation o
                       WHERE EXISTS (
                         SELECT 1 FROM nimis_sync.current_actor_scope s
                         WHERE s.user_id=%s AND s.scheme_id=o.scheme_id
                           AND s.role='district_officer' AND s.active=true
                       )
                       ORDER BY o.received_at DESC, o.event_id DESC LIMIT 100""",
                    (actor,),
                )
                rows = cur.fetchall()
    except Exception:
        raise HTTPException(503, detail="District review registry unavailable") from None
    # Metadata-only until official field-level privacy and review policy is approved.
    return {"source": "NIMIS_STAGING_SYNC", "items": [
        {"event_id": str(row[0]), "record_id": str(row[1]),
         "scheme_id": row[2], "form_id": row[3], "form_version": row[4],
         "captured_at": row[5].isoformat(), "received_at": row[6].isoformat()}
        for row in rows
    ]}
