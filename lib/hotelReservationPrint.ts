import type { BusinessSettings } from "./businessApi";
import type { HotelReservation, HotelReservationFolio } from "./hotelApi";

/**
 * Printable booking details, NOT a payment receipt. Only confirmed folio
 * entries may be presented as paid. Never copy medical data or ID numbers.
 */
export type ReservationPaper = "a4" | "80mm";

type BookingPrintInput = {
  reservation: HotelReservation;
  settings: BusinessSettings | null;
  folio: HotelReservationFolio | null;
  paper: ReservationPaper;
  printedAt?: Date;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeImageUrl(value: string): string {
  const url = value.trim();
  if (/^https?:\/\/[^<>"\s]+$/i.test(url)) return url;
  if (/^\/(?!\/)[a-zA-Z0-9_./%-]+$/.test(url)) return url;
  return "";
}

function dateLabel(value: string): string {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[3] + "/" + match[2] + "/" + match[1] : "-";
}

function dateTimeLabel(value: string): string {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return dateLabel(value);
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = String(checkIn).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const b = String(checkOut).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !b) return 0;
  const start = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const end = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.max(0, Math.round((end - start) / 86400000));
}

function money(amount: unknown, currency: string): string {
  const number = Number(amount);
  if (!Number.isFinite(number)) return "-";
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
  return formatted + " " + currency;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    checked_in: "Client arrivé",
    checked_out: "Client parti",
    cancelled: "Annulée",
    no_show: "Non-présentation",
  };
  return labels[status] || status || "Non précisé";
}

function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Espèces",
    card: "Carte",
    bank: "Virement / banque",
    check: "Chèque",
    cheque: "Chèque",
    mobile: "Paiement mobile",
    other: "Autre",
  };
  return labels[method] || method || "Non précisé";
}

function line(label: string, value: string, emphasis = false): string {
  return '<div class="line' + (emphasis ? ' emphasis' : '') + '"><span>' +
    escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
}

function group(title: string, content: string): string {
  return '<section class="group"><h2>' + escapeHtml(title) + '</h2>' + content + '</section>';
}

function formattedContact(settings: BusinessSettings | null): string[] {
  const address = settings?.address;
  return [
    [address?.line1, address?.line2, address?.city, address?.state, address?.country]
      .filter(Boolean).join(", "),
    settings?.phone || "",
    settings?.email || "",
    settings?.website || "",
  ].filter(value => value.trim() !== "");
}

