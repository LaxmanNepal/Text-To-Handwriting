# Text to Handwriting — Android Offline App

This directory defines the production Android direction: a bundled local WebView app, separate from the TWA wrapper.

## Goal

Install APK → enable airplane mode → launch → edit/generate/export without a network connection.

The web application must be copied into `app/src/main/assets/app/` by the Android build workflow before Gradle runs. The Android shell must load only the local asset URL and must not require a remote URL for startup.

## Google Play

Build both:
- signed `.apk` for direct installation/testing
- signed `.aab` for Google Play

New Google Play apps submitted from 31 August 2026 must target Android 16 / API 36 or higher. Keep `targetSdk` configurable in Gradle so the project can be updated with the Android SDK. See Google's current policy before each release.

## Security

- no cleartext traffic
- no unrestricted file access
- JavaScript enabled only for the bundled app
- DOM storage enabled for IndexedDB/localStorage
- Android file chooser only when needed
- share/export through Android intents
- do not embed signing keys in the repository

## Release signing

Use GitHub Actions secrets for the keystore and passwords. Never commit a keystore.
