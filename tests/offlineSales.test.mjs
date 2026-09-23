import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(name, mocks = {}) {
  const loadedModule = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: loadedModule.exports, module: loadedModule, require: (key) => { if (!(key in mocks)) throw Error(key); return mocks[key]; } });
  return loadedModule.exports;
}
class ApiError extends Error {}
const sale = (extra = {}) => ({ id: "stable-key", business: "shop", status: "pending", payload: { cashierId: "cashier-A", branchId: "branch-A", cashSessionId: "session-A", idempotencyKey: "stable-key", items: [] }, ...extra });
function syncFixture(rows, response = { saleId: "confirmed" }) {
  const calls = [], changes = [], removed = [];
  const loadedModule = load("offlineSync", {
    "./api": { ApiError },
    "./posApi": { checkoutPosSale: async (business, payload) => { calls.push({ business, payload }); if (response instanceof Error) throw response; return response; } },
    "./offlineDb": { listPendingSales: async () => rows, removePendingSale: async (id) => removed.push(id), updatePendingSaleStatus: async (...args) => changes.push(args) },
  });
  return { ...loadedModule, calls, changes, removed };
}
test("queue strips approval credentials without changing the sale or its reference", () => {
  const { sanitizePendingSale } = load("offlineDb");
  const original = sale(); original.payload.approval = { userId: "manager", password: "DO-NOT-PERSIST" };
  const safe = sanitizePendingSale(original);
  assert.equal(safe.requiresApproval, true);
  assert.equal(safe.payload.approval, undefined);
  assert.equal(safe.payload.idempotencyKey, "stable-key");
  assert.equal(safe.payload.branchId, "branch-A");
  assert.ok(!JSON.stringify(safe).includes("DO-NOT-PERSIST"));
  assert.equal(original.payload.approval.password, "DO-NOT-PERSIST");
});
test("interrupted syncing sale is replayed using its original reference and branch", async () => {
  const fixture = syncFixture([sale({ status: "syncing" })]);
  await fixture.syncPendingSales("shop", { userId: "cashier-A" });
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].payload.branchId, "branch-A");
  assert.equal(fixture.calls[0].payload.cashSessionId, "session-A");
  assert.equal(fixture.calls[0].payload.idempotencyKey, "stable-key");
  assert.deepEqual(fixture.removed, ["stable-key"]);
});
test("another cashier cannot replay someone else's sale", async () => {
  const fixture = syncFixture([sale()]);
  await fixture.syncPendingSales("shop", { userId: "cashier-B" });
  assert.equal(fixture.calls.length, 0); assert.equal(fixture.removed.length, 0);
});
test("legacy sales without a branch are retained for explicit resolution", async () => {
  const row = sale(); delete row.payload.branchId;
  const fixture = syncFixture([row]);
  await fixture.syncPendingSales("shop", { userId: "cashier-A" });
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.changes[0][1], "failed");
  assert.match(fixture.changes[0][2], /succursale/);
});
test("a new approval is only passed to the selected request and never stored", async () => {
  const row = sale({ requiresApproval: true }); const fixture = syncFixture([row]);
  await fixture.syncPendingSales("shop", { userId: "cashier-A" });
  assert.equal(fixture.calls.length, 0);
  await fixture.syncPendingSales("shop", { userId: "cashier-A", saleId: row.id, approval: { password: "TEMPORARY" } });
  assert.equal(fixture.calls[0].payload.approval.password, "TEMPORARY");
  assert.equal(row.payload.approval, undefined);
  assert.ok(!JSON.stringify(fixture.changes).includes("TEMPORARY"));
});
test("a lost response retains the sale and the next retry keeps its key", async () => {
  const fixture = syncFixture([sale()], new ApiError("Connexion interrompue"));
  await fixture.syncPendingSales("shop", { userId: "cashier-A" });
  await fixture.syncPendingSales("shop", { userId: "cashier-A" });
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.calls[0].payload.idempotencyKey, fixture.calls[1].payload.idempotencyKey);
  assert.equal(fixture.removed.length, 0);
  assert.equal(fixture.changes.at(-1)[1], "failed");
});
test("checkout explicitly sends the original branch even if the active branch changed", async () => {
  const requests = [];
  const { checkoutPosSale } = load("posApi", { "./api": { ApiError, apiFetch: async (path, options) => { requests.push(options); return { sale: { id: 42 } }; } } });
  await checkoutPosSale("shop", { ...sale().payload, subtotal: 10, tax: 0, total: 10, paymentMethod: "cash" });
  assert.equal(requests[0].headers["X-Branch-Id"], "branch-A");
  assert.equal(requests[0].json.cash_session_id, "session-A");
});

test("cash closure waits for unconfirmed sales and proceeds after they synchronize", async () => {
  let pending = [{ ...sale(), payload: { ...sale().payload, cashSessionId: "42" } }];
  let requests = 0;
  const { closeCashSession } = load("cashSessionApi", {
    "./offlineDb": { listPendingSales: async () => pending },
    "./api": { apiFetch: async () => { requests++; return { session: { id: 42, status: "closed" } }; } },
  });
  await assert.rejects(closeCashSession("shop", 42, { closingAmountByCurrency: {} }), /ventes en attente/);
  assert.equal(requests, 0);
  pending = [];
  assert.equal((await closeCashSession("shop", 42, { closingAmountByCurrency: {} })).status, "closed");
  assert.equal(requests, 1);
});

test("a pending sale in a different known session does not prevent cash closure", async () => {
  const { closeCashSession } = load("cashSessionApi", {
    "./offlineDb": { listPendingSales: async () => [{ ...sale(), payload: { ...sale().payload, cashSessionId: "43" } }] },
    "./api": { apiFetch: async () => ({ session: { id: 42, status: "closed" } }) },
  });
  assert.equal((await closeCashSession("shop", 42, { closingAmountByCurrency: {} })).status, "closed");
});
