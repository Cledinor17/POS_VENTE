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
  const module = { exports: {} };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), ...globals });
  return module.exports;
}
const access = load("lib/businessAccess.ts");
function translations(locale = "fr") {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
  return namespace => createTranslator({ locale, messages, namespace, onError: error => { throw error; } });
}
function walk(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate));
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function hub({ section = "products", initialTab, permissions = access.ALL_PERMISSIONS, locale = "fr" } = {}) {
  const state = []; let cursor = 0; let business = "demo"; let focused = "";
  const scope = { permissions, loading: false };
  const Hub = load("components/management/ManagementHub.tsx", {
    react: { ...React, useId: () => "management-test", useState: initial => {
      const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    } },
    "next/navigation": { useParams: () => ({ business }) },
    "next-intl": { useLocale: () => locale, useTranslations: translations(locale) },
    "next/dynamic": loader => {
      const name = loader.toString().match(/panels\/([\w]+)/)?.[1];
      return function Probe({ active }) { return React.createElement("div", { "data-panel": name, "data-active": active }); };
    },
    "@/lib/useBusinessPermissions": { useBusinessPermissions: () => scope },
    "@/lib/businessAccess": access,
  }, { document: { getElementById: id => ({ focus: () => { focused = id; } }) } }).default;
  const content = Hub({ section, initialTab }); let tree;
  function render() { cursor = 0; tree = content.type(content.props); return parse(renderToStaticMarkup(tree)); }
  const buttons = () => walk(tree, node => node.props?.role === "tab");
  const tab = id => buttons().find(node => node.props.id.endsWith(`-tab-${id}`));
  return {
    render, scope, selected: () => buttons().find(node => node.props["aria-selected"])?.props.id.split("-tab-")[1],
    ids: () => buttons().map(node => node.props.id.split("-tab-")[1]),
    click: id => { tab(id).props.onClick(); return render(); },
    choose: id => { walk(tree, node => node.type === "select")[0].props.onChange({ target: { value: id } }); return render(); },
    child: id => walk(tree, node => node.props?.role === "tabpanel").find(node => node.props.id.endsWith(`-panel-${id}`))?.props.children,
    key: (id, key) => { tab(id).props.onKeyDown({ key, preventDefault() {} }); render(); return focused; },
    businessKey: name => { business = name; return Hub({ section, initialTab }).key; },
  };
}

