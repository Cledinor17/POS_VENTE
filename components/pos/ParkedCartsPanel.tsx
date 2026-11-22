"use client";

import { PauseCircle, PlayCircle, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { posCompactLabels } from "@/lib/posCompactI18n";
import { formatMoney } from "@/lib/currency";
import type { UnpostedDepositMemo } from "@/lib/posDepositMemosApi";

type Currency = "HTG" | "USD";
type ParkedItem = { id: string; note: string; createdAt: string; items: { qty: number }[] };
type DepositDraft = { amount: string; currency: Currency; requestKey?: string };

export type ParkedCartsPanelProps = {
  locale: Locale;
  count: number;
  carts: ParkedItem[];
  note: string;
  onNote: (value: string) => void;
  depositAmount: string;
  onDepositAmount: (value: string) => void;
  depositCurrency: Currency;
  onDepositCurrency: (value: Currency) => void;
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
  onPark: () => void;
  onResume: (id: string) => void;
  onRecord: (id: string, draft: DepositDraft) => void;
  onRequestDelete: (id: string) => void;
  confirming: { id: string; note: string } | null;
  deletingId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
};

export default function ParkedCartsPanel({
  locale, count, carts, note, onNote, depositAmount, onDepositAmount,
  depositCurrency, onDepositCurrency, drafts, onDraft, totals, perCart, memos, status,
  savingDepositId, canRecord, online, branchReady, onPark, onResume, onRecord,
  onRequestDelete, confirming, deletingId, onCancelDelete, onConfirmDelete,
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
        <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{ui.createTab}</p>
          <input
            value={note} onChange={event => onNote(event.target.value)}
            placeholder={ui.note} aria-label={ui.note} maxLength={190}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_95px] gap-2">
            <label className="min-w-0 text-xs font-semibold text-slate-700">
              {ui.downDeposit} <span className="font-normal text-slate-500">({ui.optional})</span>
              <input
                type="text" inputMode="decimal" value={depositAmount}
                onChange={event => onDepositAmount(event.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              {ui.currency}
              <select
                value={depositCurrency} onChange={event => onDepositCurrency(event.target.value as Currency)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="HTG">HTG</option><option value="USD">USD</option>
              </select>
            </label>
          </div>
          <button
            type="button" onClick={onPark} disabled={count === 0 || savingDepositId !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
          >
            <PauseCircle className="h-4 w-4" />{ui.park}
          </button>
        </div>
        {memos.length > 0 ? (
          <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              {ui.declared} · {memos.length}{memos.length >= 500 ? "+" : ""}
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
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {matchingCarts.length === 0 ? <p className="py-2 text-xs text-slate-500">{ui.pendingEmpty}</p> : null}
            {matchingCarts.map(parked => {
              const held = perCart[parked.id];
              const draft = drafts[parked.id] ?? { amount: "", currency: "HTG" as const };
              return (
                <div key={parked.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900">{parked.note}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {parked.items.reduce((sum, item) => sum + item.qty, 0)} {ui.items}
                    </span>
                  </div>
                  {held && (held.HTG > 0 || held.USD > 0) ? (
                    <div className="mt-1 text-xs font-semibold text-amber-800">
                      {ui.declaredOnSlip}: {held.HTG > 0 ? formatMoney(held.HTG, "HTG") : ""}
                      {held.HTG > 0 && held.USD > 0 ? " · " : ""}
                      {held.USD > 0 ? formatMoney(held.USD, "USD") : ""}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold text-indigo-800">{ui.downDeposit}</p>
                    <div className="flex flex-wrap gap-2">
                    <input
                      type="text" inputMode="decimal" aria-label={ui.downDeposit}
                      title={ui.downDeposit} placeholder={ui.amount} value={draft.amount}
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
                      {savingDepositId === parked.id ? ui.loading : ui.record}
                    </button>
                  </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
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
