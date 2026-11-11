import { create } from "zustand";
import {
  frameKey,
  idbAll,
  idbBatch,
  idbDel,
  idbGet,
  idbPut,
  type IDBBatchOperation,
} from "@/lib/studio/idb";
import { extractVideoFrames } from "@/lib/studio/media";
import { FrameExtractor, type FrameTimestamp } from "@/lib/native/frame-extractor";
import { selectFramesForCapture, type NativeVideoCapturePlan } from "@/lib/studio/extraction-plan";
import { DEMO_PROJECT_ID, seedDemo } from "@/lib/studio/sample";
import type {
  DetectedWatermark,
  ExportItem,
  FrameAsset,
  FrameEdit,
  Grade,
  Project,
  ProjectStatus,
  Region,
  RegionKind,
  RepairManifest,
  RenderJob,
  Source,
  SourceRole,
  StoredDetectedWatermark,
  TextRemovalRepair,
  VideoSource,
  WatermarkRemovalRepair,
} from "@/lib/studio/types";

type StudioState = {
  ready: boolean;
  error: string | null;
  notice: string | null;
  busy: string | null;
  projects: Project[];
  sources: Source[];
  edits: FrameEdit[];
  regions: Region[];
  exports: ExportItem[];
  videoSources: VideoSource[];
  frameAssets: FrameAsset[];
  repairManifests: RepairManifest[];
  renderJobs: RenderJob[];
  detectedWatermarks: StoredDetectedWatermark[];
  watermarkRemovals: WatermarkRemovalRepair[];
  textRemovals: TextRemovalRepair[];
  boot: () => Promise<void>;
  dismiss: () => void;
  createProject: (name: string, description: string) => Promise<string>;
  updateProject: (
    id: string,
    patch: Partial<Pick<Project, "name" | "description" | "status" | "fps">>,
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreDemo: () => Promise<void>;
  importVideo: (projectId: string, file: File, fps: number) => Promise<string>;
  importNativeVideo: (projectId: string, plan: NativeVideoCapturePlan) => Promise<string>;
  deleteSource: (id: string) => Promise<void>;
  deleteFrame: (sourceId: string, frameIndex: number) => Promise<void>;
  setLock: (sourceId: string, lock: Source["lock"]) => Promise<void>;
  upsertEdit: (edit: FrameEdit) => Promise<void>;
  clearFrame: (sourceId: string, frameIndex: number) => Promise<void>;
  addRegion: (region: Region) => Promise<void>;
  updateRegion: (
    id: string,
    patch: Partial<
      Pick<
        Region,
        "label" | "kind" | "amount" | "frameIn" | "frameOut" | "x" | "y" | "w" | "h" | "blobKey"
      >
    >,
  ) => Promise<void>;
  deleteRegion: (id: string) => Promise<void>;
  saveExport: (item: ExportItem, blob: Blob) => Promise<void>;
  deleteExport: (id: string) => Promise<void>;
  upsertVideoSource: (source: VideoSource) => Promise<void>;
  upsertFrameAssets: (assets: FrameAsset[]) => Promise<void>;
  upsertRepairManifest: (manifest: RepairManifest) => Promise<void>;
  upsertRenderJob: (job: RenderJob) => Promise<void>;
  upsertDetectedWatermarks: (
    projectId: string,
    sourceVideoId: string,
    detections: DetectedWatermark[],
  ) => Promise<void>;
  upsertWatermarkRemoval: (repair: WatermarkRemovalRepair) => Promise<void>;
  upsertTextRemoval: (repair: TextRemovalRepair) => Promise<void>;
  deleteVideoSource: (id: string) => Promise<void>;
};

let booting: Promise<void> | null = null;

async function readLibrary() {
  const [
    projects,
    sources,
    edits,
    regions,
    exports,
    videoSources,
    frameAssets,
    repairManifests,
    renderJobs,
    detectedWatermarks,
    watermarkRemovals,
    textRemovals,
  ] = await Promise.all([
    idbAll<Project>("projects"),
    idbAll<Source>("sources"),
    idbAll<FrameEdit>("edits"),
    idbAll<Region>("regions"),
    idbAll<ExportItem>("exports"),
    idbAll<VideoSource>("videoSources"),
    idbAll<FrameAsset>("frameAssets"),
    idbAll<RepairManifest>("repairManifests"),
    idbAll<RenderJob>("renderJobs"),
    idbAll<StoredDetectedWatermark>("detectedWatermarks"),
    idbAll<WatermarkRemovalRepair>("watermarkRemovals"),
    idbAll<TextRemovalRepair>("textRemovals"),
  ]);
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  sources.sort((a, b) => a.createdAt - b.createdAt);
  exports.sort((a, b) => b.createdAt - a.createdAt);
  videoSources.sort((a, b) => b.importedAt - a.importedAt);
  frameAssets.sort(
    (a, b) => a.sourceVideoId.localeCompare(b.sourceVideoId) || a.frameIndex - b.frameIndex,
  );
  renderJobs.sort((a, b) => b.createdAt - a.createdAt);
  return {
    projects,
    sources,
    edits,
    regions,
    exports,
    videoSources,
    frameAssets,
    repairManifests,
    renderJobs,
    detectedWatermarks,
    watermarkRemovals,
    textRemovals,
  };
}

async function dropSourceMedia(source: Source, edits: FrameEdit[], exports: ExportItem[]) {
  for (let i = 0; i < source.frameCount; i++) await idbDel("blobs", frameKey(source.id, i));
  for (const edit of edits) {
    if (edit.sourceId === source.id && edit.kind === "replace") await idbDel("blobs", edit.blobKey);
    if (edit.sourceId === source.id) await idbDel("edits", edit.id);
  }
  for (const item of exports) {
    if (item.sourceId === source.id) {
      await idbDel("blobs", item.blobKey);
      await idbDel("exports", item.id);
    }
  }
}

export const useStudio = create<StudioState>((set, get) => ({
  ready: false,
  error: null,
  notice: null,
  busy: null,
  projects: [],
  sources: [],
  edits: [],
  regions: [],
  exports: [],
  videoSources: [],
  frameAssets: [],
  repairManifests: [],
  renderJobs: [],
  detectedWatermarks: [],
  watermarkRemovals: [],
  textRemovals: [],
  dismiss: () => set({ notice: null, error: null }),
  boot: () => {
    if (booting) return booting;
    booting = (async () => {
      try {
        let data = await readLibrary();
        if (!data.projects.length) {
          await seedDemo();
          data = await readLibrary();
        }
        set({ ready: true, ...data, error: null });
      } catch (error) {
        set({
          ready: true,
          error: error instanceof Error ? error.message : "The local library could not be opened.",
        });
      }
    })();
    return booting;
  },
  createProject: async (name, description) => {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      status: "draft",
      fps: 24,
      createdAt: now,
      updatedAt: now,
    };
    await idbPut("projects", project.id, project);
    set({ projects: [project, ...get().projects], notice: null });
    return project.id;
  },
  updateProject: async (id, patch) => {
    const current = get().projects.find((project) => project.id === id);
    if (!current) return;
    const next: Project = { ...current, ...patch, updatedAt: Date.now() };
    if (patch.name !== undefined) next.name = patch.name.trim() || current.name;
    await idbPut("projects", id, next);
    set({ projects: get().projects.map((project) => (project.id === id ? next : project)) });
  },
  deleteProject: async (id) => {
    const sources = get().sources.filter((source) => source.projectId === id);
    for (const source of sources) await d