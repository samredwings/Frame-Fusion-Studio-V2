import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FrameExtractor, type PickedVideo } from "@/lib/native/frame-extractor";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Columns2,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Scan,
  ScanFace,
  Settings2,
  SlidersHorizontal,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { idbDel, idbPut } from "@/lib/studio/idb";
import { useStudio } from "@/lib/studio/store";
import { TOOLS, type ToolId } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { BlurTool } from "@/components/studio/blur-tool";
import { CompareTool } from "@/components/studio/compare-tool";
import { ExportTool } from "@/components/studio/export-tool";
import { FaceTool } from "@/components/studio/face-tool";
import { FrameTool } from "@/components/studio/frame-tool";
import { ExtractionPanel } from "@/components/studio/extraction-panel";
import { cleanupPendingNativeCapture } from "@/lib/studio/native-ownership";
import { downloadFrameAsset, saveBlobToDevice } from "@/lib/studio/download";
import type { FrameAction } from "@/components/studio/stage";
import { useBaseFrames, useRegionAssets, useReplacements } from "@/components/studio/use-frames";
import { Button, Select } from "@/components/studio/ui";

function formatTimelineTime(milliseconds: number): string {
  const value = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const millis = value % 1000;
  const clock = [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
    + "." + String(millis).padStart(3, "0");
  return hours > 0 ? String(hours).padStart(2, "0") + ":" + clock : clock;
}

function nearestFrameIndexForTime(timestampsUs: number[], targetUs: number): number {
  if (!timestampsUs.length) return 0;
  let low = 0;
  let high = timestampsUs.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((timestampsUs[middle] ?? 0) < targetUs) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  const before = timestampsUs[low - 1] ?? 0;
  const after = timestampsUs[low] ?? before;
  return targetUs - before <= after - targetUs ? low - 1 : low;
}

const toolMeta: Record<ToolId, { label: string; Icon: LucideIcon }> = {
  frames: { label: "Frames", Icon: Film },
  compare: { label: "Compare", Icon: Columns2 },
  blur: { label: "Masks", Icon: Scan },
  faces: { label: "FaceSync", Icon: ScanFace },
  export: { label: "Export", Icon: Download },
};

export function Workspace({
  projectId,
  tool,
  sourceId,
}: {
  projectId: string;
  tool: ToolId;
  sourceId?: string;
}) {
  const navigate = useNavigate();
  const ready = useStudio((state) => state.ready);
  const projects = useStudio((state) => state.projects);
  const sources = useStudio((state) => state.sources);
  const videoSources = useStudio((state) => state.videoSources);
  const frameAssets = useStudio((state) => state.frameAssets);
  const busy = useStudio((state) => state.busy);
  const edits = useStudio((state) => state.edits);
  const regions = useStudio((state) => state.regions);
  const importVideo = useStudio((state) => state.importVideo);
  const createNativeVideoSource = useStudio((state) => state.createNativeVideoSource);
  const deleteSource = useStudio((state) => state.deleteSource);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const deleteFrame = useStudio((state) => state.deleteFrame);
  const [frameIndex, setFrameIndex] = useState(0);
  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const source =
    mine.find((item) => item.id === sourceId) ??
    mine.find((item) => item.role === "primary") ??
    mine[0];
  const videoSource = videoSources.find((item) => item.id === source?.id);
  const isNativeExtractionPending = Boolean(videoSource && videoSource.extractionComplete === false);
  const sourceFrameTimesUs = useMemo(() => {
    if (!source || isNativeExtractionPending) return [];
    const nativeAssets = frameAssets
      .filter((asset) => asset.sourceVideoId === source.id)
      .sort((a, b) => a.frameIndex - b.frameIndex);
    if (nativeAssets.length === source.frameCount) {
      return nativeAssets.map((asset) => asset.presentationTimeUs);
    }
    const fallbackRate = Math.max(1, source.fps || 24);
    return Array.from({ length: source.frameCount }, (_, index) =>
      Math.round((index * 1_000_000) / fallbackRate),
    );
  }, [frameAssets, isNativeExtractionPending, source]);
  const timelineStartUs = videoSource?.frameIndexDiagnostics?.firstPtsUs
    ?? sourceFrameTimesUs[0]
    ?? 0;
  const timelineDurationMs = Math.max(1, videoSource?.durationMs ?? source?.durationMs ?? 1);
  const timelineEndUs = timelineStartUs + timelineDurationMs * 1000;
  const selectedTimeUs = sourceFrameTimesUs[frameIndex] ?? timelineStartUs;
  const selectedTimeMs = Math.max(0, (selectedTimeUs - timelineStartUs) / 1000);
  const { urls, loading } = useBaseFrames(isNativeExtractionPending ? undefined : source, frameAssets);
  const replacements = useReplacements(source?.id, edits);
  const regionAssets = useRegionAssets(source?.id, regions);
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [nativePreparing, setNativePreparing] = useState(false);
  const replaceTargets = useRef<Array<{ sourceId: string; projectId: string; frameIndex: number }>>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready || !source || source.id === sourceId) return;
    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
      search: { tool, source: source.id },
      replace: true,
    });
  }, [ready, source, sourceId, tool, projectId, navigate]);

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
    setEditOpen(false);
  }, [source?.id]);

  useEffect(() => {
    if (!editOpen && !toolsOpen) return;
    function closePanels(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditOpen(false);
        setToolsOpen(false);
      }
    }
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, [editOpen, toolsOpen]);

  useEffect(() => {
    if (!playing || !source?.frameCount) return;
    const nextIndex = (frameIndex + 1) % source.frameCount;
    const currentPts = sourceFrameTimesUs[frameIndex] ?? 0;
    const nextPts = nextIndex === 0
      ? Math.max(currentPts + 1, timelineEndUs)
      : (sourceFrameTimesUs[nextIndex] ?? currentPts + Math.round(1_000_000 / Math.max(1, source.fps || 24)));
    const fallbackDelay = 1000 / Math.max(1, source.fps || 24);
    const delayMs = Math.max(1, nextPts > currentPts ? (nextPts - currentPts) / 1000 : fallbackDelay);
    const timer = window.setTimeout(() => setFrameIndex(nextIndex), delayMs);
    return () => window.clearTimeout(timer);
  }, [playing, source, videoSource, frameIndex, sourceFrameTimesUs, timelineEndUs]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (editOpen || toolsOpen) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;
      if (!source) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setFrameIndex((current) => Math.min(source.frameCount - 1, current + 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setFrameIndex((current) => Math.max(0, current - 1));
      } else if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key >= "1" && event.key <= "5") {
        const next = TOOLS[Number(event.key) - 1];
        if (next) {
          void navigate({
            to: "/projects/$projectId",
            params: { projectId },
            search: { tool: next.id, source: source.id },
          });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, navigate, projectId, editOpen, toolsOpen]);

  function openTool(next: ToolId) {
    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
      search: { tool: next, source: source?.id },
    });
  }

  function onReplaceFrames(indexes: number[]) {
    if (!source || !indexes.length) return;
    setPlaying(false);
    replaceTargets.current = [...new Set(indexes)]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < source.frameCount)
      .sort((a, b) => a - b)
      .map((frameIndex) => ({ sourceId: source.id, projectId: source.projectId, frameIndex }));
    if (replaceTargets.current.length) frameImageRef.current?.click();
  }

  async function onFrameAction(action: FrameAction, index: number) {
    if (!source) return;
    setPlaying(false);
    if (action === "download") {
      const asset = frameAssets.find((item) => item.sourceVideoId === source.id && item.frameIndex === index);
      try {
        if (asset) {
          await downloadFrameAsset(asset, source.filename);
        } else {
          const url = urls[index];
          if (!url) throw new Error("That frame is not available for download.");
          const response = await fetch(url);
          if (!response.ok) throw new Error("Could not read the selected frame.");
          const blob = await response.blob();
          await saveBlobToDevice(blob, `${source.filename.replace(/\.\w+$/, "")}-frame-${String(index + 1).padStart(5, "0")}.jpg`);
        }
      } catch (error) {
        useStudio.setState({ error: error instanceof Error ? error.message : "Could not download that frame." });
      }
      return;
    }
    if (action === "edit") {
      setFrameIndex(index);
      openTool("frames");
      setToolsOpen(false);
      setEditOpen(true);
      return;
    }
    if (action === "replace") {
      setFrameIndex(index);
      onReplaceFrames([index]);
      return;
    }
    void deleteFrame(source.id, index)
      .then(() => setFrameIndex((current) => Math.min(current > index ? current - 1 : current, source.frameCount - 2)))
      .catch((error) => useStudio.setState({
        error: error instanceof Error ? error.message : "Could not remove that frame.",
      }));
  }

  async function onReplacementImages(files: File[]) {
    const targets = replaceTargets.current;
    replaceTargets.current = [];
    if (!targets.length) return;
    if (files.length !== targets.length) {
      useStudio.setState({ error: `Select exactly ${targets.length} image${targets.length === 1 ? "" : "s"} to replace the selected frames.` });
      return;
    }
    let completed = 0;
    for (let index = 0; index < targets.length; index += 1) {
      const file = files[index];
      const target = targets[index];
      if (!file || !target) continue;
      if (!file.type.startsWith("image/")) {
        useStudio.setState({ error: `File ${index + 1} is not an image.` });
        break;
      }
      if (file.size > 20 * 1024 * 1024) {
        useStudio.setState({ error: `Keep replacement images under 20 MB (file ${index + 1}).` });
        break;
      }
      const id = crypto.randomUUID();
      const blobKey = `r:${id}`;
      try {
        await idbPut("blobs", blobKey, file);
        await upsertEdit({
          id,
          projectId: target.projectId,
          sourceId: target.sourceId,
          frameIndex: target.frameIndex,
          kind: "replace",
          blobKey,
        });
        completed += 1;
      } catch (error) {
        await idbDel("blobs", blobKey).catch(() => undefined);
        useStudio.setState({ error: error instanceof Error ? error.message : "Could not replace a selected frame." });
        break;
      }
    }
    if (completed) useStudio.setState({ notice: `Replaced ${completed} of ${targets.length} selected frame${targets.length === 1 ? "" : "s"}.` });
  }

  useEffect(() => {
    setIsNativeAndroid(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");
  }, []);

  async function onNativeImport() {
    if (!project || nativePreparing) return;
    const sourceId = crypto.randomUUID();
    let pickedForCleanup: PickedVideo | null = null;
    let storeCleanupOwnsPendingKey = false;
    setNativePreparing(true);
    useStudio.setState({ error: null, notice: null, busy: "Choose a source video…" });
    try {
      const picked = await FrameExtractor.pickVideo();
      pickedForCleanup = picked;
      useStudio.setState({ busy: "Reading video metadata…" });
      const info = await FrameExtractor.getVideoInfo(picked.uri);
      useStudio.setState({ busy: "Building the source-owned timestamp index…" });
      const index = await FrameExtractor.buildFrameIndex(picked.uri, sourceId);
      if (!index.frameCount || index.indexId !== sourceId) {
        throw new Error("No frames could be indexed with the selected source storage key.");
      }
      storeCleanupOwnsPendingKey = true;
      const id = await createNativeVideoSource(project.id, sourceId, picked, info, index);
      setFrameIndex(0);
      void navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: { tool, source: id },
      });
    } catch (error) {
      if (pickedForCleanup && !storeCleanupOwnsPendingKey) {
        await cleanupPendingNativeCapture(
          useStudio.getState().videoSources,
          { sourceId, uri: pickedForCleanup.uri },
          (options) => FrameExtractor.deleteVideoData(options),
        ).catch(() => false);
      }
      useStudio.setState({
        busy: null,
        error: error instanceof Error ? error.message : "Could not prepare this video for extraction.",
      });
    } finally {
      setNativePreparing(false);
    }
  }

  async function cancelNativeExtraction() {
    if (!source || !isNativeExtractionPending) return;
    const id = source.id;
    try {
      await deleteSource(id);
      const remaining = useStudio.getState().sources.find((item) => item.projectId === projectId);
      void navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: { tool, source: remaining?.id },
      });
    } catch (error) {
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not cancel the indexed video import." });
    }
  }

  function openVideoPicker() {
    if (isNativeAndroid) {
      void onNativeImport();
      return;
    }
    fileRef.current?.click();
  }

  async function onFile(file: File) {
    if (!project) return;
    try {
      const id = await importVideo(project.id, file, 24);
      setFrameIndex(0);
      void navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: { tool, source: id },
      });
    } catch {
      /* The app-level status line explains import failures. */
    }
  }

  if (!ready) {
    return (
      <Shell>
        <p className="m-auto text-sm text-muted">Opening your local library…</p>
      </Shell>
    );
  }

  if (!project) {
    return (
      <Shell>
        <div className="m-auto max-w-md px-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Project unavailable</h1>
          <p className="mt-2 text-sm text-muted">This project isn’t in the on-device library.</p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm hover:bg-surface"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to projects
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      trail={
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link
            to="/"
            aria-label="Back to projects"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold sm:text-base">
              {project.name}
            </p>
            <p className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:block">
              LOCAL PROJECT
            </p>
          </div>
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            search={{ tool, source: source?.id }}
            aria-label="Project settings"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Settings2 className="size-4" aria-hidden="true" />
          </Link>
        </div>
      }
    >
      <div className="studio-workspace flex min-h-0 flex-1 flex-col">
        <div className="studio-toolbar flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
          <label className="min-w-0 flex-1" htmlFor="workspace-source">
            <span className="sr-only">Selected source</span>
            <Select
              id="workspace-source"
              className="studio-select w-full min-w-0"
              value={source?.id ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                if (next)
                  void navigate({
                    to: "/projects/$projectId",
                    params: { projectId },
                    search: { tool, source: next },
                  });
              }}
              aria-label="Selected source"
            >
              {!mine.length ? <option value="">Choose a take</option> : null}
              {mine.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {String(index + 1).padStart(2, "0")} · {item.filename}
                </option>
              ))}
            </Select>
          </label>
          {videoSource ? (
            <span className="hidden shrink-0 rounded-xl border border-line px-2.5 py-2 font-mono text-[10px] text-muted sm:inline-flex">
              {videoSource.hasVariableFrameRate
                ? "VFR"
                : (videoSource.nominalFrameRate || videoSource.averageFrameRate).toFixed(2) + " FPS"}
            </span>
          ) : null}
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="video/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={frameImageRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              if (files.length) void onReplacementImages(files);
              else replaceTargets.current = [];
              event.currentTarget.value = "";
            }}
          />
          <Button
            className="shrink-0 rounded-xl px-3"
            onClick={openVideoPicker}
            aria-label="Import a video take"
          >
            <Upload className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </div>

        {videoSource && source && !isNativeExtractionPending ? (
          <>
            <section className="shrink-0 border-b border-line bg-surface px-3 py-2.5 sm:px-5" aria-label="Video timeline">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous frame"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                  onClick={() => { setPlaying(false); setFrameIndex((value) => Math.max(0, value - 1)); }}
                ><ChevronLeft className="size-5" aria-hidden="true" /></button>
                <output className="min-w-0 flex-1 text-center font-mono text-sm tabular-nums">
                  {formatTimelineTime(selectedTimeMs)}
                </output>
                <label className="flex shrink-0 items-center gap-1">
                  <span className="sr-only">Seek to time in seconds</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="Seek to time in seconds"
                    min={0}
                    max={timelineDurationMs / 1000}
                    step={0.001}
                    value={(selectedTimeMs / 1000).toFixed(3)}
                    onChange={(event) => {
                      const seconds = Number(event.target.value);
                      if (Number.isFinite(seconds)) {
                        setPlaying(false);
                        const target = timelineStartUs + Math.min(videoSource.durationMs, Math.max(0, seconds * 1000)) * 1000;
                        setFrameIndex(nearestFrameIndexForTime(sourceFrameTimesUs, target));
                      }
                    }}
                    className="h-8 w-[4.75rem] rounded-md border border-line bg-bg px-1 text-center font-mono text-xs tabular-nums"
                  />
                  <span className="text-[10px] text-muted">s</span>
                </label>
                <span className="hidden shrink-0 text-[10px] text-muted sm:inline">Frame {frameIndex + 1}/{source.frameCount}</span>
                <button
                  type="button"
                  aria-label="Next frame"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                  onClick={() => { setPlaying(false); setFrameIndex((value) => Math.min(source.frameCount - 1, value + 1)); }}
                ><ChevronRight className="size-5" aria-hidden="true" /></button>
              </div>
              <input
                type="range"
                aria-label="Seek by video time in seconds"
                min={0}
                max={timelineDurationMs}
                step={1}
                value={Math.min(timelineDurationMs, selectedTimeMs)}
                onChange={(event) => {
                  setPlaying(false);
                  const target = timelineStartUs + Number(event.target.value) * 1000;
                  setFrameIndex(nearestFrameIndexForTime(sourceFrameTimesUs, target));
                }}
                className="mt-1.5 h-5 w-full cursor-pointer accent-amber"
              />
              <div className="flex justify-between font-mono text-[9px] text-muted">
                <span>00:00.000</span><span>{formatTimelineTime(timelineDurationMs)}</span>
              </div>
            </section>
            <details className="shrink-0 border-b border-line bg-bg px-4 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-muted">
                Video metadata · {videoSource.width}×{videoSource.height} · {videoSource.frameCount.toLocaleString()} indexed frames
              </summary>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-xs sm:grid-cols-3">
                <div><p className="text-muted">Duration</p><p className="font-mono">{formatTimelineTime(videoSource.durationMs)}</p></div>
                <div><p className="text-muted">Nominal FPS</p><p className="font-mono">{videoSource.nominalFrameRate > 0 ? videoSource.nominalFrameRate.toFixed(3) : "Not reported"}</p></div>
                <div><p className="text-muted">Average FPS</p><p className="font-mono">{videoSource.averageFrameRate > 0 ? videoSource.averageFrameRate.toFixed(3) : "Not available"}</p></div>
                <div><p className="text-muted">Capture FPS</p><p className="font-mono">{videoSource.captureFrameRate ? videoSource.captureFrameRate.toFixed(3) : "Not reported"}</p></div>
                <div><p className="text-muted">Video codec</p><p className="font-mono break-all">{videoSource.videoMimeType || "Not reported"}</p></div>
                <div><p className="text-muted">Video bitrate</p><p className="font-mono">{videoSource.videoBitrate > 0 ? `${Math.round(videoSource.videoBitrate / 1000)} kbps` : "Not reported"}</p></div>
                <div><p className="text-muted">Audio tracks</p><p className="font-mono">{videoSource.audioTrackCount ?? (videoSource.hasAudio ? 1 : 0)}</p></div>
                <div><p className="text-muted">Index integrity</p><p className="font-mono">{videoSource.frameIndexStructurallyValid === undefined ? "Legacy / unknown" : videoSource.frameIndexStructurallyValid ? "Structural checks passed" : "Structural checks failed"}</p></div>
                <div><p className="text-muted">Picture mapping</p><p className="font-mono">{videoSource.frameMappingConfidence ?? "unverified"}</p></div>
              </div>
              {videoSource.frameIndexDiagnostics ? (
                <p className="border-t border-line py-2 text-[11px] leading-5 text-muted">
                  Source PTS ordered: {videoSource.frameIndexDiagnostics.ptsSourceOrdered ? "yes" : "no"} · duplicates: {videoSource.frameIndexDiagnostics.ptsDuplicates} · negative: {videoSource.frameIndexDiagnostics.ptsNegative} · first/last: {videoSource.frameIndexDiagnostics.firstPtsUs}/{videoSource.frameIndexDiagnostics.lastPtsUs} µs · max gap: {videoSource.frameIndexDiagnostics.maxGapUs} µs
                </p>
              ) : null}
              {videoSource.embeddedMetadata && Object.keys(videoSource.embeddedMetadata).length ? (
                <div className="border-t border-line py-2">
                  <p className="mb-2 text-[11px] font-semibold text-muted">Embedded container tags</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
                    {Object.entries(videoSource.embeddedMetadata).map(([key, value]) => (
                      <div key={key} className="min-w-0"><dt className="text-muted">{key}</dt><dd className="break-words">{value}</dd></div>
                    ))}
                  </dl>
                </div>
              ) : null}
              {videoSource.tracks?.length ? (
                <div className="border-t border-line py-2">
                  <p className="mb-2 text-[11px] font-semibold text-muted">Media tracks</p>
                  <div className="space-y-1">
                    {videoSource.tracks.map((track) => (
                      <p key={track.trackIndex} className="font-mono text-[10px] leading-5 text-muted">
                        #{track.trackIndex} {track.mimeType} · {track.width ?? "—"}×{track.height ?? "—"} · {track.frameRate ?? "—"} FPS · {track.channelCount ? `${track.channelCount} ch` : ""} {track.sampleRate ? `${track.sampleRate} Hz` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {videoSource.metadataScope ? <p className="border-t border-line pt-2 text-[10px] leading-5 text-muted">{videoSource.metadataScope}</p> : null}
            </details>
          </>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col">
          {nativePreparing ? (
            <div className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center" role="status">
              <span className="size-8 animate-spin rounded-full border-2 border-cyan border-r-transparent" />
              <p className="text-sm text-muted">{busy || "Preparing your video preview…"}</p>
            </div>
          ) : !source ? (
            <div className="m-auto max-w-md px-6 py-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-amber">
                <Film className="size-6" aria-hidden="true" />
              </span>
              <p className="studio-kicker mt-5">FIRST TAKE</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                Bring a clip into the atlas
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
                Preview your video first, then choose Manual range or Time interval capture. Add
                multiple sections from the same clip and extract only the frames you need.
              </p>
              <Button className="mt-5" onClick={openVideoPicker}>
                <Upload className="size-4" aria-hidden="true" />
                Import video
              </Button>
            </div>
          ) : isNativeExtractionPending && videoSource ? (
            <ExtractionPanel videoSource={videoSource} onCancel={() => void cancelNativeExtraction()} />
          ) : loading || !urls.length ? (
            <p className="m-auto text-sm text-muted" role="status">
              Preparing frame rail…
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {tool === "frames" ? (
                <FrameTool
                  source={source}
                  urls={urls}
                  frameIndex={Math.min(frameIndex, urls.length - 1)}
                  playing={playing}
                  onSeek={setFrameIndex}
                  onToggle={() => setPlaying((value) => !value)}
                  onFrameAction={onFrameAction}
                  onReplaceFrames={onReplaceFrames}
                  previewRef={previewRef}
                  editorOpen={editOpen}
                  onCloseEditor={() => setEditOpen(false)}
                  onOpenTools={() => {
                    setEditOpen(false);
                    setToolsOpen(true);
                  }}
                  regionAssets={regionAssets}
                  onOpenPortrait={() => {
                    setEditOpen(false);
                    openTool("faces");
                  }}
                />
              ) : null}
              {tool === "compare" ? (
                <CompareTool
                  sources={mine}
                  primary={source}
                  urls={urls}
                  frameIndex={Math.min(frameIndex, urls.length - 1)}
                  onSeek={setFrameIndex}
                />
              ) : null}
              {tool === "blur" ? (
                <BlurTool
                  source={source}
                  urls={urls}
                  replacements={replacements}
                  regionAssets={regionAssets}
                  frameIndex={Math.min(frameIndex, urls.length - 1)}
                  playing={playing}
                  onSeek={setFrameIndex}
                  onToggle={() => setPlaying((value) => !value)}
                  onFrameAction={onFrameAction}
                />
              ) : null}
              {tool === "faces" ? (
                <FaceTool
                  source={source}
                  urls={urls}
                  replacements={replacements}
                  regionAssets={regionAssets}
                  frameIndex={Math.min(frameIndex, urls.length - 1)}
                  playing={playing}
                  onSeek={setFrameIndex}
                  onToggle={() => setPlaying((value) => !value)}
                  onFrameAction={onFrameAction}
                />
              ) : null}
              {tool === "export" ? (
                <ExportTool
                  source={source}
                  urls={urls}
                  replacements={replacements}
                  regionAssets={regionAssets}
                  frameIndex={Math.min(frameIndex, urls.length - 1)}
                  playing={playing}
                  onSeek={setFrameIndex}
                  onToggle={() => setPlaying((value) => !value)}
                  onFrameAction={onFrameAction}
                />
              ) : null}
            </div>
          )}
        </main>

        {!isNativeExtractionPending && !nativePreparing ? (
          <nav
            className="studio-dock flex shrink-0 items-center justify-between gap-3 px-3 sm:px-5"
            aria-label="Editor tools"
          >
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Editing</p>
            <p className="truncate text-sm font-semibold">{toolMeta[tool].label}</p>
          </div>
          <Button
            aria-expanded={editOpen}
            aria-controls="frame-edit-drawer"
            className="min-w-28 rounded-xl"
            onClick={() => {
              if (tool !== "frames") openTool("frames");
              setToolsOpen(false);
              setEditOpen((open) => (tool === "frames" ? !open : true));
            }}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Edit
          </Button>
          </nav>
        ) : null}
      </div>
      {toolsOpen ? (
        <div
          className="studio-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pt-8"
          onClick={() => setToolsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-picker-title"
            className="studio-sheet w-full max-w-lg rounded-t-3xl p-4 sm:mb-4 sm:rounded-3xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="studio-kicker">FRAME FUSION</p>
                <h2 id="tool-picker-title" className="mt-1 font-display text-2xl font-semibold">
                  Tools
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close tool picker"
                className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
                onClick={() => setToolsOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {TOOLS.map(({ id }) => {
                const { label, Icon } = toolMeta[id];
                return (
                  <button
                    key={id}
                    type="button"
                    autoFocus={id === tool}
                    className={`studio-sheet-action ${id === tool ? "bg-surface-2" : ""}`}
                    onClick={() => {
                      setToolsOpen(false);
                      openTool(id);
                    }}
                  >
                    <Icon className="size-5 text-amber" aria-hidden="true" />
                    <span>
                      <strong>{label}</strong>
                      <small>
                        {id === "frames"
                          ? "Adjust, replace, and save individual frames"
                          : id === "compare"
                            ? "Compare two takes side by side"
                            : id === "blur"
                              ? "Mask or blur selected regions"
                              : id === "faces"
                                ? "Track and stabilize a face lock"
                                : "Render and share the finished take"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}