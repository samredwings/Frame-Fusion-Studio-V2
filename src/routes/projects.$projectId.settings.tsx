import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/components/studio/settings-view";

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { projectId } = Route.useParams();
  return <SettingsView projectId={projectId} />;
}
