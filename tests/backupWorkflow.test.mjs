import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks, globals = {}) {
  const loadedModule = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module: loadedModule, exports: loadedModule.exports,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), ...globals });
  return loadedModule.exports;
}

test("backup API binds the preview and confirmation to the selected business and original file", async () => {
  const requests = [];
  const api = load("lib/backupApi.ts", { "./api": { apiFetch: async (path, options) => {
    requests.push({ path, options }); return { preview_token: "verified-file" };
  } } }, { FormData });
  const file = new File(["backup bytes"], "sauvegarde.xlsx");
  const controller = new AbortController();
  await api.previewBackup("my shop", file, controller.signal);
  assert.equal(requests[0].path, "/api/app/my%20shop/backup/preview");
  assert.equal(requests[0].options.body.get("file"), file);
  assert.equal(requests[0].options.signal, controller.signal);
  await api.restoreBackup("my shop", file, "verified-file", "private-password");
  const request = requests[1];
  assert.equal(request.path, "/api/app/my%20shop/backup/restore");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.get("file"), file);
  assert.equal(request.options.body.get("preview_token"), "verified-file");
  assert.equal(request.options.body.get("confirmed"), "1");
  assert.equal(request.options.body.get("backup_password"), "private-password");
  assert.equal(request.options.body.get("password"), null);
  assert.equal(request.options.headers, undefined); // Browser owns the multipart boundary.
});

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

function screen({ canRestore = true, configured = true, previewImpl, restoreImpl } = {}) {
  const slots = [];
  let cursor = 0;
  const effects = [];
  const calls = [];
  let location = "";
  const summary = { businessName: "Boutique Demo", totalRows: 8, maxUploadBytes: 1024 * 1024,
    canRestore, dataSpace: { name: "demo_data", configured }, recoveryPoints: [], tables: [{ table: "products", rows: 3 }] };
  const expected = { business_name: "Boutique Demo", generated_at: "2026-10-04T10:00:00Z",
    total_records: 8, files_count: 1, missing_files_count: 0, preview_token: "verified" };
  const hooks = { ...React,
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect: (callback, deps) => {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        slots[index]?.cleanup?.(); slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = callback(); });
      }
    },
  };
  const Panel = load("components/settings/panels/BackupSettingsPanel.tsx", {
    react: hooks,
    "next/navigation": { useParams: () => ({ business: "demo" }), useSearchParams: () => new URLSearchParams() },
    "@/lib/usePermissionGuard": { usePermissionGuard: () => ({ allowed: true, loading: false }) },
    "@/lib/api": { ApiError },
    "@/lib/backupApi": {
      getBackupSummary: async () => summary,
      previewBackup: async (...args) => { calls.push(["preview", ...args]); return previewImpl ? previewImpl(...args) : expected; },
      restoreBackup: async (...args) => { calls.push(["restore", ...args]); if (restoreImpl) return restoreImpl(...args); return { message: "OK", recovery_id: "copy" }; },
      downloadBackup: async (...args) => { calls.push(["download", ...args]); },
      downloadRecoveryCopy: async () => {},
    },
  }, { AbortController, window: { addEventListener() {}, removeEventListener() {}, location: { assign: value => { location = value; } } } }).default;
  const content = Panel({ embedded: true });
  let tree;
  const walk = (node, predicate) => {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate));
    return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
  };
  const render = () => { cursor = 0; tree = content.type(content.props); return renderToStaticMarkup(tree); };
  const find = predicate => walk(tree, predicate)[0];
  return { calls, expected, render,
    flush: async () => { for (const effect of effects.splice(0)) effect(); await new Promise(setImmediate); return render(); },
    choose: async file => { await find(node => node.props?.type === "file").props.onChange({ target: { files: file ? [file] : [] } }); await new Promise(setImmediate); return render(); },
    input: (type, value) => { const event = type === "checkbox" ? { target: { checked: value } } : { target: { value } }; find(node => type === "password" ? node.props?.id === "backup-confirm-password" : node.props?.type === type).props.onChange(event); return render(); },
    submit: async () => { await find(node => node.type === "form").props.onSubmit({ preventDefault() {} }); return render(); },
    find, location: () => location,
  };
}

test("the recovery form requires a verified file, explicit confirmation and password before writing", async () => {
  const h = screen(); h.render();
  let html = await h.flush();
  assert.match(html, /Télécharger ma sauvegarde/);
  assert.doesNotMatch(html, /php artisan|business_id|API Error|jetons|tables au total/);
  await h.choose({ name: "sauvegarde.xlsx", size: 1500 });
  await h.submit();
  assert.equal(h.calls.filter(row => row[0] === "restore").length, 0);
  h.input("checkbox", true); h.input("password", "secret");
  await h.submit();
  const call = h.calls.find(row => row[0] === "restore");
  assert.equal(call[1], "demo"); assert.equal(call[3], "verified"); assert.equal(call[4], "secret");
  assert.equal(h.location(), "/demo/settings/backup?recovered=1");
  assert.equal(h.find(node => node.props?.id === "backup-confirm-password").props.value, "");
});

