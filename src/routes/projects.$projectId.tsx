import { createFileRoute, Outlet } from "@tanstack/react-router";
import { parseTool } from "@/lib/studio/types";

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tool: parseTool(search.tool),
    source: typeof search.source === "string" ? search.source : undefined,
  }),
  component: ProjectLayout,
});

function ProjectLayout() {
  return <Outlet />;
}
