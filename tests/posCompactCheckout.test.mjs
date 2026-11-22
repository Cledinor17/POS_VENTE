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
const currency = load("../lib/currency.ts");
const posCurrency = load("../lib/posCurrency.ts", { "./currency": currency });
const parkedBalance = load("../lib/posParkedBalance.ts", {
  "./currency": currency, "./posCurrency": posCurrency,
});
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
    for (const key of ["confirmRemove", "yes", "no", "downDeposit", "declared", "unposted", "unpostedInfo", "createTab", "findTab", "optional", "estimatedTotal", "estimatedDue", "estimateInfo", "incompleteDeposits", "overpaid"]) {
      assert.ok(t[key] && t[key].trim().length > 0, locale + ": " + key);
    }
  }
});

test("parked cart panel renders separate unposted totals and an explicit Yes/No dialog", () => {
  const Panel = load("../components/pos/ParkedCartsPanel.tsx", {
    "@/lib/posCompactI18n": { posCompactLabels: labels },
    "@/lib/currency": { formatMoney: (value, currency) => value + " " + currency },
    "@/lib/posParkedBalance": parkedBalance,
  }, true).default;
  const props = {
    locale:"fr", preferredCurrency:"HTG", exchange:{ exchangeSellRate:10, exchangeBuyRate:10 }, memosComplete:true,
    carts:[{ id:"P-1", note:"Table 3", createdAt:"2026-11-22T12:00:00Z", items:[{qty:2, price:500, currency:"HTG", taxRate:0}] }],
    drafts:{}, onDraft(){},
    totals:{HTG:"200.00",USD:"30.00"}, perCart:{"P-1":{HTG:200,USD:30}},
    memos:[{ id:"1", cart_reference:"P-1", amount:"200.00", currency:"HTG", note:"Table 3", recorded_at:"2026-11-22T12:00:00Z" }],
    status:"ready", savingDepositId:null, canRecord:true, online:true,branchReady:true,
    onResume(){}, onRecord(){}, onRequestDelete(){},
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
  assert.match(result, /Total estimé/);
  assert.match(result, /1000 HTG/);
  assert.match(result, /Reste estimé/);
  assert.match(result, /500 HTG/);
});

test("POS main interface prioritizes cart, limits product columns to four and does not render cashier heading", () => {
  const page = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(page, /xl:grid-cols-\[minmax\(0,1\.05fr\)_minmax\(420px,1fr\)\]/);
  assert.match(page, /sm:grid-cols-3 xl:grid-cols-4/);
  assert.match(page, /<ParkedCartsPanel/);
  assert.doesNotMatch(page, /Nouvelle vente/);
  assert.doesNotMatch(page, /Caissier:\{/);
  assert.match(page, /setConfirmDiscard/);
  assert.match(page, /min-w-\[430px\] items-center/);
  assert.match(page, /aria-label=\{"Augmenter " \+ item.name\}/);
  assert.match(page, /aria-label=\{"Diminuer " \+ item.name\}/);
  assert.match(page, /role="dialog" aria-modal="true" aria-labelledby="park-modal-title"/);
  assert.match(page, /setParkModalOpen\(true\)/);
  assert.match(page, /onClick=\{\(\) => void parkCurrentCart\(\)\}/);
  assert.ok(page.indexOf("setParkModalOpen(true)") > page.indexOf(">Paiement</div>"), "hold action is next to checkout");
  assert.ok(page.indexOf("<ParkedCartsPanel") < page.indexOf(">Paiement</div>"), "parked slips precede payment");
  assert.match(page, /href="#pos-pending-section"/);
  assert.match(page, /xl:hidden/);
});

test("saving one branch never wipes parked tabs from another branch or legacy Main", () => {
  const storage = load("../lib/posParkedBranchStorage.ts");
  const all = [
    { id: "legacy", items: [] },
    { id: "first", branchId: "1", items: [] },
    { id: "second", branchId: "2", items: [] },
  ];
  assert.deepEqual(
    Array.from(storage.visibleParkedForBranch(all, "2", false), x => x.id),
    ["second"],
  );
  assert.deepEqual(
    Array.from(storage.visibleParkedForBranch(all, "1", true), x => x.id),
    ["legacy", "first"],
  );
  const merged = storage.mergeParkedForBranch(all, [{ id: "new-two", branchId: "2" }], "2", false);
  assert.deepEqual(Array.from(merged, x => x.id), ["legacy", "first", "new-two"]);
  const main = storage.mergeParkedForBranch(all, [{ id: "new-main", branchId: "1" }], "1", true);
  assert.deepEqual(Array.from(main, x => x.id), ["second", "new-main"]);
});

test("parked tab balance shows a remainder using current exchange rate, never posts a payment", () => {
  const items = [{ price: 500, qty: 2, currency: "HTG", taxRate: 0 }];
  const result = parkedBalance.calculateParkedBalance(items, { HTG: 200, USD: 30 }, "HTG", {
    exchangeSellRate: 10, exchangeBuyRate: 10,
  });
  assert.equal(result.currency, "HTG");
  assert.equal(result.total, 1000);
  assert.equal(result.deposit, 500);
  assert.equal(result.remaining, 500);
  assert.equal(result.overpayment, 0);
  const excess = parkedBalance.calculateParkedBalance(items, { HTG: 1200, USD: 0 }, "HTG", {});
  assert.equal(excess.remaining, 0);
  assert.equal(excess.overpayment, 200);
});

test("discount and tax affect indicative balance, but missing FX rates cannot invent a remainder", () => {
  const discounted = parkedBalance.calculateParkedBalance(
    [{ price: 100, qty: 2, currency: "HTG", taxRate: 10, discountType:"fixed", discountValue:15 }],
    { HTG: 50, USD: 0 }, "HTG", {},
  );
  assert.equal(discounted.total, 205);
  assert.equal(discounted.remaining, 155);
  const unknown = parkedBalance.calculateParkedBalance(
    [{ price: 1000, qty: 1, currency: "HTG", taxRate: 0 }],
    { HTG: 0, USD: 10 }, "HTG", {},
  );
  assert.equal(unknown.remaining, null);
  assert.equal(unknown.deposit, null);
});
