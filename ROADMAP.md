# Frame Fusion Studio V2 Roadmap

**Status:** Audited against GitHub `main` on 2026-11-17  
**Product direction:** A dependable video/frame extraction and review studio.

Checkboxes reflect current source inspection and reproducible checks. The existing native plugin's ability to extract a contiguous frame-index range is not the same as user-configurable time-interval extraction or multiple manual timeline ranges.

## Phase 0 — Dependency and build health
- [x] Re-run full and production-only dependency audits from a clean lockfile install.
- [x] Resolve confirmed production vulnerabilities with compatible upgrades. Current full and production audits both report zero vulnerabilities.
- [ ] Verify the build, tests, and native/plugin integration after upgrades. Web production build, tests, typecheck and lint pass; Android/native build integration was not verified in this audit.
- [ ] Record remaining advisories, affected paths, and mitigation decisions. The current audit reports zero advisories; retain a committed audit record for release sign-off.

**Exit criteria:** Reproducible install/build; no unresolved exploitable production issue without a documented decision.

## Phase 1 — Video preview and extraction controls
- [ ] Make the video playback/preview area substantially larger and keep it usable while configuring extraction.
- [ ] Replace the fixed extraction-method dropdown behavior with explicit extraction modes.
- [ ] Implement interval extraction with a configurable interval; include 200 ms as the requested example/default candidate.
- [ ] Implement manual range selection with left and right range handles.
- [ ] Allow selecting a specific middle segment, not only the beginning or end.
- [ ] Support multiple independent extraction ranges in one source video.
- [ ] Show selected range boundaries and estimated extraction output before running.

**Audit note:** The current app includes native video import, frame indexing, timestamp pages, contiguous frame-index range extraction and extraction progress events. The workspace currently processes the full indexed frame range in chunks. The requested 200 ms time interval, interactive two-handle manual range selection, multiple independent ranges and larger playback/configuration view were not found in the current UI.

**Exit criteria:** Users can preview a video, extract at a 200 ms interval, or define several manual ranges and extract each intended segment.

## Phase 2 — Extraction correctness and performance
- [ ] Validate timestamp bounds, short clips, empty ranges, and overlapping ranges.
- [ ] Keep frame timestamps tied to the source video's timeline.
- [ ] Handle variable frame rate, rotation metadata, and unsupported codecs gracefully.
- [ ] Add progress, cancellation, and clear per-range error reporting.
- [ ] Avoid unnecessary decoding/reprocessing when multiple ranges are selected.

**Audit note:** The native extraction interface exposes presentation timestamps, per-frame durations, variable-frame-rate metadata, index verification and extraction progress. These are useful foundations, but end-to-end edge-case coverage and multi-range cancellation/error behavior are not yet demonstrated.

## Phase 3 — Review and export workflow
- [ ] Provide a clear frame gallery with timestamp and source-range context.
- [ ] Support selecting, removing, and re-exporting extracted frames.
- [ ] Preserve extraction settings for repeatable runs.
- [ ] Validate output naming, collision handling, and export completion feedback.

## Phase 4 — Regression and release hardening
- [ ] Add automated tests for interval and manual-range extraction.
- [ ] Add UI tests for preview sizing, range handles, multiple ranges, and mode switching.
- [ ] Verify plugin/native bridge behavior on supported platforms.
- [ ] Document supported formats, limitations, and troubleshooting.

## Audit results — 2026-11-17
- `npm ci` completed successfully.
- `npm test`: passed, 59 tests across 18 suites.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; database migration step correctly skipped because `DATABASE_URL` was not configured.
- `npm audit`: zero vulnerabilities in the full dependency tree.
- `npm audit --omit=dev`: zero production vulnerabilities.
- Native Android APK build and device-level extraction behavior were not verified in this run.

**Audit conclusion:** Only the two dependency-audit items are checked off. The core requested playback and extraction-control changes remain open.
