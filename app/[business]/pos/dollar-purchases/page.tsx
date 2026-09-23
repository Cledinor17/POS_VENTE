"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBranch } from "@/context/BranchContext";
import { getPosSettings, type BusinessSettings } from "@/lib/businessApi";
import { getCurrentCashSession, type CashSession } from "@/lib/cashSessionApi";
import { createDollarPurchase, listDollarPurchases, printDollarPurchase, dollarPurchaseReceiptHtml, dollarPurchaseReference, type DollarPurchase, type DollarPurchaseInput } from "@/lib/dollarPurchasesApi";
import { listPrinters, type PrinterItem } from "@/lib/printersApi";
import { printRawEscposViaQz } from "@/lib/qzPrint";
import { printHtmlDocument } from "@/lib/printHtml";
import { formatMoney } from "@/lib/currency";

export default function DollarPurchasesPage() {
  const { business } = useParams<{ business: string }>();
  const { currentBranch, loading: branchLoading } = useBranch();
  const branchId = currentBranch?.id;
  const storageKey = `dollar-purchase-pending:${business}:${branchId}`;
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [session, setSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<DollarPurchase[]>([]);
  const [printer, setPrinter] = useState<PrinterItem | null>(null);
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [pending, setPending] = useState<DollarPurchaseInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (branchLoading || !branchId) return;
    let active = true;
    setLoading(true); setSettings(null); setError(""); setHistory([]); setPending(null);
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) { const input = JSON.parse(saved) as DollarPurchaseInput; setPending(input); setAmount(String(input.usd_amount)); setCustomer(input.customer_name); }
      else { setAmount(""); setCustomer(""); }
    } catch { /* Server history remains authoritative. */ }
    void Promise.all([getPosSettings(business), getCurrentCashSession(business), listDollarPurchases(business), listPrinters(business)])
      .then(([config, cash, purchases, printers]) => {
        if (!active) return;
        setSettings(config); setSession(cash); setHistory(purchases);
        setPrinter(printers.find(item => item.isDefault) ?? null);
      }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Chargement impossible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [business, branchId, branchLoading, storageKey]);

  const usd = pending?.usd_amount ?? Number(amount);
  const rate = pending?.buy_rate ?? settings?.exchange_buy_rate ?? 0;
  const htg = Math.round(usd * rate * 100) / 100;
  const valid = Number.isFinite(usd) && usd > 0 && usd <= 10000000 && /^\d+(\.\d{1,2})?$/.test(amount);

  async function print(purchase: DollarPurchase, browser = false) {
    if (browser || !printer) {
      printHtmlDocument(dollarPurchaseReceiptHtml(purchase.receipt), { paperWidthMm: Number(printer?.paperWidth ?? 80), marginMm: 3 });
      return;
    }
    const result = await printDollarPurchase(business, purchase, printer.id);
    if (!result.printed) {
      if (!result.qz_printer_name || !result.data) throw new Error("Imprimante USB non configuree. Utilisez le ticket navigateur.");
      await printRawEscposViaQz(result.qz_printer_name, result.data);
    }
  }

  async function submit() {
    if (inFlight.current || !branchId || !settings || (!pending && (!valid || !session || !settings.dollar_purchase_enabled))) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const input = pending ?? { idempotency_key: dollarPurchaseReference(), usd_amount: usd, buy_rate: rate, customer_name: customer.trim() };
      setPending(input);
      try { sessionStorage.setItem(storageKey, JSON.stringify(input)); } catch { /* In-memory retries retain the same key. */ }
      const purchase = await createDollarPurchase(business, branchId, input);
      try { sessionStorage.removeItem(storageKey); } catch { /* Read-only browser storage. */ }
      setPending(null); setAmount(""); setCustomer("");
      setHistory(previous => [purchase, ...previous.filter(row => row.id !== purchase.id)]);
      setNotice(`Achat enregistre : ${formatMoney(purchase.receipt.usd_amount, "USD")} recus, ${formatMoney(purchase.receipt.htg_amount, "HTG")} a remettre au client.`);
      try { await print(purchase); }
      catch (e) { setError(`Achat deja enregistre. ${e instanceof Error ? e.message : "Impression indisponible."} Reimprimez depuis l’historique.`); }
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 422) {
        setPending(null); try { sessionStorage.removeItem(storageKey); } catch { /* Nothing else to clear. */ }
      }
      setError(e instanceof Error ? e.message : "Connexion interrompue. Reessayez le meme achat.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Point de vente</p><h1 className="text-2xl font-bold">Achat de dollars</h1></div><Link href={`/${business}/pos`} className="rounded-xl border px-4 py-2">Retour au POS</Link></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</div>}
    {loading ? <p>Chargement de la caisse et du taux…</p> : <>
      {!settings?.dollar_purchase_enabled && <p className="rounded-xl bg-amber-50 p-4">L’achat de dollars est désactivé. Le responsable peut l’activer dans les paramètres du business.</p>}
      {!session && <p className="rounded-xl bg-amber-50 p-4">La caisse est fermée. <Link className="underline" href={`/${business}/pos`}>Ouvrir la caisse dans le POS</Link>.</p>}
      <form onSubmit={event => { event.preventDefault(); void submit(); }} className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="mb-5 text-sm text-slate-600">Le client vend ses dollars au business. Taux d’achat : <strong>1 USD = {rate} HTG</strong>.</p>
        <div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2"><span className="block font-medium">Dollars reçus du client (USD)</span><input required inputMode="decimal" type="number" min="0.01" max="10000000" step="0.01" value={amount} disabled={busy || !!pending} onChange={event => setAmount(event.target.value)} className="w-full rounded-xl border px-4 py-3" /></label>
          <label className="space-y-2"><span className="block font-medium">Nom du client (facultatif)</span><input maxLength={190} value={customer} disabled={busy || !!pending} onChange={event => setCustomer(event.target.value)} className="w-full rounded-xl border px-4 py-3" /></label></div>
        <div className="my-5 rounded-xl bg-indigo-50 p-5"><p>Gourdes à remettre au client</p><p className="text-3xl font-bold text-indigo-900">{formatMoney(htg, "HTG")}</p></div>
        {pending && <p className="mb-3 text-sm text-amber-800">Vérification du même achat en attente. Le système évite un double enregistrement.</p>}
        <button disabled={busy || (!pending && (!valid || !session || !settings?.dollar_purchase_enabled))} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-40">{busy ? "Enregistrement…" : pending ? "Vérifier / réessayer cet achat" : "Enregistrer et imprimer le ticket"}</button>
      </form>
      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Mes 50 derniers achats — {currentBranch?.name}</h2>
        {history.length === 0 ? <p className="text-slate-500">Aucun achat enregistré.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Ticket / client</th><th>USD reçus</th><th>Taux</th><th>HTG remis</th><th>Ticket</th></tr></thead><tbody>{history.map(purchase => <tr key={purchase.id} className="border-b"><td className="p-2"><span className="block max-w-60 break-words">{purchase.number}</span><span className="text-slate-500">{purchase.receipt.date_label} · {purchase.receipt.customer_name}</span></td><td>{Number(purchase.receipt.usd_amount).toFixed(2)}</td><td>{purchase.receipt.buy_rate}</td><td>{Number(purchase.receipt.htg_amount).toFixed(2)}</td><td className="space-y-2 p-2"><button type="button" onClick={() => void print(purchase).catch(e => setError(e.message))} className="block text-indigo-700 underline">Réimprimer</button><button type="button" onClick={() => void print(purchase, true)} className="text-slate-600 underline">Navigateur / PDF</button></td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>;
}
