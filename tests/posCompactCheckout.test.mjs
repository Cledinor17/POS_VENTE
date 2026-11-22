import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, deps = {}, jsx = false) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined, esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(code, {
    exports: mod.exports, module: mod,
    require: name => name in deps ? deps[name] : require(name),
  });
  return mod.exports;
}
const labels = load("../lib/posCompactI18n.ts").posCompactLabels;
const helpers = load("../lib/posDepositMemoUtils.ts");
const api = load("../lib/posDepositMemosApi.ts", {
  "./api": { apiFetch: async (_path, options) => {
    if (options?.method === "POST") return {
      data: { id: "1", cart_reference: options.json.cart_reference, amount: options.json.amount,
        currency: options.json.currency, note: null, recorded_at: new Date(0).toISOString() },
      accounting_status: "unposted",
    };
    return { data: [], totals: { HTG: "0.00", USD: "0.00" }, accounting_status: "unposted", more_records: false };
  } },
});

test("down deposits must be positive, max 2 decimals, no exponent or negative values", () => {
  for (const [input, expected] of [
    ["250", "250.00"], ["250,75", "250.75"], ["0.01", "0.01"],
    ["0", null], ["-10", null], ["1e8", null], ["1.234", null],
    ["1000000000.00", null], ["Infinity", null], ["", null],
    ["12,70", "12.70"],
  ]) {
    assert.equal(helpers.parseDepositAmount(input), expected, input);
  }
});

test("deposit amounts for parked tabs remain separated by currency and reference", () => {
  const values = [
    { cart_reference: "P-A", currency: "HTG", amount: "200.25" },
    { cart_reference: "P-A", currency: "USD", amount: "30.00" },
    { cart_reference: "P-B", currency: "HTG", amount: "500.00" },
  ];
  const result = helpers.depositTotalsForCart(values, "P-A");
  assert.equal(result.HTG, 200.25);
  assert.equal(result.USD, 30);
});

test("deposit API endpoint uses business-scoped idempotent payload", async () => {
  const result = await api.recordUnpostedDeposit("hotel & spa", {
    cart_reference:"P-1", amount:"100.00", currency:"HTG",
    request_key:"3d413f97-2a4f-4436-b201-4db84e9aee4a",
  });
  assert.equal(result.amount, "100.00");
  const summary = await api.listUnpostedDeposits("hotel & spa");
  assert.equal(summary.accounting_status, "unposted");
});

test("all languages have concise parked-tab and deposit prompts", () => {
  const fr = Object.keys(labels("fr"));
  for (const locale of ["fr", "en", "ht", "es", "zh", "ar"]) {
    const t = labels(locale);
    assert.deepEqual(Object.keys(t), fr);
    for (const key of ["confirmRemove", "yes", "no", "downDeposit", "declared", "unposted", "unpostedInfo"]) {
      assert.ok(t[key] && t[key].trim().length > 0, locale + ": " + key);
    }
  }
});

test("parked cart panel renders separate unposted totals and an explicit Yes/No dialog", () => {
  const Panel = load("../components/pos/ParkedCartsPanel.tsx", {
    "@/lib/posCompactI18n": { posCompactLabels: labels },
    "@/lib/currency": { formatMoney: (value, currency) => value + " " + currency },
  }, true).default;
  const props = {
    locale:"fr", count:1,
    carts:[{ id:"P-1", note:"Table 3", createdAt:"2026-11-22T12:00:00Z", items:[{qty:2}] }],
    note:"", onNote(){}, depositAmount:"", onDepositAmount(){},
    depositCurrency:"HTG", onDepositCurrency(){}, drafts:{}, onDraft(){},
    totals:{HTG:"200.00",USD:"30.00"}, perCart:{"P-1":{HTG:200,USD:30}},
    status:"ready", savingDepositId:null, canRecord:true, online:true,branchReady:true,
    onPark(){}, onResume(){}, onRecord(){}, onRequestDelete(){},
    confirming:{ id:"P-1",note:"Table 3" }, deletingId:null,
    onCancelDelete(){}, onConfirmDelete(){},
  };
  const result = renderToStaticMarkup(React.createElement(Panel, props));
  assert.match(result, /HTG 200.00/);
  assert.match(result, /USD 30.00/);
  assert.match(result, /role="alertdialog"/);
  assert.match(result, /Oui, supprimer/);
  assert.match(result, />Non</);
  assert.match(result, /Table 3/);
});

test("POS main interface prioritizes cart, limits product columns to four and does not render cashier heading", () => {
  const page = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(page, /minmax\(410px,2fr\)/);
  assert.match(page, /sm:grid-cols-3 xl:grid-cols-4/);
  assert.match(page, /<ParkedCartsPanel/);
  assert.doesNotMatch(page, /Nouvelle vente/);
  assert.doesNotMatch(page, /Caissier:\{/);
  assert.match(page, /setConfirmDiscard/);
});
