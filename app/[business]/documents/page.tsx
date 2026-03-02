"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import {
  createSalesDocument,
  convertSalesDocumentToInvoice,
  fetchInvoicePdf,
  fetchSalesDocumentPdf,
  listSalesDocuments,
  type SalesDocumentItem,
} from "@/lib/documentsApi";
type DraftLine = {
  key: string;
  productId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};
type ConvertFormState = {
  discountType: "" | "percent" | "fixed";
  discountValue: string;
  paymentAmount: string;
  paymentMethod: "cash" | "card" | "bank" | "moncash" | "cheque" | "other";
  paymentDate: string;
  paymentReference: string;
  paymentNotes: string;
};
function createDraftLine(): DraftLine {
  return {
    key: `ln-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    productId: "",
    name: "",
    quantity: "1",
    unitPrice: "0",
    taxRate: "0",
  };
}
function createConvertFormState(): ConvertFormState {
  return {
    discountType: "",
    discountValue: "",
    paymentAmount: "",
    paymentMethod: "cash",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentReference: "",
    paymentNotes: "",
  };
}
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
function parseNumber(input: string, fallback = 0): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}
function formatActor(name: string | null, id: string | null): string {
  if (name && name.trim().length > 0) return name;
  if (id && id.trim().length > 0) return `#${id}`;
  return "-";
}
function paymentStateBadge(
  item: SalesDocumentItem,
): { label: string; className: string } | null {
  const status = (item.convertedInvoiceStatus || "").toLowerCase();
  if (!status) return null;
  if (status === "paid") {
    return {
      label: "Payee",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "partially_paid") {
    return {
      label: "Partielle",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (status === "issued") {
    return {
      label: "Non payee",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }
  if (status === "void") {
    return {
      label: "Annulee",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (status === "refunded") {
    return {
      label: "Remboursee",
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  return {
    label: status,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}
export default function DocumentsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [items, setItems] = useState<SalesDocumentItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowBusyKey, setRowBusyKey] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState<"" | "quote" | "proforma">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);
  const [newType, setNewType] = useState<"quote" | "proforma">("quote");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newIssueDate, setNewIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([createDraftLine()]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [convertTarget, setConvertTarget] = useState<SalesDocumentItem | null>(
    null,
  );
  const [convertForm, setConvertForm] = useState<ConvertFormState>(
    createConvertFormState(),
  );
  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!businessSlug) return;
      setProductsLoading(true);
      try {
        const result = await getProducts(businessSlug, {
          all: true,
          perPage: 500,
        });
        if (!mounted) return;
        setProducts(result);
      } catch {
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    }
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [businessSlug]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const res = await listSalesDocuments(businessSlug, {
          page,
          perPage: 20,
          status: status || undefined,
          type: type || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        if (!mounted) return;
        setItems(res.items);
        setLastPage(res.lastPage);
        setTotal(res.total);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [businessSlug, page, status, type, from, to, reloadSeq]);
  const draftTotals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const quantity = Math.max(0, parseNumber(line.quantity, 0));
        const unitPrice = Math.max(0, parseNumber(line.unitPrice, 0));
        const taxRate = Math.max(0, parseNumber(line.taxRate, 0));
        const lineSubtotal = quantity * unitPrice;
        const lineTax = lineSubtotal * (taxRate / 100);
        return {
          subtotal: acc.subtotal + lineSubtotal,
          tax: acc.tax + lineTax,
          total: acc.total + lineSubtotal + lineTax,
        };
      },
      { subtotal: 0, tax: 0, total: 0 },
    );
  }, [lines]);
  function updateLine(lineKey: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)),
    );
  }
  function onProductChange(lineKey: string, productId: string) {
    const selected = products.find(
      (product) => String(product.id) === productId,
    );
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== lineKey) return line;
        if (!selected) return { ...line, productId };
        return {
          ...line,
          productId,
          name: selected.name,
          unitPrice: String(selected.price ?? 0),
          taxRate: String(selected.taxRate ?? 0),
        };
      }),
    );
  }
  function addLine() {
    setLines((prev) => [...prev, createDraftLine()]);
  }
  function removeLine(lineKey: string) {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((line) => line.key !== lineKey);
    });
  }
  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    const normalizedItems = lines
      .map((line) => ({
        productId: line.productId || undefined,
        name: line.name.trim(),
        quantity: Math.max(0, parseNumber(line.quantity, 0)),
        unitPrice: Math.max(0, parseNumber(line.unitPrice, 0)),
        taxRate: Math.max(0, parseNumber(line.taxRate, 0)),
      }))
      .filter((line) => line.name.length > 0);
    if (normalizedItems.length === 0) {
      setError("Ajoute au moins un article au document.");
      return;
    }
    const hasInvalidItem = normalizedItems.some(
      (line) => line.quantity <= 0 || line.unitPrice < 0,
    );
    if (hasInvalidItem) {
      setError("Verifie les lignes: quantite > 0 et prix >= 0.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const created = await createSalesDocument(businessSlug, {
        type: newType,
        customerId: newCustomerId.trim() || undefined,
        title: newTitle.trim() || undefined,
        issueDate: newIssueDate || undefined,
        expiryDate: newExpiryDate || undefined,
        items: normalizedItems,
      });
      setInfo(
        `${created.type === "proforma" ? "Proforma" : "Devis"} ${created.number} genere.`,
      );
      setType(created.type);
      setPage(1);
      setReloadSeq((prev) => prev + 1);
      setNewCustomerId("");
      setNewTitle("");
      setNewExpiryDate("");
      setLines([createDraftLine()]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  function openConvertModal(item: SalesDocumentItem) {
    setError("");
    setInfo("");
    setConvertTarget(item);
    setConvertForm(createConvertFormState());
  }
  function closeConvertModal() {
    setConvertTarget(null);
    setConvertForm(createConvertFormState());
  }
  async function handleConvert(
    item: SalesDocumentItem,
    options: ConvertFormState,
  ) {
    if (!businessSlug) return;
    const discountValue = parseNumber(options.discountValue, 0);
    const paymentAmount = parseNumber(options.paymentAmount, 0);
    if (options.discountType && discountValue <= 0) {
      setError("Le rabais doit etre superieur a zero.");
      return;
    }
    if (paymentAmount < 0) {
      setError("Le paiement ne peut pas etre negatif.");
      return;
    }
    setRowBusyKey(`convert-${item.id}`);
    setError("");
    setInfo("");
    try {
      const invoice = await convertSalesDocumentToInvoice(
        businessSlug,
        item.id,
        {
          discountType: options.discountType || undefined,
          discountValue: options.discountType ? discountValue : undefined,
          payment:
            paymentAmount > 0
              ? {
                  amount: paymentAmount,
                  method: options.paymentMethod,
                  paidAt: options.paymentDate || undefined,
                  reference: options.paymentReference || undefined,
                  notes: options.paymentNotes || undefined,
                }
              : undefined,
        },
      );
      const paymentInfo =
        invoice.amountPaid > 0
          ? ` Paiement enregistre: ${formatMoney(invoice.amountPaid, invoice.currency)}.`
          : "";
      setInfo(
        `Document ${item.number} converti en facture ${invoice.number} (${invoice.status}).${paymentInfo}`,
      );
      closeConvertModal();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRowBusyKey("");
    }
  }
  async function handlePrint(item: SalesDocumentItem) {
    if (!businessSlug) return;
    setRowBusyKey(`print-${item.id}`);
    setError("");
    try {
      const isConverted = !!item.convertedInvoiceId;
      const blob = isConverted
        ? await fetchInvoicePdf(businessSlug, item.convertedInvoiceId!)
        : await fetchSalesDocumentPdf(businessSlug, item.id);
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      const filenameBase = isConverted
        ? item.convertedInvoiceNumber || `facture-${item.convertedInvoiceId}`
        : item.number || "document";
      if (!popup) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${filenameBase}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRowBusyKey("");
    }
  }
  return (
    <div className="space-y-5">
      {" "}
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <h1 className="text-xl font-bold text-slate-900">
          Devis / Documents
        </h1>{" "}
        <p className="text-sm text-slate-500 mt-1">
          Creation, conversion facture et impression proforma.
        </p>{" "}
      </section>{" "}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {" "}
          {error}{" "}
        </section>
      ) : null}{" "}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {" "}
          {info}{" "}
        </section>
      ) : null}{" "}
      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <form onSubmit={handleCreateDocument} className="space-y-3">
          {" "}
          <div className="flex items-center justify-between">
            {" "}
            <h2 className="font-semibold text-slate-900">
              Generer Devis / Proforma
            </h2>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {" "}
            <select
              value={newType}
              onChange={(event) =>
                setNewType(event.target.value as "quote" | "proforma")
              }
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              <option value="quote">Devis</option>{" "}
              <option value="proforma">Proforma</option>{" "}
            </select>{" "}
            <input
              value={newCustomerId}
              onChange={(event) => setNewCustomerId(event.target.value)}
              placeholder="ID client (optionnel)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Titre (optionnel)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
            <input
              type="date"
              value={newIssueDate}
              onChange={(event) => setNewIssueDate(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
            <input
              type="date"
              value={newExpiryDate}
              onChange={(event) => setNewExpiryDate(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </div>{" "}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            {" "}
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b bg-slate-50">
                  <th className="py-2.5 px-3 font-semibold">Produit</th>
                  <th className="py-2.5 px-3 font-semibold">Libelle</th>
                  <th className="py-2.5 px-3 font-semibold">Quantite</th>
                  <th className="py-2.5 px-3 font-semibold">Prix</th>
                  <th className="py-2.5 px-3 font-semibold">TVA %</th>
                  <th className="py-2.5 px-3 font-semibold">Total ligne</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const qty = Math.max(0, parseNumber(line.quantity, 0));
                  const price = Math.max(0, parseNumber(line.unitPrice, 0));
                  const taxRate = Math.max(0, parseNumber(line.taxRate, 0));
                  const lineSubtotal = qty * price;
                  const lineTotal =
                    lineSubtotal + lineSubtotal * (taxRate / 100);
                  return (
                    <tr key={line.key} className="border-b last:border-0">
                      <td className="py-2 px-3">
                        <select
                          value={line.productId}
                          onChange={(event) =>
                            onProductChange(line.key, event.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">Selectionner</option>
                          {products.map((product) => (
                            <option
                              key={String(product.id)}
                              value={String(product.id)}
                            >
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          value={line.name}
                          onChange={(event) =>
                            updateLine(line.key, { name: event.target.value })
                          }
                          placeholder="Nom article"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.key, {
                              quantity: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.key, {
                              unitPrice: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.taxRate}
                          onChange={(event) =>
                            updateLine(line.key, {
                              taxRate: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {formatMoney(lineTotal)}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length <= 1}
                          className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <i
                            className="fa-solid fa-trash-can"
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>{" "}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {" "}
            <button
              type="button"
              onClick={addLine}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {" "}
              + Ajouter une ligne{" "}
            </button>{" "}
            <div className="text-sm text-slate-700 space-y-1 text-right">
              {" "}
              <div>Sous-total: {formatMoney(draftTotals.subtotal)}</div>{" "}
              <div>TVA: {formatMoney(draftTotals.tax)}</div>{" "}
              <div className="font-bold text-slate-900">
                Total: {formatMoney(draftTotals.total)}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          <div className="flex items-center justify-between">
            {" "}
            <div className="text-xs text-slate-500">
              {" "}
              {productsLoading
                ? "Chargement produits..."
                : `${products.length} produit(s) disponibles`}{" "}
            </div>{" "}
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl brand-primary-btn text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {" "}
              {saving ? "Generation..." : "Generer"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </section>{" "}
      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        {" "}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {" "}
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as "" | "quote" | "proforma");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {" "}
            <option value="">Tous les types</option>{" "}
            <option value="quote">Devis</option>{" "}
            <option value="proforma">Proforma</option>{" "}
          </select>{" "}
          <input
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            placeholder="Statut (draft, sent...)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <button
            onClick={() => {
              setStatus("");
              setType("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {" "}
            Reinitialiser{" "}
          </button>{" "}
        </div>{" "}
      </section>{" "}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {" "}
        <div className="px-4 py-3 border-b text-sm text-slate-600">
          {total} document(s)
        </div>{" "}
        {loading ? (
          <div className="py-10 text-center text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            Aucun document trouve.
          </div>
        ) : (
          <>
            {" "}
            <div className="md:hidden divide-y divide-slate-100">
              {" "}
              {items.map((item) => {
                const convertBusy = rowBusyKey === `convert-${item.id}`;
                const printBusy = rowBusyKey === `print-${item.id}`;
                const canConvert =
                  !item.convertedInvoiceId &&
                  !["converted", "cancelled", "rejected"].includes(
                    item.status.toLowerCase(),
                  );
                const paymentBadge = paymentStateBadge(item);
                return (
                  <div key={item.id || item.number} className="p-4 space-y-3">
                    {" "}
                    <div className="flex items-start justify-between gap-2">
                      {" "}
                      <div>
                        {" "}
                        <div className="font-semibold text-slate-900">
                          {item.number}
                        </div>{" "}
                        <div className="text-xs text-slate-500">
                          {item.type}
                        </div>{" "}
                      </div>{" "}
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {" "}
                        {item.status}{" "}
                      </span>{" "}
                    </div>{" "}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {" "}
                      <div className="text-slate-500">Client</div>{" "}
                      <div className="text-slate-700 text-right">
                        {item.customerName}
                      </div>{" "}
                      <div className="text-slate-500">Operateur</div>{" "}
                      <div className="text-slate-700 text-right">
                        {formatActor(item.createdByName, item.createdBy)}
                      </div>{" "}
                      <div className="text-slate-500">Date</div>{" "}
                      <div className="text-slate-700 text-right">
                        {item.issueDate || "-"}
                      </div>{" "}
                      <div className="text-slate-500">Echeance</div>{" "}
                      <div className="text-slate-700 text-right">
                        {item.expiryDate || "-"}
                      </div>{" "}
                      <div className="text-slate-500">Total</div>{" "}
                      <div className="text-slate-900 text-right font-semibold">
                        {formatMoney(item.total, item.currency)}
                      </div>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      {paymentBadge ? (
                        <div className="flex items-center gap-2">
                          {" "}
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentBadge.className}`}
                          >
                            {" "}
                            {paymentBadge.label}{" "}
                          </span>{" "}
                          {item.convertedInvoiceNumber ? (
                            <span className="text-[11px] text-slate-500">
                              {item.convertedInvoiceNumber}
                            </span>
                          ) : null}{" "}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Pas de facture convertie
                        </span>
                      )}{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <button
                        onClick={() => {
                          openConvertModal(item);
                        }}
                        disabled={!canConvert || convertBusy || saving}
                        title="Convertir en facture"
                        aria-label="Convertir en facture"
                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {" "}
                        <i
                          className="fa-solid fa-file-invoice-dollar"
                          aria-hidden="true"
                        />{" "}
                      </button>{" "}
                      <button
                        onClick={() => {
                          void handlePrint(item);
                        }}
                        disabled={printBusy || saving}
                        title="Reimprimer fiche"
                        aria-label="Reimprimer fiche"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {" "}
                        <i
                          className="fa-solid fa-print"
                          aria-hidden="true"
                        />{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>
                );
              })}{" "}
            </div>{" "}
            <div className="hidden md:block overflow-x-auto">
              {" "}
              <table className="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 px-4 font-semibold">Numero</th>
                    <th className="py-3 pr-3 font-semibold">Type</th>
                    <th className="py-3 pr-3 font-semibold">Client</th>
                    <th className="py-3 pr-3 font-semibold">Operateur</th>
                    <th className="py-3 pr-3 font-semibold">Date</th>
                    <th className="py-3 pr-3 font-semibold">Echeance</th>
                    <th className="py-3 pr-3 font-semibold">Lignes</th>
                    <th className="py-3 pr-3 font-semibold">Total</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 pr-3 font-semibold">
                      Paiement facture
                    </th>
                    <th className="py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const convertBusy = rowBusyKey === `convert-${item.id}`;
                    const printBusy = rowBusyKey === `print-${item.id}`;
                    const canConvert =
                      !item.convertedInvoiceId &&
                      !["converted", "cancelled", "rejected"].includes(
                        item.status.toLowerCase(),
                      );
                    const paymentBadge = paymentStateBadge(item);
                    return (
                      <tr
                        key={item.id || item.number}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-3 px-4 font-semibold text-slate-800">
                          {item.number}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {item.type}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {item.customerName}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {formatActor(item.createdByName, item.createdBy)}
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          {item.issueDate || "-"}
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          {item.expiryDate || "-"}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {item.itemsCount}
                        </td>
                        <td className="py-3 pr-3 text-slate-800 font-semibold">
                          {formatMoney(item.total, item.currency)}
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          {paymentBadge ? (
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentBadge.className}`}
                              >
                                {paymentBadge.label}
                              </span>
                              {item.convertedInvoiceNumber ? (
                                <span className="text-[11px] text-slate-500">
                                  {item.convertedInvoiceNumber}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                openConvertModal(item);
                              }}
                              disabled={!canConvert || convertBusy || saving}
                              title="Convertir en facture"
                              aria-label="Convertir en facture"
                              className="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <i
                                className="fa-solid fa-file-invoice-dollar"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              onClick={() => {
                                void handlePrint(item);
                              }}
                              disabled={printBusy || saving}
                              title="Reimprimer fiche"
                              aria-label="Reimprimer fiche"
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <i
                                className="fa-solid fa-print"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>{" "}
          </>
        )}{" "}
        <div className="px-4 py-3 border-t flex items-center justify-between">
          {" "}
          <div className="text-xs text-slate-500">
            {" "}
            Page {page}/{Math.max(1, lastPage)}{" "}
          </div>{" "}
          <div className="flex items-center gap-2">
            {" "}
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {" "}
              Precedent{" "}
            </button>{" "}
            <button
              onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              disabled={page >= lastPage || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {" "}
              Suivant{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
      {convertTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          {" "}
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            {" "}
            <div className="flex items-start justify-between gap-4">
              {" "}
              <div>
                {" "}
                <h3 className="text-lg font-bold text-slate-900">
                  Convertir en facture
                </h3>{" "}
                <p className="text-sm text-slate-500">
                  {" "}
                  {convertTarget.number} • Rabais optionnel • Paiement partiel
                  ou complet{" "}
                </p>{" "}
              </div>{" "}
              <button
                type="button"
                onClick={closeConvertModal}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {" "}
                Fermer{" "}
              </button>{" "}
            </div>{" "}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {" "}
              <select
                value={convertForm.discountType}
                onChange={(event) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    discountType: event.target
                      .value as ConvertFormState["discountType"],
                  }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {" "}
                <option value="">Rabais: aucun</option>{" "}
                <option value="percent">Rabais %</option>{" "}
                <option value="fixed">Rabais fixe</option>{" "}
              </select>{" "}
              <input
                type="number"
                min="0"
                step="0.01"
                value={convertForm.discountValue}
                onChange={(event) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    discountValue: event.target.value,
                  }))
                }
                placeholder="Valeur rabais"
                className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
              <input
                type="number"
                min="0"
                step="0.01"
                value={convertForm.paymentAmount}
                onChange={(event) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    paymentAmount: event.target.value,
                  }))
                }
                placeholder="Paiement initial (0 = pas de paiement)"
                className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
              <select
                value={convertForm.paymentMethod}
                onChange={(event) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    paymentMethod: event.target
                      .value as ConvertFormState["paymentMethod"],
                  }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {" "}
                <option value="cash">Cash</option>{" "}
                <option value="card">Carte</option>{" "}
                <option value="bank">Banque</option>{" "}
                <option value="moncash">Moncash</option>{" "}
                <option value="cheque">Cheque</option>{" "}
                <option value="other">Autre</option>{" "}
              </select>{" "}
              <input
                type="date"
                value={convertForm.paymentDate}
                onChange={(event) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    paymentDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
              <input
                value={convertForm.paymentReference}
                onChange={(event) =>
                  setConvertForm((prev) => ({
                    ...prev,
                    paymentReference: event.target.value,
                  }))
                }
                placeholder="Reference paiement (optionnel)"
                className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
            </div>{" "}
            <textarea
              value={convertForm.paymentNotes}
              onChange={(event) =>
                setConvertForm((prev) => ({
                  ...prev,
                  paymentNotes: event.target.value,
                }))
              }
              placeholder="Notes paiement (optionnel)"
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
            <div className="mt-4 flex items-center justify-end gap-2">
              {" "}
              <button
                type="button"
                onClick={closeConvertModal}
                className="cancel-default rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {" "}
                Annuler{" "}
              </button>{" "}
              <button
                type="button"
                onClick={() => {
                  void handleConvert(convertTarget, convertForm);
                }}
                disabled={
                  rowBusyKey === `convert-${convertTarget.id}` || saving
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {" "}
                {rowBusyKey === `convert-${convertTarget.id}`
                  ? "Conversion..."
                  : "Confirmer conversion"}{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      ) : null}{" "}
    </div>
  );
}
