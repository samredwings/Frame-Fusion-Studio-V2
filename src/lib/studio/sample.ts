import { paintDemoFrame } from "@/lib/studio/draw";
import { canvasToBlob } from "@/lib/studio/media";
import { frameKey, idbPut } from "@/lib/studio/idb";
import type { Project, Region, Source } from "@/lib/studio/types";

export const DEMO_PROJECT_ID = "demo-harbor";
export const DEMO_TAKE_A = "demo-take-a";
export const DEMO_TAKE_B = "demo-take-b";

const WIDTH = 560;
const HEIGHT = 316;
const FPS = 10;
const FRAMES = 20;

async function writeTake(sourceId: string, variant: "a" | "b") {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the demo reel.");
  for (let i = 0; i < FRAMES; i++) {
    paintDemoFrame(ctx, WIDTH, HEIGHT, i, FRAMES, variant);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    await idbPut("blobs", frameKey(sourceId, i), blob);
  }
}

export async function seedDemo(): Promise<void> {
  const now = Date.now();
  const project: Project = {
    id: DEMO_PROJECT_ID,
    name: "Harbor Night",
    description: "Seeded reel so every tool has something to cut before you import your own take.",
    status: "cutting",
    fps: FPS,
    createdAt: now,
    updatedAt: now,
  };
  const sources: Source[] = [
    {
      id: DEMO_TAKE_A,
      projectId: DEMO_PROJECT_ID,
      filename: "harbor-take-a.webm",
      role: "primary",
      fps: FPS,
      frameCount: FRAMES,
      durationMs: Math.round((FRAMES / FPS) * 1000),
      width: WIDTH,
      height: HEIGHT,
      fileSize: 0,
      lock: null,
      createdAt: now,
    },
    {
      id: DEMO_TAKE_B,
      projectId: DEMO_PROJECT_ID,
      filename: "harbor-take-b.webm",
      role: "compare",
      fps: FPS,
      frameCount: FRAMES,
      durationMs: Math.round((FRAMES / FPS) * 1000),
      width: WIDTH,
      height: HEIGHT,
      fileSize: 0,
      lock: null,
      createdAt: now + 1,
    },
  ];
  await writeTake(DEMO_TAKE_A, "a");
  await writeTake(DEMO_TAKE_B, "b");
  const region: Region = {
    id: "demo-ring",
    projectId: DEMO_PROJECT_ID,
    sourceId: DEMO_TAKE_A,
    label: "Signal ring",
    kind: "blur",
    amount: 72,
    x: 0.1,
    y: 0.14,
    w: 0.24,
    h: 0.32,
    frameIn: 0,
    frameOut: FRAMES - 1,
  };
  await idbPut("projects", project.id, project);
  for (const source of sources) await idbPut("sources", source.id, source);
  await idbPut("regions", region.id, region);
  await idbPut("edits", "demo-grade", {
    id: "demo-grade",
    projectId: DEMO_PROJECT_ID,
    sourceId: DEMO_TAKE_A,
    frameIndex: 8,
    kind: "grade",
    grade: { brightness: 108, contrast: 112, saturate: 118, warmth: 28 },
  });
}
