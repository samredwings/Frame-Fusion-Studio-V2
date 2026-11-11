import type { FrameIndexResult, PickedVideo, VideoInfo } from "@/lib/native/frame-extractor";

export type CaptureMethod = "manual" | "interval";

export type CaptureRange = {
  id: string;
  startMs: number;
  endMs: number;
};

export type FrameTimestampLike = {
  frameIndex: number;
  presentationTimeUs: number;
  durationUs: number;
};

export type PlannedCaptureFrame = {
  frameIndex: number;
  presentationTimeUs: number;
  durationUs: number;
  sequenceId: string;
};

export type NativeVideoCapturePlan = {
  picked: PickedVideo;
  info: VideoInfo;
  index: FrameIndexResult;
  method: CaptureMethod;
  intervalMs: number;
  ranges: CaptureRange[];
};

export const MIN_CAPTURE_INTERVAL_MS = 200;
export const MAX_CAPTURE_INTERVAL_MS = 60_000;

function validateRanges(ranges: CaptureRange[]) {
  if (!ranges.length) throw new Error("Add at least one capture range.");
  const ids = new Set<string>();
  for (const range of ranges) {
    if (!range.id.trim() || ids.has(range.id)) throw new Error("Every capture range needs a unique ID.");
    ids.add(range.id);
    if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)
      || range.startMs < 0 || range.endMs <= range.startMs) {
      throw new Error("Choose a valid time range with an end after its start.");
    }
  }
}

function nearestFrame(
  entries: FrameTimestampLike[],
  targetUs: number,
  first: number,
  afterLast: number,
): FrameTimestampLike | undefined {
  let low = first;
  let high = afterLast;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (entries[mid]!.presentationTimeUs < targetUs) low = mid + 1;
    else high = mid;
  }
  const right = low < afterLast ? entries[low] : undefined;
  const left = low > first ? entries[low - 1] : undefined;
  if (!left) return right;
  if (!right) return left;
  return targetUs - left.presentationTimeUs <= right.presentationTimeUs - targetUs ? left : right;
}

/**
 * Resolve user-selected time windows against the source video's presentation
 * timestamps. Interval mode picks the nearest decoded frame at each cadence;
 * manual mode retains every original frame in the selected time window.
 */
export function selectFramesForCapture(
  entries: FrameTimestampLike[],
  ranges: CaptureRange[],
  method: CaptureMethod,
  intervalMs: number,
): PlannedCaptureFrame[] {
  validateRanges(ranges);
  if (method === "interval" && (!Number.isInteger(intervalMs)
    || intervalMs < MIN_CAPTURE_INTERVAL_MS || intervalMs > MAX_CAPTURE_INTERVAL_MS)) {
    throw new Error(`Capture interval must be between ${MIN_CAPTURE_INTERVAL_MS}ms and ${MAX_CAPTURE_INTERVAL_MS}ms.`);
  }
  if (!entries.length) throw new Error("The source video has no indexed frame timestamps.");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (!Number.isInteger(entry.frameIndex) || entry.frameIndex < 0
      || !Number.isFinite(entry.presentationTimeUs) || entry.presentationTimeUs < 0
      || (i > 0 && entry.presentationTimeUs < entries[i - 1]!.presentationTimeUs)) {
      throw new Error("The source video timestamp index is not ordered or valid.");
    }
  }

  const selected = new Map<number, PlannedCaptureFrame>();
  for (const range of ranges) {
    const startUs = Math.round(range.startMs * 1_000);
    const endUs = Math.round(range.endMs * 1_000);
    let first = 0;
    while (first < entries.length && entries[first]!.presentationTimeUs < startUs) first++;
    let afterLast = first;
    while (afterLast < entries.length && entries[afterLast]!.presentationTimeUs <= endUs) afterLast++;
    if (first >= afterLast) continue;

    if (method === "manual") {
      for (let i = first; i < afterLast; i++) {
        const entry = entries[i]!;
        if (!selected.has(entry.frameIndex)) {
          selected.set(entry.frameIndex, {
            frameIndex: entry.frameIndex,
            presentationTimeUs: entry.presentationTimeUs,
            durationUs: entry.durationUs,
            sequenceId: range.id,
          });
        }
      }
    } else {
      const stepUs = intervalMs * 1_000;
      for (let targetUs = startUs; targetUs <= endUs; targetUs += stepUs) {
        const entry = nearestFrame(entries, targetUs, first, afterLast);
        if (entry && entry.presentationTimeUs >= startUs && entry.presentationTimeUs <= endUs
          && !selected.has(entry.frameIndex)) {
          selected.set(entry.frameIndex, {
            frameIndex: entry.frameIndex,
            presentationTimeUs: entry.presentationTimeUs,
            durationUs: entry.durationUs,
            sequenceId: range.id,
          });
        }
      }
    }
  }

  return [...selected.values()].sort(
    (a, b) => a.presentationTimeUs - b.presentationTimeUs || a.frameIndex - b.frameIndex,
  );
}
