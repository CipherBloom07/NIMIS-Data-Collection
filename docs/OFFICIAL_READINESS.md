# NIMIS Collect — official-readiness notes

**Release state:** Development review only. Do not collect, upload or publish official farmer, financial or Ministry datasets using this branch.

## Implemented in this review

- Shared in-memory access-token context. Under `VITE_NIMIS_AUTH_MODE=oidc`, fake collector headers are not used by scheme lookups, upload or synchronization.
- Standards-based authorization-code + PKCE redirect, random state and short-lived verifier, provider metadata validation and access token retained only in application memory.
- Existing submitted form revisions are immutable; retries retain original event UUID and payload; assignments are obtained from Main NIMIS Core.
- Photo evidence attached in offline IndexedDB is transferred before its form metadata, authenticated with bearer token or development identity, SHA-256 checked, and retained locally if the server fails.
- Eleven **proposed** form dictionaries are still draft and unapproved. Current complex/repeating fields are preliminary input controls.

## Configurable institutional sign-in (local isolated integration only)

Copy these settings into a local, untracked environment file after ICT provides them:

```dotenv
VITE_NIMIS_AUTH_MODE=oidc
VITE_NIMIS_OIDC_ISSUER=https://<approved-provider-issuer>
VITE_NIMIS_OIDC_CLIENT_ID=<registered-public-client-id>
VITE_NIMIS_OIDC_REDIRECT_URI=https://<approved-app-origin>/<exact-callback-path>
```

No client secret belongs in a public PWA. The provider must support the authorization-code public client flow, CORS token exchange and the exact redirect URI. These client-side environment variables are **not** passwords; server secrets and token signing keys must never be committed or sent to a browser.

The existing Core API `127.0.0.1:8775` and `nimis_core_dev` are loopback-only. Successful institutional sign-in does not override that architecture: this remains **a local integration test**, not a live internet-connected deployment.

## Go-live prerequisites

- Formal Department approval of the correct eleven form versions, field constraints and reporting-unit definitions against the mWater questionnaire and NIMIS concept.
- Production service tied to the Ministry's reviewed PostgreSQL/PostGIS scheme master with one permanent scheme UUID; proper signed identities, device enrolment and assignment/revocation.
- Replace unencrypted browser IndexedDB field storage with an approved encrypted Android-first offline store, resumable encrypted durable media transfer and device-keystore protection.
- Formal evidence classification and privacy rules; test photo resolution/content limits, integrity and authorized retention.
- Complete typed GIS/domain records and approved publication-to-dashboard mappings, ensuring returned/unverified values never enter official totals.
- Verify 4 roles plus separate technical delegation, concurrent workflows, correction chains, dashboard reconciliation, performance, data exports and recovery drill.
- Department ICT written approval, production keys, secure hosting, rollback strategy, UAT and handover.

**Two review PRs must be reviewed together:**
- Collector: https://github.com/CipherBloom07/NIMIS-Data-Collection/pull/12
- Main NIMIS Core: https://github.com/CipherBloom07/NIMIS/pull/10

No main-branch merge, production installation or real data migration has been performed.
