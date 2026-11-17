import type { FrameTimeMapEntry } from "./types";

export type ManualExtractionRange = {
  startMs: number;
  endMs: number;
};

/** Select the first indexed frame at or after each interval target. Uses source PTS, so VFR is handled correctly. */
export function selectFrameIndexesByInterval(
  timestamps: FrameTimeMapEntry[],
  intervalMs: number,
  durationMs: number,
): number[] {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Extraction interval must be greater than zero.");
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error("Video duration must be zero or greater.");
  }
  if (!timestamps.length) return [];

  const ordered = [...timestamps].sort((a, b) => a.presentationTimeUs - b.presentationTimeUs);
  const selected: number[] = [];
  const timelineStartUs = ordered[0].presentationTimeUs;
  let frameCursor = 0;
  const durationUs = Math.round(durationMs * 1000);
  const intervalUs = Math.round(intervalMs * 1000);

  for (let targetUs = 0; targetUs < durationUs; targetUs += intervalUs) {
    while (
      frameCursor < ordered.length - 1 &&
      ordered[frameCursor + 1].presentationTimeUs - timelineStartUs <= targetUs
    ) {
      frameCursor += 1;
    }
    const before = ordered[frameCursor];
    const after = ordered[frameCursor + 1];
    const beforeTimeUs = before.presentationTimeUs - timelineStartUs;
    const afterTimeUs = after ? after.presentationTimeUs - timelineStartUs : Number.POSITIVE_INFINITY;
    const candidate = !after || targetUs - beforeTimeUs <= afterTimeUs - targetUs
      ? before
      : after;
    if (candidate.presentationTimeUs - timelineStartUs < durationUs) {
      const last = selected[selected.length - 1];
      if (last !== candidate.frameIndex) selected.push(candidate.frameIndex);
    }
  }

  return selected.sort((a, b) => a - b);
}

/** Select every indexed frame whose presentation time falls within any manual range. */
export function selectFrameIndexesByRanges(
  timestamps: FrameTimeMapEntry[],
  ranges: ManualExtractionRange[],
): number[] {
  if (!ranges.length || !timestamps.length) return [];
  const orderedRanges = ranges.map((range) => {
    if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)) {
      throw new Error("Range start and end must be valid times.");
    }
    if (range.startMs > range.endMs) {
      throw new Error("Range start must be before its end.");
    }
    return { startUs: Math.max(0, range.startMs * 1000), endUs: Math.max(0, range.endMs * 1000) };
  }).sort((a, b) => a.startUs - b.startUs);

  const timelineStartUs = timestamps.reduce(
    (minimum, entry) => Math.min(minimum, entry.presentationTimeUs),
    Number.POSITIVE_INFINITY,
  );
  const selected = new Set<number>();
  for (const entry of timestamps) {
    const relativeTimeUs = entry.presentationTimeUs - timelineStartUs;
    if (orderedRanges.some((range) =>
      relativeTimeUs >= range.startUs && relativeTimeUs <= range.endUs
    )) {
      selected.add(entry.frameIndex);
    }
  }
  return [...selected].sort((a, b) => a - b);
}

/** Return the union duration so overlapping manual ranges are not double-counted in estimates. */
export function getManualExtractionDurationMs(ranges: ManualExtractionRange[]): number {
  if (!ranges.length) return 0;
  const ordered = ranges.map((range) => {
    if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)) {
      throw new Error("Range start and end must be valid times.");
    }
    if (range.startMs > range.endMs) {
      throw new Error("Range start must be before its end.");
    }
    return { start: Math.max(0, range.startMs), end: Math.max(0, range.endMs) };
  }).sort((a, b) => a.start - b.start);

  let total = 0;
  let start = ordered[0].start;
  let end = ordered[0].end;
  for (const range of ordered.slice(1)) {
    if (range.start <= end) {
      end = Math.max(end, range.end);
    } else {
      total += end - start;
      start = range.start;
      end = range.end;
    }
  }
  return total + end - start;
}
