# Android app

Frame Fusion Studio can be packaged as an offline Android app. Its interface
and assets are bundled inside the APK; the app does not need a hosted website
to open. Projects, imported frames, edits, and exports stay in the app's local
browser storage on that device.

## Build an APK

Install Node.js 22+, Android Studio 2025.2.1+, and Android SDK Platform 36.
Then, from this repository:

```sh
npm ci
npm run android:apk
```

The Android project is included in the repository. The installable debug APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`.

To build in GitHub Actions, run **Build Android APK** from the Actions page.
The finished APK is available as the `frame-fusion-studio-android` workflow
artifact. Pushing a tag matching `android-v*` runs the same build.

## App updates

This is an offline bundle, so new web app changes need a newly built APK. Keep
the generated `android/` project in the repository, then build and distribute
the new APK. The debug APK is suitable for direct testing; publishing updates
through Google Play requires a signed release build, an increased Android
version code, and the same signing key for each release.
