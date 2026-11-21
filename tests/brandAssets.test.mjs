import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/brandAssets.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loadedModule = { exports: {} };
runInNewContext(js, {
  module: loadedModule,
  exports: loadedModule.exports,
  process: { env: { NEXT_PUBLIC_API_BASE_URL: "https://posapi.example.com" } },
});
const { resolveBusinessBrandLogo } = loadedModule.exports;

test("tenant logo URL uses the API base for Laravel storage paths", () => {
  assert.equal(
    resolveBusinessBrandLogo("", "businesses/12/logo.png"),
    "https://posapi.example.com/storage/businesses/12/logo.png",
  );
  assert.equal(
    resolveBusinessBrandLogo("/storage/businesses/12/logo.png"),
    "https://posapi.example.com/storage/businesses/12/logo.png",
  );
});

test("explicit HTTPS logo URL wins and missing logo uses platform favicon", () => {
  assert.equal(resolveBusinessBrandLogo("https://cdn.example.com/logo.png"), "https://cdn.example.com/logo.png");
  assert.equal(resolveBusinessBrandLogo("", ""), null);
  assert.equal(resolveBusinessBrandLogo(null, null), null);
});

test("javascript, blob and generic data scheme URLs are never used as favicons", () => {
  assert.equal(resolveBusinessBrandLogo("javascript:alert(1)"), null);
  assert.equal(resolveBusinessBrandLogo("blob:https://example.com/bad"), null);
  assert.equal(resolveBusinessBrandLogo("data:text/html,script"), null);
});
