# Frame Fusion Studio V2 Roadmap

**Status:** Updated against extraction review, multi-select, and device-download changes on 2026-11-18
**Product direction:** A dependable video/frame extraction and review studio.

Checkboxes reflect code changes and checks completed in this branch. Android device playback and on-device extraction still require a physical device or emulator before release sign-off.

## Phase 0 — Dependency and build health
- [x] Re-run full and production-only dependency audits from a clean lockfile install.
- [x] Resolve confirmed production vulnerabilities with compatible upgrades. The current full and production audits report zero vulnerabilities.
- [x] Verify reproducible dependency installation, web build, tests, typecheck, lint, and Android APK compilation.
- [x] Record the current audit outcome and remaining device-level limitation in this roadmap.

## Phase 1 — Video preview and extraction controls
- [x] Make the video playback/preview area substantially larger and keep it usable while configuring extraction.
- [x] Replace the fixed native extraction-rate dropdown with explicit Time interval and Manual ranges modes.
- [x] Implement configurable interval extraction with 200 ms as the default.
- [x] Implement manual range selection with separate start and end handles.
- [x] Allow selection of a middle segment by moving either handle along the full video timeline.
- [x] Support multiple manual ranges in a single source video; overlapping frame selections are de-duplicated.
- [x] Show selected range boundaries and an estimated frame count before extraction.

**Implementation note:** Native video import now indexes the source and presents the extraction controls before generating frame assets. The Android bridge extracts selected source frame indexes in batches of up to 250 frames.

## Phase 2 — Extraction correctness and performance
- [x] Select interval frames using presentation timestamps rather than assuming a constant frame rate.
- [x] Preserve each extracted frame's original source index, presentation timestamp, and source-frame duration.
- [x] Validate interval input, reversed manual ranges, negative range boundaries, overlapping ranges, and non-zero source timestamp offsets.
- [x] Provide extraction progress and surface timestamp-page and native extraction errors.
- [x] De-duplicate overlaps and batch selected frames to avoid decoding the same source frame more than once in one run.
- [ ] Add cancellation and per-range extraction status/error reporting.
- [ ] Verify rotation metadata and unsupported-codec behavior across representative Android devices and video formats.

## Phase 3 — Review and export workflow
- [x] Provide a clear frame gallery with current-frame context and accessible frame selection.
- [x] Add multi-select for extracted frames, including select-all and clear-selection controls.
- [x] Download multiple selected stills directly to device storage without opening the Share chooser. Android 10+ uses MediaStore Downloads/Frame Fusion; Android 7–9 uses the app's Downloads folder.
- [x] Replace one or multiple selected frames by choosing the matching image files in frame order.
- [x] Add current-frame Download and Replace actions; keep the legacy Adjust drawer out of the normal frame-selection workflow.
- [ ] Build the dedicated, separate InShot-style image-editing page. The Go to Editing action remains intentionally disabled until that page is implemented.
- [ ] Preserve extraction settings for repeatable runs.
- [ ] Verify output-name collision behavior and the full Android save flow on a physical device.

## Phase 4 — Regression and release hardening
- [x] Add unit tests for interval sampling and manual-range selection.
- [x] Exercise preview sizing, interval default, mode switching, range handles, multiple ranges, range editing/removal, and mobile overflow in Playwright.
- [ ] Commit automated browser UI regression tests for those interactions.
- [x] Compile the Android debug APK with the new native bridge method.
- [ ] Verify native video preview and extraction on a physical Android device or emulator.
- [ ] Document supported formats, limitations, and troubleshooting.

## Validation results — 2026-11-17
- `npm ci`: passed.
- `npm test`: passed — 197 script tests and 67 TypeScript tests (264 total).
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors; 3 existing Fast Refresh warnings remain in `src/components/studio/ui.tsx`.
- `npm run build`: passed; the database migration step skipped as expected because `DATABASE_URL` was not configured.
- `npm run android:apk`: passed; Capacitor web assets synced and the Android debug APK compiled successfully.
- Browser smoke: desktop 1280×800 and mobile 390×844 both returned HTTP 200 with no console/page errors or horizontal overflow.
- Interactive Playwright QA: verified 200 ms default, 12-second video metadata, two manual ranges, range endpoint editing, removal, mode switching, and mobile range UI without horizontal overflow. No browser page errors were reported.
- No attached Android device/emulator was available; runtime video extraction has not been device-tested.

**Current implementation status:** Phases 1 and 2 are implemented; the first review/export controls are now in place. Native Android saving has been compiled but still needs confirmation on a physical device. The dedicated InShot-style editor, extraction cancellation, and device-level format verification remain open.
