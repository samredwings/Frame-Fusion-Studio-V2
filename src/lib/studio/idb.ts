const DB_NAME = "frame-fusion";
const VERSION = 4;
const STORES = [
  "projects",
  "sources",
  "edits",
  "regions",
  "exports",
  "blobs",
  "sourceVideos",
  "videoSources",
  "frameAssets",
  "editedImages",
  "repairManifests",
  "operationLogs",
  "renderJobs",
  "settings",
  "thumbnailBlobs",
  "frameBlobs",
  "maskBlobs",
  "detectedWatermarks",
  "watermarkRemovals",
  "textRemovals",
] as const;

const INDEXES: Record<string, Array<{ name: string; keyPath: string }>> = {
  videoSources: [
    { name: "projectId", keyPath: "projectId" },
    // A VideoSource row's primary id is the sourceVideoId referenced by child stores.
    { name: "sourceVideoId", keyPath: "id" },
  ],
  frameAssets: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
    { name: "frameIndex", keyPath: "frameIndex" },
  ],
  editedImages: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
    { name: "frameIndex", keyPath: "frameIndex" },
  ],
  repairManifests: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
  ],
  renderJobs: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
  ],
  detectedWatermarks: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
  ],
  watermarkRemovals: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
  ],
  textRemovals: [
    { name: "projectId", keyPath: "projectId" },
    { name: "sourceVideoId", keyPath: "sourceVideoId" },
  ],
};

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("This browser has no local library."));
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const tx = req.transaction;
        if (!tx) return;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
        for (const [storeName, indexes] of Object.entries(INDEXES)) {
          const store = tx.objectStore(storeName);
          for (const index of indexes) {
            if (!store.indexNames.contains(index.name))
              store.createIndex(index.name, index.keyPath, { unique: false });
          }
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        opening = null;
        reject(req.error ?? new Error("Could not open the library"));
      };
      req.onblocked = () => {
        opening = null;
        reject(
          new Error(
            "The library upgrade is blocked by another open Frame Fusion tab. Close other tabs and retry.",
          ),
        );
      };
    });
  }
  return opening;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Library request failed"));
  });
}

export type IDBBatchOperation =
  | { kind: "put"; store: string; key: string; value: unknown }
  | { kind: "delete"; store: string; key: string };

/**
 * Runtime schema audit used by diagnostics and smoke tests. The database is
 * opened/upgraded before metadata is read, so missing v4 indexes are created
 * for existing installations as well as fresh installs.
 */
export async function verifyStudioMediaSchema(): Promise<{
  version: number;
  missingStores: string[];
  missingIndexes: Array<{ store: string; index: string; keyPath: string }>;
}> {
  const db = await openDb();
  const requiredStores = [
    "videoSources",
    "frameAssets",
    "editedImages",
    "repairManifests",
    "renderJobs",
    "detectedWatermarks",
    "watermarkRemovals",
    "textRemovals",
  ];
  const missingStores = requiredStores.filter((name) => !db.objectStoreNames.contains(name));
  const missingIndexes: Array<{ store: string; index: string; keyPath: string }> = [];
  for (const storeName of requiredStores) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const expected = INDEXES[storeName] ?? [];
    for (const index of expected) {
      if (!store.indexNames.contains(index.name)) {
        missingIndexes.push({ store: storeName, index: index.name, keyPath: index.keyPath });
        continue;
      }
      const actual = store.index(index.name).keyPath;
      if (actual !== index.keyPath) {
        missingIndexes.push({ store: storeName, index: index.name, keyPath: index.keyPath });
      }
    }
  }
  return { version: db.version, missingStores, missingIndexes };
}

export async function idbBatch(operations: IDBBatchOperation[]): Promise<void> {
  if (!operations.length) return;
  const db = await openDb();
  const stores = [...new Set(operations.map((operation) => operation.store))];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Library transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Library transaction was canceled."));
    for (const operation of operations) {
      const objectStore = tx.objectStore(operation.store);
      if (operation.kind === "put") objectStore.put(operation.value, operation.key);
      else objectStore.delete(operation.key);
    }
  });
}

export async function idbAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  await requestToPromise(tx.objectStore(store).put(value, key));
}

export async function idbDel(store: string, key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  await requestToPromise(tx.objectStore(store).delete(key));
}

export function frameKey(sourceId: string, index: number): string {
  return `f:${sourceId}:${index}`;
}