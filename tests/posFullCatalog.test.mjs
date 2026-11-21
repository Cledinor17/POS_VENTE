import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadTs(path, mocks = {}) {
  const module = { exports: {} };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    module,
    exports: module.exports,
    URLSearchParams,
    require: name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error("Unexpected import " + name);
    },
  });
  return module.exports;
}

test("cash register fetches the whole active branch catalogue, not just Laravel's first page", async () => {
  const source = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(source, /await getProducts\(businessSlug,\s*\{\s*all:\s*true\s*\}\)/);

  const catalogue = Array.from({ length: 93 }, (_, index) => ({
    id: index + 1,
    name: index === 92 ? "HEINEKEN" : `Produit ${index + 1}`,
    sku: index === 92 ? "HEINEKEN-93" : `SKU-${index + 1}`,
    barcode: index === 92 ? "7891234567890" : "",
    category: { name: index === 92 ? "Bières" : "Divers" },
    is_active: true,
    selling_price: 80,
    stock_quantity: 24,
  }));
  let requestedPath = "";
  const catalogApi = loadTs("lib/catalogApi.ts", {
    "./api": { apiFetch: async path => {
      requestedPath = path;
      // The API defaults to ten records unless all=1 is requested.
      return path.includes("all=1") ? catalogue : { data: catalogue.slice(0, 10) };
    }},
    "./imageUpload": { assertImageSize: () => {} },
  });

  const products = await catalogApi.getProducts("demo", { all: true });
  assert.match(requestedPath, /\/products\?all=1/);
  assert.doesNotMatch(requestedPath, /all_branches/);
  assert.equal(products.length, 93);

  const query = "heineken";
  const matches = products.filter(item =>
    [item.name, item.sku, item.barcode, item.category].some(
      value => value.toLowerCase().includes(query),
    )
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].stock, 24);
  assert.equal(matches[0].category, "Bières");

  const barcodeApi = loadTs("lib/productBarcode.ts");
  const index = barcodeApi.buildProductScanIndex(products);
  assert.equal(barcodeApi.resolveScannedProduct(index, "7891234567890")?.name, "HEINEKEN");
  assert.equal(barcodeApi.resolveScannedProduct(index, "HEINEKEN-93")?.name, "HEINEKEN");
});
