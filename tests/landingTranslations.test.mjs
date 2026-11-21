import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createTranslator } from "next-intl";

const locales = ["fr", "en", "ht", "es", "zh", "ar"];
const messages = Object.fromEntries(locales.map(locale => [locale,
  JSON.parse(readFileSync(new URL(`../messages/landing/${locale}.json`, import.meta.url), "utf8")),
]));

function leaves(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof entry === "string" ? [[path, entry]] : leaves(entry, path);
  });
}

const reference = new Map(leaves(messages.fr));
const argumentsIn = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

for (const locale of locales) {
  test(`homepage copy is complete and renders without missing translations: ${locale}`, () => {
    const translated = new Map(leaves(messages[locale]));
    assert.deepEqual([...translated.keys()].sort(), [...reference.keys()].sort());
    assert.equal(Object.keys(messages[locale].solutions).length, 14);
    assert.deepEqual(Object.keys(messages[locale].plans), ["basic", "standard", "business", "enterprise"]);
    assert.deepEqual(Object.keys(messages[locale].applications), ["commerce", "billing", "hotel", "restaurant", "services", "finance"]);
    const t = createTranslator({ locale, messages: messages[locale], onError: error => { throw error; } });
    for (const [key, text] of translated) {
      assert.ok(text.trim(), `${locale}:${key} is empty`);
      assert.deepEqual(argumentsIn(text), argumentsIn(reference.get(key)), `${locale}:${key} lost interpolation values`);
      // Array entries are rendered as plain text via t.raw, not as ICU messages.
      if (/\.\d+$/.test(key)) continue;
      const values = { index: 1, start: 1, end: 4, total: 14, count: 4, amount: "2 550", title: "Demo", category: "Demo" };
      const rendered = key === "hero.title" ? t.rich(key, { em: chunks => chunks }) : t(key, values);
      assert.equal(typeof rendered, "string");
      assert.ok(rendered.length);
    }
    if (locale !== "fr") assert.notEqual(messages[locale].hero.title, messages.fr.hero.title);
  });
}
