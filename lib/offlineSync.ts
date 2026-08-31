import { ApiError } from "./api";
import { checkoutPosSale } from "./posApi";
import { listPendingSales, removePendingSale, updatePendingSaleStatus, type PendingSale } from "./offlineDb";

let syncing = false;

async function syncOne(sale: PendingSale): Promise<void> {
  await updatePendingSaleStatus(sale.id, "syncing");
  try {
    const result = await checkoutPosSale(sale.business, sale.payload);
    if (result === null) {
      await updatePendingSaleStatus(sale.id, "failed", "Le serveur n'a pas confirme la vente.");
      return;
    }
    await removePendingSale(sale.id);
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Connexion indisponible — nouvel essai plus tard.";
    await updatePendingSaleStatus(sale.id, "failed", message);
  }
}

// Replays queued offline sales sequentially (never in parallel — a
// parallel replay could oversell stock the moment connectivity returns).
// A module-level guard skips re-entrant calls (online event + manual
// button + mount check can all fire close together).
export async function syncPendingSales(business: string): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await listPendingSales(business);
    const toSync = pending.filter((sale) => sale.status === "pending" || sale.status === "failed");
    for (const sale of toSync) {
      await syncOne(sale);
    }
  } finally {
    syncing = false;
  }
}
