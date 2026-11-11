import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.FRAME_FUSION_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage();
const pageErrors = [];
const hydrationErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (/Minified React error #418|Hydration failed|hydration mismatch/i.test(text)) {
    hydrationErrors.push(text);
  }
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1500);
  const schema = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("frame-fusion");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const required = [
      "videoSources",
      "frameAssets",
      "editedImages",
      "repairManifests",
      "renderJobs",
      "detectedWatermarks",
      "watermarkRemovals",
      "textRemovals",
    ];
    const missingStores = required.filter((name) => !db.objectStoreNames.contains(name));
    const expectedIndexes = {
      videoSources: { projectId: "projectId", sourceVideoId: "id" },
      frameAssets: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
      editedImages: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
      repairManifests: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
      renderJobs: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
      detectedWatermarks: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
      watermarkRemovals: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
      textRemovals: { projectId: "projectId", sourceVideoId: "sourceVideoId" },
    };
    const missingIndexes = [];
    for (const [storeName, indexes] of Object.entries(expectedIndexes)) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      for (const [name, keyPath] of Object.entries(indexes)) {
        if (!store.indexNames.contains(name)) {
          missingIndexes.push({ store: storeName, index: name, expectedKeyPath: keyPath, actualKeyPath: null });
          continue;
        }
        const actualKeyPath = store.index(name).keyPath;
        if (actualKeyPath !== keyPath) {
          missingIndexes.push({ store: storeName, index: name, expectedKeyPath: keyPath, actualKeyPath });
        }
      }
    }
    const result = { version: db.version, stores: [...db.objectStoreNames], missingStores, missingIndexes };
    db.close();
    return result;
  });

  assert.ok(schema.version >= 4, `Expected IndexedDB version >= 4, got ${schema.version}`);
  assert.deepEqual(schema.missingStores, [], `Missing stores: ${schema.missingStores.join(", ")}`);
  assert.deepEqual(schema.missingIndexes, [], `Missing indexes: ${JSON.stringify(schema.missingIndexes)}`);
  assert.deepEqual(hydrationErrors, [], `Hydration errors: ${hydrationErrors.join(" | ")}`);
  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, schema, hydrationErrors, pageErrors }, null, 2));
} finally {
  await browser.close();
}
