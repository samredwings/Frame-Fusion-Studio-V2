# Native video foundation — integration review

Branch: `feature/video-repair-rebuild`

This note records how the supplied Phase 1 Java, TypeScript, type and migration files were compared with the active application, which pieces were incorporated, and which capabilities remain deliberately deferred.

## Incorporated into the application

- `types.ts` is now the consolidated legacy + video-native + watermark/text-removal type contract. The separate `video-types.ts` file has been removed. Legacy `Project`, `Source`, `FrameEdit`, `Region`, `ExportItem` and tool types remain intact.
- The Zustand store loads and persists `videoSources`, `frameAssets`, `repairManifests`, `renderJobs`, `detectedWatermarks`, `watermarkRemovals` and `textRemovals` in addition to the existing legacy records.
- IndexedDB is upgraded to version 3. Existing stores are retained; project/source/frame indexes and three removal-record stores are added without deleting existing user data.
- Android Import now uses the existing app-local `FrameExtractor` document picker, metadata inspection, PTS index, bounded timestamp pages and full-resolution native range extraction. Each native frame is represented by a `FrameAsset`; a compatibility `Source` record keeps existing editor tools working during migration.
- Native frame URLs are displayed from app-private paths through `Capacitor.convertFileSrc`.
- Native source deletion and failed native imports clean up the app-owned PTS index, extracted-frame directory, thumbnail directory and persistable URI permission where available.
- Browser import no longer truncates to six seconds or silently scales frames to 960px. It saves frames in small IndexedDB batches. The existing 80 MB browser upload guard remains.
- Draw/demo modules have moved to `src/_legacy/studio/`; compatibility re-exports keep existing editor imports working while callers migrate.
- `download.ts` includes a helper for sharing a saved native `FrameAsset` at its original extracted resolution.

## Why the uploaded Java plugin was not copied over

The repository already has a safer native extraction foundation than the uploaded replacement:

1. The uploaded `pickVideo()` is a stub that rejects instead of opening the picker. The repository implementation uses Android's Storage Access Framework and persists read permission when the provider supports it.
2. The repository builds a URI-keyed PTS index from actual video-track samples, stores it on disk and reads it in bounded pages. The uploaded version estimates frame timestamps from nominal FPS for extraction and caches indexes without correctly selecting a matching URI.
3. The repository reports API 24–27 extraction as best-effort (`exactFrameIndex: false`) and uses `getFrameAtIndex` on API 28+. The import path also keeps `indexVerified` visible and marks extracted frame exactness false when Android does not independently verify the indexed frame count.
4. The uploaded watermark detector is a coarse corner/bottom-region heuristic, not reliable logo/OCR recognition. Its `inpaint-ns` and `inpaint-telea` labels both route to a simple diffusion approximation; neither is a genuine Navier–Stokes or Telea implementation. The donor/previous-frame methods do not perform motion compensation.
5. The uploaded file does not provide a tested MP4 reconstruction pipeline.

For those reasons, the uploaded watermark-removal methods and event signatures are not exposed in the TypeScript bridge or UI as working functionality. The model and persistence slots are present, but the detector, removal engine and visual workflow still need a tested implementation.

## Native bridge available in the current branch

- `pickVideo()`
- `getVideoInfo(uri)`
- `buildFrameIndex(uri)`
- `getFrameTimestampPage(uri, startFrameIndex, limit)`
- `extractFrame(uri, frameIndex, targetWidth, quality)`
- `extractFrameRange(uri, startFrameIndex, endFrameIndex, targetWidth, quality)`
- `generateThumbnails(uri, count, width, quality)`
- `deleteVideoData(uri)`

The timestamp index stores actual presentation timestamps. If Android's independent metadata frame count does not match the indexed sample count (or is unavailable), the source is marked unverified. API 24–27 timestamp fallback frames are also marked non-exact.

## Still deferred

- A native preview/detection/removal UI with editable overlays and before/after comparison.
- Reliable watermark/logo/subtitle recognition (OCR or template matching).
- Genuine OpenCV inpainting, optical-flow alignment and robust temporal repair.
- Frame-replacement and region-repair UI backed by `RepairManifest`.
- Timestamp-accurate MP4 reconstruction with original-audio preservation. The type model describes intended settings; it is not an encoder implementation.
- Frame deletion/reordering for native indexed sources. Source timestamps are preserved; use replacement rather than mutating the underlying indexed timeline until a reconstruction pipeline exists.
- Full physical-device and codec/VFR test coverage.

## Verification required before release

The JavaScript validation suite should pass typecheck, tests, lint and the development build. The Android Gradle build must also run in Android CI because the development sandbox does not include a JDK/Android SDK. Physical-device validation is required for:

1. CFR MP4 at 24, 29.97, 30 and 60 FPS.
2. VFR MP4 with irregular presentation timestamps.
3. H.264, HEVC and VP9 samples on supported/unsupported devices.
4. API 28+ exact frame-index retrieval and API 24–27 best-effort fallback.
5. Rotated portrait footage and 4K source frames.
6. Long imports, low-storage failure, app restart and URI permission persistence.
7. Large-frame timeline browsing and range extraction while monitoring memory.
8. Source frame-count/index consistency before any exact rebuild is enabled.