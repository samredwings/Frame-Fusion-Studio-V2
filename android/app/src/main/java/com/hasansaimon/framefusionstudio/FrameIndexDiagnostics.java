package com.hasansaimon.framefusionstudio;

import java.util.Arrays;

/**
 * Diagnostics for MediaExtractor's source/decode-order PTS and the sorted presentation index.
 * Structural validity checks metadata count, non-negative PTS and unique sorted timestamps only;
 * it does not prove that MediaMetadataRetriever returns the matching source picture for an index.
 */
final class FrameIndexDiagnostics {
    final boolean ptsSourceOrdered;
    final int ptsDuplicates;
    final int ptsNegative;
    final long firstPtsUs;
    final long lastPtsUs;
    final long maxGapUs;
    final boolean indexStructurallyValid;

    private FrameIndexDiagnostics(boolean sourceOrdered, int duplicates, int negative,
                                  long first, long last, long maxGap, boolean structurallyValid) {
        ptsSourceOrdered = sourceOrdered;
        ptsDuplicates = duplicates;
        ptsNegative = negative;
        firstPtsUs = first;
        lastPtsUs = last;
        maxGapUs = maxGap;
        indexStructurallyValid = structurallyValid;
    }

    static FrameIndexDiagnostics from(long[] sourceOrderedTimestamps, int metadataFrameCount) {
        if (sourceOrderedTimestamps == null || sourceOrderedTimestamps.length == 0) {
            return new FrameIndexDiagnostics(false, 0, 0, 0L, 0L, 0L, false);
        }

        boolean sourceOrdered = true;
        for (int i = 1; i < sourceOrderedTimestamps.length; i++) {
            if (sourceOrderedTimestamps[i] < sourceOrderedTimestamps[i - 1]) {
                sourceOrdered = false;
                break;
            }
        }

        long[] sorted = sourceOrderedTimestamps.clone();
        Arrays.sort(sorted);
        int duplicates = 0;
        int negative = 0;
        long maxGap = 0L;
        for (int i = 0; i < sorted.length; i++) {
            if (sorted[i] < 0L) negative++;
            if (i == 0) continue;
            long gap = sorted[i] - sorted[i - 1];
            if (gap == 0L) duplicates++;
            else maxGap = Math.max(maxGap, gap);
        }

        boolean structurallyValid = metadataFrameCount > 0
            && metadataFrameCount == sourceOrderedTimestamps.length
            && negative == 0
            && duplicates == 0;
        return new FrameIndexDiagnostics(
            sourceOrdered, duplicates, negative, sorted[0], sorted[sorted.length - 1], maxGap,
            structurallyValid);
    }
}
