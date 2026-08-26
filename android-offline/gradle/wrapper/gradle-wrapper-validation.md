# Android build validation

The Android build must pass `scripts/verify_android_project.py` before Gradle compilation.

Required release checks:
- Android project files exist.
- compileSdk and targetSdk are 36.
- applicationId is stable.
- WebViewAssetLoader is used for local assets.
- direct file access is disabled.
- the web bundle is staged before compilation.
- APK and AAB are produced by CI.

Do not publish a Play Store release until the release APK has also passed the real-device airplane-mode acceptance test.
