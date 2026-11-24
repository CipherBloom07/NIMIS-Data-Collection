"""Fictional-only provincial and admin review flow, isolated to local DB."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from server.demo_integration import connection, enabled
from server.reference_app import Actor, current_actor

router = APIRouter(prefix="/api/v1/dev/integration", tags=["fictional-review"])
PROVINCIAL_ID = "10000000-0000-4000-8000-000000000003"
ADMIN_ID = "10000000-0000-4000-8000-000000000004"
PROVINCE = "DEMO-PROVINCE"


class ReviewAction(BaseModel):
    action: str
    reason: str = Field(default="", max_length=200)


def _authorize(actor: Actor, stage: str):
    if stage == "province":
        if (actor.user_id != PROVINCIAL_ID or actor.role != "provincial_officer"
                or PROVINCE not in actor.province_ids):
            raise HTTPException(403, detail="Provincial Officer scope required")
    elif stage == "admin":
        if actor.user_id != ADMIN_ID or actor.role != "admin":
            raise HTTPException(403, detail="Demo admin role required")
    else:
        raise HTTPException(500, detail="Unknown fictional review stage")


def _inbox(stage: str):
    statuses = ("VERIFIED", "REVIEWED", "PUBLISHED") if stage == "province" else ("REVIEWED", "TECH_APPROVED", "PUBLISHED")
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT event_id,scheme_id,district_code,province_code,payload,status,
                          submitted_at,reviewed_at,review_note
                   FROM nimis_collect_demo.field_submission
                   WHERE province_code=%s AND status = ANY(%s)
                   ORDER BY submitted_at DESC,event_id DESC LIMIT 100""",
                (PROVINCE, list(statuses)),
            )
            rows = cur.fetchall()
    return {
        "source": "FICTIONAL_LOCAL_DEMO", "province": PROVINCE,
        "items": [{
            "event_id": str(row[0]), "scheme_id": row[1], "district_code": row[2],
            "province_code": row[3], "scheme_name": row[4].get("scheme_name"),
            "note": row[4].get("note"), "status": row[5],
            "submitted_at": row[6].isoformat(),
            "reviewed_at": row[7].isoformat() if row[7] else None,
            "review_note": row[8],
        } for row in rows],
    }


@router.get("/provincial-inbox")
def provincial_inbox(request: Request, actor: Actor = Depends(current_actor)):
    enabled(request)
    _authorize(actor, "province")
    return _inbox("province")


@router.get("/admin-inbox")
def admin_inbox(request: Request, actor: Actor = Depends(current_actor)):
    enabled(request)
    _authorize(actor, "admin")
    return _inbox("admin")


def _decision(event_id: UUID, body: ReviewAction, actor: Actor, stage: str):
    _authorize(actor, stage)
    action = body.action
    if stage == "province":
        if action not in ("REVIEW", "RETURN"):
            raise HTTPException(422, detail="Provincial Officer must REVIEW or RETURN")
        if action == "RETURN" and not body.reason.strip():
            raise HTTPException(422, detail="A return reason is required")
        old_status = "VERIFIED"
        new_status = "REVIEWED" if action == "REVIEW" else "RETURNED"
    else:
        if action == "TECH_APPROVE":
            old_status, new_status = "REVIEWED", "TECH_APPROVED"
        elif action == "PUBLISH":
            old_status, new_status = "TECH_APPROVED", "PUBLISHED"
        else:
            raise HTTPException(422, detail="Admin must TECH_APPROVE before PUBLISH")

    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE nimis_collect_demo.field_submission
                    SET status=%s,reviewed_at=now(),reviewed_by=%s,review_note=%s
                    WHERE event_id=%s AND province_code=%s AND status=%s
                    RETURNING event_id""",
                (new_status, actor.user_id, body.reason.strip() or None,
                 event_id, PROVINCE, old_status),
            )
            if cur.fetchone() is None:
                raise HTTPException(409, detail="Record missing, outside scope or wrong review state")
            cur.execute(
                """INSERT INTO nimis_collect_demo.demo_decision
                   (decision_id,event_id,actor_user_id,actor_role,action,reason)
                   VALUES (%s,%s,%s,%s,%s,%s)""",
                (uuid4(), event_id, actor.user_id, actor.role, action,
                 body.reason.strip() or None),
            )
    return {"event_id": str(event_id), "status": new_status,
            "source": "FICTIONAL_LOCAL_DEMO", "publication": "demo_only"}


@router.post("/provincial-inbox/{event_id}/decision")
def provincial_decision(event_id: UUID, body: ReviewAction, request: Request,
                        actor: Actor = Depends(current_actor)):
    enabled(request)
    return _decision(event_id, body, actor, "province")


@router.post("/admin-inbox/{event_id}/decision")
def admin_decision(event_id: UUID, body: ReviewAction, request: Request,
                   actor: Actor = Depends(current_actor)):
    enabled(request)
    return _decision(event_id, body, actor, "admin")
