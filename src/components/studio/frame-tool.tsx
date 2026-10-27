import { useEffect, useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { idbPut } from "@/lib/studio/idb";
import { downloadOrShareBlob } from "@/lib/studio/download";
import { useStudio } from "@/lib/studio/store";
import { NEUTRAL_GRADE, type Grade, type Source } from "@/lib/studio/types";
import { useReplacements } from "@/components/studio/use-frames";
import { Stage } from "@/components/studio/stage";
import { Button, Slider } from "@/components/studio/ui";

export function FrameTool({
  source,
  urls,
  frameIndex,
  playing,
  onSeek,
  onToggle,
  previewRef,
}: {
  source: Source;
  urls: string[];
  frameIndex: number;
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
  previewRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const allEdits = useStudio((state) => state.edits);
  const edits = allEdits.filter((edit) => edit.sourceId === source.id);
  const replacements = useReplacements(source.id, allEdits);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const clearFrame = useStudio((state) => state.clearFrame);
  const gradeEdit = edits.find((edit) => edit.kind === "grade" && edit.frameIndex === frameIndex);
  const savedGrade = gradeEdit && gradeEdit.kind === "grade" ? gradeEdit.grade : NEUTRAL_GRADE;
  const savedKey = JSON.stringify(savedGrade);
  const [grade, setGrade] = useState<Grade>(savedGrade);
  const replace = edits.find((edit) => edit.kind === "replace" && edit.frameIndex === frameIndex);
  const nudge = edits.find((edit) => edit.kind === "nudge" && edit.frameIndex === frameIndex);

  useEffect(() => {
    setGrade(JSON.parse(savedKey) as Grade);
  }, [savedKey, frameIndex]);

  const marked = useMemo(() => {
    const flags = Array.from({ length: source.frameCount }, () => false);
    for (const edit of edits) flags[edit.frameIndex] = true;
    return flags;
  }, [edits, source.frameCount]);

  async function bake() {
    await upsertEdit({
      id: crypto.randomUUID(),
      projectId: source.projectId,
      sourceId: source.id,
      frameIndex,
      kind: "grade",
      grade,
    });
  }

  async function onReplace(file: File) {
    const id = crypto.randomUUID();
    const blobKey = `r:${id}`;
    await idbPut("blobs", blobKey, file);
    await upsertEdit({
      id,
      projectId: source.projectId,
      sourceId: source.id,
      frameIndex,
      kind: "replace",
      blobKey,
    });
  }

  async function downloadStill() {
    const canvas = previewRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    try {
      await downloadOrShareBlob(
        blob,
        `${source.filename.replace(/\.\w+$/, "")}-f${String(frameIndex).padStart(3, "0")}.png`,
      );
    } catch (error) {
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not share that frame." });
    }
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
          regions={[]}
          marked={marked}
          playing={playing}
          onSeek={onSeek}
          onToggle={onToggle}
          previewRef={previewRef}
        />
      </div>
      <aside className="min-h-0 flex-1 space-y-4 overflow-y-auto border-line p-4 lg:w-80 lg:flex-none lg:border-l">
        <div>
          <h2 className="font-display text-lg font-semibold">Frame editor</h2>
          <p className="text-sm text-muted">Grade the current frame, drop in a replacement still, or pull the PNG.</p>
        </div>
        <Slider label="Exposure" min={40} max={160} value={grade.brightness} suffix="%" onChange={(brightness) => setGrade({ ...grade, brightness })} />
        <Slider label="Contrast" min={40} max={180} value={grade.contrast} suffix="%" onChange={(contrast) => setGrade({ ...grade, contrast })} />
        <Slider label="Saturation" min={0} max={180} value={grade.saturate} suffix="%" onChange={(saturate) => setGrade({ ...grade, saturate })} />
        <Slider label="Warmth" min={-80} max={80} value={grade.warmth} onChange={(warmth) => setGrade({ ...grade, warmth })} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void bake()}>Bake grade</Button>
          <Button tone="line" onClick={() => setGrade(NEUTRAL_GRADE)}>
            Reset sliders
          </Button>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-dashed border-line px-3 text-sm text-muted hover:border-amber">
          Replace this frame with an image
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onReplace(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {replace ? <p className="text-xs text-cyan">A replacement still is baked on this frame and used by export.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button tone="quiet" onClick={downloadStill}>
            <Download className="size-4" />
            Download PNG
          </Button>
          <Button tone="ghost" onClick={() => void clearFrame(source.id, frameIndex)}>
            <RotateCcw className="size-4" />
            Clear frame edits
          </Button>
        </div>
        <p className="font-mono text-xs text-muted">
          {source.width}×{source.height} · {source.fps} fps · arrows step · space plays
        </p>
      </aside>
    </div>
  );
}
