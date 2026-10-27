import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Columns2, Download, Film, Scan, ScanFace, Settings2, SlidersHorizontal, Upload, X, type LucideIcon } from "lucide-react";
import { idbDel, idbPut } from "@/lib/studio/idb";
import { useStudio } from "@/lib/studio/store";
import { TOOLS, type ToolId } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { BlurTool } from "@/components/studio/blur-tool";
import { CompareTool } from "@/components/studio/compare-tool";
import { ExportTool } from "@/components/studio/export-tool";
import { FaceTool } from "@/components/studio/face-tool";
import { FrameTool } from "@/components/studio/frame-tool";
import type { FrameAction } from "@/components/studio/stage";
import { useBaseFrames, useReplacements } from "@/components/studio/use-frames";
import { Button, Select } from "@/components/studio/ui";

const toolMeta: Record<ToolId, { label: string; Icon: LucideIcon }> = {
  frames: { label: "Frames", Icon: Film },
  compare: { label: "Compare", Icon: Columns2 },
  blur: { label: "Masks", Icon: Scan },
  faces: { label: "FaceSync", Icon: ScanFace },
  export: { label: "Export", Icon: Download },
};

export function Workspace({
  projectId,
  tool,
  sourceId,
}: {
  projectId: string;
  tool: ToolId;
  sourceId?: string;
}) {
  const navigate = useNavigate();
  const ready = useStudio((state) => state.ready);
  const projects = useStudio((state) => state.projects);
  const sources = useStudio((state) => state.sources);
  const edits = useStudio((state) => state.edits);
  const importVideo = useStudio((state) => state.importVideo);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const deleteFrame = useStudio((state) => state.deleteFrame);
  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const source = mine.find((item) => item.id === sourceId) ?? mine.find((item) => item.role === "primary") ?? mine[0];
  const { urls, loading } = useBaseFrames(source);
  const replacements = useReplacements(source?.id, edits);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(24);
  const [toolsOpen, setToolsOpen] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameImageRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ sourceId: string; projectId: string; frameIndex: number } | null>(null);

  useEffect(() => {
    if (!ready || !source || source.id === sourceId) return;
    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
      search: { tool, source: source.id },
      replace: true,
    });
  }, [ready, source, sourceId, tool, projectId, navigate]);

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
  }, [source?.id]);

  useEffect(() => {
    if (!playing || !source?.frameCount) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % source.frameCount);
    }, 1000 / Math.max(1, source.fps));
    return () => window.clearInterval(timer);
  }, [playing, source]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (!source) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setFrameIndex((current) => Math.min(source.frameCount - 1, current + 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setFrameIndex((current) => Math.max(0, current - 1));
      } else if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key >= "1" && event.key <= "5") {
        const next = TOOLS[Number(event.key) - 1];
        if (next) {
          void navigate({ to: "/projects/$projectId", params: { projectId }, search: { tool: next.id, source: source.id } });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, navigate, projectId]);

  function openTool(next: ToolId) {
    void navigate({ to: "/projects/$projectId", params: { projectId }, search: { tool: next, source: source?.id } });
  }

  function onFrameAction(action: FrameAction, index: number) {
    if (!source) return;
    setPlaying(false);
    if (action === "edit") {
      setFrameIndex(index);
      openTool("frames");
      return;
    }
    if (action === "replace") {
      setFrameIndex(index);
      replaceTarget.current = { sourceId: source.id, projectId: source.projectId, frameIndex: index };
      frameImageRef.current?.click();
      return;
    }
    void deleteFrame(source.id, index)
      .then(() => setFrameIndex((current) => Math.min(current > index ? current - 1 : current, source.frameCount - 2)))
      .catch((error) => useStudio.setState({ error: error instanceof Error ? error.message : "Could not remove that frame." }));
  }

  async function onReplacementImage(file: File) {
    const target = replaceTarget.current;
    replaceTarget.current = null;
    if (!target) return;
    if (!file.type.startsWith("image/")) {
      useStudio.setState({ error: "Choose an image file to replace this frame." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      useStudio.setState({ error: "Keep replacement images under 20 MB." });
      return;
    }
    const id = crypto.randomUUID();
    const blobKey = `r:${id}`;
    try {
      await idbPut("blobs", blobKey, file);
      await upsertEdit({ id, projectId: target.projectId, sourceId: target.sourceId, frameIndex: target.frameIndex, kind: "replace", blobKey });
      useStudio.setState({ notice: `Frame ${target.frameIndex + 1} was replaced.` });
    } catch (error) {
      await idbDel("blobs", blobKey).catch(() => undefined);
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not replace that frame." });
    }
  }

  async function onFile(file: File) {
    if (!project) return;
    try {
      const id = await importVideo(project.id, file, fps);
      setFrameIndex(0);
      void navigate({ to: "/projects/$projectId", params: { projectId }, search: { tool, source: id } });
    } catch {
      /* The app-level status line explains import failures. */
    }
  }

  if (!ready) {
    return <Shell><p className="m-auto text-sm text-muted">Opening your local library…</p></Shell>;
  }

  if (!project) {
    return (
      <Shell>
        <div className="m-auto max-w-md px-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Project unavailable</h1>
          <p className="mt-2 text-sm text-muted">This project isn’t in the on-device library.</p>
          <Link to="/" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm hover:bg-surface">
            <ArrowLeft className="size-4" aria-hidden="true" />Back to projects
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      trail={
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link to="/" aria-label="Back to projects" className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold sm:text-base">{project.name}</p>
            <p className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:block">LOCAL PROJECT</p>
          </div>
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            search={{ tool, source: source?.id }}
            aria-label="Project settings"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Settings2 className="size-4" aria-hidden="true" />
          </Link>
        </div>
      }
    >
      <div className="studio-workspace flex min-h-0 flex-1 flex-col">
        <div className="studio-toolbar flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
          <label className="min-w-0 flex-1" htmlFor="workspace-source">
            <span className="sr-only">Selected source</span>
            <Select
              id="workspace-source"
              className="studio-select w-full min-w-0"
              value={source?.id ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                if (next) void navigate({ to: "/projects/$projectId", params: { projectId }, search: { tool, source: next } });
              }}
              aria-label="Selected source"
            >
              {!mine.length ? <option value="">Choose a take</option> : null}
              {mine.map((item, index) => (
                <option key={item.id} value={item.id}>{String(index + 1).padStart(2, "0")} · {item.filename}</option>
              ))}
            </Select>
          </label>
          <label className="studio-rate flex shrink-0 items-center gap-2 rounded-xl px-2.5">
            <span className="hidden font-mono text-[9px] uppercase tracking-wider text-muted sm:block">Capture</span>
            <Select className="w-[5.25rem] border-0 bg-transparent px-1" aria-label="Extract frame rate" value={fps} onChange={(event) => setFps(Number(event.target.value))}>
              {[4, 8, 12, 24].map((value) => <option key={value} value={value}>{value} fps</option>)}
            </Select>
          </label>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="video/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={frameImageRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void onReplacementImage(file);
              else replaceTarget.current = null;
              event.currentTarget.value = "";
            }}
          />
          <Button className="shrink-0 rounded-xl px-3" onClick={() => fileRef.current?.click()} aria-label="Import a video take">
            <Upload className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </div>

        <main className="flex min-h-0 flex-1 flex-col">
          {!source ? (
            <div className="m-auto max-w-md px-6 py-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-amber"><Film className="size-6" aria-hidden="true" /></span>
              <p className="studio-kicker mt-5">FIRST TAKE</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Bring a clip into the atlas</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">Frames are extracted on this device. Your clip stays local; capture up to six seconds at 24 fps.</p>
              <Button className="mt-5" onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden="true" />Import video</Button>
            </div>
          ) : loading || !urls.length ? (
            <p className="m-auto text-sm text-muted" role="status">Preparing frame rail…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {tool === "frames" ? <FrameTool source={source} urls={urls} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} onFrameAction={onFrameAction} previewRef={previewRef} /> : null}
              {tool === "compare" ? <CompareTool sources={mine} primary={source} urls={urls} frameIndex={Math.min(frameIndex, urls.length - 1)} onSeek={setFrameIndex} /> : null}
              {tool === "blur" ? <BlurTool source={source} urls={urls} replacements={replacements} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} onFrameAction={onFrameAction} /> : null}
              {tool === "faces" ? <FaceTool source={source} urls={urls} replacements={replacements} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} onFrameAction={onFrameAction} /> : null}
              {tool === "export" ? <ExportTool source={source} urls={urls} replacements={replacements} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} onFrameAction={onFrameAction} /> : null}
            </div>
          )}
        </main>

        <nav className="studio-dock flex shrink-0 items-center justify-between gap-3 px-3 sm:px-5" aria-label="Editor tools">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Editing</p>
            <p className="truncate text-sm font-semibold">{toolMeta[tool].label}</p>
          </div>
          <Button aria-expanded={toolsOpen} aria-haspopup="dialog" className="min-w-28 rounded-xl" onClick={() => setToolsOpen(true)}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />Edit
          </Button>
        </nav>
      </div>
      {toolsOpen ? (
        <div className="studio-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pt-8" onClick={() => setToolsOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-tools-title" className="studio-sheet w-full max-w-lg rounded-t-3xl p-4 sm:mb-4 sm:rounded-3xl sm:p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div><p className="studio-kicker">FRAME TOOLS</p><h2 id="edit-tools-title" className="mt-1 font-display text-2xl font-semibold">Edit</h2></div>
              <button type="button" aria-label="Close edit tools" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setToolsOpen(false)}><X className="size-4" aria-hidden="true" /></button>
            </div>
            <div className="mt-3 grid gap-2">
              {TOOLS.map(({ id }) => {
                const { label, Icon } = toolMeta[id];
                return (
                  <button key={id} type="button" autoFocus={id === tool} className={`studio-sheet-action ${id === tool ? "bg-surface-2" : ""}`} onClick={() => { setToolsOpen(false); openTool(id); }}>
                    <Icon className="size-5 text-amber" aria-hidden="true" />
                    <span><strong>{label}</strong><small>{id === "frames" ? "Adjust, replace, and save individual frames" : id === "compare" ? "Compare two takes side by side" : id === "blur" ? "Mask or blur selected regions" : id === "faces" ? "Track and stabilize a face lock" : "Render and share the finished take"}</small></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
