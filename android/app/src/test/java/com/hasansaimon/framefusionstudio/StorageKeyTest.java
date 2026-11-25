package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.Test;

public class StorageKeyTest {
    @Test
    public void differentSourceKeysResolveToDifferentIndexFiles() {
        File filesDir = new File("/tmp/frame-fusion-storage-test");
        File keyA = StorageKey.resolveIndexPath(filesDir, "source-key-0001");
        File keyB = StorageKey.resolveIndexPath(filesDir, "source-key-0002");
        assertNotEquals(keyA.getAbsolutePath(), keyB.getAbsolutePath());
        assertEquals("source-key-0001.pts", keyA.getName());
        assertEquals("source-key-0002.pts", keyB.getName());
    }

    @Test
    public void storageKeyRejectsEmptyLongAndPathTraversalValues() {
        assertFalse(StorageKey.isValid(""));
        assertFalse(StorageKey.isValid("x".repeat(65)));
        assertFalse(StorageKey.isValid("../evil"));
        assertFalse(StorageKey.isValid("a/b"));
        assertFalse(StorageKey.isValid(".."));
        assertTrue(StorageKey.isValid("source-key_123456"));
    }

    @Test
    public void deletingOneKeyLeavesAnotherKeysIndexAndDirectoriesPresent() throws IOException {
        File filesDir = Files.createTempDirectory("frame-fusion-storage-test").toFile();
        String keyA = "source-key-0001";
        String keyB = "source-key-0002";
        File keyAIndex = StorageKey.resolveIndexPath(filesDir, keyA);
        File keyBIndex = StorageKey.resolveIndexPath(filesDir, keyB);
        File keyAFrames = StorageKey.resolveOutputDir(filesDir, "frames", keyA);
        File keyBFrames = StorageKey.resolveOutputDir(filesDir, "frames", keyB);
        File keyAThumbs = StorageKey.resolveOutputDir(filesDir, "thumbnails", keyA);
        File keyBThumbs = StorageKey.resolveOutputDir(filesDir, "thumbnails", keyB);
        File keyARepairs = RepairStoragePaths.repairDirectory(filesDir, keyA);
        File keyBRepairs = RepairStoragePaths.repairDirectory(filesDir, keyB);
        for (File file : new File[] {keyAIndex, keyBIndex}) {
            assertTrue(file.getParentFile().mkdirs() || file.getParentFile().isDirectory());
            assertTrue(file.createNewFile());
        }
        for (File dir : new File[] {keyAFrames, keyBFrames, keyAThumbs, keyBThumbs, keyARepairs, keyBRepairs}) {
            assertTrue(dir.mkdirs() || dir.isDirectory());
            assertTrue(new File(dir, "sample.bin").createNewFile());
        }

        StorageKey.deleteStorageKey(filesDir, keyA);

        assertFalse(keyAIndex.exists());
        assertFalse(keyAFrames.exists());
        assertFalse(keyAThumbs.exists());
        assertFalse(keyARepairs.exists());
        assertTrue(keyBIndex.isFile());
        assertTrue(new File(keyBFrames, "sample.bin").isFile());
        assertTrue(new File(keyBThumbs, "sample.bin").isFile());
        assertTrue(new File(keyBRepairs, "sample.bin").isFile());
    }
    @Test
    public void acceptsLegacySha256UriStorageKeys() {
        String legacyUriHash = "a".repeat(64);
        assertTrue(StorageKey.isValid(legacyUriHash));
        assertEquals(
            new File(new File("/tmp/files", "frame_fusion/indexes"), legacyUriHash + ".pts"),
            StorageKey.resolveIndexPath(new File("/tmp/files"), legacyUriHash));
    }

}
