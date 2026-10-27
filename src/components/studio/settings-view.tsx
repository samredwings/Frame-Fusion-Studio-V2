import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useStudio } from "@/lib/studio/store";
import type { ProjectStatus } from "@/lib/studio/types";
import { Shell } from "@/components/studio/shell";
import { Button, Field, Select, TextArea, TextInput, formatBytes } from "@/components/studio/ui";

export function SettingsView({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const ready = useStudio((state) => state.ready);
  const projects = useStudio((state) => state.projects);
  const sources = useStudio((state) => state.sources);
  const updateProject = useStudio((state) => state.updateProject);
  const deleteProject = useStudio((state) => state.deleteProject);
  const deleteSource = useStudio((state) => state.deleteSource);
  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "draft");
  const [armed, setArmed] = useState(false);
  const [synced, setSynced] = useState(project?.id ?? "");

  if (project && synced !== project.id) {
    setSynced(project.id);
    setName(project.name);
    setDescription(project.description);
    setStatus(project.status);
  }

  if (!ready) {
    return (
      <Shell>
        <p className="m-auto text-sm text-muted">Opening settings…</p>
      </Shell>
    );
  }

  if (!project) {
    return (
      <Shell>
        <div className="m-auto text-center">
          <p className="text-sm text-muted">This project is not in the bay.</p>
          <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-amber">
            Back to projects
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6">
        <Link to="/projects/$projectId" params={{ projectId }} search={{ tool: "frames", source: undefined }} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted">
          <ArrowLeft className="size-4" />
          Back to workspace
        </Link>
        <h1 className="font-display text-3xl font-semibold">Project settings</h1>
        <form
          className="mt-6 space-y-4 rounded-lg border border-line bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void updateProject(project.id, { name, description, status });
          }}
        >
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Notes">
            <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} aria-label="Status" onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
              <option value="draft">Draft</option>
              <option value="cutting">Cutting</option>
              <option value="review">Review</option>
              <option value="delivered">Delivered</option>
            </Select>
          </Field>
          <Button type="submit">Save changes</Button>
        </form>

        <section className="mt-6 space-y-3">
          <h2 className="font-display text-lg">Sources</h2>
          {mine.map((source) => (
            <div key={source.id} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{source.filename}</p>
                <p className="font-mono text-[11px] text-muted">
                  {source.role} · {source.frameCount} frames · {source.width}×{source.height} · {formatBytes(source.fileSize)}
                </p>
              </div>
              <Button tone="ghost" aria-label={`Remove ${source.filename}`} onClick={() => void deleteSource(source.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!mine.length ? <p className="text-sm text-muted">No sources yet.</p> : null}
        </section>

        <section className="mt-8 rounded-lg border border-danger/40 p-4">
          <h2 className="font-display text-lg">Delete project</h2>
          <p className="mt-1 text-sm text-muted">Removes the reel, masks, and renders from this browser.</p>
          <Button
            tone="danger"
            className="mt-3"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              void deleteProject(project.id).then(() => navigate({ to: "/" }));
            }}
          >
            {armed ? "Confirm delete" : "Delete project"}
          </Button>
        </section>
      </div>
    </Shell>
  );
}
