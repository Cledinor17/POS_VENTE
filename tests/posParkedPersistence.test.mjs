import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadPosApi(apiFetch) {
  const text = readFileSync(new URL("../lib/posApi.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    URLSearchParams,
    require: name => {
      if (name === "./api") return { apiFetch, ApiError: class ApiError extends Error {} };
      throw new Error("Unexpected import: " + name);
    },
  });
  return module.exports;
}

test("parked ticket listing uses persistent server pagination and remote search", async () => {
  const calls = [];
  const api = loadPosApi(async path => {
    calls.push(path);
    return {
      data: [{
        id: "9db2b8ac-5a67-41b7-bc1f-8658e21ee077",
        revision: 3,
        status: "open",
        note: "Table 15",
        customer_name: "Marie Test",
        room_label: "204",
        spending_limit: null,
        items: [{ productId: "22", name: "Café", qty: 2, price: 100 }],
      }],
      meta: { total: 1, total_open: 24, current_page: 2, last_page: 3 },
    };
  });
  const page = await api.listPosParkedCarts("demo", { page: 2, perPage: 10, q: "Marie" });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/pos\/parked-carts\?/);
  assert.match(calls[0], /page=2/);
  assert.match(calls[0], /q=Marie/);
  assert.equal(page.totalOpen, 24);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].revision, 3);
  assert.equal(page.items[0].customerName, "Marie Test");
});

test("save, update and cancel use explicit persistent endpoints (no delete-on-resume)", async () => {
  const calls = [];
  const id = "9db2b8ac-5a67-41b7-bc1f-8658e21ee077";
  const api = loadPosApi(async (path, options) => {
    calls.push({ path, options });
    if (options?.method === "POST" && path.endsWith("/cancel")) return { parked_cart: { id, status: "cancelled", items: [] } };
    return { parked_cart: { id, status: "open", revision: 2, note: "Comptoir", items: [] } };
  });
  const input = { clientToken: "local-123", note: "Comptoir", items: [], customerName: "Jean" };
  await api.createPosParkedCart("demo", input);
  await api.updatePosParkedCart("demo", id, 1, input);
  await api.cancelPosParkedCart("demo", id);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.json.client_token, "local-123");
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.json.revision, 1);
  assert.equal(calls[2].options.method, "POST");
  assert.match(calls[2].path, /\/cancel$/);
  assert.ok(!calls.some(call => call.options?.method === "DELETE"));
});

test("a resumed ticket stays open until cancellation or confirmed checkout", () => {
  const source = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  const resumeSource = source.slice(source.indexOf("function resumeParkedCart("), source.indexOf("async function discardParkedCart("));
  assert.match(resumeSource, /setActiveParkedId\(found\.id\)/);
  assert.doesNotMatch(resumeSource, /deletePosParkedCart|cancelPosParkedCart|setParkedCarts\(/);
  assert.match(source, /parkedTotalOpen > 10/);
  assert.match(source, /Rechercher parmi toutes les fiches/);
  assert.match(source, /updatePosParkedCart\(businessSlug, activeParkedId/);
  assert.match(source, /parkedCartId: activeParkedId \?\? undefined/);
});

test("POS sale uses a stable parked ticket idempotency key", () => {
  const source = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(source, /idempotencyKey = activeParkedId \? `parked-\$\{activeParkedId\}`/);
  const code = readFileSync(new URL("../lib/posApi.ts", import.meta.url), "utf8");
  assert.match(code, /parked_cart_id: input\.parkedCartId/);
  assert.match(code, /parked_cart_revision: input\.parkedCartRevision/);
});
