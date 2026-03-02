import Link from "next/link";

type AccountingPageProps = {
  params: Promise<{ business: string }>;
};

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { business } = await params;

  return (
    <div className="space-y-5">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Comptabilite</h1>
        <p className="text-slate-500 mt-1">Acces rapide aux modules comptables relies au backend.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href={`/${business}/accounting/periods`}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50"
        >
          <h2 className="font-bold text-slate-900">Periodes comptables</h2>
          <p className="text-sm text-slate-500 mt-1">Ouvrir, fermer et reouvrir les periodes.</p>
        </Link>

        <Link
          href={`/${business}/reports/finance`}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50"
        >
          <h2 className="font-bold text-slate-900">Bilan & Resultat</h2>
          <p className="text-sm text-slate-500 mt-1">Consulter P&L, bilan et balance generale.</p>
        </Link>
      </section>
    </div>
  );
}
