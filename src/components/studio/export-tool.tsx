import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { evenSize, renderFrame } from "@/lib/studio/draw";
import { idbGet } from "@/lib/studio/idb";
import { activeRegions, loadImage, recordFrames } from "@/lib/studio/media";
import { useStudio } from "@/lib/studio/store";
import type { Grade, Source } from "@/lib/studio/types";
import { Stage } from "@/components/studio/stage";
import { Button, formatBytes } from "@/components/studio/ui";

type Quality = "draft" | "standard" | "full";

export function ExportTool({
  source,
  urls,
  replacements,
  frameIndex,
  playing,
  onSeek,
  onToggle,
}: {
  source: Source;
  urls: string[];
  replacements: Record<number, string>;
  frameIndex: number;
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
}) {
  const edits = useStudio((state) => state.edits);
  const regions = useStudio((state) => state.regions);
  const allExports = useStudio((state) => state.exports);
  const exports = allExports.filter((item) => item.projectId === source.projectId);
  const saveExport = useStudio((state) => state.saveExport);
  const deleteExport = useStudio((state) => state.deleteExport);
  const [quality, setQuality] = useState<Quality>("draft");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const nudge = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === frameIndex);
  const gradeEdit = edits.find((edit) => edit.sourceId === source.id && edit.kind === "grade" && edit.frameIndex === frameIndex);
  const grade = gradeEdit && gradeEdit.kind === "grade" ? gradeEdit.grade : null;

  async function render() {
    setRunning(true);
    setMessage("");
    setProgress(0);
    try {
      const maxEdge = quality === "draft" ? 480 : quality === "standard" ? 720 : Math.max(source.width, source.height);
      const size = evenSize(source.width, source.height, maxEdge);
      const bases = await Promise.all(urls.map((url) => loadImage(url)));
      const repl = await Promise.all(
        urls.map(async (_url, index) => (replacements[index] ? loadImage(replacements[index]) : null)),
      );
      const blob = await recordFrames(bases, repl, size.width, size.height, source.fps, (ctx, index, base, replacement) => {
        const gradeFor = edits.find((edit) => edit.sourceId === source.id && edit.kind === "grade" && edit.frameIndex === index);
        const nudgeFor = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === index);
        const applied: Grade | null = gradeFor && gradeFor.kind === "grade" ? gradeFor.grade : null;
        const off = document.createElement("canvas");
        off.width = source.width;
        off.height = source.height;
        const offCtx = off.getContext("2d");
        if (!offCtx) return;
        renderFrame(offCtx, base, source.width, source.height, {
          grade: applied,
          replacement,
          nudge: nudgeFor && nudgeFor.kind === "nudge" ? { dx: nudgeFor.dx, dy: nudgeFor.dy } : null,
          regions: activeRegions(regions, source.id, index),
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, size.width, size.height);
        ctx.drawImage(off, 0, 0, size.width, size.height);
      }, (done) => setProgress(done));
      const id = crypto.randomUUID();
      await saveExport(
        {
          id,
          projectId: source.projectId,
          sourceId: source.id,
          filename: `${source.filename.replace(/\.\w+$/, "")}-${quality}.webm`,
          bytes: blob.size,
          width: size.width,
          height: size.height,
          frameCount: urls.length,
          createdAt: Date.now(),
          blobKey: `e:${id}`,
        },
        blob,
      );
      setMessage("Render is in the bay. Download it anytime.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setRunning(false);
    }
  }

  async function download(id: string, filename: string, blobKey: string) {
    const blob = await idbGet<Blob>("blobs", blobKey);
    if (!blob) {
      setMessage("That export file is missing. Render it again.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    void id;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-w-0 lg:flex-1">
        <Stage
          source={source}
          urls={urls}
          frameIndex={frameIndex}
          replacementUrl={replacements[frameIndex]}
          grade={grade}
          nudge={nudge && nudge.kind === "nudge" ? { dx: nudge.dx, dy: nudge.dy } : null}
          regions={activeRegions(regions, source.id, frameIndex)}
          playing={playing}
          onSeek={onSeek}
          onToggle={onToggle}
        />
      </div>
      <aside className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:w-80 lg:flex-none lg:border-l lg:border-line">
        <div>
          <h2 className="font-display text-lg font-semibold">Exports</h2>
          <p className="text-sm text-muted">Burns in grades, replacements, blur regions, and face nudges for this take.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["draft", "Draft"],
              ["standard", "720"],
              ["full", "Full"],
            ] as const
          ).map(([id, label]) => (
            <Button key={id} tone={quality === id ? "solid" : "line"} onClick={() => setQuality(id)}>
              {label}
            </Button>
          ))}
        </div>
        <Button onClick={() => void render()} disabled={running || !urls.length}>
          {running ? `Rendering ${progress}/${urls.length}` : "Render WebM"}
        </Button>
        {running ? (
          <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full bg-amber" style={{ width: `${urls.length ? (progress / urls.length) * 100 : 0}%` }} />
          </div>
        ) : null}
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        <ul className="space-y-2">
          {exports.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.filename}</p>
                <p className="font-mono text-[11px] text-muted">
                  {item.width}×{item.height} · {formatBytes(item.bytes)}
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11"
                aria-label={`Download ${item.filename}`}
                onClick={() => void download(item.id, item.filename, item.blobKey)}
              >
                <Download className="mx-auto size-4" />
              </button>
              <button type="button" className="min-h-11 min-w-11" aria-label={`Delete ${item.filename}`} onClick={() => void deleteExport(item.id)}>
                <Trash2 className="mx-auto size-4" />
              </button>
            </li>
          ))}
          {!exports.length ? <li className="text-sm text-muted">No renders saved yet.</li> : null}
        </ul>
      </aside>
    </div>
  );
}
