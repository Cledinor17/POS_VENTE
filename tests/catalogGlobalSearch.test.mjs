import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadCatalogApi(apiFetch) {
  const source = readFileSync(new URL("../lib/catalogApi.ts", import.meta.url), "utf8");
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(code, {
    module,
    exports: module.exports,
    URLSearchParams,
    require: name => {
      if (name === "./api") return { apiFetch };
      if (name === "./imageUpload") return { assertImageSize: () => {} };
      throw new Error("Unexpected import: " + name);
    },
  });
  return module.exports;
}

test("catalogue search requests the full branch catalogue before page slicing", async () => {
  let path = "";
  const api = loadCatalogApi(async requestedPath => {
    path = requestedPath;
    return {
      current_page: 1,
      last_page: 1,
      total: 1,
      per_page: 10,
      data: [{ id: 84, sku: "BEER-84", name: "HEINEKEN", is_active: true, selling_price: 80, stock_quantity: 24 }],
    };
  });

  const result = await api.getProductPage("demo", { page: 1, perPage: 10, q: " HEINEKEN ", status: "active" });
  assert.match(path, /\/products\?/);
  const query = new URLSearchParams(path.split("?")[1]);
  assert.equal(query.get("q"), "HEINEKEN");
  assert.equal(query.get("per_page"), "10");
  assert.equal(query.get("page"), "1");
  assert.equal(query.get("status"), "active");
  assert.equal(result.total, 1);
  assert.equal(result.lastPage, 1);
  assert.equal(result.items[0].name, "HEINEKEN");
});

test("catalogue metadata is preserved across multiple pages", async () => {
  const api = loadCatalogApi(async () => ({
    current_page: 3,
    last_page: 10,
    total: 93,
    per_page: 10,
    data: [{ id: 31, name: "JUMEX", sku: "JUMEX-31", is_active: true }],
  }));

  const result = await api.getProductPage("demo", { page: 3 });
  assert.equal(result.page, 3);
  assert.equal(result.lastPage, 10);
  assert.equal(result.total, 93);
  assert.equal(result.items.length, 1);
});