test("oversized files and non-owners cannot open an import workflow", async () => {
  const h = screen(); h.render(); await h.flush();
  const html = await h.choose({ name: "large.xlsx", size: 2 * 1024 * 1024 });
  assert.match(html, /dépasse la taille acceptée/);
  assert.equal(h.calls.length, 0);
  const manager = screen({ canRestore: false }); manager.render();
  assert.match(await manager.flush(), /Seul le propriétaire/);
  assert.equal(manager.find(node => node.props?.type === "file"), undefined);
});

test("changing the file cancels stale verification and clears confirmation and password", async () => {
  let resolveFirst;
  let index = 0;
  const h = screen({ previewImpl: () => ++index === 1
    ? new Promise(resolve => { resolveFirst = resolve; })
    : Promise.resolve({ ...h.expected, business_name: "Latest backup", preview_token: "latest" }) });
  h.render(); await h.flush();
  await h.choose({ name: "old.xlsx", size: 20 });
  await h.choose({ name: "new.xlsx", size: 20 });
  assert.equal(h.calls[0][3].aborted, true);
  resolveFirst({ ...h.expected, business_name: "Stale backup", preview_token: "stale" });
  await new Promise(setImmediate);
  assert.doesNotMatch(h.render(), /Stale backup/);
  h.input("checkbox", true); h.input("password", "secret");
  await h.choose({ name: "third.xlsx", size: 20 });
  assert.equal(h.find(node => node.props?.id === "backup-confirm-password").props.value, "");
  assert.equal(h.find(node => node.props?.type === "checkbox").props.checked, false);
});

test("server failures show a plain message without technical detail and clear the password", async () => {
  const h = screen({ restoreImpl: () => { throw new ApiError(500, "SQLSTATE internal SELECT users"); } });
  h.render(); await h.flush(); await h.choose({ name: "sauvegarde.xlsx", size: 20 });
  h.input("checkbox", true); h.input("password", "secret");
  const html = await h.submit();
  assert.match(html, /Actualisez la page/);
  assert.doesNotMatch(html, /SQLSTATE|SELECT users/);
  assert.equal(h.find(node => node.props?.id === "backup-confirm-password").props.value, "");
});

test("downloads require a dedicated password and clear it after a download", async () => {
  const h = screen(); h.render(); await h.flush();
  const button = () => h.find(node => node.type === "button" && node.props.children?.includes("Télécharger ma sauvegarde"));
  assert.equal(button().props.disabled, true);
  await button().props.onClick();
  assert.equal(h.calls.length, 0);
  h.find(node => node.props?.id === "backup-download-password").props.onChange({ target: { value: "dedicated-secret" } });
  h.render();
  assert.equal(button().props.disabled, false);
  button().props.onClick(); await new Promise(setImmediate); h.render();
  assert.deepEqual(h.calls[0], ["download", "demo", "dedicated-secret", "demo_data"]);
  assert.equal(h.find(node => node.props?.id === "backup-download-password").props.value, "");
  const unconfigured = screen({ configured: false }); unconfigured.render();
  assert.match(await unconfigured.flush(), /configurez votre espace de données/);
  assert.equal(unconfigured.find(node => node.props?.type === "file"), undefined);
});

test("every download sends its password in a POST body and uses the configured filename", async () => {
  const requests = []; const links = [];
  const api = load("lib/backupApi.ts", { "./api": { apiFetchBlob: async (path, options) => {
    requests.push({ path, options }); return new Blob(["workbook"]);
  } } }, {
    URL: { createObjectURL: () => "blob:private", revokeObjectURL() {} },
    window: { setTimeout: callback => callback() },
    document: { createElement: () => ({ click() { links.push(this.download); } }), body: { appendChild() {}, removeChild() {} } },
  });
  await api.downloadBackup("demo", "dedicated-secret", "boutique_data");
  await api.downloadRecoveryCopy("demo", "id", "dedicated-secret", "boutique_data");
  await api.downloadRestorePoint("demo", "dedicated-secret", "boutique_data");
  for (const { path, options } of requests) {
    assert.equal(options.method, "POST");
    assert.equal(options.json.backup_password, "dedicated-secret");
    assert.doesNotMatch(path, /secret|password|\?/);
  }
  assert.match(links[0], /^boutique_data-.*\.xlsx$/);
  assert.match(links[1], /^boutique_data-avant-recuperation-.*\.xlsx$/);
  assert.match(links[2], /^restauration-boutique_data-.*\.json$/);
});

