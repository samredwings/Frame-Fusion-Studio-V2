# Native video foundation — integration review

Branch: `feature/video-repair-rebuild`

This note records how the four supplied Phase 1 files were compared with the live application and which parts were incorporated.

## Adopted

- Native Android metadata inspection using `MediaMetadataRetriever` and `MediaExtractor`.
- A presentation-timestamp index, stored in app-private files and read in pages instead of returning one unbounded JSON array.
- Separate nominal and measured average frame rates; VFR is assessed from timestamp intervals.
- Original-resolution extraction by default (`targetWidth: 0`) and independent, downscaled timeline thumbnails.
- Native range extraction in bounded batches (maximum 250 frames per call) with progress events.
- System document picker with persistable URI permission when the provider supports it.
- Additive video/frame/repair/image-edit data models and new IndexedDB stores.
- Existing legacy `Project`, `Source`, `FrameEdit`, editor and export code are retained for compatibility.

## Deliberate corrections to the supplied implementation

1. **Do not calculate the authoritative frame count as duration × FPS.** The native index counts actual video-track samples and stores their presentation timestamps. Metadata frame count is retained as a cross-check.
2. **Do not infer VFR by comparing every delta to only the first delta.** The incorporated index uses a median interval and a tolerance.
3. **Do not rescan the video from frame zero for every timestamp lookup.** The timestamp map is cached as a small binary file, and JavaScript requests bounded pages.
4. **Do not call the API 24–27 frame fallback exact.** API 28+ uses `getFrameAtIndex`. Older devices use `OPTION_CLOSEST` with the recorded PTS and return `exactFrameIndex: false`. That fallback is explicitly best-effort.
5. **Do not claim that the supplied reconstruction method works.** Its `rebuildVideo()` returned placeholder results with zero duration and zero frames. No rebuild method has been exposed in the incorporated plugin yet.
6. **Do not label the supplied color-fill approximation Navier–Stokes or Telea inpainting.** Those algorithms are not implemented in that code. Watermark/text removal is not exposed as a working feature.
7. **Do not use the supplied `implementation project(':opencv')` snippet yet.** There is no OpenCV module in this repository.
8. **Do not replace the existing type system wholesale.** The supplied replacement Project shape conflicts with the working application model. New types live in `src/lib/studio/video-types.ts`.
9. **Do not request broad media-library permissions for this import flow.** The native picker uses Android's Storage Access Framework. It grants access to the user-selected URI; the plugin persists read access where the provider permits it.

## Files incorporated

- `android/app/src/main/java/com/hasansaimon/framefusionstudio/FrameExtractorPlugin.java`
- `android/app/src/main/java/com/hasansaimon/framefusionstudio/MainActivity.java`
- `src/lib/native/frame-extractor.ts`
- `src/lib/studio/video-types.ts`
- `src/lib/studio/idb.ts` (database version 2; new stores added without deleting old stores)

## Current native bridge methods

- `pickVideo()`
- `getVideoInfo(uri)`
- `buildFrameIndex(uri)`
- `getFrameTimestampPage(uri, startFrameIndex, limit)`
- `extractFrame(uri, frameIndex, targetWidth, quality)`
- `extractFrameRange(uri, startFrameIndex, endFrameIndex, targetWidth, quality)`
- `generateThumbnails(uri, count, width, quality)`

The timestamp index is keyed from the picked content URI. Its result contains `indexVerified`; when the extractor sample count differs from Android's metadata frame count, the app must warn and disable any promise of exact reconstruction for that source until it has been validated.

## Not yet implemented or connected to the UI

- Dashboard/workspace import integration and project migration.
- A visual frame timeline using the native frame index.
- Full image-editor UI and serialization of every image-edit tool.
- Multiple replacement operations wired to a render manifest.
- Timestamp-accurate MP4 reconstruction and original-audio preservation.
- Region masking, face/object tracking, donor-frame repair and optical-flow repair.
- Genuine OpenCV/ML inpainting and reliable watermark/text detection.
- Instrumented tests on physical devices and a codec/VFR test corpus.

## Media3 version note

The supplied migration guide pins Media3 1.4.0. The current AndroidX release page lists 1.11.1 as the stable release as of 26 October 2026. Media3 is intentionally not added in this extraction-only commit: it should be introduced with the actual reconstruction implementation, not merely to satisfy unused imports or a placeholder method.

## Required device validation

1. CFR MP4 at 24, 29.97, 30 and 60 FPS.
2. VFR MP4 with irregular presentation timestamps.
3. H.264, HEVC and VP9 samples on supported/unsupported devices.
4. API 28+ exact frame-index retrieval and API 24–27 best-effort fallback.
5. Rotated portrait footage and 4K source frames.
6. Large video import, low-storage failure, app restart and URI permission persistence.
7. Thumbnail browsing and range extraction while monitoring memory.
8. Confirmed source frame-count/index consistency before enabling reconstruction.

The CI APK build proves that the Android code compiles and packages. It does not replace the device tests above.
