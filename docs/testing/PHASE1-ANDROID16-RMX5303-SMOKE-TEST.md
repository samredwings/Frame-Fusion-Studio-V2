# Phase 1 Android 16 / RMX5303 smoke test

Target handset: **Realme RMX5303, Android 16 (API 36)**  
Build under test: **Frame Fusion Studio V2**, commit `bcfb1357ecbfc5b2ee86adc0da16f52f4d394aed`  
APK artifact: [GitHub Actions run #94](https://github.com/samredwings/Frame-Fusion-Studio-V2/actions/runs/45561723424)

> This checklist is a test plan, not a claim that the physical handset has already passed. Record actual results, OS build fingerprint, app version, sample-video checksums, and logs during the device session.

## 1. Preparation

- [ ] Confirm device model is RMX5303.
- [ ] Confirm Android version is 16 / API 36; record the full build number.
- [ ] Install `app-debug.apk` from the linked Actions artifact.
- [ ] Launch the app and create a clean test project.
- [ ] Prepare known-good test clips:
  - [ ] H.264 MP4, constant frame rate (CFR), known duration and frame count.
  - [ ] H.264 MP4 with B-frames and reordered decode PTS.
  - [ ] Variable-frame-rate (VFR) MP4 with known duration.
  - [ ] Truncated/corrupted MP4.
  - [ ] Non-video or zero-byte file renamed with an `.mp4` extension.
- [ ] Record each sample's filename, byte size, codec, duration, nominal frame rate, average frame rate, and expected frame count.

## 2. System document picker and URI resolution

- [ ] Open the project and choose the native video-import action.
- [ ] Verify Android's system document picker opens and filters for `video/*`.
- [ ] Pick an MP4 from internal storage.
- [ ] Confirm the returned URI is a `content://` URI; the app must not assume it is a filesystem path.
- [ ] Confirm the returned filename, size, MIME type, and `persistablePermission` value are populated.
- [ ] Verify `getVideoInfo(uri)` reads duration, dimensions, rotation, video track and audio-track metadata where available.
- [ ] Verify a normal picker cancellation produces a readable cancellation message and clears the busy state.
- [ ] Force-stop and relaunch the app, then verify the chosen document is still readable.
- [ ] Repeat with a provider that does not grant persistable permission; record the returned flag and whether access remains available after relaunch. Do not assume every document provider supports persistable grants.

**Pass criteria:** The import uses the returned content URI through Android's `ContentResolver`; no crash, raw-path assumption, or stuck loading state.

## 3. Timestamp index generation and source-owned storage

- [ ] Import the CFR sample and wait for `buildFrameIndex(uri, storageKey)` to finish.
- [ ] Confirm the returned `indexId` equals the source storage key.
- [ ] Confirm the key is 8–64 ASCII letters, digits, underscores, or hyphens.
- [ ] Confirm the timestamp index is stored under `filesDir/frame_fusion/indexes/{indexId}.pts`.
- [ ] Compare `frameCount` with `metadataFrameCount` and the reference clip metadata.
- [ ] Record `indexStructurallyValid`, `frameMappingConfidence`, `ptsSourceOrdered`, `ptsDuplicates`, `ptsNegative`, `firstPtsUs`, `lastPtsUs`, and `maxGapUs`.
- [ ] Confirm `frameMappingConfidence` remains `unverified`; structural validity is not proof of exact source-picture correspondence.
- [ ] Repeat with the B-frame sample. A false `ptsSourceOrdered` value is not by itself a failure: confirm the sorted presentation index has the expected count, no duplicate or negative PTS, and the expected duration.
- [ ] Repeat with the VFR sample. Confirm large timestamp gaps are reported and are not incorrectly treated as proof of corruption by themselves.

### Source-key isolation

- [ ] Import the same underlying document URI twice as two independent sources.
- [ ] Verify each source has a different source ID / index ID.
- [ ] Verify each source's `.pts` index and `frames/{indexId}` output directory are independent.
- [ ] Delete one source while the other still references the URI.
- [ ] Verify the remaining source can still read the document and timestamp index.
- [ ] Verify the URI permission is released only after the final source using that URI is removed.

Expected storage layout:

```text
filesDir/frame_fusion/
  indexes/{indexId}.pts
  frames/{indexId}/
  thumbnails/{indexId}/
  repairs/{indexId}/
```

## 4. Frame-range selection, extraction and IndexedDB persistence

- [ ] On an indexed source, choose at least two disjoint manual ranges (one near the start and one near the end).
- [ ] Start extraction and observe progress through each batch.
- [ ] Confirm the current store workflow calls native `extractFrameSelection()` in ascending batches of up to 250 selected indexes.
- [ ] Confirm total extracted count equals the number of selected source frames.
- [ ] Confirm each returned frame has the expected source frame index and presentation timestamp.
- [ ] Confirm each saved `frameAssets` record in IndexedDB has the correct `sourceVideoId`, sequence index, `sourceFrameIndex`, presentation timestamp, duration, dimensions, file size, and native output path.
- [ ] Confirm the actual JPEG at each saved native path exists and can be displayed.
- [ ] Close and reopen the app; verify the IndexedDB metadata and native JPEG files remain accessible.
- [ ] Confirm the source is marked extraction-complete only after the full extraction succeeds.

**Storage contract:** IndexedDB stores the `frameAssets` metadata and native file paths. Full-resolution JPEG files are in app-private native storage at `filesDir/frame_fusion/frames/{indexId}/`; they are not copied as image blobs into IndexedDB by this flow.

### Direct native `extractFrameRange()` bridge check

The current store-level manual multi-range flow uses `extractFrameSelection()`, not `extractFrameRange()`. Test the latter separately through a native bridge test harness:

- [ ] Request a small valid inclusive range and confirm `startFrameIndex`, `endFrameIndex`, `extractedCount`, and frame indexes.
- [ ] Try a negative start index.
- [ ] Try end-before-start.
- [ ] Try an end index outside the timestamp index.
- [ ] Try a range larger than the native maximum.
- [ ] Confirm invalid requests reject with a useful error and do not write out-of-range frames.

## 5. Invalid and corrupted video handling

- [ ] Import the zero-byte/renamed non-video sample.
- [ ] Import the truncated/corrupted MP4.
- [ ] Import a container with no readable video track, if available.
- [ ] Test a document whose permission has been revoked or whose provider no longer serves its content.
- [ ] Confirm each failure is visible to the user, with no crash or ANR.
- [ ] Confirm the busy state clears and another valid import can be started.
- [ ] Confirm a failed import does not leave a persisted source or an invalid timestamp index.
- [ ] Confirm failed indexing cleans the pending source-owned native key.
- [ ] Begin extraction with enough selected frames to create multiple batches.
- [ ] Cause the later batch to fail (for example, use a deliberately truncated sample that decodes some frames before failing).
- [ ] Confirm the extraction error remains visible and the source is not marked extraction-complete.
- [ ] Confirm partial JPEGs are deleted from `frames/{indexId}/`.
- [ ] Confirm the `.pts` index remains, so extraction can be retried without re-importing.
- [ ] Confirm `thumbnails/{indexId}/`, `repairs/{indexId}/`, and another source's directories remain untouched.

## 6. Evidence and result record

Complete one record for each test clip:

| Field | Result |
|---|---|
| Date / tester | |
| Device model | |
| Android version / API / build fingerprint | |
| App version / commit | |
| Sample filename / SHA-256 | |
| Container / video codec | |
| Duration / dimensions | |
| Nominal / average FPS | |
| Expected / metadata / indexed frame count | |
| `ptsSourceOrdered` / duplicates / negative PTS | |
| `indexStructurallyValid` / mapping confidence | |
| URI persists after force-stop (yes/no) | |
| Extracted / expected selected frame count | |
| IndexedDB metadata survives relaunch (yes/no) | |
| Native JPEG files readable after relaunch (yes/no) | |
| Invalid/corrupt error and cleanup result | |
| Logcat / diagnostics file reference | |
| Overall result (pass/fail) and notes | |

## 7. Acceptance gate

Phase 1 physical-device smoke test is complete only when:

- The document picker and URI read path pass on the target handset.
- CFR, B-frame, and VFR samples index without misleading diagnostics.
- Distinct source keys never overwrite or delete each other's media.
- Selected frame counts, timestamps, IndexedDB metadata, and native JPEG outputs match the test expectations.
- Failed extraction leaves no partial frame directory and retains a usable timestamp index for retry.
- Invalid or corrupted media fails gracefully, with no crash or stuck state.

Attach the completed result records and relevant redacted Logcat/native diagnostics to the Phase 1 test report. Do not include private document URIs or personal media in shared evidence.
