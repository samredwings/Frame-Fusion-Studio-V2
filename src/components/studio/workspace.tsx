import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Settings2, Upload } from "lucide-react";
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
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
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
          void navigate({
            to: "/projects/$projectId",
            params: { projectId },
            search: { tool: next.id, source: source.id },
          });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, navigate, projectId]);

  function openTool(next: ToolId) {
    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
      search: { tool: next, source: source?.id },
    });
  }

  async function onFile(file: File) {
    if (!project) return;
    try {
      const id = await importVideo(project.id, file, fps);
      setFrameIndex(0);
      void navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: { tool, source: id },
      });
    } catch {
      /* the bay banner already explains the failure */
    }
  }

  if (!ready) {
    return (
      <Shell>
        <p className="m-auto text-sm text-muted">Opening the workspace…</p>
      </Shell>
    );
  }

  if (!project) {
    return (
      <Shell>
        <div className="m-auto max-w-md px-6 text-center">
          <h1 className="font-display text-2xl">Project unavailable</h1>
          <p className="mt-2 text-sm text-muted">It is not in this browser’s bay.</p>
          <Link to="/" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-3 text-sm">
            Back to projects
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      trail={
        <div className="flex items-center justify-end gap-2">
          <p className="truncate font-display text-sm sm:text-base">{project.name}</p>
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            search={{ tool, source: source?.id }}
            aria-label="Project settings"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Settings2 className="size-4" />
          </Link>
        </div>
      }
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="workspace-source">
            Selected source
          </label>
          <Select
            id="workspace-source"
            className="w-auto min-w-0 flex-1 sm:max-w-xs"
            value={source?.id ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              if (!next) return;
              void navigate({
                to: "/projects/$projectId",
                params: { projectId },
                search: { tool, source: next },
              });
            }}
            aria-label="Selected source"
          >
            {!mine.length ? <option value="">No source yet</option> : null}
            {mine.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename}
              </option>
            ))}
          </Select>
          <Select className="w-24" aria-label="Extract frame rate" value={fps} onChange={(event) => setFps(Number(event.target.value))}>
            {[4, 8, 12, 24].map((value) => (
              <option key={value} value={value}>
                {value} fps
              </option>
            ))}
          </Select>
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
          <Button tone="line" className="shrink-0" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Import
          </Button>
        </div>
        <div className="hidden gap-1 sm:flex" role="tablist" aria-label="Project tools">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tool === item.id}
              className={`min-h-11 border-b-2 px-3 text-sm ${tool === item.id ? "border-amber text-fg" : "border-transparent text-muted"}`}
              onClick={() => openTool(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="sm:hidden">
          <span className="sr-only">Active tool</span>
          <Select value={tool} aria-label="Active tool" onChange={(event) => openTool(event.target.value as ToolId)}>
            {TOOLS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {!source ? (
        <div className="m-auto max-w-md px-6 text-center">
          <h2 className="font-display text-xl">Import a video to start cutting</h2>
          <p className="mt-2 text-sm text-muted">Frames are extracted in the browser and kept with this project. Cap is 48 frames.</p>
          <Button className="mt-5" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Import video
          </Button>
        </div>
      ) : loading || !urls.length ? (
        <p className="m-auto text-sm text-muted">Pulling frames…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {tool === "frames" ? (
            <FrameTool
              source={source}
              urls={urls}
              frameIndex={Math.min(frameIndex, urls.length - 1)}
              playing={playing}
              onSeek={setFrameIndex}
              onToggle={() => setPlaying((value) => !value)}
              previewRef={previewRef}
            />
          ) : null}
          {tool === "compare" ? (
            <CompareTool
              sources={mine}
              primary={source}
              urls={urls}
              frameIndex={Math.min(frameIndex, urls.length - 1)}
              onSeek={setFrameIndex}
            />
          ) : null}
          {tool === "blur" ? (
            <BlurTool
              source={source}
              urls={urls}
              replacements={replacements}
              frameIndex={Math.min(frameIndex, urls.length - 1)}
              playing={playing}
              onSeek={setFrameIndex}
              onToggle={() => setPlaying((value) => !value)}
            />
          ) : null}
          {tool === "faces" ? (
            <FaceTool
              source={source}
              urls={urls}
              replacements={replacements}
              frameIndex={Math.min(frameIndex, urls.length - 1)}
              playing={playing}
              onSeek={setFrameIndex}
              onToggle={() => setPlaying((value) => !value)}
            />
          ) : null}
          {tool === "export" ? (
            <ExportTool
              source={source}
              urls={urls}
              replacements={replacements}
              frameIndex={Math.min(frameIndex, urls.length - 1)}
              playing={playing}
              onSeek={setFrameIndex}
              onToggle={() => setPlaying((value) => !value)}
            />
          ) : null}
        </div>
      )}
    </Shell>
  );
}
