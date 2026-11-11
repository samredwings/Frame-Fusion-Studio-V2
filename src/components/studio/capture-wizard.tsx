import { useMemo, useRef, useState } from "react";
import { Clock3, Hand, Plus, Scissors, Trash2, X } from "lucide-react";
import type { NativeVideoCapturePlan, CaptureMethod, CaptureRange } from "@/lib/studio/extraction-plan";
import type { PickedVideo, VideoInfo, FrameIndexResult } from "@/lib/native/frame-extractor";
import { Button } from "@/components/studio/ui";

type PendingVideo = {
  picked: PickedVideo;
  previewUrl: string;
  info: VideoInfo;
  index: FrameIndexResult;
};

type Props = {
  video: PendingVideo;
  busy: string | null;
  onCancel: () => void;
  onExtract: (plan: NativeVideoCapturePlan) => void;
};

function formatTime(milliseconds: number) {
  const value = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1_000);
  const millis = value % 1_000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function CaptureWizard({ video, busy, onCancel, onExtract }: Props) {
  const durationMs = Math.max(200, video.info.durationMs || video.index.durationUs / 1_000);
  const [method, setMethod] = useState<CaptureMethod>("manual");
  const [intervalMs, setIntervalMs] = useState(200);
  const [draftStart, setDraftStart] = useState(0);
  const [draftEnd, setDraftEnd] = useState(durationMs);
  const [ranges, setRanges] = useState<CaptureRange[]>([]);
  const playerRef = useRef<HTMLVideoElement>(null);
  const isExtracting = Boolean(busy?.startsWith("Reading exact frame timestamps") || busy?.startsWith("Extracting selected frames"));

  const estimatedFrames = useMemo(() => ranges.reduce((total, range) => {
    const span = range.endMs - range.startMs;
    return total + (method === "interval"
      ? Math.max(1, Math.floor(span / intervalMs) + 1)
      : Math.max(1, Math.ceil((span / 1_000) * (video.index.averageFrameRate || video.index.nominalFrameRate || 24))));
  }, 0), [ranges, method, intervalMs, video.index.averageFrameRate, video.index.nominalFrameRate]);

  function addRange() {
    if (ranges.length >= 25) return;
    const next: CaptureRange = {
      id: crypto.randomUUID(),
      startMs: Math.round(draftStart),
      endMs: Math.round(draftEnd),
    };
    if (next.endMs <= next.startMs) return;
    setRanges((current) => [...current, next]);
    if (next.endMs < durationMs) {
      setDraftStart(next.endMs);
      setDraftEnd(durationMs);
    }
  }

  function removeRange(id: string) {
    setRanges((current) => current.filter((range) => range.id !== id));
  }

  function updateStart(value: number) {
    const next = Math.max(0, Math.min(Math.round(value), draftEnd - 200));
    setDraftStart(next);
    if (playerRef.current) playerRef.current.currentTime = next / 1_000;
  }

  function updateEnd(value: number) {
    const next = Math.max(draftStart + 200, Math.min(Math.round(value), durationMs));
    setDraftEnd(next);
    if (playerRef.current) playerRef.current.currentTime = next / 1_000;
  }

  function beginExtraction() {
    if (!ranges.length || isExtracting) return;
    onExtract({
      picked: video.picked,
      info: video.info,
      index: video.index,
      method,
      intervalMs,
      ranges,
    });
  }

  return (
    <section className="capture-wizard flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-5 pt-3 sm:px-5">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="studio-kicker">VIDEO EXTRACTION</p>
          <h2 className="truncate font-display text-lg font-semibold">{video.picked.filename || video.info.filename || "Selected video"}</h2>
          <p className="text-xs text-muted">{formatTime(durationMs)} · {video.info.width}×{video.info.height} · {video.index.frameCount.toLocaleString()} source frames</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cancel video selection" disabled={isExtracting} className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-muted shadow-[var(--shadow-border)] hover:text-fg disabled:opacity-40">
          <X className="size-5" />
        </button>
      </div>

      <div className="capture-player-wrap flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-black">
        <video
          ref={playerRef}
          className="capture-player"
          src={video.previewUrl}
          controls
          playsInline
          preload="metadata"
          aria-label="Video playback preview"
        >
          Your browser cannot play this selected video.
        </video>
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose extraction method">
        <button type="button" aria-pressed={method === "manual"} disabled={isExtracting} onClick={() => setMethod("manual")} className={`capture-method-card ${method === "manual" ? "is-active" : ""}`}>
          <span className="grid size-10 place-items-center rounded-xl bg-surface-2"><Hand className="size-5" /></span>
          <span className="min-w-0 text-left"><strong>Manual range</strong><small>Choose exact start and end points</small></span>
        </button>
        <button type="button" aria-pressed={method === "interval"} disabled={isExtracting} onClick={() => setMethod("interval")} className={`capture-method-card ${method === "interval" ? "is-active" : ""}`}>
          <span className="grid size-10 place-items-center rounded-xl bg-surface-2"><Clock3 className="size-5" /></span>
          <span className="min-w-0 text-left"><strong>Time interval</strong><small>Capture at a fixed time cadence</small></span>
        </button>
      </div>

      {method === "interval" ? (
        <div className="capture-settings rounded-2xl border border-line bg-surface px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="capture-interval" className="text-sm font-medium">Capture interval</label>
            <strong className="font-mono text-sm text-cyan">{intervalMs} ms</strong>
          </div>
          <input id="capture-interval" type="range" min={200} max={5_000} step={100} value={intervalMs} onChange={(event) => setIntervalMs(Number(event.target.value))} disabled={isExtracting} className="mt-3 h-8 w-full accent-cyan" />
          <div className="flex justify-between text-[10px] text-muted"><span>200 ms · denser</span><span>5 s · fewer frames</span></div>
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted">Move the left and right handles to mark the exact section. Manual mode extracts each original frame inside every saved range.</p>
      )}

      <div className="capture-range-card rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-semibold">Select a time range</p><p className="text-[11px] text-muted