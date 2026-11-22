import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { parse } = require("next/dist/compiled/node-html-parser");
function load(path, mocks = {}, globals = {}) {
  const loadedModule = { exports: {} };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    module: loadedModule, exports: loadedModule.exports,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), ...globals,
  });
  return loadedModule.exports;
}
const access = load("lib/businessAccess.ts");
const allIds = ["business", "branches", "users", "roles", "printers", "templates", "coupons", "audit", "backup"];

function harness({ permissions = access.ALL_PERMISSIONS, platform = false, locale = "fr", signedIn = true, loading = false } = {}) {
  const state = [];
  let cursor = 0;
  let focused = "";
  const auth = { user: signedIn ? { is_platform_admin: platform } : null };
  const scope = { permissions, loading, currentBusinessEntry: { slug: "demo", name: "Boutique Demo" } };
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
  const t = createTranslator({ locale, messages, namespace: "settingsHub", onError: error => { throw error; } });
  const Hub = load("components/settings/BusinessSettingsHub.tsx", {
    react: { ...React, useId: () => "settings-test", useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    } },
    "next-intl": { useLocale: () => locale, useTranslations: () => t },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/dynamic": loader => {
      // Panel boundaries are stubs: no API calls or business writes in these navigation tests.
      const name = loader.toString().match(/panels\/([\w]+)/)?.[1];
      return function PanelProbe({ active }) { return React.createElement("div", { "data-panel": name, "data-active": active }); };
    },
    "@/context/AuthContext": { useAuth: () => auth },
    "@/lib/useBusinessPermissions": { useBusinessPermissions: () => scope },
    "@/lib/businessAccess": access,
  }, { document: { getElementById: id => ({ focus: () => { focused = id; } }) } }).default;
  let tree;
  function render() { cursor = 0; tree = Hub({ business: "demo" }); return parse(renderToStaticMarkup(tree)); }
  function walk(node, predicate) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate));
    return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
  }
  const buttons = () => walk(tree, node => node.props?.role === "tab");
  const tab = id => buttons().find(node => node.props.id.endsWith(`-tab-${id}`));
  const panels = () => walk(tree, node => node.props?.role === "tabpanel");
  return {
    render, scope, auth, panels,
    ids: () => buttons().map(node => node.props.id.split("-tab-")[1]),
    selected: () => buttons().find(node => node.props["aria-selected"])?.props.id.split("-tab-")[1],
    click: id => { tab(id).props.onClick(); return render(); },
    key: (id, key) => { let prevented = false; tab(id).props.onKeyDown({ key, preventDefault: () => { prevented = true; } }); render(); return { prevented, focused }; },
    child: id => panels().find(node => node.props.id.endsWith(`-panel-${id}`))?.props.children,
  };
}

test("settings only mounts the chosen screen and keeps visited forms mounted with stable identities", () => {
  const h = harness();
  const dom = h.render();
  assert.deepEqual(h.ids(), allIds);
  assert.equal(dom.querySelectorAll("[data-panel]").length, 1);
  assert.equal(dom.querySelectorAll("h1").length, 1);
  const initial = h.child("business");
  h.click("branches");
  assert.equal(h.child("business").type, initial.type);
  assert.equal(h.child("business").props.active, false);
  assert.equal(h.child("branches").props.active, true);
  assert.equal(h.child("roles"), false);
  h.click("users");
  const users = h.child("users");
  users.props.onOpenRoles();
  h.render();
  assert.equal(h.selected(), "roles");
  h.click("users");
  assert.equal(h.child("users").type, users.type);
  const updated = h.render();
  assert.equal(updated.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
  for (const tab of updated.querySelectorAll('[role="tab"]')) {
    assert.ok(updated.querySelector(`[id="${tab.getAttribute("aria-controls")}"]`));
    assert.equal(tab.getAttribute("type"), "button");
  }
});

test("settings gates screens by permission and keeps platform configuration restricted", () => {
  for (const [permissions, expected] of [
    [[], []], [["business.read"], ["business", "branches", "coupons"]],
    [["users.read"], ["users"]], [["users.manage"], ["roles"]],
    [["billing.read"], ["printers", "templates"]], [["accounting.read"], []],
    [["audit.read"], ["audit"]], [["business.manage"], ["backup"]],
  ]) {
    const h = harness({ permissions });
    h.render();
    assert.deepEqual(h.ids(), expected);
    assert.equal(h.selected(), expected[0]);
    if (expected[0]) assert.equal(h.child(expected[0]).props.onOpenRoles !== undefined, expected.includes("roles"));
  }
  const platform = harness({ platform: true, permissions: [] });
  platform.render();
  assert.deepEqual(platform.ids(), ["mobile"]);
  const loading = harness({ signedIn: false, loading: true });
  assert.equal(loading.render().querySelectorAll("[data-panel]").length, 0);
  assert.deepEqual(loading.ids(), []);
});

test("revoked permissions remove already visited sensitive screens", () => {
  const h = harness();
  h.render(); h.click("backup");
  assert.ok(h.child("backup"));
  h.scope.permissions = ["business.read"];
  const dom = h.render();
  assert.equal(h.selected(), "business");
  assert.equal(h.child("backup"), undefined);
  assert.equal(dom.querySelectorAll('[data-panel="BackupSettingsPanel"]').length, 0);
});

test("tab keyboard navigation supports wraparound, Home, End and right-to-left layout", () => {
  const h = harness(); h.render();
  assert.equal(h.key("business", "ArrowLeft").focused, "settings-test-tab-backup");
  assert.equal(h.selected(), "backup");
  h.key("backup", "ArrowRight"); assert.equal(h.selected(), "business");
  h.key("business", "End"); assert.equal(h.selected(), "backup");
  h.key("backup", "Home"); assert.equal(h.selected(), "business");
  assert.equal(h.key("business", "Tab").prevented, false);
  const rtl = harness({ locale: "ar" }); rtl.render();
  rtl.key("business", "ArrowLeft"); assert.equal(rtl.selected(), "branches");
});

test("tab labels render in all six application languages", () => {
  for (const locale of ["fr", "en", "es", "ht", "ar", "zh"]) {
    const h = harness({ locale, platform: true });
    const dom = h.render();
    assert.equal(dom.querySelectorAll('[role="tab"]').length, 10);
    for (const tab of dom.querySelectorAll('[role="tab"]')) assert.ok(tab.textContent.trim());
  }
});
