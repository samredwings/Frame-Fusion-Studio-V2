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
    };

export type RegionKind = "blur" | "pixel" | "mask";

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
  return value === "compare" || value === "blur" || value === "faces" || value === "export" || value === "frames"
    ? value
    : "frames";
}
