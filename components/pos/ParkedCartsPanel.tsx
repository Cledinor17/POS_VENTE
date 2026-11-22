"use client";

import { PlayCircle, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { posCompactLabels } from "@/lib/posCompactI18n";
import { formatMoney, type ExchangeConfig } from "@/lib/currency";
import type { UnpostedDepositMemo } from "@/lib/posDepositMemosApi";
import { calculateParkedBalance, type ParkedBalanceItem } from "@/lib/posParkedBalance";

type Currency = "HTG" | "USD";
type ParkedItem = { id: string; note: string; createdAt: string; items: ParkedBalanceItem[]; version?: number; depositTotals?: { HTG: number; USD: number } };
type DepositDraft = { amount: string; currency: Currency; requestKey?: string };

export type ParkedCartsPanelProps = {
  locale: Locale;
  carts: ParkedItem[];
  preferredCurrency: Currency;
  exchange: ExchangeConfig;
  memosComplete: boolean;
  drafts: Record<string, DepositDraft>;
  onDraft: (id: string, value: DepositDraft) => void;
  totals: { HTG: string; USD: string };
  perCart: Record<string, { HTG: number; USD: number }>;
  memos: UnpostedDepositMemo[];
  status: "ready" | "loading" | "unavailable";
  savingDepositId: string | null;
  canRecord: boolean;
  online: boolean;
  branchReady: boolean;
  onResume: (id: string) => void;
  onRecord: (id: string, draft: DepositDraft) => void;
  onRequestDelete: (id: string) => void;
  confirming: { id: string; note: string } | null;
  deletingId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
};

export default function ParkedCartsPanel({
  locale, carts, preferredCurrency, exchange, memosComplete, drafts, onDraft,
  totals, perCart, memos, status, savingDepositId, canRecord, online, branchReady,
  onResume, onRecord, onRequestDelete, confirming, deletingId,
  onCancelDelete, onConfirmDelete,
}: ParkedCartsPanelProps) {
  const ui = posCompactLabels(locale);
  const [tabSearch, setTabSearch] = useState("");
  const matchingCarts = carts.filter(parked =>
    `${parked.note} ${parked.id}`.toLocaleLowerCase().includes(tabSearch.trim().toLocaleLowerCase()),
  );

  return (
    <>
      <section id="pos-pending-section" className="scroll-mt-4 space-y-3 rounded-2xl border-2 border-indigo-100 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">{ui.pending}</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{carts.length}</span>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5" role="status">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-indigo-900">
            <span>{ui.declared}</span>
            <span>{ui.unposted}</span>
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-base font-extrabold tabular-nums text-indigo-950">
            {status === "ready" ? (
              <>
                <span>HTG {totals.HTG}</span>
                <span>USD {totals.USD}</span>
              </>
            ) : <span>{status === "loading" ? ui.loading : "—"}</span>}
          </div>
        </div>

        {memos.length > 0 ? (
          <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              {ui.declared} · {memos.length}{!memosComplete ? "+" : ""}
            </summary>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {memos.slice(0, 20).map(entry => (
                <div key={entry.id} className="flex flex-wrap justify-between gap-1 border-t border-slate-200 py-1">
                  <span className="min-w-0 truncate" title={entry.note ?? entry.cart_reference}>
                    {entry.note || entry.cart_reference}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {formatMoney(Number(entry.amount), entry.currency)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {carts.length >= 5 ? (
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">{ui.findTab}</span>
            <input value={tabSearch} onChange={event => setTabSearch(event.target.value)}
              placeholder={ui.findTab} aria-label={ui.findTab}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
          </label>
        ) : null}

        {carts.length > 0 ? (
          <div className="max-h-[440px] space-y-2 overflow-y-auto">
            {matchingCarts.length === 0 ? <p className="py-2 text-xs text-slate-500">{ui.pendingEmpty}</p> : null}
            {matchingCarts.map(parked => {
              const held = perCart[parked.id] ?? { HTG: 0, USD: 0 };
              const draft = drafts[parked.id] ?? { amount: "", currency: preferredCurrency };
              const ready = Boolean(parked.version && parked.depositTotals) || (status === "ready" && memosComplete);
              const balance = ready
                ? calculateParkedBalance(parked.items, held, preferredCurrency, exchange)
                : null;
              const originalDeposits = [held.HTG > 0 ? formatMoney(held.HTG, "HTG") : null,
                held.USD > 0 ? formatMoney(held.USD, "USD") : null].filter(Boolean).join(" · ");

              return (
                <div key={parked.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900" title={parked.note}>{parked.note}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {parked.items.reduce((sum, item) => sum + item.qty, 0)} {ui.items}
                    </span>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">{ui.estimatedTotal}</span>
                      <strong className="tabular-nums text-slate-900">{balance?.total == null ? "—" : formatMoney(balance.total, balance.currency)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">{ui.declaredOnSlip}</span>
                      <strong className="text-right tabular-nums text-indigo-900">{ready ? (originalDeposits || formatMoney(0, balance?.currency || preferredCurrency)) : "—"}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-1">
                      <span className="font-bold text-slate-800">{ui.estimatedDue}</span>
                      <strong className="tabular-nums text-indigo-900">{balance?.remaining == null ? "—" : formatMoney(balance.remaining, balance.currency)}</strong>
                    </div>
                    {balance?.overpayment != null && balance.overpayment > 0 ? (
                      <p className="font-semibold text-amber-700">{ui.overpaid} : {formatMoney(balance.overpayment, balance.currency)}</p>
                    ) : null}
                    <p className="text-[10px] leading-snug text-slate-500">{!ready && status === "ready" ? ui.incompleteDeposits : ui.estimateInfo}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-indigo-800">{ui.downDeposit} · Total souhaité (0 pour annuler)</p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text" inputMode="decimal" aria-label={ui.downDeposit}
                        title={ui.downDeposit} placeholder={held[draft.currency].toFixed(2)} value={draft.amount}
                        disabled={Boolean(draft.requestKey) || savingDepositId === parked.id}
                        onChange={event => onDraft(parked.id, { amount: event.target.value, currency: draft.currency })}
                        className="min-w-0 flex-1 basis-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                      />
                      <select
                        aria-label={ui.currency} value={draft.currency}
                        disabled={Boolean(draft.requestKey) || savingDepositId === parked.id}
                        onChange={event => onDraft(parked.id, { amount: draft.amount, currency: event.target.value as Currency })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="HTG">HTG</option><option value="USD">USD</option>
                      </select>
                      <button
                        type="button" onClick={() => onRecord(parked.id, draft)}
                        disabled={!draft.amount || !online || !branchReady || !canRecord || savingDepositId !== null}
                        className="rounded-lg border border-indigo-300 bg-white px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {savingDepositId === parked.id ? ui.loading : "Modifier"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onResume(parked.id)}
                      disabled={savingDepositId === parked.id}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg brand-primary-btn py-2 text-xs font-semibold text-white disabled:opacity-50">
                      <PlayCircle className="h-3.5 w-3.5" />{ui.resume}
                    </button>
                    <button type="button" onClick={() => onRequestDelete(parked.id)}
                      disabled={savingDepositId === parked.id}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />{ui.remove}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-slate-500">{ui.pendingEmpty}</p>}
      </section>
      {confirming ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-parked-title"
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="confirm-parked-title" className="text-lg font-bold text-slate-900">{ui.pleaseConfirm}</h2>
            <p className="text-sm text-slate-700">{ui.confirmRemove} <strong>{confirming.note}</strong></p>
            {perCart[confirming.id]?.HTG || perCart[confirming.id]?.USD
              ? <p className="text-xs font-semibold text-amber-800">{ui.alreadyUnposted}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={deletingId !== null} onClick={onCancelDelete}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                {ui.no}
              </button>
              <button type="button" disabled={deletingId !== null} onClick={() => onConfirmDelete(confirming.id)}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {deletingId ? ui.loading : ui.yes}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