test("business onboarding carries the exact backup credential with and without a logo", async () => {
  const requests = [];
  const api = load("lib/businessApi.ts", {
    "./api": { apiFetch: async (path, options) => { requests.push({ path, options }); return { data: { id: 1, name: "Demo", slug: "demo" } }; } },
  }, { File, FormData });
  const payload = { name: "Demo", backup_name: "demo_data", backup_password: "  private secret  ", backup_password_confirmation: "  private secret  " };
  await api.createBusiness(payload);
  await api.createBusiness({ ...payload, logoFile: new File(["image"], "logo.png", { type: "image/png" }) });
  assert.equal(requests[0].options.json.backup_password, payload.backup_password);
  for (const key of ["backup_name", "backup_password", "backup_password_confirmation"]) {
    assert.equal(requests[1].options.body.get(key), payload[key]);
  }
});

test("setup fields require a usable name and matching strong password in plain customer language", () => {
  const { default: Fields, dataSpaceError } = load("components/settings/DataSpaceFields.tsx", {}, { TextEncoder });
  const value = { backup_name: "boutique_principale", backup_password: "private-secret-123", backup_password_confirmation: "private-secret-123" };
  const html = renderToStaticMarkup(React.createElement(Fields, { value, onChange() {} }));
  assert.match(html, /Nom de l’espace de données/);
  assert.match(html, /Mot de passe de sauvegarde/);
  assert.doesNotMatch(html, /MySQL|SQL|serveur|chiffré|hash/);
  assert.equal(dataSpaceError(value), "");
  assert.match(dataSpaceError({ ...value, backup_password_confirmation: "wrong" }), /ne correspondent pas/);
  assert.match(dataSpaceError({ ...value, backup_name: "../escape" }), /Donnez un nom/);
  assert.match(dataSpaceError({ ...value, backup_password: "short" }), /12 caractères/);
  assert.match(dataSpaceError({ ...value, backup_password: "é".repeat(40) }), /trop long/);
  assert.equal(dataSpaceError({ ...value, backup_password: "", backup_password_confirmation: "" }, false), "");
});

test("existing owners configure with their login password then change settings with the backup password", async () => {
  const fields = load("components/settings/DataSpaceFields.tsx", {}, { TextEncoder });
  const slots = []; const effects = []; const requests = []; const events = [];
  let cursor = 0; let role = "owner";
  const hooks = { ...React,
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useEffect: callback => { const index = cursor++; if (!slots[index]) { slots[index] = true; effects.push(callback); } },
  };
  const Settings = load("components/settings/DataSpaceSettings.tsx", {
    react: hooks, "./DataSpaceFields": fields, "@/lib/api": { ApiError },
    "@/lib/useBusinessPermissions": { useBusinessPermissions: () => ({ loading: false, currentBusinessEntry: { role } }) },
    "@/lib/backupApi": {
      getDataSpace: async () => ({ name: "", configured: false }),
      updateDataSpace: async (business, payload) => { requests.push({ business, payload }); return { name: payload.backup_name, configured: true }; },
    },
  }, { CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, window: { dispatchEvent: event => events.push(event) } }).default;
  const content = Settings({ business: "demo" });
  let tree;
  const render = () => { cursor = 0; tree = content.type(content.props); return renderToStaticMarkup(tree); };
  function find(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  }
  render(); effects.forEach(effect => effect()); await new Promise(setImmediate); render();
  find(tree, node => node.type === fields.default).props.onChange({ backup_name: "demo_data", backup_password: "private-secret-123", backup_password_confirmation: "private-secret-123" });
  find(tree, node => node.props?.type === "password").props.onChange({ target: { value: "login-secret" } });
  render();
  await find(tree, node => node.type === "form").props.onSubmit({ preventDefault() {} });
  let html = render();
  assert.equal(requests[0].payload.password, "login-secret");
  assert.equal(requests[0].payload.current_backup_password, undefined);
  assert.equal(requests[0].business, "demo");
  assert.match(html, /Mot de passe de sauvegarde actuel/);
  assert.doesNotMatch(html, /value="login-secret"|value="private-secret-123"/);
  find(tree, node => node.type === fields.default).props.onChange({ backup_name: "renamed_data", backup_password: "", backup_password_confirmation: "" });
  find(tree, node => node.props?.type === "password").props.onChange({ target: { value: "private-secret-123" } });
  render(); await find(tree, node => node.type === "form").props.onSubmit({ preventDefault() {} });
  html = render();
  assert.equal(requests[1].payload.current_backup_password, "private-secret-123");
  assert.equal(requests[1].payload.password, undefined);
  assert.equal(requests[1].payload.backup_password, "");
  assert.doesNotMatch(html, /value="private-secret-123"/);
  assert.equal(events[1].type, "backup-settings-updated");
  assert.equal(events[1].detail, "demo");
  role = "admin";
  assert.equal(Settings({ business: "demo" }), null);
});
