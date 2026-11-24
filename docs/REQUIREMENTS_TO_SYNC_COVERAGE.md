# NIMIS collector data coverage and synchronization gate
**Checked against user-supplied documents:** `NIMIS_Concept_and_GUI_Illustrations_PowerBI(1).pdf` (13 November 2026), especially pp. 4–8 and 11–12; `Irrigation_Survey - mWater Portal_3(1).pdf`, pp. 1–11.
**Web application inspected:** `CipherBloom07/NIMIS` `feat/nimis-core-transactional-backend`: `server/core/app.py`, `server/core/schema.sql`; collector `schemas/form-catalogue.v1.json`, `src/survey.ts`, `src/storage.ts`.

## Requirement-level answer

**No, full collection-to-main synchronization is not yet complete.** The baseline PWA covers the mWater questionnaire at a simplified level. Its eight sections are not equivalent to the NIMIS concept's *eleven linked entities* (scheme, location, water, assets, farmer/plot, crop season, project, energy, O&M/finance, assessment/risk, telemetry) nor all seven main user interfaces.

The eleven existing **proposed operational form catalogue entries** are not eleven final Department-approved forms. This increment exposes each form as an offline **DRAFT_UNAPPROVED** workspace; it does NOT falsely mark them integrated, validated, or official. The old baseline drafts and local photos remain stored in their original IndexedDB; no migration, deletion or auto-upload occurs.

## Reporting module to capture requirement traceability

| Main NIMIS module (concept p. 4) | Needed linked source data | Collector operational dataset(s) | Gap to production sync |
| --- | --- | --- | --- |
| Executive Dashboard | Area by defined period; scheme status; beneficiaries; targets, programme contribution | baseline, operational_status, seasonal_production, project_update | Only synthetic operational_status reaches Core today; others lack accepted backend schema, denominators and publish rules |
| GIS & Spatial Mapping | Scheme point/polygon, water/asset location, verified accuracy, geometry version | baseline, new_scheme_request, infrastructure_incident | GPS point exists; polygon walk/upload and approved GIS master linkage missing |
| Water Resources & Hydrology | Source identity, weekly level, abstraction, flow, rainfall, reliability | baseline, water_availability | No approved water source registry or verified time series write API |
| Infrastructure Health & O&M | Asset UUID, class, condition, photos, inspections, mitigation, finances | infrastructure_incident, om_finance, baseline | No asset master, private evidence transfer, incident history and approvals |
| Agronomy & Production | Reporting season, crop, area, yields, tonnes, destination | seasonal_production, baseline | No accepted season/crop register and linked production service |
| Project Implementation | Programme, contracts, targets, milestones, finance and risks | project_update, risk_register, energy_power | Contract and expenditure register and review-specific permissions missing |
| Scheme Registry & Profile | One permanent scheme UUID with demographic, ownership, location, water, plots, linked records | baseline, farmer_plot, energy_power, new_scheme_request | Canonical UUID download works in fictional pilot; no real master update/linked record ingestion |

## Source mWater baseline questions

The original mWater form asks for demographics, GPS and photograph; officer contacts; equipped, expansion and functional area; water source/type/photo/GPS; beneficiaries; system/energy and management types; infrastructure condition, road and network; O&M and rehabilitation; water sufficiency, drainage and waterlogging; weather instruments and crops/markets; sustainability issues. The existing `src/survey.ts` covers these topics as eight baseline sections, but does not implement all conditionals, repeatable asset/plot objects, controlled geography codes, or approved personal-data protection rules. Real baseline photos must remain on-device until a secure attachment service is deployed.

## Synchronization agreement required before enabling official upload

1. **Authoritative master:** server-issued permanent UUID `scheme_id`, linked water_source_id, asset_id, plot_id, project_id and season/crop IDs. Never manufacture a second scheme master in collector.
2. **Envelope:** immutable event UUID, record UUID, identity & device, form_id/version, period/season, source, captured_at, observed_at, base master revision, prior submission and field-specific typed answers.
3. **Evidence:** original image checksum, media metadata, resumable private upload and reference integrity; no binary photo stored in ordinary JSON.
4. **Validation:** exact approved form versions and catalog codes, realistic quantitative ranges/units, coherent hectares, dates, required/conditional fields, geography/GPS, duplicates and field provenance.
5. **Offline reliability:** encrypted and crash-safe local queue, monotonic device sequence, exact replay on reconnection, per-event acknowledgements, conflicts, revocation and no deletion until confirmed server receipt.
6. **Review state:** collector SUBMITTED → DIDO VERIFIED → PIDO REVIEWED → delegated national TECHNICAL_APPROVED → ADMIN PUBLISHED; returns and revisions must retain the immutable original.
7. **Reporting:** only approved published current-per-period records reach main dashboards and BI; preserve prior seasons, provenance and figures' as-of dates.

## Branch-specific implementation and limits

- `src/RequirementsForms.tsx` reads existing `schemas/form-catalogue.v1.json` and provides local draft capture for all 11 *proposed* datasets, selected by scheme IDs fetched from the existing Core's authorized fictional assignment route.
- Drafts live in isolated `nimis_requirements_drafts_v1` IndexedDB; legacy `nimis_field_pwa_v1` surveys/outbox and photo storage are unmodified (photos from new forms are stored in the existing shared photo store with generated IDs).
- Catalog complex fields are still **provisional text/JSON entry**, not vetted repeating-row input controls or final enumerations; sensitive farmer/financial content must NOT be entered in this development form.
- The existing `CoreStageSyncLab` is unchanged and is the only route for *fictional* validated `operational_status` observations into Core's `nimis_core_dev`.
- Main NIMIS repository and live data are untouched. The full national app cannot be declared ready while authentication, schema approvals, operational endpoints, photos, official roles, tests and hosting remain outstanding.

## Acceptance test needed

Do not authorize production sync until a real assigned collector can capture each required dataset offline, retain photos/GPS and edits through interruption, reconnect to one authenticated backend and receive durable per-item acknowledgements; a district officer can verify, province can review and delegated national technical staff can approve, admin can publish; and the expected time-scoped figures, source records and evidence appear in each of the seven main NIMIS modules **without duplicate scheme records**.

## Follow-up: connected **fictional staging** form transport

The paired review branch `CipherBloom07/NIMIS:feat/collector-field-form-staging-contract` now exposes a dedicated **development-only** generic form intake and a geographically scoped metadata inbox. Collector `src/form-stage-sync.ts` persists exact saved revisions and replay-stable event IDs in an IndexedDB test queue; the UI requires explicit queueing and can attempt retries when the network returns.

**This does not constitute live NIMIS sync.** Receipts remain `AWAITING_FORM_APPROVAL` or `EVIDENCE_PENDING`, never `PUBLISHED`. Only JSON field answers and GPS metadata transfer; referenced photo blobs stay on the collector device. The eleven form definitions are still draft, and individual Ministry accounts, secure storage, official evidence upload, approved conditional forms, correction histories, technical sign-off and reporting mappings remain outstanding.

To exercise both apps, run the **paired review branches** against the isolated local `nimis_core_dev` database and synthetic test identities only. Main NIMIS installed/deployed code and real data are unchanged.
