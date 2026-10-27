import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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
    const path = `${Date.now()}-${safeFilename}`;
    const file = await Filesystem.writeFile({
      path,
      data: await toBase64(blob),
      directory: Directory.Cache,
      recursive: false,
    });
    try {
      await Share.share({
        title: safeFilename,
        dialogTitle: "Save or share your export",
        files: [file.uri],
      });
    } finally {
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined);
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
