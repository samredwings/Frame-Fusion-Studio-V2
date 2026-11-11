import { useEffect } from "react";
import { useStudio } from "@/lib/studio/store";
import { sweepOldExports } from "@/lib/studio/download";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const boot = useStudio((state) => state.boot);
  useEffect(() => {
    void boot();
    void sweepOldExports();
  }, [boot]);
  return children;
}
