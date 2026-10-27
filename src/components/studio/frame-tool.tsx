import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brush, Crop, Download, Eraser, Frame, Grid2X2, ImagePlus, Layers2, Palette,
  RotateCcw, RotateCw, ScanFace, Scissors, SlidersHorizontal, Sparkles, Sticker,
  Type, UserRound, WandSparkles, X, type LucideIcon,
} from "lucide-react";
import { activeRegions, loadImage } from "@/lib/studio/media";
import { idbDel, idbPut } from "@/lib/studio/idb";
import { downloadOrShareBlob } from "@/lib/studio/download";
import { useStudio } from "@/lib/studio/store";
import {
  DEFAULT_FRAME_STYLE, NEUTRAL_GRADE, type FrameStyle, type Grade, type Region, type Source,
} from "@/lib/studio/types";
import { Stage, type FrameAction } from "@/components/studio/stage";
import { useReplacements } from "@/components/studio/use-frames";
import { Button, Slider, TextInput } from "@/components/studio/ui";

type EditorTool = "Canvas" | "Filter" | "Adjust" | "Effect" | "Background" | "Portrait" | "Sticker" | "Text" | "PIP" | "Remove" | "Enhance" | "Cutout" | "Doodle" | "Makeup" | "Crop" | "Frame" | "Rotate";

const editorTools: { label: EditorTool; Icon: LucideIcon }[] = [
  { label: "Canvas", Icon: Layers2 },
  { label: "Filter", Icon: Palette },
  { label: "Adjust", Icon: SlidersHorizontal },
  { label: "Effect", Icon: Sparkles },
  { label: "Background", Icon: Frame },
  { label: "Portrait", Icon: UserRound },
  { label: "Sticker", Icon: Sticker },
  { label: "Text", Icon: Type },
  { label: "PIP", Icon: ImagePlus },
  { label: "Remove", Icon: Scissors },
  { label: "Enhance", Icon: WandSparkles },
  { label: "Cutout", Icon: Eraser },
  { label: "Doodle", Icon: Brush },
  { label: "Makeup", Icon: ScanFace },
  { label: "Crop", Icon: Crop },
  { label: "Frame", Icon: Frame },
  { label: "Rotate", Icon: RotateCw },
];

const filterPresets: { name: string; grade: Grade }[] = [
  { name: "Original", grade: NEUTRAL_GRADE },
  { name: "Bright", grade: { brightness: 112, contrast: 104, saturate: 112, warmth: 4, preset: "bright" } },
  { name: "Pink", grade: { brightness: 106, contrast: 96, saturate: 114, warmth: 12, preset: "pink" } },
  { name: "Latte", grade: { brightness: 104, contrast: 94, saturate: 88, warmth: 24, preset: "latte" } },
  { name: "Vintage", grade: { brightness: 102, contrast: 88, saturate: 76, warmth: 14, preset: "vintage" } },
  { name: "Mono", grade: { brightness: 100, contrast: 110, saturate: 0, warmth: 0, preset: "mono" } },
];

