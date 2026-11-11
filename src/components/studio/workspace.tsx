import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Columns2,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  FileText,
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
import { getDiagnosticReport, recordDiagnosticError } from "@/lib/diagnostics";
import { FrameExtractor } from "@/lib/native/frame-extractor";
import { TOOLS, type ToolId } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { BlurTool } from "@/components/studio/blur-tool";
import { CompareTool } from "@/components/studio/compare-tool";
import { ExportTool } from "@/components/studio/export-tool";
import { FaceTool } from "@/components/studio/face-tool";
import { FrameTool } from "@/components/studio/frame-tool";
import type { FrameAction } from "@/components/studio/stage";
import { useBaseFrames, useRegionAssets, useReplacements } from "@/components/studio/use-frames";
import { Button, Select } from "@/components/studio/ui";

function formatTimelineTime(milliseconds: number): string {
  const value = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const millis = value % 1000;
  const clock = [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":") +
    "." + String(millis).padStart(3, "0");
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
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const ready = useStudio((state) => state.ready);
  const projects = useStudio((state) => state.projects);
  const sources = useStudio((state) => state.sources);
  const videoSources = useStudio((state) => state.videoSources);
  const frameAssets = useStudio((state) => state.frameAssets);
  const edits = useStudio((state) => state.edits);
  const regions = useStudio((state) => state.regions);
  const importVideo = useStudio((state) => state.importVideo);
  const importNativeVideo = useStudio((state) => state.importNativeVideo);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const deleteFrame = useStudio((state) => state.deleteFrame);
  async function exportDiagnostics() {
    setExportingDiagnostics(true);
    try {
      const nativeLog = Capacitor.getPlatform() === "android"
        ? (await FrameExtractor.getNativeDiagnostics()).text
        : undefined;
      const report = getDiagnosticReport(nativeLog);
      const filename = "Frame-Fusion-Studio-diagnostics-" +
        new Date().toISOString().replace(/[:.]/g, "-") + ".txt";
      if (Capacitor.getPlatform() === "android") {
        const file = await Filesystem.writeFile({
          path: filename, data: report, directory: Directory.Cache, encoding: Encoding.UTF8,
        });
        await Share.share({
          title: "Frame Fusion Studio diagnostics",
          text: "Import diagnostics from the Android debug build.",
          url: file.uri,
          dialogTitle: "Share diagnostic log",
        });
      } else {
        const url = window.URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      recordDiagnosticError("diagnostics.export-failed", error);
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not export diagnostics." });
    } finally {
      setExportingDiagnostics(false);
    }
  }

  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const source =
    mine.find((item) => item.id === sourceId) ??
    mine.find((item) => item.role === "primary") ??
    mine[0];
  const videoSource = videoSources.find((item) => item.id === source?.id);
  const sourceFrameTimesUs = useMemo(() => {
    if (!source) return [];
    const indexedTimes = new Map<number, number>();
    for (const asset of frameAssets) {
      if (asset.sourceVideoId === source.id) {
        indexedTimes.set(asset.frameIndex, asset.presentationTimeUs);
      }
    }
    const fallbackRate = Math.max(1, source.fps || 24);
    return Array.from({ length: source.frameCount }, (_, index) =>
      indexedTimes.get(index) ?? Math.round((index * 1_000_000) / fallbackRate),
    );
  }, [frameAssets, source]);
  const { urls, loading } = useBaseFrames(source, frameAssets);
  const replacements = useReplacements(source?.id, edits);
  const regionAssets = useRegionAssets(source?.id, regions);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const selectedTimeUs = sourceFrameTimesUs[frameIndex] ?? 0;
  const timelineStartUs = sourceFrameTimesUs[0] ?? 0;
  const selectedTimeMs = Math.max(0, (selectedTimeUs - timelineStartUs) / 1000);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameImageRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ sourceId: string; projectId: string; frameIndex: number } | null>(
    null,
  );

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
      ? Math.max(currentPts + 1, source.durationMs * 1000)
      : (sourceFrameTimesUs[nextIndex] ?? currentPts + 1);
    const fallbackDelay = 1000 / Math.max(1, source.fps || 24);
    const delayMs = Math.max(1, (nextPts > currentPts ? nextPts - currentPts : fallbackDelay * 1000) / 1000);
    const timer = window.setTimeout(() => setFrameIndex(nextIndex), delayMs);
    return () => window.clearTimeout(timer);
  }, [playing, source, frameIndex, sourceFrameTimesUs]);

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

  function onFrameAction(action: FrameAction, index: number) {
    if (!source) return;
    setPlaying(false);
    if (action === "edit") {
      setFrameIndex(index);
      openTool("frames");
      setToolsOpen(false);
      setEditOpen(true);
      return;
    }
    if (action === "replace") {
      setFrameIndex(index);
      replaceTarget.current = {
        sourceId: source.id,
        projectId: source.projectId,
        frameIndex: index,
      };
      frameImageRef.current?.click();
      return;
    }
    void deleteFrame(source.id, index)
      .then(() =>
        setFrameIndex((current) =>
          Math.min(current > index ? current - 1 : current, source.frameCount - 2),
        ),
      )
      .catch((error) =>
        useStudio.setState({
          error: error instanceof Error ? error.message : "Could not remove that frame.",
        }),
      );
  }

  async function onReplacementImage(file: File) {
    const target = replaceTarget.current;
    replaceTarget.current = null;
    if (!target) return;
    if (!file.type.startsWith("image/")) {
      useStudio.setState({ error: "Choose an image file to replace this frame." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      useStudio.setState({ error: "Keep replacement images under 20 MB." });
      return;
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
      useStudio.setState({ notice: `Frame ${target.frameIndex + 1} was replaced.` });
    } catch (error) {
      await idbDel("blobs", blobKey).catch(() => undefined);
      useStudio.setState({
        error: error instanceof Error ? error.message : "Could not replace that frame.",
      });
    }
  }

  async function onNativeImport() {
    if (!project) return;
    try {
      const id = await importNativeVideo(project.id);
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

  function openVideoPicker() {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      void onNativeImport();
      return;
    }
    fileRef.current?.click();
  }

  async function onFile(file: File) {
    if (!project) return;
    try {
      // Browser fallback only: native Android import indexes every source frame and uses source PTS.
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
          <button
            type="button"
            aria-label="Export diagnostic log"
            title="Export diagnostic log"
            disabled={exportingDiagnostics}
            onClick={() => void exportDiagnostics()}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50"
          >
            <FileText className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Project settings"
            title="Project settings"
            onClick={() => void navigate({
              to: "/projects/$projectId/settings",
              params: { projectId },
              search: { tool, source: source?.id },
            })}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Settings2 className="size-4" aria-hidden="true" />
          </button>
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
              {videoSource.hasVariableFrameRate ? "VFR" : (videoSource.nominalFrameRate || videoSource.averageFrameRate).toFixed(2) + " FPS"}
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
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void onReplacementImage(file);
              else replaceTarget.current = null;
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

        {source ? (
          <section className="studio-timeline shrink-0 border-b border-line bg-surface px-3 py-2.5 sm:px-5" aria-label="Video timeline">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous frame"
                title="Previous frame"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                onClick={() => { setPlaying(false); setFrameIndex((value) => Math.max(0, value - 1)); }}
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <output className="min-w-0 flex-1 text-center font-mono text-sm tabular-nums" aria-live="off">
                {formatTimelineTime(selectedTimeMs)}
              </output>
              <label className="flex shrink-0 items-center gap-1">
                <span className="sr-only">Seek to time in seconds</span>
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label="Seek to time in seconds"
                  min={0}
                  max={Math.max(0, source.durationMs / 1000)}
                  step={0.001}
                  value={(selectedTimeUs / 1_000_000).toFixed(3)}
                  onChange={(event) => {
                    const seconds = Number(event.target.value);
                    if (Number.isFinite(seconds)) {
                      setPlaying(false);
                      setFrameIndex(nearestFrameIndexForTime(
                        sourceFrameTimesUs,
                        timelineStartUs + Math.min(source.durationMs, Math.max(0, seconds * 1000)) * 1000,
                      ));
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
                title="Next frame"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                onClick={() => { setPlaying(false); setFrameIndex((value) => Math.min(source.frameCount - 1, value + 1)); }}
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
            <input
              type="range"
              aria-label="Seek by video time in seconds"
              min={0}
              max={Math.max(1, source.durationMs)}
              step={1}
              value={Math.min(Math.max(0, source.durationMs), selectedTimeMs)}
              onChange={(event) => {
                setPlaying(false);
                setFrameIndex(nearestFrameIndexForTime(sourceFrameTimesUs, timelineStartUs + Number(event.target.value) * 1000));
              }}
              className="mt-1.5 h-5 w-full cursor-pointer accent-amber"
            />
            <div className="flex justify-between font-mono text-[9px] text-muted">
              <span>00:00.000</span>
              <span>{formatTimelineTime(source.durationMs)}</span>
            </div>
          </section>
        ) : null}
        {videoSource ? (
          <details className="shrink-0 border-b border-line bg-bg px-4 py-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted">
              Video metadata · {videoSource.width}×{videoSource.height} · {videoSource.frameCount.toLocaleString()} indexed frames
            </summary>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-xs sm:grid-cols-3">
              <div><p className="text-muted">Duration</p><p className="font-mono">{formatTimelineTime(videoSource.durationMs)}</p></div>
              <div><p className="text-muted">Original / nominal FPS</p><p className="font-mono">{videoSource.nominalFrameRate > 0 ? videoSource.nominalFrameRate.toFixed(3) : "Not reported"}</p></div>
              <div><p className="text-muted">Measured average FPS</p><p className="font-mono">{videoSource.averageFrameRate > 0 ? videoSource.averageFrameRate.toFixed(3) : "Not available"}</p></div>
              <div><p className="text-muted">Capture FPS</p><p className="font-mono">{videoSource.captureFrameRate ? videoSource.captureFrameRate.toFixed(3) : "Not reported"}</p></div>
              <div><p className="text-muted">Video codec</p><p className="break-all">{videoSource.videoMimeType || "Unknown"}</p></div>
              <div><p className="text-muted">Video bitrate</p><p className="font-mono">{videoSource.videoBitrate > 0 ? Math.round(videoSource.videoBitrate / 1000) + " kb/s" : "Not reported"}</p></div>
              <div><p className="text-muted">Rotation</p><p className="font-mono">{videoSource.rotation}°</p></div>
              <div><p className="text-muted">Frame timing</p><p>{videoSource.hasVariableFrameRate ? "Variable frame rate" : "Constant / not flagged VFR"}</p></div>
              <div><p className="text-muted">Timestamp index</p><p>{videoSource.frameIndexVerified ? "Metadata count verified" : "Built; independent count not verified"}</p></div>
              <div><p className="text-muted">Audio</p><p>{videoSource.hasAudio ? (videoSource.audioMimeType || "Audio track") : "No audio track"}</p></div>
              {videoSource.audioChannels ? <div><p className="text-muted">Audio channels</p><p>{videoSource.audioChannels}</p></div> : null}
              {videoSource.audioSampleRate ? <div><p className="text-muted">Audio sample rate</p><p>{videoSource.audioSampleRate.toLocaleString()} Hz</p></div> : null}
              {videoSource.audioBitrate ? <div><p className="text-muted">Audio bitrate</p><p>{Math.round(videoSource.audioBitrate / 1000)} kb/s</p></div> : null}
            </div>
            <div className="border-t border-line py-2">
              <h3 className="text-xs font-semibold">Embedded / EXIF-style metadata</h3>
              <p className="mt-1 text-[10px] leading-4 text-muted">Video containers do not always contain a standalone EXIF block. These are the date, location and descriptive tags Android can read from this file.</p>
              {Object.keys(videoSource.embeddedMetadata ?? {}).length ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {Object.entries(videoSource.embeddedMetadata ?? {}).map(([key, value]) => (
                    <div key={key} className="min-w-0"><dt className="text-muted">{key}</dt><dd className="break-words">{value}</dd></div>
                  ))}
                </dl>
              ) : <p className="mt-2 text-xs text-muted">No embedded descriptive tags were exposed by Android for this file.</p>}
            </div>
            {videoSource.tracks?.length ? (
              <div className="border-t border-line py-2">
                <h3 className="text-xs font-semibold">Media tracks</h3>
                <div className="mt-2 space-y-2">
                  {videoSource.tracks.map((track) => (
                    <div key={track.trackIndex} className="rounded-md bg-surface p-2 text-[11px]">
                      <p className="font-medium">Track {track.trackIndex} · {track.mimeType}</p>
                      <p className="mt-1 text-muted">
                        {[track.width && track.height ? track.width + "×" + track.height : null,
                          track.frameRate ? track.frameRate + " fps" : null,
                          track.channelCount ? track.channelCount + " channels" : null,
                          track.sampleRate ? track.sampleRate.toLocaleString() + " Hz" : null,
                          track.bitRate ? Math.round(track.bitRate / 1000) + " kb/s" : null,
                          track.durationUs ? formatTimelineTime(track.durationUs / 1000) : null,
                          track.profile ? "profile " + track.profile : null,
                          track.level ? "level " + track.level : null,
                          track.language].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </details>
        ) : null}
        <main className="flex min-h-0 flex-1 flex-col">
          {!source ? (
            <div className="m-auto max-w-md px-6 py-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-amber">
                <Film className="size-6" aria-hidden="true" />
              </span>
              <p className="studio-kicker mt-5">FIRST TAKE</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                Bring a clip into the atlas
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
                Frames are extracted on this device at the selected rate and original decoded
                dimensions. Longer clips may take more time and storage.
              </p>
              <Button className="mt-5" onClick={openVideoPicker}>
                <Upload className="size-4" aria-hidden="true" />
                Import video
              </Button>
            </div>
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