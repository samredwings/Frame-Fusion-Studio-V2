package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

public class NaiveInpaintingTest {
    private static int[] sample(int background, int watermark) {
        int[] pixels = new int[7 * 7];
        java.util.Arrays.fill(pixels, background);
        for (int y = 2; y < 5; y++) {
            for (int x = 2; x < 5; x++) pixels[y * 7 + x] = watermark;
        }
        return pixels;
    }

    @Test
    public void diffusionFillsUniformMaskedPatchFromItsBoundary() {
        int background = 0xff777777;
        int[] repaired = NaiveInpainting.repairRegion(
            sample(background, 0xffee1111), null, null,
            7, 7, 2, 2, 3, 3, 0, 0f, false, 0f
        );
        assertEquals(background, repaired[3 * 7 + 3]);
    }

    @Test
    public void donorPatchIsColorMatchedToTheTargetBorder() {
        int targetBackground = 0xff777777;
        int[] target = sample(targetBackground, 0xffee1111);
        int[] donor = new int[7 * 7];
        java.util.Arrays.fill(donor, 0xff555555);
        int[] repaired = NaiveInpainting.repairRegion(
            target, donor, null,
            7, 7, 2, 2, 3, 3, 0, 0f, true, 1f
        );
        assertEquals(targetBackground, repaired[3 * 7 + 3]);
    }

    @Test
    public void featherBlendsTheRepairAtTheMaskEdgeAndLeavesOutsideUntouched() {
        int background = 0xff777777;
        int watermark = 0xffee1111;
        int[] source = sample(background, watermark);
        int[] repaired = NaiveInpainting.repairRegion(
            source, null, null,
            7, 7, 2, 2, 3, 3, 2, 0f, false, 0f
        );
        assertEquals(background, repaired[0]);
        assertNotEquals(watermark, repaired[2 * 7 + 3]);
        assertEquals(background, repaired[3 * 7 + 3]);
    }
}
