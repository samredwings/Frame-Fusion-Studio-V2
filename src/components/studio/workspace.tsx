import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FrameExtractor, type PickedVideo, type VideoInfo, type FrameIndexResult } from "@/lib/native/frame-extractor";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Columns2,
  Download,
  Film,
  Scan,
  ScanFace,
  Settings2,
  SlidersHorizontal,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { idbDel, idbPut } from "@/lib/studio/idb";
import { useStudio } from "@/lib/studio/store";
import { TOOLS, type ToolId } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { BlurTool } from "@/components/studio/blur-tool";
import { CompareTool } from "@/components/studio/compare-tool";
import { ExportTool } from "@/components/studio/export-tool";
import { FaceTool } from "@/components/studio/face-tool";
import { FrameTool } from "@/components/studio/frame-tool";
import { CaptureWizard } from "@/components/studio/capture-wizard";
import type { NativeVideoCapturePlan } from "@/lib/studio/extraction-plan";
import { getAndroidContentPreviewUrl } from "@/lib/native/content-preview";
import type { FrameAction } from "@/components/studio/stage";
import { useBaseFrames, useRegionAssets, useReplacements } from "@/components/studio/use-frames";
import { Button, Select } from "@/components/studio/ui";

const toolMeta: Record<ToolId, { label: string; Icon: LucideIcon }> = {
  frames: { label: "Frames", Icon: Film },
  compare: { label: "Compare", Icon: Columns2 },
  blur: { label: "Masks", Icon: Scan },
  faces: { label: "FaceSync", Icon: ScanFace },
  export: { label: "Export", Icon: Download },
};

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
  const frameAssets = useStudio((state) => state.frameAssets);
  const busy = useStudio((state) => state.busy);
  const edits = useStudio((state) => state.edits);
  const regions = useStudio((state) => state.regions);
  const importVideo = useStudio((state) => state.importVideo);
  const importNativeVideo = useStudio((state) => state.importNativeVideo);
  const upsertEdit = useStudio((state) => state.upsertEdit);
  const deleteFrame = useStudio((state) => state.deleteFrame);
  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const source =
    mine.find((item) => item.id === sourceId) ??
    mine.find((item) => item.role === "primary") ??
    mine[0];
  const { urls, loading } = useBaseFrames(source, frameAssets);
  const replacements = useReplacements(source?.id, edits);
  const regionAssets = useRegionAssets(source?.id, regions);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [nativePreparing, setNativePreparing] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<{ picked: PickedVideo; previewUrl: string; info: VideoInfo; index: FrameIndexResult } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameImageRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ sourceId: string; projectId: string; frameIndex: number } | null>(
    null,
  );

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
    setEditOpen(false);
  }, [source?.id]);

  useEffect(() => {
    if (!editOpen && !toolsOpen) return;
    function closePanels(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditOpen(false);
        setToolsOpen(false);
      }
    }
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, [editOpen, toolsOpen]);

  useEffect(() => {
    if (!playing || !source?.frameCount) return;
    const timer = window.setInterval(
      () => {
        setFrameIndex((current) => (current + 1) % source.frameCount);
      },
      1000 / Math.max(1, source.fps),
    );
    return () => window.clearInterval(timer);
  }, [playing, source]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (editOpen || toolsOpen) return;
      const target = event.target as HTMLElement | null;
      if (
      