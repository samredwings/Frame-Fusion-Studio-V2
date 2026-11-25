package com.hasansaimon.framefusionstudio;

import java.util.Arrays;

/**
 * Small, dependency-free spatial inpainting primitive for an RGB patch.
 * This is a naive Laplacian/diffusion approximation, not OpenCV Telea or
 * Navier-Stokes inpainting. Temporal samples are blended at the same pixel
 * coordinates only; no motion compensation or optical flow is performed.
 */
final class NaiveInpainting {
    private static final int ITERATIONS = 72;

    private NaiveInpainting() {}

    static int[] repairRegion(
        int[] source,
        int[] donor,
        int[] temporal,
        int patchWidth,
        int patchHeight,
        int maskX,
        int maskY,
        int maskWidth,
        int maskHeight,
        int featherPx,
        float temporalBlendRatio,
        boolean colorMatch,
        float donorBlendRatio
    ) {
        if (source == null || patchWidth <= 0 || patchHeight <= 0 ||
            source.length != patchWidth * patchHeight) {
            throw new IllegalArgumentException("The source patch dimensions are invalid.");
        }
        if (donor != null && donor.length != source.length) {
            throw new IllegalArgumentException("The donor patch dimensions do not match the source.");
        }
        if (temporal != null && temporal.length != source.length) {
            throw new IllegalArgumentException("The temporal patch dimensions do not match the source.");
        }

        int left = clamp(maskX, 0, patchWidth - 1);
        int top = clamp(maskY, 0, patchHeight - 1);
        int right = clamp(maskX + maskWidth, left + 1, patchWidth);
        int bottom = clamp(maskY + maskHeight, top + 1, patchHeight);
        int feather = clamp(featherPx, 0, 512);
        float temporalRatio = clamp01(temporalBlendRatio);
        float donorRatio = donor == null ? 0f : clamp01(donorBlendRatio);

        int boundary = meanBoundary(source, patchWidth, patchHeight, left, top, right, bottom);
        int[] current = Arrays.copyOf(source, source.length);
        int[] next = new int[source.length];
        Arrays.fill(next, 0);
        for (int y = top; y < bottom; y++) {
            for (int x = left; x < right; x++) current[y * patchWidth + x] = boundary;
        }

        // Jacobi iterations approximate the Laplace equation with the unmasked
        // pixels as fixed boundary conditions. This is deliberately conservative.
        for (int iteration = 0; iteration < ITERATIONS; iteration++) {
            System.arraycopy(current, 0, next, 0, current.length);
            for (int y = top; y < bottom; y++) {
                for (int x = left; x < right; x++) {
                    int r = 0, g = 0, b = 0, count = 0;
                    if (x > 0) { int c = current[y * patchWidth + x - 1]; r += red(c); g += green(c); b += blue(c); count++; }
                    if (x + 1 < patchWidth) { int c = current[y * patchWidth + x + 1]; r += red(c); g += green(c); b += blue(c); count++; }
                    if (y > 0) { int c = current[(y - 1) * patchWidth + x]; r += red(c); g += green(c); b += blue(c); count++; }
                    if (y + 1 < patchHeight) { int c = current[(y + 1) * patchWidth + x]; r += red(c); g += green(c); b += blue(c); count++; }
                    if (count > 0) next[y * patchWidth + x] = argb(r / count, g / count, b / count);
                }
            }
            int[] swap = current;
            current = next;
            next = swap;
        }

        int[] colorDelta = colorMatch && donor != null
            ? boundaryColorDelta(source, donor, patchWidth, patchHeight, left, top, right, bottom)
            : new int[] {0, 0, 0};
        int[] result = Arrays.copyOf(source, source.length);
        for (int y = top; y < bottom; y++) {
            for (int x = left; x < right; x++) {
                int offset = y * patchWidth + x;
                int filled = current[offset];
                if (donor != null && donorRatio > 0f) {
                    int donorColor = donor[offset];
                    donorColor = argb(
                        clamp(red(donorColor) + colorDelta[0], 0, 255),
                        clamp(green(donorColor) + colorDelta[1], 0, 255),
                        clamp(blue(donorColor) + colorDelta[2], 0, 255)
                    );
                    filled = blend(filled, donorColor, donorRatio);
                }
                if (temporal != null && temporalRatio > 0f) {
                    filled = blend(filled, temporal[offset], temporalRatio);
                }

                float alpha = 1f;
                if (feather > 0) {
                    int distance = Math.min(
                        Math.min(x - left + 1, right - x),
                        Math.min(y - top + 1, bottom - y)
                    );
                    float t = Math.min(1f, Math.max(0f, distance / (float) feather));
                    alpha = t * t * (3f - 2f * t); // smoothstep
                }
                result[offset] = blend(source[offset], filled, alpha);
            }
        }
        return result;
    }

    private static int meanBoundary(int[] pixels, int width, int height, int left, int top, int right, int bottom) {
        long r = 0, g = 0, b = 0;
        long count = 0;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                if (x >= left && x < right && y >= top && y < bottom) continue;
                int color = pixels[y * width + x];
                r += red(color); g += green(color); b += blue(color); count++;
            }
        }
        if (count == 0) return 0xff808080;
        return argb((int)(r / count), (int)(g / count), (int)(b / count));
    }

    private static int[] boundaryColorDelta(int[] target, int[] donor, int width, int height,
                                            int left, int top, int right, int bottom) {
        long tr = 0, tg = 0, tb = 0, dr = 0, dg = 0, db = 0, count = 0;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                if (x >= left && x < right && y >= top && y < bottom) continue;
                int t = target[y * width + x];
                int d = donor[y * width + x];
                tr += red(t); tg += green(t); tb += blue(t);
                dr += red(d); dg += green(d); db += blue(d);
                count++;
            }
        }
        if (count == 0) return new int[] {0, 0, 0};
        return new int[] {
            (int)(tr / count - dr / count),
            (int)(tg / count - dg / count),
            (int)(tb / count - db / count)
        };
    }

    private static int blend(int base, int overlay, float alpha) {
        float a = clamp01(alpha);
        return argb(
            Math.round(red(base) * (1f - a) + red(overlay) * a),
            Math.round(green(base) * (1f - a) + green(overlay) * a),
            Math.round(blue(base) * (1f - a) + blue(overlay) * a)
        );
    }

    private static int argb(int r, int g, int b) {
        return 0xff000000 | (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255);
    }

    private static int red(int color) { return (color >>> 16) & 0xff; }
    private static int green(int color) { return (color >>> 8) & 0xff; }
    private static int blue(int color) { return color & 0xff; }
    private static int clamp(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }
    private static float clamp01(float value) { return Math.max(0f, Math.min(1f, value)); }
}
