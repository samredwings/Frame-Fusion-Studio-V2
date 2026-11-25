package com.hasansaimon.framefusionstudio;

import java.io.File;
import java.io.IOException;
import java.util.regex.Pattern;

/** Validates per-source native storage identities and resolves their app-private paths. */
final class StorageKey {
    private static final Pattern VALID_KEY = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");

    private StorageKey() { }

    static boolean isValid(String storageKey) {
        return storageKey != null && VALID_KEY.matcher(storageKey).matches();
    }

    static String requireValid(String storageKey) {
        if (!isValid(storageKey)) {
            throw new IllegalArgumentException("storageKey must contain 8–64 letters, digits, underscores or hyphens.");
        }
        return storageKey;
    }

    static File resolveIndexPath(File filesDir, String storageKey) {
        requireValid(storageKey);
        return new File(new File(filesDir, "frame_fusion/indexes"), storageKey + ".pts");
    }

    static File resolveOutputDir(File filesDir, String folder, String storageKey) {
        requireValid(storageKey);
        if (!"frames".equals(folder) && !"thumbnails".equals(folder) && !"repairs".equals(folder)) {
            throw new IllegalArgumentException("Unsupported native media folder.");
        }
        return new File(new File(filesDir, "frame_fusion/" + folder), storageKey);
    }

    /** Delete only extracted frame files so a failed extraction can be retried with its index intact. */
    static void deleteExtractedFrames(File filesDir, String storageKey) throws IOException {
        requireValid(storageKey);
        deleteRecursively(resolveOutputDir(filesDir, "frames", storageKey));
    }

    /** Delete only one source-owned media namespace, never another source sharing its URI. */
    static void deleteStorageKey(File filesDir, String storageKey) throws IOException {
        requireValid(storageKey);
        deleteRecursively(resolveIndexPath(filesDir, storageKey));
        deleteRecursively(resolveOutputDir(filesDir, "frames", storageKey));
        deleteRecursively(resolveOutputDir(filesDir, "thumbnails", storageKey));
        deleteRecursively(RepairStoragePaths.repairDirectory(filesDir, storageKey));
    }

    private static void deleteRecursively(File path) throws IOException {
        if (!path.exists()) return;
        if (path.isDirectory()) {
            File[] children = path.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        if (!path.delete()) throw new IOException("Could not remove source-owned native media: " + path.getName());
    }
}
