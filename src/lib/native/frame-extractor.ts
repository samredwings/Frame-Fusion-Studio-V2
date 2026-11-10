/**
 * Typed bridge to the Android FrameExtractor plugin.
 *
 * These methods are Android-native. Browser development should use a separate
 * file-input / HTMLVideoElement fallback rather than pretending native APIs exist.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

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

export interface GeneratedThumbnail extends ExtractedFrame {
  timestampMs: number;
}

export interface ExtractProgressEvent {
  operationId: string;
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
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
  generateThumbnails(options: {
    uri: string;
    count?: number;
    width?: number;
    quality?: number;
  }): Promise<{ indexId: string; generatedCount: number; thumbnails: GeneratedThumbnail[] }>;
  addListener(
    eventName: "extractProgress",
    listenerFunc: (event: ExtractProgressEvent) => void,
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
  getFrameTimestampPage(uri: string, startFrameIndex: number, limit = 500): Promise<FrameTimestampPage> {
    assertAndroid();
    return NativeFrameExtractor.getFrameTimestampPage({ uri, startFrameIndex, limit });
  },
  extractFrame(uri: string, frameIndex: number, targetWidth = 0, quality = 95): Promise<ExtractedFrame> {
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
    return NativeFrameExtractor.extractFrameRange({ uri, startFrameIndex, endFrameIndex, targetWidth, quality });
  },
  generateThumbnails(uri: string, count = 100, width = 160, quality = 80) {
    assertAndroid();
    return NativeFrameExtractor.generateThumbnails({ uri, count, width, quality });
  },
  addProgressListener(listener: (event: ExtractProgressEvent) => void) {
    assertAndroid();
    return NativeFrameExtractor.addListener("extractProgress", listener);
  },
  /** Convert an app-private native file path into a URL the Capacitor WebView can display. */
  toWebViewUrl(nativePath: string): string {
    return Capacitor.convertFileSrc(nativePath);
  },
};
