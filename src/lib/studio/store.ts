import { create } from "zustand";
import {
  frameKey,
  idbAll,
  idbBatch,
  idbDel,
  idbGet,
  idbPut,
  type IDBBatchOperation,
} from "@/lib/studio/idb";
import { extractVideoFrames } from "@/lib/studio/media";
import { FrameExtractor } from "@/lib/native/frame-extractor";
import type { ExtractedFrame } from "@/lib/native/frame-extractor";
import {
  selectFrameIndexesByInterval,
  selectFrameIndexesByRanges,
  type ManualExtractionRange,
} from "@/lib/studio/extraction-selection";
import { DEMO_PROJECT_ID, seedDemo } from "@/lib/studio/sample";
import type {
  DetectedWatermark,
  ExportItem,
  FrameAsset,
  FrameTimeMapEntry,
  FrameEdit,
  Grade,
  Project,
  ProjectStatus,
  Region,
  RegionKind,
  RepairManifest,
  RenderJob,
  Source,
  SourceRole,
  StoredDetectedWatermark,
  TextRemovalRepair,
  VideoSource,
  WatermarkRemovalRepair,
} from "@/lib/studio/types";

type StudioState = {
  ready: boolean;
  error: string | null;
  notice: string | null;
  busy: string | null;
  projects: Project[];
  sources: Source[];
  edits: FrameEdit[];
  regions: Region[];
  exports: ExportItem[];
  videoSources: VideoSource[];
  frameAssets: FrameAsset[];
  repairManifests: RepairManifest[];
  renderJobs: RenderJob[];
  detectedWatermarks: StoredDetectedWatermark[];
  watermarkRemovals: WatermarkRemovalRepair[];
  textRemovals: TextRemovalRepair[];
  boot: () => Promise<void>;
  dismiss: () => void;
  createProject: (name: string, description: string) => Promise<string>;
  updateProject: (
    id: string,
    patch: Partial<Pick<Project, "name" | "description" | "status" | "fps">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreDemo: () => Promise<void>;
  importVideo: (projectId: string, file: File, fps: number) => Promise<string>;
  importNativeVideo: (projectId: string) => Promise<string>;
  extractNativeVideoFrames: (
    sourceId: string,
    selection:
      | { mode: "interval"; intervalMs: number }
      | { mode: "manual"; ranges: ManualExtractionRange[] },
  ) => Promise<number>;
  deleteSource: (id: string) => Promise<void>;
  deleteFrame: (sourceId: string, frameIndex: number) => Promise<void>;
  setLock: (sourceId: string, lock: Source["lock"]) => Promise<void>;
  upsertEdit: (edit: FrameEdit) => Promise<void>;
  clearFrame: (sourceId: string, frameIndex: number) => Promise<void>;
  addRegion: (region: Region) => Promise<void>;
  updateRegion: (
    id: string,
    patch: Partial<
      Pick<
        Region,
        "label" | "kind" | "amount" | "frameIn" | "frameOut" | "x" | "y" | "w" | "h" | "blobKey"
      >
    >,
  ) => Promise<void>;
  deleteRegion: (id: string) => Promise<void>;
  saveExport: (item: ExportItem, blob: Blob) => Promise<void>;
  deleteExport: (id: string) => Promise<void>;
  upsertVideoSource: (source: VideoSource) => Promise<void>;
  upsertFrameAssets: (assets: FrameAsset[]) => Promise<void>;
  upsertRepairManifest: (manifest: RepairManifest) => Promise<void>;
  upsertRenderJob: (job: RenderJob) => Promise<void>;
  upsertDetectedWatermarks: (
    projectId: string,
    sourceVideoId: string,
    detections: DetectedWatermark[],
  ) => Promise<void>;
  upsertWatermarkRemoval: (repair: WatermarkRemovalRepair) => Promise<void>;
  upsertTextRemoval: (repair: TextRemovalRepair) => Promise<void>;
  deleteVideoSource: (id: string) => Promise<void>;
};

let booting: Promise<void> | null = null;

async function readLibrary() {
  const [
    projects,
    sources,
    edits,
    regions,
    exports,
    videoSources,
    frameAssets,
    repairManifests,
    renderJobs,
    detectedWatermarks,
    watermarkRemovals,
    textRemovals,
  ] = await Promise.all([
    idbAll<Project>("projects"),
    idbAll<Source>("sources"),
    idbAll<FrameEdit>("edits"),
    idbAll<Region>("regions"),
    idbAll<ExportItem>("exports"),
    idbAll<VideoSource>("videoSources"),
    idbAll<FrameAsset>("frameAssets"),
    idbAll<RepairManifest>("repairManifests"),
    idbAll<RenderJob>("renderJobs"),
    idbAll<StoredDetectedWatermark>("detectedWatermarks"),
    idbAll<WatermarkRemovalRepair>("watermarkRemovals"),
    idbAll<TextRemovalRepair>("textRemovals"),
  ]);
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  sources.sort((a, b) => a.createdAt - b.createdAt);
  exports.sort((a, b) => b.createdAt - a.createdAt);
  videoSources.sort((a, b) => b.importedAt - a.importedAt);
  frameAssets.sort(
    (a, b) => a.sourceVideoId.localeCompare(b.sourceVideoId) || a.frameIndex - b.frameIndex,
  );
  renderJobs.sort((a, b) => b.createdAt - a.createdAt);
  return {
    projects,
    sources,
    edits,
    regions,
    exports,
    videoSources,
    frameAssets,
    repairManifests,
    renderJobs,
    detectedWatermarks,
    watermarkRemovals,
    textRemovals,
  };
}

async function dropSourceMedia(source: Source, edits: FrameEdit[], exports: ExportItem[]) {
  for (let i = 0; i < source.frameCount; i++) await idbDel("blobs", frameKey(source.id, i));
  for (const edit of edits) {
    if (edit.sourceId === source.id && edit.kind === "replace") await idbDel("blobs", edit.blobKey);
    if (edit.sourceId === source.id) await idbDel("edits", edit.id);
  }
  for (const item of exports) {
    if (item.sourceId === source.id) {
      await idbDel("blobs", item.blobKey);
      await idbDel("exports", item.id);
    }
  }
}

export const useStudio = create<StudioState>((set, get) => ({
  ready: false,
  error: null,
  notice: null,
  busy: null,
  projects: [],
  sources: [],
  edits: [],
  regions: [],
  exports: [],
  videoSources: [],
  frameAssets: [],
  repairManifests: [],
  renderJobs: [],
  detectedWatermarks: [],
  watermarkRemovals: [],
  textRemovals: [],
  dismiss: () => set({ notice: null, error: null }),
  boot: () => {
    if (booting) return booting;
    booting = (async () => {
      try {
        let data = await readLibrary();
        if (!data.projects.length) {
          await seedDemo();
          data = await readLibrary();
        }
        set({ ready: true, ...data, error: null });
      } catch (error) {
        set({
          ready: true,
          error: error instanceof Error ? error.message : "The local library could not be opened.",
        });
      }
    })();
    return booting;
  },
  createProject: async (name, description) => {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      status: "draft",
      fps: 24,
      createdAt: now,
      updatedAt: now,
    };
    await idbPut("projects", project.id, project);
    set({ projects: [project, ...get().projects], notice: null });
    return project.id;
  },
  updateProject: async (id, patch) => {
    const current = get().projects.find((project) => project.id === id);
    if (!current) return;
    const next: Project = { ...current, ...patch, updatedAt: Date.now() };
    if (patch.name !== undefined) next.name = patch.name.trim() || current.name;
    await idbPut("projects", id, next);
    set({ projects: get().projects.map((project) => (project.id === id ? next : project)) });
  },
  deleteProject: async (id) => {
    const sources = get().sources.filter((source) => source.projectId === id);
    for (const source of sources) await dropSourceMedia(source, get().edits, get().exports);
    for (const region of get().regions) {
      if (region.projectId !== id) continue;
      if (region.blobKey) await idbDel("blobs", region.blobKey);
      await idbDel("regions", region.id);
    }
    const v2VideoSources = get().videoSources.filter((item) => item.projectId === id);
    const v2FrameAssets = get().frameAssets.filter((item) => item.projectId === id);
    const v2RenderJobs = get().renderJobs.filter((item) => item.projectId === id);
    const v2Detections = get().detectedWatermarks.filter((item) => item.projectId === id);
    const v2WatermarkRemovals = get().watermarkRemovals.filter((item) => item.projectId === id);
    const v2TextRemovals = get().textRemovals.filter((item) => item.projectId === id);
    const v2Manifest = get().repairManifests.find((item) => item.projectId === id);
    await idbBatch([
      ...v2VideoSources.map((item) => ({
        kind: "delete" as const,
        store: "videoSources",
        key: item.id,
      })),
      ...v2FrameAssets.map((item) => ({
        kind: "delete" as const,
        store: "frameAssets",
        key: item.id,
      })),
      ...v2RenderJobs.map((item) => ({
        kind: "delete" as const,
        store: "renderJobs",
        key: item.id,
      })),
      ...v2Detections.map((item) => ({
        kind: "delete" as const,
        store: "detectedWatermarks",
        key: item.id,
      })),
      ...v2WatermarkRemovals.map((item) => ({
        kind: "delete" as const,
        store: "watermarkRemovals",
        key: item.id,
      })),
      ...v2TextRemovals.map((item) => ({
        kind: "delete" as const,
        store: "textRemovals",
        key: item.id,
      })),
      ...(v2Manifest
        ? [{ kind: "delete" as const, store: "repairManifests", key: v2Manifest.projectId }]
        : []),
    ]);
    await Promise.all(
      v2VideoSources.map((item) => FrameExtractor.deleteVideoData(item.uri).catch(() => undefined)),
    );
    await idbDel("projects", id);
    set({
      projects: get().projects.filter((project) => project.id !== id),
      sources: get().sources.filter((source) => source.projectId !== id),
      edits: get().edits.filter((edit) => edit.projectId !== id),
      regions: get().regions.filter((region) => region.projectId !== id),
      exports: get().exports.filter((item) => item.projectId !== id),
      videoSources: get().videoSources.filter((item) => item.projectId !== id),
      frameAssets: get().frameAssets.filter((item) => item.projectId !== id),
      repairManifests: get().repairManifests.filter((item) => item.projectId !== id),
      renderJobs: get().renderJobs.filter((item) => item.projectId !== id),
      detectedWatermarks: get().detectedWatermarks.filter((item) => item.projectId !== id),
      watermarkRemovals: get().watermarkRemovals.filter((item) => item.projectId !== id),
      textRemovals: get().textRemovals.filter((item) => item.projectId !== id),
    });
  },
  restoreDemo: async () => {
    set({ busy: "Restoring the Harbor Night reel…" });
    try {
      if (get().projects.some((project) => project.id === DEMO_PROJECT_ID))
        await get().deleteProject(DEMO_PROJECT_ID);
      await seedDemo();
      const data = await readLibrary();
      set({ ...data, busy: null, notice: "Harbor Night is back in the bay." });
    } catch (error) {
      set({
        busy: null,
        error: error instanceof Error ? error.message : "Could not restore the demo.",
      });
    }
  },
  importVideo: async (projectId, file, fps) => {
    if (file.size > 80 * 1024 * 1024) throw new Error("Keep imports under 80 MB.");
    const looksVideo =
      file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|ogv|m4v)$/i.test(file.name);
    if (!looksVideo) throw new Error("Choose a video file.");
    const id = crypto.randomUUID();
    let savedFrameCount = 0;
    set({ busy: "Reading the video…", error: null });
    try {
      let lastProgressAt = 0;
      const extracted = await extractVideoFrames(
        file,
        fps,
        8,
        (done, total) => {
          const now = Date.now();
          if (done === 1 || done === total || now - lastProgressAt >= 150) {
            lastProgressAt = now;
            set({ busy: "Extracting frame " + done + " of " + total });
          }
        },
        async (startIndex, batch) => {
          set({ busy: "Saving frames " + (startIndex + 1) + "–" + (startIndex + batch.length) });
          await idbBatch(
            batch.map((blob, offset) => ({
              kind: "put" as const,
              store: "blobs",
              key: frameKey(id, startIndex + offset),
              value: blob,
            })),
          );
          savedFrameCount += batch.length;
        },
      );
      const role: SourceRole = get().sources.some((source) => source.projectId === projectId)
        ? "compare"
        : "primary";
      const source: Source = {
        id,
        projectId,
        filename: file.name,
        role,
        fps,
        frameCount: extracted.frameCount,
        durationMs: Math.round(extracted.duration * 1000),
        width: extracted.width,
        height: extracted.height,
        fileSize: file.size,
        lock: null,
        createdAt: Date.now(),
      };
      await idbPut("sources", source.id, source);
      const project = get().projects.find((item) => item.id === projectId);
      if (project && role === "primary") {
        const next = { ...project, fps, updatedAt: Date.now() };
        await idbPut("projects", project.id, next);
        set({ projects: get().projects.map((item) => (item.id === project.id ? next : item)) });
      } else if (project) {
        const next = { ...project, updatedAt: Date.now() };
        await idbPut("projects", project.id, next);
        set({ projects: get().projects.map((item) => (item.id === project.id ? next : item)) });
      }
      set({
        sources: [...get().sources, source],
        busy: null,
        notice: `Imported ${extracted.frameCount} frames (${extracted.duration.toFixed(1)}s) from ${file.name}.`,
      });
      return id;
    } catch (error) {
      await idbBatch(
        Array.from({ length: savedFrameCount }, (_, index) => ({
          kind: "delete" as const,
          store: "blobs",
          key: frameKey(id, index),
        })),
      ).catch(() => undefined);
      await idbDel("sources", id).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Import failed.";
      set({ busy: null, error: message });
      throw error;
    }
  },
  importNativeVideo: async (projectId) => {
    if (!get().projects.some((item) => item.id === projectId))
      throw new Error("The selected project is no longer available.");
    const sourceId = crypto.randomUUID();
    let selectedUri: string | null = null;
    set({ busy: "Choose a source video…", error: null, notice: null });
    try {
      const picked = await FrameExtractor.pickVideo();
      selectedUri = picked.uri;
      set({ busy: "Reading video metadata…" });
      const info = await FrameExtractor.getVideoInfo(picked.uri);
      set({ busy: "Building the timestamp index…" });
      const index = await FrameExtractor.buildFrameIndex(picked.uri);
      if (index.frameCount < 1) throw new Error("No video frames could be indexed.");
      const fps =
        index.averageFrameRate > 0
          ? index.averageFrameRate
          : index.nominalFrameRate > 0
            ? index.nominalFrameRate
            : 24;
      const role: SourceRole = get().sources.some((source) => source.projectId === projectId)
        ? "compare"
        : "primary";
      const now = Date.now();
      const rotation = [0, 90, 180, 270].includes(info.rotation)
        ? (info.rotation as 0 | 90 | 180 | 270)
        : 0;
      const videoSource: VideoSource = {
        id: sourceId,
        projectId,
        uri: picked.uri,
        filename: picked.filename || info.filename || "video",
        sizeBytes: picked.sizeBytes || info.sizeBytes,
        durationMs: info.durationMs,
        frameCount: index.frameCount,
        nominalFrameRate: index.nominalFrameRate || fps,
        averageFrameRate: index.averageFrameRate || fps,
        hasVariableFrameRate: index.hasVariableFrameRate,
        frameIndexId: index.indexId,
        frameIndexVerified: index.indexVerified,
        width: info.width,
        height: info.height,
        rotation,
        videoMimeType: info.videoMimeType,
        videoBitrate: info.videoBitrate,
        hasAudio: info.hasAudio,
        audioMimeType: info.audioMimeType,
        audioChannels: info.audioChannels,
        audioSampleRate: info.audioSampleRate,
        audioBitrate: info.audioBitrate,
        importedAt: now,
        updatedAt: now,
      };
      const legacySource: Source = {
        id: sourceId,
        projectId,
        filename: videoSource.filename,
        role,
        fps,
        frameCount: 0,
        durationMs: info.durationMs,
        width: info.width,
        height: info.height,
        fileSize: videoSource.sizeBytes,
        lock: null,
        createdAt: now,
      };
      await idbBatch([
        { kind: "put", store: "videoSources", key: sourceId, value: videoSource },
        { kind: "put", store: "sources", key: sourceId, value: legacySource },
      ]);
      const project = get().projects.find((item) => item.id === projectId);
      if (project) {
        const next = {
          ...project,
          fps: role === "primary" ? fps : project.fps,
          updatedAt: Date.now(),
        };
        await idbPut("projects", projectId, next);
        set({ projects: get().projects.map((item) => (item.id === projectId ? next : item)) });
      }
      set({
        sources: [...get().sources, legacySource],
        videoSources: [...get().videoSources, videoSource],
        busy: null,
        notice: index.indexVerified
          ? "Video indexed. Choose an extraction interval or define manual ranges."
          : "Video indexed. Its frame count could not be independently verified; preview and interval sampling remain available.",
      });
      return sourceId;
    } catch (error) {
      if (selectedUri) await FrameExtractor.deleteVideoData(selectedUri).catch(() => undefined);
      set({
        busy: null,
        error: error instanceof Error ? error.message : "Native video import failed.",
      });
      throw error;
    }
  },
  extractNativeVideoFrames: async (sourceId, selection) => {
    const videoSource = get().videoSources.find((item) => item.id === sourceId);
    const source = get().sources.find((item) => item.id === sourceId);
    if (!videoSource || !source) throw new Error("The indexed source video is no longer available.");
    set({ busy: "Preparing frame extraction…", error: null, notice: null });
    const timestamps: FrameTimeMapEntry[] = [];
    const pageSize = 5000;
    let selectedIndexes: number[];
    try {
      for (let start = 0; start < videoSource.frameCount; start += pageSize) {
        set({
          busy:
            "Reading timestamp page " +
            (Math.floor(start / pageSize) + 1) +
            " of " +
            Math.ceil(videoSource.frameCount / pageSize),
        });
        const page = await FrameExtractor.getFrameTimestampPage(
          videoSource.uri,
          start,
          Math.min(pageSize, videoSource.frameCount - start),
        );
        timestamps.push(...page.entries);
      }
      selectedIndexes =
        selection.mode === "interval"
          ? selectFrameIndexesByInterval(timestamps, selection.intervalMs, videoSource.durationMs)
          : selectFrameIndexesByRanges(timestamps, selection.ranges);
    } catch (error) {
      set({
        busy: null,
        error: error instanceof Error ? error.message : "Could not read the indexed video timeline.",
      });
      throw error;
    }
    if (!selectedIndexes.length) {
      set({ busy: null });
      throw new Error("The selected interval or ranges do not contain any video frames.");
    }

    let progressHandle: { remove: () => Promise<void> } | null = null;
    let completedFrames = 0;
    const extractedFrames: ExtractedFrame[] = [];
    try {
      progressHandle = await FrameExtractor.addProgressListener((event) => {
        if (event.operationId !== videoSource.frameIndexId + ":selection") return;
        const current = completedFrames + event.currentFrame;
        set({
          busy:
            "Extracting selected frames " +
            current.toLocaleString() +
            " of " +
            selectedIndexes.length.toLocaleString() +
            " (" +
            Math.round((current / selectedIndexes.length) * 100) +
            "%)",
        });
      });
      const chunkSize = 250;
      for (let start = 0; start < selectedIndexes.length; start += chunkSize) {
        const indexes = selectedIndexes.slice(start, start + chunkSize);
        set({
          busy:
            "Extracting frames " +
            (start + 1) +
            "–" +
            (start + indexes.length) +
            " of " +
            selectedIndexes.length,
        });
        const batch = await FrameExtractor.extractFrameSelection(
          videoSource.uri,
          indexes,
          0,
          95,
        );
        if (batch.extractedCount !== indexes.length || batch.frames.length !== indexes.length) {
          throw new Error(
            "Native extraction returned " +
              batch.frames.length +
              " of " +
              indexes.length +
              " selected frames.",
          );
        }
        extractedFrames.push(...batch.frames);
        completedFrames += batch.extractedCount;
      }

      const timestampsByIndex = new Map(
        timestamps.map((entry) => [entry.frameIndex, entry]),
      );
      const now = Date.now();
      const extractionMethod = selection.mode === "interval" ? "interval" : "range";
      const assets: FrameAsset[] = extractedFrames.map((frame, position) => {
        const timestamp = timestampsByIndex.get(frame.frameIndex);
        if (!timestamp) throw new Error("The timestamp index is incomplete for a selected frame.");
        return {
          id: sourceId + ":" + position,
          projectId: source.projectId,
          sourceVideoId: sourceId,
          frameIndex: position,
          sourceFrameIndex: frame.frameIndex,
          presentationTimeUs: frame.presentationTimeUs,
          durationUs: timestamp.durationUs,
          fullResolutionPath: frame.outputPath,
          width: frame.width,
          height: frame.height,
          fileSize: frame.fileSize,
          extractionMethod,
          isEdited: false,
          isReplacementCandidate: false,
          exactFrameIndex: frame.exactFrameIndex && videoSource.frameIndexVerified,
          createdAt: now,
        };
      });
      const fps =
        selection.mode === "interval"
          ? 1000 / selection.intervalMs
          : videoSource.averageFrameRate || videoSource.nominalFrameRate || source.fps;
      const nextSource: Source = {
        ...source,
        fps: Math.max(1, fps),
        frameCount: assets.length,
      };
      const nextVideoSource: VideoSource = { ...videoSource, updatedAt: now };
      const previousAssets = get().frameAssets.filter((asset) => asset.sourceVideoId === sourceId);
      const nextAssetIds = new Set(assets.map((asset) => asset.id));
      await idbBatch([
        ...previousAssets
          .filter((asset) => !nextAssetIds.has(asset.id))
          .map((asset) => ({
            kind: "delete" as const,
            store: "frameAssets",
            key: asset.id,
          })),
        ...assets.map((asset) => ({
          kind: "put" as const,
          store: "frameAssets",
          key: asset.id,
          value: asset,
        })),
        { kind: "put", store: "sources", key: sourceId, value: nextSource },
        { kind: "put", store: "videoSources", key: sourceId, value: nextVideoSource },
      ]);
      const extractedRangeCount = selection.mode === "manual" ? selection.ranges.length : 1;
      set({
        sources: get().sources.map((item) => (item.id === sourceId ? nextSource : item)),
        videoSources: get().videoSources.map((item) =>
          item.id === sourceId ? nextVideoSource : item,
        ),
        frameAssets: [
          ...get().frameAssets.filter((asset) => asset.sourceVideoId !== sourceId),
          ...assets,
        ],
        busy: null,
        notice:
          "Extracted " +
          assets.length +
          " frames from " +
          (selection.mode === "interval"
            ? "the full video at " + selection.intervalMs + " ms intervals."
            : extractedRangeCount + " manual range(s)."),
      });
      return assets.length;
    } catch (error) {
      set({
        busy: null,
        error: error instanceof Error ? error.message : "Frame extraction failed.",
      });
      throw error;
    } finally {
      await progressHandle?.remove().catch(() => undefined);
    }
  },
  deleteSource: async (id) => {
    const source = get().sources.find((item) => item.id === id);
    if (!source) return;
    await dropSourceMedia(source, get().edits, get().exports);
    for (const region of get().regions) {
      if (region.sourceId !== id) continue;
      if (region.blobKey) await idbDel("blobs", region.blobKey);
      await idbDel("regions", region.id);
    }
    await idbDel("sources", id);
    set({
      sources: get().sources.filter((item) => item.id !== id),
      edits: get().edits.filter((edit) => edit.sourceId !== id),
      regions: get().regions.filter((region) => region.sourceId !== id),
      exports: get().exports.filter((item) => item.sourceId !== id),
    });
    if (get().videoSources.some((item) => item.id === id)) await get().deleteVideoSource(id);
  },
  deleteFrame: async (sourceId, frameIndex) => {
    if (get().videoSources.some((item) => item.id === sourceId))
      throw new Error(
        "Timestamp-indexed native frames are preserved as source media. Use frame replacement instead of deleting a source frame.",
      );
    const source = get().sources.find((item) => item.id === sourceId);
    if (!source || frameIndex < 0 || frameIndex >= source.frameCount) return;
    if (source.frameCount <= 1) throw new Error("A take must keep at least one frame.");

    const lastIndex = source.frameCount - 1;
    const shiftedFrames = await Promise.all(
      Array.from({ length: lastIndex - frameIndex }, (_, offset) =>
        idbGet<Blob>("blobs", frameKey(sourceId, frameIndex + offset + 1)),
      ),
    );
    if (shiftedFrames.some((blob) => !blob))
      throw new Error("A frame is missing from this take. Refresh the library and try again.");

    const operations: IDBBatchOperation[] = [];
    shiftedFrames.forEach((blob, offset) => {
      operations.push({
        kind: "put",
        store: "blobs",
        key: frameKey(sourceId, frameIndex + offset),
        value: blob,
      });
    });
    operations.push({ kind: "delete", store: "blobs", key: frameKey(sourceId, lastIndex) });

    const edits = get().edits.filter((edit) => edit.sourceId === sourceId);
    for (const edit of edits) {
      if (edit.frameIndex === frameIndex) {
        operations.push({ kind: "delete", store: "edits", key: edit.id });
        if (edit.kind === "replace")
          operations.push({ kind: "delete", store: "blobs", key: edit.blobKey });
      } else if (edit.frameIndex > frameIndex) {
        operations.push({
          kind: "put",
          store: "edits",
          key: edit.id,
          value: { ...edit, frameIndex: edit.frameIndex - 1 },
        });
      }
    }

    const regions = get().regions.filter((region) => region.sourceId === sourceId);
    const updatedRegions = new Map<string, Region>();
    const deletedRegionIds = new Set<string>();
    for (const region of regions) {
      if (frameIndex < region.frameIn) {
        updatedRegions.set(region.id, {
          ...region,
          frameIn: region.frameIn - 1,
          frameOut: region.frameOut - 1,
        });
      } else if (frameIndex <= region.frameOut) {
        const next = { ...region, frameOut: region.frameOut - 1 };
        if (next.frameIn > next.frameOut) {
          operations.push({ kind: "delete", store: "regions", key: region.id });
          if (region.blobKey)
            operations.push({ kind: "delete", store: "blobs", key: region.blobKey });
          deletedRegionIds.add(region.id);
        } else updatedRegions.set(region.id, next);
      }
    }

    const updatedSource: Source = {
      ...source,
      frameCount: source.frameCount - 1,
      durationMs: Math.max(1, Math.round(((source.frameCount - 1) / source.fps) * 1000)),
    };
    operations.push({ kind: "put", store: "sources", key: sourceId, value: updatedSource });
    for (const region of updatedRegions.values()) {
      const old = regions.find((item) => item.id === region.id);
      if (old && (old.frameIn !== region.frameIn || old.frameOut !== region.frameOut)) {
        operations.push({ kind: "put", store: "regions", key: region.id, value: region });
      }
    }

    await idbBatch(operations);
    set({
      sources: get().sources.map((item) => (item.id === sourceId ? updatedSource : item)),
      edits: get()
        .edits.filter((edit) => edit.sourceId !== sourceId || edit.frameIndex !== frameIndex)
        .map((edit) =>
          edit.sourceId === sourceId && edit.frameIndex > frameIndex
            ? { ...edit, frameIndex: edit.frameIndex - 1 }
            : edit,
        ),
      regions: get()
        .regions.filter((region) => !deletedRegionIds.has(region.id))
        .map((region) => updatedRegions.get(region.id) ?? region),
      notice: `Removed frame ${frameIndex + 1}. Remaining frame edits and masks were kept in sync.`,
    });
  },
  setLock: async (sourceId, lock) => {
    const source = get().sources.find((item) => item.id === sourceId);
    if (!source) return;
    const next = { ...source, lock };
    await idbPut("sources", sourceId, next);
    set({ sources: get().sources.map((item) => (item.id === sourceId ? next : item)) });
  },
  upsertEdit: async (edit) => {
    const previous = get().edits.find(
      (item) =>
        item.sourceId === edit.sourceId &&
        item.frameIndex === edit.frameIndex &&
        item.kind === edit.kind,
    );
    if (edit.kind === "replace") {
      const blob = await idbGet<Blob>("blobs", edit.blobKey);
      if (!blob) throw new Error("The replacement frame was not stored.");
    }
    const operations: IDBBatchOperation[] = [
      { kind: "put", store: "edits", key: edit.id, value: edit },
    ];
    if (previous && previous.id !== edit.id) {
      operations.push({ kind: "delete", store: "edits", key: previous.id });
      if (previous.kind === "replace")
        operations.push({ kind: "delete", store: "blobs", key: previous.blobKey });
    }
    await idbBatch(operations);
    set({
      edits: [
        ...get().edits.filter((item) => item.id !== previous?.id && item.id !== edit.id),
        edit,
      ],
    });
  },
  clearFrame: async (sourceId, frameIndex) => {
    const doomed = get().edits.filter(
      (edit) => edit.sourceId === sourceId && edit.frameIndex === frameIndex,
    );
    for (const edit of doomed) {
      if (edit.kind === "replace") await idbDel("blobs", edit.blobKey);
      await idbDel("edits", edit.id);
    }
    set({
      edits: get().edits.filter(
        (edit) => !(edit.sourceId === sourceId && edit.frameIndex === frameIndex),
      ),
    });
  },
  addRegion: async (region) => {
    await idbPut("regions", region.id, region);
    set({ regions: [...get().regions, region] });
  },
  updateRegion: async (id, patch) => {
    const current = get().regions.find((region) => region.id === id);
    if (!current) return;
    const next: Region = { ...current, ...patch };
    await idbPut("regions", id, next);
    if (patch.blobKey && current.blobKey && current.blobKey !== patch.blobKey)
      await idbDel("blobs", current.blobKey);
    set({ regions: get().regions.map((region) => (region.id === id ? next : region)) });
  },
  deleteRegion: async (id) => {
    const region = get().regions.find((item) => item.id === id);
    if (region?.blobKey) await idbDel("blobs", region.blobKey);
    await idbDel("regions", id);
    set({ regions: get().regions.filter((region) => region.id !== id) });
  },
  upsertVideoSource: async (source) => {
    await idbPut("videoSources", source.id, source);
    set({ videoSources: [...get().videoSources.filter((item) => item.id !== source.id), source] });
  },
  upsertFrameAssets: async (assets) => {
    if (!assets.length) return;
    await idbBatch(
      assets.map((asset) => ({
        kind: "put" as const,
        store: "frameAssets",
        key: asset.id,
        value: asset,
      })),
    );
    const ids = new Set(assets.map((asset) => asset.id));
    set({ frameAssets: [...get().frameAssets.filter((asset) => !ids.has(asset.id)), ...assets] });
  },
  upsertRepairManifest: async (manifest) => {
    await idbPut("repairManifests", manifest.projectId, manifest);
    set({
      repairManifests: [
        ...get().repairManifests.filter((item) => item.projectId !== manifest.projectId),
        manifest,
      ],
    });
  },
  upsertRenderJob: async (job) => {
    await idbPut("renderJobs", job.id, job);
    set({ renderJobs: [...get().renderJobs.filter((item) => item.id !== job.id), job] });
  },
  upsertDetectedWatermarks: async (projectId, sourceVideoId, detections) => {
    const now = Date.now();
    const records: StoredDetectedWatermark[] = detections.map((detection) => ({
      id: detection.id,
      projectId,
      sourceVideoId,
      detection,
      createdAt: now,
    }));
    await idbBatch(
      records.map((record) => ({
        kind: "put" as const,
        store: "detectedWatermarks",
        key: record.id,
        value: record,
      })),
    );
    const ids = new Set(records.map((record) => record.id));
    set({
      detectedWatermarks: [
        ...get().detectedWatermarks.filter((record) => !ids.has(record.id)),
        ...records,
      ],
    });
  },
  upsertWatermarkRemoval: async (repair) => {
    await idbPut("watermarkRemovals", repair.id, repair);
    set({
      watermarkRemovals: [
        ...get().watermarkRemovals.filter((item) => item.id !== repair.id),
        repair,
      ],
    });
  },
  upsertTextRemoval: async (repair) => {
    await idbPut("textRemovals", repair.id, repair);
    set({ textRemovals: [...get().textRemovals.filter((item) => item.id !== repair.id), repair] });
  },
  deleteVideoSource: async (id) => {
    const source = get().videoSources.find((item) => item.id === id);
    if (!source) return;
    const assets = get().frameAssets.filter((item) => item.sourceVideoId === id);
    const jobs = get().renderJobs.filter((item) => item.sourceVideoId === id);
    const detections = get().detectedWatermarks.filter((item) => item.sourceVideoId === id);
    const watermarkJobs = get().watermarkRemovals.filter((item) => item.sourceVideoId === id);
    const textJobs = get().textRemovals.filter((item) => item.sourceVideoId === id);
    const manifest = get().repairManifests.find((item) => item.sourceVideoId === id);
    await idbBatch([
      { kind: "delete", store: "videoSources", key: id },
      ...assets.map((item) => ({ kind: "delete" as const, store: "frameAssets", key: item.id })),
      ...jobs.map((item) => ({ kind: "delete" as const, store: "renderJobs", key: item.id })),
      ...detections.map((item) => ({
        kind: "delete" as const,
        store: "detectedWatermarks",
        key: item.id,
      })),
      ...watermarkJobs.map((item) => ({
        kind: "delete" as const,
        store: "watermarkRemovals",
        key: item.id,
      })),
      ...textJobs.map((item) => ({ kind: "delete" as const, store: "textRemovals", key: item.id })),
      ...(manifest
        ? [{ kind: "delete" as const, store: "repairManifests", key: manifest.projectId }]
        : []),
    ]);
    await FrameExtractor.deleteVideoData(source.uri).catch(() => undefined);
    set({
      videoSources: get().videoSources.filter((item) => item.id !== id),
      frameAssets: get().frameAssets.filter((item) => item.sourceVideoId !== id),
      repairManifests: get().repairManifests.filter((item) => item.sourceVideoId !== id),
      renderJobs: get().renderJobs.filter((item) => item.sourceVideoId !== id),
      detectedWatermarks: get().detectedWatermarks.filter((item) => item.sourceVideoId !== id),
      watermarkRemovals: get().watermarkRemovals.filter((item) => item.sourceVideoId !== id),
      textRemovals: get().textRemovals.filter((item) => item.sourceVideoId !== id),
    });
  },
  saveExport: async (item, blob) => {
    await idbPut("blobs", item.blobKey, blob);
    try {
      await idbPut("exports", item.id, item);
      set({ exports: [item, ...get().exports], notice: `Saved ${item.filename}.` });
    } catch (error) {
      await idbDel("blobs", item.blobKey).catch(() => undefined);
      throw error;
    }
  },
  deleteExport: async (id) => {
    const item = get().exports.find((entry) => entry.id === id);
    if (!item) return;
    await idbDel("blobs", item.blobKey);
    await idbDel("exports", id);
    set({ exports: get().exports.filter((entry) => entry.id !== id) });
  },
}));

export type { Grade, RegionKind, ProjectStatus };