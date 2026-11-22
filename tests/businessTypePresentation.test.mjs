import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { parse } = require("next/dist/compiled/node-html-parser");
function load(path, mocks = {}) {
  const module = { exports: {} };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, process: { env: {} }, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) });
  return module.exports;
}
const access = load("lib/businessAccess.ts");
const businessApi = load("lib/businessApi.ts", { "./api": {} });

test("permission settings hide hotel groups for all non-hotel types without changing selected rights", () => {
  const Checklist = load("components/PermissionChecklist.tsx", {
    react: { ...React, useMemo: fn => fn() }, "@/lib/businessAccess": access,
  }).default;
  const selected = [...access.ALL_PERMISSIONS];
  for (const businessType of businessApi.BUSINESS_TYPES) {
    const html = renderToStaticMarkup(React.createElement(Checklist, {
      selected, allowedPermissions: [...access.ALL_PERMISSIONS], onToggle() {}, businessType,
    }));
    const text = parse(html).textContent;
    if (businessType === "hotel") assert.match(text, /Parametrage hotel/);
    else assert.doesNotMatch(text, /hotel|chambre|housekeeping|piscine|room service|sejours|moments/i);
    assert.match(text, /Clients/);
    assert.match(text, /Services/);
    assert.match(text, /Restaurant/);
  }
  assert.deepEqual(selected, [...access.ALL_PERMISSIONS]);
});

test("business configuration does not display hotel modules or currency advice for other types", () => {
  for (const businessType of businessApi.BUSINESS_TYPES) {
    const Panel = load("components/settings/panels/BusinessSettingsPanel.tsx", {
      react: { ...React, useEffect() {}, useMemo: fn => fn(), useState: initial => [
        initial && typeof initial === "object" && "businessType" in initial ? { ...initial, businessType } : initial === true ? false : initial,
        () => {},
      ] },
      "next/navigation": { useParams: () => ({ business: "demo" }) },
      "next/link": ({ children, ...props }) => React.createElement("a", props, children),
      "next/image": props => React.createElement("img", props),
      "@/lib/usePermissionGuard": { usePermissionGuard: () => ({ allowed: true, loading: false }) },
      "@/lib/api": { ApiError: Error },
      "@/lib/businessApi": businessApi,
      "@/lib/currency": { formatExchangeRateSummary: () => "HTG / USD" },
      "@/components/PhoneField": () => null,
      "../DataSpaceSettings": () => null,
      "../BusinessCycleInitializer": () => null,
      "@/context/AuthContext": { useAuth: () => ({ user: { is_platform_admin: false } }) },
      "@/lib/useBusinessPermissions": {
        useBusinessPermissions: () => ({
          currentBusinessEntry: { slug: "demo", pivot: { role: "manager" } },
        }),
      },
    }).default;
    const dom = parse(renderToStaticMarkup(React.createElement(Panel, { embedded: true })));
    // The activity selector still allows the owner to change to another business type.
    dom.querySelectorAll("option").forEach(option => option.remove());
    if (businessType === "hotel") assert.match(dom.textContent, /chambres\/nuit/);
    else assert.doesNotMatch(dom.textContent, /hotel|chambre|housekeeping|piscine|moments/i);
    assert.match(dom.textContent, /produits dans leur devise/);
  }
});

test("the business type follows the requested business instead of a previous active business", () => {
  const auth = { businesses: [{ slug: "shop", business_type: "retail" }], activeBusiness: { slug: "old", business_type: "hotel" }, permissions: [] };
  const { useBusinessPermissions } = load("lib/useBusinessPermissions.ts", {
    react: { useMemo: fn => fn() }, "@/context/AuthContext": { useAuth: () => auth }, "@/lib/businessAccess": access,
  });
  assert.equal(useBusinessPermissions("shop").businessType, "retail");
  assert.equal(useBusinessPermissions("old").businessType, "hotel");
  assert.equal(useBusinessPermissions("new").businessType, "other");
});
