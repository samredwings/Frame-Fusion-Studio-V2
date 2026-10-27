import { Link } from "@tanstack/react-router";
import { Clapperboard, HardDrive } from "lucide-react";
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
      <header className="studio-header flex shrink-0 items-center gap-3 px-3 sm:px-5">
        <Link to="/" className="studio-brand flex min-h-12 shrink-0 items-center gap-2.5" aria-label="Frame Fusion Studio home">
          <span className="studio-brand-mark grid size-9 place-items-center rounded-xl bg-amber text-amber-ink">
            <Clapperboard className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold leading-tight tracking-wide">Frame Fusion</span>
            <span className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-[0.2em] text-muted sm:block">Frame Atlas</span>
          </span>
        </Link>
        {trail ? <div className="min-w-0 flex-1">{trail}</div> : <div className="flex-1" />}
        <div className="studio-local-pill hidden shrink-0 items-center gap-2 rounded-full px-3 py-2 text-[11px] text-muted md:flex">
          <HardDrive className="size-3.5 text-cyan" aria-hidden="true" />
          <span>On-device library</span>
        </div>
      </header>
      {(busy || notice || error) && (
        <div
          role={error ? "alert" : "status"}
          className={`studio-status flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-sm sm:px-5 ${
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
