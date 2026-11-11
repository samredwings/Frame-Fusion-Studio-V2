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
- The former fixed-FPS dropdown is removed from the Android import experience. The user chooses **Manual range** or *