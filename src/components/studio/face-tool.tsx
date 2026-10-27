import { useState } from "react";
import { measureDrift, suggestLock, type DriftPoint } from "@/lib/studio/draw";
import { loadImage } from "@/lib/studio/media";
import { useStudio } from "@/lib/studio/store";
import type { Source } from "@/lib/studio/types";
import { Stage, type Guide } from "@/components/studio/stage";
import { Button, Slider } from "@/components/studio/ui";

export function FaceTool({
  source,
  urls,
  frameIndex,
  replacements,
  playing,
  onSeek,
  onToggle,
}: {
  source: Source;
  urls: string[];
  frameIndex: number;
  replacements: Record<number, string>;
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
}) {
  const edits = useStudio((state) => state.edits);
  const setLock = useStudio((state) => state.setLock);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const [drift, setDrift] = useState<DriftPoint[]>([]);
  const [threshold, setThreshold] = useState(22);
  const [status, setStatus] = useState("");
  const nudge = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === frameIndex);
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
      <div className="min-w-0 lg:flex-1">
        <Stage
          source={source}
          urls={urls}
          frameIndex={frameIndex}
          replacementUrl={replacements[frameIndex]}
          grade={null}
          nudge={nudge && nudge.kind === "nudge" ? { dx: nudge.dx, dy: nudge.dy } : null}
          regions={[]}
          guides={guides}
          playing={playing}
          onSeek={onSeek}
          onToggle={onToggle}
        />
      </div>
      <aside className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:w-80 lg:flex-none lg:border-l lg:border-line">
        <div>
          <h2 className="font-display text-lg font-semibold">FaceSync</h2>
          <p className="text-sm text-muted">
            Lock a face, measure how far it wanders, then nudge those frames back. No cloud model — the match runs here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void autoFind()}>Auto-lock</Button>
          <Button tone="line" onClick={() => void track()} disabled={!source.lock}>
            Track reel
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
