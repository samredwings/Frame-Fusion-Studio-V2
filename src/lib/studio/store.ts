import { create } from "zustand";
import { frameKey, idbAll, idbDel, idbGet, idbPut } from "@/lib/studio/idb";
import { extractVideoFrames } from "@/lib/studio/media";
import { DEMO_PROJECT_ID, seedDemo } from "@/lib/studio/sample";
import type { ExportItem, FrameEdit, Grade, Project, ProjectStatus, Region, RegionKind, Source, SourceRole } from "@/lib/studio/types";

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
  boot: () => Promise<void>;
  dismiss: () => void;
  createProject: (name: string, description: string) => Promise<string>;
  updateProject: (id: string, patch: Partial<Pick<Project, "name" | "description" | "status" | "fps">>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreDemo: () => Promise<void>;
  importVideo: (projectId: string, file: File, fps: number) => Promise<string>;
  deleteSource: (id: string) => Promise<void>;
  setLock: (sourceId: string, lock: Source["lock"]) => Promise<void>;
  upsertEdit: (edit: FrameEdit) => Promise<void>;
  clearFrame: (sourceId: string, frameIndex: number) => Promise<void>;
  addRegion: (region: Region) => Promise<void>;
  updateRegion: (id: string, patch: Partial<Pick<Region, "label" | "kind" | "amount" | "frameIn" | "frameOut">>) => Promise<void>;
  deleteRegion: (id: string) => Promise<void>;
  saveExport: (item: ExportItem, blob: Blob) => Promise<void>;
  deleteExport: (id: string) => Promise<void>;
};

let booting: Promise<void> | null = null;

