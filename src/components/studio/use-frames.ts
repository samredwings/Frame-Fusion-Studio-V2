import { useEffect, useRef, useState } from "react";
import { frameKey, idbGet } from "@/lib/studio/idb";
import type { FrameEdit, Source } from "@/lib/studio/types";

export function useBaseFrames(source: Source | undefined) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const frameCount = source?.frameCount ?? 0;
  const sourceId = source?.id;

  useEffect(() => {
    if (!sourceId || !frameCount) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    setLoading(true);
    void (async () => {
      const next: string[] = [];
      for (let start = 0; start < frameCount; start += 12) {
        const batch = await Promise.all(
          Array.from({ length: Math.min(12, frameCount - start) }, (_, offset) =>
            idbGet<Blob>("blobs", frameKey(sourceId, start + offset)),
          ),
        );
        for (const blob of batch) {
          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          created.push(url);
          next.push(url);
        }
      }
      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setUrls(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sourceId, frameCount]);

  return { urls, loading };
}

export function useReplacements(sourceId: string | undefined, edits: FrameEdit[]) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const signature = edits
    .filter((edit) => edit.sourceId === sourceId && edit.kind === "replace")
    .map((edit) => (edit.kind === "replace" ? `${edit.frameIndex}:${edit.blobKey}` : ""))
    .join("|");

  useEffect(() => {
    if (!sourceId) {
      setUrls({});
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    const snapshot = editsRef.current;
    void (async () => {
      const next: Record<number, string> = {};
      for (const edit of snapshot) {
        if (edit.sourceId !== sourceId || edit.kind !== "replace") continue;
        const blob = await idbGet<Blob>("blobs", edit.blobKey);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        created.push(url);
        next[edit.frameIndex] = url;
      }
      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setUrls(next);
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sourceId, signature]);

  return urls;
}
