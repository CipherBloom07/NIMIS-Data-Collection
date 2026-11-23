# NIMIS Collect — Beginner-Friendly Module Flow (development build)

## Who this is for
Scheme managers, IMC members and field officers, including users with limited smartphone experience. The language is intentionally plain. Forms must work after first load without a network connection. The existing national coat-of-arms and green/gold/blue branding are retained.

## User journey

```text
Home (clear instructions / continue saved work)
  |
  +-- Step 1: Assigned schemes (FICTIONAL DEVELOPMENT REFERENCE ONLY)
  |       |
  |       +-- Preview server-scoped example scheme (no official assignment yet)
  |       |
  |       +-- Back to dashboard
  |
  +-- Step 2: New survey
  |       |
  |       +-- Section 1 → Section 2 → ... → Section 8
  |       |      each section shows answered / total fields
  |       |      Back / Next / Save & dashboard
  |       |
  |       +-- Autosave locally during editing
  |       +-- Leaving the module triggers another local save
  |
  +-- Step 3: Saved drafts (on Home dashboard)
  |       |
  |       +-- Open → continue → correct → save
  |       +-- Export JSON backup (photograph bytes NOT included)
  |
  +-- Step 4: DIDO → PIDO → national technical approval (NOT CONNECTED)
  |
  +-- Step 5: Secure server synchronization (NOT CONNECTED)
  
  Help (available alongside the journey)
  Test fictional data (local development mode only)
```

## User-experience rules
- Every main action uses a clear verb: Find your scheme, Start a survey, Continue, Save & dashboard.
- Section navigation shows numbers answered, not unverified "completed" ticks.
- Do not require connectivity or authentication for opening local draft screens in the development build.
- Do not mark fields as approved, submitted or synced without authoritative server confirmation.
- Warn that deleting browser data or uninstalling may remove unsynced drafts.
- User can navigate to the dashboard, assignments or help while editing; the current answers are saved locally before navigation.
- A separate dev-only fictional data test must never seed the real survey draft/outbox database.

## Important boundaries
This UI work improves learnability and flow, not implementation of the 22-page specification's production security gates. The official scheme selection is read-only/fake in the development service. No secure enrolment, remote revoke, encrypted local database, real DIDO/PIDO queue or synchronization exists yet. Manual browser/device UX testing is pending.

## Manual usability acceptance checklist
- [ ] First-time user can identify Start a survey without assistance.
- [ ] Resume saved draft after refreshing the browser.
- [ ] Switch away from form during an edit and reopen with last value preserved.
- [ ] See section progress counts update as answers are entered.
- [ ] Read Help in airplane mode on an installed/loaded device.
- [ ] Navigate from a 320px phone viewport without clipped buttons.
- [ ] Confirm the app never falsely reports a submission as uploaded.
- [ ] Verify focus states and screen-reader names on buttons.
- [ ] Test background color contrast under sunlight on target Android.