async function readLibrary() {
  const [projects, sources, edits, regions, exports] = await Promise.all([
    idbAll<Project>("projects"),
    idbAll<Source>("sources"),
    idbAll<FrameEdit>("edits"),
    idbAll<Region>("regions"),
    idbAll<ExportItem>("exports"),
  ]);
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  sources.sort((a, b) => a.createdAt - b.createdAt);
  exports.sort((a, b) => b.createdAt - a.createdAt);
  return { projects, sources, edits, regions, exports };
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
      fps: 8,
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
    for (const source of sources) await dropSourceMedia(source, get().edits, get().exports);
    for (const region of get().regions) if (region.projectId === id) await idbDel("regions", region.id);
    await idbDel("projects", id);
    set({
      projects: get().projects.filter((project) => project.id !== id),
      sources: get().sources.filter((source) => source.projectId !== id),
      edits: get().edits.filter((edit) => edit.projectId !== id),
      regions: get().regions.filter((region) => region.projectId !== id),
      exports: get().exports.filter((item) => item.projectId !== id),
    });
  },
  restoreDemo: async () => {
    set({ busy: "Restoring the Harbor Night reel…" });
    try {
      if (get().projects.some((project) => project.id === DEMO_PROJECT_ID)) await get().deleteProject(DEMO_PROJECT_ID);
      await seedDemo();
      const data = await readLibrary();
      set({ ...data, busy: null, notice: "Harbor Night is back in the bay." });
    } catch (error) {
      set({ busy: null, error: error instanceof Error ? error.message : "Could not restore the demo." });
    }
  },
  importVideo: async (projectId, file, fps) => {
    if (file.size > 80 * 1024 * 1024) throw new Error("Keep imports under 80 MB.");
    const looksVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|ogv|m4v)$/i.test(file.name);
    if (!looksVideo) throw new Error("Choose a video file.");
    const id = crypto.randomUUID();
    set({ busy: "Reading the video…", error: null });
    try {
      const extracted = await extractVideoFrames(file, fps, 48, (done, total) => {
        set({ busy: `Extracting frame ${done} of ${total}` });
      });
      for (let i = 0; i < extracted.frames.length; i++) {
        const blob = extracted.frames[i];
        if (blob) await idbPut("blobs", frameKey(id, i), blob);
      }
      const role: SourceRole = get().sources.some((source) => source.projectId === projectId) ? "compare" : "primary";
      const source: Source = {
        id,
        projectId,
        filename: file.name,
        role,
        fps,
        frameCount: extracted.frames.length,
        durationMs: Math.round(extracted.duration * 1000),
        width: extracted.width,
        height: extracted.height,
        fileSize: file.size,
        lock: null,
        createdAt: Date.now(),
      };
      await idbPut("sources", source.id, source);
      const project = get().projects.find((item) => item.id === projectId);
      if (project && role === "primary") {
        const next = { ...project, fps, updatedAt: Date.now() };
        await idbPut("projects", project.id, next);
        set({ projects: get().projects.map((item) => (item.id === project.id ? next : item)) });
      } else if (project) {
        const next = { ...project, updatedAt: Date.now() };
        await idbPut("projects", project.id, next);
        set({ projects: get().projects.map((item) => (item.id === project.id ? next : item)) });
      }
      set({ sources: [...get().sources, source], busy: null, notice: `Imported ${extracted.frames.length} frames from ${file.name}.` });
      return id;
    } catch (error) {
      for (let i = 0; i < 48; i++) await idbDel("blobs", frameKey(id, i)).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Import failed.";
      set({ busy: null, error: message });
      throw error;
    }
  },
  deleteSource: async (id) => {
    const source = get().sources.find((item) => item.id === id);
    if (!source) return;
    await dropSourceMedia(source, get().edits, get().exports);
    for (const region of get().regions) if (region.sourceId === id) await idbDel("regions", region.id);
    await idbDel("sources", id);
    set({
      sources: get().sources.filter((item) => item.id !== id),
      edits: get().edits.filter((edit) => edit.sourceId !== id),
      regions: get().regions.filter((region) => region.sourceId !== id),
      exports: get().exports.filter((item) => item.sourceId !== id),
    });
  },
  setLock: async (sourceId, lock) => {
    const source = get().sources.find((item) => item.id === sourceId);
    if (!source) return;
    const next = { ...source, lock };
    await idbPut("sources", sourceId, next);
    set({ sources: get().sources.map((item) => (item.id === sourceId ? next : item)) });
  },
  upsertEdit: async (edit) => {
    const previous = get().edits.find(
      (item) => item.sourceId === edit.sourceId && item.frameIndex === edit.frameIndex && item.kind === edit.kind,
    );
    if (previous && previous.id !== edit.id) {
      if (previous.kind === "replace") await idbDel("blobs", previous.blobKey);
      await idbDel("edits", previous.id);
    }
    if (edit.kind === "replace") {
      const blob = await idbGet<Blob>("blobs", edit.blobKey);
      if (!blob) throw new Error("The replacement frame was not stored.");
    }
    await idbPut("edits", edit.id, edit);
    set({
      edits: [...get().edits.filter((item) => item.id !== previous?.id && item.id !== edit.id), edit],
    });
  },
  clearFrame: async (sourceId, frameIndex) => {
    const doomed = get().edits.filter((edit) => edit.sourceId === sourceId && edit.frameIndex === frameIndex);
    for (const edit of doomed) {
      if (edit.kind === "replace") await idbDel("blobs", edit.blobKey);
      await idbDel("edits", edit.id);
    }
    set({ edits: get().edits.filter((edit) => !(edit.sourceId === sourceId && edit.frameIndex === frameIndex)) });
  },
  addRegion: async (region) => {
    await idbPut("regions", region.id, region);
    set({ regions: [...get().regions, region] });
  },
  updateRegion: async (id, patch) => {
    const current = get().regions.find((region) => region.id === id);
    if (!current) return;
    const next: Region = { ...current, ...patch };
    await idbPut("regions", id, next);
    set({ regions: get().regions.map((region) => (region.id === id ? next : region)) });
  },
  deleteRegion: async (id) => {
    await idbDel("regions", id);
    set({ regions: get().regions.filter((region) => region.id !== id) });
  },
  saveExport: async (item, blob) => {
    await idbPut("blobs", item.blobKey, blob);
    await idbPut("exports", item.id, item);
    set({ exports: [item, ...get().exports], notice: `Saved ${item.filename}.` });
  },
  deleteExport: async (id) => {
    const item = get().exports.find((entry) => entry.id === id);
    if (!item) return;
    await idbDel("blobs", item.blobKey);
    await idbDel("exports", id);
    set({ exports: get().exports.filter((entry) => entry.id !== id) });
  },
}));

export type { Grade, RegionKind, ProjectStatus };
