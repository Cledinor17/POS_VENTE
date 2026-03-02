"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Ban, Eye, RefreshCcw, RotateCcw, Search, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  getPosSaleDetail,
  listPosSales,
  refundPosSale,
  voidPosSale,
  type PosSaleDetail,
  type PosSaleHistoryItem,
} from "@/lib/posApi";
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function formatPaymentMethod(method: string | null): string {
  if (!method) return "N/A";
  const normalized = method.trim().toLowerCase();
  if (normalized === "cash") return "Cash";
  if (normalized === "card") return "Carte";
  if (normalized === "bank") return "Virement";
  if (normalized === "moncash") return "Mobile";
  if (normalized === "cheque") return "Cheque";
  return method;
}
function formatPaymentKind(kind: string): string {
  const normalized = kind.trim().toLowerCase();
  if (normalized === "refund") return "Remboursement";
  return "Paiement";
}
function formatActor(name: string | null, id: string | null): string {
  if (name && name.trim().length > 0) return name;
  if (id && id.trim().length > 0) return `#${id}`;
  return "N/A";
}
function getStatusMeta(status: string): { label: string; className: string } {
  const normalized = status.trim().toLowerCase();
  if (normalized === "paid") {
    return { label: "Payee", className: "bg-emerald-100 text-emerald-700" };
  }
  if (normalized === "partially_paid") {
    return { label: "Partielle", className: "bg-amber-100 text-amber-700" };
  }
  if (normalized === "void") {
    return { label: "Annulee", className: "bg-rose-100 text-rose-700" };
  }
  if (normalized === "refunded") {
    return { label: "Remboursee", className: "bg-cyan-100 text-cyan-700" };
  }
  return { label: "Ouverte", className: "bg-slate-100 text-slate-700" };
}
export default function SalesPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [items, setItems] = useState<PosSaleHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailSale, setDetailSale] = useState<PosSaleDetail | null>(null);
  const [refundSale, setRefundSale] = useState<PosSaleHistoryItem | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const res = await listPosSales(businessSlug, {
          page,
          perPage: 20,
          status: statusFilter || undefined,
          q: search || undefined,
        });
        if (!mounted) return;
        setItems(res.items);
        setLastPage(res.lastPage);
        setTotal(res.total);
        if (res.lastPage > 0 && page > res.lastPage) {
          setPage(res.lastPage);
        }
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
  }, [businessSlug, page, statusFilter, search, refreshTick]);
  const pageLabel = useMemo(
    () => `Page ${page}/${Math.max(1, lastPage)}`,
    [page, lastPage],
  );
  function refreshList() {
    setRefreshTick((prev) => prev + 1);
  }
  async function openSaleDetail(saleId: string) {
    setDetailLoadingId(saleId);
    setError("");
    try {
      const detail = await getPosSaleDetail(businessSlug, saleId);
      setDetailSale(detail);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDetailLoadingId(null);
    }
  }
  function closeSaleDetail() {
    setDetailSale(null);
  }
  async function handleVoidSale(sale: PosSaleHistoryItem) {
    const confirmed = window.confirm(`Annuler le ticket ${sale.receiptNo} ?`);
    if (!confirmed) return;
    setActionLoadingId(sale.id);
    setError("");
    setInfo("");
    try {
      await voidPosSale(businessSlug, sale.id);
      setInfo(`Ticket ${sale.receiptNo} annule.`);
      if (detailSale?.id === sale.id) {
        await openSaleDetail(sale.id);
      }
      refreshList();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoadingId(null);
    }
  }
  function openRefundSale(sale: PosSaleHistoryItem) {
    setRefundSale(sale);
    setRefundAmount(sale.amountPaid.toFixed(2));
    setRefundMethod(sale.paymentMethod ?? "cash");
    setError("");
    setInfo("");
  }
  function closeRefundPanel() {
    setRefundSale(null);
    setRefundAmount("");
    setRefundMethod("cash");
  }
  async function submitRefund() {
    if (!refundSale) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Montant de remboursement invalide.");
      return;
    }
    if (amount > refundSale.amountPaid) {
      setError("Le remboursement depasse le montant paye.");
      return;
    }
    setActionLoadingId(refundSale.id);
    setError("");
    setInfo("");
    try {
      await refundPosSale(businessSlug, refundSale.id, {
        amount,
        method: refundMethod,
      });
      setInfo(`Remboursement applique sur ${refundSale.receiptNo}.`);
      if (detailSale?.id === refundSale.id) {
        await openSaleDetail(refundSale.id);
      }
      closeRefundPanel();
      refreshList();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoadingId(null);
    }
  }
  return (
    <div className="space-y-5">
      {" "}
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <div className="flex items-center justify-between gap-3">
          {" "}
          <div>
            {" "}
            <h1 className="text-xl font-bold text-slate-900">
              Historique des ventes POS
            </h1>{" "}
            <p className="text-sm text-slate-500 mt-1">
              {" "}
              Tickets, remboursements et annulations.{" "}
            </p>{" "}
          </div>{" "}
          <button
            onClick={refreshList}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {" "}
            <RefreshCcw className="h-4 w-4" /> Actualiser{" "}
          </button>{" "}
        </div>{" "}
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
      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        {" "}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
          {" "}
          <div className="relative">
            {" "}
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />{" "}
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Rechercher ticket, client, note..."
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </div>{" "}
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {" "}
            <option value="">Tous les statuts</option>{" "}
            <option value="paid">Payee</option>{" "}
            <option value="partially_paid">Partielle</option>{" "}
            <option value="issued">Ouverte</option>{" "}
            <option value="refunded">Remboursee</option>{" "}
            <option value="void">Annulee</option>{" "}
          </select>{" "}
          <button
            onClick={() => {
              setSearch(searchInput.trim());
              setPage(1);
            }}
            className="rounded-xl brand-primary-btn text-white px-4 py-2.5 text-sm font-semibold "
          >
            {" "}
            Filtrer{" "}
          </button>{" "}
        </div>{" "}
      </section>{" "}
      {refundSale ? (
        <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          {" "}
          <div className="text-sm font-semibold text-slate-800">
            {" "}
            Remboursement du ticket{" "}
            <span className="text-indigo-700">{refundSale.receiptNo}</span>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {" "}
            <div>
              {" "}
              <label className="text-xs font-medium text-slate-600">
                Montant
              </label>{" "}
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="text-xs font-medium text-slate-600">
                Methode
              </label>{" "}
              <select
                value={refundMethod}
                onChange={(event) => setRefundMethod(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {" "}
                <option value="cash">Cash</option>{" "}
                <option value="card">Carte</option>{" "}
                <option value="bank">Virement</option>{" "}
                <option value="moncash">Mobile</option>{" "}
                <option value="cheque">Cheque</option>{" "}
                <option value="other">Autre</option>{" "}
              </select>{" "}
            </div>{" "}
            <div className="flex items-end gap-2">
              {" "}
              <button
                onClick={submitRefund}
                disabled={actionLoadingId === refundSale.id}
                className="flex-1 rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {" "}
                <RotateCcw className="h-4 w-4" /> Confirmer{" "}
              </button>{" "}
              <button
                onClick={closeRefundPanel}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {" "}
                Fermer{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </section>
      ) : null}{" "}
      {detailSale || detailLoadingId ? (
        <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          {" "}
          <div className="flex items-center justify-between gap-3">
            {" "}
            <div>
              {" "}
              <div className="text-sm font-semibold text-slate-800">
                Detail ticket
              </div>{" "}
              <div className="text-xs text-slate-500">
                {" "}
                {detailSale ? detailSale.receiptNo : "Chargement..."}{" "}
              </div>{" "}
            </div>{" "}
            <button
              onClick={closeSaleDetail}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              {" "}
              <X className="h-3.5 w-3.5" /> Fermer{" "}
            </button>{" "}
          </div>{" "}
          {!detailSale ? (
            <div className="py-6 text-sm text-slate-500">
              Chargement du detail...
            </div>
          ) : (
            <div className="space-y-4">
              {" "}
              <div className="grid grid-cols-2 md:grid-cols-8 gap-3 text-sm">
                {" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Client</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {detailSale.customerName}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Date</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {" "}
                    {new Date(detailSale.createdAt).toLocaleString(
                      "fr-FR",
                    )}{" "}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Caissier</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {" "}
                    {formatActor(
                      detailSale.createdByName,
                      detailSale.createdBy,
                    )}{" "}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Annule par</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {" "}
                    {detailSale.voidedAt
                      ? formatActor(
                          detailSale.voidedByName,
                          detailSale.voidedBy,
                        )
                      : "-"}{" "}
                  </div>{" "}
                  {detailSale.voidedAt ? (
                    <div className="text-[11px] text-slate-500">
                      {" "}
                      {new Date(detailSale.voidedAt).toLocaleString(
                        "fr-FR",
                      )}{" "}
                    </div>
                  ) : null}{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Total</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {formatMoney(detailSale.total)}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Paye</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {formatMoney(detailSale.amountPaid)}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Rembourse</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {formatMoney(detailSale.refundedTotal)}
                  </div>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <div className="text-xs text-slate-500">Solde</div>{" "}
                  <div className="font-semibold text-slate-800">
                    {formatMoney(detailSale.balanceDue)}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {" "}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  {" "}
                  <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold text-slate-700">
                    {" "}
                    Articles{" "}
                  </div>{" "}
                  {detailSale.items.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">
                      Aucune ligne.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {" "}
                      {detailSale.items.map((item) => (
                        <div key={item.id} className="p-3 text-sm space-y-1">
                          {" "}
                          <div className="font-semibold text-slate-800">
                            {item.name}
                          </div>{" "}
                          <div className="text-xs text-slate-500">
                            {" "}
                            {item.sku || "SKU N/A"} - Qte {item.quantity} x{" "}
                            {formatMoney(item.unitPrice)}{" "}
                          </div>{" "}
                          <div className="text-xs text-slate-600">
                            {" "}
                            Taxe: {formatMoney(item.taxAmount)} ({item.taxRate}
                            %){" "}
                          </div>{" "}
                          <div className="text-sm font-semibold text-slate-900">
                            {" "}
                            Ligne: {formatMoney(item.lineTotal)}{" "}
                          </div>{" "}
                        </div>
                      ))}{" "}
                    </div>
                  )}{" "}
                </div>{" "}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  {" "}
                  <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold text-slate-700">
                    {" "}
                    Paiements et remboursements{" "}
                  </div>{" "}
                  {detailSale.payments.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">
                      Aucun paiement.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {" "}
                      {detailSale.payments.map((payment) => (
                        <div key={payment.id} className="p-3 text-sm space-y-1">
                          {" "}
                          <div className="font-semibold text-slate-800">
                            {" "}
                            {formatPaymentKind(payment.kind)} -{" "}
                            {formatPaymentMethod(payment.method)}{" "}
                          </div>{" "}
                          <div className="text-xs text-slate-500">
                            {" "}
                            {payment.paidAt
                              ? new Date(payment.paidAt).toLocaleString("fr-FR")
                              : "Date N/A"}{" "}
                          </div>{" "}
                          <div className="text-xs text-slate-500">
                            {" "}
                            Par:{" "}
                            {formatActor(
                              payment.receivedByName,
                              payment.receivedBy,
                            )}{" "}
                          </div>{" "}
                          <div className="text-sm font-semibold text-slate-900">
                            {" "}
                            {payment.kind.toLowerCase() === "refund"
                              ? "-"
                              : ""}{" "}
                            {formatMoney(payment.amount)}{" "}
                          </div>{" "}
                          {payment.reference ? (
                            <div className="text-xs text-slate-600">
                              Ref: {payment.reference}
                            </div>
                          ) : null}{" "}
                        </div>
                      ))}{" "}
                    </div>
                  )}{" "}
                </div>{" "}
              </div>{" "}
            </div>
          )}{" "}
        </section>
      ) : null}{" "}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {" "}
        <div className="px-4 py-3 border-b text-sm text-slate-600">
          {total} ticket(s)
        </div>{" "}
        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Chargement des ventes...
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            Aucun ticket trouve.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {" "}
            {items.map((sale) => {
              const statusMeta = getStatusMeta(sale.status);
              const isBusy = actionLoadingId === sale.id;
              return (
                <article key={sale.id} className="p-4 space-y-3">
                  {" "}
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    {" "}
                    <div>
                      {" "}
                      <div className="text-sm font-bold text-slate-900">
                        {sale.receiptNo}
                      </div>{" "}
                      <div className="text-xs text-slate-500">
                        {" "}
                        {new Date(sale.createdAt).toLocaleString(
                          "fr-FR",
                        )} - {sale.customerName} - Caisse:{" "}
                        {formatActor(sale.createdByName, sale.createdBy)}{" "}
                      </div>{" "}
                    </div>{" "}
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusMeta.className}`}
                    >
                      {" "}
                      {statusMeta.label}{" "}
                    </span>{" "}
                  </div>{" "}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                    {" "}
                    <div>
                      {" "}
                      <div className="text-xs text-slate-500">
                        Articles
                      </div>{" "}
                      <div className="font-semibold text-slate-800">
                        {sale.itemsCount}
                      </div>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <div className="text-xs text-slate-500">Total</div>{" "}
                      <div className="font-semibold text-slate-800">
                        {formatMoney(sale.total)}
                      </div>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <div className="text-xs text-slate-500">Paye</div>{" "}
                      <div className="font-semibold text-slate-800">
                        {formatMoney(sale.amountPaid)}
                      </div>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <div className="text-xs text-slate-500">Solde</div>{" "}
                      <div className="font-semibold text-slate-800">
                        {formatMoney(sale.balanceDue)}
                      </div>{" "}
                    </div>{" "}
                    <div>
                      {" "}
                      <div className="text-xs text-slate-500">
                        Paiement
                      </div>{" "}
                      <div className="font-semibold text-slate-800">
                        {formatPaymentMethod(sale.paymentMethod)}
                      </div>{" "}
                    </div>{" "}
                    <div className="flex items-end gap-2 justify-start md:justify-end">
                      {" "}
                      <button
                        onClick={() => {
                          void openSaleDetail(sale.id);
                        }}
                        disabled={detailLoadingId === sale.id || isBusy}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {" "}
                        <Eye className="h-3.5 w-3.5" /> Detail{" "}
                      </button>{" "}
                      <button
                        onClick={() => openRefundSale(sale)}
                        disabled={!sale.canRefund || isBusy}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {" "}
                        Rembourser{" "}
                      </button>{" "}
                      <button
                        onClick={() => {
                          void handleVoidSale(sale);
                        }}
                        disabled={!sale.canVoid || isBusy}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {" "}
                        <Ban className="h-3.5 w-3.5" /> Annuler{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                </article>
              );
            })}{" "}
          </div>
        )}{" "}
        <div className="px-4 py-3 border-t flex items-center justify-between">
          {" "}
          <div className="text-xs text-slate-500">{pageLabel}</div>{" "}
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
    </div>
  );
}
