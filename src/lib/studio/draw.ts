import type { FrameStyle, Grade, NormRect, Region } from "@/lib/studio/types";
import { DEFAULT_FRAME_STYLE, NEUTRAL_GRADE } from "@/lib/studio/types";

export type DriftPoint = { index: number; score: number; cx: number; cy: number };

type Gray = { w: number; h: number; data: Uint8ClampedArray };

let composed: HTMLCanvasElement | null = null;
let scratch: HTMLCanvasElement | null = null;

function canvas2d(width: number, height: number, which: "composed" | "scratch") {
  if (typeof document === "undefined") throw new Error("Canvas is only available in the browser.");
  let node = which === "composed" ? composed : scratch;
  if (!node) {
    node = document.createElement("canvas");
    if (which === "composed") composed = node;
    else scratch = node;
  }
  if (node.width !== width || node.height !== height) {
    node.width = width;
    node.height = height;
  }
  const ctx = node.getContext("2d");
  if (!ctx) throw new Error("Could not draw.");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, width, height);
  return { canvas: node, ctx };
}

export function gradeFilter(grade: Grade): string {
  return `brightness(${grade.brightness}%) contrast(${grade.contrast}%) saturate(${grade.saturate}%)`;
}

export function gradeIsNeutral(grade: Grade): boolean {
  return (
    grade.brightness === NEUTRAL_GRADE.brightness &&
    grade.contrast === NEUTRAL_GRADE.contrast &&
    grade.saturate === NEUTRAL_GRADE.saturate &&
    grade.warmth === NEUTRAL_GRADE.warmth
  );
}

