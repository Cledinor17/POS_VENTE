"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createBankAccount,
  ignoreStatementLine,
  importStatementCsv,
  listBankAccounts,
  listStatementLines,
  matchStatementLine,
  suggestMatches,
  unmatchStatementLine,
  type BankAccountItem,
  type BankStatementLineItem,
  type MatchSuggestion,
} from "@/lib/bankReconciliationApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

const STATUS_LABELS: Record<string, string> = {
  unmatched: "Non rapproche",
  matched: "Rapproche",
  ignored: "Ignore",
};

export default function BankReconciliationPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [lines, setLines] = useState<BankStatementLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [savingAccount, setSavingAccount] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [suggestionsByLine, setSuggestionsByLine] = useState<Record<string, MatchSuggestion[]>>({});
  const [busyLineId, setBusyLineId] = useState("");

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const loadAccounts = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const result = await listBankAccounts(businessSlug);
      setAccounts(result);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId("");
      return;
    }
    if (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const loadLines = useCallback(async () => {
    if (!businessSlug || !selectedAccountId) {
      setLines([]);
      return;
    }
    setLinesLoading(true);
    setError("");
    try {
      const result = await listStatementLines(businessSlug, selectedAccountId);
      setLines(result);
      setSuggestionsByLine({});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLinesLoading(false);
    }
  }, [businessSlug, selectedAccountId]);

  useEffect(() => {
    void loadLines();
  }, [loadLines]);

  async function onCreateAccount(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug || !accountName.trim()) return;
    setSavingAccount(true);
    setError("");
    try {
      const created = await createBankAccount(businessSlug, { name: accountName.trim(), currency: accountCurrency });
      setAccountName("");
      setAccountFormOpen(false);
      await loadAccounts();
      setSelectedAccountId(created.id);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingAccount(false);
    }
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !businessSlug || !selectedAccountId) return;
    setUploading(true);
    setError("");
    setInfo("");
    try {
      const result = await importStatementCsv(businessSlug, selectedAccountId, file);
      setInfo(`${result.imported} ligne(s) importee(s).`);
      await loadLines();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function onLoadSuggestions(lineId: string) {
    if (!businessSlug || !selectedAccountId) return;
    setBusyLineId(lineId);
    setError("");
    try {
      const suggestions = await suggestMatches(businessSlug, selectedAccountId, lineId);
      setSuggestionsByLine((prev) => ({ ...prev, [lineId]: suggestions }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyLineId("");
    }
  }

  async function onMatch(lineId: string, journalLineId: string) {
    if (!businessSlug || !selectedAccountId) return;
    setBusyLineId(lineId);
    setError("");
    try {
      await matchStatementLine(businessSlug, selectedAccountId, lineId, journalLineId);
      await loadLines();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyLineId("");
    }
  }

  async function onUnmatch(lineId: string) {
    if (!businessSlug || !selectedAccountId) return;
    setBusyLineId(lineId);
    setError("");
    try {
      await unmatchStatementLine(businessSlug, selectedAccountId, lineId);
      await loadLines();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyLineId("");
    }
  }

  async function onIgnore(lineId: string) {
    if (!businessSlug || !selectedAccountId) return;
    setBusyLineId(lineId);
    setError("");
    try {
      await ignoreStatementLine(businessSlug, selectedAccountId, lineId);
      await loadLines();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyLineId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-emerald-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Rapprochement bancaire</h1>
            <p className="mt-1 text-sm text-slate-200">
              Importez un releve CSV (colonnes date, description, amount, reference) et rapprochez-le avec la comptabilite.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAccountFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-[#0b4f88] hover:bg-slate-100"
          >
            Nouveau compte bancaire
          </button>
        </div>

        {accountFormOpen ? (
          <form onSubmit={onCreateAccount} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white/10 p-4">
            <label className="space-y-0.5 text-xs">
              <span className="text-slate-200">Nom du compte</span>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Compte principal"
                className="block w-56 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-slate-300 focus:outline-none"
              />
            </label>
            <label className="space-y-0.5 text-xs">
              <span className="text-slate-200">Devise</span>
              <input
                type="text"
                value={accountCurrency}
                onChange={(e) => setAccountCurrency(e.target.value.toUpperCase())}
                className="block w-24 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={savingAccount}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0b4f88] hover:bg-slate-100 disabled:opacity-60"
            >
              {savingAccount ? "Creation..." : "Creer"}
            </button>
          </form>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {info ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Comptes bancaires</h2>
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Chargement...</div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">Aucun compte bancaire.</div>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(a.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedAccountId === a.id
                        ? "border-[#0b4f88] bg-[#0b4f88]/5"
                        : "border-slate-200 hover:border-[#0b4f88]/40 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{a.name}</div>
                    <div className="text-xs text-slate-500">
                      {a.currency}
                      {a.ledgerAccountName ? ` - ${a.ledgerAccountName}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-3">
          {!selectedAccount ? (
            <div className="py-16 text-center text-sm text-slate-500">Selectionnez un compte bancaire.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{selectedAccount.name}</h2>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0b4f88] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0d63b8]">
                  {uploading ? "Import..." : "Importer un releve CSV"}
                  <input type="file" accept=".csv,text/csv" className="hidden" disabled={uploading} onChange={onImport} />
                </label>
              </div>

              {linesLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Chargement...</div>
              ) : lines.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">Aucune ligne de releve importee.</div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-slate-500">
                        <th className="pb-2 font-semibold">Date</th>
                        <th className="pb-2 font-semibold">Description</th>
                        <th className="pb-2 text-right font-semibold">Montant</th>
                        <th className="pb-2 font-semibold">Statut</th>
                        <th className="pb-2 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-b last:border-0 align-top">
                          <td className="py-2 text-slate-700">{formatDate(line.txnDate)}</td>
                          <td className="py-2 text-slate-700">
                            {line.description || "-"}
                            {line.externalReference ? (
                              <div className="text-xs text-slate-400">{line.externalReference}</div>
                            ) : null}
                          </td>
                          <td className={`py-2 text-right font-semibold ${line.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatMoney(line.amount, selectedAccount.currency)}
                          </td>
                          <td className="py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                line.status === "matched"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : line.status === "ignored"
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {STATUS_LABELS[line.status]}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            {line.status === "unmatched" ? (
                              <div className="space-y-2">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={busyLineId === line.id}
                                    onClick={() => onLoadSuggestions(line.id)}
                                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    Suggerer
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyLineId === line.id}
                                    onClick={() => onIgnore(line.id)}
                                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    Ignorer
                                  </button>
                                </div>
                                {suggestionsByLine[line.id]?.length ? (
                                  <ul className="space-y-1 text-left">
                                    {suggestionsByLine[line.id].map((s) => (
                                      <li key={s.journalLineId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                                        <span className="text-xs text-slate-600">
                                          {formatDate(s.entryDate ?? "")} - {s.memo || s.action}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => onMatch(line.id, s.journalLineId)}
                                          className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                        >
                                          Associer
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : suggestionsByLine[line.id] ? (
                                  <div className="text-xs text-slate-400">Aucune suggestion.</div>
                                ) : null}
                              </div>
                            ) : line.status === "matched" ? (
                              <button
                                type="button"
                                disabled={busyLineId === line.id}
                                onClick={() => onUnmatch(line.id)}
                                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Annuler le rapprochement
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
