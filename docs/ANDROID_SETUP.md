# Android setup (Windows)

On a Windows machine with Flutter and Android SDK installed:

\`\`\`powershell
git fetch origin
git switch feat/field-collector-foundation
flutter create --platforms android --project-name nimis_field_collector .
flutter pub get
flutter analyze
flutter test
flutter run
\`\`\`

After generating the Android platform, add these permissions above \`<application>\` in
\`android/app/src/main/AndroidManifest.xml\`:

\`\`\`xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
\`\`\`

Permission request is performed at runtime by geolocator.

**Development limitations:** This branch saves surveys locally and captures location, but the camera control is a placeholder. Officer sign-in and live synchronization are NOT yet connected. Do not use for sensitive operational data until authentication, encryption, photo persistence, audit, and server validation are implemented.
