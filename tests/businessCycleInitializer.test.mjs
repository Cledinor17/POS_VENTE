import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadApi(apiFetch) {
  const source = readFileSync(new URL("../lib/businessCycleApi.ts", import.meta.url), "utf8");
  const module = { exports: {} };
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(transpiled, {
    module, exports: module.exports,
    require: name => {
      if (name === "./api") return { apiFetch };
      throw new Error("Unexpected import: " + name);
    },
  });
  return module.exports;
}

test("owner preview is scoped to selected tenant; activation needs token, slug and password", async () => {
  const calls = [];
  const api = loadApi(async (path, options = {}) => {
    calls.push({ path, options });
    return path.endsWith("/preview")
      ? { business: { id: 3, name: "Shop", slug: "shop" }, can_start: false, preview_token: "token" }
      : { message: "ok" };
  });
  const preview = await api.previewBusinessCycle("shop");
  assert.equal(preview.business.slug, "shop");
  await api.startBusinessCycle("shop", {
    previewToken: "token",
    confirmation: "shop",
    password: "hidden-password",
  });
  assert.equal(calls[0].path, "/api/app/shop/business/cycle/preview");
  assert.equal(calls[1].path, "/api/app/shop/business/cycle/start");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.json.confirmation, "shop");
  assert.equal(calls[1].options.json.preview_token, "token");
  assert.equal(calls[1].options.json.password, "hidden-password");
});

test("super admin initialization uses a separate platform route and exact business id", async () => {
  const calls = [];
  const api = loadApi(async (path, options) => {
    calls.push({ path, options });
    return path.includes("/initialization") ? { data: [{ id: 12, name: "Hotel", slug: "hotel" }] }
      : { business: { id: 12, name: "Hotel", slug: "hotel" }, can_start: false };
  });
  const list = await api.listPlatformBusinessesForCycle("Hotel");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 12);
  await api.previewBusinessCycle("hotel", 12);
  assert.equal(calls[0].path, "/api/platform/businesses/initialization?q=Hotel");
  assert.equal(calls[1].path, "/api/platform/businesses/12/cycle/preview");
});

test("the owner panel is only mounted for owner or platform administrator", () => {
  const source = readFileSync(new URL("../components/settings/panels/BusinessSettingsPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /currentBusinessEntry\?\.pivot\?\.role === "owner"/);
  assert.match(source, /user\?\.is_platform_admin === true/);
  assert.match(source, /canInitialize \? <BusinessCycleInitializer/);
});
