import assert from "node:assert/strict";
import test from "node:test";
import { assertBrowserVideoExtractionAvailable } from "./browser-extraction.ts";

const platform = (native: boolean, name: string) => ({
  isNativePlatform: () => native,
  getPlatform: () => name,
});

test("browser File extraction rejects Android native platform input", () => {
  assert.throws(
    () => assertBrowserVideoExtractionAvailable(platform(true, "android")),
    /native document picker and timestamp extractor/,
  );
});

test("browser File extraction remains available on web and non-Android platforms", () => {
  assert.doesNotThrow(() => assertBrowserVideoExtractionAvailable(platform(false, "web")));
  assert.doesNotThrow(() => assertBrowserVideoExtractionAvailable(platform(true, "ios")));
});
