import { useEffect, useRef, useState } from "react";
import { frameKey, idbGet } from "@/lib/studio/idb";
import { fitContain, loadImage, similarityScore } from "@/lib/studio/media";
import type { Source } from "@/lib/studio/types";
import { Button, Select, Slider } from "@/components/studio/ui";

type Mode = "split" | "wipe" | "diff";

export function CompareTool({
  sources,
  primary,
  urls,
  frameIndex,
  onSeek,
}: {
  sources: Source[];
  primary: Source;
  urls: string[];
  frameIndex: number;
  onSeek: (index: number) => void;
}) {
  const others = sources.filter((source) => source.id !== primary.id);
  const [otherId, setOtherId] = useState(others[0]?.id ?? "");
  const other = sources.find((source) => source.id === otherId) ?? others[0];
  const [mode, setMode] = useState<Mode>("wipe");
  const [wipe, setWipe] = useState(52);
  const [slip, setSlip] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bIndex = Math.min(Math.max(0, frameIndex + slip), Math.max(0, (other?.frameCount ?? 1) - 1));

  useEffect(() => {
    const canvas = canvasRef.current;
    const urlA = urls[frameIndex];
    if (!canvas || !urlA || !other) return;
    let cancelled = false;
    const width = 640;
    const height = 360;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    void (async () => {
      const blob = await idbGet<Blob>("blobs", frameKey(other.id, bIndex));
      if (!blob || cancelled) return;
      const blobUrl = URL.createObjectURL(blob);
      try {
        const [imageA, imageB] = await Promise.all([loadImage(urlA), loadImage(blobUrl)]);
        if (cancelled) return;
        ctx.fillStyle = "#101317";
        ctx.fillRect(0, 0, width, height);
        if (mode === "split") {
          const left = fitContain(imageA.naturalWidth, imageA.naturalHeight, width / 2, height);
          const right = fitContain(imageB.naturalWidth, imageB.naturalHeight, width / 2, height);
          ctx.drawImage(imageA, left.x, left.y, left.w, left.h);
          ctx.drawImage(imageB, width / 2 + right.x, right.y, right.w, right.h);
          ctx.strokeStyle = "#e4a15a";
          ctx.beginPath();
          ctx.moveTo(width / 2, 0);
          ctx.lineTo(width / 2, height);
          ctx.stroke();
        } else if (mode === "wipe") {
          const box = fitContain(imageA.naturalWidth, imageA.naturalHeight, width, height);
          ctx.drawImage(imageB, box.x, box.y, box.w, box.h);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, (wipe / 100) * width, height);
          ctx.clip();
          ctx.drawImage(imageA, box.x, box.y, box.w, box.h);
          ctx.restore();
          ctx.strokeStyle = "#e4a15a";
          ctx.beginPath();
          ctx.moveTo((wipe / 100) * width, 0);
          ctx.lineTo((wipe / 100) * width, height);
          ctx.stroke();
        } else {
          const box = fitContain(imageA.naturalWidth, imageA.naturalHeight, width, height);
          const scratch = document.createElement("canvas");
          scratch.width = Math.max(1, Math.round(box.w));
          scratch.height = Math.max(1, Math.round(box.h));
          const sctx = scratch.getContext("2d");
          if (!sctx) return;
          sctx.drawImage(imageA, 0, 0, scratch.width, scratch.height);
          const pa = sctx.getImageData(0, 0, scratch.width, scratch.height);
          sctx.drawImage(imageB, 0, 0, scratch.width, scratch.height);
          const pb = sctx.getImageData(0, 0, scratch.width, scratch.height);
          const out = sctx.createImageData(scratch.width, scratch.height);
          for (let i = 0; i < out.data.length; i += 4) {
            const delta =
              Math.abs((pa.data[i] ?? 0) - (pb.data[i] ?? 0)) +
              Math.abs((pa.data[i + 1] ?? 0) - (pb.data[i + 1] ?? 0)) +
              Math.abs((pa.data[i + 2] ?? 0) - (pb.data[i + 2] ?? 0));
            const value = Math.min(255, delta);
            out.data[i] = value;
            out.data[i + 1] = Math.round(value * 0.72);
            out.data[i + 2] = Math.round(value * 0.35);
            out.data[i + 3] = 255;
          }
          sctx.putImageData(out, 0, 0);
          ctx.drawImage(scratch, box.x, box.y);
        }
        if (!cancelled) setScore(await similarityScore(imageA, imageB));
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urls, frameIndex, other, bIndex, mode, wipe]);

  if (!other) {
    return (
      <div className="m-auto max-w-md px-6 py-16 text-center">
        <h2 className="font-display text-xl">Need a second take</h2>
        <p className="mt-2 text-sm text-muted">Import another video from the bar above to line it up against this one.</p>
      </div>
    );
  }

  return (
    <div className="studio-compare flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
      <div className="compare-stage flex flex-1 flex-col justify-center p-3 sm:p-5">
        <div className="mb-2 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
          <span>Reference A</span>
          <span className="text-cyan">{score === null ? "Aligning takes" : `${score}% visual match`}</span>
          <span>Take B</span>
        </div>
        <canvas ref={canvasRef} className="compare-canvas aspect-video w-full max-w-4xl self-center rounded-xl bg-surface-2" aria-label="Comparison preview" />
      </div>
      <aside className="studio-inspector space-y-4 p-4 sm:p-5 lg:w-80 lg:flex-none">
        <div>
          <p className="studio-kicker">TAKE ALIGNMENT</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Compare frames</h2>
          <p className="mt-1 truncate text-sm text-muted">{primary.filename} <span className="text-line">vs</span> {other.filename}</p>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Second take</span>
          <Select value={other.id} aria-label="Second take" onChange={(event) => setOtherId(event.target.value)}>
            {others.map((source) => (
              <option key={source.id} value={source.id}>
                {source.filename}
              </option>
            ))}
          </Select>
        </label>
        <div className="compare-modes grid grid-cols-3 gap-1 rounded-xl p-1" role="group" aria-label="Compare mode">
          {(["split", "wipe", "diff"] as const).map((item) => (
            <button key={item} type="button" className={`min-h-11 rounded-lg px-2 text-xs font-medium transition-[background-color,color] duration-150 ${mode === item ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`} aria-pressed={mode === item} onClick={() => setMode(item)}>
              {item === "split" ? "Split" : item === "wipe" ? "Wipe" : "Diff"}
            </button>
          ))}
        </div>
        {mode === "wipe" ? <Slider label="Wipe" min={0} max={100} value={wipe} suffix="%" onChange={setWipe} /> : null}
        <Slider label="Slip B" min={-12} max={12} value={slip} suffix=" f" onChange={setSlip} />
        <div className="flex gap-2">
          <Button tone="quiet" onClick={() => onSeek(Math.max(0, frameIndex - 1))}>
            Back
          </Button>
          <Button tone="quiet" onClick={() => onSeek(Math.min(primary.frameCount - 1, frameIndex + 1))}>
            Forward
          </Button>
        </div>
        <p className="font-mono text-xs text-muted">
          A f{frameIndex} · B f{bIndex}
        </p>
      </aside>
    </div>
  );
}
