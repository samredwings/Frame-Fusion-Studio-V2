import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon, Pause, Play, SkipBack, SkipForward, Trash2 } from "lucide-react";
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

export type FrameAction = "edit" | "replace" | "delete";

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
  onFrameAction,
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
  onFrameAction?: (action: FrameAction, index: number) => void;
  onPointer?: (event: { phase: "down" | "move" | "up"; x: number; y: number }) => void;
  previewRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdTimer = useRef<number | null>(null);
  const holdStarted = useRef<{ x: number; y: number } | null>(null);
  const holdTriggered = useRef(false);
  const [menuFrame, setMenuFrame] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ratio = source.width / source.height;
  const baseUrl = urls[frameIndex];

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
  }, []);

  function cancelHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdStarted.current = null;
  }

  function showFrameMenu(index: number) {
    cancelHold();
    setConfirmDelete(false);
    setMenuFrame(index);
  }

  function startHold(index: number, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelHold();
    holdTriggered.current = false;
    holdStarted.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = window.setTimeout(() => {
      holdTriggered.current = true;
      holdTimer.current = null;
      setConfirmDelete(false);
      setMenuFrame(index);
    }, 480);
  }

  function moveHold(event: React.PointerEvent<HTMLButtonElement>) {
    const start = holdStarted.current;
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12) cancelHold();
  }

  function runFrameAction(action: FrameAction) {
    if (menuFrame === null) return;
    const index = menuFrame;
    setMenuFrame(null);
    setConfirmDelete(false);
    onFrameAction?.(action, index);
  }

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
    <div className="studio-stage flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="stage-meta flex items-center justify-between gap-3 px-3 pb-2 pt-3 sm:px-5 sm:pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 font-mono text-[10px] text-amber">A</span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Reference take</span>
        </div>
        <span className="shrink-0 font-mono text-[10px] tracking-wide text-muted">F {String(frameIndex + 1).padStart(2, "0")} <span className="text-line">/</span> {String(source.frameCount).padStart(2, "0")}</span>
      </div>
      <div className="stage-viewer flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-5">
        <div className="stage-frame flex min-h-0 min-w-0 items-center justify-center" style={{ ["--ratio" as string]: String(ratio) }}>
          <canvas
            ref={(node) => {
              canvasRef.current = node;
              if (previewRef) previewRef.current = node;
            }}
            className={`studio-canvas block h-auto w-auto max-h-full max-w-full rounded-xl bg-surface-2 ${onPointer ? "touch-none" : ""}`}
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
      <div className="stage-controls flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
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
      <div className="stage-filmstrip flex shrink-0 gap-2 overflow-x-auto px-3 pb-2 sm:px-5" aria-label="Frame rail">
        {urls.map((url, index) => (
          <button
            key={`${source.id}-${index}`}
            type="button"
            className={`stage-thumb relative h-12 w-16 shrink-0 overflow-hidden rounded-lg ${
              index === frameIndex ? "is-selected" : ""
            }`}
            aria-label={`Frame ${index + 1}`}
            aria-current={index === frameIndex}
            onPointerDown={(event) => startHold(index, event)}
            onPointerMove={moveHold}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onContextMenu={(event) => {
              event.preventDefault();
              holdTriggered.current = true;
              showFrameMenu(index);
            }}
            onClick={() => {
              if (holdTriggered.current) {
                holdTriggered.current = false;
                return;
              }
              onSeek(index);
            }}
          >
            <img src={url} alt="" draggable={false} loading="lazy" decoding="async" className="pointer-events-none h-full w-full select-none object-cover" />
            <span className="filmstrip-index absolute bottom-1 left-1.5 rounded px-1 font-mono text-[8px]">{String(index + 1).padStart(2, "0")}</span>
            {marked?.[index] ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber" /> : null}
          </button>
        ))}
      </div>
      {menuFrame !== null ? (
        <div
          className="studio-sheet-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/65 px-3 pt-8"
          onClick={() => { setMenuFrame(null); setConfirmDelete(false); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setMenuFrame(null); setConfirmDelete(false); }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="frame-actions-title"
            className="studio-sheet w-full max-w-lg rounded-t-3xl p-4 sm:mb-4 sm:rounded-3xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
            <p className="studio-kicker">FRAME {String(menuFrame + 1).padStart(2, "0")} <span className="text-line">/</span> {String(source.frameCount).padStart(2, "0")}</p>
            {confirmDelete ? (
              <>
                <h2 id="frame-actions-title" className="mt-1 font-display text-xl font-semibold">Delete this frame?</h2>
                <p className="mt-1 text-sm text-muted">Frame edits and mask ranges will shift to stay aligned.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" className="min-h-12 rounded-xl border border-line px-4 text-sm" onClick={() => setConfirmDelete(false)}>Keep frame</button>
                  <button autoFocus type="button" className="min-h-12 rounded-xl bg-danger px-4 text-sm font-semibold text-danger-ink" onClick={() => runFrameAction("delete")}>Delete frame</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="frame-actions-title" className="mt-1 font-display text-xl font-semibold">Frame options</h2>
                <div className="mt-3 grid gap-2">
                  <button autoFocus type="button" className="studio-sheet-action" onClick={() => runFrameAction("edit")}>
                    <Film className="size-5 text-amber" aria-hidden="true" /><span><strong>Edit frame</strong><small>Open this frame in the editor</small></span>
                  </button>
                  <button type="button" className="studio-sheet-action" onClick={() => runFrameAction("replace")}>
                    <ImageIcon className="size-5 text-cyan" aria-hidden="true" /><span><strong>Replace image</strong><small>Use a still from your device</small></span>
                  </button>
                  <button type="button" className="studio-sheet-action text-danger" disabled={source.frameCount <= 1} onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="size-5" aria-hidden="true" /><span><strong>Delete frame</strong><small>{source.frameCount <= 1 ? "Keep at least one frame in a take" : "Remove it and keep edits aligned"}</small></span>
                  </button>
                </div>
                <button type="button" className="mt-3 min-h-11 w-full rounded-xl px-4 text-sm text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setMenuFrame(null)}>Cancel</button>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
