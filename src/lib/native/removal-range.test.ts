import assert from "node:assert/strict";
import test from "node:test";
import { assertRemovalFrameRange, MAX_REMOVAL_FRAMES_PER_CALL } from "./removal-range.ts";

test("native removal accepts exactly the per-call frame limit", () => {
  assert.doesNotThrow(() => assertRemovalFrameRange(20, 20 + MAX_REMOVAL_FRAMES_PER_CALL - 1));
});

test("native removal rejects a bridge response larger than 250 frames", () => {
  assert.throws(
    () => assertRemovalFrameRange(0, MAX_REMOVAL_FRAMES_PER_CALL),
    /limited to 250 frames/,
  );
});

test("native removal rejects malformed or negative frame ranges", () => {
  assert.throws(() => assertRemovalFrameRange(-1, 0), /valid non-negative/);
  assert.throws(() => assertRemovalFrameRange(5, 4), /valid non-negative/);
  assert.throws(() => assertRemovalFrameRange(1.5, 2), /valid non-negative/);
});
