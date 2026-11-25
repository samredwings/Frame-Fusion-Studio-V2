import type { VideoSource } from "./types";

/** Other stored sources that still depend on the same Android content URI. */
export function otherSourcesUsingUri(
  sources: VideoSource[],
  uri: string,
  excludingSourceId?: string,
): VideoSource[] {
  return sources.filter((source) => source.uri === uri && source.id !== excludingSourceId);
}

/** Other stored sources that still reference the same native cache key. */
export function otherSourcesUsingIndexId(
  sources: VideoSource[],
  indexId: string,
  excludingSourceId?: string,
): VideoSource[] {
  return sources.filter((source) => (source.frameIndexId || source.id) === indexId
    && source.id !== excludingSourceId);
}

/** A native cache directory may be removed only after its final source reference. */
export function shouldDeleteNativeMedia(
  sources: VideoSource[],
  indexId: string,
  excludingSourceId?: string,
): boolean {
  return otherSourcesUsingIndexId(sources, indexId, excludingSourceId).length === 0;
}

/** A persisted URI read grant is releasable only after the final source is gone. */
export function shouldReleaseUriPermission(
  sources: VideoSource[],
  uri: string,
  excludingSourceId?: string,
): boolean {
  return otherSourcesUsingUri(sources, uri, excludingSourceId).length === 0;
}


/** Native cache entries not currently referenced by any persisted VideoSource. */
export function findOrphanedNativeMedia(indexIds: string[], sources: VideoSource[]): string[] {
  const referenced = new Set(sources.map((source) => source.frameIndexId || source.id));
  return [...new Set(indexIds)].filter((indexId) => !referenced.has(indexId)).sort();
}


/** Exact native cleanup payload for a pending capture that never became a VideoSource. */
export function pendingCaptureDeleteOptions(
  sources: VideoSource[],
  capture: { sourceId: string; uri: string },
): { indexId: string; uri: string; releaseUriPermission: boolean } {
  return {
    indexId: capture.sourceId,
    uri: capture.uri,
    releaseUriPermission: shouldReleaseUriPermission(sources, capture.uri, capture.sourceId),
  };
}
