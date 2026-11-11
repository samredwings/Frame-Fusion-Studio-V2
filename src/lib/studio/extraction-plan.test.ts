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
