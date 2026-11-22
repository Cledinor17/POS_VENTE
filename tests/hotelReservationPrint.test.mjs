import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/hotelReservationPrint.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
runInNewContext(js, { module: loadedModule, exports: loadedModule.exports });
const { buildHotelBookingPrintHtml, thermalReceiptPageHeightMm } = loadedModule.exports;

const reservation = {
  id: 42, reservation_code: "#0012345678", status: "confirmed",
  guest_name: "Marie Pierre", guest_phone: "+509 1234-5678", guest_email: "marie@example.com",
  check_in: "2026-12-01", check_out: "2026-12-04", guests: 2,
  total_amount: 450, total_currency: "USD", room_id: 2,
  room: { name: "Chambre Océan", room_number: "202", category: { name: "Double" } },
  customer: { code: "CL-42" },
};
const settings = {
  name: "Hôtel des Îles", legal_name: "", logo_url: "https://images.example.com/logo.png",
  phone: "+509 1111-2222", email: "contact@example.com", website: "",
  address: { line1: "Route de la plage", city: "Cap-Haïtien", country: "Haïti" },
  invoice_footer: "Annulation selon les conditions acceptées à la réception.",
  currency: "USD",
};
const folio = {
  currency: "USD", room_amount: 450, extras_amount: 50, gross_total: 500,
  payments_total: 200, balance_due: 300, charges: [],
  payments: [{
    amount: 200, payment_currency: "USD", payment_amount: 200,
    payment_method: "cash", paid_at: "2026-11-20", reference: "P-123",
  }],
};

function html(paper, overrides = {}) {
  return buildHotelBookingPrintHtml({
    reservation, settings, folio, paper, printedAt: new Date("2026-11-21T15:30:00Z"),
    ...overrides,
  });
}

test("A4 hotel booking sheet contains standardized facts and tenant branding", () => {
  const a4 = html("a4");
  assert.match(a4, /@page\{size:A4 portrait;margin:12mm\}/);
  assert.match(a4, /Hôtel des Îles/);
  assert.match(a4, /https:\/\/images\.example\.com\/logo\.png/);
  assert.match(a4, /#0012345678/);
  assert.match(a4, /Booking details/);
  assert.match(a4, /Marie Pierre/);
  assert.match(a4, /Chambre Océan/);
  assert.match(a4, /Double/);
  assert.match(a4, /01\/12\/2026/);
  assert.match(a4, /04\/12\/2026/);
  assert.match(a4, /<span>Nuits<\/span><strong>3<\/strong>/);
  assert.match(a4, /Paiements enregistrés/);
  assert.match(a4, /Espèces/);
  assert.match(a4, /200,00 USD/);
  assert.match(a4, /300,00 USD/);
  assert.match(a4, /Signature du client/);
  assert.match(a4, /Signature de l’hôtel/);
});

test("thermal paper uses narrow 80mm page, no A4 two-column layout", () => {
  const thermal = html("80mm");
  assert.match(thermal, /@page\{size:80mm 200mm;margin:0\}/);
  assert.match(thermal, /body\{width:80mm\}/);
  assert.match(thermal, /\.columns\{display:block\}/);
  assert.match(thermal, /Imprimer 80 mm/);
  assert.doesNotMatch(thermal, /@page\{size:A4 portrait/);
});

test("missing folio never claims a deposit, payment method or paid balance", () => {
  const doc = html("80mm", { folio: null });
  assert.match(doc, /Prix de réservation/);
  assert.match(doc, /Détail des versements indisponible/);
  assert.doesNotMatch(doc, /Versements enregistrés/);
  assert.doesNotMatch(doc, /Solde restant/);
  assert.doesNotMatch(doc, /Espèces/);
  assert.doesNotMatch(doc, /200,00 USD/);
});

test("untrusted client and business strings are escaped; internal notes and medical data absent", () => {
  const doc = html("a4", {
    reservation: {
      ...reservation,
      guest_name: "<script>alert(1)</script>",
      notes: "INTERNAL NOTE: don't print this",
    },
    settings: {
      ...settings,
      name: "Test <img src=x onerror=alert(1)>",
      logo_url: "javascript:alert(1)",
      invoice_footer: "Politique <script>danger</script>",
    },
  });
  assert.doesNotMatch(doc, /<script>alert\(1\)<\/script>/);
  assert.match(doc, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(doc, /src="javascript:/);
  assert.doesNotMatch(doc, /INTERNAL NOTE/);
  assert.doesNotMatch(doc, /Diabétique|Tension artérielle/i);
  assert.doesNotMatch(doc, /non remboursables/i);
});

test("no fixed departure hour or universal refund terms without tenant settings", () => {
  const doc = html("a4", { settings: { ...settings, invoice_footer: "" } });
  assert.match(doc, /Horaires d’arrivée et de départ/);
  assert.doesNotMatch(doc, /10h30|10:30/);
  assert.doesNotMatch(doc, /non.remboursable/i);
});

test("80mm page length is measured dynamically with a small cutter allowance", () => {
  assert.equal(thermalReceiptPageHeightMm(0), 70);
  assert.equal(thermalReceiptPageHeightMm(100), 70);
  assert.equal(thermalReceiptPageHeightMm(800), Math.ceil(800 * 25.4 / 96 + 8));
  assert.equal(thermalReceiptPageHeightMm(100_000), 1500);
});
