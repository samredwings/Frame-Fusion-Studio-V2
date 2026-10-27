import { i as __toESM } from "../_runtime.mjs";
import { J as require_react, S as require_jsx_runtime, _ as createFileRoute, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, v as createRootRoute, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-_lYV9ozo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* Path-based preview hosts serve the dev server under `/{port_id}/` and strip
* that prefix before forwarding, so SSR sees `/` while the browser URL keeps the
* prefix. TanStack Start resets `basepath` on hydration, so a `rewrite` keeps
* client routing and generated links aligned with the public URL.
*/
var PATH_BASED_PREVIEW_HOSTS = /* @__PURE__ */ new Set([
	"preview.grok.genai.mil",
	"preview.grok.mil",
	"preview.grokgsac.com"
]);
var PORT_ID_PREFIX = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i;
function previewPathPrefix(hostname, pathname) {
	if (!PATH_BASED_PREVIEW_HOSTS.has(hostname.toLowerCase())) return void 0;
	return PORT_ID_PREFIX.exec(pathname)?.[0];
}
function prefixRewrite(prefix) {
	return {
		input: ({ url }) => {
			if (url.pathname === prefix) url.pathname = "/";
			else if (url.pathname.startsWith(`${prefix}/`)) url.pathname = url.pathname.slice(prefix.length);
			return url;
		},
		output: ({ url }) => {
			url.pathname = `${prefix}${url.pathname}`;
			return url;
		}
	};
}
function previewPathRewrite() {
	if (typeof window === "undefined") return void 0;
	const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
	return prefix ? prefixRewrite(prefix) : void 0;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var DB_NAME = "frame-fusion";
var VERSION = 1;
var STORES = [
	"projects",
	"sources",
	"edits",
	"regions",
	"exports",
	"blobs"
];
var opening = null;
function openDb() {
	if (typeof indexedDB === "undefined") return Promise.reject(/* @__PURE__ */ new Error("This browser has no local library."));
	if (!opening) opening = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => {
			opening = null;
			reject(req.error ?? /* @__PURE__ */ new Error("Could not open the library"));
		};
	});
	return opening;
}
function requestToPromise(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("Library request failed"));
	});
}
async function idbAll(store) {
	return requestToPromise((await openDb()).transaction(store, "readonly").objectStore(store).getAll());
}
async function idbGet(store, key) {
	return requestToPromise((await openDb()).transaction(store, "readonly").objectStore(store).get(key));
}
async function idbPut(store, key, value) {
	await requestToPromise((await openDb()).transaction(store, "readwrite").objectStore(store).put(value, key));
}
async function idbDel(store, key) {
	await requestToPromise((await openDb()).transaction(store, "readwrite").objectStore(store).delete(key));
}
function frameKey(sourceId, index) {
	return `f:${sourceId}:${index}`;
}
var NEUTRAL_GRADE = {
	brightness: 100,
	contrast: 100,
	saturate: 100,
	warmth: 0
};
var TOOLS = [
	{
		id: "frames",
		label: "Frame Editor"
	},
	{
		id: "compare",
		label: "Multi-Compare"
	},
	{
		id: "blur",
		label: "Blur Studio"
	},
	{
		id: "faces",
		label: "FaceSync"
	},
	{
		id: "export",
		label: "Exports"
	}
];
function parseTool(value) {
	return value === "compare" || value === "blur" || value === "faces" || value === "export" || value === "frames" ? value : "frames";
}
var composed = null;
var scratch = null;
function canvas2d(width, height, which) {
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
	return {
		canvas: node,
		ctx
	};
}
function gradeFilter(grade) {
	return `brightness(${grade.brightness}%) contrast(${grade.contrast}%) saturate(${grade.saturate}%)`;
}
function paintRegion(ctx, source, region, width, height) {
	const x = Math.round(region.x * width);
	const y = Math.round(region.y * height);
	const rw = Math.max(1, Math.round(region.w * width));
	const rh = Math.max(1, Math.round(region.h * height));
	if (region.kind === "mask") {
		ctx.save();
		ctx.globalAlpha = Math.min(1, Math.max(.15, region.amount / 100));
		ctx.fillStyle = "#101317";
		ctx.fillRect(x, y, rw, rh);
		ctx.restore();
		return;
	}
	if (region.kind === "pixel") {
		const block = Math.max(4, Math.round(4 + region.amount / 100 * 28));
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
	const blur = Math.max(1, region.amount / 100 * 16);
	const pad = Math.ceil(blur * 2);
	const { canvas, ctx: sctx } = canvas2d(rw + pad * 2, rh + pad * 2, "scratch");
	sctx.filter = `blur(${blur}px)`;
	sctx.drawImage(source, x - pad, y - pad, rw + pad * 2, rh + pad * 2, 0, 0, rw + pad * 2, rh + pad * 2);
	sctx.filter = "none";
	ctx.drawImage(canvas, pad, pad, rw, rh, x, y, rw, rh);
}
function renderFrame(ctx, base, width, height, fx) {
	const image = fx.replacement ?? base;
	const dx = fx.nudge?.dx ?? 0;
	const dy = fx.nudge?.dy ?? 0;
	const { canvas, ctx: off } = canvas2d(width, height, "composed");
	off.fillStyle = "#101317";
	off.fillRect(0, 0, width, height);
	off.filter = fx.grade ? gradeFilter(fx.grade) : "none";
	off.drawImage(image, dx, dy, width, height);
	off.filter = "none";
	if (fx.grade && fx.grade.warmth !== 0) {
		off.save();
		off.globalCompositeOperation = "soft-light";
		off.globalAlpha = Math.min(.55, Math.abs(fx.grade.warmth) / 100);
		off.fillStyle = fx.grade.warmth > 0 ? "#e4a15a" : "#8fd0dc";
		off.fillRect(0, 0, width, height);
		off.restore();
	}
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.filter = "none";
	ctx.globalAlpha = 1;
	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(canvas, 0, 0);
	for (const region of fx.regions) paintRegion(ctx, canvas, region, width, height);
}
function paintDemoFrame(ctx, width, height, index, total, variant) {
	const t = total <= 1 ? 0 : index / (total - 1);
	ctx.fillStyle = "#101317";
	ctx.fillRect(0, 0, width, height);
	const sky = ctx.createLinearGradient(0, height * .35, 0, height);
	sky.addColorStop(0, "#101317");
	sky.addColorStop(1, variant === "a" ? "#1c2c33" : "#2a2418");
	ctx.fillStyle = sky;
	ctx.fillRect(0, height * .42, width, height * .58);
	ctx.strokeStyle = "rgba(231,235,240,0.28)";
	ctx.lineWidth = 2;
	const m = 16;
	const leg = 22;
	ctx.beginPath();
	ctx.moveTo(m, 38);
	ctx.lineTo(m, m);
	ctx.lineTo(38, m);
	ctx.moveTo(width - m - leg, m);
	ctx.lineTo(width - m, m);
	ctx.lineTo(width - m, 38);
	ctx.moveTo(m, height - m - leg);
	ctx.lineTo(m, height - m);
	ctx.lineTo(38, height - m);
	ctx.moveTo(width - m - leg, height - m);
	ctx.lineTo(width - m, height - m);
	ctx.lineTo(width - m, height - m - leg);
	ctx.stroke();
	const amp = variant === "a" ? 34 : 78;
	const wobble = variant === "a" ? Math.sin(t * Math.PI * 2) : Math.sin(t * Math.PI * 4);
	const cx = width * .5 + wobble * amp;
	const cy = height * .48 + Math.cos(t * Math.PI * 2) * (variant === "a" ? 6 : 14);
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
	ctx.arc(width * .2 + Math.cos(t * Math.PI * 2) * 16, height * .28, 26, 0, Math.PI * 2);
	ctx.stroke();
	ctx.strokeStyle = variant === "a" ? "#8fd0dc" : "#e4a15a";
	ctx.beginPath();
	ctx.arc(width * .8, height * .7 + Math.sin(t * Math.PI * 2) * 18, 20, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = "#e7ebf0";
	ctx.font = "600 18px sans-serif";
	ctx.fillText(variant === "a" ? "TAKE A" : "TAKE B", 28, 40);
	ctx.fillStyle = "#93a0ae";
	ctx.font = "500 13px monospace";
	ctx.fillText(`f ${String(index).padStart(2, "0")}`, 28, 60);
}
function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}
async function suggestLock(img) {
	const srcW = img.naturalWidth || img.width || 1;
	const srcH = img.naturalHeight || img.height || 1;
	const w = 120;
	const h = Math.max(1, Math.round(srcH / srcW * w));
	const { canvas, ctx } = canvas2d(w, h, "scratch");
	ctx.drawImage(img, 0, 0, w, h);
	const data = ctx.getImageData(0, 0, w, h).data;
	let minX = w;
	let minY = h;
	let maxX = 0;
	let maxY = 0;
	let count = 0;
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
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
	if (count < 24 || maxX <= minX) return {
		x: .36,
		y: .24,
		w: .28,
		h: .48
	};
	const padX = (maxX - minX) * .2;
	const padY = (maxY - minY) * .22;
	const x0 = clamp((minX - padX) / w, 0, .85);
	const y0 = clamp((minY - padY) / h, 0, .85);
	const x1 = clamp((maxX + padX) / w, x0 + .08, 1);
	const y1 = clamp((maxY + padY) / h, y0 + .08, 1);
	return {
		x: x0,
		y: y0,
		w: x1 - x0,
		h: y1 - y0
	};
}
function downsampleGray(img, width, srcW, srcH) {
	const height = Math.max(1, Math.round(srcH / srcW * width));
	const { canvas, ctx } = canvas2d(width, height, "scratch");
	ctx.drawImage(img, 0, 0, width, height);
	const pixels = ctx.getImageData(0, 0, width, height).data;
	const data = new Uint8ClampedArray(width * height);
	for (let i = 0; i < data.length; i++) {
		const p = i * 4;
		data[i] = Math.round(.3 * (pixels[p] ?? 0) + .59 * (pixels[p + 1] ?? 0) + .11 * (pixels[p + 2] ?? 0));
	}
	return {
		w: width,
		h: height,
		data
	};
}
function sample(gray, x, y) {
	if (x < 0 || y < 0 || x >= gray.w || y >= gray.h) return -1;
	return gray.data[y * gray.w + x] ?? 0;
}
function sad(gray, x, y, tpl, tw, th) {
	let sum = 0;
	for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
		const v = sample(gray, x + xx, y + yy);
		if (v < 0) return Number.POSITIVE_INFINITY;
		sum += Math.abs(v - (tpl[yy * tw + xx] ?? 0));
	}
	return sum;
}
function measureDrift(images, lock) {
	if (!images.length) return [];
	const srcW = images[0]?.naturalWidth || images[0]?.width || 1;
	const srcH = images[0]?.naturalHeight || images[0]?.height || 1;
	const grays = images.map((img) => downsampleGray(img, 160, srcW, srcH));
	const base = grays[0];
	if (!base) return [];
	const tw = 18;
	const th = 18;
	const tpl = /* @__PURE__ */ new Uint8ClampedArray(324);
	let prevX = Math.round((lock.x + lock.w / 2) * base.w - tw / 2);
	let prevY = Math.round((lock.y + lock.h / 2) * base.h - th / 2);
	for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
		const v = sample(base, prevX + xx, prevY + yy);
		tpl[yy * tw + xx] = v < 0 ? 0 : v;
	}
	const refCx = (lock.x + lock.w / 2) * srcW;
	const refCy = (lock.y + lock.h / 2) * srcH;
	const points = [];
	for (let i = 0; i < grays.length; i++) {
		const gray = grays[i];
		if (!gray) continue;
		let best = Number.POSITIVE_INFINITY;
		let bx = prevX;
		let by = prevY;
		const rad = i === 0 ? 1 : 24;
		for (let y = prevY - rad; y <= prevY + rad; y += 2) for (let x = prevX - rad; x <= prevX + rad; x += 2) {
			const score = sad(gray, x, y, tpl, tw, th);
			if (score < best) {
				best = score;
				bx = x;
				by = y;
			}
		}
		prevX = bx;
		prevY = by;
		const cx = (bx + tw / 2) / base.w * srcW;
		const cy = (by + th / 2) / base.h * srcH;
		const dist = Math.hypot(cx - refCx, cy - refCy);
		const score = Math.round(clamp(dist / (srcW * .2) * 100, 0, 100));
		points.push({
			index: i,
			score,
			cx,
			cy
		});
	}
	return points;
}
function evenSize(width, height, maxEdge) {
	const long = Math.max(width, height);
	const scale = long > maxEdge ? maxEdge / long : 1;
	return {
		width: Math.max(2, Math.round(width * scale / 2) * 2),
		height: Math.max(2, Math.round(height * scale / 2) * 2)
	};
}
var imageCache = /* @__PURE__ */ new Map();
function loadImage(src) {
	const hit = imageCache.get(src);
	if (hit) return hit;
	const pending = new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => {
			imageCache.delete(src);
			reject(/* @__PURE__ */ new Error("A frame failed to decode."));
		};
		img.src = src;
	});
	imageCache.set(src, pending);
	return pending;
}
function canvasToBlob(canvas, type, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("Could not encode a frame.")), type, quality);
	});
}
function seekTo(video, time) {
	return new Promise((resolve, reject) => {
		const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - .04) : time;
		const t = Math.max(0, Math.min(time, limit));
		if (Math.abs(video.currentTime - t) < .001 && video.readyState >= 2) {
			resolve();
			return;
		}
		const cleanup = () => {
			video.removeEventListener("seeked", onSeeked);
			video.removeEventListener("error", onError);
		};
		const onSeeked = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(/* @__PURE__ */ new Error("Could not seek inside that video."));
		};
		video.addEventListener("seeked", onSeeked);
		video.addEventListener("error", onError);
		try {
			video.currentTime = t;
		} catch (error) {
			cleanup();
			reject(error instanceof Error ? error : /* @__PURE__ */ new Error("Could not seek inside that video."));
		}
	});
}
async function extractVideoFrames(file, fps, maxFrames, onProgress) {
	const url = URL.createObjectURL(file);
	const video = document.createElement("video");
	video.muted = true;
	video.playsInline = true;
	video.preload = "auto";
	video.src = url;
	try {
		await new Promise((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(/* @__PURE__ */ new Error("This browser could not read that video."));
		});
		await video.play().catch(() => void 0);
		video.pause();
		const duration = Number.isFinite(video.duration) ? video.duration : 0;
		if (!video.videoWidth || !video.videoHeight || duration <= 0) throw new Error("That file has no playable picture.");
		const sized = evenSize(video.videoWidth, video.videoHeight, 960);
		const count = Math.min(maxFrames, Math.max(1, Math.floor(duration * fps)));
		const canvas = document.createElement("canvas");
		canvas.width = sized.width;
		canvas.height = sized.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Could not draw frames.");
		const frames = [];
		for (let i = 0; i < count; i++) {
			await seekTo(video, i / fps);
			ctx.drawImage(video, 0, 0, sized.width, sized.height);
			frames.push(await canvasToBlob(canvas, "image/jpeg", .84));
			onProgress(i + 1, count);
		}
		return {
			width: sized.width,
			height: sized.height,
			duration,
			frames
		};
	} finally {
		URL.revokeObjectURL(url);
		video.src = "";
	}
}
function fitContain(srcW, srcH, dstW, dstH) {
	const scale = Math.min(dstW / srcW, dstH / srcH);
	const w = srcW * scale;
	const h = srcH * scale;
	return {
		x: (dstW - w) / 2,
		y: (dstH - h) / 2,
		w,
		h
	};
}
async function similarityScore(a, b) {
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
	const pixels = 5184;
	for (let i = 0; i < pixels; i++) {
		const p = i * 4;
		acc += Math.abs((pa[p] ?? 0) - (pb[p] ?? 0));
		acc += Math.abs((pa[p + 1] ?? 0) - (pb[p + 1] ?? 0));
		acc += Math.abs((pa[p + 2] ?? 0) - (pb[p + 2] ?? 0));
	}
	const mean = acc / (pixels * 3 * 255);
	return Math.round((1 - Math.min(1, mean)) * 100);
}
function pickMime() {
	if (typeof MediaRecorder === "undefined") return null;
	return [
		"video/webm;codecs=vp9",
		"video/webm;codecs=vp8",
		"video/webm"
	].find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}
