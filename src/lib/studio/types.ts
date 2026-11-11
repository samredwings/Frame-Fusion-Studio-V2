export type ProjectStatus = "draft" | "cutting" | "review" | "delivered";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  fps: number;
  createdAt: number;
  updatedAt: number;
};

export type SourceRole = "primary" | "compare";

export type NormRect = { x: number; y: number; w: number; h: number };

export type Source = {
  id: string;
  projectId: string;
  filename: string;
  role: SourceRole;
  fps: number;
  frameCount: number;
  durationMs: number;
  width: number;
  height: number;
  fileSize: number;
  lock: NormRect | null;
  createdAt: number;
};

export type Grade = {
  brightness: number;
  contrast: number;
  saturate: number;
  warmth: number;
  preset?: "original" | "bright" | "pink" | "latte" | "vintage" | "mono";
};

export type TextOverlay = { text: string; x: number; y: number; size: number; color: string };

export type FrameStyle = {
  crop: NormRect | null;
  rotation: 0 | 90 | 180 | 270;
  backgroundColor: string;
  frameColor: string | null;
  frameWidth: number;
  text: TextOverlay | null;
};

export const DEFAULT_FRAME_STYLE: FrameStyle = {
  crop: null,
  rotation: 0,
  backgroundColor: "#101317",
  frameColor: null,
  frameWidth: 0.035,
  text: null,
};

export const NEUTRAL_GRADE: Grade = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  warmth: 0,
};

export type FrameEdit =
  | {
      id: string;
      projectId: string;
      sourceId: string;
      frameIndex: number;
      kind: "replace";
      blobKey: string;
    }
  | {
      id: string;
      projectId: string;
      sourceId: string;
      frameIndex: number;
      kind: "grade";
      grade: Grade;
    }
  | {
      id: string;
      projectId: string;
      sourceId: string;
      frameIndex: number;
      kind: "nudge";
      dx: number;
      dy: number;
    }
  | {
      id: string;
      projectId: string;
      sourceId: string;
      frameIndex: number;
      kind: "style";
      style: FrameStyle;
    };

export type RegionKind = "blur" | "pixel" | "mask" | "pip" | "cutout" | "doodle";

export type Region = {
  id: string;
  projectId: string;
  sourceId: string;
  label: string;
  kind: RegionKind;
  amount: number;
  x: number;
  y: number;
  w: number;
  h: number;
  frameIn: number;
  frameOut: number;
  blobKey?: string;
};

export type ExportItem = {
  id: string;
  projectId: string;
  sourceId: string;
  filename: string;
  bytes: number;
  width: number;
  height: number;
  frameCount: number;
  createdAt: number;
  blobKey: string;
};

export type ToolId = "frames" | "compare" | "blur" | "faces" | "export";

export const TOOLS: { id: ToolId; label: string }[] = [
  { id: "frames", label: "Frame Editor" },
  { id: "compare", label: "Multi-Compare" },
  { id: "blur", label: "Blur Studio" },
  { id: "faces", label: "FaceSync" },
  { id: "export", label: "Exports" },
];

export function parseTool(value: unknown): ToolId {
  return value === "compare" ||
    value === "blur" ||
    value === "faces" ||
    value === "export" ||
    value === "frames"
    ? value
    : "frames";
}

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
  exactFrameIndex?: boolean;
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
  type:
    | "crop"
    | "rotate"
    | "flip"
    | "adjust"
    | "filter"
    | "effect"
    | "text"
    | "sticker"
    | "draw"
    | "background";
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
  detectedWatermarks: DetectedWatermark[];
  watermarkRemovals: WatermarkRemovalRepair[];
  textRemovals: TextRemovalRepair[];
  updatedAt: number;
}

export interface TimelineTrack {
  id: string;
  type: "original-video" | "replacement-frames" | "region-repair" | "audio";
  label: string;
  segments: Array<{
    startFrameIndex: number;
    endFrameIndex: number;
    sourceId: string;
    color: string;
  }>;
  visible: boolean;
  locked: boolean;
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

export type WatermarkType = "logo" | "text" | "timestamp" | "subtitle" | "qr" | "unknown";
export type RemovalAlgorithm =
  | "naive-diffusion"
  | "inpaint-ns"
  | "inpaint-telea"
  | "texture-synthesis"
  | "frame-interpolation"
  | "donor-patch";
export type DetectionMethod =
  "manual" | "template-match" | "ocr-detect" | "ai-detect" | "static-region";
export interface DetectedWatermark {
  id: string;
  type: WatermarkType;
  detectionMethod: DetectionMethod;
  bounds: NormalizedRect;
  confidence: number;
  detectedAtFrameIndex: number;
  isPersistent: boolean;
  sampleImagePath?: string;
}
export interface StoredDetectedWatermark {
  id: string;
  projectId: string;
  sourceVideoId: string;
  detection: DetectedWatermark;
  createdAt: number;
}
export interface WatermarkRemovalSettings {
  algorithm: RemovalAlgorithm;
  featherPx: number;
  expansionPx: number;
  temporalBlendRatio: number;
  colorMatch: boolean;
  donorFrameIndex?: number;
  quality: number;
}
export interface WatermarkRemovalRepair {
  id: string;
  projectId: string;
  sourceVideoId: string;
  watermarkId: string;
  startFrameIndex: number;
  endFrameIndex: number;
  settings: WatermarkRemovalSettings;
  status: RepairStatus;
  previewImagePath?: string;
  createdAt: number;
  updatedAt: number;
}
export interface TextRemovalRepair {
  id: string;
  projectId: string;
  sourceVideoId: string;
  detectionMethod: DetectionMethod;
  bounds: NormalizedRect;
  startFrameIndex: number;
  endFrameIndex: number;
  settings: WatermarkRemovalSettings;
  status: RepairStatus;
  previewImagePath?: string;
  createdAt: number;
  updatedAt: number;
}