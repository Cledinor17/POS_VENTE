import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function purchasesApi(response, requests = []) {
  const loadedModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/purchasesApi.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports, URLSearchParams,
    require: (name) => name === "./api" ? { apiFetch: async (path, options) => {
      requests.push({ path, options });
      return response;
    } } : require(name),
  });
  return loadedModule.exports;
}

test("supplier history requests a server-side filter and keeps recorded currency and pagination", async () => {
  const requests = [];
  const api = purchasesApi({
    data: [{ id: 8, supplier_id: 12, number: "PO-8", currency: "HTG", total: "1250.50", status: "received" }],
    meta: { supplier_id: 12, current_page: 2, per_page: 10, total: 11, last_page: 2 },
  }, requests);
  const result = await api.listPurchaseOrders("demo shop", { supplierId: "12", page: 2, perPage: 10 });
  assert.equal(requests[0].path, "/api/app/demo%20shop/purchase-orders?page=2&per_page=10&supplier_id=12");
  assert.equal(requests[0].options, undefined);
  assert.equal(result.items[0].supplierId, "12");
  assert.equal(result.items[0].currency, "HTG");
  assert.equal(result.items[0].total, 1250.5);
  assert.equal(result.currentPage, 2);
  assert.equal(result.lastPage, 2);
  assert.equal(result.total, 11);
});

test("supplier history refuses an old unfiltered API or orders from another supplier", async () => {
  for (const response of [
    { data: [], meta: { total: 0 } },
    { data: [], meta: { supplier_id: 99 } },
    { data: [{ id: 8, supplier_id: 99 }], meta: { supplier_id: 12 } },
  ]) {
    await assert.rejects(purchasesApi(response).listPurchaseOrders("demo", { supplierId: "12" }), /indisponible/);
  }
});

test("a valid empty history and the existing general order list continue to work", async () => {
  const empty = await purchasesApi({ data: [], meta: { supplier_id: 12, total: 0 } })
    .listPurchaseOrders("demo", { supplierId: "12" });
  assert.equal(empty.items.length, 0);
  const general = await purchasesApi({ data: [{ id: 5, supplier_id: 99 }], meta: { total: 1 } })
    .listPurchaseOrders("demo");
  assert.equal(general.items[0].supplierId, "99");
});
