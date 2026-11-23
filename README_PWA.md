# NIMIS Data Collection — React + TypeScript PWA

This is a fresh web/mobile field-collector implementation **without Flutter**.

## Features now implemented
- Eight questionnaire sections / 70 data fields
- Irrigation scheme create, edit, save and resume
- Local IndexedDB storage (works offline after initial app load and service worker caching)
- Revision-numbered local outbox designed for future synchronization
- GPS capture (requires permission and secure context)
- Camera/photo input, image binary stored in IndexedDB
- Dashboard, record list, progress indicator, basic JSON draft export
- Installable PWA manifest and offline service worker

## Start in VS Code
```powershell
git fetch origin
git switch feat/offline-pwa-foundation
npm install
npm run build
npm run dev
```
Open the local Vite URL displayed in the terminal.

To access from a phone on the LAN, use an HTTPS-enabled deployment or secure tunnel: phone camera/GPS permissions may not function on plain HTTP LAN hosts. Browser PWA install rules also require a secure context.

## Explicit limitations
- **Live synchronization to Supabase is NOT enabled yet**. The queue only records local changes.
- No officer authentication, district authorization, at-rest encryption, verification workflow or server-side validation yet.
- Do not enter confidential Ministry records during development.
- Survey data stored in one browser/device is NOT shared with other devices automatically.
- The JSON draft export does **not** include photograph binary data. Keep original device data until a full media backup and upload feature is implemented.
- Clear browser storage / uninstall may erase local drafts; browser quota and eviction policies apply.
- The previous Flutter foundation branch is retained for history, not merged.

## Future integration with main NIMIS application
Design an authenticated Supabase-backed API that validates officer roles and scheme IDs and returns per-event idempotent acknowledgements. Survey changes must enter review staging; only verified updates modify official institutional records and dashboards.

Note: the icon in the PWA is a simple provisional NIMIS graphic, **not** an invented official Ministry crest. Replace it with the Ministry-provided approved assets before production.

## Official branding (Zimbabwe coat of arms)
- The uploaded Zimbabwe coat of arms is bundled as `public/zimbabwe-coat-of-arms.svg` (a compact embedded image of the supplied artwork).
- The dashboard and install manifest use the coat of arms instead of the placeholder NIMIS icon.
- Colors derive from its green shield, blue-and-white stripes, gold Zimbabwe bird and red star. Definitions: `src/official-theme.css`.
- Primary green `#08643a`, blue `#2f3b83`, gold `#d4a73b`, red `#c84436`, off-white `#faf8f0`.
- For full-resolution print collateral, use the original supplied source image rather than the optimized web asset.
