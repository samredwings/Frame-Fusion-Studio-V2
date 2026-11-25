# Frame Fusion Studio V2

Frame Fusion Studio is a local-first video frame inspection and editing application.

## Build plan and current status

The authoritative phase roadmap, implementation status, acceptance checklist and explicit feature boundaries are maintained in [`docs/BUILD_PHASES.md`](docs/BUILD_PHASES.md).

## Android development

Build the Android web assets and sync the Capacitor project with:

```sh
npm run android:sync
```

Assemble a debug APK with:

```sh
npm run android:apk
```
