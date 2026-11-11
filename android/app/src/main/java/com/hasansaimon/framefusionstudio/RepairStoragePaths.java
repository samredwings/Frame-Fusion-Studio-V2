package com.hasansaimon.framefusionstudio;

import java.io.File;

/** Source-owned storage locations so deleting a source also deletes its previews. */
final class RepairStoragePaths {
    private RepairStoragePaths() {}

    static File repairDirectory(File filesDir, String sourceIndexId) {
        return new File(new File(new File(filesDir, "frame_fusion"), "repairs"), sourceIndexId);
    }

    static File previewFile(File filesDir, String sourceIndexId, String safeOperationId) {
        return new File(new File(repairDirectory(filesDir, sourceIndexId), "previews"), safeOperationId + ".jpg");
    }
}
