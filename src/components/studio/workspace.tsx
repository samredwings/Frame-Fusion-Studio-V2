import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Columns2, Download, Film, Scan, ScanFace, Settings2, Upload, type LucideIcon } from "lucide-react";
import { useStudio } from "@/lib/studio/store";
import { TOOLS, type ToolId } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { BlurTool } from "@/components/studio/blur-tool";
import { CompareTool } from "@/components/studio/compare-tool";
import { ExportTool } from "@/components/studio/export-tool";
import { FaceTool } from "@/components/studio/face-tool";
import { FrameTool } from "@/components/studio/frame-tool";
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
  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const source = mine.find((item) => item.id === sourceId) ?? mine.find((item) => item.role === "primary") ?? mine[0];
  const { urls, loading } = useBaseFrames(source);
  const replacements = useReplacements(source?.id, edits);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">Frames are extracted on this device. Your clip stays local; up to 48 frames are kept for review.</p>
              <Button className="mt-5" onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden="true" />Import video</Button>
            </div>
          ) : loading || !urls.length ? (
            <p className="m-auto text-sm text-muted" role="status">Preparing frame rail…</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {tool === "frames" ? <FrameTool source={source} urls={urls} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} previewRef={previewRef} /> : null}
              {tool === "compare" ? <CompareTool sources={mine} primary={source} urls={urls} frameIndex={Math.min(frameIndex, urls.length - 1)} onSeek={setFrameIndex} /> : null}
              {tool === "blur" ? <BlurTool source={source} urls={urls} replacements={replacements} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} /> : null}
              {tool === "faces" ? <FaceTool source={source} urls={urls} replacements={replacements} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} /> : null}
              {tool === "export" ? <ExportTool source={source} urls={urls} replacements={replacements} frameIndex={Math.min(frameIndex, urls.length - 1)} playing={playing} onSeek={setFrameIndex} onToggle={() => setPlaying((value) => !value)} /> : null}
            </div>
          )}
        </main>

        <nav className="studio-dock grid shrink-0 grid-cols-5 gap-1 px-2 pt-2" role="tablist" aria-label="Frame tools">
          {TOOLS.map(({ id }) => {
            const { label, Icon } = toolMeta[id];
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={label}
                className={`studio-dock-item flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-[background-color,color] duration-150 sm:min-h-16 sm:flex-row sm:gap-2 sm:text-xs ${active ? "bg-amber text-amber-ink" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
                onClick={() => openTool(id)}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </Shell>
  );
}
