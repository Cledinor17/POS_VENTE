import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadHotelOrders(apiFetch) {
  const source = readFileSync(new URL("../lib/hotelOrdersApi.ts", import.meta.url), "utf8");
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(code, {
    module,
    exports: module.exports,
    URLSearchParams,
    require: name => {
      if (name === "./api") return { apiFetch };
      throw new Error("Unexpected import: " + name);
    },
  });
  return module.exports;
}

test("hotel room charge creates a completed order for the checked-in reservation, without counter payment", async () => {
  let request = null;
  const api = loadHotelOrders(async (path, options) => {
    request = { path, options };
    return {
      order: {
        id: 45,
        status: "completed",
        reservation_id: 12,
        room: { id: 7, room_number: "204" },
      },
    };
  });
  const order = await api.createHotelOrder("hotel-demo", {
    roomId: 7,
    reservationId: 12,
    status: "completed",
    currency: "HTG",
    customerId: null,
    note: "Commande POS - Client chambre 204",
    totalAmount: 400,
    items: [{ productId: 99, quantity: 2, unitPrice: 200 }],
  });
  assert.equal(request.path, "/api/app/hotel-demo/hotel/orders");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.json.status, "completed");
  assert.equal(request.options.json.reservation_id, 12);
  assert.equal(request.options.json.currency, "HTG");
  assert.equal(request.options.json.items[0].unit_price, 200);
  assert.equal(order.status, "completed");
  assert.equal(order.reservationId, 12);
});

test("POS keeps existing counter checkout and captures a typed guest name without registering a customer", () => {
  const source = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(source, /customerNameForSale = selectedCustomer\?\.name \|\| freeCustomerName\.trim\(\) \|\| customerQuery\.trim\(\)/);
  assert.match(source, /note: !selectedCustomer && customerNameForSale/);
  assert.match(source, /customerName: customerNameForSale \|\| undefined/);
  assert.match(source, /Utiliser « \{customerQuery\.trim\(\)\} » sans créer de fiche client/);
  assert.match(source, /onClick=\{\(\) => \{\s*void checkoutSale\(\);/);
  assert.match(source, /chargeSelectedRoom\(\)/);
});

test("parked tabs preserve guest, stay and optional spending ceiling without treating it as payment", () => {
  const source = readFileSync(new URL("../app/[business]/pos/page.tsx", import.meta.url), "utf8");
  assert.match(source, /spendingLimit: limit/);
  assert.match(source, /spendingCurrency: limitCurrency/);
  assert.match(source, /customerName: customerNameForSale \|\| undefined/);
  assert.match(source, /setActiveSpendingLimit\(found\.spendingLimit \?\? null\)/);
  assert.match(source, /cartGrossTotal\(next\) > spendingLimitInSaleCurrency/);
  assert.match(source, /ne constitue pas un dépôt encaissé/);
  assert.match(source, /addHotelReservationPayment\(businessSlug, selectedReservation\.id/);
});
