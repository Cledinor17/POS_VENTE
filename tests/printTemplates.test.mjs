import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadTs(path, deps = {}) {
  const module = { exports: {} };
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(code, {
    exports: module.exports, module,
    require: name => {
      if (name in deps) return deps[name];
      throw new Error("Unexpected import " + name);
    },
  });
  return module.exports;
}
const model = loadTs("../lib/printTemplateModel.ts");

test("each paper starts from a safe independent branded template", () => {
  const papers = ["58mm", "80mm", "a4"];
  for (const paper of papers) {
    const template = model.defaultPrintTemplate(paper);
    assert.equal(template.paper, paper);
    assert.equal(template.show_logo, true);
    assert.equal(template.show_address, true);
    assert.equal(template.is_default, true);
  }
  assert.equal(model.defaultPrintTemplate("a4").logo_size, 100);
});

test("untrusted cached templates cannot inject CSS or arbitrary layouts", () => {
  const result = model.safePrintTemplate({
    paper: "a4", accent_color: "red;display:none", logo_size: 99999,
    name_size: -10, layout: "<script>", logo_position: "none",
    footer_text: "A".repeat(2000),
  }, "80mm");
  assert.equal(result.paper, "80mm");
  assert.equal(result.accent_color, "#172554");
  assert.equal(result.logo_size, 130);
  assert.equal(result.name_size, 12);
  assert.equal(result.layout, "brand");
  assert.equal(result.logo_position, "left");
  assert.equal(result.footer_text.length, 1000);
});

test("API scopes named template operations to the selected business", async () => {
  const calls = [];
  const api = loadTs("../lib/printTemplatesApi.ts", {
    "./api": { apiFetch: async (url, options) => {
      calls.push({ url, options });
      if (options?.method) return { data: { ...model.defaultPrintTemplate("80mm"), id: 9, name: "Hotel" } };
      return { data: [], effective: { "80mm": model.defaultPrintTemplate("80mm") } };
    } },
    "./printTemplateModel": model,
  });
  const list = await api.listPrintTemplates("hotel A");
  assert.equal(list.effective.a4.paper, "a4");
  const template = await api.createPrintTemplate("hotel A", {
    ...model.defaultPrintTemplate("80mm"), id: undefined, is_default: undefined, name: "Hotel",
  });
  await api.updatePrintTemplate("hotel A", template);
  await api.activatePrintTemplate("hotel A", template);
  await api.deletePrintTemplate("hotel A", template);
  assert.deepEqual(calls.map(x => x.url), [
    "/api/app/hotel%20A/print-templates",
    "/api/app/hotel%20A/print-templates",
    "/api/app/hotel%20A/print-templates/9",
    "/api/app/hotel%20A/print-templates/9/activate",
    "/api/app/hotel%20A/print-templates/9",
  ]);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[2].options.method, "PUT");
  assert.equal(calls[4].options.method, "DELETE");
});

test("live receipt applies business template without modifying monetary values", () => {
  const intl = loadTs("../lib/receiptI18n.ts", {
    "./locale": {
      DEFAULT_LOCALE: "fr",
      isSupportedLocale: v => ["fr", "en", "ht", "es", "zh", "ar"].includes(v),
    },
  });
  const receipt = loadTs("../lib/posReceipt.ts", {
    "./currency": { formatMoney: (v, c) => String(v) + " " + c },
    "./printHtml": { printHtmlDocument() {} },
    "./receiptI18n": intl,
    "./printTemplateModel": model,
  });
  const sale = {
    receiptNo:"TKT-1", businessName:"Destiné Hôtel", businessAddress:"Route Village SOS",
    businessPhone:"50911112222", businessEmail:"hello@test.ht", businessLogoSrc:"data:image/png;base64,QUJD",
    items:[{name:"Pina",sku:"A1",qty:1,price:400}], cashierName:"Cashier", createdAt:"2026-11-21T23:00:00-05:00",
    invoiceFooter:"Thank you", receiptQrCodeDataUri:"data:image/png;base64,QUJD",
    saleCurrency:"HTG", paymentMethod:"cash", paymentCurrency:"HTG", paymentAmount:400,
    subtotal:400,total:400,tax:0,discountAmount:0,cashReceived:500,change:100,
  };
  const styled = model.safePrintTemplate({
    ...model.defaultPrintTemplate("a4"), accent_color:"#123456", layout:"classic",
    show_logo:false, show_address:false, show_qr:false, show_footer:false,
  }, "a4");
  const html = receipt.buildReceiptHtml(sale, { paper:"a4", template:styled });
  assert.match(html, /layout-classic/);
  assert.match(html, /#123456/);
  assert.doesNotMatch(html, /class="logo"/);
  assert.doesNotMatch(html, /class="brand-address"/);
  assert.doesNotMatch(html, /class="qr-card"/);
  assert.doesNotMatch(html, /class="footer-note"/);
  assert.match(html, /400 HTG/);
  assert.match(html, /500 HTG/);
  assert.match(html, /100 HTG/);
  assert.match(html, /TKT-1/);
});

test("print settings translations are complete for six application locales", () => {
  const source = readFileSync(new URL("../messages/fr.json", import.meta.url), "utf8");
  const keys = Object.keys(JSON.parse(source).receiptDesigner).sort();
  for (const locale of ["en", "ht", "es", "zh", "ar"]) {
    const messages = JSON.parse(readFileSync(new URL("../messages/" + locale + ".json", import.meta.url), "utf8"));
    assert.deepEqual(Object.keys(messages.receiptDesigner).sort(), keys, locale);
    assert.ok(messages.settingsHub.tabs.templates);
  }
});

test("print designer is protected by business permissions and uses a sandboxed live preview", () => {
  const panel = readFileSync(new URL("../components/settings/panels/PrintTemplatesSettingsPanel.tsx", import.meta.url), "utf8");
  const hub = readFileSync(new URL("../components/settings/BusinessSettingsHub.tsx", import.meta.url), "utf8");
  assert.match(panel, /hasPermission\(permissions, "business.manage"\)/);
  assert.match(panel, /<iframe[^>]*sandbox=""/);
  assert.match(hub, /id: "templates", icon: Printer, permission: "billing.read"/);
});
