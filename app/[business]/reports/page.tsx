import Link from "next/link";

type ReportsPageProps = {
  params: Promise<{ business: string }>;
};

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { business } = await params;

  return (
    <div className="space-y-5">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Rapports</h1>
        <p className="text-slate-500 mt-1">Choisis un module de rapport relie au backend.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/${business}/reports/sales`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50">
          <h2 className="font-bold text-slate-900">Rapports ventes</h2>
          <p className="text-sm text-slate-500 mt-1">Tickets, paiements, remboursements.</p>
        </Link>
        <Link href={`/${business}/reports/inventory`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50">
          <h2 className="font-bold text-slate-900">Rapports stock</h2>
          <p className="text-sm text-slate-500 mt-1">Valeur stock, alertes et mouvements.</p>
        </Link>
        <Link href={`/${business}/reports/ar`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50">
          <h2 className="font-bold text-slate-900">Creances clients</h2>
          <p className="text-sm text-slate-500 mt-1">A/R summary et aging.</p>
        </Link>
        <Link href={`/${business}/reports/finance`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50">
          <h2 className="font-bold text-slate-900">Bilan & Resultat</h2>
          <p className="text-sm text-slate-500 mt-1">Trial balance, P&L, balance sheet.</p>
        </Link>
      </section>
    </div>
  );
}
