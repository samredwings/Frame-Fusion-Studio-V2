package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

public class RemovalFrameRangeTest {
    @Test
    public void acceptsTheMaximumBridgeSafeRange() {
        RemovalFrameRange range = RemovalFrameRange.validate(10, 259, 500);
        assertEquals(250, range.frameCount());
    }

    @Test
    public void rejectsRangesLargerThanTheBridgeSafeLimit() {
        IllegalArgumentException error = assertThrows(
            IllegalArgumentException.class,
            () -> RemovalFrameRange.validate(0, 250, 1000)
        );
        org.junit.Assert.assertTrue(error.getMessage().contains("250 frames"));
    }

    @Test
    public void rejectsNegativeReversedAndOutOfVideoRanges() {
        assertThrows(IllegalArgumentException.class, () -> RemovalFrameRange.validate(-1, 0, 10));
        assertThrows(IllegalArgumentException.class, () -> RemovalFrameRange.validate(5, 4, 10));
        assertThrows(IllegalArgumentException.class, () -> RemovalFrameRange.validate(0, 10, 10));
    }
}