function paintRegion(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  region: Region,
  width: number,
  height: number,
) {
  const x = Math.round(region.x * width);
  const y = Math.round(region.y * height);
  const rw = Math.max(1, Math.round(region.w * width));
  const rh = Math.max(1, Math.round(region.h * height));

  if (region.kind === "mask") {
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0.15, region.amount / 100));
    ctx.fillStyle = "#101317";
    ctx.fillRect(x, y, rw, rh);
    ctx.restore();
    return;
  }

  if (region.kind === "pixel") {
    const block = Math.max(4, Math.round(4 + (region.amount / 100) * 28));
    const sw = Math.max(1, Math.round(rw / block));
    const sh = Math.max(1, Math.round(rh / block));
    const { canvas, ctx: sctx } = canvas2d(sw, sh, "scratch");
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(source, x, y, rw, rh, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, sw, sh, x, y, rw, rh);
    ctx.imageSmoothingEnabled = true;
    return;
  }

  const blur = Math.max(1, (region.amount / 100) * 16);
  const pad = Math.ceil(blur * 2);
  const { canvas, ctx: sctx } = canvas2d(rw + pad * 2, rh + pad * 2, "scratch");
  sctx.filter = `blur(${blur}px)`;
  sctx.drawImage(source, x - pad, y - pad, rw + pad * 2, rh + pad * 2, 0, 0, rw + pad * 2, rh + pad * 2);
  sctx.filter = "none";
  ctx.drawImage(canvas, pad, pad, rw, rh, x, y, rw, rh);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  base: CanvasImageSource,
  width: number,
  height: number,
  fx: {
    grade: Grade | null;
    replacement: CanvasImageSource | null;
    nudge: { dx: number; dy: number } | null;
    regions: Region[];
    assets?: Record<string, CanvasImageSource>;
    style?: FrameStyle | null;
    cutoutDraft?: CanvasImageSource | null;
    doodleDraft?: CanvasImageSource | null;
  },
) {
  const image = fx.replacement ?? base;
  const dx = fx.nudge?.dx ?? 0;
  const dy = fx.nudge?.dy ?? 0;
  const style = fx.style ?? DEFAULT_FRAME_STYLE;
  const { canvas, ctx: off } = canvas2d(width, height, "composed");
  off.fillStyle = style.backgroundColor || "#101317";
  off.fillRect(0, 0, width, height);
  off.filter = fx.grade ? gradeFilter(fx.grade) : "none";
  const imageSize = image as CanvasImageSource & { width?: number; naturalWidth?: number; height?: number; naturalHeight?: number };
  const imageWidth = imageSize.naturalWidth || imageSize.width || width;
  const imageHeight = imageSize.naturalHeight || imageSize.height || height;
  const crop = style.crop;
  const sx = crop ? crop.x * imageWidth : 0;
  const sy = crop ? crop.y * imageHeight : 0;
  const sw = crop ? crop.w * imageWidth : imageWidth;
  const sh = crop ? crop.h * imageHeight : imageHeight;
  const rotation = style.rotation * Math.PI / 180;
  if (rotation) {
    off.save();
    off.translate(width / 2 + dx, height / 2 + dy);
    off.rotate(rotation);
    off.drawImage(image, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
    off.restore();
  } else {
    off.drawImage(image, sx, sy, sw, sh, dx, dy, width, height);
  }
  off.filter = "none";
  if (fx.grade && fx.grade.warmth !== 0) {
    off.save();
    off.globalCompositeOperation = "soft-light";
    off.globalAlpha = Math.min(0.55, Math.abs(fx.grade.warmth) / 100);
    off.fillStyle = fx.grade.warmth > 0 ? "#e4a15a" : "#8fd0dc";
    off.fillRect(0, 0, width, height);
    off.restore();
  }

  for (const region of fx.regions) {
    if (region.kind !== "cutout") continue;
    const mask = fx.assets?.[region.id];
    if (!mask) continue;
    off.save();
    off.globalCompositeOperation = "destination-out";
    off.drawImage(mask, 0, 0, width, height);
    off.restore();
  }
  if (fx.cutoutDraft) {
    off.save();
    off.globalCompositeOperation = "destination-out";
    off.drawImage(fx.cutoutDraft, 0, 0, width, height);
    off.restore();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(canvas, 0, 0);

  for (const region of fx.regions) {
    if (region.kind === "cutout") continue;
    if (region.kind === "pip" || region.kind === "doodle") {
      const asset = fx.assets?.[region.id];
      if (!asset) continue;
      const x = region.x * width;
      const y = region.y * height;
      const rw = Math.max(1, region.w * width);
      const rh = Math.max(1, region.h * height);
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0.05, region.amount / 100));
      if (region.kind === "pip") {
        const size = asset as CanvasImageSource & { width?: number; naturalWidth?: number; height?: number; naturalHeight?: number };
        const iw = size.naturalWidth || size.width || rw;
        const ih = size.naturalHeight || size.height || rh;
        const scale = Math.min(rw / iw, rh / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(asset, x + (rw - dw) / 2, y + (rh - dh) / 2, dw, dh);
      } else {
        ctx.drawImage(asset, x, y, rw, rh);
      }
      ctx.restore();
      continue;
    }
    paintRegion(ctx, canvas, region, width, height);
  }
  if (fx.doodleDraft) ctx.drawImage(fx.doodleDraft, 0, 0, width, height);

  if (style.frameColor) {
    ctx.save();
    ctx.strokeStyle = style.frameColor;
    ctx.lineWidth = Math.max(1, style.frameWidth * Math.min(width, height));
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    ctx.restore();
  }
  if (style.text?.text) {
    ctx.save();
    ctx.fillStyle = style.text.color;
    ctx.font = `600 ${Math.max(12, style.text.size * width)}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.75)";
    ctx.shadowBlur = 5;
    ctx.fillText(style.text.text, style.text.x * width, style.text.y * height, width * 0.9);
    ctx.restore();
  }
}

export function paintDemoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  index: number,
  total: number,
  variant: "a" | "b",
) {
  const t = total <= 1 ? 0 : index / (total - 1);
  ctx.fillStyle = "#101317";
  ctx.fillRect(0, 0, width, height);
  const sky = ctx.createLinearGradient(0, height * 0.35, 0, height);
  sky.addColorStop(0, "#101317");
  sky.addColorStop(1, variant === "a" ? "#1c2c33" : "#2a2418");
  ctx.fillStyle = sky;
  ctx.fillRect(0, height * 0.42, width, height * 0.58);

  ctx.strokeStyle = "rgba(231,235,240,0.28)";
  ctx.lineWidth = 2;
  const m = 16;
  const leg = 22;
  ctx.beginPath();
  ctx.moveTo(m, m + leg);
  ctx.lineTo(m, m);
  ctx.lineTo(m + leg, m);
  ctx.moveTo(width - m - leg, m);
  ctx.lineTo(width - m, m);
  ctx.lineTo(width - m, m + leg);
  ctx.moveTo(m, height - m - leg);
  ctx.lineTo(m, height - m);
  ctx.lineTo(m + leg, height - m);
  ctx.moveTo(width - m - leg, height - m);
  ctx.lineTo(width - m, height - m);
  ctx.lineTo(width - m, height - m - leg);
  ctx.stroke();

  const amp = variant === "a" ? 34 : 78;
  const wobble = variant === "a" ? Math.sin(t * Math.PI * 2) : Math.sin(t * Math.PI * 4);
  const cx = width * 0.5 + wobble * amp;
  const cy = height * 0.48 + Math.cos(t * Math.PI * 2) * (variant === "a" ? 6 : 14);

  ctx.fillStyle = "#1a120e";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 28, 58, 40, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c48962";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 48, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c2430";
  ctx.beginPath();
  ctx.ellipse(cx - 16, cy - 8, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 16, cy - 8, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = variant === "a" ? "#e4a15a" : "#8fd0dc";
  ctx.beginPath();
  ctx.arc(width * 0.2 + Math.cos(t * Math.PI * 2) * 16, height * 0.28, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = variant === "a" ? "#8fd0dc" : "#e4a15a";
  ctx.beginPath();
  ctx.arc(width * 0.8, height * 0.7 + Math.sin(t * Math.PI * 2) * 18, 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#e7ebf0";
  ctx.font = "600 18px sans-serif";
  ctx.fillText(variant === "a" ? "TAKE A" : "TAKE B", 28, 40);
  ctx.fillStyle = "#93a0ae";
  ctx.font = "500 13px monospace";
  ctx.fillText(`f ${String(index).padStart(2, "0")}`, 28, 60);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function suggestLock(img: CanvasImageSource & { width?: number; naturalWidth?: number; height?: number; naturalHeight?: number }): Promise<NormRect> {
  const srcW = img.naturalWidth || img.width || 1;
  const srcH = img.naturalHeight || img.height || 1;
  const w = 120;
  const h = Math.max(1, Math.round((srcH / srcW) * w));
  const { ctx } = canvas2d(w, h, "scratch");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (r > 140 && g > 80 && b > 50 && r > g && g > b && r - g > 25) {
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 24 || maxX <= minX) return { x: 0.36, y: 0.24, w: 0.28, h: 0.48 };
  const padX = (maxX - minX) * 0.2;
  const padY = (maxY - minY) * 0.22;
  const x0 = clamp((minX - padX) / w, 0, 0.85);
  const y0 = clamp((minY - padY) / h, 0, 0.85);
  const x1 = clamp((maxX + padX) / w, x0 + 0.08, 1);
  const y1 = clamp((maxY + padY) / h, y0 + 0.08, 1);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function downsampleGray(img: CanvasImageSource, width: number, srcW: number, srcH: number): Gray {
  const height = Math.max(1, Math.round((srcH / srcW) * width));
  const { ctx } = canvas2d(width, height, "scratch");
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i++) {
    const p = i * 4;
    data[i] = Math.round(0.3 * (pixels[p] ?? 0) + 0.59 * (pixels[p + 1] ?? 0) + 0.11 * (pixels[p + 2] ?? 0));
  }
  return { w: width, h: height, data };
}

function sample(gray: Gray, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= gray.w || y >= gray.h) return -1;
  return gray.data[y * gray.w + x] ?? 0;
}

function sad(gray: Gray, x: number, y: number, tpl: Uint8ClampedArray, tw: number, th: number): number {
  let sum = 0;
  for (let yy = 0; yy < th; yy++) {
    for (let xx = 0; xx < tw; xx++) {
      const v = sample(gray, x + xx, y + yy);
      if (v < 0) return Number.POSITIVE_INFINITY;
      sum += Math.abs(v - (tpl[yy * tw + xx] ?? 0));
    }
  }
  return sum;
}

export function measureDrift(
  images: Array<CanvasImageSource & { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number }>,
  lock: NormRect,
): DriftPoint[] {
  if (!images.length) return [];
  const srcW = images[0]?.naturalWidth || images[0]?.width || 1;
  const srcH = images[0]?.naturalHeight || images[0]?.height || 1;
  const grays = images.map((img) => downsampleGray(img, 160, srcW, srcH));
  const base = grays[0];
  if (!base) return [];
  const tw = 18;
  const th = 18;
  const tpl = new Uint8ClampedArray(tw * th);
  let prevX = Math.round((lock.x + lock.w / 2) * base.w - tw / 2);
  let prevY = Math.round((lock.y + lock.h / 2) * base.h - th / 2);
  for (let yy = 0; yy < th; yy++) {
    for (let xx = 0; xx < tw; xx++) {
      const v = sample(base, prevX + xx, prevY + yy);
      tpl[yy * tw + xx] = v < 0 ? 0 : v;
    }
  }
  const refCx = (lock.x + lock.w / 2) * srcW;
  const refCy = (lock.y + lock.h / 2) * srcH;
  const points: DriftPoint[] = [];
  for (let i = 0; i < grays.length; i++) {
    const gray = grays[i];
    if (!gray) continue;
    let best = Number.POSITIVE_INFINITY;
    let bx = prevX;
    let by = prevY;
    const rad = i === 0 ? 1 : 24;
    for (let y = prevY - rad; y <= prevY + rad; y += 2) {
      for (let x = prevX - rad; x <= prevX + rad; x += 2) {
        const score = sad(gray, x, y, tpl, tw, th);
        if (score < best) {
          best = score;
          bx = x;
          by = y;
        }
      }
    }
    prevX = bx;
    prevY = by;
    const cx = ((bx + tw / 2) / base.w) * srcW;
    const cy = ((by + th / 2) / base.h) * srcH;
    const dist = Math.hypot(cx - refCx, cy - refCy);
    const score = Math.round(clamp((dist / (srcW * 0.2)) * 100, 0, 100));
    points.push({ index: i, score, cx, cy });
  }
  return points;
}

export function evenSize(width: number, height: number, maxEdge: number) {
  const long = Math.max(width, height);
  const scale = long > maxEdge ? maxEdge / long : 1;
  const w = Math.max(2, Math.round((width * scale) / 2) * 2);
  const h = Math.max(2, Math.round((height * scale) / 2) * 2);
  return { width: w, height: h };
}
