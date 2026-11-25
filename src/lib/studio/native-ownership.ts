import type { VideoSource } from "./types";

export type NativeVideoDeleteOptions = {
  indexId: string;
  uri: string;
  releaseUriPermission: boolean;
};

export type NativeVideoDelete = (options: NativeVideoDeleteOptions) => Promise<unknown>;

const NATIVE_STORAGE_KEY = /^[A-Za-z0-9_-]{8,64}$/;

export function isNativeStorageKey(value: string): boolean {
  return NATIVE_STORAGE_KEY.test(value);
}

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
): NativeVideoDeleteOptions {
  return {
    indexId: capture.sourceId,
    uri: capture.uri,
    releaseUriPermission: shouldReleaseUriPermission(sources, capture.uri),
  };
}

/**
 * Store-level cleanup seam shared by project deletion and individual source deletion.
 * It removes each now-unowned index once and releases a duplicate URI grant at most once.
 */
export async function cleanupRemovedNativeMedia(
  removedSources: VideoSource[],
  remainingSources: VideoSource[],
  deleteVideoData: NativeVideoDelete,
): Promise<void> {
  const removedIndexes = new Set<string>();
  const releasedUris = new Set<string>();
  const candidates = removedSources.filter((source) => {
    const indexId = source.frameIndexId || source.id;
    if (!isNativeStorageKey(indexId) || removedIndexes.has(indexId)
      || !shouldDeleteNativeMedia(remainingSources, indexId)) return false;
    removedIndexes.add(indexId);
    return true;
  });

  const operations = candidates.map((source) => {
    const releaseUriPermission = !releasedUris.has(source.uri)
      && shouldReleaseUriPermission(remainingSources, source.uri);
    if (releaseUriPermission) releasedUris.add(source.uri);
    return {
      indexId: source.frameIndexId || source.id,
      uri: source.uri,
      releaseUriPermission,
    };
  });
  await Promise.all(operations.map((options) => deleteVideoData(options)));
}

/** Delete only the pending storage key; a saved source always retains ownership. */
export async function cleanupPendingNativeCapture(
  sources: VideoSource[],
  capture: { sourceId: string; uri: string },
  deleteVideoData: NativeVideoDelete,
): Promise<boolean> {
  if (!isNativeStorageKey(capture.sourceId)
    || !shouldDeleteNativeMedia(sources, capture.sourceId)) return false;
  await deleteVideoData(pendingCaptureDeleteOptions(sources, capture));
  return true;
}

/**
 * Enclose every native-import validation and persistence step in one cleanup boundary.
 * In particular, failures before timestamp extraction still clean the index built by
 * the picker flow. The injected bridge makes this boundary independently testable.
 */
export async function withPendingNativeCaptureCleanup<T>(
  capture: { sourceId: string; uri: string },
  getSources: () => VideoSource[],
  operation: () => Promise<T>,
  deleteVideoData: NativeVideoDelete,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    await cleanupPendingNativeCapture(getSources(), capture, deleteVideoData).catch(() => false);
    throw error;
  }
}
