# NIMIS Collect — Phase 2 reference API (fictional development only)

This FastAPI service implements a small **read-only** demonstration of the proposed API: scoped `/me`, `/reference`, `/forms`, and `/schemes`. It has no access to the Ministry backend or Supabase. The single scheme and geography codes are explicitly fictional.

**Do not deploy this server to a public host.** The temporary development login is gated behind `NIMIS_DEMO_MODE=1`, a 32+-character environment secret, and a loopback connection. No shared production logins or Ministry credentials are supplied. The frontend local Vite development server also binds to loopback only.

## Run in PowerShell (terminal 1)
```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
$env:NIMIS_DEMO_MODE = '1'
$RandomBytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($RandomBytes)
$env:NIMIS_DEV_JWT_SECRET = [Convert]::ToBase64String($RandomBytes)
.\.venv\Scripts\python.exe -m uvicorn server.reference_app:app --host 127.0.0.1 --port 8765
```

## Run the PWA (terminal 2)
```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
npm install
npm run dev
```
Visit `http://127.0.0.1:5173` and open **Assigned schemes**. Choose **Connect fictional local demo**. This downloads only synthetic records for the test user's server-issued scope, and caches reference picklists offline. The access token is kept only in memory.

## Run reference API tests
```powershell
.\.venv\Scripts\python.exe -m pytest server\tests -q
```

## Next integration steps
1. Choose actual NIMIS identity provider and server-validated user/device/role assignments.
2. Disable development token logic in deployment; production configuration defaults to disabled already.
3. Connect actual scheme master IDs, administrative boundaries, reference data, and approved form versions.
4. Add secure device enrolment, revocation, expiry/grace policy, permission tests, event logs, and encrypted device storage.
5. Only then implement /sync/push and /sync/pull with server-side validation and idempotency.

**Current limitations:** No real user authentication, no writes or production scheme data, no device enrolment, no live data synchronization, no central scheme approval, no encrypted local database. This is a reviewable Phase 2 reference prototype.
