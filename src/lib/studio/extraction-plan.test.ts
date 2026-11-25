import assert from "node:assert/strict";
import test from "node:test";
import { selectFramesForCapture, type CaptureRange } from "./extraction-plan.ts";
import type { FrameTimestamp } from "../native/frame-extractor";

const timestamps: FrameTimestamp[] = Array.from({ length: 11 }, (_, frameIndex) => ({
  frameIndex,
  presentationTimeUs: frameIndex * 100_000,
  durationUs: 100_000,
}));

const range = (id: string, startMs: number, endMs: number): CaptureRange => ({ id, startMs, endMs });

test("manual capture keeps every original frame inside the selected window", () => {
  const selected = selectFramesForCapture(timestamps, [range("manual-a", 200, 600)], "manual", 200);
  assert.deepEqual(selected.map((frame) => frame.frameIndex), [2, 3, 4, 5, 6]);
  assert.ok(selected.every((frame) => frame.sequenceId === "manual-a"));
});

test("interval capture defaults can select frames at a 200ms cadence", () => {
  const selected = selectFramesForCapture(timestamps, [range("interval-a", 100, 900)], "interval", 200);
  assert.deepEqual(selected.map((frame) => frame.frameIndex), [1, 3, 5, 7, 9]);
});

test("multiple capture ranges are combined and duplicate source frames are only extracted once", () => {
  const selected = selectFramesForCapture(
    timestamps,
    [range("first", 0, 300), range("second", 300, 500), range("third", 800, 1_000)],
    "manual",
    200,
  );
  assert.deepEqual(selected.map((frame) => frame.frameIndex), [0, 1, 2, 3, 4, 5, 8, 9, 10]);
  assert.equal(selected.find((frame) => frame.frameIndex === 3)?.sequenceId, "first");
  assert.equal(selected.find((frame) => frame.frameIndex === 4)?.sequenceId, "second");
});

test("variable frame timestamps, not nominal fps, determine interval picks", () => {
  const vfr: FrameTimestamp[] = [0, 75, 215, 390, 590, 825].map((ms, frameIndex) => ({
    frameIndex,
    presentationTimeUs: ms * 1_000,
    durationUs: 100_000,
  }));
  const selected = selectFramesForCapture(vfr, [range("vfr", 0, 825)], "interval", 200);
  assert.deepEqual(selected.map((frame) => frame.frameIndex), [0, 2, 3, 4, 5]);
});

test("capture planner rejects invalid windows and interval values below 200ms", () => {
  assert.throws(() => selectFramesForCapture(timestamps, [range("bad", 400, 200)], "manual", 200), /valid time range/);
  assert.throws(() => selectFramesForCapture(timestamps, [range("bad", -1, 200)], "manual", 200), /valid time range/);
  assert.throws(() => selectFramesForCapture(timestamps, [range("ok", 0, 200)], "interval", 100), /200ms/);
});

test("capture ranges merge when they overlap or touch, regardless of input order", async () => {
  const { mergeCaptureRanges } = await import("./extraction-plan.ts");
  assert.deepEqual(
    mergeCaptureRanges([
      range("later", 500, 800),
      range("contained", 250, 300),
      range("first", 0, 500),
      range("touching", 800, 900),
    ]).map(({ startMs, endMs }) => [startMs, endMs]),
    [[0, 900]],
  );
});

test("capture range merging handles single-frame and full-index windows", async () => {
  const { mergeCaptureRanges } = await import("./extraction-plan.ts");
  assert.deepEqual(
    mergeCaptureRanges([range("single-b", 20, 20.001), range("single-a", 10, 10.001), range("full", 0, 1_000)])
      .map(({ startMs, endMs }) => [startMs, endMs]),
    [[0, 1_000]],
  );
});

test("frame estimate equals the de-duplicated manual selection after range merging", async () => {
  const { estimateCaptureFrameCount } = await import("./extraction-plan.ts");
  const selected = selectFramesForCapture(
    timestamps,
    [range("overlap-a", 0, 500), range("overlap-b", 400, 1_000)],
    "manual",
    200,
  );
  assert.equal(estimateCaptureFrameCount(timestamps, [range("overlap-a", 0, 500), range("overlap-b", 400, 1_000)], "manual", 200), selected.length);
  assert.equal(selected.length, 11);
});


test("capture estimate starts at zero before any range is saved", async () => {
  const { estimateCaptureFrameCount } = await import("./extraction-plan.ts");
  assert.equal(estimateCaptureFrameCount(timestamps, [], "manual", 200), 0);
});

test("capture estimate safely reports empty or temporarily incomplete timestamp state", async () => {
  const { estimateCaptureFrameCount, getCaptureFrameEstimate } = await import("./extraction-plan.ts");
  assert.equal(estimateCaptureFrameCount([], [range("pending", 0, 500)], "manual", 200), 0);
  assert.deepEqual(getCaptureFrameEstimate([], [range("pending", 0, 500)], "manual", 200), {
    count: 0,
    error: "The source video has no indexed frame timestamps.",
  });
});

test("capture estimate safely rejects an invalid interval without throwing", async () => {
  const { estimateCaptureFrameCount, getCaptureFrameEstimate } = await import("./extraction-plan.ts");
  assert.equal(estimateCaptureFrameCount(timestamps, [range("valid", 0, 500)], "interval", 0), 0);
  assert.match(getCaptureFrameEstimate(timestamps, [range("valid", 0, 500)], "interval", 0).error ?? "", /interval must be between/);
});

test("capture estimate safely rejects invalid or non-finite range values without throwing", async () => {
  const { estimateCaptureFrameCount, getCaptureFrameEstimate } = await import("./extraction-plan.ts");
  for (const invalidRange of [range("backwards", 400, 200), range("nan", Number.NaN, 300)]) {
    assert.equal(estimateCaptureFrameCount(timestamps, [invalidRange], "manual", 200), 0);
    assert.match(getCaptureFrameEstimate(timestamps, [invalidRange], "manual", 200).error ?? "", /valid time range/);
  }
});
