package com.hasansaimon.framefusionstudio;

/** Keeps native removal results small enough for a single Capacitor bridge response. */
final class RemovalFrameRange {
    static final int MAX_FRAMES_PER_OPERATION = 250;

    private final int startFrameIndex;
    private final int endFrameIndex;

    private RemovalFrameRange(int startFrameIndex, int endFrameIndex) {
        this.startFrameIndex = startFrameIndex;
        this.endFrameIndex = endFrameIndex;
    }

    static RemovalFrameRange validate(int startFrameIndex, int endFrameIndex, int totalFrameCount) {
        if (totalFrameCount < 1 || startFrameIndex < 0 || endFrameIndex < startFrameIndex
            || endFrameIndex >= totalFrameCount) {
            throw new IllegalArgumentException("The removal frame range is outside the indexed video.");
        }
        long requestedFrames = (long) endFrameIndex - startFrameIndex + 1L;
        if (requestedFrames > MAX_FRAMES_PER_OPERATION) {
            throw new IllegalArgumentException(
                "A native removal request is limited to " + MAX_FRAMES_PER_OPERATION
                    + " frames. Split longer repairs into smaller frame ranges."
            );
        }
        return new RemovalFrameRange(startFrameIndex, endFrameIndex);
    }

    int frameCount() {
        return endFrameIndex - startFrameIndex + 1;
    }
}
