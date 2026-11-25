import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { getDiagnosticReport, recordDiagnosticError } from "@/lib/diagnostics";
import { FrameExtractor } from "@/lib/native/frame-extractor";
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
  const orphanedNativeMediaIds = useStudio((state) => state.orphanedNativeMediaIds);
  const refreshOrphanedNativeMedia = useStudio((state) => state.refreshOrphanedNativeMedia);
  const cleanupOrphanedNativeMedia = useStudio((state) => state.cleanupOrphanedNativeMedia);
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);
  const [scanningNativeMedia, setScanningNativeMedia] = useState(false);
  const [cleaningNativeMedia, setCleaningNativeMedia] = useState(false);
  const [nativeCleanupArmed, setNativeCleanupArmed] = useState(false);
  const project = projects.find((item) => item.id === projectId);
  const mine = sources.filter((source) => source.projectId === projectId);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "draft");
  const [armed, setArmed] = useState(false);
  const [synced, setSynced] = useState(project?.id ?? "");
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState("");

  async function exportDiagnostics() {
    setExportingDiagnostics(true);
    setDiagnosticsStatus("");
    try {
      const nativeLog = Capacitor.getPlatform() === "android"
        ? (await FrameExtractor.getNativeDiagnostics()).text
        : undefined;
      const report = getDiagnosticReport(nativeLog);
      const filename = "Frame-Fusion-Studio-diagnostics-" +
        new Date().toISOString().replace(/[:.]/g, "-") + ".txt";
      if (Capacitor.getPlatform() === "android") {
        const file = await Filesystem.writeFile({
          path: filename,
          data: report,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: "Frame Fusion Studio diagnostics",
          text: "Import diagnostics from the Android build.",
          url: file.uri,
          dialogTitle: "Share diagnostic log",
        });
      } else {
        const url = window.URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }
      setDiagnosticsStatus("Diagnostic report prepared.");
    } catch (error) {
      recordDiagnosticError("diagnostics.export-failed", error);
      setDiagnosticsStatus(error instanceof Error ? error.message : "Could not export diagnostics.");
    } finally {
      setExportingDiagnostics(false);
    }
  }

  useEffect(() => {
    setIsNativeAndroid(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");
  }, []);

  useEffect(() => {
    if (!isNativeAndroid) return;
    setScanningNativeMedia(true);
    void refreshOrphanedNativeMedia()
      .catch((error) => useStudio.setState({ error: error instanceof Error ? error.message : "Could not inspect native cache." }))
      .finally(() => setScanningNativeMedia(false));
  }, [isNativeAndroid, refreshOrphanedNativeMedia]);

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

        {isNativeAndroid ? (
          <section className="mt-8 space-y-3 rounded-lg border border-line bg-surface p-4">
            <div>
              <h2 className="font-display text-lg">Native media storage</h2>
              <p className="mt-1 text-sm text-muted">
                Inspect app-private indexes, frames, thumbnails and repair files. Only storage IDs not referenced by a saved video source can be removed. Nothing is deleted automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm" role="status">
                {scanningNativeMedia ? "Scanning native storage…" : `${orphanedNativeMediaIds.length} orphaned storage ${orphanedNativeMediaIds.length === 1 ? "entry" : "entries"}`}
              </p>
              <Button tone="line" disabled={scanningNativeMedia || cleaningNativeMedia} onClick={() => {
                setScanningNativeMedia(true);
                void refreshOrphanedNativeMedia()
                  .then(() => setNativeCleanupArmed(false))
                  .catch((error) => useStudio.setState({ error: error instanceof Error ? error.message : "Could not inspect native cache." }))
                  .finally(() => setScanningNativeMedia(false));
              }}>Refresh inventory</Button>
            </div>
            {orphanedNativeMediaIds.length ? (
              <div className="space-y-2">
                <p className="text-xs leading-5 text-muted">These entries are not linked to any current VideoSource. Confirm below to permanently remove the selected orphaned native data. Source files and persisted URI permissions are not changed.</p>
                <Button tone="danger" disabled={cleaningNativeMedia || scanningNativeMedia} onClick={() => {
                  if (!nativeCleanupArmed) {
                    setNativeCleanupArmed(true);
                    return;
                  }
                  setCleaningNativeMedia(true);
                  void cleanupOrphanedNativeMedia()
                    .then((deletedCount) => {
                      setNativeCleanupArmed(false);
                      useStudio.setState({ notice: `Removed ${deletedCount} orphaned native storage ${deletedCount === 1 ? "entry" : "entries"}.` });
                    })
                    .catch((error) => useStudio.setState({ error: error instanceof Error ? error.message : "Could not remove orphaned native media." }))
                    .finally(() => setCleaningNativeMedia(false));
                }}>
                  {cleaningNativeMedia ? "Cleaning…" : nativeCleanupArmed ? `Confirm remove ${orphanedNativeMediaIds.length} entries` : `Remove ${orphanedNativeMediaIds.length} orphaned entries`}
                </Button>
                {nativeCleanupArmed ? <Button tone="quiet" disabled={cleaningNativeMedia} onClick={() => setNativeCleanupArmed(false)}>Keep these files</Button> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-8 space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-amber" aria-hidden="true" />
            <h2 className="font-display text-lg">Diagnostics</h2>
          </div>
          <p className="text-sm text-muted">
            Export saved import steps, errors and native Android exceptions. Video content and private media URIs are excluded.
          </p>
          <Button tone="line" disabled={exportingDiagnostics} onClick={() => void exportDiagnostics()}>
            <FileText className="size-4" aria-hidden="true" />
            {exportingDiagnostics ? "Preparing diagnostic log…" : "Export diagnostic log"}
          </Button>
          {diagnosticsStatus ? <p className="text-xs text-muted" role="status">{diagnosticsStatus}</p> : null}
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
