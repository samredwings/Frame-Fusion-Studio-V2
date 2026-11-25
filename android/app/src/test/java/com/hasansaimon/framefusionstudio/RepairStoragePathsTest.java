package com.hasansaimon.framefusionstudio;

import static org.junit.Assert.assertTrue;

import java.io.File;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class RepairStoragePathsTest {
    @Rule public TemporaryFolder temporaryFolder = new TemporaryFolder();

    @Test
    public void previewFilesAreNestedUnderTheSourceOwnedRepairDirectory() throws Exception {
        File filesDir = temporaryFolder.newFolder("app-files");
        String sourceIndexId = "video-index-123";
        File repairDirectory = RepairStoragePaths.repairDirectory(filesDir, sourceIndexId);
        File previewFile = RepairStoragePaths.previewFile(filesDir, sourceIndexId, "preview-operation");

        String repairRoot = repairDirectory.getCanonicalPath() + File.separator;
        assertTrue(previewFile.getCanonicalPath().startsWith(repairRoot));
    }
}