test("management tabs reuse panels, preserve drafts and select the existing deep-link destination", () => {
  const h = hub(); const dom = h.render();
  assert.deepEqual(h.ids(), ["products", "categories", "transfers", "inventory"]);
  assert.equal(dom.querySelectorAll("h1").length, 1);
  assert.equal(dom.querySelectorAll("[data-panel]").length, 1);
  const products = h.child("products");
  h.click("categories");
  assert.equal(h.child("products").type, products.type);
  assert.equal(h.child("products").props.active, false);
  assert.equal(h.child("categories").props.active, true);
  h.click("inventory");
  assert.equal(h.render().querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
  h.child("products").props.onSelectTab("products"); h.render();
  assert.equal(h.selected(), "products");
  assert.notEqual(h.businessKey("demo"), h.businessKey("other-business"));
  for (const initialTab of ["categories", "inventory", "transfers"]) {
    const linked = hub({ initialTab }); linked.render(); assert.equal(linked.selected(), initialTab);
  }
  const supplier = hub({ section: "suppliers", initialTab: "purchase_orders" }); supplier.render();
  assert.deepEqual(supplier.ids(), ["suppliers", "purchase_orders"]);
  assert.equal(supplier.selected(), "purchase_orders");
  supplier.click("suppliers"); assert.equal(supplier.child("purchase_orders").props.active, false);
  const accounting = hub({ section: "accounting", initialTab: "bank" }); accounting.render();
  assert.deepEqual(accounting.ids(), ["accounting", "periods", "finance", "bank"]);
  assert.equal(accounting.selected(), "bank");
  const bank = accounting.child("bank");
  accounting.click("accounting");
  assert.equal(accounting.child("bank").type, bank.type);
  assert.equal(accounting.child("bank").props.active, false);
  accounting.click("periods");
  const periods = accounting.child("periods");
  accounting.click("finance");
  assert.equal(accounting.child("periods").type, periods.type);
  assert.equal(accounting.child("periods").props.active, false);
  assert.equal(accounting.child("finance").props.active, true);
  accounting.click("periods");
  assert.equal(accounting.child("periods").props.active, true);
  accounting.scope.permissions = ["accounting.read"];
  accounting.render();
  assert.deepEqual(accounting.ids(), ["accounting", "periods", "bank"]);
  assert.equal(accounting.child("finance"), undefined);
  accounting.scope.permissions = [];
  assert.equal(accounting.render().querySelectorAll("[data-panel]").length, 0);
  const PeriodsPage = load("app/[business]/accounting/periods/page.tsx", { "@/components/management/ManagementHub": () => null }).default;
  assert.equal(PeriodsPage().props.section, "accounting");
  assert.equal(PeriodsPage().props.initialTab, "periods");
  const linkedPeriods = hub({ section: "accounting", initialTab: "periods" });
  const linkedDom = linkedPeriods.render();
  assert.equal(linkedPeriods.selected(), "periods");
  assert.equal(linkedDom.querySelectorAll('[data-panel]').length, 1);
  assert.ok(linkedDom.querySelector('[data-panel="AccountingPeriodsPanel"]'));
});

test("tabs honor scoped permissions, loading, keyboard navigation and all application languages", () => {
  const h = hub({ permissions: ["inventory.read"] }); h.render();
  assert.deepEqual(h.ids(), ["transfers", "inventory"]);
  assert.equal(h.selected(), "transfers");
  h.click("inventory"); h.scope.permissions = ["supplies.read"]; h.render();
  assert.deepEqual(h.ids(), ["products", "categories"]);
  assert.equal(h.child("inventory"), undefined);
  h.scope.loading = true;
  assert.equal(h.render().querySelectorAll("[data-panel]").length, 0);
  for (const locale of ["fr", "en", "es", "ht", "ar", "zh"]) {
    const translated = hub({ locale }); translated.render();
    translated.key("products", "End"); assert.equal(translated.selected(), "inventory");
    translated.key("inventory", "Home"); assert.equal(translated.selected(), "products");
    translated.key("products", "ArrowRight"); assert.equal(translated.selected(), locale === "ar" ? "inventory" : "categories");
    const supplier = hub({ locale, section: "suppliers" }); assert.equal(supplier.render().querySelectorAll('[role="tab"]').length, 2);
    const accounting = hub({ locale, section: "accounting" }); assert.equal(accounting.render().querySelectorAll('[role="tab"]').length, 4);
    const reports = hub({ locale, section: "reports", permissions: ["reports.read"] });
    const dom = reports.render();
    assert.equal(dom.querySelectorAll('[role="tab"]').length, 6);
    assert.equal(dom.querySelectorAll('select option').length, 6);
  }
});

test("sidebar removes billing and relocated entries and highlights their new parent", () => {
  let pathname = "/demo/inventory/transfers"; let permissions = access.ALL_PERMISSIONS;
  let moduleSettings;
  const Sidebar = load("components/Sidebar.tsx", {
    react: { ...React, useEffect() {}, useMemo: calculate => calculate(), useId: () => "menu", useState: initial => [
      initial && typeof initial === "object" && "businessType" in initial ? moduleSettings ?? initial : initial, () => {},
    ] },
    "next/navigation": { useParams: () => ({ business: "demo" }), usePathname: () => pathname },
    "next-intl": { useTranslations: translations() },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/image": props => React.createElement("img", props),
    "../lib/businessAccess": access,
    "../lib/businessApi": {},
    "../context/AuthContext": { useAuth: () => ({ businesses: [], activeBusiness: null, permissions }) },
  }).default;
  const render = () => parse(renderToStaticMarkup(React.createElement(Sidebar)));
  let dom = render();
  assert.doesNotMatch(dom.textContent, /Facturation|Stocks et achats/);
  for (const path of ["categories", "inventory", "inventory/transfers", "purchase-orders", "invoices", "returns", "bank"]) {
    assert.equal(dom.querySelector(`a[href="/demo/${path}"]`), null);
  }
  assert.ok(dom.querySelector('a[href="/demo/reports"]'));
  assert.equal(dom.querySelectorAll('a[href^="/demo/reports/"]').length, 0);
  assert.equal(dom.querySelector('a[href="/demo/products"]').getAttribute("aria-current"), "page");
  pathname = "/demo/purchase-orders/42"; dom = render();
  assert.equal(dom.querySelector('a[href="/demo/suppliers"]').getAttribute("aria-current"), "page");
  pathname = "/demo/bank"; dom = render();
  assert.equal(dom.querySelector('a[href="/demo/accounting"]').getAttribute("aria-current"), "page");
  pathname = "/demo/reports/finance"; dom = render();
  assert.equal(dom.querySelector('a[href="/demo/reports"]').getAttribute("aria-current"), "page");
  permissions = ["inventory.read"]; dom = render();
  assert.ok(dom.querySelector('a[href="/demo/products"]'));
  assert.equal(dom.querySelector('a[href="/demo/suppliers"]'), null);
  assert.equal(dom.querySelector('a[href="/demo/reports"]'), null);

  permissions = access.ALL_PERMISSIONS;
  moduleSettings = { businessSlug: "demo", businessType: "hotel", hotel: true, restaurant: true, pool: true, services: true, moment: true };
  dom = render();
  assert.match(dom.textContent, /Hôtel et services/);
  assert.ok(dom.querySelector('a[href="/demo/hotel/rooms"]'));
  assert.ok(dom.querySelector('a[href="/demo/pool"]'));
  assert.equal(dom.querySelectorAll('a[href="/demo/services"]').length, 1);

  const { BUSINESS_TYPES } = load("lib/businessApi.ts", { "./api": {} });
  for (const type of BUSINESS_TYPES.filter(type => type !== "hotel")) {
    // Even enabled feature flags cannot turn a non-hotel business into a hotel menu.
    moduleSettings = { ...moduleSettings, businessType: type };
    dom = render();
    assert.doesNotMatch(dom.textContent, /Hôtel et services/);
    assert.equal(dom.querySelectorAll('a[href^="/demo/hotel/"]').length, 0);
    assert.equal(dom.querySelector('a[href="/demo/pool"]'), null);
    assert.equal(dom.querySelectorAll('a[href="/demo/services"]').length, 1);
    const management = dom.querySelectorAll("nav > section").find(section => section.querySelector("h2")?.textContent === "Gestion");
    assert.ok(management.querySelector('a[href="/demo/services"]'));
    if (["restaurant", "bar_cafe"].includes(type)) {
      assert.ok(dom.querySelector('a[href="/demo/restaurant/orders"]'));
      assert.ok(dom.querySelector('a[href="/demo/restaurant/tables"]'));
    }
  }

  moduleSettings = { ...moduleSettings, services: false };
  assert.equal(render().querySelector('a[href="/demo/services"]'), null);
  moduleSettings = { ...moduleSettings, businessType: "hotel", services: true, businessSlug: "previous-business" };
  assert.doesNotMatch(render().textContent, /Hôtel et services/);
  assert.equal(render().querySelectorAll('a[href^="/demo/hotel/"]').length, 0);
  moduleSettings = { ...moduleSettings, businessSlug: "demo" };
  permissions = ["inventory.read"];
  assert.doesNotMatch(render().textContent, /Hôtel et services/);
  assert.equal(render().querySelector('a[href="/demo/services"]'), null);
});

test("reports share one selection on desktop and mobile without discarding visited filters", () => {
  const h = hub({ section: "reports", permissions: ["reports.read"] });
  let dom = h.render();
  assert.deepEqual(h.ids(), ["sales", "stock", "departments", "cash_sessions", "receivables", "finance"]);
  assert.equal(h.selected(), "sales");
  assert.equal(dom.querySelectorAll('[data-panel]').length, 1);
  assert.match(dom.querySelector('[role="tablist"]').getAttribute("class"), /hidden.*md:grid/);
  assert.match(dom.querySelector('select').parentNode.getAttribute("class"), /md:hidden/);
  const sales = h.child("sales");
  dom = h.choose("stock");
  assert.equal(h.selected(), "stock");
  assert.equal(h.child("sales").type, sales.type);
  assert.equal(h.child("sales").props.active, false);
  assert.equal(h.child("stock").props.active, true);
  assert.equal(dom.querySelector('select').getAttribute("aria-controls"), "management-test-panel-stock");
  dom = h.click("finance");
  assert.equal(dom.querySelector('option[selected]').getAttribute("value"), "finance");
  assert.equal(dom.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
  h.scope.permissions = [];
  dom = h.render();
  assert.equal(dom.querySelectorAll('[data-panel]').length, 0);
  assert.equal(dom.querySelector('select'), null);
  const destinations = { sales: "sales", inventory: "stock", departments: "departments", "cash-sessions": "cash_sessions", ar: "receivables", finance: "finance" };
  for (const [route, initialTab] of Object.entries(destinations)) {
    const Page = load(`app/[business]/reports/${route}/page.tsx`, { "@/components/management/ManagementHub": () => null }).default;
    assert.equal(Page().props.section, "reports");
    assert.equal(Page().props.initialTab, initialTab);
    const linked = hub({ section: "reports", initialTab, permissions: ["reports.read"] });
    linked.render(); assert.equal(linked.selected(), initialTab);
  }
});
