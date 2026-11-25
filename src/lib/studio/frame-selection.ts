/** Normalize a gallery selection into valid, unique frame indexes in visual order. */
export function normalizeFrameSelection(indexes: number[], frameCount: number): number[] {
  if (!Number.isInteger(frameCount) || frameCount < 0) return [];
  return [...new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0 && index < frameCount))]
    .sort((left, right) => left - right);
}

/**
 * Map sparse source-index selections onto dense editor positions. Keep both numbers:
 * edits use the dense sequence position, while native media reads use sourceFrameIndex.
 */
export function mapSourceFrameIndexesToSequence(sourceFrameIndexes: number[]): Array<{
  frameIndex: number;
  sourceFrameIndex: number;
}> {
  return sourceFrameIndexes.map((sourceFrameIndex, frameIndex) => ({ frameIndex, sourceFrameIndex }));
}
