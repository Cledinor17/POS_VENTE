import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

function workerHarness() {
  const handlers = new Map();
  const stored = new Map();
  let connected = true;
  const caches = {
    async keys() { return ["pos-static-v3"]; },
    async match(request) { return stored.get(request.url); },
    async open() {
      return {
        async put(request, response) { stored.set(request.url, response); },
      };
    },
  };
  const self = {
    location: { origin: "https://pos.haytinumeric.com" },
    addEventListener: (name, cb) => handlers.set(name, cb),
    skipWaiting() {},
    clients: { claim: async () => {} },
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self, caches, URL, Response,
    fetch: async () => {
      if (!connected) throw new TypeError("Network down");
      const response = new Response("POS shell", { status: 200 });
      // Browsers expose same-origin navigation responses as type="basic".
      Object.defineProperty(response, "type", { value: "basic" });
      return response;
    },
  });
  async function navigate(path) {
    const request = {
      mode: "navigate", method: "GET",
      url: "https://pos.haytinumeric.com" + path,
    };
    let promise;
    handlers.get("fetch")({ request, respondWith(p) { promise = p; } });
    return promise ? await promise : null;
  }
  return { navigate, stored, disconnect: () => { connected = false; } };
}

test("revisiting the same POS route works after losing the network", async () => {
  const w = workerHarness();
  const first = await w.navigate("/shop/pos");
  assert.equal(await first.text(), "POS shell");
  w.disconnect();
  const offline = await w.navigate("/shop/pos");
  assert.equal(await offline.text(), "POS shell");
});

test("other routes and unvisited POS routes are not silently cached", async () => {
  const w = workerHarness();
  await w.navigate("/login");
  assert.equal(w.stored.size, 0);
  w.disconnect();
  const unavailable = await w.navigate("/shop/pos");
  assert.equal(unavailable.type, "error");
});