export function buildHotelBookingPrintHtml(input: BookingPrintInput): string {
  const { reservation, settings, folio, paper } = input;
  const isReceipt = paper === "80mm";
  const code = reservation.reservation_code || "#" + String(reservation.id).padStart(10, "0");
  const hotel = settings?.legal_name?.trim() || settings?.name?.trim() || "Hôtel";
  const logo = safeImageUrl(settings?.logo_url || "");
  const guest = reservation.guest_name?.trim() || reservation.customer?.name?.trim() || "Client";
  const contact = reservation.guest_phone?.trim() || reservation.customer?.phone?.trim() || "";
  const email = reservation.guest_email?.trim() || reservation.customer?.email?.trim() || "";
  const roomName = reservation.room?.name || "Chambre";
  const roomNumber = reservation.room?.room_number || String(reservation.room_id);
  const roomType = reservation.room?.category?.name || "Non renseigné";
  const currency = folio?.currency || reservation.total_currency || settings?.currency || "HTG";
  const nights = Math.max(1, nightsBetween(reservation.check_in, reservation.check_out));
  const issuedAt = input.printedAt || new Date();
  const printedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short", timeStyle: "short",
  }).format(issuedAt);

  // If folio is absent or inaccessible, do not invent a deposit, paid balance,
  // payment method or paid invoice. The booking itself may still be printed.
  const roomAmount = folio ? Number(folio.room_amount) : Number(reservation.total_amount);
  const gross = folio ? Number(folio.gross_total) : Number(reservation.total_amount);
  const paymentLines = folio
    ? (folio.payments || []).map(payment => {
        const amount = money(payment.amount, currency);
        const original = payment.payment_currency && payment.payment_currency !== currency
          ? " (" + money(payment.payment_amount, payment.payment_currency) + ")" : "";
        return line(methodLabel(payment.payment_method) + (payment.paid_at ? " · " + dateLabel(payment.paid_at) : ""), amount + original);
      }).join("")
    : "";

  const contactRows = formattedContact(settings);
  const banner = '<header class="hotel-header">' +
    (logo ? '<img class="logo" src="' + escapeHtml(logo) + '" alt="Logo de l&#39;hôtel">' : "") +
    '<div class="hotel-name">' + escapeHtml(hotel) + '</div>' +
    contactRows.map(v => '<div class="hotel-contact">' + escapeHtml(v) + '</div>').join("") +
    '</header>';

  const intro = '<div class="doc-title"><h1>Fiche de réservation</h1>' +
    '<div class="translation">Booking details</div><div class="reference">' +
    escapeHtml(code) + '</div><div class="status">' + escapeHtml(statusLabel(reservation.status)) +
    '</div><div class="printed">Émise le ' + escapeHtml(printedAt) + '</div></div>';

  const guestRows = line("Nom du client", guest) +
    (contact ? line("Téléphone", contact) : "") +
    (email ? line("E-mail", email) : "") +
    (reservation.customer?.code ? line("Code client", reservation.customer.code) : "");

  const stayRows = line("Chambre", roomName + " · n° " + roomNumber) +
    line("Catégorie", roomType) +
    line("Arrivée prévue", dateLabel(reservation.check_in)) +
    line("Départ prévu", dateLabel(reservation.check_out)) +
    line("Nuits", String(nights)) +
    line("Personnes", String(reservation.guests || 1)) +
    (reservation.actual_check_in_at ? line("Arrivée effective", dateTimeLabel(reservation.actual_check_in_at)) : "") +
    (reservation.actual_check_out_at ? line("Départ effectif", dateTimeLabel(reservation.actual_check_out_at)) : "");

  const financeRows = line("Hébergement", money(roomAmount, currency)) +
    (folio && Number(folio.extras_amount) > 0 ? line("Services / suppléments", money(folio.extras_amount, currency)) : "") +
    line(folio ? "Total facturé" : "Prix de réservation", money(gross, currency), true) +
    (folio ? line("Versements enregistrés", money(folio.payments_total, currency)) : "") +
    (folio ? line("Solde restant", money(folio.balance_due, currency), true)
      : '<p class="notice">Détail des versements indisponible. Ce document ne constitue pas un reçu de paiement.</p>');

  const payments = folio
    ? group("Paiements enregistrés", paymentLines || '<p class="muted">Aucun versement enregistré.</p>')
    : "";

  // Business-specific footer is optional; never assert a universal departure
  // time, included breakfast or non-refundable deposits.
  const conditions = settings?.invoice_footer?.trim()
    ? group("Informations et conditions de l'hôtel",
      '<p class="policy">' + escapeHtml(settings.invoice_footer) + '</p>')
    : group("Informations pratiques",
      '<p class="policy">Horaires d’arrivée et de départ, petit déjeuner et conditions d’annulation : à confirmer auprès de l’hôtel.</p>');

  const signatures = '<div class="signatures"><div class="signature">Signature du client</div>' +
    '<div class="signature">Signature de l’hôtel</div></div>';

  const body = '<main class="sheet">' + banner + intro +
    '<div class="columns">' + group("Client", guestRows) +
    group("Séjour", stayRows) + '</div>' +
    group("Récapitulatif", financeRows) + payments +
    conditions + signatures +
    '<footer class="footer">Merci de votre confiance · ' + escapeHtml(hotel) + '</footer>' +
    '</main>';

  const css = [
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0;color:#172238;font-family:Arial,Helvetica,sans-serif}',
    'body{background:#eff3f8}',
    '.sheet{background:#fff;margin:14px auto;padding:20px;max-width:800px;border:1px solid #dbe3ef}',
    '.hotel-header{text-align:center;border-bottom:2px solid #183d68;padding-bottom:14px}',
    '.logo{display:block;max-width:110px;max-height:74px;object-fit:contain;margin:0 auto 7px}',
    '.hotel-name{font-weight:800;font-size:21px;overflow-wrap:anywhere}',
    '.hotel-contact{font-size:11px;line-height:1.5;color:#54647b;overflow-wrap:anywhere}',
    '.doc-title{text-align:center;padding:18px 0}',
    '.doc-title h1{margin:0;font-size:20px;text-transform:uppercase;letter-spacing:.02em}',
    '.translation{font-size:11px;color:#6b7280;margin:4px}',
    '.reference{font-weight:800;font-size:18px;margin:8px auto}',
    '.status{display:inline-block;border:1px solid #bdccdd;border-radius:4px;padding:4px 9px;font-size:11px;font-weight:700}',
    '.printed{font-size:11px;color:#64748b;margin-top:9px}',
    '.columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.group{margin:0 0 12px;border:1px solid #e0e6ef;border-radius:8px;padding:13px;break-inside:avoid}',
    '.group h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#183d68;margin:0 0 11px;padding-bottom:7px;border-bottom:1px solid #e0e6ef}',
    '.line{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px dotted #e2e8f0;font-size:12px}',
    '.line:last-child{border-bottom:0}',
    '.line span{min-width:0;color:#64748b}',
    '.line strong{min-width:0;text-align:right;overflow-wrap:anywhere}',
    '.line.emphasis{font-size:14px;font-weight:800;border-top:1px solid #cbd5e1;padding-top:9px}',
    '.line.emphasis span{color:#172238}',
    '.notice{font-size:11px;line-height:1.5;color:#9a3412;background:#fff7ed;padding:8px}',
    '.policy{font-size:11px;line-height:1.6;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.muted{font-size:11px;color:#64748b}',
    '.signatures{display:flex;gap:32px;justify-content:space-between;margin:45px 8px 20px}',
    '.signature{border-top:1px solid #334155;padding-top:7px;font-size:11px;text-align:center;flex:1}',
    '.footer{font-size:10px;text-align:center;color:#64748b;padding:15px 0 5px}',
    '.toolbar{display:flex;justify-content:center;gap:8px;margin:12px}',
    '.toolbar button{padding:9px 18px;border:0;border-radius:8px;background:#183d68;color:white;font-weight:700;cursor:pointer}',
    '.toolbar .hint{font-size:12px;color:#475569;padding:10px}',
    '@media print{body{background:white}.sheet{border:0;margin:0;max-width:none}.toolbar{display:none}}',
    isReceipt
      ? '@page{size:80mm 200mm;margin:0}body{width:80mm}.sheet{width:80mm;padding:4mm;max-width:80mm;border:0;margin:0}' +
        '.hotel-header{padding-bottom:8px;border-bottom:1px dashed #222}.logo{max-width:50mm;max-height:24mm}' +
        '.hotel-name{font-size:16px}.hotel-contact{font-size:10px;color:#222}' +
        '.doc-title{padding:10px 0}.doc-title h1{font-size:14px}.reference{font-size:15px}' +
        '.columns{display:block}.group{padding:7px 0;border:0;border-radius:0;border-top:1px dashed #666;margin:0 0 8px}' +
        '.group h2{font-size:11px;color:#111;margin-bottom:5px;border:0;padding:0}' +
        '.line{font-size:10px;gap:6px;padding:4px 0}.line.emphasis{font-size:11px}' +
        '.notice,.policy,.muted{font-size:9px}.signatures{gap:10px;margin:35px 0 8px}.signature{font-size:9px}' +
        '.footer{font-size:9px}.toolbar{position:sticky;top:0;background:#fff}@media print{.toolbar{display:none}}'
      : '@page{size:A4 portrait;margin:12mm}@media print{.sheet{padding:0}}'
  ].join("\n");

  const toolbar = '<div class="toolbar"><button type="button" onclick="window.print()">Imprimer ' +
    (isReceipt ? '80 mm' : 'A4') + '</button><span class="hint">Réglez le papier ' +
    (isReceipt ? '80 mm (rouleau)' : 'A4') + ' dans les options de l’imprimante.</span></div>';

  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Fiche de réservation ' + escapeHtml(code) + '</title><style>' + css + '</style></head>' +
    '<body>' + toolbar + body + '</body></html>';
}
