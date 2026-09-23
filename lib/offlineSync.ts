import { ApiError } from "./api";
import { checkoutPosSale, type PosApprovalPayload } from "./posApi";
import { listPendingSales, removePendingSale, updatePendingSaleStatus, type PendingSale } from "./offlineDb";

type SyncOptions = { userId: string; saleId?: string; approval?: PosApprovalPayload };
const running = new Set<string>();

async function syncOne(sale: PendingSale, options: SyncOptions): Promise<void> {
  if (String(sale.payload.cashierId ?? "") !== options.userId) return;
  if (!sale.payload.branchId) {
    await updatePendingSaleStatus(sale.id, "failed", "Choisissez la succursale d'origine avant de reprendre cette ancienne vente.");
    return;
  }
  if (sale.requiresApproval && !options.approval) {
    await updatePendingSaleStatus(sale.id, "failed", "Une nouvelle autorisation du responsable est nécessaire. Aucun mot de passe n'est conservé.");
    return;
  }
  await updatePendingSaleStatus(sale.id, "syncing");
  try {
    const result = await checkoutPosSale(sale.business, {
      ...sale.payload,
      idempotencyKey: sale.id,
      // Credentials only live in this request, never in the stored payload.
      ...(options.approval ? { approval: options.approval } : {}),
    });
    if (!result) throw new Error("Le serveur n'a pas confirmé la vente.");
    await removePendingSale(sale.id);
  } catch (error) {
    const message = error instanceof ApiError || error instanceof Error
      ? error.message : "Connexion indisponible. Réessayez plus tard.";
    await updatePendingSaleStatus(sale.id, "failed", message);
  }
}

export async function syncPendingSales(business: string, options: SyncOptions): Promise<void> {
  const run = async () => {
    if (running.has(business)) return;
    running.add(business);
    try {
      const pending = await listPendingSales(business);
      // Recover interrupted requests with the SAME key, including syncing rows.
      for (const sale of pending) {
        if (sale.status === "synced" || (options.saleId && options.saleId !== sale.id)) continue;
        await syncOne(sale, options);
      }
    } finally {
      running.delete(business);
    }
  };
  // Serialize tabs as well as calls in this tab. Server idempotency is authoritative.
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(`pos-sync:${business}`, run);
  } else {
    await run();
  }
}
