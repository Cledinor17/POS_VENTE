import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, deps) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { module: mod, exports: mod.exports, require: name =>
    Object.hasOwn(deps, name) ? deps[name] : require(name) });
  return mod.exports;
}

test("parked tabs share their original reference, version and exact cross-cashier deposits", async () => {
  const requests = [];
  let current = {
    id: "P-AAA", note: "Table 3", version: 3, created_at: "2026-11-22T12:00:00Z",
    items: [{ productId: "2", name: "Jus", qty: 2, price: 500, currency: "HTG",
      taxRate: 0, sku: "JUS", stock: 10, type: "product", imagePath: null }],
    deposit_totals: { HTG: "300.00", USD: "5.00" },
  };
  const mockFetch = async (path, opts) => {
    requests.push({ path, opts });
    if (path.endsWith("/pos/parked-carts") && !opts?.method) return { data: [current] };
    if (path.endsWith("/pos/parked-carts") && opts?.method === "POST") return { data: current };
    if (path.endsWith("/deposit") && opts?.method === "PUT") {
      current = { ...current, version: current.version + 1,
        deposit_totals: { ...current.deposit_totals, [opts.json.currency]: opts.json.amount } };
      return { data: current };
    }
    if (opts?.method === "PUT") {
      current = { ...current, version: current.version + 1, note: opts.json.note };
      return { data: current };
    }
    if (opts?.method === "DELETE") return { deleted: true };
    if (path.endsWith("/sales") && opts?.method === "POST") return {
      sale: { id: "22", receipt_no: "TKT-22", deposit_applied: 300,
        payment_amount: 700, payment_currency: "HTG" },
    };
    throw new Error("Unexpected API call: " + path);
  };
  const api = load("../lib/posApi.ts", {
    "./api": { apiFetch: mockFetch, ApiError: class ApiError extends Error {} },
  });

  const [received] = await api.listPosParkedCarts("bar");
  assert.equal(received.id, "P-AAA");
  assert.equal(received.version, 3);
  assert.equal(received.depositTotals.HTG, 300);
  assert.equal(received.depositTotals.USD, 5);

  const updated = await api.updatePosParkedCart("bar", received.id, {
    note: "Table 3 + jus", items: received.items, version: received.version,
  });
  assert.equal(updated.id, received.id);
  assert.equal(updated.version, 4);
  assert.equal(updated.depositTotals.HTG, 300);
  const changed = await api.setPosParkedDeposit("bar", updated.id, {
    version: updated.version, amount: "150.00", currency: "HTG",
    request_key: "26075f57-d259-4fa1-84b1-d01a27c1ce82",
  });
  assert.equal(changed.depositTotals.HTG, 150);
  assert.equal(changed.depositTotals.USD, 5);
  assert.equal(changed.version, 5);
  assert.equal(requests.at(-1).opts.json.amount, "150.00");

  const sale = await api.checkoutPosSale("bar", {
    branchId: "1", cashSessionId: "22", idempotencyKey: "CHECK-1",
    parkedCartId: changed.id, parkedCartVersion: changed.version,
    subtotal: 1000, tax: 0, total: 1000, currency: "HTG",
    paymentMethod: "cash", paymentCurrency: "HTG", paymentAmount: 700,
    cashReceived: 700, changeAmount: 0,
    items: [{ productId: "2", name: "Jus", sku: "JUS", qty: 2, unitPrice: 500, taxRate: 0, type: "product" }],
  });
  assert.equal(sale.depositApplied, 300);
  const checkout = requests.at(-1).opts.json;
  assert.equal(checkout.parked_cart_id, "P-AAA");
  assert.equal(checkout.parked_cart_version, 5);
  assert.equal(checkout.payment.amount, 700);
});

test("cashier keeps the active reference across editing and re-parking, without a local delete on resume", () => {
  const src = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(src, /activeParked\?\.id \?\? \(parkCreateId\.current/);
  assert.match(src, /setActiveParked\(found\)/);
  assert.match(src, /updatePosParkedCart\(businessSlug, parked\.id/);
  assert.match(src, /remainingAfterDeposit/);
  assert.match(src, /parkedCartId: activeParked\?\.version/);
  assert.match(src, /if \(activeParked\) \{/);
  assert.match(src, /Connexion au serveur requise pour finaliser/);
  const resume = src.slice(src.indexOf("function resumeParkedCart("), src.indexOf("async function discardParkedCart("));
  assert.doesNotMatch(resume, /deletePosParkedCart/);
});
