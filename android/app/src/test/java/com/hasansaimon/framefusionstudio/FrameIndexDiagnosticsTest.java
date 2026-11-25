package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.*;

import org.junit.Test;

public class FrameIndexDiagnosticsTest {
    @Test
    public void reorderedDecodeOrderWithUniquePtsIsStructurallyValid() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(
            new long[] {0L, 80_000L, 40_000L, 120_000L}, 4);

        assertFalse(diagnostics.ptsSourceOrdered);
        assertEquals(0, diagnostics.ptsDuplicates);
        assertEquals(0, diagnostics.ptsNegative);
        assertEquals(0L, diagnostics.firstPtsUs);
        assertEquals(120_000L, diagnostics.lastPtsUs);
        assertEquals(40_000L, diagnostics.maxGapUs);
        assertTrue(diagnostics.indexStructurallyValid);
    }

    @Test
    public void sourceOrderCanBeFalseWhileSortedIndexRemainsStructurallyValid() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(
            new long[] {0L, 100_000L, 50_000L, 150_000L, 200_000L}, 5);

        assertFalse(diagnostics.ptsSourceOrdered);
        assertTrue(diagnostics.indexStructurallyValid);
        assertEquals(50_000L, diagnostics.maxGapUs);
    }

    @Test
    public void duplicatePtsFailStructuralValidity() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(
            new long[] {0L, 40_000L, 40_000L, 80_000L}, 4);

        assertTrue(diagnostics.ptsSourceOrdered);
        assertEquals(1, diagnostics.ptsDuplicates);
        assertFalse(diagnostics.indexStructurallyValid);
    }

    @Test
    public void metadataCountMismatchFailsStructuralValidity() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(
            new long[] {0L, 40_000L, 80_000L}, 4);

        assertFalse(diagnostics.indexStructurallyValid);
    }

    @Test
    public void negativePtsFailStructuralValidity() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(
            new long[] {-1L, 40_000L, 80_000L}, 3);

        assertEquals(1, diagnostics.ptsNegative);
        assertEquals(-1L, diagnostics.firstPtsUs);
        assertFalse(diagnostics.indexStructurallyValid);
    }
    @Test
    public void legitimateLargeVfrGapIsReportedButDoesNotInvalidateSortedIndex() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(
            new long[] {0L, 33_333L, 66_666L, 10_066_666L}, 4);

        assertTrue(diagnostics.indexStructurallyValid);
        assertEquals(10_000_000L, diagnostics.maxGapUs);
        assertEquals(0L, diagnostics.firstPtsUs);
        assertEquals(10_066_666L, diagnostics.lastPtsUs);
    }

}
