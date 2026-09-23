import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Run the shipped TypeScript modules with only HTTP replaced; no browser or live data.
function loadTs(url, mocks = {}) {
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(compiled, {
    exports: loadedModule.exports,
    module: loadedModule,
    require: (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith(".")) return loadTs(new URL(`${name}.ts`, url), mocks);
      return require(name);
    },
  });
  return loadedModule.exports;
}

const { calculateDocumentAmounts } = loadTs(new URL("../lib/documentCurrency.ts", import.meta.url));
const settings = { currency: "HTG", exchangeRateDirection: "usd_to_htg", exchangeRateValue: 130 };
const dualRates = { exchangeBuyRate: 130, exchangeSellRate: 140 };
const { convertAmount, convertPayment } = loadTs(new URL("../lib/currency.ts", import.meta.url));
const { pricePosCart } = loadTs(new URL("../lib/posCurrency.ts", import.meta.url));
const line = (currency, unitPrice = 10, name = "Article") => ({ name, currency, quantity: 1, unitPrice, taxRate: 0 });

test("manual articles use the business currency", () => {
  const result = calculateDocumentAmounts([line(undefined, 1300)], settings);
  assert.equal(result.currency, "HTG");
  assert.equal(result.total, 1300);
});

test("one product currency is retained; empty rows do not change the currency", () => {
  const result = calculateDocumentAmounts([line("USD"), line(undefined, 0, "")], settings);
  assert.equal(result.currency, "USD");
  assert.equal(result.total, 10);
  assert.equal(result.mixedCurrencies, false);
});

test("mixed products become HTG using the business rate without changing source prices", () => {
  const usd = line("USD");
  const result = calculateDocumentAmounts([usd, line("HTG", 1300)], settings);
  assert.equal(result.currency, "HTG");
  assert.equal(result.total, 2600);
  assert.equal(result.amounts[0].unitPrice, 1300);
  assert.equal(usd.unitPrice, 10);
  assert.equal(calculateDocumentAmounts([usd], settings).total, 10);
});

test("mixed products become USD for a USD business", () => {
  const result = calculateDocumentAmounts([line("USD"), line("HTG", 1300)], { ...settings, currency: "USD" });
  assert.equal(result.currency, "USD");
  assert.equal(result.total, 20);
});

test("inverse rates, quantities and taxes use converted unit prices", () => {
  const result = calculateDocumentAmounts([{ ...line("USD"), quantity: 2, taxRate: 10 }, line("HTG", 125)], {
    currency: "HTG", exchangeRateDirection: "htg_to_usd", exchangeRateValue: 0.008,
  });
  assert.equal(result.amounts[0].unitPrice, 1250);
  assert.equal(result.subtotal, 2625);
  assert.equal(result.tax, 250);
  assert.equal(result.total, 2875);
});

test("USD conversion rounds unit prices before multiplying quantities, like the server", () => {
  const result = calculateDocumentAmounts([{ ...line("HTG", 100), quantity: 3 }, line("USD", 1)], {
    ...settings, currency: "USD",
  });
  assert.equal(result.amounts[0].unitPrice, 0.77);
  assert.equal(result.total, 3.31);
});

test("quote and proforma API payloads carry the document and original line currencies", async () => {
  const sent = [];
  const api = loadTs(new URL("../lib/documentsApi.ts", import.meta.url), {
    "./api": { apiFetch: async (path, options) => { sent.push({ path, payload: options.json }); return { id: 1, ...options.json }; } },
  });
  for (const type of ["quote", "proforma"]) {
    await api.createSalesDocument("shop", {
      type, currency: "HTG", items: [line("USD"), line("HTG", 1300)],
    });
  }
  assert.equal(sent.length, 2);
  for (const { payload } of sent) {
    assert.equal(payload.currency, "HTG");
    assert.equal(payload.items[0].currency, "USD");
    assert.equal(payload.items[0].unit_price, 10);
    assert.equal(payload.items[1].currency, "HTG");
  }
});

test("API does not inject USD when the caller leaves currency to the server", async () => {
  let payload;
  const api = loadTs(new URL("../lib/documentsApi.ts", import.meta.url), {
    "./api": { apiFetch: async (_path, options) => { payload = options.json; return { id: 1, currency: "HTG" }; } },
  });
  await api.createSalesDocument("shop", { type: "quote", items: [line(undefined, 1300)] });
  assert.equal(Object.hasOwn(payload, "currency"), false);
  assert.equal(Object.hasOwn(payload.items[0], "currency"), false);
});

