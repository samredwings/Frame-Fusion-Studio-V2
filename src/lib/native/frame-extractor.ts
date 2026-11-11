/**
 * Typed bridge to the Android FrameExtractor plugin.
 *
 * These methods are Android-native. Browser development should use a separate
 * file-input / HTMLVideoElement fallback rather than pretending native APIs exist.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { assertRemovalFrameRange } from "@/lib/native/removal-range";
export { MAX_REMOVAL_FRAMES_PER_CALL } from "@/lib/native/removal-range";
import type {
  DetectionMethod,
  NormalizedRect,
  WatermarkRemovalSettings,
} from "@/lib/studio/types";

export interface PickedVideo {
  uri: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  persistablePermission: boolean;
}

export interface VideoInfo {
  uri: string;
  filename: string;
  sizeBytes: number;
  durationMs: number;
  metadataFrameCount: number;
  nominalFrameRate: number;
  averageFrameRate: number;
  width: number;
  height: number;
  rotation: number;
  videoMimeType: string;
  videoBitrate: number;
  hasAudio: boolean;
  audioMimeType?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  audioBitrate?: number;
}

export interface FrameIndexResult {
  uri: string;
  indexId: string;
  frameCount: number;
  durationUs: number;
  nominalFrameRate: number;
  averageFrameRate: number;
  hasVariableFrameRate: boolean;
  indexVerified: boolean;
  metadataFrameCount: number;
  warning?: string;
}

export interface FrameTimestamp {
  frameIndex: number;
  presentationTimeUs: number;
  durationUs: number;
}

export interface FrameTimestampPage {
  indexId: string;
  totalFrameCount: number;
  startFrameIndex: number;
  entries: FrameTimestamp[];
}

export interface ExtractedFrame {
  frameIndex: number;
  presentationTimeUs: number;
  outputPath: string;
  width: number;
  height: number;
  fileSize: number;
  exactFrameIndex: boolean;
}

export interface ExtractFrameRangeResult {
  indexId: string;
  startFrameIndex: number;
  endFrameIndex: number;
  extractedCount: number;
  frames: ExtractedFrame[];
}

export interface ExtractFrameSelectionResult {
  indexId: string;
  extractedCount: number;
  frames: ExtractedFrame[];
}

export interface GeneratedThumbnail extends ExtractedFrame {
  timestampMs: number;
}

export interface ExtractProgressEvent {
  operationId: string;
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
}


export interface WatermarkDetection {
  id: string;
  type: "logo" | "text" | "timestamp" | "subtitle" | "qr" | "unknown";
  detectionMethod: DetectionMethod;
  bounds: NormalizedRect;
  confidence: number;
  detectedAtFrameIndex: number;
  isPersistent: boolean;
}

export interface WatermarkDetectionResult {
  uri: string;
  frameIndex: number;
  detections: WatermarkDetection[];
  unsupportedMethods: string[];
  warning: string;
}

export interface RemovalFrameOutput {
  frameIndex: number;
  presentationTimeUs: number;
  outputPath: string;
}

export interface RemovalResult {
  operationId: string;
  uri?: string;
  removalType?: "watermark" | "text";
  startFrameIndex?: number;
  endFrameIndex?: number;
  outputs?: RemovalFrameOutput[];
  previewPath?: string;
  width?: number;
  height?: number;
  implementation: "naive-diffusion";
  warning: string;
  detectionMethod?: string;
  watermarkId?: string;
}

export interface RemovalProgressEvent {
  operationId: string;
  removalType?: "watermark" | "text";
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
}

export interface RemovalErrorEvent {
  operationId: string;
  message: string;
}

export interface FrameExtractorPlugin {
  pickVideo(): Promise<PickedVideo>;
  getVideoInfo(options: { uri: string }): Promise<VideoInfo>;
  buildFrameIndex(options: { uri: string }): Promise<FrameIndexResult>;
  getFrameTimestampPage(options: {
    uri: string;
    startFrameIndex: number;
    limit?: number;
  }): Promise<FrameTimestampPage>;
  extractFrame(options: {
    uri: string;
    frameIndex: number;
    targetWidth?: number;
    quality?: number;
  }): Promise<ExtractedFrame>;
  extractFrameRange(options: {
    uri: string;
    startFrameIndex: number;
    endFrameIndex: number;
    targetWidth?: number;
    quality?: number;
  }): Promise<ExtractFrameRangeResult>;
  extractFrameSelection(options: {
    uri: string;
    frameIndexes: number[];
    targetWidth?: number;
    quality?: number;
  }): Promise<ExtractFrameSelectionResult>;
  generateThumbnails(options: {
    uri: string;
    count?: number;
    width?: number;
    quality?: number;
  }): Promise<{ indexId: string; generatedCount: number; thumbnails: GeneratedThumbnail[] }>;
  detectWatermark(options: {
    uri: string;
    frameIndex: number;
    detectionMethods: string[];
  }): Promise<WatermarkDetectionResult>;
  removeWatermark(options: {
    uri: string;
    watermarkId: string;
    bounds: NormalizedRect;
    startFrameIndex: number;
    endFrameIndex: number;
    settings: WatermarkRemovalSettings;
  }): Promise<RemovalResult>;
  removeText(options: {
    uri: string;
    bounds: NormalizedRect;
    startFrameIndex: number;
    endFrameIndex: number;
    settings: WatermarkRemovalSettings;
    detectionMethod: string;
  }): Promise<RemovalResult>;
  previewRemoval(options: {
    uri: string;
    framePath: string;
    bounds: NormalizedRect;
    algorithm: string;
    donorFramePath?: string;
    featherPx: number;
    expansionPx: number;
  }): Promise<RemovalResult>;
  deleteVideoData(options: { uri: string }): Promise<{ deleted: boolean; indexId: string }>;
  addListener(
    eventName: "extractProgress",
    listenerFunc: (event: ExtractProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "removalProgress",
    listenerFunc: (event: RemovalProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "removalComplete",
    listenerFunc: (event: RemovalResult) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "removalError",
    listenerFunc: (event: RemovalErrorEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeFrameExtractor = registerPlugin<FrameExtractorPlugin>("FrameExtractor");

function assertAndroid(): void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    throw new Error("Native frame extraction is available in the Android app only.");
  }
}

export const FrameExtractor = {
  pickVideo(): Promise<PickedVideo> {
    assertAndroid();
    return NativeFrameExtractor.pickVideo();
  },
  getVideoInfo(uri: string): Promise<VideoInfo> {
    assertAndroid();
    return NativeFrameExtractor.getVideoInfo({ uri });
  },
  buildFrameIndex(uri: string): Promise<FrameIndexResult> {
    assertAndroid();
    return NativeFrameExtractor.buildFrameIndex({ uri });
  },
  getFrameTimestampPage(
    uri: string,
    startFrameIndex: number,
    limit = 500,
  ): Promise<FrameTimestampPage> {
    assertAndroid();
    return NativeFrameExtractor.getFrameTimestampPage({ uri, startFrameIndex, limit });
  },
  extractFrame(
    uri: string,
    frameIndex: number,
    targetWidth = 0,
    quality = 95,
  ): Promise<ExtractedFrame> {
    assertAndroid();
    return NativeFrameExtractor.extractFrame({ uri, frameIndex, targetWidth, quality });
  },
  extractFrameRange(
    uri: string,
    startFrameIndex: number,
    endFrameIndex: number,
    targetWidth = 0,
    quality = 95,
  ): Promise<ExtractFrameRangeResult> {
    assertAndroid();
    return NativeFrameExtractor.extractFrameRange({
      uri,
      startFrameIndex,
      endFrameIndex,
      targetWidth,
      quality,
    });
  },
  extractFrameSelection(uri: string, frameIndexes: number[], targetWidth = 0, quality = 95) {
    assertAndroid();
    if (!frameIndexes.length || frameIndexes.length > 250
      || frameIndexes.some((value, index) => !Number.isInteger(value) || value < 0
        || (index > 0 && value <= frameIndexes[index - 1]!))) {
      throw new Error("Choose 1–250 unique, ascending frame indexes for a native extraction batch.");
    }
    return NativeFrameExtractor.extractFrameSelection({ uri, frameIndexes, targetWidth, quality });
  },
  generateThumbnails(uri: string, count = 100, width = 160, quality = 80) {
    assertAndroid();
    return NativeFrameExtractor.generateThumbnails({ uri, count, width, quality });
  },
  detectWatermark(uri: string, frameIndex: number, detectionMethods: string[] = ["static-region"]) {
    assertAndroid();
    return NativeFrameExtractor.detectWatermark({ uri, frameIndex, detectionMethods });
  },
  removeWatermark(
    uri: string,
    watermarkId: string,
    bounds: NormalizedRect,
    startFrameIndex: number,
    endFrameIndex: number,
    settings: WatermarkRemovalSettings,
  ) {
    assertAndroid();
    assertRemovalFrameRange(startFrameIndex, endFrameIndex);
    return NativeFrameExtractor.removeWatermark({
      uri, watermarkId, bounds, startFrameIndex, endFrameIndex, settings,
    });
  },
  removeText(
    uri: string,
    bounds: NormalizedRect,
    startFrameIndex: number,
    endFrameIndex: number,
    settings: WatermarkRemovalSettings,
    detectionMethod: string = "manual",
  ) {
    assertAndroid();
    assertRemovalFrameRange(startFrameIndex, endFrameIndex);
    return NativeFrameExtractor.removeText({
      uri, bounds, startFrameIndex, endFrameIndex, settings, detectionMethod,
    });
  },
  previewRemoval(
    uri: string,
    framePath: string,
    bounds: NormalizedRect,
    algorithm: string = "naive-diffusion",
    donorFramePath?: string,
    featherPx = 8,
    expansionPx = 4,
  ) {
    assertAndroid();
    return NativeFrameExtractor.previewRemoval({
      uri, framePath, bounds, algorithm, donorFramePath, featherPx, expansionPx,
    });
  },
  deleteVideoData(uri: string): Promise<{ deleted: boolean; indexId: string }> {
    assertAndroid();
    return NativeFrameExtractor.deleteVideoData({ uri });
  },
  addProgressListener(listener: (event: ExtractProgressEvent) => void) {
    assertAndroid();
    return NativeFrameExtractor.addListener("extractProgress", listener);
  },
  addRemovalProgressListener(listener: (event: RemovalProgressEvent) => void) {
    assertAndroid();
    return NativeFrameExtractor.addListener("removalProgress", listener);
  },
  addRemovalCompleteListener(listener: (event: RemovalResult) => void) {
    assertAndroid();
    return NativeFrameExtractor.addListener("removalComplete", listener);
  },
  addRemovalErrorListener(listener: (event: RemovalErrorEvent) => void) {
    assertAndroid();
    return NativeFrameExtractor.addListener("removalError", listener);
  },
  /** Convert an app-private native file path into a URL the Capacitor WebView can display. */
  toWebViewUrl(nativePath: string): string {
    return Capacitor.convertFileSrc(nativePath);
  },
};