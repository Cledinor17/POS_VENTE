import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/platformApi.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const calls = [];
const apiFetch = async (path, options = {}) => {
  calls.push({ path, options });
  if (path.endsWith("/summary")) return { data: { total: 2, active: 1, suspended: 1 } };
  if (path.includes("/events")) return { data: [], meta: { total: 0 } };
  if (options.method) return { data: { id: 1, name: "Test" } };
  if (path.includes("/businesses/")) return { data: { id: 1, name: "Test" } };
  return { data: [], meta: { total: 0, last_page: 1, current_page: 1 } };
};
const loadedModule = { exports: {} };
runInNewContext(js, {
  module: loadedModule,
  exports: loadedModule.exports,
  require: () => ({ apiFetch }),
  URLSearchParams,
});
const api = loadedModule.exports;

test("list uses platform-only route with encoded search and filters", async () => {
  calls.length = 0;
  await api.listPlatformBusinesses({ search: "  Salon & bar ", status: "suspended", page: 2 });
  assert.match(calls[0].path, /^\/api\/platform\/businesses\?/);
  assert.match(calls[0].path, /search=Salon(?:\+|%20)%26(?:\+|%20)bar/);
  assert.match(calls[0].path, /status=suspended/);
  assert.match(calls[0].path, /page=2/);
});

test("status management posts an explicit reason and never uses tenant APIs", async () => {
  calls.length = 0;
  await api.changePlatformBusinessStatus(1, "suspend", "Contract violation", "secret12");
  assert.equal(calls[0].path, "/api/platform/businesses/1/suspend");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.json.reason, "Contract violation");
  assert.equal(calls[0].options.json.current_password, "secret12");
  await api.changePlatformBusinessStatus(1, "reactivate", "Resolved", "secret12");
  assert.equal(calls[1].path, "/api/platform/businesses/1/reactivate");
});

test("settings edits use PATCH, not the tenant owner settings route", async () => {
  calls.length = 0;
  await api.patchPlatformBusiness(1, { name: "New name" });
  assert.equal(calls[0].path, "/api/platform/businesses/1");
  assert.equal(calls[0].options.method, "PATCH");
  assert.equal(calls[0].options.json.name, "New name");
});

test("audit and summary remain explicit platform operations", async () => {
  calls.length = 0;
  await api.getPlatformSummary();
  await api.listPlatformBusinessEvents(1);
  assert.equal(calls[0].path, "/api/platform/summary");
  assert.equal(calls[1].path, "/api/platform/businesses/1/events");
});
