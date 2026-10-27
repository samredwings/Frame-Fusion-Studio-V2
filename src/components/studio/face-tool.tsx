import { useRef, useState } from "react";
import { measureDrift, suggestLock, type DriftPoint } from "@/lib/studio/draw";
import { activeRegions, loadImage } from "@/lib/studio/media";
import { useStudio } from "@/lib/studio/store";
import type { NormRect, Source } from "@/lib/studio/types";
import { Stage, type FrameAction, type Guide } from "@/components/studio/stage";
import { Button, Slider } from "@/components/studio/ui";

export function FaceTool({
  source,
  urls,
  frameIndex,
  replacements,
  regionAssets,
  playing,
  onSeek,
  onToggle,
  onFrameAction,
}: {
  source: Source;
  urls: string[];
  frameIndex: number;
  replacements: Record<number, string>;
  regionAssets: Record<string, string>;
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
  onFrameAction?: (action: FrameAction, index: number) => void;
}) {
  const edits = useStudio((state) => state.edits);
  const regions = useStudio((state) => state.regions);
  const setLock = useStudio((state) => state.setLock);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const [drift, setDrift] = useState<DriftPoint[]>([]);
  const [threshold, setThreshold] = useState(22);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<NormRect | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const nudge = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === frameIndex);
  const style = edits.find((edit) => edit.sourceId === source.id && edit.kind === "style" && edit.frameIndex === frameIndex);
  const point = drift.find((item) => item.index === frameIndex);
  const guides: Guide[] = [];
  if (source.lock) {
    guides.push({
      x: source.lock.x * source.width,
      y: source.lock.y * source.height,
      w: source.lock.w * source.width,
      h: source.lock.h * source.height,
      tone: "amber",
      label: "Lock",
    });
  }
  if (point && source.lock) {
    const shiftX = nudge && nudge.kind === "nudge" ? nudge.dx : 0;
    const shiftY = nudge && nudge.kind === "nudge" ? nudge.dy : 0;
    guides.push({
      x: point.cx - (source.lock.w * source.width) / 2 + shiftX,
      y: point.cy - (source.lock.h * source.height) / 2 + shiftY,
      w: source.lock.w * source.width,
      h: source.lock.h * source.height,
      tone: "cyan",
      label: `Drift ${point.score}`,
    });
  }
  const drifted = drift.filter((item) => item.score >= threshold).length;

  async function autoFind() {
    const url = urls[frameIndex];
    if (!url) return;
    setStatus("Looking for a face…");
    try {
      const image = await loadImage(url);
      const lock = await suggestLock(image);
      await setLock(source.id, lock);
      setDrift([]);
      setStatus("Lock placed. Track the reel when you are ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not place a lock.");
    }
  }


  function onLockPointer(event: { phase: "down" | "move" | "up"; x: number; y: number }) {
    if (event.phase === "down") {
      anchor.current = { x: event.x, y: event.y };
      setDraft({ x: event.x, y: event.y, w: 0, h: 0 });
      setStatus("Drag around the face to set its tracking region.");
      return;
    }
    const start = anchor.current;
    if (!start) return;
    const rect = {
      x: Math.min(start.x, event.x),
      y: Math.min(start.y, event.y),
      w: Math.abs(event.x - start.x),
      h: Math.abs(event.y - start.y),
    };
    if (event.phase === "move") {
      setDraft(rect);
      return;
    }
    anchor.current = null;
    setDraft(null);
    if (rect.w < 0.03 || rect.h < 0.03) {
      setStatus("Draw a larger box around the face.");
      return;
    }
    void setLock(source.id, rect).then(() => {
      setDrift([]);
      setStatus("Manual face lock saved. Track the reel to measure drift.");
    }).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Could not save the face lock.");
    });
  }

  async function track() {
    if (!source.lock) {
      setStatus("Place a lock first.");
      return;
    }
    setStatus("Tracking across the reel…");
    try {
      const images = await Promise.all(urls.map((url) => loadImage(url)));
      const points = measureDrift(images, source.lock);
      setDrift(points);
      const hot = points.filter((item) => item.score >= threshold).length;
      setStatus(hot ? `${hot} frames sit past the drift line.` : "The lock holds across this reel.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tracking failed.");
    }
  }

  async function stabilize() {
    if (!source.lock || !drift.length) {
      setStatus("Track the reel before stabilizing.");
      return;
    }
    const refCx = (source.lock.x + source.lock.w / 2) * source.width;
    const refCy = (source.lock.y + source.lock.h / 2) * source.height;
    let count = 0;
    for (const item of drift) {
      if (item.score < threshold) continue;
      count += 1;
      await upsertEdit({
        id: crypto.randomUUID(),
        projectId: source.projectId,
        sourceId: source.id,
        frameIndex: item.index,
        kind: "nudge",
        dx: Math.round(refCx - item.cx),
        dy: Math.round(refCy - item.cy),
      });
    }
    setStatus(count ? `Pinned ${count} frames back to the lock. Export will burn that in.` : "Nothing crossed the drift line.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <Stage
          source={source}
          urls={urls}
          frameIndex={frameIndex}
          replacementUrl={replacements[frameIndex]}
          grade={null}
          nudge={nudge && nudge.kind === "nudge" ? { dx: nudge.dx, dy: nudge.dy } : null}
          regions={activeRegions(regions, source.id, frameIndex)}
          regionAssets={regionAssets}
          style={style && style.kind === "style" ? style.style : null}
          guides={guides}
          draft={draft}
          onPointer={onLockPointer}
          playing={playing}
          onSeek={onSeek}
          onToggle={onToggle}
          onFrameAction={onFrameAction}
        />
      </div>
      <aside className="studio-inspector min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 lg:w-80 lg:flex-none">
        <div>
          <p className="studio-kicker">FRAME TOOLS <span className="text-line">/</span> TRACK</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Face lock</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            Drag a box around the face in the preview for a reliable manual lock. Suggest lock uses a lightweight color heuristic and may need correction. Tracking runs locally.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void autoFind()}>Suggest lock</Button>
          <Button tone="line" onClick={() => void track()} disabled={!source.lock}>
            Track reel
          </Button>
          <Button
            tone="line"
            onClick={() => {
              void setLock(source.id, null).then(() => {
                setDrift([]);
                setStatus("Face lock cleared.");
              });
            }}
            disabled={!source.lock}
          >
            Clear lock
          </Button>
          <Button tone="line" onClick={() => void stabilize()} disabled={!drift.length}>
            Stabilize
          </Button>
        </div>
        <Slider label="Drift line" min={5} max={80} value={threshold} onChange={setThreshold} />
        <p className="text-sm text-muted">{status || (source.lock ? "Lock is saved on this take." : "No lock yet.")}</p>
        <p className="font-mono text-xs text-cyan">
          {drift.length ? `${drifted} flagged · this frame ${point?.score ?? "—"}` : "Not tracked"}
        </p>
        <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label="Drift by frame">
          {drift.map((item) => (
            <li key={item.index}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 rounded-sm px-1 text-left text-xs"
                onClick={() => onSeek(item.index)}
              >
                <span className="w-8 font-mono text-muted">{item.index}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className={`block h-full ${item.score >= threshold ? "bg-amber" : "bg-cyan"}`}
                    style={{ width: `${item.score}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono">{item.score}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
