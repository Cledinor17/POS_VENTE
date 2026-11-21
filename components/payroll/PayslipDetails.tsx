"use client";

import { useEffect, useRef } from "react";
import { type PayrollRunDetail, type PayslipItem } from "@/lib/payrollApi";

export default function PayslipDetails({ payslip, run, onClose }: {
  payslip: PayslipItem;
  run: PayrollRunDetail;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") { event.preventDefault(); closeButton.current?.focus(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, []);

  const money = (value: number) => {
    try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: payslip.currency }).format(value); }
    catch { return `${value.toFixed(2)} ${payslip.currency}`; }
  };
  const date = (value: string) => value.split("-").reverse().join("/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="payslip-detail-title" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
          <h2 id="payslip-detail-title" className="text-lg font-bold text-slate-900">Détail du bulletin</h2>
          <button ref={closeButton} type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Fermer</button>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="font-bold text-slate-900">{payslip.employeeName}</p>
            <p className="text-sm text-slate-500">{payslip.jobTitle || "Poste non renseigné"}</p>
            <p className="mt-2 text-sm text-slate-600">{run.number} · {date(run.periodStart)} – {date(run.periodEnd)}</p>
            <p className="mt-1 text-sm text-slate-600">{run.status === "finalized" ? "Paie validée" : "Bulletin calculé · brouillon"}</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt>Salaire brut</dt><dd className="font-semibold">{money(payslip.grossAmount)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Déductions</dt><dd className="font-semibold text-rose-700">{money(payslip.totalDeductions)}</dd></div>
          </dl>
          {payslip.breakdown.length ? (
            <ul className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {payslip.breakdown.map((item, index) => (
                <li key={index} className="flex justify-between gap-4"><span>{item.label} ({item.type === "percent" ? `${item.rate}%` : money(item.rate)})</span><span className="shrink-0 text-rose-700">− {money(item.amount)}</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Aucune déduction sur ce bulletin.</p>}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-4 font-bold"><span>Net à payer</span><span className="text-emerald-700">{money(payslip.netAmount)}</span></div>
        </div>
      </section>
    </div>
  );
}
