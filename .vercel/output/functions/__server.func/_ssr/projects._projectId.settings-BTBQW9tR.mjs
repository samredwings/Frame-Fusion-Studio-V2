import { i as __toESM } from "../_runtime.mjs";
import { J as require_react, S as require_jsx_runtime, b as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as ArrowLeft, i as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useStudio, n as Route } from "./router-_lYV9ozo.mjs";
import { c as formatBytes, i as Shell, n as Field, o as TextArea, r as Select, s as TextInput, t as Button } from "./ui-BS4URjh2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/projects._projectId.settings-BTBQW9tR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsView({ projectId }) {
	const navigate = useNavigate();
	const ready = useStudio((state) => state.ready);
	const projects = useStudio((state) => state.projects);
	const sources = useStudio((state) => state.sources);
	const updateProject = useStudio((state) => state.updateProject);
	const deleteProject = useStudio((state) => state.deleteProject);
	const deleteSource = useStudio((state) => state.deleteSource);
	const project = projects.find((item) => item.id === projectId);
	const mine = sources.filter((source) => source.projectId === projectId);
	const [name, setName] = (0, import_react.useState)(project?.name ?? "");
	const [description, setDescription] = (0, import_react.useState)(project?.description ?? "");
	const [status, setStatus] = (0, import_react.useState)(project?.status ?? "draft");
	const [armed, setArmed] = (0, import_react.useState)(false);
	const [synced, setSynced] = (0, import_react.useState)(project?.id ?? "");
	if (project && synced !== project.id) {
		setSynced(project.id);
		setName(project.name);
		setDescription(project.description);
		setStatus(project.status);
	}
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "m-auto text-sm text-muted",
		children: "Opening settings…"
	}) });
	if (!project) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "m-auto text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "This project is not in the bay."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/",
			className: "mt-4 inline-flex min-h-11 items-center text-amber",
			children: "Back to projects"
		})]
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/projects/$projectId",
				params: { projectId },
				search: {
					tool: "frames",
					source: void 0
				},
				className: "mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Back to workspace"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-semibold",
				children: "Project settings"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-6 space-y-4 rounded-lg border border-line bg-surface p-4",
				onSubmit: (event) => {
					event.preventDefault();
					updateProject(project.id, {
						name,
						description,
						status
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Name",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextInput, {
							value: name,
							onChange: (event) => setName(event.target.value)
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Notes",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextArea, {
							value: description,
							onChange: (event) => setDescription(event.target.value)
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Status",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: status,
							"aria-label": "Status",
							onChange: (event) => setStatus(event.target.value),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "draft",
									children: "Draft"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "cutting",
									children: "Cutting"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "review",
									children: "Review"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "delivered",
									children: "Delivered"
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						children: "Save changes"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6 space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg",
						children: "Sources"
					}),
					mine.map((source) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm",
								children: source.filename
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-[11px] text-muted",
								children: [
									source.role,
									" · ",
									source.frameCount,
									" frames · ",
									source.width,
									"×",
									source.height,
									" · ",
									formatBytes(source.fileSize)
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							tone: "ghost",
							"aria-label": `Remove ${source.filename}`,
							onClick: () => void deleteSource(source.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
						})]
					}, source.id)),
					!mine.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No sources yet."
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8 rounded-lg border border-danger/40 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg",
						children: "Delete project"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Removes the reel, masks, and renders from this browser."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						tone: "danger",
						className: "mt-3",
						onClick: () => {
							if (!armed) {
								setArmed(true);
								return;
							}
							deleteProject(project.id).then(() => navigate({ to: "/" }));
						},
						children: armed ? "Confirm delete" : "Delete project"
					})
				]
			})
		]
	}) });
}
function SettingsPage() {
	const { projectId } = Route.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsView, { projectId });
}
//#endregion
export { SettingsPage as component };
