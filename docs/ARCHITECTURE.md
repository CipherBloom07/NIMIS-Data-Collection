# NIMIS Field Collector — development architecture

## Modules
- `survey_schema.dart`: 70 fields in 8 sections based on the supplied mWater questionnaire.
- `main.dart`: survey list, multi-section forms, save/resume workflow.
- `local_survey_repository.dart`: SQLite draft records and a revisioned sync outbox.
- `media_capture.dart`: GPS and permanent app-private camera files.

## Safety
The app **does not** connect to the official NIMIS/Supabase backend in this stage.
No survey can automatically alter the official scheme registry or published dashboards.
Collected GPS, photographs, and officer contact details remain local to the device.
A local database is not encrypted; test only with demonstration data until auth and encryption are implemented.

## Future two-way synchronization
1. Officer signs in with Supabase Auth and downloads permitted scheme assignments.
2. Device queues survey revisions with idempotent event IDs while offline.
3. A protected server endpoint validates user permission, scheme identifier, schema version and revision.
4. An acknowledgement clears only the exact matching queued event.
5. Reviewer receives a proposed amendment; official records change only after approval.
6. Mobile app receives corrections, assignment updates and scheme revisions using a checkpoint-based feed.
7. Photo assets synchronize separately to private buckets with authorization and retry.

Avoid confusing survey water-source coordinates with authoritative scheme locations.
