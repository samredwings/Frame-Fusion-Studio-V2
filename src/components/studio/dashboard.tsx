import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Film, Layers, Plus, Scissors, Video } from "lucide-react";
import { frameKey, idbGet } from "@/lib/studio/idb";
import { useStudio } from "@/lib/studio/store";
import type { Project, ProjectStatus } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { Button, Field, TextArea, TextInput } from "@/components/studio/ui";

const statusLabel: Record<ProjectStatus, string> = {
  draft: "Draft",
  cutting: "Cutting",
  review: "Review",
  delivered: "Delivered",
};

function Poster({ sourceId }: { sourceId?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!sourceId) return;
    let dead = false;
    let current: string | null = null;
    void idbGet<Blob>("blobs", frameKey(sourceId, 0)).then((blob) => {
      if (!blob || dead) return;
      current = URL.createObjectURL(blob);
      setUrl(current);
    });
    return () => {
      dead = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [sourceId]);
  if (!url) return <div className="h-full w-full bg-surface-2" />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

function ProjectCard({ project }: { project: Project }) {
  const sources = useStudio((state) => state.sources);
  const edits = useStudio((state) => state.edits);
  const regions = useStudio((state) => state.regions);
  const projectSources = sources.filter((source) => source.projectId === project.id);
  const editCount = edits.filter((edit) => edit.projectId === project.id).length;
  const regionCount = regions.filter((region) => region.projectId === project.id).length;
  const primary = projectSources.find((source) => source.role === "primary") ?? projectSources[0];

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      search={{ tool: "frames", source: primary?.id }}
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:border-amber/70"
    >
      <div className="aspect-video bg-surface-2">
        <Poster sourceId={primary?.id} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold">{project.name}</h2>
            <p className="line-clamp-2 text-sm text-muted">{project.description || "No notes yet."}</p>
          </div>
          <span className="shrink-0 rounded-sm bg-cyan-dim px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan">
            {statusLabel[project.status]}
          </span>
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2 text-xs text-muted">
          <span className="flex items-center gap-1.5 rounded-sm bg-bg px-2 py-2">
            <Video className="size-3.5 text-amber" aria-hidden="true" />
            {projectSources.length}
          </span>
          <span className="flex items-center gap-1.5 rounded-sm bg-bg px-2 py-2">
            <Scissors className="size-3.5 text-cyan" aria-hidden="true" />
            {editCount}
          </span>
          <span className="flex items-center gap-1.5 rounded-sm bg-bg px-2 py-2">
            <Layers className="size-3.5 text-ok" aria-hidden="true" />
            {regionCount}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function Dashboard() {
  const ready = useStudio((state) => state.ready);
  const projects = useStudio((state) => state.projects);
  const createProject = useStudio((state) => state.createProject);
  const restoreDemo = useStudio((state) => state.restoreDemo);
  const busy = useStudio((state) => state.busy);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Name the project first.");
      return;
    }
    const id = await createProject(name, description);
    setOpen(false);
    setName("");
    setDescription("");
    void navigate({ to: "/projects/$projectId", params: { projectId: id }, search: { tool: "frames", source: undefined } });
  }

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber">Local bay</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Projects</h1>
            <p className="mt-2 text-sm text-muted">
              Extract a reel, compare takes, paint masks, and lock a drifting face. Everything stays in this browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="line" onClick={() => void restoreDemo()} disabled={!!busy}>
              <Film className="size-4" aria-hidden="true" />
              Reset demo reel
            </Button>
            <Button onClick={() => setOpen((value) => !value)}>
              <Plus className="size-4" aria-hidden="true" />
              New project
            </Button>
          </div>
        </div>

        {open && (
          <form onSubmit={onCreate} className="mb-6 grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
            <Field label="Project name">
              <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Night market spot" />
            </Field>
            <Field label="Notes">
              <TextArea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this cut is for" />
            </Field>
            {formError ? <p className="text-sm text-danger sm:col-span-2">{formError}</p> : null}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Create and open</Button>
              <Button tone="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!ready ? (
          <div className="rounded-lg border border-dashed border-line px-6 py-16 text-center">
            <p className="font-display text-xl">Restoring the bay…</p>
            <p className="mt-2 text-sm text-muted">Loading projects stored on this device.</p>
          </div>
        ) : projects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line px-6 py-16 text-center">
            <h2 className="font-display text-xl">No reels in the bay</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Start a project or bring Harbor Night back to try the five tools.
            </p>
            <Button className="mt-5" tone="line" onClick={() => setOpen(true)}>
              Create project
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
