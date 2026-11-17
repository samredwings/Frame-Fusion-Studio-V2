import test from "node:test";
import assert from "node:assert/strict";
import {
  getManualExtractionDurationMs,
  selectFrameIndexesByInterval,
  selectFrameIndexesByRanges,
} from "./extraction-selection.ts";

const timestamps = [
  { frameIndex: 0, presentationTimeUs: 0, durationUs: 41_667 },
  { frameIndex: 1, presentationTimeUs: 41_667, durationUs: 41_667 },
  { frameIndex: 2, presentationTimeUs: 83_334, durationUs: 41_667 },
  { frameIndex: 3, presentationTimeUs: 125_001, durationUs: 41_667 },
  { frameIndex: 4, presentationTimeUs: 166_668, durationUs: 41_667 },
  { frameIndex: 5, presentationTimeUs: 208_335, durationUs: 41_667 },
  { frameIndex: 6, presentationTimeUs: 250_002, durationUs: 41_667 },
  { frameIndex: 7, presentationTimeUs: 291_669, durationUs: 41_667 },
  { frameIndex: 8, presentationTimeUs: 333_336, durationUs: 41_667 },
  { frameIndex: 9, presentationTimeUs: 375_003, durationUs: 41_667 },
];

test("interval sampling selects the first available frame at or after each target time", () => {
  assert.deepEqual(selectFrameIndexesByInterval(timestamps, 200, 417), [0, 5, 9]);
});

test("interval sampling rejects invalid intervals", () => {
  assert.throws(() => selectFrameIndexesByInterval(timestamps, 0, 417), /interval/i);
  assert.throws(() => selectFrameIndexesByInterval(timestamps, 200, -1), /duration/i);
});

test("manual ranges preserve frames inside each selected section and de-duplicate overlaps", () => {
  assert.deepEqual(
    selectFrameIndexesByRanges(timestamps, [
      { startMs: 80, endMs: 210 },
      { startMs: 180, endMs: 340 },
    ]),
    [2, 3, 4, 5, 6, 7, 8],
  );
});

test("manual ranges clamp to video duration and reject reversed ranges", () => {
  assert.deepEqual(selectFrameIndexesByRanges(timestamps, [{ startMs: -50, endMs: 500 }]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.throws(() => selectFrameIndexesByRanges(timestamps, [{ startMs: 300, endMs: 200 }]), /start/i);
});

test("manual range duration counts overlaps once", () => {
  assert.equal(
    getManualExtractionDurationMs([
      { startMs: 0, endMs: 2000 },
      { startMs: 1500, endMs: 3000 },
      { startMs: 5000, endMs: 6000 },
    ]),
    4000,
  );
});

test("manual range selection uses elapsed video time even when source PTS starts after zero", () => {
  const offsetTimestamps = timestamps.map((entry) => ({
    ...entry,
    presentationTimeUs: entry.presentationTimeUs + 3_000_000,
  }));
  assert.deepEqual(
    selectFrameIndexesByRanges(offsetTimestamps, [{ startMs: 0, endMs: 100 }]),
    [0, 1, 2],
  );
  assert.deepEqual(selectFrameIndexesByInterval(offsetTimestamps, 200, 417), [0, 5, 9]);
});


test("interval selection returns unique frame indexes in native extraction order", () => {
  const outOfOrderPts = [
    { frameIndex: 0, presentationTimeUs: 0, durationUs: 10_000 },
    { frameIndex: 1, presentationTimeUs: 210_000, durationUs: 10_000 },
    { frameIndex: 2, presentationTimeUs: 195_000, durationUs: 10_000 },
    { frameIndex: 3, presentationTimeUs: 410_000, durationUs: 10_000 },
  ];
  assert.deepEqual(selectFrameIndexesByInterval(outOfOrderPts, 200, 600), [0, 2, 3]);
});

test("empty timestamp pages and empty manual selections produce no frame indexes", () => {
  assert.deepEqual(selectFrameIndexesByInterval([], 200, 1000), []);
  assert.deepEqual(selectFrameIndexesByRanges(timestamps, []), []);
});
