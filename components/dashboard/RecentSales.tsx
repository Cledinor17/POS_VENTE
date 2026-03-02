export default function RecentSales() {
  return (
    <>
      <h3 className="font-bold text-slate-800 mb-4 text-lg">Ventes Récentes</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
              BT
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Burger Teriyaki</p>
              <p className="text-xs text-slate-500">Il y a 2 min</p>
            </div>
          </div>
          <span className="font-bold text-slate-700 text-sm">$12.00</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
              CJ
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Coca-Cola (L)</p>
              <p className="text-xs text-slate-500">Il y a 15 min</p>
            </div>
          </div>
          <span className="font-bold text-slate-700 text-sm">$3.50</span>
        </div>
      </div>

      <button className="w-full mt-6 text-sm font-bold text-indigo-600 hover:text-indigo-700">
        Voir tout
      </button>
    </>
  );
}
