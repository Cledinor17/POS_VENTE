import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(name, globals, mocks) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    ...globals, module: loadedModule, exports: loadedModule.exports,
    require: (key) => { if (!(key in mocks)) throw new Error(key); return mocks[key]; },
  });
  return loadedModule.exports;
}

function fixture(base, response) {
  const calls = [];
  const stored = new Map();
  const globals = {
    FormData,
    File,
    Error,
    TypeError,
    Intl,
    process: { env: { NEXT_PUBLIC_API_BASE_URL: base } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return response ?? { ok: true, status: 200, headers: { get: () => "application/json" },
        json: async () => ({ token: "test-token", user: { id: 7 } }), blob: async () => "test-pdf" };
    },
  };
  const api = load("api", globals, {
    "./locale": { getStoredLocale: () => "fr" },
    "./safeStorage": {
      safeGetItem: (key) => stored.get(key) ?? null,
      safeSetItem: (key, value) => stored.set(key, value),
      safeRemoveItem: (key) => stored.delete(key),
    },
  });
  const errors = load("errors", globals, { "./api": api });
  const imageUpload = load("imageUpload", globals, { "./api": api, "./errors": errors });
  const mocks = { "./api": api, "./imageUpload": imageUpload };
  return {
    api, imageUpload,
    auth: load("authApi", globals, mocks),
    catalog: load("catalogApi", globals, mocks),
    calls, stored,
  };
}

for (const base of ["https://posapi.haytinumeric.com", "https://posapi.haytinumeric.com/", "https://posapi.haytinumeric.com///", " https://posapi.haytinumeric.com/ "]) {
  test(`login targets the API without a duplicate slash for ${JSON.stringify(base)}`, async () => {
    const { auth, calls, stored } = fixture(base);
    const user = await auth.login("test@example.com", "test-only-password");
    assert.equal(calls[0].url, "https://posapi.haytinumeric.com/api/auth/login");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.equal(calls[0].options.headers["X-Locale"], "fr");
    assert.equal(user.id, 7);
    assert.equal(stored.get("pos_token"), "test-token");
  });
}

test("PDF requests normalize the origin and retain bearer/branch headers", async () => {
  const { api, calls } = fixture("https://posapi.haytinumeric.com/");
  api.setToken("test-token");
  api.setBranchId("42");
  assert.equal(await api.apiFetchBlob("/api/app/shop/invoices/7/pdf"), "test-pdf");
  assert.equal(calls[0].url, "https://posapi.haytinumeric.com/api/app/shop/invoices/7/pdf");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(calls[0].options.headers["X-Branch-Id"], "42");
});

test("URL normalization leaves absolute request paths and query values intact", async () => {
  const { api, calls } = fixture("https://posapi.haytinumeric.com/");
  const url = "https://files.example.com/document?source=https://example.com/a//b";
  await api.apiFetch(url);
  assert.equal(calls[0].url, url);
});

test("avatar upload sends multipart with authentication and requests JSON errors", async () => {
  const avatarUrl = "https://posapi.haytinumeric.com/storage/avatars/test.png";
  const { api, auth, calls } = fixture("https://posapi.haytinumeric.com/", Response.json({ avatar_url: avatarUrl }));
  api.setToken("test-token");
  const file = new File(["test-image-content"], "avatar.png", { type: "image/png" });
  const result = await auth.updateAvatar(file);

  assert.equal(calls[0].url, "https://posapi.haytinumeric.com/api/me/avatar");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.equal(calls[0].options.headers["X-Locale"], "fr");
  // The browser must supply the multipart boundary itself.
  assert.equal(calls[0].options.headers["Content-Type"], undefined);
  assert.equal(calls[0].options.body.get("avatar"), file);
  assert.equal(result.avatar_url, avatarUrl);
});

test("avatar validation exposes the field error and HTTP status", async () => {
  const message = "L'avatar ne doit pas depasser 2048 kilo-octets.";
  const { api, auth } = fixture("https://posapi.haytinumeric.com", Response.json({
    message, errors: { avatar: [message] },
  }, { status: 422 }));

  await assert.rejects(auth.updateAvatar(new File(["large-file"], "avatar.png")), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 422);
    assert.equal(error.message, message);
    return true;
  });
});

