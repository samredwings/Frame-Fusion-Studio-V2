/** Normalize a gallery selection into valid, unique frame indexes in visual order. */
export function normalizeFrameSelection(indexes: number[], frameCount: number): number[] {
  if (!Number.isInteger(frameCount) || frameCount < 0) return [];
  return [...new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0 && index < frameCount))]
    .sort((left, right) => left - right);
}
