import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const EXPORT_FILE_PREFIX = "ff-export-";
const EXPORT_RETENTION_MS = 24 * 60 * 60 * 1000;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not prepare the export file."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not prepare the export file."));
    reader.readAsDataURL(blob);
  });
}

export async function downloadOrShareBlob(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const safeFilename =
      Array.from(filename, (character) =>
        character.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(character) ? "_" : character,
      ).join("").trim() || "export";
    const path = `${EXPORT_FILE_PREFIX}${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;
    const file = await Filesystem.writeFile({
      path,
      data: await toBase64(blob),
      directory: Directory.Cache,
      recursive: false,
    });

    // Android share targets may read the content URI after the chooser closes.
    // Keep the file available; sweepOldExports() removes it on a later app launch.
    await Share.share({
      title: safeFilename,
      dialogTitle: "Save or share your export",
      files: [file.uri],
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Remove only files created by this app's export flow, and only after 24 hours.
 * The retention window avoids deleting a file while a receiving app is still
 * copying it from Android's content URI.
 */
export async function sweepOldExports(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { files } = await Filesystem.readdir({ path: "", directory: Directory.Cache });
    const cutoff = Date.now() - EXPORT_RETENTION_MS;

    for (const entry of files) {
      if (!entry.name.startsWith(EXPORT_FILE_PREFIX)) continue;
      const timestampText = entry.name.slice(EXPORT_FILE_PREFIX.length, EXPORT_FILE_PREFIX.length + 13);
      const createdAt = Number(timestampText);
      if (!Number.isFinite(createdAt) || createdAt <= 0 || createdAt >= cutoff) continue;

      await Filesystem.deleteFile({ path: entry.name, directory: Directory.Cache }).catch(() => undefined);
    }
  } catch {
    // A missing or inaccessible cache directory must not prevent app startup.
  }
}
