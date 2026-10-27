import { useEffect, useRef } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { renderFrame } from "@/lib/studio/draw";
import { loadImage } from "@/lib/studio/media";
import type { Grade, NormRect, Region, Source } from "@/lib/studio/types";
import { Button, formatClock } from "@/components/studio/ui";

export type Guide = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: "amber" | "cyan";
  label?: string;
};

export function Stage({
  source,
  urls,
  frameIndex,
  replacementUrl,
  grade,
  nudge,
  regions,
  guides = [],
  draft,
  marked,
  playing,
  onSeek,
  onToggle,
  onPointer,
  previewRef,
}: {
  source: Source;
  urls: string[];
  frameIndex: number;
  replacementUrl?: string;
  grade: Grade | null;
  nudge: { dx: number; dy: number } | null;
  regions: Region[];
  guides?: Guide[];
  draft?: NormRect | null;
  marked?: boolean[];
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
  onPointer?: (event: { phase: "down" | "move" | "up"; x: number; y: number }) => void;
  previewRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ratio = source.width / source.height;
  const baseUrl = urls[frameIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseUrl) return;
    let cancelled = false;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    void (async () => {
      try {
        const base = await loadImage(baseUrl);
        const replacement = replacementUrl ? await loadImage(replacementUrl) : null;
        if (cancelled) return;
        renderFrame(ctx, base, source.width, source.height, {
          grade,
          replacement,
          nudge,
          regions,
        });
        ctx.setLineDash([]);
        for (const guide of guides) {
          ctx.save();
          ctx.strokeStyle = guide.tone === "amber" ? "#e4a15a" : "#8fd0dc";
          ctx.lineWidth = 2;
          ctx.strokeRect(guide.x + 1, guide.y + 1, Math.max(1, guide.w - 2), Math.max(1, guide.h - 2));
          if (guide.label) {
            ctx.font = "12px monospace";
            ctx.fillStyle = guide.tone === "amber" ? "#e4a15a" : "#8fd0dc";
            ctx.fillText(guide.label, guide.x + 6, Math.max(14, guide.y - 6));
          }
          ctx.restore();
        }
        if (draft && draft.w > 0 && draft.h > 0) {
          ctx.save();
          ctx.strokeStyle = "#e4a15a";
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2;
          ctx.strokeRect(draft.x * source.width, draft.y * source.height, draft.w * source.width, draft.h * source.height);
          ctx.restore();
        }
      } catch {
        /* a missing frame leaves the last good picture */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, replacementUrl, grade, nudge, regions, guides, draft, source.width, source.height]);

  function pointer(phase: "down" | "move" | "up", event: React.PointerEvent<HTMLCanvasElement>) {
    if (!onPointer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    onPointer({ phase, x, y });
  }

  return (
    <div className="studio-stage flex min-w-0 shrink-0 flex-col">
      <div className="stage-meta flex items-center justify-between gap-3 px-3 pb-2 pt-3 sm:px-5 sm:pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 font-mono text-[10px] text-amber">A</span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Reference take</span>
        </div>
        <span className="shrink-0 font-mono text-[10px] tracking-wide text-muted">F {String(frameIndex + 1).padStart(2, "0")} <span className="text-line">/</span> {String(source.frameCount).padStart(2, "0")}</span>
      </div>
      <div className="flex justify-center px-3 sm:px-5">
        <div className="stage-frame w-full" style={{ ["--ratio" as string]: String(ratio) }}>
          <canvas
            ref={(node) => {
              canvasRef.current = node;
              if (previewRef) previewRef.current = node;
            }}
            className={`studio-canvas block h-auto w-full rounded-xl bg-surface-2 ${onPointer ? "touch-none" : ""}`}
            aria-label="Frame preview"
            onPointerDown={(event) => {
              if (!onPointer) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pointer("down", event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) pointer("move", event);
            }}
            onPointerUp={(event) => pointer("up", event)}
            onPointerCancel={(event) => pointer("up", event)}
          />
        </div>
      </div>
      <div className="stage-controls flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <Button tone="quiet" className="w-11 px-0" aria-label="Previous frame" onClick={() => onSeek(Math.max(0, frameIndex - 1))}>
          <SkipBack className="size-4" />
        </Button>
        <Button tone="line" className="w-11 px-0" aria-label={playing ? "Pause" : "Play"} onClick={onToggle}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          tone="quiet"
          className="w-11 px-0"
          aria-label="Next frame"
          onClick={() => onSeek(Math.min(source.frameCount - 1, frameIndex + 1))}
        >
          <SkipForward className="size-4" />
        </Button>
        <input
          className="h-11 min-w-0 flex-1 accent-amber"
          type="range"
          min={0}
          max={Math.max(0, source.frameCount - 1)}
          value={Math.min(frameIndex, Math.max(0, source.frameCount - 1))}
          aria-label="Frame position"
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span className="hidden w-28 shrink-0 text-right font-mono text-xs text-muted sm:block">
          {formatClock(frameIndex, source.fps)} · {frameIndex + 1}/{source.frameCount}
        </span>
      </div>
      <div className="stage-filmstrip flex gap-2 overflow-x-auto px-3 pb-3 sm:px-5" aria-label="Frame rail">
        {urls.map((url, index) => (
          <button
            key={`${source.id}-${index}`}
            type="button"
            className={`stage-thumb relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ${
              index === frameIndex ? "is-selected" : ""
            }`}
            aria-label={`Frame ${index + 1}`}
            aria-current={index === frameIndex}
            onClick={() => onSeek(index)}
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="filmstrip-index absolute bottom-1 left-1.5 rounded px-1 font-mono text-[8px]">{String(index + 1).padStart(2, "0")}</span>
            {marked?.[index] ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
