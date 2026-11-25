import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/studio/workspace";
import { Route as projectRoute } from "./projects.$projectId";

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectWorkspacePage,
});

function ProjectWorkspacePage() {
  const { projectId } = projectRoute.useParams();
  const { tool, source } = projectRoute.useSearch();
  return <Workspace projectId={projectId} tool={tool} sourceId={source} />;
}
