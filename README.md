# NIMIS Field Data Collection

Offline-first Flutter mobile application for Zimbabwe irrigation scheme surveys. Source questionnaire: Irrigation Schemes Survey Questionnaire (mWater Portal, 11 pages).

> Development project. This repository is separate from the main NIMIS web application. No survey is published or synchronized until the backend contract and permissions have been reviewed.

## Development

Install Flutter, then run `flutter create --platforms android --project-name nimis_field_collector .`, `flutter pub get`, `flutter analyze`, `flutter test`, and `flutter run`.

Authentication and central synchronization are planned; the initial implementation saves editable draft surveys locally.
