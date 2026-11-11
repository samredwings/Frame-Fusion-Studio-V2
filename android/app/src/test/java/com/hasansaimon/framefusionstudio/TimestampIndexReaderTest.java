package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.io.File;
import java.io.RandomAccessFile;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class TimestampIndexReaderTest {
    @Rule public TemporaryFolder temporaryFolder = new TemporaryFolder();

    private File createIndex() throws Exception {
        File file = temporaryFolder.newFile("sample.pts");
        try (RandomAccessFile index = new RandomAccessFile(file, "rw")) {
            index.writeInt(3);
            index.writeLong(900_000L);
            index.writeLong(0L);
            index.writeLong(33_333L);
            index.writeLong(66_666L);
        }
        return file;
    }

    @Test public void readsPtsWhenCursorIsAfterHeader() throws Exception {
        try (RandomAccessFile index = new RandomAccessFile(createIndex(), "r")) {
            index.seek(12L);
            assertEquals(0L, TimestampIndexReader.readPts(index, 0));
            assertEquals(33_333L, TimestampIndexReader.readPts(index, 1));
            assertEquals(66_666L, TimestampIndexReader.readPts(index, 2));
        }
    }

    @Test public void readsPtsWhenCursorIsAtEndOfFile() throws Exception {
        try (RandomAccessFile index = new RandomAccessFile(createIndex(), "r")) {
            index.seek(index.length());
            assertEquals(66_666L, TimestampIndexReader.readPts(index, 2));
        }
    }

    @Test public void rejectsNegativeAndOutOfRangeFrameIndexes() throws Exception {
        try (RandomAccessFile index = new RandomAccessFile(createIndex(), "r")) {
            assertThrows(IllegalArgumentException.class, () -> TimestampIndexReader.readPts(index, -1));
            assertThrows(IllegalArgumentException.class, () -> TimestampIndexReader.readPts(index, 3));
        }
    }
}
