"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, ScanBarcode, X } from "lucide-react";
import { buildBarcodeSvg, productBarcodeValue } from "@/lib/productBarcode";
import { printHtmlDocument } from "@/lib/printHtml";
import type { CatalogProduct } from "@/lib/catalogApi";
import { formatMoney } from "@/lib/currency";

const LABEL_COPIES = [1, 4, 12, 24, 48];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLabelSheetHtml(product: CatalogProduct, code: string, copies: number): string {
  const svg = buildBarcodeSvg(code, { barWidth: 2, height: 60, showText: true });
  if (!svg) return "";

  const priceLabel = formatMoney(
    product.sellingPrice || product.price,
    product.sellingCurrency || product.priceCurrency,
  );
  const label = `
    <div class="label">
      <div class="name">${escapeHtml(product.name)}</div>
      <div class="price">${escapeHtml(priceLabel)}</div>
      <div class="barcode">${svg}</div>
    </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Etiquettes ${escapeHtml(code)}</title><style>
@page { size: A4; margin: 8mm; }
body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
.sheet { display: flex; flex-wrap: wrap; gap: 4mm; }
.label { width: 52mm; border: 1px solid #cbd5e1; border-radius: 2mm; padding: 2mm; text-align: center; page-break-inside: avoid; }
.name { font-size: 10px; font-weight: 700; line-height: 1.2; min-height: 24px; }
.price { font-size: 12px; font-weight: 800; margin: 1mm 0; }
.barcode svg { width: 100%; height: auto; display: block; }
</style></head><body><div class="sheet">${label.repeat(copies)}</div></body></html>`;
}

export default function ProductBarcodeModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: CatalogProduct | null;
  onClose: () => void;
}) {
  const [copies, setCopies] = useState(1);

  const code = product ? productBarcodeValue(product) : "";
  const usesSkuFallback = Boolean(product && !product.barcode.trim() && code);
  const svg = useMemo(
    () => (code ? buildBarcodeSvg(code, { barWidth: 2, height: 70, showText: true }) : null),
    [code],
  );

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  function handlePrint() {
    if (!product || !svg) return;
    const html = buildLabelSheetHtml(product, code, copies);
    if (!html) return;

    printHtmlDocument(html);
  }

  const portalRoot = typeof document === "undefined" ? null : document.body;
  if (!open || !product || !portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <ScanBarcode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Code-barres produit</h2>
              <p className="text-xs text-slate-500">{product.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!code ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ce produit n&apos;a ni code-barres ni SKU. Renseigne l&apos;un des deux dans la fiche
              produit pour pouvoir imprimer une etiquette.
            </div>
          ) : null}

          {code && !svg ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Le code &laquo; {code} &raquo; contient des caracteres non imprimables en Code 128.
              Utilise des lettres, chiffres et tirets.
            </div>
          ) : null}

          {svg ? (
            <>
              <div
                className="flex justify-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 [&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                <div className="text-xs text-slate-500">SKU {product.sku}</div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  {formatMoney(
                    product.sellingPrice || product.price,
                    product.sellingCurrency || product.priceCurrency,
                  )}
                </div>
              </div>
              {usesSkuFallback ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                  Aucun code-barres enregistre : l&apos;etiquette encode le SKU, que la caisse
                  reconnait aussi au scan.
                </p>
              ) : null}
              <p className="text-center text-xs text-slate-500">
                Scanne cette etiquette depuis la caisse : le produit s&apos;ajoute automatiquement
                au panier.
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600" htmlFor="barcode-copies">
                  Etiquettes
                </label>
                <select
                  id="barcode-copies"
                  value={copies}
                  onChange={(event) => setCopies(Number(event.target.value))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  {LABEL_COPIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="ml-auto inline-flex items-center gap-2 rounded-2xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white"
                >
                  <Printer className="h-4 w-4" /> Imprimer
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
