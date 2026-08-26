# Android APK

This repository builds an Android Trusted Web Activity (TWA) package for the Text to Handwriting PWA using Bubblewrap.

## Offline behavior

The APK launches the existing PWA. After the PWA app shell has been loaded once while online, the site's service worker can serve the cached application offline. The Android wrapper itself does not bundle the website source, so a completely first-launch-without-internet experience is not guaranteed.

## Build

Run **Actions → Android APK (PWA/TWA) → Run workflow**.

The workflow uploads `Text-To-Handwriting.apk` as a GitHub Actions artifact.

## Stable signing for releases

For repeatable Android updates, configure these repository Actions secrets:

- `TTH_KEYSTORE_BASE64` — base64 encoded Android keystore
- `TTH_KEYSTORE_PASSWORD` — keystore password
- `TTH_KEY_PASSWORD` — key password
- `TTH_KEY_ALIAS` — key alias

Without these secrets, the workflow creates a temporary CI signing key. That APK can be sideloaded for testing, but it must not be treated as the production update lineage because a new key would be generated on later runs.

When a stable key is configured, pushing a tag such as `android-v1.0.0` builds the signed APK and attaches it to a GitHub Release.

## Digital Asset Links

For a production TWA, the SHA-256 fingerprint printed by the workflow should be published at:

`https://apps.laxmannepal.com.np/.well-known/assetlinks.json`

The asset links entry must use package name `np.com.laxmannepal.texttohandwriting` and the SHA-256 certificate fingerprint belonging to the stable release signing key.
