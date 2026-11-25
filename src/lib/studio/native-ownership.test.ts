import assert from "node:assert/strict";
import test from "node:test";
import { findOrphanedNativeMedia, otherSourcesUsingIndexId, otherSourcesUsingUri, pendingCaptureDeleteOptions, shouldDeleteNativeMedia, shouldReleaseUriPermission } from "./native-ownership.ts";
import type { VideoSource } from "./types.ts";

const source = (id: string, uri: string, projectId = `project-${id}`): VideoSource => ({
  id,
  projectId,
  uri,
  filename: `${id}.mp4`,
  sizeBytes: 10,
  durationMs: 1_000,
  frameCount: 10,
  nominalFrameRate: 10,
  averageFrameRate: 10,
  hasVariableFrameRate: false,
  frameIndexId: id,
  frameIndexVerified: true,
  width: 640,
  height: 360,
  rotation: 0,
  videoMimeType: "video/avc",
  videoBitrate: 100_000,
  hasAudio: false,
  importedAt: 1,
  updatedAt: 1,
});

test("two sources sharing a URI keep the persisted read permission when either one is removed", () => {
  const sources = [source("a-source-001", "content://provider/video") , source("b-source-002", "content://provider/video")];
  assert.equal(otherSourcesUsingUri(sources, "content://provider/video", "a-source-001").length, 1);
  assert.equal(shouldReleaseUriPermission(sources, "content://provider/video", "a-source-001"), false);
  assert.equal(shouldReleaseUriPermission(sources, "content://provider/video", "b-source-002"), false);
});

test("a single source releases its URI permission after it is removed", () => {
  const sources = [source("only-source-01", "content://provider/one")];
  assert.equal(shouldReleaseUriPermission(sources, "content://provider/one", "only-source-01"), true);
});

test("three shared sources release the permission only after the last source is removed", () => {
  const sources = [
    source("first-source-01", "content://provider/shared"),
    source("second-source-2", "content://provider/shared"),
    source("third-source-03", "content://provider/shared"),
  ];
  const afterFirstDelete = sources.filter((item) => item.id !== "first-source-01");
  const afterSecondDelete = afterFirstDelete.filter((item) => item.id !== "second-source-2");
  assert.equal(shouldReleaseUriPermission(afterFirstDelete, "content://provider/shared"), false);
  assert.equal(shouldReleaseUriPermission(afterSecondDelete, "content://provider/shared"), false);
  assert.equal(shouldReleaseUriPermission([], "content://provider/shared"), true);
});

test("an exclusion ID that is not present has no effect", () => {
  const sources = [source("existing-source1", "content://provider/shared")];
  assert.deepEqual(otherSourcesUsingUri(sources, "content://provider/shared", "missing-source1"), sources);
  assert.equal(shouldReleaseUriPermission(sources, "content://provider/shared", "missing-source1"), false);
});


test("legacy cache inventory preserves every indexId referenced by a source and returns only unique orphans", () => {
  const sources = [source("source-a-0001", "content://provider/a"), source("source-b-0002", "content://provider/b")];
  assert.deepEqual(
    findOrphanedNativeMedia(["legacy-hash-0001", "source-a-0001", "legacy-hash-0001", "source-b-0002"], sources),
    ["legacy-hash-0001"],
  );
});


test("cancel after index build deletes only the pending key and preserves another source's URI grant", () => {
  const existing = source("already-imported-1", "content://provider/same-file");
  const request = pendingCaptureDeleteOptions([existing], {
    sourceId: "pending-import-0001",
    uri: "content://provider/same-file",
  });
  assert.deepEqual(request, {
    indexId: "pending-import-0001",
    uri: "content://provider/same-file",
    releaseUriPermission: false,
  });
});


test("legacy sources sharing a URI-derived indexId retain native files until the last source is removed", () => {
  const first = { ...source("legacy-source-a", "content://provider/legacy"), frameIndexId: "a".repeat(64) };
  const second = { ...source("legacy-source-b", "content://provider/legacy"), frameIndexId: "a".repeat(64) };
  assert.equal(otherSourcesUsingIndexId([first, second], first.frameIndexId!, first.id).length, 1);
  assert.equal(shouldDeleteNativeMedia([first, second], first.frameIndexId!, first.id), false);
  assert.equal(shouldDeleteNativeMedia([second], first.frameIndexId!, second.id), true);
});
