"""Staging-only district review of server-owned collector submissions.

Every decision is authorization-scoped, idempotent and committed atomically.
No provincial/national approval or scheme-master update is performed here.
"""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from server.secure_sync import _actor, _config

router = APIRouter(prefix="/api/v1/secure", tags=["district-review-staging"])


class DistrictDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision_id: UUID
    action: Literal["VERIFY", "RETURN"]
    reason: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def validate_reason(self):
        self.reason = self.reason.strip()
        if self.action == "RETURN" and not self.reason:
            raise ValueError("A reason is required when returning a submission")
        return self


@router.post("/district/submissions/{event_id}/decisions")
def decide_district(event_id: UUID, body: DistrictDecision, actor: UUID = Depends(_actor)):
    _, _, _, url = _config()
    try:
        import psycopg

        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                # Lock this submission's state to serialize competing district
                # decisions while keeping the collector's raw operation immutable.
                cur.execute(
                    """SELECT o.scheme_id,o.user_id,rs.status
                       FROM nimis_sync.operation o
                       JOIN nimis_sync.review_state rs ON rs.event_id=o.event_id
                       WHERE o.event_id=%s
                       FOR UPDATE OF rs""",
                    (event_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(404, detail="Submission not found")
                scheme_id, collector_id, state = row

                cur.execute(
                    """SELECT 1 FROM nimis_sync.current_actor_scope
                       WHERE user_id=%s AND scheme_id=%s
                         AND role='district_officer' AND active=true LIMIT 1""",
                    (actor, scheme_id),
                )
                if cur.fetchone() is None or collector_id == actor:
                    raise HTTPException(403, detail="District reviewer assignment required")

                cur.execute(
                    """SELECT event_id,actor_user_id,action,reason,to_status
                       FROM nimis_sync.review_decision WHERE decision_id=%s""",
                    (body.decision_id,),
                )
                existing = cur.fetchone()
                if existing is not None:
                    if (str(existing[0]) == str(event_id)
                            and str(existing[1]) == str(actor)
                            and existing[2] == body.action
                            and (existing[3] or "") == body.reason):
                        return {"event_id": str(event_id),
                                "decision_id": str(body.decision_id),
                                "outcome": "duplicate", "status": existing[4]}
                    raise HTTPException(409, detail="Decision ID already used for different content")

                if state != "SUBMITTED":
                    raise HTTPException(409, detail="Submission has already been reviewed")

                new_status = "VERIFIED" if body.action == "VERIFY" else "RETURNED"
                cur.execute(
                    """UPDATE nimis_sync.review_state
                       SET status=%s,version=version+1,updated_at=clock_timestamp()
                       WHERE event_id=%s AND status='SUBMITTED'
                       RETURNING status""",
                    (new_status, event_id),
                )
                if cur.fetchone() is None:
                    raise HTTPException(409, detail="Review state changed concurrently")

                cur.execute(
                    """INSERT INTO nimis_sync.review_decision
                       (decision_id,event_id,actor_user_id,actor_role,action,reason,
                        from_status,to_status)
                       VALUES (%s,%s,%s,'district_officer',%s,%s,'SUBMITTED',%s)""",
                    (body.decision_id, event_id, actor, body.action,
                     body.reason or None, new_status),
                )
        return {"event_id": str(event_id), "decision_id": str(body.decision_id),
                "outcome": "accepted", "status": new_status}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, detail="District decision service unavailable") from None
