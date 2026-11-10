/**
 * Additive models for the native video workflow.
 *
 * The legacy Source / FrameEdit model remains in types.ts until the UI and
 * project library have been migrated. Do not replace it wholesale.
 */

export type VideoCodec = "h264" | "hevc";
export type AudioExportMode = "preserve-original" | "reencode-aac" | "mute";
export type ExtractionMethod = "single" | "sequence" | "burst" | "interval" | "range" | "all";
export type RepairSeverity = "low" | "medium" | "high";
export type RepairStatus = "draft" | "ready" | "rendering" | "completed" | "failed";
export type MaskShape = "brush" | "ellipse" | "rectangle" | "lasso";
export type BlendMode = "normal" | "overlay" | "soft-light" | "multiply" | "screen";

export interface VideoMetadata {
  uri: string;
  filename: string;
  sizeBytes: number;
  durationMs: number;
  /** Metadata-reported frame count; the timestamp index is authoritative after indexing. */
  metadataFrameCount: number;
  nominalFrameRate: number;
  averageFrameRate: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  videoMimeType: string;
  videoBitrate: number;
  hasAudio: boolean;
  audioMimeType?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  audioBitrate?: number;
}

export interface VideoSource {
  id: string;
  projectId: string;
  /** Persistable Android content URI returned by the system document picker. */
  uri: string;
  filename: string;
  sizeBytes: number;
  durationMs: number;
  frameCount: number;
  nominalFrameRate: number;
  averageFrameRate: number;
  hasVariableFrameRate: boolean;
  frameIndexId: string;
  frameIndexVerified: boolean;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  videoMimeType: string;
  videoBitrate: number;
  hasAudio: boolean;
  audioMimeType?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  audioBitrate?: number;
  importedAt: number;
  updatedAt: number;
}

export interface FrameTimeMapEntry {
  frameIndex: number;
  /** Presentation timestamp, not a frameRate-derived estimate. */
  presentationTimeUs: number;
  /** Duration until the next presented frame, derived from adjacent timestamps. */
  durationUs: number;
}

export interface FrameAsset {
  id: string;
  projectId: string;
  sourceVideoId: string;
  frameIndex: number;
  presentationTimeUs: number;
  durationUs: number;
  fullResolutionPath: string;
  thumbnailPath?: string;
  width: number;
  height: number;
  fileSize: number;
  extractionMethod: ExtractionMethod;
  sequenceId?: string;
  isEdited: boolean;
  isReplacementCandidate: boolean;
  createdAt: number;
}

export interface ImageGrade {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  clarity: number;
  vibrance: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEditOperation {
  id: string;
  type: "crop" | "rotate" | "flip" | "adjust" | "filter" | "effect" | "text" | "sticker" | "draw" | "background";
  /** Serializable parameters so edits can be replayed without overwriting the original frame. */
  params: Record<string, unknown>;
  createdAt: number;
}

export interface EditedImage {
  id: string;
  projectId: string;
  sourceFrameId: string;
  sourceVideoId: string;
  frameIndex: number;
  operations: ImageEditOperation[];
  renderedPath?: string;
  width: number;
  height: number;
  fileSize?: number;
  isReplacementCandidate: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FrameAlignment {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface FrameReplacement {
  id: string;
  projectId: string;
  sourceVideoId: string;
  frameIndex: number;
  presentationTimeUs: number;
  replacementAssetId: string;
  alignment: FrameAlignment;
  blendMode: BlendMode;
  createdAt: number;
  updatedAt: number;
}

export interface FrameRangeReplacement {
  id: string;
  projectId: string;
  sourceVideoId: string;
  startFrameIndex: number;
  endFrameIndex: number;
  /** Explicit one-to-one mapping; frame count must match the selected source range. */
  replacements: Array<{
    frameIndex: number;
    presentationTimeUs: number;
    replacementAssetId: string;
    alignment: FrameAlignment;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface RegionRepair {
  id: string;
  projectId: string;
  sourceVideoId: string;
  startFrameIndex: number;
  endFrameIndex: number;
  mask: {
    shape: MaskShape;
    bounds?: NormalizedRect;
    points?: Array<{ x: number; y: number; pressure?: number }>;
    featherPx: number;
    expansionPx: number;
    maskAssetPath?: string;
  };
  replacement: {
    type: "donor-frame" | "image" | "edited-image";
    sourceFrameIndex?: number;
    assetId?: string;
  };
  alignment: FrameAlignment;
  blendMode: BlendMode;
  colorMatchEnabled: boolean;
  status: RepairStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SuspiciousFrame {
  frameIndex: number;
  presentationTimeUs: number;
  method: "temporal-anomaly" | "face-inconsistency" | "color-shift";
  confidence: number;
  severity: RepairSeverity;
  neighborFrameIndexes: number[];
  reviewed: boolean;
  decision: "pending" | "confirmed" | "dismissed";
}

export interface ReconstructionSettings {
  container: "mp4";
  videoCodec: VideoCodec;
  videoBitrate: number;
  audioMode: AudioExportMode;
  audioBitrate: number;
  resolution: "original" | { width: number; height: number };
  /**
   * "source-timestamps" preserves original PTS, including VFR timing.
   * A numeric value explicitly requests a constant-frame-rate conversion.
   */
  timing: "source-timestamps" | { constantFrameRate: number };
}

export interface RenderJob {
  id: string;
  projectId: string;
  sourceVideoId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
  outputPath?: string;
  errorMessage?: string;
  settings: ReconstructionSettings;
  createdAt: number;
  completedAt?: number;
}

export interface RepairManifest {
  schemaVersion: 1;
  projectId: string;
  sourceVideoId: string;
  frameIndexId: string;
  frameReplacements: FrameReplacement[];
  frameRangeReplacements: FrameRangeReplacement[];
  regionRepairs: RegionRepair[];
  suspiciousFrames: SuspiciousFrame[];
  reconstructionSettings: ReconstructionSettings;
  updatedAt: number;
}

export interface TimelineTrack {
  id: string;
  type: "original-video" | "replacement-frames" | "region-repair" | "audio";
  label: string;
  segments: Array<{
    startFrameIndex: number;
    endFrameIndex: number;
    operationId?: string;
    label?: string;
  }>;
}

/** Default reconstruction must retain source timestamps and original audio. */
export const DEFAULT_RECONSTRUCTION_SETTINGS: ReconstructionSettings = {
  container: "mp4",
  videoCodec: "h264",
  videoBitrate: 12_000_000,
  audioMode: "preserve-original",
  audioBitrate: 192_000,
  resolution: "original",
  timing: "source-timestamps",
};
