import { i as __toESM } from "../_runtime.mjs";
import { J as require_react, S as require_jsx_runtime, b as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as SkipForward, d as Play, f as Pause, h as Download, i as Trash2, l as RotateCcw, n as Upload, o as SkipBack, s as Settings2 } from "../_libs/lucide-react.mjs";
import { _ as idbGet, a as activeRegions, c as recordFrames, d as measureDrift, f as renderFrame, g as frameKey, h as TOOLS, i as useStudio, l as similarityScore, m as NEUTRAL_GRADE, o as fitContain, p as suggestLock, r as Route$1, s as loadImage, u as evenSize, v as idbPut } from "./router-_lYV9ozo.mjs";
import { a as Slider, c as formatBytes, i as Shell, l as formatClock, n as Field, r as Select, s as TextInput, t as Button } from "./ui-BS4URjh2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/projects._projectId-Cezm54ZV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Stage({ source, urls, frameIndex, replacementUrl, grade, nudge, regions, guides = [], draft, marked, playing, onSeek, onToggle, onPointer, previewRef }) {
	const canvasRef = (0, import_react.useRef)(null);
	const ratio = source.width / source.height;
	const baseUrl = urls[frameIndex];
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas || !baseUrl) return;
		let cancelled = false;
		canvas.width = source.width;
		canvas.height = source.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		(async () => {
			try {
				const base = await loadImage(baseUrl);
				const replacement = replacementUrl ? await loadImage(replacementUrl) : null;
				if (cancelled) return;
				renderFrame(ctx, base, source.width, source.height, {
					grade,
					replacement,
					nudge,
					regions
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
			} catch {}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		baseUrl,
		replacementUrl,
		grade,
		nudge,
		regions,
		guides,
		draft,
		source.width,
		source.height
	]);
	function pointer(phase, event) {
		if (!onPointer) return;
		const rect = event.currentTarget.getBoundingClientRect();
		onPointer({
			phase,
			x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
			y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 shrink-0 flex-col border-b border-line bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-center px-3 pt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "stage-frame w-full",
					style: { ["--ratio"]: String(ratio) },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
						ref: (node) => {
							canvasRef.current = node;
							if (previewRef) previewRef.current = node;
						},
						className: `block h-auto w-full rounded-md bg-surface ${onPointer ? "touch-none" : ""}`,
						"aria-label": "Frame preview",
						onPointerDown: (event) => {
							if (!onPointer) return;
							event.currentTarget.setPointerCapture(event.pointerId);
							pointer("down", event);
						},
						onPointerMove: (event) => {
							if (event.currentTarget.hasPointerCapture(event.pointerId)) pointer("move", event);
						},
						onPointerUp: (event) => pointer("up", event),
						onPointerCancel: (event) => pointer("up", event)
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "quiet",
						className: "w-11 px-0",
						"aria-label": "Previous frame",
						onClick: () => onSeek(Math.max(0, frameIndex - 1)),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkipBack, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "line",
						className: "w-11 px-0",
						"aria-label": playing ? "Pause" : "Play",
						onClick: onToggle,
						children: playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "quiet",
						className: "w-11 px-0",
						"aria-label": "Next frame",
						onClick: () => onSeek(Math.min(source.frameCount - 1, frameIndex + 1)),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkipForward, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "h-11 min-w-0 flex-1 accent-amber",
						type: "range",
						min: 0,
						max: Math.max(0, source.frameCount - 1),
						value: Math.min(frameIndex, Math.max(0, source.frameCount - 1)),
						"aria-label": "Frame position",
						onChange: (event) => onSeek(Number(event.target.value))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "hidden w-28 shrink-0 text-right font-mono text-xs text-muted sm:block",
						children: [
							formatClock(frameIndex, source.fps),
							" · ",
							frameIndex + 1,
							"/",
							source.frameCount
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-2 overflow-x-auto px-3 pb-3",
				"aria-label": "Filmstrip",
				children: urls.map((url, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `relative h-14 w-20 shrink-0 overflow-hidden rounded-sm border ${index === frameIndex ? "border-amber" : "border-line"}`,
					"aria-label": `Frame ${index + 1}`,
					"aria-current": index === frameIndex,
					onClick: () => onSeek(index),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: url,
						alt: "",
						className: "h-full w-full object-cover"
					}), marked?.[index] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute right-1 top-1 size-1.5 rounded-full bg-amber" }) : null]
				}, `${source.id}-${index}`))
			})
		]
	});
}
function BlurTool({ source, urls, frameIndex, replacements, playing, onSeek, onToggle }) {
	const regions = useStudio((state) => state.regions);
	const edits = useStudio((state) => state.edits);
	const addRegion = useStudio((state) => state.addRegion);
	const updateRegion = useStudio((state) => state.updateRegion);
	const deleteRegion = useStudio((state) => state.deleteRegion);
	const mine = regions.filter((region) => region.sourceId === source.id);
	const visible = activeRegions(regions, source.id, frameIndex);
	const [kind, setKind] = (0, import_react.useState)("blur");
	const [amount, setAmount] = (0, import_react.useState)(64);
	const [label, setLabel] = (0, import_react.useState)("");
	const [draft, setDraft] = (0, import_react.useState)(null);
	const anchor = (0, import_react.useRef)(null);
	const nudge = edits.find((edit) => edit.sourceId === source.id && edit.frameIndex === frameIndex && edit.kind === "nudge");
	const grade = edits.find((edit) => edit.sourceId === source.id && edit.frameIndex === frameIndex && edit.kind === "grade");
	function onPointer(event) {
		if (event.phase === "down") {
			anchor.current = {
				x: event.x,
				y: event.y
			};
			setDraft({
				x: event.x,
				y: event.y,
				w: 0,
				h: 0
			});
			return;
		}
		if (!anchor.current) return;
		const rect = {
			x: Math.min(anchor.current.x, event.x),
			y: Math.min(anchor.current.y, event.y),
			w: Math.abs(event.x - anchor.current.x),
			h: Math.abs(event.y - anchor.current.y)
		};
		if (event.phase === "move") {
			setDraft(rect);
			return;
		}
		anchor.current = null;
		setDraft(null);
		if (rect.w < .03 || rect.h < .03) return;
		addRegion({
			id: crypto.randomUUID(),
			projectId: source.projectId,
			sourceId: source.id,
			label: label.trim() || `${kind === "pixel" ? "Pixel" : kind === "mask" ? "Mask" : "Blur"} ${mine.length + 1}`,
			kind,
			amount,
			...rect,
			frameIn: 0,
			frameOut: source.frameCount - 1
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col lg:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0 lg:flex-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stage, {
				source,
				urls,
				frameIndex,
				replacementUrl: replacements[frameIndex],
				grade: grade && grade.kind === "grade" ? grade.grade : null,
				nudge: nudge && nudge.kind === "nudge" ? {
					dx: nudge.dx,
					dy: nudge.dy
				} : null,
				regions: visible,
				draft,
				playing,
				onSeek,
				onToggle,
				onPointer
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:w-80 lg:flex-none lg:border-l lg:border-line",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold",
					children: "Blur studio"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Drag a box on the picture. Touch, pen, and mouse share the same map."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "New region name",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextInput, {
						value: label,
						placeholder: "Face, plate, sign",
						onChange: (event) => setLabel(event.target.value)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Treatment",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: kind,
						"aria-label": "Treatment",
						onChange: (event) => setKind(event.target.value),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "blur",
								children: "Soft blur"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "pixel",
								children: "Pixelate"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "mask",
								children: "Solid mask"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Strength",
					min: 8,
					max: 100,
					value: amount,
					onChange: setAmount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "space-y-3",
					children: [mine.map((region) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "space-y-2 rounded-md border border-line bg-surface p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-sm",
								children: region.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-h-11 min-w-11 text-muted",
								"aria-label": `Delete ${region.label}`,
								onClick: () => void deleteRegion(region.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mx-auto size-4" })
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "In",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextInput, {
									type: "number",
									min: 0,
									max: region.frameOut,
									value: region.frameIn,
									onChange: (event) => void updateRegion(region.id, { frameIn: Number(event.target.value) })
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Out",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextInput, {
									type: "number",
									min: region.frameIn,
									max: source.frameCount - 1,
									value: region.frameOut,
									onChange: (event) => void updateRegion(region.id, { frameOut: Number(event.target.value) })
								})
							})]
						})]
					}, region.id)), !mine.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted",
						children: "No regions on this take yet."
					}) : null]
				})
			]
		})]
	});
}
function CompareTool({ sources, primary, urls, frameIndex, onSeek }) {
	const others = sources.filter((source) => source.id !== primary.id);
	const [otherId, setOtherId] = (0, import_react.useState)(others[0]?.id ?? "");
	const other = sources.find((source) => source.id === otherId) ?? others[0];
	const [mode, setMode] = (0, import_react.useState)("wipe");
	const [wipe, setWipe] = (0, import_react.useState)(52);
	const [slip, setSlip] = (0, import_react.useState)(0);
	const [score, setScore] = (0, import_react.useState)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const bIndex = Math.min(Math.max(0, frameIndex + slip), Math.max(0, (other?.frameCount ?? 1) - 1));
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		const urlA = urls[frameIndex];
		if (!canvas || !urlA || !other) return;
		let cancelled = false;
		const width = 640;
		const height = 360;
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		(async () => {
			const blob = await idbGet("blobs", frameKey(other.id, bIndex));
			if (!blob || cancelled) return;
			const blobUrl = URL.createObjectURL(blob);
			try {
				const [imageA, imageB] = await Promise.all([loadImage(urlA), loadImage(blobUrl)]);
				if (cancelled) return;
				ctx.fillStyle = "#101317";
				ctx.fillRect(0, 0, width, height);
				if (mode === "split") {
					const left = fitContain(imageA.naturalWidth, imageA.naturalHeight, width / 2, height);
					const right = fitContain(imageB.naturalWidth, imageB.naturalHeight, width / 2, height);
					ctx.drawImage(imageA, left.x, left.y, left.w, left.h);
					ctx.drawImage(imageB, width / 2 + right.x, right.y, right.w, right.h);
					ctx.strokeStyle = "#e4a15a";
					ctx.beginPath();
					ctx.moveTo(width / 2, 0);
					ctx.lineTo(width / 2, height);
					ctx.stroke();
				} else if (mode === "wipe") {
					const box = fitContain(imageA.naturalWidth, imageA.naturalHeight, width, height);
					ctx.drawImage(imageB, box.x, box.y, box.w, box.h);
					ctx.save();
					ctx.beginPath();
					ctx.rect(0, 0, wipe / 100 * width, height);
					ctx.clip();
					ctx.drawImage(imageA, box.x, box.y, box.w, box.h);
					ctx.restore();
					ctx.strokeStyle = "#e4a15a";
					ctx.beginPath();
					ctx.moveTo(wipe / 100 * width, 0);
					ctx.lineTo(wipe / 100 * width, height);
					ctx.stroke();
				} else {
					const box = fitContain(imageA.naturalWidth, imageA.naturalHeight, width, height);
					const scratch = document.createElement("canvas");
					scratch.width = Math.max(1, Math.round(box.w));
					scratch.height = Math.max(1, Math.round(box.h));
					const sctx = scratch.getContext("2d");
					if (!sctx) return;
					sctx.drawImage(imageA, 0, 0, scratch.width, scratch.height);
					const pa = sctx.getImageData(0, 0, scratch.width, scratch.height);
					sctx.drawImage(imageB, 0, 0, scratch.width, scratch.height);
					const pb = sctx.getImageData(0, 0, scratch.width, scratch.height);
					const out = sctx.createImageData(scratch.width, scratch.height);
					for (let i = 0; i < out.data.length; i += 4) {
						const delta = Math.abs((pa.data[i] ?? 0) - (pb.data[i] ?? 0)) + Math.abs((pa.data[i + 1] ?? 0) - (pb.data[i + 1] ?? 0)) + Math.abs((pa.data[i + 2] ?? 0) - (pb.data[i + 2] ?? 0));
						const value = Math.min(255, delta);
						out.data[i] = value;
						out.data[i + 1] = Math.round(value * .72);
						out.data[i + 2] = Math.round(value * .35);
						out.data[i + 3] = 255;
					}
					sctx.putImageData(out, 0, 0);
					ctx.drawImage(scratch, box.x, box.y);
				}
				if (!cancelled) setScore(await similarityScore(imageA, imageB));
			} finally {
				URL.revokeObjectURL(blobUrl);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		urls,
		frameIndex,
		other,
		bIndex,
		mode,
		wipe
	]);
	if (!other) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "m-auto max-w-md px-6 py-16 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-xl",
			children: "Need a second take"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: "Import another video from the bar above to line it up against this one."
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-1 items-center justify-center p-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "aspect-video w-full max-w-3xl rounded-md bg-surface",
				"aria-label": "Comparison preview"
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "space-y-4 border-line p-4 lg:w-80 lg:border-l",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold",
					children: "Multi-compare"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [
						primary.filename,
						" against ",
						other.filename,
						". Match ",
						score === null ? "—" : `${score}%`,
						"."
					]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block space-y-1.5 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: "Second take"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
						value: other.id,
						"aria-label": "Second take",
						onChange: (event) => setOtherId(event.target.value),
						children: others.map((source) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: source.id,
							children: source.filename
						}, source.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						"split",
						"wipe",
						"diff"
					].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: mode === item ? "solid" : "line",
						onClick: () => setMode(item),
						children: item === "split" ? "Split" : item === "wipe" ? "Wipe" : "Difference"
					}, item))
				}),
				mode === "wipe" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Wipe",
					min: 0,
					max: 100,
					value: wipe,
					suffix: "%",
					onChange: setWipe
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Slip B",
					min: -12,
					max: 12,
					value: slip,
					suffix: " f",
					onChange: setSlip
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "quiet",
						onClick: () => onSeek(Math.max(0, frameIndex - 1)),
						children: "Back"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "quiet",
						onClick: () => onSeek(Math.min(primary.frameCount - 1, frameIndex + 1)),
						children: "Forward"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-xs text-muted",
					children: [
						"A f",
						frameIndex,
						" · B f",
						bIndex
					]
				})
			]
		})]
	});
}
function ExportTool({ source, urls, replacements, frameIndex, playing, onSeek, onToggle }) {
	const edits = useStudio((state) => state.edits);
	const regions = useStudio((state) => state.regions);
	const exports = useStudio((state) => state.exports).filter((item) => item.projectId === source.projectId);
	const saveExport = useStudio((state) => state.saveExport);
	const deleteExport = useStudio((state) => state.deleteExport);
	const [quality, setQuality] = (0, import_react.useState)("draft");
	const [progress, setProgress] = (0, import_react.useState)(0);
	const [running, setRunning] = (0, import_react.useState)(false);
	const [message, setMessage] = (0, import_react.useState)("");
	const nudge = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === frameIndex);
	const gradeEdit = edits.find((edit) => edit.sourceId === source.id && edit.kind === "grade" && edit.frameIndex === frameIndex);
	const grade = gradeEdit && gradeEdit.kind === "grade" ? gradeEdit.grade : null;
	async function render() {
		setRunning(true);
		setMessage("");
		setProgress(0);
		try {
			const maxEdge = quality === "draft" ? 480 : quality === "standard" ? 720 : Math.max(source.width, source.height);
			const size = evenSize(source.width, source.height, maxEdge);
			const bases = await Promise.all(urls.map((url) => loadImage(url)));
			const repl = await Promise.all(urls.map(async (_url, index) => replacements[index] ? loadImage(replacements[index]) : null));
			const blob = await recordFrames(bases, repl, size.width, size.height, source.fps, (ctx, index, base, replacement) => {
				const gradeFor = edits.find((edit) => edit.sourceId === source.id && edit.kind === "grade" && edit.frameIndex === index);
				const nudgeFor = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === index);
				const applied = gradeFor && gradeFor.kind === "grade" ? gradeFor.grade : null;
				const off = document.createElement("canvas");
				off.width = source.width;
				off.height = source.height;
				const offCtx = off.getContext("2d");
				if (!offCtx) return;
				renderFrame(offCtx, base, source.width, source.height, {
					grade: applied,
					replacement,
					nudge: nudgeFor && nudgeFor.kind === "nudge" ? {
						dx: nudgeFor.dx,
						dy: nudgeFor.dy
					} : null,
					regions: activeRegions(regions, source.id, index)
				});
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.clearRect(0, 0, size.width, size.height);
				ctx.drawImage(off, 0, 0, size.width, size.height);
			}, (done) => setProgress(done));
			const id = crypto.randomUUID();
			await saveExport({
				id,
				projectId: source.projectId,
				sourceId: source.id,
				filename: `${source.filename.replace(/\.\w+$/, "")}-${quality}.webm`,
				bytes: blob.size,
				width: size.width,
				height: size.height,
				frameCount: urls.length,
				createdAt: Date.now(),
				blobKey: `e:${id}`
			}, blob);
			setMessage("Render is in the bay. Download it anytime.");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Export failed.");
		} finally {
			setRunning(false);
		}
	}
	async function download(id, filename, blobKey) {
		const blob = await idbGet("blobs", blobKey);
		if (!blob) {
			setMessage("That export file is missing. Render it again.");
			return;
		}
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1500);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col lg:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0 lg:flex-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stage, {
				source,
				urls,
				frameIndex,
				replacementUrl: replacements[frameIndex],
				grade,
				nudge: nudge && nudge.kind === "nudge" ? {
					dx: nudge.dx,
					dy: nudge.dy
				} : null,
				regions: activeRegions(regions, source.id, frameIndex),
				playing,
				onSeek,
				onToggle
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:w-80 lg:flex-none lg:border-l lg:border-line",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold",
					children: "Exports"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Burns in grades, replacements, blur regions, and face nudges for this take."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-3 gap-2",
					children: [
						["draft", "Draft"],
						["standard", "720"],
						["full", "Full"]
					].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: quality === id ? "solid" : "line",
						onClick: () => setQuality(id),
						children: label
					}, id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => void render(),
					disabled: running || !urls.length,
					children: running ? `Rendering ${progress}/${urls.length}` : "Render WebM"
				}),
				running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-1 overflow-hidden rounded-full bg-surface-2",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full bg-amber",
						style: { width: `${urls.length ? progress / urls.length * 100 : 0}%` }
					})
				}) : null,
				message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: message
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "space-y-2",
					children: [exports.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm",
									children: item.filename
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-[11px] text-muted",
									children: [
										item.width,
										"×",
										item.height,
										" · ",
										formatBytes(item.bytes)
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-h-11 min-w-11",
								"aria-label": `Download ${item.filename}`,
								onClick: () => void download(item.id, item.filename, item.blobKey),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mx-auto size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-h-11 min-w-11",
								"aria-label": `Delete ${item.filename}`,
								onClick: () => void deleteExport(item.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mx-auto size-4" })
							})
						]
					}, item.id)), !exports.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted",
						children: "No renders saved yet."
					}) : null]
				})
			]
		})]
	});
}
function FaceTool({ source, urls, frameIndex, replacements, playing, onSeek, onToggle }) {
	const edits = useStudio((state) => state.edits);
	const setLock = useStudio((state) => state.setLock);
	const upsertEdit = useStudio((state) => state.upsertEdit);
	const [drift, setDrift] = (0, import_react.useState)([]);
	const [threshold, setThreshold] = (0, import_react.useState)(22);
	const [status, setStatus] = (0, import_react.useState)("");
	const nudge = edits.find((edit) => edit.sourceId === source.id && edit.kind === "nudge" && edit.frameIndex === frameIndex);
	const point = drift.find((item) => item.index === frameIndex);
	const guides = [];
	if (source.lock) guides.push({
		x: source.lock.x * source.width,
		y: source.lock.y * source.height,
		w: source.lock.w * source.width,
		h: source.lock.h * source.height,
		tone: "amber",
		label: "Lock"
	});
	if (point && source.lock) {
		const shiftX = nudge && nudge.kind === "nudge" ? nudge.dx : 0;
		const shiftY = nudge && nudge.kind === "nudge" ? nudge.dy : 0;
		guides.push({
			x: point.cx - source.lock.w * source.width / 2 + shiftX,
			y: point.cy - source.lock.h * source.height / 2 + shiftY,
			w: source.lock.w * source.width,
			h: source.lock.h * source.height,
			tone: "cyan",
			label: `Drift ${point.score}`
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
				dy: Math.round(refCy - item.cy)
			});
		}
		setStatus(count ? `Pinned ${count} frames back to the lock. Export will burn that in.` : "Nothing crossed the drift line.");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col lg:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0 lg:flex-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stage, {
				source,
				urls,
				frameIndex,
				replacementUrl: replacements[frameIndex],
				grade: null,
				nudge: nudge && nudge.kind === "nudge" ? {
					dx: nudge.dx,
					dy: nudge.dy
				} : null,
				regions: [],
				guides,
				playing,
				onSeek,
				onToggle
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:w-80 lg:flex-none lg:border-l lg:border-line",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold",
					children: "FaceSync"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Lock a face, measure how far it wanders, then nudge those frames back. No cloud model — the match runs here."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void autoFind(),
							children: "Auto-lock"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							tone: "line",
							onClick: () => void track(),
							disabled: !source.lock,
							children: "Track reel"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							tone: "line",
							onClick: () => void stabilize(),
							disabled: !drift.length,
							children: "Stabilize"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Drift line",
					min: 5,
					max: 80,
					value: threshold,
					onChange: setThreshold
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: status || (source.lock ? "Lock is saved on this take." : "No lock yet.")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs text-cyan",
					children: drift.length ? `${drifted} flagged · this frame ${point?.score ?? "—"}` : "Not tracked"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "max-h-64 space-y-1 overflow-y-auto",
					"aria-label": "Drift by frame",
					children: drift.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-11 w-full items-center gap-2 rounded-sm px-1 text-left text-xs",
						onClick: () => onSeek(item.index),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-8 font-mono text-muted",
								children: item.index
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `block h-full ${item.score >= threshold ? "bg-amber" : "bg-cyan"}`,
									style: { width: `${item.score}%` }
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-8 text-right font-mono",
								children: item.score
							})
						]
					}) }, item.index))
				})
			]
		})]
	});
}
function useBaseFrames(source) {
	const [urls, setUrls] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const frameCount = source?.frameCount ?? 0;
	const sourceId = source?.id;
	(0, import_react.useEffect)(() => {
		if (!sourceId || !frameCount) {
			setUrls([]);
			return;
		}
		let cancelled = false;
		const created = [];
		setLoading(true);
		(async () => {
			const next = [];
			for (let index = 0; index < frameCount; index++) {
				const blob = await idbGet("blobs", frameKey(sourceId, index));
				if (!blob) continue;
				const url = URL.createObjectURL(blob);
				created.push(url);
				next.push(url);
			}
			if (cancelled) {
				created.forEach((url) => URL.revokeObjectURL(url));
				return;
			}
			setUrls(next);
			setLoading(false);
		})();
		return () => {
			cancelled = true;
			created.forEach((url) => URL.revokeObjectURL(url));
		};
	}, [sourceId, frameCount]);
	return {
		urls,
		loading
	};
}
function useReplacements(sourceId, edits) {
	const [urls, setUrls] = (0, import_react.useState)({});
	const editsRef = (0, import_react.useRef)(edits);
	editsRef.current = edits;
	const signature = edits.filter((edit) => edit.sourceId === sourceId && edit.kind === "replace").map((edit) => edit.kind === "replace" ? `${edit.frameIndex}:${edit.blobKey}` : "").join("|");
	(0, import_react.useEffect)(() => {
		if (!sourceId) {
			setUrls({});
			return;
		}
		let cancelled = false;
		const created = [];
		const snapshot = editsRef.current;
		(async () => {
			const next = {};
			for (const edit of snapshot) {
				if (edit.sourceId !== sourceId || edit.kind !== "replace") continue;
				const blob = await idbGet("blobs", edit.blobKey);
				if (!blob) continue;
				const url = URL.createObjectURL(blob);
				created.push(url);
				next[edit.frameIndex] = url;
			}
			if (cancelled) {
				created.forEach((url) => URL.revokeObjectURL(url));
				return;
			}
			setUrls(next);
		})();
		return () => {
			cancelled = true;
			created.forEach((url) => URL.revokeObjectURL(url));
		};
	}, [sourceId, signature]);
	return urls;
}
function FrameTool({ source, urls, frameIndex, playing, onSeek, onToggle, previewRef }) {
	const allEdits = useStudio((state) => state.edits);
	const edits = allEdits.filter((edit) => edit.sourceId === source.id);
	const replacements = useReplacements(source.id, allEdits);
	const upsertEdit = useStudio((state) => state.upsertEdit);
	const clearFrame = useStudio((state) => state.clearFrame);
	const gradeEdit = edits.find((edit) => edit.kind === "grade" && edit.frameIndex === frameIndex);
	const savedGrade = gradeEdit && gradeEdit.kind === "grade" ? gradeEdit.grade : NEUTRAL_GRADE;
	const savedKey = JSON.stringify(savedGrade);
	const [grade, setGrade] = (0, import_react.useState)(savedGrade);
	const replace = edits.find((edit) => edit.kind === "replace" && edit.frameIndex === frameIndex);
	const nudge = edits.find((edit) => edit.kind === "nudge" && edit.frameIndex === frameIndex);
	(0, import_react.useEffect)(() => {
		setGrade(JSON.parse(savedKey));
	}, [savedKey, frameIndex]);
	const marked = (0, import_react.useMemo)(() => {
		const flags = Array.from({ length: source.frameCount }, () => false);
		for (const edit of edits) flags[edit.frameIndex] = true;
		return flags;
	}, [edits, source.frameCount]);
	async function bake() {
		await upsertEdit({
			id: crypto.randomUUID(),
			projectId: source.projectId,
			sourceId: source.id,
			frameIndex,
			kind: "grade",
			grade
		});
	}
	async function onReplace(file) {
		const id = crypto.randomUUID();
		const blobKey = `r:${id}`;
		await idbPut("blobs", blobKey, file);
		await upsertEdit({
			id,
			projectId: source.projectId,
			sourceId: source.id,
			frameIndex,
			kind: "replace",
			blobKey
		});
	}
	function downloadStill() {
		const canvas = previewRef.current;
		if (!canvas) return;
		canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${source.filename.replace(/\.\w+$/, "")}-f${String(frameIndex).padStart(3, "0")}.png`;
			link.click();
			URL.revokeObjectURL(url);
		}, "image/png");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col lg:flex-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0 lg:flex-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stage, {
				source,
				urls,
				frameIndex,
				replacementUrl: replacements[frameIndex],
				grade,
				nudge: nudge && nudge.kind === "nudge" ? {
					dx: nudge.dx,
					dy: nudge.dy
				} : null,
				regions: [],
				marked,
				playing,
				onSeek,
				onToggle,
				previewRef
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "min-h-0 flex-1 space-y-4 overflow-y-auto border-line p-4 lg:w-80 lg:flex-none lg:border-l",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold",
					children: "Frame editor"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Grade the current frame, drop in a replacement still, or pull the PNG."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Exposure",
					min: 40,
					max: 160,
					value: grade.brightness,
					suffix: "%",
					onChange: (brightness) => setGrade({
						...grade,
						brightness
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Contrast",
					min: 40,
					max: 180,
					value: grade.contrast,
					suffix: "%",
					onChange: (contrast) => setGrade({
						...grade,
						contrast
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Saturation",
					min: 0,
					max: 180,
					value: grade.saturate,
					suffix: "%",
					onChange: (saturate) => setGrade({
						...grade,
						saturate
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
					label: "Warmth",
					min: -80,
					max: 80,
					value: grade.warmth,
					onChange: (warmth) => setGrade({
						...grade,
						warmth
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => void bake(),
						children: "Bake grade"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "line",
						onClick: () => setGrade(NEUTRAL_GRADE),
						children: "Reset sliders"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-dashed border-line px-3 text-sm text-muted hover:border-amber",
					children: ["Replace this frame with an image", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sr-only",
						type: "file",
						accept: "image/*",
						onChange: (event) => {
							const file = event.target.files?.[0];
							if (file) onReplace(file);
							event.currentTarget.value = "";
						}
					})]
				}),
				replace ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-cyan",
					children: "A replacement still is baked on this frame and used by export."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						tone: "quiet",
						onClick: downloadStill,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "Download PNG"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						tone: "ghost",
						onClick: () => void clearFrame(source.id, frameIndex),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), "Clear frame edits"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-xs text-muted",
					children: [
						source.width,
						"×",
						source.height,
						" · ",
						source.fps,
						" fps · arrows step · space plays"
					]
				})
			]
		})]
	});
}
function Workspace({ projectId, tool, sourceId }) {
	const navigate = useNavigate();
	const ready = useStudio((state) => state.ready);
	const projects = useStudio((state) => state.projects);
	const sources = useStudio((state) => state.sources);
	const edits = useStudio((state) => state.edits);
	const importVideo = useStudio((state) => state.importVideo);
	const project = projects.find((item) => item.id === projectId);
	const mine = sources.filter((source) => source.projectId === projectId);
	const source = mine.find((item) => item.id === sourceId) ?? mine.find((item) => item.role === "primary") ?? mine[0];
	const { urls, loading } = useBaseFrames(source);
	const replacements = useReplacements(source?.id, edits);
	const [frameIndex, setFrameIndex] = (0, import_react.useState)(0);
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [fps, setFps] = (0, import_react.useState)(8);
	const previewRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!ready || !source || source.id === sourceId) return;
		navigate({
			to: "/projects/$projectId",
			params: { projectId },
			search: {
				tool,
				source: source.id
			},
			replace: true
		});
	}, [
		ready,
		source,
		sourceId,
		tool,
		projectId,
		navigate
	]);
	(0, import_react.useEffect)(() => {
		setFrameIndex(0);
		setPlaying(false);
	}, [source?.id]);
	(0, import_react.useEffect)(() => {
		if (!playing || !source?.frameCount) return;
		const timer = window.setInterval(() => {
			setFrameIndex((current) => (current + 1) % source.frameCount);
		}, 1e3 / Math.max(1, source.fps));
		return () => window.clearInterval(timer);
	}, [playing, source]);
	(0, import_react.useEffect)(() => {
		function onKey(event) {
			const target = event.target;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
			if (!source) return;
			if (event.key === "ArrowRight") {
				event.preventDefault();
				setPlaying(false);
				setFrameIndex((current) => Math.min(source.frameCount - 1, current + 1));
			} else if (event.key === "ArrowLeft") {
				event.preventDefault();
				setPlaying(false);
				setFrameIndex((current) => Math.max(0, current - 1));
			} else if (event.key === " ") {
				event.preventDefault();
				setPlaying((value) => !value);
			} else if (event.key >= "1" && event.key <= "5") {
				const next = TOOLS[Number(event.key) - 1];
				if (next) navigate({
					to: "/projects/$projectId",
					params: { projectId },
					search: {
						tool: next.id,
						source: source.id
					}
				});
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		source,
		navigate,
		projectId
	]);
	function openTool(next) {
		navigate({
			to: "/projects/$projectId",
			params: { projectId },
			search: {
				tool: next,
				source: source?.id
			}
		});
	}
	async function onFile(file) {
		if (!project) return;
		try {
			const id = await importVideo(project.id, file, fps);
			setFrameIndex(0);
			navigate({
				to: "/projects/$projectId",
				params: { projectId },
				search: {
					tool,
					source: id
				}
			});
		} catch {}
	}
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "m-auto text-sm text-muted",
		children: "Opening the workspace…"
	}) });
	if (!project) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "m-auto max-w-md px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Project unavailable"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "It is not in this browser’s bay."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-3 text-sm",
				children: "Back to projects"
			})
		]
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		trail: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-end gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "truncate font-display text-sm sm:text-base",
				children: project.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/projects/$projectId/settings",
				params: { projectId },
				search: {
					tool,
					source: source?.id
				},
				"aria-label": "Project settings",
				className: "inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "size-4" })
			})]
		}),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex shrink-0 flex-col gap-2 border-b border-line px-3 py-2 sm:px-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "sr-only",
							htmlFor: "workspace-source",
							children: "Selected source"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							id: "workspace-source",
							className: "w-auto min-w-0 flex-1 sm:max-w-xs",
							value: source?.id ?? "",
							onChange: (event) => {
								const next = event.target.value;
								if (!next) return;
								navigate({
									to: "/projects/$projectId",
									params: { projectId },
									search: {
										tool,
										source: next
									}
								});
							},
							"aria-label": "Selected source",
							children: [!mine.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "No source yet"
							}) : null, mine.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: item.id,
								children: item.filename
							}, item.id))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
							className: "w-24",
							"aria-label": "Extract frame rate",
							value: fps,
							onChange: (event) => setFps(Number(event.target.value)),
							children: [
								4,
								8,
								12,
								24
							].map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value,
								children: [value, " fps"]
							}, value))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: fileRef,
							className: "sr-only",
							type: "file",
							accept: "video/*",
							onChange: (event) => {
								const file = event.target.files?.[0];
								if (file) onFile(file);
								event.currentTarget.value = "";
							}
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							tone: "line",
							className: "shrink-0",
							onClick: () => fileRef.current?.click(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), "Import"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "hidden gap-1 sm:flex",
					role: "tablist",
					"aria-label": "Project tools",
					children: TOOLS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": tool === item.id,
						className: `min-h-11 border-b-2 px-3 text-sm ${tool === item.id ? "border-amber text-fg" : "border-transparent text-muted"}`,
						onClick: () => openTool(item.id),
						children: item.label
					}, item.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "sm:hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "sr-only",
						children: "Active tool"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
						value: tool,
						"aria-label": "Active tool",
						onChange: (event) => openTool(event.target.value),
						children: TOOLS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: item.id,
							children: item.label
						}, item.id))
					})]
				})
			]
		}), !source ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "m-auto max-w-md px-6 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Import a video to start cutting"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Frames are extracted in the browser and kept with this project. Cap is 48 frames."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "mt-5",
					onClick: () => fileRef.current?.click(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), "Import video"]
				})
			]
		}) : loading || !urls.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "m-auto text-sm text-muted",
			children: "Pulling frames…"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col",
			children: [
				tool === "frames" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FrameTool, {
					source,
					urls,
					frameIndex: Math.min(frameIndex, urls.length - 1),
					playing,
					onSeek: setFrameIndex,
					onToggle: () => setPlaying((value) => !value),
					previewRef
				}) : null,
				tool === "compare" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareTool, {
					sources: mine,
					primary: source,
					urls,
					frameIndex: Math.min(frameIndex, urls.length - 1),
					onSeek: setFrameIndex
				}) : null,
				tool === "blur" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlurTool, {
					source,
					urls,
					replacements,
					frameIndex: Math.min(frameIndex, urls.length - 1),
					playing,
					onSeek: setFrameIndex,
					onToggle: () => setPlaying((value) => !value)
				}) : null,
				tool === "faces" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FaceTool, {
					source,
					urls,
					replacements,
					frameIndex: Math.min(frameIndex, urls.length - 1),
					playing,
					onSeek: setFrameIndex,
					onToggle: () => setPlaying((value) => !value)
				}) : null,
				tool === "export" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportTool, {
					source,
					urls,
					replacements,
					frameIndex: Math.min(frameIndex, urls.length - 1),
					playing,
					onSeek: setFrameIndex,
					onToggle: () => setPlaying((value) => !value)
				}) : null
			]
		})]
	});
}
function ProjectPage() {
	const { projectId } = Route$1.useParams();
	const { tool, source } = Route$1.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workspace, {
		projectId,
		tool,
		sourceId: source
	});
}
//#endregion
export { ProjectPage as component };
