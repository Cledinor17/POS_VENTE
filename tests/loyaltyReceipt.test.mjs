import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const i18n = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/receiptI18n.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module: i18n, exports: i18n.exports,
  require: name => {
    if (name === './locale') return {
      DEFAULT_LOCALE: 'fr',
      isSupportedLocale: value => ['fr', 'en', 'ht', 'es', 'zh', 'ar'].includes(value),
    };
    throw new Error('Unexpected receipt translation import: ' + name);
  },
});
const templates = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/printTemplateModel.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: templates, exports: templates.exports });
const loaded = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/posReceipt.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module: loaded, exports: loaded.exports,
  require: name => name === './currency' ? { formatMoney: (n, c) => `${n} ${c}` }
    : name === './printTemplateModel' ? templates.exports
    : name === './receiptI18n' ? i18n.exports
    : { printHtmlDocument() {} },
});
const receipt = {
  receiptNo: 'TKT-1', businessName: 'Boutique', cashierName: 'Jean', createdAt: '2026-10-05T10:00:00Z',
  items: [], saleCurrency: 'HTG', paymentMethod: 'cash', paymentCurrency: 'HTG', paymentAmount: 250,
  subtotal: 250, total: 250, tax: 0, discountAmount: 0, cashReceived: 250, change: 0, invoiceFooter: '',
};
const html = fields => loaded.exports.buildReceiptHtml({ ...receipt, ...fields });

test('client receipt shows earned points and total balance, including zero', () => {
  for (const earned of [0, 2]) {
    const result = html({ loyaltyEnabled: true, loyaltyPointsEarned: earned, loyaltyPointsBalanceAfter: 7 });
    assert.match(result, new RegExp(`Nouveaux points gagnés :</span><strong>${earned}</strong>`));
    assert.match(result, /Solde total des points :<\/span><strong>7<\/strong>/);
  }
});

test('inactive loyalty or missing client balance does not add a misleading total', () => {
  for (const fields of [{}, { loyaltyEnabled: false, loyaltyPointsBalanceAfter: 7 }, { loyaltyEnabled: true }]) {
    assert.doesNotMatch(html(fields), /Nouveaux points|Solde total des points/);
  }
});

test('offline receipt waits for server confirmation before claiming earned points', () => {
  const result = html({ loyaltyEnabled: true, loyaltyPending: true, loyaltyPointsBalanceAfter: 7 });
  assert.match(result, /disponibles après synchronisation/);
  assert.doesNotMatch(result, /Nouveaux points|Solde total des points/);
});
