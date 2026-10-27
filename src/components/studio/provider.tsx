import { useEffect } from "react";
import { useStudio } from "@/lib/studio/store";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const boot = useStudio((state) => state.boot);
  useEffect(() => {
    void boot();
  }, [boot]);
  return children;
}