async function recordFrames(frames, replacements, width, height, fps, paint, onProgress) {
	const mime = pickMime();
	if (!mime) throw new Error("This browser cannot record WebM. Download a still instead.");
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	canvas.style.position = "fixed";
	canvas.style.left = "-9999px";
	canvas.style.top = "0";
	document.body.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		canvas.remove();
		throw new Error("Could not start the recorder.");
	}
	try {
		const first = frames[0];
		if (!first) throw new Error("Nothing to export.");
		paint(ctx, 0, first, replacements[0] ?? null);
		const stream = canvas.captureStream(fps);
		const rec = new MediaRecorder(stream, {
			mimeType: mime,
			videoBitsPerSecond: width >= 900 ? 5e6 : 24e5
		});
		const chunks = [];
		rec.ondataavailable = (event) => {
			if (event.data.size) chunks.push(event.data);
		};
		const stopped = new Promise((resolve, reject) => {
			rec.onstop = () => resolve();
			rec.onerror = () => reject(/* @__PURE__ */ new Error("Recording failed."));
		});
		rec.start();
		for (let i = 0; i < frames.length; i++) {
			const frame = frames[i];
			if (!frame) continue;
			paint(ctx, i, frame, replacements[i] ?? null);
			onProgress(i + 1);
			await new Promise((resolve) => setTimeout(resolve, Math.round(1e3 / fps)));
		}
		rec.stop();
		await stopped;
		stream.getTracks().forEach((track) => track.stop());
		const blob = new Blob(chunks, { type: "video/webm" });
		if (!blob.size) throw new Error("The recorder returned an empty file.");
		return blob;
	} finally {
		canvas.remove();
	}
}
function activeRegions(regions, sourceId, frameIndex) {
	return regions.filter((region) => region.sourceId === sourceId && frameIndex >= region.frameIn && frameIndex <= region.frameOut);
}
var DEMO_PROJECT_ID = "demo-harbor";
var DEMO_TAKE_A = "demo-take-a";
var DEMO_TAKE_B = "demo-take-b";
var WIDTH = 560;
var HEIGHT = 316;
var FPS = 10;
var FRAMES = 20;
async function writeTake(sourceId, variant) {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not draw the demo reel.");
	for (let i = 0; i < FRAMES; i++) {
		paintDemoFrame(ctx, WIDTH, HEIGHT, i, FRAMES, variant);
		const blob = await canvasToBlob(canvas, "image/jpeg", .86);
		await idbPut("blobs", frameKey(sourceId, i), blob);
	}
}
async function seedDemo() {
	const now = Date.now();
	const project = {
		id: DEMO_PROJECT_ID,
		name: "Harbor Night",
		description: "Seeded reel so every tool has something to cut before you import your own take.",
		status: "cutting",
		fps: FPS,
		createdAt: now,
		updatedAt: now
	};
	const sources = [{
		id: DEMO_TAKE_A,
		projectId: DEMO_PROJECT_ID,
		filename: "harbor-take-a.webm",
		role: "primary",
		fps: FPS,
		frameCount: FRAMES,
		durationMs: Math.round(FRAMES / FPS * 1e3),
		width: WIDTH,
		height: HEIGHT,
		fileSize: 0,
		lock: null,
		createdAt: now
	}, {
		id: DEMO_TAKE_B,
		projectId: DEMO_PROJECT_ID,
		filename: "harbor-take-b.webm",
		role: "compare",
		fps: FPS,
		frameCount: FRAMES,
		durationMs: Math.round(FRAMES / FPS * 1e3),
		width: WIDTH,
		height: HEIGHT,
		fileSize: 0,
		lock: null,
		createdAt: now + 1
	}];
	await writeTake(DEMO_TAKE_A, "a");
	await writeTake(DEMO_TAKE_B, "b");
	const region = {
		id: "demo-ring",
		projectId: DEMO_PROJECT_ID,
		sourceId: DEMO_TAKE_A,
		label: "Signal ring",
		kind: "blur",
		amount: 72,
		x: .1,
		y: .14,
		w: .24,
		h: .32,
		frameIn: 0,
		frameOut: 19
	};
	await idbPut("projects", project.id, project);
	for (const source of sources) await idbPut("sources", source.id, source);
	await idbPut("regions", region.id, region);
	await idbPut("edits", "demo-grade", {
		id: "demo-grade",
		projectId: DEMO_PROJECT_ID,
		sourceId: DEMO_TAKE_A,
		frameIndex: 8,
		kind: "grade",
		grade: {
			brightness: 108,
			contrast: 112,
			saturate: 118,
			warmth: 28
		}
	});
}
var booting = null;
async function readLibrary() {
	const [projects, sources, edits, regions, exports] = await Promise.all([
		idbAll("projects"),
		idbAll("sources"),
		idbAll("edits"),
		idbAll("regions"),
		idbAll("exports")
	]);
	projects.sort((a, b) => b.updatedAt - a.updatedAt);
	sources.sort((a, b) => a.createdAt - b.createdAt);
	exports.sort((a, b) => b.createdAt - a.createdAt);
	return {
		projects,
		sources,
		edits,
		regions,
		exports
	};
}
async function dropSourceMedia(source, edits, exports) {
	for (let i = 0; i < source.frameCount; i++) await idbDel("blobs", frameKey(source.id, i));
	for (const edit of edits) {
		if (edit.sourceId === source.id && edit.kind === "replace") await idbDel("blobs", edit.blobKey);
		if (edit.sourceId === source.id) await idbDel("edits", edit.id);
	}
	for (const item of exports) if (item.sourceId === source.id) {
		await idbDel("blobs", item.blobKey);
		await idbDel("exports", item.id);
	}
}
var useStudio = create((set, get) => ({
	ready: false,
	error: null,
	notice: null,
	busy: null,
	projects: [],
	sources: [],
	edits: [],
	regions: [],
	exports: [],
	dismiss: () => set({
		notice: null,
		error: null
	}),
	boot: () => {
		if (booting) return booting;
		booting = (async () => {
			try {
				let data = await readLibrary();
				if (!data.projects.length) {
					await seedDemo();
					data = await readLibrary();
				}
				set({
					ready: true,
					...data,
					error: null
				});
			} catch (error) {
				set({
					ready: true,
					error: error instanceof Error ? error.message : "The local library could not be opened."
				});
			}
		})();
		return booting;
	},
	createProject: async (name, description) => {
		const now = Date.now();
		const project = {
			id: crypto.randomUUID(),
			name: name.trim(),
			description: description.trim(),
			status: "draft",
			fps: 8,
			createdAt: now,
			updatedAt: now
		};
		await idbPut("projects", project.id, project);
		set({
			projects: [project, ...get().projects],
			notice: null
		});
		return project.id;
	},
	updateProject: async (id, patch) => {
		const current = get().projects.find((project) => project.id === id);
		if (!current) return;
		const next = {
			...current,
			...patch,
			updatedAt: Date.now()
		};
		if (patch.name !== void 0) next.name = patch.name.trim() || current.name;
		await idbPut("projects", id, next);
		set({ projects: get().projects.map((project) => project.id === id ? next : project) });
	},
	deleteProject: async (id) => {
		const sources = get().sources.filter((source) => source.projectId === id);
		for (const source of sources) await dropSourceMedia(source, get().edits, get().exports);
		for (const region of get().regions) if (region.projectId === id) await idbDel("regions", region.id);
		await idbDel("projects", id);
		set({
			projects: get().projects.filter((project) => project.id !== id),
			sources: get().sources.filter((source) => source.projectId !== id),
			edits: get().edits.filter((edit) => edit.projectId !== id),
			regions: get().regions.filter((region) => region.projectId !== id),
			exports: get().exports.filter((item) => item.projectId !== id)
		});
	},
	restoreDemo: async () => {
		set({ busy: "Restoring the Harbor Night reel…" });
		try {
			if (get().projects.some((project) => project.id === "demo-harbor")) await get().deleteProject(DEMO_PROJECT_ID);
			await seedDemo();
			set({
				...await readLibrary(),
				busy: null,
				notice: "Harbor Night is back in the bay."
			});
		} catch (error) {
			set({
				busy: null,
				error: error instanceof Error ? error.message : "Could not restore the demo."
			});
		}
	},
	importVideo: async (projectId, file, fps) => {
		if (file.size > 83886080) throw new Error("Keep imports under 80 MB.");
		if (!(file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|ogv|m4v)$/i.test(file.name))) throw new Error("Choose a video file.");
		const id = crypto.randomUUID();
		set({
			busy: "Reading the video…",
			error: null
		});
		try {
			const extracted = await extractVideoFrames(file, fps, 48, (done, total) => {
				set({ busy: `Extracting frame ${done} of ${total}` });
			});
			for (let i = 0; i < extracted.frames.length; i++) {
				const blob = extracted.frames[i];
				if (blob) await idbPut("blobs", frameKey(id, i), blob);
			}
			const role = get().sources.some((source) => source.projectId === projectId) ? "compare" : "primary";
			const source = {
				id,
				projectId,
				filename: file.name,
				role,
				fps,
				frameCount: extracted.frames.length,
				durationMs: Math.round(extracted.duration * 1e3),
				width: extracted.width,
				height: extracted.height,
				fileSize: file.size,
				lock: null,
				createdAt: Date.now()
			};
			await idbPut("sources", source.id, source);
			const project = get().projects.find((item) => item.id === projectId);
			if (project && role === "primary") {
				const next = {
					...project,
					fps,
					updatedAt: Date.now()
				};
				await idbPut("projects", project.id, next);
				set({ projects: get().projects.map((item) => item.id === project.id ? next : item) });
			} else if (project) {
				const next = {
					...project,
					updatedAt: Date.now()
				};
				await idbPut("projects", project.id, next);
				set({ projects: get().projects.map((item) => item.id === project.id ? next : item) });
			}
			set({
				sources: [...get().sources, source],
				busy: null,
				notice: `Imported ${extracted.frames.length} frames from ${file.name}.`
			});
			return id;
		} catch (error) {
			for (let i = 0; i < 48; i++) await idbDel("blobs", frameKey(id, i)).catch(() => void 0);
			set({
				busy: null,
				error: error instanceof Error ? error.message : "Import failed."
			});
			throw error;
		}
	},
	deleteSource: async (id) => {
		const source = get().sources.find((item) => item.id === id);
		if (!source) return;
		await dropSourceMedia(source, get().edits, get().exports);
		for (const region of get().regions) if (region.sourceId === id) await idbDel("regions", region.id);
		await idbDel("sources", id);
		set({
			sources: get().sources.filter((item) => item.id !== id),
			edits: get().edits.filter((edit) => edit.sourceId !== id),
			regions: get().regions.filter((region) => region.sourceId !== id),
			exports: get().exports.filter((item) => item.sourceId !== id)
		});
	},
	setLock: async (sourceId, lock) => {
		const source = get().sources.find((item) => item.id === sourceId);
		if (!source) return;
		const next = {
			...source,
			lock
		};
		await idbPut("sources", sourceId, next);
		set({ sources: get().sources.map((item) => item.id === sourceId ? next : item) });
	},
	upsertEdit: async (edit) => {
		const previous = get().edits.find((item) => item.sourceId === edit.sourceId && item.frameIndex === edit.frameIndex && item.kind === edit.kind);
		if (previous && previous.id !== edit.id) {
			if (previous.kind === "replace") await idbDel("blobs", previous.blobKey);
			await idbDel("edits", previous.id);
		}
		if (edit.kind === "replace") {
			if (!await idbGet("blobs", edit.blobKey)) throw new Error("The replacement frame was not stored.");
		}
		await idbPut("edits", edit.id, edit);
		set({ edits: [...get().edits.filter((item) => item.id !== previous?.id && item.id !== edit.id), edit] });
	},
	clearFrame: async (sourceId, frameIndex) => {
		const doomed = get().edits.filter((edit) => edit.sourceId === sourceId && edit.frameIndex === frameIndex);
		for (const edit of doomed) {
			if (edit.kind === "replace") await idbDel("blobs", edit.blobKey);
			await idbDel("edits", edit.id);
		}
		set({ edits: get().edits.filter((edit) => !(edit.sourceId === sourceId && edit.frameIndex === frameIndex)) });
	},
	addRegion: async (region) => {
		await idbPut("regions", region.id, region);
		set({ regions: [...get().regions, region] });
	},
	updateRegion: async (id, patch) => {
		const current = get().regions.find((region) => region.id === id);
		if (!current) return;
		const next = {
			...current,
			...patch
		};
		await idbPut("regions", id, next);
		set({ regions: get().regions.map((region) => region.id === id ? next : region) });
	},
	deleteRegion: async (id) => {
		await idbDel("regions", id);
		set({ regions: get().regions.filter((region) => region.id !== id) });
	},
	saveExport: async (item, blob) => {
		await idbPut("blobs", item.blobKey, blob);
		await idbPut("exports", item.id, item);
		set({
			exports: [item, ...get().exports],
			notice: `Saved ${item.filename}.`
		});
	},
	deleteExport: async (id) => {
		const item = get().exports.find((entry) => entry.id === id);
		if (!item) return;
		await idbDel("blobs", item.blobKey);
		await idbDel("exports", id);
		set({ exports: get().exports.filter((entry) => entry.id !== id) });
	}
}));
function StudioProvider({ children }) {
	const boot = useStudio((state) => state.boot);
	(0, import_react.useEffect)(() => {
		boot();
	}, [boot]);
	return children;
}
var styles_default = "/assets/styles-HB8obggw.css";
var Route$3 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Frame Fusion" },
			{
				name: "theme-color",
				content: "#101317"
			},
			{
				name: "description",
				content: "Local frame studio for extracting, comparing, masking, and locking video frames."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$2 = () => import("./routes-ib0uYwka.mjs");
var Route$2 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./projects._projectId-Cezm54ZV.mjs");
var Route$1 = createFileRoute("/projects/$projectId")({
	validateSearch: (search) => ({
		tool: parseTool(search.tool),
		source: typeof search.source === "string" ? search.source : void 0
	}),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./projects._projectId.settings-BTBQW9tR.mjs");
var Route = createFileRoute("/projects/$projectId/settings")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var IndexRoute = Route$2.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$3
});
var ProjectsProjectIdRoute = Route$1.update({
	id: "/projects/$projectId",
	path: "/projects/$projectId",
	getParentRoute: () => Route$3
});
var ProjectsProjectIdRouteChildren = { ProjectsProjectIdSettingsRoute: Route.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => ProjectsProjectIdRoute
}) };
var rootRouteChildren = {
	IndexRoute,
	ProjectsProjectIdRoute: ProjectsProjectIdRoute._addFileChildren(ProjectsProjectIdRouteChildren)
};
var routeTree = Route$3._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		rewrite: previewPathRewrite(),
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { idbGet as _, activeRegions as a, recordFrames as c, measureDrift as d, renderFrame as f, frameKey as g, TOOLS as h, useStudio as i, similarityScore as l, NEUTRAL_GRADE as m, Route as n, fitContain as o, suggestLock as p, Route$1 as r, loadImage as s, router_exports as t, evenSize as u, idbPut as v };
