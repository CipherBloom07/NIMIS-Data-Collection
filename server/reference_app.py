"""NIMIS Collect Phase 2 reference service.

Read-only geography-scoped scheme/form/reference delivery, with a LOOPBACK-ONLY
fictional development token. Not the Ministry production identity provider.
Default: no test tokens, no real scheme data, and no client write endpoints.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from server import postgres_reference

APP_ROOT = Path(__file__).resolve().parents[1]
FORM_CATALOGUE = APP_ROOT / "schemas" / "form-catalogue.v1.json"
ISSUER = "nimis-collect-reference"
AUDIENCE = "nimis-collect-reference-client"
DEMO_USER_ID = "10000000-0000-4000-8000-000000000001"
DEMO_SCHEME_ID = "DEMO-SCHEME-001"

app = FastAPI(
    title="NIMIS Collect — Reference Access/Reference API",
    version="0.2.0",
    description="Development reference only, never an authorized Ministry production endpoint.",
)

class Actor(BaseModel):
    user_id: str
    role: str
    province_ids: list[str] = Field(default_factory=list)
    district_ids: list[str] = Field(default_factory=list)
    scheme_ids: list[str] = Field(default_factory=list)

class DemoTokenRequest(BaseModel):
    username: str

def _demo_enabled() -> bool:
    return os.environ.get("NIMIS_DEMO_MODE", "").strip() == "1"

def _secret() -> str:
    secret = os.environ.get("NIMIS_DEV_JWT_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="Reference token signing is not configured")
    return secret

def _loopback(request: Request) -> bool:
    return bool(request.client and request.client.host in {"127.0.0.1", "::1", "testclient"})

def _actors() -> dict[str, Actor]:
    # Illustrative roles only; no real Ministry staff or personal data.
    if not _demo_enabled():
        return {}
    return {DEMO_USER_ID: Actor(
        user_id=DEMO_USER_ID,
        role="field_officer",
        province_ids=["DEMO-PROVINCE"],
        district_ids=["DEMO-DISTRICT"],
        scheme_ids=[DEMO_SCHEME_ID],
    )}

def current_actor(authorization: Annotated[str | None, Header()] = None) -> Actor:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    try:
        payload = jwt.decode(
            authorization.removeprefix("Bearer ").strip(),
            _secret(),
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from None
    try:
        if postgres_reference.enabled():
            database_actor = postgres_reference.get_actor(str(payload['sub']))
            actor = Actor.model_validate(database_actor) if database_actor is not None else None
        else:
            actor = _actors().get(str(payload['sub']))
    except postgres_reference.DatabaseUnavailable:
        raise HTTPException(status_code=503, detail='Reference database unavailable') from None
    if actor is None:
        raise HTTPException(status_code=403, detail="User is not active or authorized")
    return actor

ActorDep = Annotated[Actor, Depends(current_actor)]

def _no_store(response: JSONResponse) -> JSONResponse:
    response.headers["Cache-Control"] = "no-store"
    return response

@app.get("/api/v1/health")
def health():
    return {"service": "nimis-collect-reference", "stage": "development", "status": "ok",
            "reference_source": "postgresql_demo" if postgres_reference.enabled() else "in_memory_demo"}

@app.post("/api/v1/dev/token", include_in_schema=False)
def development_token(credentials: DemoTokenRequest, request: Request):
    if not _demo_enabled() or not _loopback(request):
        raise HTTPException(status_code=404, detail="Unavailable")
    if credentials.username != "officer.demo":
        raise HTTPException(status_code=401, detail="Unknown demo account")
    now = datetime.now(timezone.utc)
    access_token = jwt.encode(
        {"sub": DEMO_USER_ID, "iss": ISSUER, "aud": AUDIENCE,
         "iat": now, "exp": now + timedelta(minutes=30)},
        _secret(),
        algorithm="HS256",
    )
    return _no_store(JSONResponse({"access_token": access_token, "token_type": "bearer", "expires_in": 1800}))

@app.get("/api/v1/me")
def me(actor: ActorDep):
    return _no_store(JSONResponse(actor.model_dump()))

@app.get("/api/v1/reference")
def reference(actor: ActorDep, since: str | None = None):
    # Never replace authoritative geography from the NIMIS master with invented lists.
    # A real adapter must provide the central reference data and access-controlled deltas.
    return _no_store(JSONResponse({
        "revision": "demo-1", "source": "FICTIONAL_DEVELOPMENT_DATA",
        "reference_storage": "postgresql_demo" if postgres_reference.enabled() else "in_memory_demo",
        "generated_at": "2026-11-23T00:00:00+02:00",
        "provinces": actor.province_ids,
        "district_wards": {district: [] for district in actor.district_ids},
        "picklists": {"scheme_status": ["Fully functional", "Partially functional", "Non-functional"]},
        "has_more": False,
        "since": since,
    }))

@app.get("/api/v1/forms")
def forms(actor: ActorDep, since: str | None = None):
    if not FORM_CATALOGUE.is_file():
        raise HTTPException(status_code=503, detail="Form catalogue unavailable")
    data = json.loads(FORM_CATALOGUE.read_text(encoding="utf-8"))
    return _no_store(JSONResponse({
        "revision": data.get("version", "0.1"),
        "review_status": data.get("status"),
        "definitions": data["forms"],
        "has_more": False,
        "since": since,
    }))

@app.get("/api/v1/schemes")
def schemes(actor: ActorDep, cursor: str | None = None):
    if postgres_reference.enabled():
        try:
            # Only server-approved user assignments are used in database filtering.
            items = postgres_reference.get_schemes(actor.user_id)
        except postgres_reference.DatabaseUnavailable:
            raise HTTPException(status_code=503, detail='Reference database unavailable') from None
        return _no_store(JSONResponse({'items': items, 'next_cursor': None, 'has_more': False}))
    # Explicitly fictional record available ONLY for the assigned demo account.
    fixture = [{
        "scheme_id": DEMO_SCHEME_ID, "name": "Example Scheme (fictional)",
        "province_code": "DEMO-PROVINCE", "district_code": "DEMO-DISTRICT",
        "master_version": 1, "is_fictional": True,
    }]
    visible = [record for record in fixture if
               record["scheme_id"] in actor.scheme_ids
               and record["district_code"] in actor.district_ids
               and record["province_code"] in actor.province_ids]
    return _no_store(JSONResponse({"items": visible, "next_cursor": None, "has_more": False}))

@app.post("/api/v1/auth/device/enrol")
@app.post("/api/v1/sync/push")
@app.post("/api/v1/submissions/{submission_id}/decisions")
def unavailable_writes(submission_id: str | None = None):
    raise HTTPException(status_code=501, detail="Not implemented: security review and production identity required")
