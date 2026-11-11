import assert from "node:assert/strict";
import test from "node:test";
import { getAndroidContentPreviewUrl } from "./content-preview.ts";

test("converts a selected Android content URI to Capacitor's same-origin streaming route", () => {
  assert.equal(
    getAndroidContentPreviewUrl(
      "content://com.android.providers.media.documents/document/video%3A1000000020",
      "https://localhost",
    ),
    "https://localhost/_capacitor_content_/com.android.providers.media.documents/document/video%3A1000000020",
  );
});

test("normalizes a trailing slash from the app origin", () => {
  assert.equal(
    getAndroidContentPreviewUrl("content://media/video/1", "https://localhost/"),
    "https://localhost/_capacitor_content_/media/video/1",
  );
});

test("rejects non-content URIs and invalid origins", () => {
  assert.throws(() => getAndroidContentPreviewUrl("file:///video.mp4", "https://localhost"), /content URI/);
  assert.throws(() => getAndroidContentPreviewUrl("content://media/video/1", "javascript:alert(1)"), /valid local server origin/);
});
