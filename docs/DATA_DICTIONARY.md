# NIMIS Collect — Data Dictionary, v0.1 (PROPOSED)

Status: **Pending Department approval for forms 2–11**. Baseline follows the supplied 11-page mWater questionnaire (digitised field keys in `src/survey.ts`). Do not treat the proposed forms as approved policy or a deployed service.

## Universal record envelope

All forms and observations require `record_id` (client UUID), `form_id`, `form_version`, `scheme_id` (server-controlled, nullable for new-scheme request), `temp_scheme_id`, `device_id`, `user_id`, `captured_at` with timezone, `clock_offset_seconds`, `received_at` (server-created), `base_version`, `source_type`, `verification_status`, `period` or `season` where appropriate, `attachments` and immutable `audit_events`.

**Measurement convention:** Store each quantitative measurement as `{value, unit, observed_at, source_type, method, observer_id}`. Do not use bare numbers as official measurements. Dates are ISO 8601, geometry is GeoJSON WGS84 EPSG:4326. Every row is scoped to assigned geography and carries a revision. All personal information is access-controlled.

## 1. Scheme Baseline Survey

Origin: *Irrigation Schemes Survey Questionnaire* provided by user. Eight sections: A Identity/location, B Contributing officers, C Technical, D Infrastructure, E O&M, F Water, G Agronomy and markets, H Sustainability.

Current frontend model: `src/survey.ts` defines the 70 field keys. This is a **prototype mapping**, not full final parity. Required digitisation improvements from the brief remain: repeating contributing officer contacts, server-driven districts/wards, boundary walking, district GPS checks, full required-field validation, conditional questions, numeric units/date/source, "Other (specify)" fields, multiple water sources, and a scheme-ID display. Retain official questionnaire answer wording in final form definitions. The conveyance question appears twice in the paper original; present once, preserving both legacy source references in migration metadata.

## 2. Scheme Operational Status

Frequency: monthly and on material change. Roles: scheme manager/field officer.
| Key | Type | Unit / rule |
| --- | --- | --- |
| period | year-month | Required; uniqueness scope scheme + form + period |
| functionality_status | controlled choice | Fully / partially functional / under construction / rehabilitation / non-functional |
| equipped_area | measurement | ha, observed date and source |
| developed_area | measurement | ha, observed date and source; distinct from equipped |
| functional_area | measurement | ha, observed date and source |
| actual_irrigated_area | measurement | ha, observed date and source; warn if exceeds functional |
| inactive_area_reason | multi-choice + text | Conditional if functional below equipped |
| active_beneficiaries | integer measurement | persons, observed date/source |
| issues | repeating item | issue type, severity, action, evidence |
| remarks | text | Optional |

## 3. Seasonal Cropping and Production

Frequency: planted area monthly in season; harvest and production at harvest.
| Key | Type | Unit / rule |
| --- | --- | --- |
| season_id | controlled choice | Required; server-issued season |
| crop_code | reference choice | Required; repeat per crop |
| planted_area | measurement | ha |
| harvested_area | measurement | ha; cannot exceed planted without explanation |
| yield | measurement | e.g. t/ha; explicit unit/method |
| production | measurement | e.g. tonnes; explicit unit/method |
| planting_date | date | Date |
| harvest_date | date | Conditional |
| market_destination | text/reference | Optional |
| provenance | record envelope | Capture source |
Record key: scheme + season + crop + period + revision. Never overwrite prior seasons.

## 4. Water Availability and Abstraction

Frequency: weekly where possible.
| Key | Type | Unit / rule |
| --- | --- | --- |
| water_source_id | reference | Existing linked water source |
| reading_type | choice | Gauge / visual / estimate |
| observed_at | datetime | Required |
| level | measurement | m or % full; require unit |
| flow | measurement | m³/s or L/s; require unit |
| abstraction_volume | measurement | m³ per specified time interval |
| rainfall | measurement | mm (optional) |
| method_notes | text | Required for estimates |
| observer_id | reference | Required |

## 5. Infrastructure Assessment and Incident

Frequency: annually and after major incidents.
Fields: `asset_id` (linked engineering asset), `asset_type` (headworks/conveyance/storage/infield/fence/road/other), `observed_at`, `condition` (Good/Moderate/Bad), `severity`, `incident_type`, `description`, `mitigation`, `responsible_officer_id`, `target_close_date`, `closed_at`, `photos`, `closure_evidence`. Every image has private attachment metadata.

## 6. O&M and Finance

Frequency: monthly. Scheme manager/DIDO.
Fields: `period`, `maintenance_activities[]` (date, asset ID, action, cost measurement with currency, responsible person), `work_orders[]` (reference, status, due date), `expenditure` (amount/currency/date/source), `farmer_contributions` (amount/currency/date/source), `levy_payments` (amount/currency/date/reference), `om_fund_balance` (amount/currency/date/source), `supporting_documents[]`. Financial data restricted to authorized roles.

## 7. Energy and Power Status

Frequency: monthly; weekly for active project connections.
Fields: `period`, `energy_source`, `grid_connection_status`, `meter_reference`, `solar_status`, `outages[]` (start/end, reason), `billed_amount` (currency/date/source), `bill_payment_status`, `power_available_hours` (hours/date/source), `responsible_officer`, `evidence[]`.

## 8. Project Implementation Update

Frequency: weekly, consolidated monthly. DIDO/project officer.
Fields: `programme` (SI 87 Batch 1–4 / SIRP / other), `project_id`, `period`, `target_area` (ha/date/source), `substantially_complete_area` (ha/date/source), `progress_percent` (%/date/source), `milestones[]` (status, planned/actual dates), `contractor_id`, `power_connection_status`, `risks[]`, `delays[]`, `photos[]`.

## 9. Risk Register Update

Frequency: monthly and on material change.
Fields: `period`, `risk_id`, `category`, `description`, `severity`, `likelihood`, `mitigation`, `owner_id`, `due_date`, `status`, `review_date`, `evidence[]`. Preserve each review event.

## 10. Farmer and Plot Register

Frequency: enrolment and change; authorized roles only.
Fields: `beneficiary_ref` (pseudonymous unique reference), `plot_id`, `plot_area` (ha/date/source), `occupancy_type`, `enrolment_date`, `change_reason`, `prior_record_id`, `consent_or_legal_basis_ref`. Real names, phone numbers and national IDs are **not in the default form** and require legal review, purpose limitation, encryption and restricted field access.

## 11. New Scheme Request

As needed. Officer creates a **request**, never a scheme master record.
Fields: `temp_scheme_id` (UUID), `proposed_name`, `district_code`, `province_code`, `ward_code`, `gate_gps` (WGS84, accuracy, captured_at), `scheme_photo`, `reason`, `potential_duplicates[]` (local name/district and 500 m proximity), `submitted_by`, `dido_disposition` and `server_assigned_scheme_id` (server only).

## Proposed shared validation

- Hard errors: required fields missing, negative area, invalid year, coordinates outside Zimbabwe bounds, required photo missing, Other choice without specification.
- Warnings requiring reason: functional > equipped, actual irrigated > functional, GPS accuracy >20 m, coordinates outside selected district, fully functional but functional < equipped.
- Cross-form: harvest without planted season record, monthly area inconsistent with latest approved baseline, duplicate period entry without correction linkage.
- **Authoritative server validation required** for all submitted envelopes, role/scope, district boundaries, duplicate detection and version compatibility.

## Approval questions

The Department must approve the vocabulary, requiredness, thresholds, units and recurring frequencies for forms 2–11; geographic reference catalogue; financial currency policy; privacy-sensitive fields; and which verifiers have offline decision authority.
