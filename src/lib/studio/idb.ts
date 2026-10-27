const DB_NAME = "frame-fusion";
const VERSION = 1;
const STORES = ["projects", "sources", "edits", "regions", "exports", "blobs"] as const;

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser has no local library."));
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        opening = null;
        reject(req.error ?? new Error("Could not open the library"));
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
