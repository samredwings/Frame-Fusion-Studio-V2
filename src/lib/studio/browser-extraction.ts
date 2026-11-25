type CapacitorPlatform = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
};

/** Android imports must use the document picker and native timestamp extractor, never File/canvas fallback. */
export function assertBrowserVideoExtractionAvailable(platform: CapacitorPlatform): void {
  if (platform.isNativePlatform() && platform.getPlatform() === "android") {
    throw new Error("Android video imports must use the native document picker and timestamp extractor.");
  }
}