const colors = ["#101317", "#f4f1ea", "#e4a15a", "#8fd0dc", "#d96c8c", "#74866e", "#000000"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cropForAspect(width: number, height: number, aspect: number | null) {
  if (!aspect) return null;
  const original = width / height;
  if (original > aspect) {
    const w = aspect / original;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = original / aspect;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

function sameCrop(left: FrameStyle["crop"], right: FrameStyle["crop"]) {
  if (!left || !right) return left === right;
  return Math.abs(left.x - right.x) < 0.001 && Math.abs(left.y - right.y) < 0.001 && Math.abs(left.w - right.w) < 0.001 && Math.abs(left.h - right.h) < 0.001;
}

export function FrameTool({
  source,
  urls,
  frameIndex,
  playing,
  onSeek,
  onToggle,
  onFrameAction,
  previewRef,
  editorOpen,
  onCloseEditor,
  onOpenTools,
  regionAssets,
  onOpenPortrait,
}: {
  source: Source;
  urls: string[];
  frameIndex: number;
  playing: boolean;
  onSeek: (index: number) => void;
  onToggle: () => void;
  onFrameAction?: (action: FrameAction, index: number) => void;
  previewRef: React.MutableRefObject<HTMLCanvasElement | null>;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onOpenTools: () => void;
  regionAssets: Record<string, string>;
  onOpenPortrait: () => void;
}) {
  const allEdits = useStudio((state) => state.edits);
  const allRegions = useStudio((state) => state.regions);
  const addRegion = useStudio((state) => state.addRegion);
  const updateRegion = useStudio((state) => state.updateRegion);
  const deleteRegion = useStudio((state) => state.deleteRegion);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const clearFrame = useStudio((state) => state.clearFrame);
  const edits = allEdits.filter((edit) => edit.sourceId === source.id);
  const replacements = useReplacements(source.id, allEdits);
  const gradeEdit = edits.find((edit) => edit.kind === "grade" && edit.frameIndex === frameIndex);
  const savedGrade = gradeEdit && gradeEdit.kind === "grade" ? gradeEdit.grade : NEUTRAL_GRADE;
  const savedGradeKey = JSON.stringify(savedGrade);
  const savedStyleEdit = edits.find((edit) => edit.kind === "style" && edit.frameIndex === frameIndex);
  const savedStyle = savedStyleEdit && savedStyleEdit.kind === "style" ? savedStyleEdit.style : DEFAULT_FRAME_STYLE;
  const savedStyleKey = JSON.stringify(savedStyle);
  const replace = edits.find((edit) => edit.kind === "replace" && edit.frameIndex === frameIndex);
  const nudge = edits.find((edit) => edit.kind === "nudge" && edit.frameIndex === frameIndex);
  const frameRegions = useMemo(() => activeRegions(allRegions, source.id, frameIndex), [allRegions, source.id, frameIndex]);
  const pipRegions = frameRegions.filter((region) => region.kind === "pip");
  const [grade, setGrade] = useState<Grade>(savedGrade);
  const [style, setStyle] = useState<FrameStyle>(savedStyle);
  const [activeTool, setActiveTool] = useState<EditorTool>("Adjust");
  const [selectedPipId, setSelectedPipId] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(48);
  const [brushMode, setBrushMode] = useState<"erase" | "restore">("erase");
  const [cutoutMode, setCutoutMode] = useState<"basic" | "advanced">("basic");
  const [pipScale, setPipScale] = useState(0.32);
  const [maskRevision, setMaskRevision] = useState(0);
  const [doodleColor, setDoodleColor] = useState("#e4a15a");
  const [doodleCanvasRevision, setDoodleCanvasRevision] = useState(0);
  const [textValue, setTextValue] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [pipDraft, setPipDraft] = useState<Region | null>(null);
  const selectedPip = pipRegions.find((region) => region.id === selectedPipId) ?? pipRegions[0];
  const selectedPipWidth = selectedPip?.w;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const imageInputKind = useRef<"pip" | "doodle">("pip");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const cutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const doodleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const painting = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const pipDragStart = useRef<{ x: number; y: number; region: Region } | null>(null);

  useEffect(() => setGrade(JSON.parse(savedGradeKey) as Grade), [savedGradeKey, frameIndex]);
  useEffect(() => setStyle(JSON.parse(savedStyleKey) as FrameStyle), [savedStyleKey, frameIndex]);
  useEffect(() => {
    if (selectedPipWidth !== undefined) setPipScale(selectedPipWidth);
  }, [selectedPipWidth]);

  useEffect(() => {
    if (!editorOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [editorOpen]);

  const marked = useMemo(() => {
    const flags = Array.from({ length: source.frameCount }, () => false);
    for (const edit of edits) flags[edit.frameIndex] = true;
    return flags;
  }, [edits, source.frameCount]);

  async function bake(nextGrade = grade) {
    await upsertEdit({
      id: crypto.randomUUID(), projectId: source.projectId, sourceId: source.id, frameIndex, kind: "grade", grade: nextGrade,
    });
  }

  async function saveStyle(next: FrameStyle) {
    setStyle(next);
    await upsertEdit({
      id: crypto.randomUUID(), projectId: source.projectId, sourceId: source.id, frameIndex, kind: "style", style: next,
    });
  }

  function chooseImage(kind: "pip" | "doodle" = "pip") {
    imageInputKind.current = kind;
    imageInputRef.current?.click();
  }

  async function onImagePick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      useStudio.setState({ error: "Choose an image file." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      useStudio.setState({ error: "Keep editor images under 20 MB." });
      return;
    }
    const id = crypto.randomUUID();
    const blobKey = `asset:${id}`;
    const isDoodle = imageInputKind.current === "doodle";
    try {
      await idbPut("blobs", blobKey, file);
      await addRegion({
        id,
        projectId: source.projectId,
        sourceId: source.id,
        label: isDoodle ? file.name : `PIP · ${file.name}`,
        kind: isDoodle ? "doodle" : "pip",
        amount: 100,
        x: isDoodle ? 0 : 0.62,
        y: isDoodle ? 0 : 0.62,
        w: isDoodle ? 1 : pipScale,
        h: isDoodle ? 1 : pipScale,
        frameIn: frameIndex,
        frameOut: frameIndex,
        blobKey,
      });
      if (!isDoodle) setSelectedPipId(id);
      setExportMessage(isDoodle ? "Overlay added to this frame." : "Picture-in-picture added. Drag it on the preview to place it.");
    } catch (error) {
      await idbDel("blobs", blobKey).catch(() => undefined);
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not add that image." });
    }
  }

  async function onReplacementPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      useStudio.setState({ error: "Choose an image under 20 MB." });
      return;
    }
    const id = crypto.randomUUID();
    const blobKey = `r:${id}`;
    try {
      await idbPut("blobs", blobKey, file);
      await upsertEdit({ id, projectId: source.projectId, sourceId: source.id, frameIndex, kind: "replace", blobKey });
    } catch (error) {
      await idbDel("blobs", blobKey).catch(() => undefined);
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not replace this frame." });
    }
  }

  async function savePaintLayer(kind: "cutout" | "doodle", canvas: HTMLCanvasElement) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const existing = frameRegions.find((region) => region.kind === kind);
    const blobKey = `asset:${crypto.randomUUID()}`;
    await idbPut("blobs", blobKey, blob);
    const shape = { x: 0, y: 0, w: 1, h: 1, amount: 100, frameIn: frameIndex, frameOut: frameIndex, blobKey };
    if (existing) await updateRegion(existing.id, shape);
    else await addRegion({
      id: crypto.randomUUID(), projectId: source.projectId, sourceId: source.id,
      label: kind === "cutout" ? "Manual cutout" : "Doodle", kind, ...shape,
    });
  }

  useEffect(() => {
    if (activeTool !== "Cutout" && activeTool !== "Remove") return;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const mask = frameRegions.find((region) => region.kind === "cutout");
    if (mask && regionAssets[mask.id]) {
      void loadImage(regionAssets[mask.id]).then((image) => {
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (cutoutCanvasRef.current === canvas) setMaskRevision((revision) => revision + 1);
      });
    }
    cutoutCanvasRef.current = canvas;
    setMaskRevision((revision) => revision + 1);
  }, [activeTool, source.id, source.width, source.height, frameIndex, frameRegions, regionAssets]);

  useEffect(() => {
    if (activeTool !== "Doodle") return;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const doodle = frameRegions.find((region) => region.kind === "doodle");
    if (doodle && regionAssets[doodle.id]) {
      void loadImage(regionAssets[doodle.id]).then((image) => {
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (doodleCanvasRef.current === canvas) setDoodleCanvasRevision((revision) => revision + 1);
      });
    }
    doodleCanvasRef.current = canvas;
    setDoodleCanvasRevision((revision) => revision + 1);
  }, [activeTool, source.id, source.width, source.height, frameIndex, frameRegions, regionAssets]);

  function stagePointer(event: { phase: "down" | "move" | "up"; x: number; y: number }) {
    if ((activeTool === "PIP" || activeTool === "Sticker") && selectedPip) {
      if (event.phase === "down") {
        pipDragStart.current = { x: event.x, y: event.y, region: pipDraft ?? selectedPip };
        return;
      }
      const start = pipDragStart.current;
      if (!start) return;
      const region = start.region;
      const next = {
        ...region,
        x: clamp(region.x + event.x - start.x, 0, 1 - region.w),
        y: clamp(region.y + event.y - start.y, 0, 1 - region.h),
      };
      if (event.phase === "move") setPipDraft(next);
      else {
        pipDragStart.current = null;
        setPipDraft(null);
        void updateRegion(region.id, { x: next.x, y: next.y });
      }
      return;
    }
    const kind = activeTool === "Doodle" ? "doodle" : activeTool === "Cutout" || activeTool === "Remove" ? "cutout" : null;
    if (!kind) return;
    const canvas = kind === "cutout" ? cutoutCanvasRef.current : doodleCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = { x: event.x * canvas.width, y: event.y * canvas.height };
    if (event.phase === "down") {
      painting.current = true;
      lastPoint.current = point;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      if (kind === "cutout") {
        ctx.globalCompositeOperation = brushMode === "erase" ? "source-over" : "destination-out";
        ctx.strokeStyle = "#fff";
        ctx.fillStyle = "#fff";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = doodleColor;
        ctx.fillStyle = doodleColor;
      }
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (kind === "cutout") setMaskRevision((revision) => revision + 1);
      else setDoodleCanvasRevision((revision) => revision + 1);
      return;
    }
    if (!painting.current || !lastPoint.current) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    if (kind === "cutout") {
      ctx.globalCompositeOperation = brushMode === "erase" ? "source-over" : "destination-out";
      ctx.strokeStyle = "#fff";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = doodleColor;
    }
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.restore();
    lastPoint.current = point;
    if (kind === "cutout") setMaskRevision((revision) => revision + 1);
    else setDoodleCanvasRevision((revision) => revision + 1);
    if (event.phase === "up") {
      painting.current = false;
      lastPoint.current = null;
      void savePaintLayer(kind, canvas).catch((error) => useStudio.setState({ error: error instanceof Error ? error.message : "Could not save the brush edit." }));
    }
  }

  function setTool(tool: EditorTool) {
    setActiveTool(tool);
    setExportMessage("");
    if (tool === "PIP" || tool === "Sticker") chooseImage("pip");
    if (tool === "Portrait") onOpenPortrait();
  }

  async function downloadStill() {
    const canvas = previewRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    try {
      await downloadOrShareBlob(blob, `${source.filename.replace(/\.\w+$/, "")}-f${String(frameIndex).padStart(3, "0")}.png`);
    } catch (error) {
      useStudio.setState({ error: error instanceof Error ? error.message : "Could not share that frame." });
    }
  }

  const previewMask = activeTool === "Cutout" || activeTool === "Remove" ? cutoutCanvasRef.current : null;
  const previewDoodle = activeTool === "Doodle" ? doodleCanvasRef.current : null;
  const previewRegions = frameRegions
    .filter((region) => !previewMask || region.kind !== "cutout")
    .map((region) => pipDraft && region.id === pipDraft.id ? pipDraft : region);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <Stage
          source={source}
          urls={urls}
          frameIndex={frameIndex}
          replacementUrl={replacements[frameIndex]}
          grade={grade}
          style={style}
          nudge={nudge && nudge.kind === "nudge" ? { dx: nudge.dx, dy: nudge.dy } : null}
          regions={previewRegions}
          regionAssets={regionAssets}
          cutoutDraft={previewMask}
          doodleDraft={previewDoodle}
          previewVersion={maskRevision + doodleCanvasRevision}
          marked={marked}
          playing={playing}
          onSeek={onSeek}
          onToggle={onToggle}
          onFrameAction={onFrameAction}
          onPointer={editorOpen && ["PIP", "Sticker", "Cutout", "Remove", "Doodle"].includes(activeTool) ? stagePointer : undefined}
          previewRef={previewRef}
        />
      </div>
      <aside
        id="frame-edit-drawer"
        className={`studio-inspector studio-frame-editor min-h-0 flex-1 flex-col overflow-hidden lg:w-80 lg:flex-none${editorOpen ? " studio-edit-drawer-open" : ""}`}
        role="region"
        aria-labelledby="frame-edit-title"
      >
        <div className="studio-edit-drawer-heading px-4 pt-4 sm:px-5">
          <div className="studio-edit-drawer-handle" aria-hidden="true" />
          <div className="studio-edit-drawer-title-row">
            <div>
              <p className="studio-kicker">IMAGE EDITOR <span className="text-line">/</span> {String(frameIndex + 1).padStart(2, "0")}</p>
              <h2 id="frame-edit-title" className="mt-1 font-display text-lg font-semibold tracking-tight">{activeTool}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="studio-edit-drawer-tools" onClick={onOpenTools}>
                <Grid2X2 className="size-4" aria-hidden="true" />Tools
              </button>
              <button ref={closeButtonRef} type="button" aria-label="Close image editor" className="studio-edit-drawer-close" onClick={onCloseEditor}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="studio-editor-controls min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          {activeTool === "Adjust" ? (
            <>
              <p className="text-sm leading-5 text-muted">Tune light and color on this frame.</p>
              <Slider label="Exposure" min={40} max={160} value={grade.brightness} suffix="%" onChange={(brightness) => setGrade({ ...grade, brightness })} />
              <Slider label="Contrast" min={40} max={180} value={grade.contrast} suffix="%" onChange={(contrast) => setGrade({ ...grade, contrast })} />
              <Slider label="Saturation" min={0} max={180} value={grade.saturate} suffix="%" onChange={(saturate) => setGrade({ ...grade, saturate })} />
              <Slider label="Warmth" min={-80} max={80} value={grade.warmth} onChange={(warmth) => setGrade({ ...grade, warmth })} />
              <div className="flex flex-wrap gap-2"><Button onClick={() => void bake()}>Apply adjustments</Button><Button tone="line" onClick={() => setGrade(NEUTRAL_GRADE)}>Reset</Button></div>
            </>
          ) : null}

          {activeTool === "Filter" || activeTool === "Effect" || activeTool === "Enhance" || activeTool === "Makeup" ? (
            <>
              <p className="text-sm leading-5 text-muted">Choose a look. Preview it here, then apply it to the selected frame.</p>
              <div className="grid grid-cols-3 gap-2">
                {filterPresets.map(({ name, grade: preset }) => (
                  <button key={name} type="button" className={`studio-preset${grade.preset === preset.preset || (!grade.preset && name === "Original") ? " is-active" : ""}`} onClick={() => setGrade(preset)}>
                    <span className={`studio-preset-swatch preset-${name.toLowerCase()}`} />{name}
                  </button>
                ))}
              </div>
              <Button onClick={() => void bake()}>Apply {activeTool === "Enhance" ? "enhancement" : activeTool === "Makeup" ? "look" : "filter"}</Button>
            </>
          ) : null}

          {activeTool === "PIP" || activeTool === "Sticker" ? (
            <>
              <p className="text-sm leading-5 text-muted">Add a photo overlay, then drag it over the preview to position it.</p>
              <Button onClick={() => chooseImage("pip")}><ImagePlus className="size-4" />Add image</Button>
              <Slider label="Overlay size" min={12} max={75} value={Math.round(pipScale * 100)} suffix="%" onChange={(value) => setPipScale(value / 100)} />
              {selectedPip ? (
                <div className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-3">
                    {regionAssets[selectedPip.id] ? <img src={regionAssets[selectedPip.id]} alt="Overlay preview" className="size-12 rounded-lg object-cover" /> : null}
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{selectedPip.label}</p><p className="text-xs text-muted">Visible on frame {selectedPip.frameIn + 1}</p></div>
                    <button type="button" aria-label="Remove picture-in-picture" className="min-h-11 px-2 text-muted hover:text-danger" onClick={() => void deleteRegion(selectedPip.id)}>Remove</button>
                  </div>
                  <Slider label="Opacity" min={10} max={100} value={selectedPip.amount} suffix="%" onChange={(amount) => void updateRegion(selectedPip.id, { amount })} />
                  <Button tone="line" className="mt-2" onClick={() => void updateRegion(selectedPip.id, { w: pipScale, h: pipScale })}>Set overlay size</Button>
                </div>
              ) : <p className="rounded-xl bg-surface p-3 text-sm text-muted">No overlay on this frame yet.</p>}
            </>
          ) : null}

          {activeTool === "Cutout" || activeTool === "Remove" ? (
            <>
              <p className="text-sm leading-5 text-muted">Brush directly on the image to cut it out to the selected canvas color. Restore brings erased pixels back.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button tone={cutoutMode === "basic" ? "solid" : "line"} onClick={() => { setCutoutMode("basic"); setBrushSize(64); }}>Basic</Button>
                <Button tone={cutoutMode === "advanced" ? "solid" : "line"} onClick={() => setCutoutMode("advanced")}>Advanced</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button tone={brushMode === "erase" ? "solid" : "line"} onClick={() => setBrushMode("erase")}><Eraser className="size-4" />Erase</Button>
                <Button tone={brushMode === "restore" ? "solid" : "line"} onClick={() => setBrushMode("restore")}><RotateCcw className="size-4" />Restore</Button>
              </div>
              {cutoutMode === "advanced" ? <Slider label="Brush size" min={4} max={140} value={brushSize} suffix="px" onChange={setBrushSize} /> : <p className="font-mono text-xs text-muted">Basic brush · switch to Advanced to adjust size</p>}
              <p className="font-mono text-xs text-muted">Manual cutout · saved to this frame</p>
            </>
          ) : null}

          {activeTool === "Doodle" ? (
            <>
              <p className="text-sm leading-5 text-muted">Draw on the preview with your finger or mouse. Strokes are stored with this frame.</p>
              <div className="flex flex-wrap gap-2">{colors.slice(2).map((color) => <button key={color} type="button" aria-label={`Doodle color ${color}`} className={`studio-color-swatch${doodleColor === color ? " is-active" : ""}`} style={{ backgroundColor: color }} onClick={() => setDoodleColor(color)} />)}</div>
              <Slider label="Brush size" min={3} max={120} value={brushSize} suffix="px" onChange={setBrushSize} />
              <Button onClick={() => chooseImage("doodle")}>Add transparent image</Button>
            </>
          ) : null}

          {activeTool === "Text" ? (
            <>
              <p className="text-sm leading-5 text-muted">Add a caption to this frame. It is included in the PNG and video export.</p>
              <TextInput aria-label="Caption text" value={textValue || style.text?.text || ""} placeholder="Type a caption" onChange={(event) => setTextValue(event.target.value)} />
              <div className="flex flex-wrap gap-2">{["#ffffff", "#e4a15a", "#8fd0dc", "#f08ca8"].map((color) => <button key={color} type="button" aria-label={`Text color ${color}`} className="studio-color-swatch" style={{ backgroundColor: color }} onClick={() => setStyle({ ...style, text: { text: textValue || style.text?.text || "", x: 0.08, y: 0.85, size: 0.055, color } })} />)}</div>
              <Button disabled={!textValue.trim()} onClick={() => void saveStyle({ ...style, text: { text: textValue.trim(), x: 0.08, y: 0.85, size: 0.055, color: style.text?.color ?? "#ffffff" } })}>Add caption</Button>
              {style.text ? <Button tone="line" onClick={() => void saveStyle({ ...style, text: null })}>Remove caption</Button> : null}
            </>
          ) : null}

          {activeTool === "Background" || activeTool === "Canvas" ? (
            <>
              <p className="text-sm leading-5 text-muted">Choose a canvas crop and background color.</p>
              <div className="grid grid-cols-2 gap-2">
                {([[null, "Original"], [1, "Square"], [4 / 5, "4:5 Portrait"], [16 / 9, "16:9 Landscape"]] as const).map(([aspect, label]) => <Button key={label} tone={sameCrop(style.crop, cropForAspect(source.width, source.height, aspect)) ? "solid" : "line"} onClick={() => void saveStyle({ ...style, crop: cropForAspect(source.width, source.height, aspect) })}>{label}</Button>)}
              </div>
              <div className="flex flex-wrap gap-2">{colors.map((color) => <button key={color} type="button" aria-label={`Canvas color ${color}`} className={`studio-color-swatch${style.backgroundColor === color ? " is-active" : ""}`} style={{ backgroundColor: color }} onClick={() => void saveStyle({ ...style, backgroundColor: color })} />)}</div>
              <p className="rounded-xl bg-surface p-3 text-xs leading-5 text-muted">Use Crop or Rotate to reveal the canvas behind your image.</p>
            </>
          ) : null}

          {activeTool === "Crop" ? (
            <>
              <p className="text-sm leading-5 text-muted">Crop this still to a common aspect ratio.</p>
              <div className="grid grid-cols-2 gap-2">
                {([[null, "Original"], [1, "Square"], [4 / 5, "4:5 Portrait"], [16 / 9, "16:9 Landscape"]] as const).map(([aspect, label]) => <Button key={label} tone={sameCrop(style.crop, cropForAspect(source.width, source.height, aspect)) ? "solid" : "line"} onClick={() => void saveStyle({ ...style, crop: cropForAspect(source.width, source.height, aspect) })}>{label}</Button>)}
              </div>
            </>
          ) : null}

          {activeTool === "Frame" ? (
            <>
              <p className="text-sm leading-5 text-muted">Add a simple border around the image.</p>
              <div className="flex flex-wrap gap-2">{colors.slice(1).map((color) => <button key={color} type="button" aria-label={`Frame color ${color}`} className={`studio-color-swatch${style.frameColor === color ? " is-active" : ""}`} style={{ backgroundColor: color }} onClick={() => void saveStyle({ ...style, frameColor: color })} />)}</div>
              <Slider label="Border width" min={1} max={10} value={Math.round(style.frameWidth * 100)} suffix="%" onChange={(value) => void saveStyle({ ...style, frameWidth: value / 100 })} />
              <Button tone="line" onClick={() => void saveStyle({ ...style, frameColor: null })}>Remove frame</Button>
            </>
          ) : null}

          {activeTool === "Rotate" ? (
            <>
              <p className="text-sm leading-5 text-muted">Rotate this frame in quarter turns.</p>
              <div className="grid grid-cols-2 gap-2"><Button onClick={() => void saveStyle({ ...style, rotation: ((style.rotation + 90) % 360) as FrameStyle["rotation"] })}><RotateCw className="size-4" />Rotate right</Button><Button tone="line" onClick={() => void saveStyle({ ...style, rotation: ((style.rotation + 270) % 360) as FrameStyle["rotation"] })}><RotateCcw className="size-4" />Rotate left</Button></div>
              <p className="font-mono text-xs text-muted">Current: {style.rotation}°</p>
            </>
          ) : null}

          {activeTool === "Portrait" ? <div className="space-y-3"><p className="text-sm leading-5 text-muted">Open the existing face tracking and stabilization controls.</p><Button onClick={onOpenPortrait}><ScanFace className="size-4" />Open FaceSync</Button></div> : null}
          {exportMessage ? <p role="status" className="text-xs text-cyan">{exportMessage}</p> : null}
          {replace ? <p className="text-xs text-cyan">A replacement still is baked on this frame and used by export.</p> : null}
        </div>

        <div className="studio-editor-footer">
          <div className="studio-editor-actions">
            <Button tone="quiet" onClick={() => replacementInputRef.current?.click()}><ImagePlus className="size-4" />Replace</Button>
            <Button tone="quiet" onClick={downloadStill}><Download className="size-4" />PNG</Button>
            <Button tone="ghost" onClick={() => void clearFrame(source.id, frameIndex)}><RotateCcw className="size-4" />Reset frame</Button>
          </div>
          <div className="studio-editor-rail" aria-label="Image editing options">
            {editorTools.map(({ label, Icon }) => (
              <button key={label} type="button" aria-pressed={activeTool === label} className={`studio-editor-tool${activeTool === label ? " is-active" : ""}`} onClick={() => setTool(label)}>
                <Icon className="size-5" aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
          <p className="studio-editor-meta">{source.width}×{source.height} · {source.fps} fps · arrows step · space plays</p>
        </div>
        <input ref={imageInputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; void onImagePick(file); event.currentTarget.value = ""; }} />
        <input ref={replacementInputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; void onReplacementPick(file); event.currentTarget.value = ""; }} />
      </aside>
    </div>
  );
}
