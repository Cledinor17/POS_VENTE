import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function transpile(path) {
  return ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
}
const locale = {
  DEFAULT_LOCALE: "fr",
  isSupportedLocale: input => ["fr", "en", "ht", "es", "zh", "ar"].includes(input),
};
const translations = { exports: {} };
runInNewContext(transpile("../lib/receiptI18n.ts"), {
  exports: translations.exports, module: translations,
  require: name => {
    if (name === "./locale") return locale;
    throw new Error("Unexpected import: " + name);
  },
});
const printed = [];
const receiptModule = { exports: {} };
runInNewContext(transpile("../lib/posReceipt.ts"), {
  exports: receiptModule.exports, module: receiptModule,
  require: name => {
    if (name === "./receiptI18n") return translations.exports;
    if (name === "./currency") return { formatMoney: (amount, code) => amount.toFixed(2) + " " + code };
    if (name === "./printHtml") return { printHtmlDocument: (html, options) => printed.push({ html, options }) };
    throw new Error("Unexpected import: " + name);
  },
});
const data = {
  saleId: "1", receiptNo: "TKT-000001", createdAt: "2026-11-21T23:37:00-05:00",
  businessName: "Destiné Hôtel", businessAddress: "Route Village SOS, Quartier-Morin, Haïti",
  businessPhone: "+509 1111-1111", businessEmail: "info@destine.test",
  businessLogoSrc: "data:image/png;base64,QUJD", invoiceFooter: "",
  cashierName: "Caissier", items: [{ name: "Pina colada", sku: "1234", qty: 1, price: 400 }],
  saleCurrency: "HTG", subtotal: 400, tax: 0, discountAmount: 0, total: 400,
  paymentMethod: "cash", paymentCurrency: "HTG", paymentAmount: 400,
  paymentDateLabel: null, receiptQrCodeDataUri: null, cashReceived: 500, change: 100,
};

test("brand-first layout: logo and business name, divider, address, then invoice data", () => {
  const html = receiptModule.exports.buildReceiptHtml({ ...data, locale: "fr" });
  const logo = html.indexOf('class="logo"');
  const brand = html.indexOf("Destiné Hôtel");
  const rule = html.indexOf('class="brand-rule"');
  const address = html.indexOf("Route Village SOS");
  const ticket = html.indexOf('class="header-card"');
  assert.ok(logo > 0);
  assert.ok(logo < brand && brand < rule && rule < address && address < ticket);
  assert.match(html, /<html lang="fr" dir="ltr">/);
  assert.match(html, /Paiement/);
  assert.match(html, /400\.00 HTG/);
  assert.match(html, /TKT-000001/);
});

test("layout is available as both actual A4 and thermal 80mm print jobs", () => {
  receiptModule.exports.printReceipt({ ...data, locale: "en" }, { paper: "a4" });
  receiptModule.exports.printReceipt({ ...data, locale: "en" });
  assert.match(printed[0].html, /size: A4/);
  assert.match(printed[0].html, /paper-a4/);
  assert.equal(printed[0].options.paperWidthMm, undefined);
  assert.match(printed[1].html, /paper-thermal/);
  assert.equal(printed[1].options.paperWidthMm, 80);
});

test("the receipt labels and language attributes track all six app locales", () => {
  const examples = {
    fr: ["Sous-total", "Merci"],
    en: ["Subtotal", "Thank you"],
    ht: ["Sou-total", "Mèsi"],
    es: ["Subtotal", "Gracias"],
    zh: ["小计", "感谢惠顾"],
    ar: ["المجموع الفرعي", "شكرًا"],
  };
  for (const [language, [label, thanks]] of Object.entries(examples)) {
    const html = receiptModule.exports.buildReceiptHtml({ ...data, locale: language });
    assert.match(html, new RegExp(label));
    assert.match(html, new RegExp(thanks));
    assert.match(html, new RegExp('lang="' + language + '"'));
  }
  assert.match(receiptModule.exports.buildReceiptHtml({ ...data, locale: "ar" }), /dir="rtl"/);
});

test("untrusted logo URLs and customer HTML cannot break the print document", () => {
  const html = receiptModule.exports.buildReceiptHtml({
    ...data, businessLogoSrc: "javascript:alert(1)", receiptQrCodeDataUri: "data:image/svg+xml;base64,PHN2Zz4=",
    businessName: '<img src=x onerror="alert(1)">', customerName: "<script>alert('hi')</script>",
  });
  assert.doesNotMatch(html, /src="javascript:/);
  assert.doesNotMatch(html, /src="data:image\/svg/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});
