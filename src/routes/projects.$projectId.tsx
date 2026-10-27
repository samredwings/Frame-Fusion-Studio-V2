import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/studio/workspace";
import { parseTool } from "@/lib/studio/types";

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tool: parseTool(search.tool),
    source: typeof search.source === "string" ? search.source : undefined,
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { tool, source } = Route.useSearch();
  return <Workspace projectId={projectId} tool={tool} sourceId={source} />;
}
