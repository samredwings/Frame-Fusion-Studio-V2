# Frame Fusion Studio V2 Roadmap

**Status:** Initial roadmap generated 2026-11-17  
**Product direction:** A dependable video/frame extraction and review studio.

This roadmap combines the latest explicit UI requirements from the project conversation with the previously requested dependency/security work. Proposed items should be checked against the current implementation before being treated as committed scope.

## Phase 0 — Dependency and build health
- [ ] Re-run full and production-only dependency audits from a clean lockfile install.
- [ ] Resolve confirmed production vulnerabilities with compatible upgrades.
- [ ] Verify the build, tests, and native/plugin integration after upgrades.
- [ ] Record remaining advisories, affected paths, and mitigation decisions.

**Exit criteria:** Reproducible install/build; no unresolved exploitable production issue without a documented decision.

## Phase 1 — Video preview and extraction controls
- [ ] Make the video playback/preview area substantially larger and keep it usable while configuring extraction.
- [ ] Replace the fixed extraction-method dropdown behavior with explicit extraction modes.
- [ ] Implement interval extraction with a configurable interval; include 200 ms as the requested example/default candidate.
- [ ] Implement manual range selection with left and right range handles.
- [ ] Allow selecting a specific middle segment, not only the beginning or end.
- [ ] Support multiple independent extraction ranges in one source video.
- [ ] Show selected range boundaries and estimated extraction output before running.

**Exit criteria:** Users can preview a video, extract at a 200 ms interval, or define several manual ranges and extract each intended segment.

## Phase 2 — Extraction correctness and performance
- [ ] Validate timestamp bounds, short clips, empty ranges, and overlapping ranges.
- [ ] Keep frame timestamps tied to the source video's timeline.
- [ ] Handle variable frame rate, rotation metadata, and unsupported codecs gracefully.
- [ ] Add progress, cancellation, and clear per-range error reporting.
- [ ] Avoid unnecessary decoding/reprocessing when multiple ranges are selected.

**Exit criteria:** Extracted frames and timestamps are correct across representative video formats and edge cases.

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

## Release gates
- Dependency audit reviewed and recorded.
- Interval and manual extraction tests pass.
- Multiple ranges work in one video.
- No silent extraction failures; errors are actionable.

## Scope notes
The larger preview, 200 ms interval mode, manual left/right range selection, and multiple extractions per video are explicit user requirements from the project conversation. Remaining items are proposed engineering and release criteria.
