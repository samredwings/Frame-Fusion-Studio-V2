import { S as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { g as Clapperboard } from "../_libs/lucide-react.mjs";
import { i as useStudio } from "./router-_lYV9ozo.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ui-BS4URjh2.js
var import_jsx_runtime = require_jsx_runtime();
function Shell({ children, trail }) {
	const notice = useStudio((state) => state.notice);
	const error = useStudio((state) => state.error);
	const busy = useStudio((state) => state.busy);
	const dismiss = useStudio((state) => state.dismiss);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh flex-col overflow-hidden bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex shrink-0 items-center gap-3 border-b border-line px-3 py-2 sm:px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex min-h-11 items-center gap-2 text-amber",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, {
						className: "size-5",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-sm font-semibold tracking-wide",
						children: "Frame Fusion"
					})]
				}), trail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1",
					children: trail
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" })]
			}),
			(busy || notice || error) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: error ? "alert" : "status",
				className: `flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-sm sm:px-4 ${error ? "border-danger/40 bg-danger/15 text-fg" : "border-line bg-surface text-muted"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate",
					children: busy || error || notice
				}), !busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "min-h-11 shrink-0 px-2 text-fg",
					onClick: dismiss,
					children: "Dismiss"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex min-h-0 flex-1 flex-col",
				children
			})
		]
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatClock(index, fps) {
	const seconds = fps > 0 ? index / fps : 0;
	const minutes = Math.floor(seconds / 60);
	const rest = seconds - minutes * 60;
	return `${String(minutes).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}
function formatBytes(size) {
	if (!size) return "—";
	if (size < 1024) return `${size} B`;
	if (size < 1048576) return `${Math.round(size / 1024)} KB`;
	return `${(size / 1048576).toFixed(1)} MB`;
}
var tones = {
	solid: "bg-amber text-amber-ink hover:brightness-110",
	ghost: "bg-transparent text-fg hover:bg-surface-2",
	line: "border border-line bg-surface text-fg hover:border-amber/70",
	danger: "bg-danger text-danger-ink hover:brightness-110",
	quiet: "bg-surface-2 text-fg hover:bg-line"
};
function Button({ tone = "solid", className, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50", tones[tone], className),
		...props
	});
}
function TextInput(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		...props,
		className: cn("min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-muted", props.className)
	});
}
function TextArea(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		...props,
		className: cn("min-h-24 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg outline-none placeholder:text-muted", props.className)
	});
}
function Select(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		...props,
		className: cn("min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm text-fg", props.className)
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block space-y-1.5 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted",
			children: label
		}), children]
	});
}
function Slider({ label, value, min, max, step = 1, onChange, suffix }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center justify-between text-xs text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "font-mono text-fg",
				children: [value, suffix]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className: "h-11 w-full accent-amber",
			type: "range",
			min,
			max,
			step,
			value,
			"aria-label": label,
			onChange: (event) => onChange(Number(event.target.value))
		})]
	});
}
//#endregion
export { Slider as a, formatBytes as c, Shell as i, formatClock as l, Field as n, TextArea as o, Select as r, TextInput as s, Button as t };
