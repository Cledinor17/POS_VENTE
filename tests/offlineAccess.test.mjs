import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function fixture(online = false) {
  const values = new Map();
  class ApiError extends Error {}
  const code = ts.transpileModule(
    readFileSync(new URL("../lib/offlineAccess.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const module = { exports: {} };
  runInNewContext(code, {
    exports: module.exports, module, navigator: { onLine: online }, Date, JSON, TypeError,
    require(id) {
      if (id === "./api") return { ApiError };
      if (id === "./safeStorage") return {
        safeGetItem: (key) => values.get(key) ?? null,
        safeSetItem: (key, value) => values.set(key, value),
        safeRemoveItem: (key) => values.delete(key),
      };
      throw new Error(id);
    },
  });
  return { ...module.exports, values, ApiError };
}

test("offline identity contains only minimal user data, never credentials", () => {
  const f = fixture();
  f.rememberOfflineIdentity({
    user: { id: 7, name: "Cashier", email: "cashier@example.test", password: "SECRET", locale: "fr" },
    businesses: [{ id: 9, slug: "shop", name: "Shop", pivot: { role: "cashier", status: "active", permissions: ["create_invoices"] } }],
    permissions: ["create_invoices"],
  });
  const stored = JSON.stringify([...f.values]);
  assert.ok(!stored.includes("SECRET"));
  assert.equal(f.readOfflineIdentity().user.id, 7);
  f.clearOfflineIdentity();
  assert.equal(f.readOfflineIdentity(), null);
});

test("offline snapshots expire and cannot be used in a future timestamp", () => {
  const f = fixture();
  const key = f.offlineScopeKey("branches", "shop", 7);
  f.rememberOfflineValue(key, ["branch-1"]);
  assert.equal(f.readOfflineValue(key)[0], "branch-1");
  const record = JSON.parse(f.values.get(key));
  record.savedAt = Date.now() - 13 * 60 * 60 * 1000;
  f.values.set(key, JSON.stringify(record));
  assert.equal(f.readOfflineValue(key), null);
});

test("network outages are not confused with API authorization failures", () => {
  const f = fixture();
  assert.equal(f.isNetworkUnavailable(new TypeError("fetch failed")), true);
  assert.equal(f.isNetworkUnavailable(new f.ApiError("Forbidden")), false);
  const keys = [
    f.offlineScopeKey("cash-session", "shop", 7, "branch-1"),
    f.offlineScopeKey("cash-session", "shop", 8, "branch-1"),
    f.offlineScopeKey("cash-session", "shop", 7, "branch-2"),
  ];
  assert.equal(new Set(keys).size, 3);
});
