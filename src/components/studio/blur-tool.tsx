import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { activeRegions } from "@/lib/studio/media";
import { useStudio } from "@/lib/studio/store";
import type { NormRect, RegionKind, Source } from "@/lib/studio/types";
import { Stage, type FrameAction } from "@/components/studio/stage";
import { Field, Select, Slider, TextInput } from "@/components/studio/ui";

export function BlurTool({
  source,
  urls,
  frameIndex,
  replacements,
  playing,
  onSeek,
  onToggle,
  onFrameAction,
}: {
  source: Source;
  urls: string[];
  frameIndex: number;
  replacements: Record<number, string>;
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
  onFrameAction?: (action: FrameAction, index: number) => void;
}) {
  const regions = useStudio((state) => state.regions);
  const edits = useStudio((state) => state.edits);
  const addRegion = useStudio((state) => state.addRegion);
  const updateRegion = useStudio((state) => state.updateRegion);
  const deleteRegion = useStudio((state) => state.deleteRegion);
  const mine = regions.filter((region) => region.sourceId === source.id);
  const visible = activeRegions(regions, source.id, frameIndex);
  const [kind, setKind] = useState<RegionKind>("blur");
  const [amount, setAmount] = useState(64);
  const [label, setLabel] = useState("");
  const [draft, setDraft] = useState<NormRect | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const nudge = edits.find((edit) => edit.sourceId === source.id && edit.frameIndex === frameIndex && edit.kind === "nudge");
  const grade = edits.find((edit) => edit.sourceId === source.id && edit.frameIndex === frameIndex && edit.kind === "grade");

  function onPointer(event: { phase: "down" | "move" | "up"; x: number; y: number }) {
    if (event.phase === "down") {
      anchor.current = { x: event.x, y: event.y };
      setDraft({ x: event.x, y: event.y, w: 0, h: 0 });
      return;
    }
    if (!anchor.current) return;
    const rect = {
      x: Math.min(anchor.current.x, event.x),
      y: Math.min(anchor.current.y, event.y),
      w: Math.abs(event.x - anchor.current.x),
      h: Math.abs(event.y - anchor.current.y),
    };
    if (event.phase === "move") {
      setDraft(rect);
      return;
    }
    anchor.current = null;
    setDraft(null);
    if (rect.w < 0.03 || rect.h < 0.03) return;
    void addRegion({
      id: crypto.randomUUID(),
      projectId: source.projectId,
      sourceId: source.id,
      label: label.trim() || `${kind === "pixel" ? "Pixel" : kind === "mask" ? "Mask" : "Blur"} ${mine.length + 1}`,
      kind,
      amount,
      ...rect,
      frameIn: 0,
      frameOut: source.frameCount - 1,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <Stage
          source={source}
          urls={urls}
          frameIndex={frameIndex}
          replacementUrl={replacements[frameIndex]}
          grade={grade && grade.kind === "grade" ? grade.grade : null}
          nudge={nudge && nudge.kind === "nudge" ? { dx: nudge.dx, dy: nudge.dy } : null}
          regions={visible}
          draft={draft}
          playing={playing}
          onSeek={onSeek}
          onToggle={onToggle}
          onFrameAction={onFrameAction}
          onPointer={onPointer}
        />
      </div>
      <aside className="studio-inspector min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 lg:w-80 lg:flex-none">
        <div>
          <p className="studio-kicker">FRAME TOOLS <span className="text-line">/</span> MASKS</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Mask a region</h2>
          <p className="mt-1 text-sm leading-5 text-muted">Drag a box on the viewer to blur, pixelate, or cover a detail.</p>
        </div>
        <Field label="New region name">
          <TextInput value={label} placeholder="Face, plate, sign" onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label="Treatment">
          <Select value={kind} aria-label="Treatment" onChange={(event) => setKind(event.target.value as RegionKind)}>
            <option value="blur">Soft blur</option>
            <option value="pixel">Pixelate</option>
            <option value="mask">Solid mask</option>
          </Select>
        </Field>
        <Slider label="Strength" min={8} max={100} value={amount} onChange={setAmount} />
        <ul className="space-y-3">
          {mine.map((region) => (
            <li key={region.id} className="space-y-2 rounded-md border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{region.label}</span>
                <button type="button" className="min-h-11 min-w-11 text-muted" aria-label={`Delete ${region.label}`} onClick={() => void deleteRegion(region.id)}>
                  <Trash2 className="mx-auto size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="In">
                  <TextInput
                    type="number"
                    min={0}
                    max={region.frameOut}
                    value={region.frameIn}
                    onChange={(event) => void updateRegion(region.id, { frameIn: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Out">
                  <TextInput
                    type="number"
                    min={region.frameIn}
                    max={source.frameCount - 1}
                    value={region.frameOut}
                    onChange={(event) => void updateRegion(region.id, { frameOut: Number(event.target.value) })}
                  />
                </Field>
              </div>
            </li>
          ))}
          {!mine.length ? <li className="text-sm text-muted">No regions on this take yet.</li> : null}
        </ul>
      </aside>
    </div>
  );
}
