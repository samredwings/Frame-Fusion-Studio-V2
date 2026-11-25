package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.*;

import org.junit.Test;

public class FrameIndexDiagnosticsTest {
    @Test
    public void descendingPtsCannotBeMarkedVerified() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(new long[] {0L, 40_000L, 20_000L, 60_000L}, 4);
        assertFalse(diagnostics.ptsMonotonic);
        assertEquals(0, diagnostics.ptsDuplicates);
        assertFalse(diagnostics.indexVerified);
    }

    @Test
    public void duplicatePtsCannotBeMarkedVerified() {
        FrameIndexDiagnostics diagnostics = FrameIndexDiagnostics.from(new long[] {0L, 40_000L, 40_000L, 80_000L}, 4);
        assertTrue(diagnostics.ptsMonotonic);
        assertEquals(1, diagnostics.ptsDuplicates);
        assertFalse(diagnostics.indexVerified);
    }
}
