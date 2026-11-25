import { useEffect } from "react";
import { useStudio } from "@/lib/studio/store";
import { verifyStudioMediaSchema } from "@/lib/studio/idb";
import { sweepOldExports } from "@/lib/studio/download";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const boot = useStudio((state) => state.boot);
  useEffect(() => {
    void boot().then(async () => {
      const schema = await verifyStudioMediaSchema();
      if (schema.missingStores.length || schema.missingIndexes.length) {
        const missing = [
          ...schema.missingStores.map((store) => `store:${store}`),
          ...schema.missingIndexes.map((index) => `${index.store}.${index.index}`),
        ];
        useStudio.setState({
          error: `Local media library schema is incomplete: ${missing.join(", ")}. Close other tabs and restart the app to retry the upgrade.`,
        });
      }
    }).catch((error: unknown) => {
      // The library boot path already presents storage failures in the shell.
      console.warn("Could not audit the local media library schema.", error);
    });
    void sweepOldExports();
  }, [boot]);
  return children;
}
