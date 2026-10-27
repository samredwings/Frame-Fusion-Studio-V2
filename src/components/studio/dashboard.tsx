import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Film, HardDrive, Layers, Plus, Scissors, Video } from "lucide-react";
import { frameKey, idbGet } from "@/lib/studio/idb";
import { useStudio } from "@/lib/studio/store";
import type { Project, ProjectStatus } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { Button, Field, TextArea, TextInput } from "@/components/studio/ui";

const statusLabel: Record<ProjectStatus, string> = {
  draft: "Draft",
  cutting: "In progress",
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

  if (!url) {
    return (
      <div className="grid h-full w-full place-items-center bg-surface-2 text-muted">
        <Film className="size-6" aria-hidden="true" />
      </div>
    );
  }
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
      className="project-row group grid items-center gap-3 py-3.5 sm:gap-5 sm:py-4"
    >
      <div className="project-poster relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
        <Poster sourceId={primary?.id} />
        <span className="absolute left-2 top-2 rounded-full bg-bg/85 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-fg backdrop-blur-sm">
          {projectSources.length ? `${projectSources.length} take${projectSources.length === 1 ? "" : "s"}` : "Empty reel"}
        </span>
      </div>
      <div className="min-w-0 self-center">
        <div className="mb-1 flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${project.status === "delivered" ? "bg-ok" : "bg-amber"}`} aria-hidden="true" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted">{statusLabel[project.status]}</span>
        </div>
        <h2 className="truncate font-display text-base font-semibold tracking-tight text-fg sm:text-lg">{project.name}</h2>
        <p className="mt-1 hidden max-w-xl truncate text-sm text-muted sm:block">{project.description || "Open the reel to continue reviewing frames."}</p>
        <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] text-muted sm:mt-2 sm:text-[11px]">
          <span className="inline-flex items-center gap-1.5"><Scissors className="size-3 text-amber" aria-hidden="true" />{editCount} edits</span>
          <span className="inline-flex items-center gap-1.5"><Layers className="size-3 text-cyan" aria-hidden="true" />{regionCount} regions</span>
        </div>
      </div>
      <span className="hidden size-10 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-150 group-hover:translate-x-0.5 group-hover:bg-surface-2 group-hover:text-fg sm:grid" aria-hidden="true">
        <ArrowUpRight className="size-4" />
      </span>
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
      setFormError("Add a project name to continue.");
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 pb-8 pt-5 sm:px-8 sm:pt-9">
        <section className="dashboard-hero">
          <div className="min-w-0">
            <p className="studio-kicker">FRAME FUSION <span className="text-line">/</span> LOCAL STUDIO</p>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Frame Atlas</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
              Find the frame. Compare the take. Make the correction. Your footage stays on this device.
            </p>
          </div>
          <div className="mt-5 flex shrink-0 flex-wrap gap-2 sm:mt-0 sm:justify-end">
            <Button onClick={() => { setOpen((value) => !value); setFormError(""); }}>
              <Plus className="size-4" aria-hidden="true" />
              New project
            </Button>
            <Button tone="line" onClick={() => void restoreDemo()} disabled={!!busy}>
              <Film className="size-4" aria-hidden="true" />
              Restore sample
            </Button>
          </div>
        </section>

        <div className="my-5 flex items-center gap-2.5 border-y border-line/70 py-3 text-xs text-muted sm:my-7">
          <HardDrive className="size-4 shrink-0 text-cyan" aria-hidden="true" />
          <span className="min-w-0">Private library <span className="text-line">·</span> projects, frame edits, and exports are stored locally</span>
        </div>

        {open ? (
          <form onSubmit={onCreate} className="studio-panel mb-6 rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="studio-kicker">NEW REEL</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Start a project</h2>
              </div>
              <button type="button" className="min-h-11 rounded-full px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project name">
                <TextInput autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Night market spot" />
              </Field>
              <Field label="Notes">
                <TextArea className="min-h-11" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you reviewing?" />
              </Field>
            </div>
            {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}
            <div className="mt-4 flex justify-end">
              <Button type="submit">Create and open</Button>
            </div>
          </form>
        ) : null}

        <section aria-labelledby="recent-projects-title" className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex items-end justify-between gap-3">
            <div>
              <p className="studio-kicker">ON THIS DEVICE</p>
              <h2 id="recent-projects-title" className="mt-1 font-display text-xl font-semibold tracking-tight">Recent projects</h2>
            </div>
            {ready && projects.length ? <span className="pb-1 font-mono text-[10px] uppercase tracking-wider text-muted">{String(projects.length).padStart(2, "0")} reels</span> : null}
          </div>

          {!ready ? (
            <div className="py-12 text-sm text-muted" role="status">Opening your local library…</div>
          ) : projects.length ? (
            <div className="project-list divide-y divide-line/70">
              {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          ) : (
            <div className="studio-panel empty-library mt-4 rounded-2xl px-5 py-10 text-center sm:py-14">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-amber"><Video className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-display text-lg font-semibold">Your first reel starts here</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">Create a project, then import a clip to build a private frame library on this device.</p>
              <Button className="mt-5" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden="true" />Create project</Button>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
