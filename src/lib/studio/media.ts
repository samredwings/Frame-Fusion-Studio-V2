import { evenSize } from "@/lib/studio/draw";
import { renderFrame } from "@/lib/studio/draw";
import type { Grade, Region } from "@/lib/studio/types";

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const MEDIA_WAIT_TIMEOUT_MS = 15_000;
export const MAX_CAPTURE_SECONDS = 6;

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit) return hit;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src);
      reject(new Error("A frame failed to decode."));
    };
    img.src = src;
  });
  imageCache.set(src, pending);
  return pending;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode a frame."))), type, quality);
  });
}

function waitForMediaState(video: HTMLVideoElement, readyState: number, events: string[], message: string): Promise<void> {
  if (video.readyState >= readyState) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(message));
    }, MEDIA_WAIT_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      for (const event of events) video.removeEventListener(event, check);
      video.removeEventListener("error", onError);
    };
    const check = () => {
      if (video.readyState < readyState) return;
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("This browser could not read that video."));
    };
    for (const event of events) video.addEventListener(event, check);
    video.addEventListener("error", onError);
    check();
  });
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.04) : time;
    const t = Math.max(0, Math.min(time, limit));
    if (Math.abs(video.currentTime - t) < 0.001 && video.readyState >= 2) {
      resolve();
      return;
    }
    if (Math.abs(video.currentTime - t) < 0.001) {
      void waitForMediaState(video, 2, ["loadeddata", "canplay"], "This browser timed out while decoding that video.")
        .then(resolve, reject);
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("This browser timed out while seeking inside that video."));
    }, MEDIA_WAIT_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      void waitForMediaState(video, 2, ["loadeddata", "canplay"], "This browser timed out while decoding that video.")
        .then(resolve, reject);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not seek inside that video."));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = t;
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("Could not seek inside that video."));
    }
  });
}

export async function extractVideoFrames(
  file: File,
  fps: number,
  maxFrames: number,
  onProgress: (done: number, total: number) => void,
): Promise<{ width: number; height: number; duration: number; frames: Blob[] }> {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("Choose a frame rate greater than zero.");
  if (!Number.isInteger(maxFrames) || maxFrames < 1) throw new Error("The frame limit must be a positive integer.");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await waitForMediaState(
      video,
      1,
      ["loadedmetadata", "loadeddata", "canplay"],
      "This browser timed out while reading that video.",
    );
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!video.videoWidth || !video.videoHeight || duration <= 0) {
      throw new Error("That file has no playable picture.");
    }
    const sized = evenSize(video.videoWidth, video.videoHeight, 960);
    // Keep the first sampled segment bounded. ceil() includes a final sample for
    // non-integral durations; maxFrames caps long clips to a predictable workload.
    const count = Math.min(maxFrames, Math.max(1, Math.ceil(duration * fps)));
    const canvas = document.createElement("canvas");
    canvas.width = sized.width;
    canvas.height = sized.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw frames.");
    const frames: Blob[] = [];
    const pending: Promise<Blob>[] = [];
    for (let i = 0; i < count; i++) {
      await seekTo(video, i / fps);
      ctx.drawImage(video, 0, 0, sized.width, sized.height);
      const encoding = canvasToBlob(canvas, "image/jpeg", 0.84);
      void encoding.catch(() => undefined);
      pending.push(encoding);
      onProgress(i + 1, count);
      if (pending.length >= 6) frames.push(...(await Promise.all(pending.splice(0))));
    }
    frames.push(...(await Promise.all(pending)));
    // Only the first count / fps seconds are represented by these frames. Store
    // that processed duration rather than the full input duration, otherwise
    // playback/export metadata claims to cover footage that was never imported.
    const capturedDuration = count / fps;
    return { width: sized.width, height: sized.height, duration: capturedDuration, frames };
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}

export function fitContain(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

export async function similarityScore(a: HTMLImageElement, b: HTMLImageElement): Promise<number> {
  const w = 96;
  const h = 54;
  const left = document.createElement("canvas");
  const right = document.createElement("canvas");
  left.width = right.width = w;
  left.height = right.height = h;
  const lctx = left.getContext("2d");
  const rctx = right.getContext("2d");
  if (!lctx || !rctx) return 0;
  lctx.drawImage(a, 0, 0, w, h);
  rctx.drawImage(b, 0, 0, w, h);
  const pa = lctx.getImageData(0, 0, w, h).data;
  const pb = rctx.getImageData(0, 0, w, h).data;
  let acc = 0;
  const pixels = w * h;
  for (let i = 0; i < pixels; i++) {
    const p = i * 4;
    acc += Math.abs((pa[p] ?? 0) - (pb[p] ?? 0));
    acc += Math.abs((pa[p + 1] ?? 0) - (pb[p + 1] ?? 0));
    acc += Math.abs((pa[p + 2] ?? 0) - (pb[p + 2] ?? 0));
  }
  const mean = acc / (pixels * 3 * 255);
  return Math.round((1 - Math.min(1, mean)) * 100);
}

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export async function recordFrames(
  frames: HTMLImageElement[],
  replacements: Array<HTMLImageElement | null>,
  width: number,
  height: number,
  fps: number,
  paint: (ctx: CanvasRenderingContext2D, index: number, base: HTMLImageElement, replacement: HTMLImageElement | null) => void,
  onProgress: (index: number) => void,
): Promise<Blob> {
  const mime = pickMime();
  if (!mime) throw new Error("This browser cannot record WebM. Download a still instead.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "0";
  document.body.appendChild(canvas);
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let stopped: Promise<void> | null = null;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    throw new Error("Could not start the recorder.");
  }
  try {
    const first = frames[0];
    if (!first) throw new Error("Nothing to export.");
    paint(ctx, 0, first, replacements[0] ?? null);
    stream = canvas.captureStream(fps);
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: width >= 900 ? 5_000_000 : 2_400_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    stopped = new Promise<void>((resolve, reject) => {
      if (!recorder) return reject(new Error("Could not start the recorder."));
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Recording failed."));
    });
    recorder.start();
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame) continue;
      paint(ctx, i, frame, replacements[i] ?? null);
      onProgress(i + 1);
      await new Promise((resolve) => setTimeout(resolve, Math.round(1000 / fps)));
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: "video/webm" });
    if (!blob.size) throw new Error("The recorder returned an empty file.");
    return blob;
  } finally {
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // The recorder may already be stopping after a platform error.
      }
      await stopped?.catch(() => undefined);
    }
    stream?.getTracks().forEach((track) => track.stop());
    canvas.remove();
  }
}

export function activeRegions(regions: Region[], sourceId: string, frameIndex: number): Region[] {
  return regions.filter(
    (region) => region.sourceId === sourceId && frameIndex >= region.frameIn && frameIndex <= region.frameOut,
  );
}

export function cssGrade(grade: Grade | null): string {
  return grade ? `brightness(${grade.brightness}%) contrast(${grade.contrast}%) saturate(${grade.saturate}%)` : "none";
}

export { renderFrame };
