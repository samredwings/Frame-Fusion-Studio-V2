import { useMemo, useState } from "react";
import { Clock3, Film, Plus, Scissors, Trash2 } from "lucide-react";
import { FrameExtractor } from "@/lib/native/frame-extractor";
import { useStudio } from "@/lib/studio/store";
import type { VideoSource } from "@/lib/studio/types";
import {
  getManualExtractionDurationMs,
  type ManualExtractionRange,
} from "@/lib/studio/extraction-selection";

type ExtractionMode = "interval" | "manual";

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = String(minutes).padStart(2, "0") + ":" + seconds.toFixed(1).padStart(4, "0");
  return hours ? String(hours).padStart(2, "0") + ":" + clock : clock;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function ExtractionPanel({ videoSource }: { videoSource: VideoSource }) {
  const extractNativeVideoFrames = useStudio((state) => state.extractNativeVideoFrames);
  const busy = useStudio((state) => state.busy);
  const error = useStudio((state) => state.error);
  const [mode, setMode] = useState<ExtractionMode>("interval");
  const [intervalMs, setIntervalMs] = useState(200);
  const [ranges, setRanges] = useState<ManualExtractionRange[]>([
    { startMs: 0, endMs: Math.min(videoSource.durationMs, 3000) },
  ]);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(Math.max(1, videoSource.durationMs));
  const [videoError, setVideoError] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const videoUrl = useMemo(
    () =>
      /^https?:\/\//i.test(videoSource.uri)
        ? videoSource.uri
        : FrameExtractor.toWebViewUrl(videoSource.uri),
    [videoSource.uri],
  );
  const estimatedFrames = useMemo(() => {
    if (mode === "interval") return Math.ceil(durationMs / intervalMs);
    const selectedDuration = getManualExtractionDurationMs(ranges);
    return Math.ceil((selectedDuration / 1000) * (videoSource.averageFrameRate || 24));
  }, [durationMs, intervalMs, mode, ranges, videoSource.averageFrameRate]);

  function updateRange(index: number, edge: "startMs" | "endMs", nextValue: number) {
    setRanges((current) =>
      current.map((range, rangeIndex) => {
        if (rangeIndex !== index) return range;
        const minimumSpan = Math.min(100, durationMs);
        return edge === "startMs"
          ? { ...range, startMs: clamp(nextValue, 0, Math.max(0, range.endMs - minimumSpan)) }
          : { ...range, endMs: clamp(nextValue, Math.min(durationMs, range.startMs + minimumSpan), durationMs) };
      }),
    );
  }

  function addRange() {
    const minimumSpan = Math.min(100, durationMs);
    const preferredSpan = Math.min(3000, durationMs);
    const ordered = [...ranges].sort((a, b) => a.startMs - b.startMs);
    const gaps: ManualExtractionRange[] = [];
    let cursor = 0;
    for (const range of ordered) {
      if (range.startMs - cursor >= minimumSpan) {
        gaps.push({ startMs: cursor, endMs: range.startMs });
      }
      cursor = Math.max(cursor, range.endMs);
    }
    if (durationMs - cursor >= minimumSpan) {
      gaps.push({ startMs: cursor, endMs: durationMs });
    }
    const gap = gaps.sort((a, b) =>
      (b.endMs - b.startMs) - (a.endMs - a.startMs),
    )[0];
    if (!gap) {
      setLocalError("The current ranges already cover the full video. Shorten a range before adding another section.");
      return;
    }
    const span = Math.min(preferredSpan, gap.endMs - gap.startMs);
    const startMs = clamp(currentTimeMs - span / 2, gap.startMs, gap.endMs - span);
    setRanges((current) => [...current, { startMs, endMs: startMs + span }]);
    setMode("manual");
    setLocalError(null);
  }

  async function extract() {
    setLocalError(null);
    try {
      if (mode === "interval") {
        await extractNativeVideoFrames(videoSource.id, { mode, intervalMs });
      } else {
        await extractNativeVideoFrames(videoSource.id, { mode, ranges });
      }
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Could not extract the selected frames.");
    }
  }

  const isBusy = Boolean(busy);
  const isLargeSelection = estimatedFrames > 8000;

  return (
    <section className="extraction-workbench flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="extraction-heading flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div className="min-w-0">
          <p className="studio-kicker">SOURCE VIDEO · {videoSource.hasVariableFrameRate ? "VARIABLE FRAME RATE" : "TIMESTAMP INDEXED"}</p>
          <h1 className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl">
            {videoSource.filename}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {videoSource.width} × {videoSource.height} · {formatTime(durationMs)} · {videoSource.frameCount.toLocaleString()} indexed frames
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted">
          <Film className="size-4 shrink-0" aria-hidden="true" />
          Original video preview
        </div>
      </div>

      <div className="extraction-preview mx-4 sm:mx-6">
        {videoError ? (
          <div className="grid aspect-video w-full place-items-center rounded-2xl border border-line bg-surface text-center">
            <div className="max-w-sm px-5">
              <Film className="mx-auto size-8 text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">Video preview unavailable</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                This Android media provider could not stream the original file to the preview. You can still use the indexed timeline controls below.
              </p>
            </div>
          </div>
        ) : (
          <video
            className="extraction-video aspect-video w-full rounded-2xl bg-black"
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              const next = event.currentTarget.duration * 1000;
              if (Number.isFinite(next) && next > 0) setDurationMs(next);
            }}
            onTimeUpdate={(event) => setCurrentTimeMs(event.currentTarget.currentTime * 1000)}
            onError={() => setVideoError(true)}
            aria-label={"Preview of " + videoSource.filename}
          />
        )}
      </div>

      <div className="extraction-controls mx-4 mb-5 mt-4 rounded-2xl border border-line bg-surface p-4 sm:mx-6 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="studio-kicker">EXTRACTION METHOD</p>
            <h2 className="mt-1 text-base font-semibold">Choose what to extract</h2>
          </div>
          <div className="grid grid-cols-2 rounded-xl border border-line bg-bg p-1" role="group" aria-label="Extraction method">
            <button
              type="button"
              className={"min-h-10 rounded-lg px-3 text-sm font-medium transition-colors " + (mode === "interval" ? "bg-amber text-bg" : "text-muted hover:text-fg")}
              aria-pressed={mode === "interval"}
              onClick={() => setMode("interval")}
            >
              Time interval
            </button>
            <button
              type="button"
              className={"min-h-10 rounded-lg px-3 text-sm font-medium transition-colors " + (mode === "manual" ? "bg-amber text-bg" : "text-muted hover:text-fg")}
              aria-pressed={mode === "manual"}
              onClick={() => setMode("manual")}
            >
              Manual ranges
            </button>
          </div>
        </div>

        {mode === "interval" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-2 text-sm">
              <span className="text-muted">Extract one frame every</span>
              <select
                className="min-h-12 rounded-xl border border-line bg-bg px-3 text-sm text-fg"
                value={intervalMs}
                onChange={(event) => setIntervalMs(Number(event.target.value))}
                aria-label="Frame extraction interval"
              >
                {[100, 150, 200, 250, 300, 500, 750, 1000, 2000].map((value) => (
                  <option key={value} value={value}>{value} ms</option>
                ))}
              </select>
            </label>
            <p className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">
              About <strong className="font-semibold text-fg">{estimatedFrames.toLocaleString()}</strong> frames
              <span className="ml-1">· {Math.round(1000 / intervalMs * 10) / 10} fps</span>
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">Drag the start and end handles. Add more ranges to extract separate sections from this video in one run.</p>
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-bg"
                onClick={addRange}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add range
              </button>
            </div>
            {ranges.map((range, index) => {
              const left = (range.startMs / durationMs) * 100;
              const width = ((range.endMs - range.startMs) / durationMs) * 100;
              return (
                <div key={index} className="extraction-range rounded-xl border border-line bg-bg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Range {index + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted">
                        {formatTime(range.startMs)} – {formatTime(range.endMs)}
                      </span>
                      {ranges.length > 1 ? (
                        <button
                          type="button"
                          className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                          aria-label={"Remove range " + (index + 1)}
                          onClick={() => setRanges((current) => current.filter((_, item) => item !== index))}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="extraction-range-control mt-2">
                    <div className="extraction-range-track">
                      <span style={{ left: left + "%", width: width + "%" }} />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={durationMs}
                      step={10}
                      value={range.startMs}
                      data-edge="start"
                      aria-label={"Range " + (index + 1) + " start time"}
                      onChange={(event) => updateRange(index, "startMs", Number(event.target.value))}
                    />
                    <input
                      type="range"
                      min={0}
                      max={durationMs}
                      step={10}
                      value={range.endMs}
                      data-edge="end"
                      aria-label={"Range " + (index + 1) + " end time"}
                      onChange={(event) => updateRange(index, "endMs", Number(event.target.value))}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted">
              Estimated {estimatedFrames.toLocaleString()} frames across {ranges.length} range{ranges.length === 1 ? "" : "s"} · {Math.round((getManualExtractionDurationMs(ranges) / 1000) * 10) / 10}s unique time selected
            </p>
          </div>
        )}

        {isLargeSelection ? (
          <p className="mt-4 rounded-xl border border-line bg-bg px-3 py-2 text-xs leading-5 text-muted" role="status">
            This is a large selection and may use substantial device storage. Increase the interval or narrow the selected ranges to reduce the output.
          </p>
        ) : null}
        {!videoSource.frameIndexVerified ? (
          <p className="mt-3 text-xs leading-5 text-muted" role="status">
            Android did not independently confirm the source frame count. Extracted frame timestamps will be retained, but exact frame-index reconstruction will remain marked unverified.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock3 className="size-4" aria-hidden="true" />
            Playhead {formatTime(currentTimeMs)}
          </div>
          <button
            type="button"
            disabled={isBusy || videoSource.frameCount < 1}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber px-5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={() => void extract()}
          >
            <Scissors className="size-4" aria-hidden="true" />
            {isBusy ? "Extracting…" : "Extract " + estimatedFrames.toLocaleString() + " frames"}
          </button>
        </div>
        {isBusy ? <p className="mt-3 text-xs text-muted" role="status">{busy}</p> : null}
        {localError || error ? (
          <p className="mt-3 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg" role="alert">
            {localError || error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
