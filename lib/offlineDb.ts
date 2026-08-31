import type { CatalogProduct } from "./catalogApi";
import type { PosCheckoutInput } from "./posApi";

// Minimal hand-written IndexedDB wrapper for the POS offline queue — no
// external dependency (same spirit as lib/safeStorage.ts for localStorage):
// two tiny object stores don't need a library. The Service Worker
// (public/sw.js) never touches this data; it only caches static assets.

const DB_NAME = "pos_offline";
const DB_VERSION = 1;
const PRODUCTS_STORE = "productsCache";
const SALES_STORE = "pendingSales";

export type PendingSaleStatus = "pending" | "syncing" | "synced" | "failed";

export type PendingSale = {
  id: string; // client-generated uuid, doubles as the checkout idempotency key
  business: string;
  payload: PosCheckoutInput;
  status: PendingSaleStatus;
  error: string | null;
  createdAt: string;
  totalDisplay: number;
  currencyDisplay: string;
};

type ProductsCacheRecord = {
  business: string;
  products: CatalogProduct[];
  cachedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponible."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        db.createObjectStore(PRODUCTS_STORE, { keyPath: "business" });
      }
      if (!db.objectStoreNames.contains(SALES_STORE)) {
        db.createObjectStore(SALES_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Ouverture IndexedDB impossible."));
  });
}

export async function getCachedProducts(
  business: string
): Promise<{ products: CatalogProduct[]; cachedAt: string } | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PRODUCTS_STORE, "readonly");
      const req = tx.objectStore(PRODUCTS_STORE).get(business);
      req.onsuccess = () => {
        const record = req.result as ProductsCacheRecord | undefined;
        resolve(record ? { products: record.products, cachedAt: record.cachedAt } : null);
      };
      req.onerror = () => reject(req.error ?? new Error("Lecture du cache produits impossible."));
    });
  } catch {
    return null;
  }
}

export async function setCachedProducts(business: string, products: CatalogProduct[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PRODUCTS_STORE, "readwrite");
      tx.objectStore(PRODUCTS_STORE).put({
        business,
        products,
        cachedAt: new Date().toISOString(),
      } satisfies ProductsCacheRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Ecriture du cache produits impossible."));
    });
  } catch {
    // Best-effort cache — a failure here must never break the normal online flow.
  }
}

export async function enqueuePendingSale(sale: PendingSale): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, "readwrite");
    tx.objectStore(SALES_STORE).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Mise en file de la vente impossible."));
  });
}

export async function listPendingSales(business: string): Promise<PendingSale[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SALES_STORE, "readonly");
      const req = tx.objectStore(SALES_STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result as PendingSale[]) ?? [];
        resolve(all.filter((sale) => sale.business === business));
      };
      req.onerror = () => reject(req.error ?? new Error("Lecture des ventes en attente impossible."));
    });
  } catch {
    return [];
  }
}

export async function updatePendingSaleStatus(
  id: string,
  status: PendingSaleStatus,
  error: string | null = null
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, "readwrite");
    const store = tx.objectStore(SALES_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as PendingSale | undefined;
      if (record) {
        store.put({ ...record, status, error });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Mise a jour de la vente en attente impossible."));
  });
}

export async function removePendingSale(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SALES_STORE, "readwrite");
    tx.objectStore(SALES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Suppression de la vente en attente impossible."));
  });
}
