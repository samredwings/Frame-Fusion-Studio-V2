import { i as __toESM } from "../_runtime.mjs";
import { J as require_react, S as require_jsx_runtime, b as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as Scissors, m as Film, p as Layers, t as Video, u as Plus } from "../_libs/lucide-react.mjs";
import { _ as idbGet, g as frameKey, i as useStudio } from "./router-_lYV9ozo.mjs";
import { i as Shell, n as Field, o as TextArea, s as TextInput, t as Button } from "./ui-BS4URjh2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-ib0uYwka.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var statusLabel = {
	draft: "Draft",
	cutting: "Cutting",
	review: "Review",
	delivered: "Delivered"
};
function Poster({ sourceId }) {
	const [url, setUrl] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!sourceId) return;
		let dead = false;
		let current = null;
		idbGet("blobs", frameKey(sourceId, 0)).then((blob) => {
			if (!blob || dead) return;
			current = URL.createObjectURL(blob);
			setUrl(current);
		});
		return () => {
			dead = true;
			if (current) URL.revokeObjectURL(current);
		};
	}, [sourceId]);
	if (!url) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full w-full bg-surface-2" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
		src: url,
		alt: "",
		className: "h-full w-full object-cover"
	});
}
function ProjectCard({ project }) {
	const sources = useStudio((state) => state.sources);
	const edits = useStudio((state) => state.edits);
	const regions = useStudio((state) => state.regions);
	const projectSources = sources.filter((source) => source.projectId === project.id);
	const editCount = edits.filter((edit) => edit.projectId === project.id).length;
	const regionCount = regions.filter((region) => region.projectId === project.id).length;
	const primary = projectSources.find((source) => source.role === "primary") ?? projectSources[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/projects/$projectId",
		params: { projectId: project.id },
		search: {
			tool: "frames",
			source: primary?.id
		},
		className: "flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:border-amber/70",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "aspect-video bg-surface-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Poster, { sourceId: primary?.id })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-1 flex-col gap-3 p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "truncate font-display text-lg font-semibold",
						children: project.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "line-clamp-2 text-sm text-muted",
						children: project.description || "No notes yet."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 rounded-sm bg-cyan-dim px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan",
					children: statusLabel[project.status]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-auto grid grid-cols-3 gap-2 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1.5 rounded-sm bg-bg px-2 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, {
							className: "size-3.5 text-amber",
							"aria-hidden": "true"
						}), projectSources.length]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1.5 rounded-sm bg-bg px-2 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scissors, {
							className: "size-3.5 text-cyan",
							"aria-hidden": "true"
						}), editCount]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1.5 rounded-sm bg-bg px-2 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, {
							className: "size-3.5 text-ok",
							"aria-hidden": "true"
						}), regionCount]
					})
				]
			})]
		})]
	});
}
function Dashboard() {
	const ready = useStudio((state) => state.ready);
	const projects = useStudio((state) => state.projects);
	const createProject = useStudio((state) => state.createProject);
	const restoreDemo = useStudio((state) => state.restoreDemo);
	const busy = useStudio((state) => state.busy);
	const navigate = useNavigate();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [formError, setFormError] = (0, import_react.useState)("");
	async function onCreate(event) {
		event.preventDefault();
		if (!name.trim()) {
			setFormError("Name the project first.");
			return;
		}
		const id = await createProject(name, description);
		setOpen(false);
		setName("");
		setDescription("");
		navigate({
			to: "/projects/$projectId",
			params: { projectId: id },
			search: {
				tool: "frames",
				source: void 0
			}
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs uppercase tracking-[0.18em] text-amber",
							children: "Local bay"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl",
							children: "Projects"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted",
							children: "Extract a reel, compare takes, paint masks, and lock a drifting face. Everything stays in this browser."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						tone: "line",
						onClick: () => void restoreDemo(),
						disabled: !!busy,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Reset demo reel"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setOpen((value) => !value),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
							className: "size-4",
							"aria-hidden": "true"
						}), "New project"]
					})]
				})]
			}),
			open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: onCreate,
				className: "mb-6 grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Project name",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextInput, {
							value: name,
							onChange: (event) => setName(event.target.value),
							placeholder: "Night market spot"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Notes",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextArea, {
							value: description,
							onChange: (event) => setDescription(event.target.value),
							placeholder: "What this cut is for"
						})
					}),
					formError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger sm:col-span-2",
						children: formError
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2 sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							children: "Create and open"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							tone: "ghost",
							onClick: () => setOpen(false),
							children: "Cancel"
						})]
					})
				]
			}),
			!ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-dashed border-line px-6 py-16 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xl",
					children: "Restoring the bay…"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Loading projects stored on this device."
				})]
			}) : projects.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
				children: projects.map((project) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectCard, { project }, project.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-dashed border-line px-6 py-16 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "No reels in the bay"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-2 max-w-sm text-sm text-muted",
						children: "Start a project or bring Harbor Night back to try the five tools."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-5",
						tone: "line",
						onClick: () => setOpen(true),
						children: "Create project"
					})
				]
			})
		]
	}) });
}
var SplitComponent = Dashboard;
//#endregion
export { SplitComponent as component };