test("cashier document settings use the billing endpoint and normalize its exchange settings", async () => {
  let requested;
  const api = loadTs(new URL("../lib/documentsApi.ts", import.meta.url), {
    "./api": { apiFetch: async (path) => {
      requested = path;
      return { currency: "HTG", exchange_rate_direction: "htg_to_usd", exchange_rate_value: "0.008" };
    } },
  });
  const config = await api.getDocumentCurrencySettings("shop");
  assert.equal(requested, "/api/app/shop/documents/currency-settings");
  assert.equal(config.currency, "HTG");
  assert.equal(config.exchangeRateValue, 0.008);
  assert.equal(config.exchangeRateDirection, "htg_to_usd");
});

test("payments apply the inverse of their quote, without crossing the spread", () => {
  assert.equal(convertAmount(10, "USD", "HTG", dualRates), 1400);
  assert.equal(convertPayment(1400, "HTG", "USD", dualRates), 10);
  assert.equal(convertAmount(1300, "HTG", "USD", dualRates), 10);
  assert.equal(convertPayment(10, "USD", "HTG", dualRates), 1300);
  assert.equal(convertAmount(10, "USD", "USD", dualRates), 10);
});

test("mixed quotes use the business currency and the appropriate commercial rate", () => {
  assert.equal(calculateDocumentAmounts([line("USD", 10), line("HTG", 1300)], { currency: "HTG", ...dualRates }).total, 2700);
  assert.equal(calculateDocumentAmounts([line("USD", 10), line("HTG", 1300)], { currency: "USD", ...dualRates }).total, 20);
});

test("mixed POS baskets convert each source once, including switching the payment currency", () => {
  const source = [{ price: 10, currency: "USD" }, { price: 1300, currency: "HTG" }];
  const usd = pricePosCart(source, "USD", "HTG", dualRates);
  assert.equal(usd.currency, "USD");
  assert.equal(usd.items.reduce((sum, item) => sum + item.price, 0), 20);
  const htg = pricePosCart(source, "HTG", "HTG", dualRates);
  assert.equal(htg.currency, "HTG");
  assert.equal(htg.items.reduce((sum, item) => sum + item.price, 0), 2700);
  assert.equal(pricePosCart(source, "USD", "HTG", dualRates).items[0].price, 10);
  assert.equal(source[0].price, 10);
});

test("line fixed discounts follow their own original currency when changing the basket", () => {
  const result = pricePosCart([{ price: 10, currency: "USD", discountType: "fixed", discountValue: 2, discountCurrency: "USD" }, { price: 1300, currency: "HTG" }], "HTG", "HTG", dualRates);
  assert.equal(result.items[0].discountValue, 280);
});

test("dollar purchase API sends the confirmed rate and stable reference with the cash branch", async () => {
  const calls = [];
  const api = loadTs(new URL("../lib/dollarPurchasesApi.ts", import.meta.url), {
    "./api": { apiFetch: async (path, options) => { calls.push({ path, options }); return { data: { id: 1 } }; } },
  });
  const input = { idempotency_key: "same-reference", usd_amount: 100, buy_rate: 130, customer_name: "Client" };
  await api.createDollarPurchase("shop", "2", input);
  await api.createDollarPurchase("shop", "2", input);
  assert.equal(calls[0].options.headers["X-Branch-Id"], "2");
  assert.equal(calls[0].options.json.idempotency_key, calls[1].options.json.idempotency_key);
  assert.equal(calls[0].options.json.buy_rate, 130);
});

test("purchase receipt prints saved amounts and escapes customer text", () => {
  const { dollarPurchaseReceiptHtml } = loadTs(new URL("../lib/dollarPurchasesApi.ts", import.meta.url), { "./api": {} });
  const html = dollarPurchaseReceiptHtml({ receipt_no: "ACH-1", usd_amount: 100, buy_rate: 130, htg_amount: 13000,
    customer_name: "<script>alert(1)</script>", business: { name: "Test" } });
  assert.ok(html.includes("13000.00 HTG"));
  assert.ok(html.includes("1 USD = 130 HTG"));
  assert.ok(html.includes("100.00 USD"));
  assert.ok(!html.includes("<script>"));
});
