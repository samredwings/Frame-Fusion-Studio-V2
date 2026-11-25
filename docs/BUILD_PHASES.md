# Frame Fusion Studio V2 — Build Phases and Progress

**Status updated:** 12 November 2026
**Repository:** `samredwings/Frame-Fusion-Studio-V2`
**Current base:** `main` at `c6d29875116669aaf83baf95d877e9cc9b954c86` (PR #3 merged)
**Implementation branch:** `fix/phase1-native-extraction-and-repair` (work in progress; not yet merged)

This is the project's working phase plan and status ledger. Percentages are engineering estimates of feature-scope completion, not measured test coverage or a claim that a phase has passed acceptance. A capability is marked *implemented* only when code exists; it is marked *verified* only when the relevant automated or device test has passed.

## Overall status

| Phase | Estimate | Current state | Main blocker |
|---|---:|---|---|
| 1 — Native Video Foundation | ~93% implementation | Native indexing plus user-directed manual/interval capture, multi-range extraction, and bounded selected-frame batches are integrated and emulator tested | Real-device import/extraction test on RMX5303, runtime IndexedDB audit, and device confirmation that React #418 is gone |
| 2 — Detection & Repair Interface | ~20% | Native heuristic detection and native repair/preview APIs exist on this branch; no user-facing repair workflow | Editable overlay, manual selection workflow, preview/settings UI, manifest editor, and accuracy evaluation |
| 3 — Intelligent Repair Engine | ~5% | A tested, dependency-free naive diffusion primitive with optional donor color matching, same-coordinate previous-frame blending, and feathering exists | Quality-grade inpainting, optical flow, temporal motion compensation, robust donor selection and performance acceptance |
| 4 — Video Reconstruction | ~0% | Reconstruction settings/types describe the target contract only | Media3 Transformer or equivalent encoder, timestamp-preserving MP4, audio passthrough, burn-in and render queue |
| 5 — Polish & Release | ~10% | Existing heuristic FaceSync and editor tools provide partial foundations | Timeline, batch queue, preferences, onboarding, production signing and device matrix |

## Phase 1 — Native Video Foundation

**Goal:** Extract source video frames through native Android APIs with accurate timestamps.

| Component | Current status | Evidence / remaining work |
|---|---|---|
| `FrameExtractorPlugin.java` | Implemented | Android document picker, metadata inspection, PTS indexing, timestamp pages, full-resolution frame/range and selected-index extraction (1–250 indexes per call), thumbnails and app-owned data cleanup. Selected output retains source presentation timestamps. PR #3 fixes the PTS file cursor bug. Verify import on the target device. |
| `frame-extractor.ts` | Implemented | Typed Capacitor bridge for metadata, indexing, timestamps, full-range and selected-index extraction, and progress events. |
| `types.ts` | Implemented | Legacy editor and native video, frame asset, repair-manifest and watermark/text-removal types are consolidated here. |
| `idb.ts` | Implemented and runtime verified | The eight requested media stores exist. This branch advances the DB to v4 and adds `projectId` and `sourceVideoId` indexes where required, including new `sourceVideoId` indexes for video sources and repair manifests. The schema audit runs after boot and is also covered by a Chromium smoke script. |
| `store.ts` | Implemented | Android import indexes the source first, then saves the user-selected manual/interval time ranges and extracts only selected source frames. Overlapping ranges are deduplicated; each saved `FrameAsset` retains its source PTS and range ID. |
| `media.ts` | Implemented | Legacy browser `File`/HTMLVideoElement canvas extraction remains a web-only fallback. The Android workspace now uses indexed selected-frame batches so the user can choose which frames to extract. There is no fixed six-second or 960px cap. |
| PTS index reader | Implemented and merged | PR #3 merged as commit `c6d2987…`; `TimestampIndexReader` logic is unchanged by this branch. Regression tests cover cursor positioning and invalid indexes. |
| React hydration error #418 | Render-path hardening; device acceptance pending | The Workspace no longer calls `Capacitor.isNativePlatform()` during render or while handling the picker click; it initializes the Android flag in `useEffect`. Remaining `window` calls are in effects/event handlers or non-component service functions. The production Chromium smoke test is clean; the reported RMX5303 WebView error still needs a repeat test. |

### User-directed video capture workflow (implemented on this branch)

- A dedicated capture screen uses a large playable video preview. Android `content://` picker URIs are served through Capacitor's same-origin content route so WebView media playback does not attempt to load a blocked local URI or copy the whole source clip into app storage.
- The former fixed-FPS dropdown is removed from the Android import experience. The user chooses **Manual range** or **Time interval** before extraction.
- **Manual range** uses independent start/end slider handles and retains every indexed source frame whose presentation timestamp falls inside each saved range.
- **Time interval** defaults to **200 ms** and is adjustable from 200 ms to 5 seconds. It resolves each target against the actual presentation timestamp index (including variable-frame-rate clips), not an assumed nominal FPS.
- Up to 25 ranges can be saved for one source video. The selected ranges are persisted on `VideoSource`; every extracted `FrameAsset` carries its range/sequence ID. Duplicate frame indexes across overlapping ranges are extracted once.
- Native extraction transfers no more than 250 selected indexes per bridge call. The same source clip can be sampled in separate sessions; multiple ranges in one session remain grouped under one imported source.
- Emulator validation: the 8-second, 200-frame synthetic clip loaded in Android WebView (`readyState=4`, duration 8s, no media error); two manual 1-second ranges produced 51 frames; a 1-second interval range at the default 200ms cadence produced 6 frames. This is emulator coverage, not RMX5303 hardware acceptance.

### Phase 1 acceptance checklist

- [x] PR #3 merged into `main`.
- [x] Android import path routes indexed frame extraction through the native plugin; no browser canvas frames are used for Android imports.
- [x] Android native extraction requests original dimensions (`targetWidth: 0`) and has no total-duration/six-second cap. Native plugin per-call batches are limited to 250 frames for memory/control, not by video duration.
- [x] The Android picker opens a large playback preview before extraction and the former fixed-FPS dropdown is removed.
- [x] Manual mode supports independent start/end handles and multiple saved time ranges in one source session.
- [x] Interval mode defaults to 200 ms and samples against source PTS; the interval is user adjustable.
- [x] Android selected-frame batches extract only chosen frame indexes; emulator test verified two manual ranges (51 frames) and one 200ms interval range (6 frames).
- [x] Workspace Android platform detection is initialized in `useEffect`, not during component render.
- [x] Production Chromium smoke test reports no React hydration errors (including #418) and no page errors.
- [x] Required IndexedDB object stores and indexes are declared; schema version 4 upgrades existing version-3 databases.
- [x] Runtime IndexedDB schema smoke test passes in Chromium: version 4, all eight stores, all expected indexes/key paths.
- [ ] Import and extract both previously failing RMX5303 test clips on the actual Android handset.
- [ ] Confirm no React error #418 on the same device after a cold start and import flow.
- [ ] Repeat the hydration and IndexedDB checks in the Android WebView on RMX5303.

## Phase 2 — Detection & Repair Interface

**Goal:** Detect watermarks/logos/subtitles/text; present editable overlays; preview repairs.

| Component | Current status | Evidence / remaining work |
|---|---|---|
| Static-region detection heuristic | Basic native implementation on this branch | `detectWatermark(uri, frameIndex, detectionMethods)` currently emits low-confidence candidate windows for a requested `static-region` scan. It does not identify a logo or understand text. It is not validated against the planned accuracy thresholds. |
| OCR text detection | Not implemented | No Tesseract, ML Kit or OCR engine is integrated. Unsupported requested methods are returned explicitly. |
| Logo recognition | Not implemented | No trained or template-recognition model is integrated. |
| Editable detection overlay | Not implemented | No bounding-box editor/handles in the UI. |
| Native repair API | Basic implementation on this branch | `removeWatermark` and `removeText` process a maximum of 250 frames per call and return app-private repaired frame paths. Both the TypeScript bridge and native plugin validate the limit. They emit `removalProgress`, `removalComplete` and `removalError`. |
| Single-frame preview API | Basic implementation; review defects corrected | `previewRemoval` creates a mutable ARGB_8888 copy before in-place repair and writes the JPEG beneath `repairs/<source-index>/previews/`, which is removed with the source by `deleteVideoData`. No UI flow currently invokes it. Android 15 instrumentation verifies the mutable-copy behavior. |
| Repair settings panel | Not implemented | No user-facing selection of algorithm, expansion, feather or temporal blend settings. |
| Repair manifest editor | Not implemented | Types and IndexedDB stores exist, but no user workflow saves/reviews the new native results as an editable manifest. |

**PR #4 automated review corrections:** The three Codex findings were addressed in this branch: (1) preview decoding now copies/recycles the immutable BitmapFactory result before in-place edits; (2) previews are stored under the source's repair directory so `deleteVideoData` reclaims them; and (3) each native removal call is capped at 250 frames to bound both result arrays and Capacitor bridge payloads. Regression coverage includes JVM range/path tests, TypeScript range tests, and an Android 15 Pixel 9 instrumentation test for immutable-to-mutable bitmap copying.

**Acceptance still open:** accuracy thresholds for watermark/subtitle detection are not established; users cannot yet draw/edit detections through a finished repair interface; preview and repair settings are APIs only; persistent manifest workflow is not built.

## Phase 3 — Intelligent Repair Engine

**Goal:** High-quality spatial and temporal repair for watermark/text removal.

| Component | Current status | Evidence / remaining work |
|---|---|---|
| Naive diffusion | Basic implementation on this branch | `NaiveInpainting` iteratively diffuses neighboring RGB values inside a masked rectangle. JVM tests cover a uniform fill case. |
| Donor patch / color matching | Basic implementation on this branch | Optional donor frame patch is colour-offset to the target border and blended into the diffusion result. JVM test covers border colour matching. |
| Feathered edges | Basic implementation on this branch | Smoothstep blend around mask edges; JVM test covers boundary blend and outside preservation. |
| Temporal blending | Limited implementation on this branch | Blends the prior repaired frame at the same pixel coordinates. It has no motion estimation, camera-motion compensation or optical flow. |
| OpenCV Navier–Stokes / Telea | Not implemented | No OpenCV dependency or implementation. Requests for these algorithms are rejected rather than silently running the naive algorithm. |
| Texture synthesis | Not implemented | No texture synthesis engine. |
| Optical-flow temporal repair | Not implemented | No optical-flow engine or motion-compensated warp. |
| Automatic donor-frame selection | Not implemented | Donor selection is an explicit frame index only. |
| Multi-neighbour temporal blending | Not implemented | Current approach uses at most the previous repaired frame at matching coordinates. |

**Acceptance still open:** visual-quality evaluation on difficult backgrounds, temporal flicker evaluation, 100-frame performance target on mid-range Android, motion-compensated donor mapping and advanced inpainting.

## Phase 4 — Video Reconstruction

**Goal:** Rebuild edited/repaired video as MP4 while preserving source timestamps and audio.

| Component | Current status | Evidence / remaining work |
|---|---|---|
| Media3 Transformer / native encoder | Not implemented | No Media3 Transformer integration. |
| Timestamp-accurate MP4 | Not implemented | Source PTS is indexed and persisted, but no native final-video mux/encode path consumes it. |
| Original audio preservation | Not implemented | Audio metadata is read; the current WebM export records canvas video only and does not retain source audio. |
| Frame replacement pipeline | Not implemented for native reconstruction | Frame data and replacement types exist; no final MP4 encoder applies them. |
| Region repair burn-in | Not implemented in final video | Native methods write repaired frame image files only. |
| Export settings UI | Not implemented | Reconstruction settings are data contracts only. |
| Background render queue | Not implemented | Render-job schema/types exist; no queue worker or cancellation UI. |

## Phase 5 — Polish & Release

**Goal:** Production-ready app, performance, usability and distribution.

| Component | Current status | Evidence / remaining work |
|---|---|---|
| FaceSync | Partial | Existing manual face lock, lightweight colour heuristic suggestion, drift measurement and stabilisation controls. Not AI face detection or identity tracking. |
| Timeline editor | Not implemented | No visual multi-track editor. |
| Batch processing | Not implemented | No multi-video queue. |
| Settings/preferences | Partial/basic | Existing project settings; no planned default repair algorithm/quality preferences. |
| Onboarding | Not implemented | No guided first-use flow. |
| Production signing | Not implemented | Debug APK build only; no verified production signing or AAB release. |
| Device testing matrix | Not implemented | Target device test is outstanding; no broad Android/codec matrix. |

## Explicit implementation boundaries

- No OpenCV library is integrated.
- No OCR or trained AI watermark/logo recognition is integrated.
- The detection method currently implemented is a heuristic candidate-window scan only; its confidence is not a validated accuracy score.
- The native repair engine currently implemented is naive diffusion with optional same-coordinate donor/temporal blending and feathering. It is not Telea, Navier–Stokes, texture synthesis or optical flow.
- The repair APIs output repaired frame images; they do not rebuild a video.
- No MP4/H.264 reconstruction or original-audio passthrough is implemented.
- Device-level Phase 1 acceptance is not claimed until the target RMX5303 import workflow is repeated successfully.

## Update procedure

When a feature changes, update the relevant row and acceptance checkbox in this document. Keep the distinction between *coded*, *automated-test verified*, and *device verified*. Update the status date and base/branch commit references when recording a new accepted build.
