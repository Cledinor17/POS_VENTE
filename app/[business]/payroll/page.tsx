"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Users, Wallet } from "lucide-react";
import EmployeesManager from "@/components/employees/EmployeesManager";
import PayrollRuns from "@/components/payroll/PayrollRuns";

export default function PayrollPage() {
  const { business } = useParams<{ business: string }>();
  const [tab, setTab] = useState<"payroll" | "employees">("payroll");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Paie & employés</h1>
        <p className="mt-1 text-sm text-slate-500">Fiches employés, salaires, paiements et bulletins réunis au même endroit.</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Sections paie et employés">
          <button type="button" aria-pressed={tab === "payroll"} onClick={() => setTab("payroll")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "payroll" ? "brand-primary-btn text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <Wallet aria-hidden="true" className="h-4 w-4" />
            Bulletins de paie
          </button>
          <button type="button" aria-pressed={tab === "employees"} onClick={() => setTab("employees")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "employees" ? "brand-primary-btn text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <Users aria-hidden="true" className="h-4 w-4" />
            Employés, paiements & déductions
          </button>
        </div>
      </section>
      {tab === "payroll" ? <PayrollRuns key={`payroll-${business}`} /> : <EmployeesManager key={`employees-${business}`} embedded />}
    </div>
  );
}
