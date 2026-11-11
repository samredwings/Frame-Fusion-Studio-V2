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
  captureMethod?: "manual" | "interval";
  captureIntervalMs?: number;
  captureRanges?: Array<{ id: string; startMs: number; endMs: number }>;
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
  presentat