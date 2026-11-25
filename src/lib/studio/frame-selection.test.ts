import assert from "node:assert/strict";
import test from "node:test";
import { mapSourceFrameIndexesToSequence, normalizeFrameSelection } from "./frame-selection.ts";

test("frame selection removes duplicates and sorts indexes into gallery order", () => {
  assert.deepEqual(normalizeFrameSelection([4, 1, 4, 2], 5), [1, 2, 4]);
});

test("frame selection excludes invalid and out-of-range indexes", () => {
  assert.deepEqual(normalizeFrameSelection([-1, 0, 5, 2.5, Number.NaN, 3], 5), [0, 3]);
});

test("frame selection handles an empty gallery", () => {
  assert.deepEqual(normalizeFrameSelection([0, 1], 0), []);
});

test("sparse source frame indexes map to dense editor positions without losing source identity", () => {
  assert.deepEqual(mapSourceFrameIndexesToSequence([0, 5, 9]), [
    { frameIndex: 0, sourceFrameIndex: 0 },
    { frameIndex: 1, sourceFrameIndex: 5 },
    { frameIndex: 2, sourceFrameIndex: 9 },
  ]);
});
