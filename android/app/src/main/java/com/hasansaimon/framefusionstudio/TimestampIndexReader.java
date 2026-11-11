package com.hasansaimon.framefusionstudio;

import java.io.IOException;
import java.io.RandomAccessFile;

/** Reads presentation timestamps from the app's fixed-width .pts index format. */
final class TimestampIndexReader {
    private static final int HEADER_BYTES = Integer.BYTES + Long.BYTES;

    private TimestampIndexReader() {}

    static long readPts(RandomAccessFile index, int frameIndex) throws IOException {
        index.seek(0L);
        int frameCount = index.readInt();
        if (frameIndex < 0 || frameIndex >= frameCount) {
            throw new IllegalArgumentException("Frame index is outside the timestamp map.");
        }
        index.seek(HEADER_BYTES + (long) frameIndex * Long.BYTES);
        return index.readLong();
    }
}
