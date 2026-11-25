package com.hasansaimon.framefusionstudio;

import java.util.Arrays;

/** Pure diagnostics for the timestamp sequence reported by MediaExtractor. */
final class FrameIndexDiagnostics {
    final boolean ptsMonotonic;
    final int ptsDuplicates;
    final long firstPtsUs;
    final long lastPtsUs;
    final long maxGapUs;
    final boolean indexVerified;

    private FrameIndexDiagnostics(boolean monotonic, int duplicates, long first, long last,
                                  long maxGap, boolean verified) {
        ptsMonotonic = monotonic;
        ptsDuplicates = duplicates;
        firstPtsUs = first;
        lastPtsUs = last;
        maxGapUs = maxGap;
        indexVerified = verified;
    }

    static FrameIndexDiagnostics from(long[] timestamps, int metadataFrameCount) {
        if (timestamps == null || timestamps.length == 0) {
            return new FrameIndexDiagnostics(false, 0, 0L, 0L, 0L, false);
        }
        boolean monotonic = true;
        for (int i = 1; i < timestamps.length; i++) {
            if (timestamps[i] < timestamps[i - 1]) monotonic = false;
        }
        long[] sorted = timestamps.clone();
        Arrays.sort(sorted);
        int duplicates = 0;
        long maxGap = 0L;
        for (int i = 1; i < sorted.length; i++) {
            long gap = sorted[i] - sorted[i - 1];
            if (gap == 0L) duplicates++;
            else maxGap = Math.max(maxGap, gap);
        }
        boolean verified = metadataFrameCount > 0 && metadataFrameCount == timestamps.length
            && monotonic && duplicates == 0;
        return new FrameIndexDiagnostics(monotonic, duplicates, sorted[0], sorted[sorted.length - 1], maxGap, verified);
    }
}
