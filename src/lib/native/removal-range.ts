export const MAX_REMOVAL_FRAMES_PER_CALL = 250;

export function assertRemovalFrameRange(startFrameIndex: number, endFrameIndex: number): void {
  if (!Number.isInteger(startFrameIndex) || !Number.isInteger(endFrameIndex)
      || startFrameIndex < 0 || endFrameIndex < startFrameIndex) {
    throw new Error("Choose a valid non-negative removal frame range.");
  }
  if (endFrameIndex - startFrameIndex + 1 > MAX_REMOVAL_FRAMES_PER_CALL) {
    throw new Error(
      `A native removal request is limited to ${MAX_REMOVAL_FRAMES_PER_CALL} frames. Split longer repairs into smaller frame ranges.`,
    );
  }
}
