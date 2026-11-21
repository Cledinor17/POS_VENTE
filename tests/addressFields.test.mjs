import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const module = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL('../components/AddressFields.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  module, exports: module.exports,
  require: name => name === '@/lib/geoApi' || name === 'next-intl' ? {} : require(name),
});
const { normalizeAddress, selectAddressCountry, selectAddressState } = module.exports;

test('country changes clear the former region and city but preserve street and postal code', () => {
  const original = normalizeAddress({ country: 'Haïti', country_code: 'HT', state: 'Nord', city: 'Cap-Haïtien', line1: '12 rue A', zip: null });
  const changed = selectAddressCountry(original, { code: 'CA', name: 'Canada' });
  assert.equal(changed.country_code, 'CA');
  assert.equal(changed.state, '');
  assert.equal(changed.city, '');
  assert.equal(changed.line1, '12 rue A');
  assert.equal(changed.zip, '');
  assert.equal(original.city, 'Cap-Haïtien');
});

test('selecting a subdivision automatically suggests its city without preventing manual addresses', () => {
  const country = { subdivisions: [{ name: 'Nord', cities: ['Cap-Haïtien', 'Limonade'] }, { name: 'Ouest', cities: ['Port-au-Prince'] }] };
  const first = selectAddressState(normalizeAddress(), 'Nord', country);
  assert.equal(first.city, 'Cap-Haïtien');
  const second = selectAddressState(first, 'Ouest', country);
  assert.equal(second.city, 'Port-au-Prince');
  const manual = selectAddressState(second, 'Nouvelle région', country);
  assert.equal(manual.state, 'Nouvelle région');
  assert.equal(manual.city, '');
});

test('address prompts have translations in every supported language', () => {
  const locales = ['fr', 'en', 'es', 'ht', 'ar', 'zh'];
  const baseline = Object.keys(JSON.parse(readFileSync(new URL('../messages/fr.json', import.meta.url), 'utf8')).address);
  for (const locale of locales) {
    const address = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).address;
    assert.deepEqual(Object.keys(address), baseline);
    assert.ok(Object.values(address).every(value => typeof value === 'string' && value.trim()));
  }
});