test("avatar upload retains a proxy rejection status without displaying its HTML", async () => {
  const { api, auth } = fixture("https://posapi.haytinumeric.com", new Response(
    "<html><body>413 Request Entity Too Large</body></html>",
    { status: 413, headers: { "Content-Type": "text/html" } },
  ));

  await assert.rejects(auth.updateAvatar(new File(["large-file"], "avatar.png")), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 413);
    assert.equal(error.message, "API Error 413");
    return true;
  });
});

function imageTranslator(locale) {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).image_upload;
  return (key, values = {}) => messages[key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
}

for (const operation of ["avatar", "create-product", "edit-product"]) {
  test(`${operation} blocks an image above 2 MiB before any network request`, async () => {
    const { auth, catalog, imageUpload, calls } = fixture("https://posapi.haytinumeric.com");
    const file = new File([new Uint8Array(imageUpload.MAX_IMAGE_BYTES + 1)], "large.png", { type: "image/png" });
    const input = { name: "Product", price: 10, imageFile: file };
    const pending = operation === "avatar" ? auth.updateAvatar(file)
      : operation === "create-product" ? catalog.createProduct("shop", input)
        : catalog.updateProduct("shop", "1", input);

    await assert.rejects(pending, (error) => {
      assert.ok(error instanceof imageUpload.ImageSizeError);
      const message = imageUpload.imageUploadErrorMessage(error, imageTranslator("fr"), "fr", "fallback");
      assert.match(message, /Cette image est trop volumineuse/);
      assert.match(message, /2,01\s*Mo/);
      assert.match(message, /2\s*Mo maximum/);
      return true;
    });
    assert.equal(calls.length, 0);
  });

  test(`${operation} still sends an image exactly at the 2 MiB limit`, async () => {
    const { auth, catalog, imageUpload, calls } = fixture("https://posapi.haytinumeric.com");
    const file = new File([new Uint8Array(imageUpload.MAX_IMAGE_BYTES)], "accepted.png", { type: "image/png" });
    const input = { name: "Product", price: 10, imageFile: file };
    if (operation === "avatar") await auth.updateAvatar(file);
    else if (operation === "create-product") await catalog.createProduct("shop", input);
    else await catalog.updateProduct("shop", "1", input);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.body.get(operation === "avatar" ? "avatar" : "image"), file);
  });
}

test("size warning clears for a replacement image or no image", () => {
  const { imageUpload } = fixture("https://posapi.haytinumeric.com");
  const t = imageTranslator("fr");
  assert.match(imageUpload.imageSizeMessage({ size: 3 * 1024 * 1024 }, t, "fr"), /3\s*Mo/);
  assert.equal(imageUpload.imageSizeMessage({ size: 500 * 1024 }, t, "fr"), "");
  assert.equal(imageUpload.imageSizeMessage(null, t, "fr"), "");
});

test("server 413 gets an actionable message while a CORS failure stays a connection error", () => {
  const { api, imageUpload } = fixture("https://posapi.haytinumeric.com");
  const t = imageTranslator("fr");
  const rejected = imageUpload.imageUploadErrorMessage(new api.ApiError(413, "<html>413</html>"), t, "fr", "fallback");
  assert.equal(rejected, t("server_too_large"));
  assert.doesNotMatch(rejected, /413|API Error|<html>/);
  const network = imageUpload.imageUploadErrorMessage(new TypeError("Failed to fetch"), t, "fr", "fallback");
  assert.equal(network, t("network_error"));
  assert.doesNotMatch(network, /volumineuse|Failed to fetch/);
});

test("all application languages explain the size and corrective action", () => {
  const { imageUpload } = fixture("https://posapi.haytinumeric.com");
  for (const locale of ["fr", "en", "ht", "es", "zh", "ar"]) {
    const t = imageTranslator(locale);
    const message = imageUpload.imageSizeMessage({ size: 3.5 * 1024 * 1024 }, t, locale);
    assert.ok(message.includes(imageUpload.formatImageSize(3.5 * 1024 * 1024, locale)));
    assert.ok(message.includes(imageUpload.formatImageSize(imageUpload.MAX_IMAGE_BYTES, locale)));
    assert.doesNotMatch(message, /undefined|\{/);
    assert.ok(t("size_hint", { maxSize: "2 MB" }).includes("2 MB"));
    assert.ok(t("server_too_large").length > 20);
    assert.ok(t("network_error").length > 20);
  }
});
