# Secure synchronization foundation — implementation gate

This branch adds an **opt-in, staging-only** API layer that must not be exposed to real Ministry data yet. The existing fictional demo remains separately isolated. Source branch: `feat/technical-approval-gate-v1`.

## Intended live trust chain

1. The Ministry's approved OIDC identity provider issues RS256 JWT access tokens with exact issuer, audience, expiration and individual UUID subject.
2. The server validates the signature against an HTTPS JWKS endpoint; no dev-token identities are accepted.
3. An approved PostgreSQL service resolves the authenticated user and **authoritative geographic assignments**, via the ICT-supplied `nimis_sync.current_actor_scope` view. Role names and scope come from the database, never user-supplied JSON.
4. A previously enrolled, unrevoked device must match the JWT subject.
5. Only an **ICT-approved form version** and an assigned canonical scheme ID can receive a `submit` operation.
6. `event_id` is idempotent; identical retry receives duplicate, changed payload receives conflict. A unique device sequence prevents replaying a sequence with new content. The API uses committed per-operation transactions; dropped connections retry the original event ID.
7. The collector never updates the scheme master, verifies, reviews or publishes. Those actions require distinct audited workflow endpoints.

## Required external dependencies

- An ICT-approved PostgreSQL/PostGIS **authoritative scheme registry** and read-only view `nimis_sync.current_actor_scope(user_id uuid, scheme_id text, role text, active boolean)`, one row per active assigned scheme.
- Ministry-approved device enrolment and revocation process that provisions `nimis_sync.enrolled_device`.
- Approved, versioned forms provisioned into `nimis_sync.approved_form`. **Do not seed unapproved forms.**
- An institution-approved OIDC provider; HTTPS JWKS endpoint, issuer and audience. Service account credentials are provided through secret management, not Git.
- Approved backup, retention, privacy, photos and audit policies; functional UI token integration and secure Android storage.

## Review-only configuration

```text
NIMIS_SECURE_SYNC_ENABLED=1
NIMIS_OIDC_ISSUER=https://approved-idp.example.invalid/
NIMIS_OIDC_AUDIENCE=<approved API audience>
NIMIS_OIDC_JWKS_URL=https://approved-idp.example.invalid/.well-known/jwks.json
NIMIS_SECURE_SYNC_DATABASE_URL=<secret, approved PostgreSQL connection>
```

Nothing starts unless the enable flag and **all** security configuration values are supplied. Only an approved OIDC key is accepted. Transport termination must enforce HTTPS. The migration is `server/postgres/005_secure_sync_foundation_REVIEW.sql`, deliberately independent of fictional `nimis_collect_demo` tables.

## Scope and limitations

- This increment implements **submit-only JSON operations** and per-item acknowledgement, **not** complete sync/pull, device enrolment UI, media uploads, encrypted-at-rest mobile database, fully approved survey dictionaries, national approvals, or a field-ready Android client.
- Operations are immutable and never create schemes. Client `record_id` and `event_id` must be UUIDs; attachments do not enter this endpoint.
- A successful SQL migration does **not** imply readiness: the approved master view and account/form provisioning must exist before requests can be accepted.
- Database-level authorization of scheme IDs depends on the approved view. Follow-up work must add comprehensive validation for all forms, explicit correction revisions, server cursor pull and conflict resolution.
- Run tests with a disposable nonproduction DB. Never grant this staging role credentials to a public frontend or enable it on a public server.

## Testing gate

Review tests for missing/invalid identity, unregistered device, revoked device, unassigned scheme, unapproved form, duplicate event, reused sequence, changed replay payload, concurrent retry, and service restart. None may be marked passed without executed evidence. No production merge/deploy is authorized.
