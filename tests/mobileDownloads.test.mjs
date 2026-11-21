import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { QRCodeReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } = require("@zxing/library");

function loadTs(url, fetchImpl = async () => { throw new Error("API offline"); }) {
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(compiled, {
    exports: loadedModule.exports, module: loadedModule, URL, Buffer, AbortSignal,
    process: { env: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test/", NEXT_PUBLIC_APP_URL: "https://pos.example.test" } },
    fetch: fetchImpl,
    require: name => {
      if (name === "server-only") return {};
      if (name.startsWith(".")) return loadTs(new URL(`${name}.ts`, url), fetchImpl);
      return require(name);
    },
  });
  return loadedModule.exports;
}

const serverUrl = new URL("../lib/mobileDownloadsServer.ts", import.meta.url);
const { normalizeMobileDownloads, mobileDestination } = loadTs(new URL("../lib/mobileDownloads.ts", import.meta.url));

test("empty links fall back independently to the web app", () => {
  const android = "https://downloads.example.test/app.apk";
  const ios = "https://apps.apple.com/app/id123456789";
  assert.equal(mobileDestination(normalizeMobileDownloads(null), "android"), "/login");
  assert.equal(mobileDestination({ android_url: android, ios_url: null }, "ios"), "/login");
  assert.equal(mobileDestination({ android_url: android, ios_url: null }, "android"), android);
  assert.equal(mobileDestination({ android_url: null, ios_url: ios }, "android"), "/login");
  assert.equal(mobileDestination({ android_url: null, ios_url: ios }, "ios"), ios);
});

test("unsafe or invalid saved URLs cannot become a download destination", () => {
  for (const url of ["javascript:alert(1)", "http://example.test/app.apk", "https://user:pass@example.test/app.apk", "//example.test/app.apk", " ", []]) {
    assert.equal(normalizeMobileDownloads({ android_url: url }).android_url, null);
  }
  assert.equal(normalizeMobileDownloads({ ios_url: "https://apps.apple.com.example.test/app/id123" }).ios_url, null);
});

test("an unavailable API keeps the landing page usable with web links", async () => {
  const { loadMobileDownloads, mobileDownloadCards } = loadTs(serverUrl);
  const cards = mobileDownloadCards(await loadMobileDownloads());
  assert.ok(cards.every(card => card.href === "/login" && !card.isDownload));
});

test("the server reads new settings without caching or sending a user token", async () => {
  const { loadMobileDownloads } = loadTs(serverUrl, async (url, options) => {
    assert.equal(url, "https://api.example.test/api/public/mobile-downloads");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => ({ android_url: "https://downloads.example.test/new.apk", ios_url: null }) };
  });
  assert.equal((await loadMobileDownloads()).android_url, "https://downloads.example.test/new.apk");
});

test("both real QR images decode to stable public routes, including after link changes", async () => {
  const { mobileDownloadCards } = loadTs(serverUrl);
  const before = mobileDownloadCards(normalizeMobileDownloads(null));
  const after = mobileDownloadCards({ android_url: "https://downloads.example.test/app.apk", ios_url: "https://apps.apple.com/app/id123456789" });
  for (let i = 0; i < before.length; i++) {
    assert.equal(before[i].qrSrc, after[i].qrSrc);
    assert.equal(after[i].isDownload, true);
    const svg = Buffer.from(before[i].qrSrc.split(",")[1], "base64");
    const { data, info } = await sharp(svg).resize(410, 410).flatten({ background: "#ffffff" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height)));
    assert.equal(new QRCodeReader().decode(bitmap, new Map()).getText(), `https://pos.example.test/mobile/${before[i].id}`);
  }
});
