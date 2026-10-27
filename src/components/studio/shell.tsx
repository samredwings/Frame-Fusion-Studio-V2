import { Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { useStudio } from "@/lib/studio/store";

export function Shell({
  children,
  trail,
}: {
  children: React.ReactNode;
  trail?: React.ReactNode;
}) {
  const notice = useStudio((state) => state.notice);
  const error = useStudio((state) => state.error);
  const busy = useStudio((state) => state.busy);
  const dismiss = useStudio((state) => state.dismiss);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-bg text-fg"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2 sm:px-4">
        <Link to="/" className="flex min-h-11 items-center gap-2 text-amber">
          <Clapperboard className="size-5" aria-hidden="true" />
          <span className="font-display text-sm font-semibold tracking-wide">Frame Fusion</span>
        </Link>
        {trail ? <div className="min-w-0 flex-1">{trail}</div> : <div className="flex-1" />}
      </header>
      {(busy || notice || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-sm sm:px-4 ${
            error ? "border-danger/40 bg-danger/15 text-fg" : "border-line bg-surface text-muted"
          }`}
        >
          <span className="min-w-0 truncate">{busy || error || notice}</span>
          {!busy && (
            <button type="button" className="min-h-11 shrink-0 px-2 text-fg" onClick={dismiss}>
              Dismiss
            </button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
