"""Strictly fictional, local-only Collector -> District Officer integration.

No real NIMIS records are accepted. No photos, PII, production credentials,
remote connections or anonymous writes. Production sync remains disabled.
"""
from __future__ import annotations

import os
from uuid import UUID
from urllib.parse import urlparse
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from server.reference_app import Actor, current_actor, _demo_enabled, _loopback

router = APIRouter(prefix="/api/v1/dev/integration", tags=["fictional-integration"])
DEMO_SCHEME = "DEMO-SCHEME-001"
DEMO_DISTRICT = "DEMO-DISTRICT"
DEMO_COLLECTOR = "10000000-0000-4000-8000-000000000001"
DEMO_DISTRICT_USER = "10000000-0000-4000-8000-000000000002"


def enabled(request: Request) -> None:
    if not (_demo_enabled() and _loopback(request)
            and os.getenv("NIMIS_POSTGRES_DEMO_MODE") == "1"
            and os.getenv("NIMIS_COLLECT_SYNC_DATABASE_URL")):
        raise HTTPException(404, detail="Fictional local integration unavailable")


def connection():
    database_url = os.environ.get("NIMIS_COLLECT_SYNC_DATABASE_URL", "")
    location = urlparse(database_url)
    if (location.hostname not in ("localhost", "127.0.0.1")
            or location.path.strip("/") != "nimis_collect_dev"
            or location.scheme not in ("postgresql", "postgres")):
        raise HTTPException(503, detail="Integration requires isolated local fictional database")
    try:
        import psycopg
        return psycopg.connect(database_url, connect_timeout=5)
    except Exception:
        raise HTTPException(503, detail="Fictional PostgreSQL integration unavailable") from None


class DemoSubmission(BaseModel):
    event_id: UUID
    scheme_id: str
    form_id: str = "scheme_baseline"
    note: str = Field(min_length=1, max_length=200)


class DemoDecision(BaseModel):
    action: str
    reason: str = Field(default="", max_length=200)


@router.post("/submit")
def submit(body: DemoSubmission, request: Request, actor: Actor = Depends(current_actor)):
    enabled(request)
    if actor.user_id != DEMO_COLLECTOR or actor.role != "field_officer":
        raise HTTPException(403, detail="Collector role required")
    if body.scheme_id != DEMO_SCHEME or body.form_id != "scheme_baseline":
        raise HTTPException(422, detail="Only the fictional assigned scheme is supported")
    if DEMO_SCHEME not in actor.scheme_ids or DEMO_DISTRICT not in actor.district_ids:
        raise HTTPException(403, detail="Collector assignment is not active")
    # Never allow a generic survey payload or personally identifying fields.
    payload: dict[str, Any] = {"scheme_name": "Example Scheme (fictional)", "note": body.note}
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO nimis_collect_demo.field_submission
                      (event_id, scheme_id, collector_user_id, district_code, province_code, form_id, payload)
                    SELECT %s,s.scheme_id,%s,s.district_code,s.province_code,%s,%s::jsonb
                    FROM nimis_collect_demo.scheme s
                    JOIN nimis_collect_demo.assignment a ON a.scheme_id=s.scheme_id
                    WHERE s.scheme_id=%s AND s.is_fictional=true
                      AND a.officer_id=%s AND a.revoked_at IS NULL
                    ON CONFLICT (event_id) DO NOTHING
                    RETURNING event_id""",
                (body.event_id, actor.user_id, body.form_id,
                 __import__("json").dumps(payload), body.scheme_id, actor.user_id),
            )
            inserted = cur.fetchone() is not None
            cur.execute(
                """SELECT scheme_id,collector_user_id,form_id,payload
                     FROM nimis_collect_demo.field_submission WHERE event_id=%s""",
                (body.event_id,),
            )
            existing = cur.fetchone()
            if existing is None:
                raise HTTPException(403, detail="Assigned fictional scheme not available")
            if (existing[0] != body.scheme_id or str(existing[1]) != actor.user_id
                    or existing[2] != body.form_id or existing[3] != payload):
                raise HTTPException(409, detail="Event ID already used for different data")
    return {"event_id": str(body.event_id), "outcome": "accepted" if inserted else "duplicate",
            "note": "Fictional server record only. Real NIMIS sync is not active."}


@router.get("/district-inbox")
def district_inbox(request: Request, actor: Actor = Depends(current_actor)):
    enabled(request)
    if actor.user_id != DEMO_DISTRICT_USER or actor.role != "district_officer" or DEMO_DISTRICT not in actor.district_ids:
        raise HTTPException(403, detail="District Officer scope required")
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT event_id,scheme_id,district_code,payload,status,submitted_at,reviewed_at,review_note
                   FROM nimis_collect_demo.field_submission
                   WHERE district_code=%s ORDER BY submitted_at DESC,event_id DESC LIMIT 100""",
                (DEMO_DISTRICT,),
            )
            records = cur.fetchall()
    return {"source": "FICTIONAL_LOCAL_DEMO", "district": DEMO_DISTRICT, "items": [
        {"event_id": str(r[0]), "scheme_id": r[1], "district_code": r[2],
         "scheme_name": r[3].get("scheme_name"), "note": r[3].get("note"),
         "status": r[4], "submitted_at": r[5].isoformat(),
         "reviewed_at": r[6].isoformat() if r[6] else None, "review_note": r[7]}
        for r in records
    ]}


@router.post("/district-inbox/{event_id}/decision")
def decide(event_id: UUID, body: DemoDecision, request: Request, actor: Actor = Depends(current_actor)):
    enabled(request)
    if actor.user_id != DEMO_DISTRICT_USER or actor.role != "district_officer" or DEMO_DISTRICT not in actor.district_ids:
        raise HTTPException(403, detail="District Officer scope required")
    if body.action not in {"VERIFY", "RETURN"}:
        raise HTTPException(422, detail="Choose VERIFY or RETURN")
    if body.action == "RETURN" and not body.reason.strip():
        raise HTTPException(422, detail="A return reason is required")
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE nimis_collect_demo.field_submission
                   SET status=%s, reviewed_at=now(), reviewed_by=%s, review_note=%s
                   WHERE event_id=%s AND district_code=%s AND status='SUBMITTED'
                   RETURNING event_id""",
                ("VERIFIED" if body.action == "VERIFY" else "RETURNED",
                 actor.user_id, body.reason.strip() or None, event_id, DEMO_DISTRICT),
            )
            if cur.fetchone() is None:
                raise HTTPException(409, detail="Submission missing or already reviewed")
    return {"event_id": str(event_id), "status": "VERIFIED" if body.action == "VERIFY" else "RETURNED",
            "source": "FICTIONAL_LOCAL_DEMO"}
