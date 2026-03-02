"use client";

export default function HeaderDesktop({
  username,
  initials,
  onNewSale,
}: {
  username: string;
  initials: string;
  onNewSale: () => void;
}) {
  return (
    <header className="hidden lg:flex items-center justify-between bg-white border-b border-slate-200 px-8 py-4">
      <h1 className="text-xl font-bold text-slate-800">Bonjour, {username} 👋</h1>
      <div className="flex items-center space-x-4">
        <button
          onClick={onNewSale}
          className="bg-amber-100 text-amber-600 px-4 py-2 rounded-lg font-bold hover:bg-amber-200 transition"
        >
          <i className="fa-solid fa-plus mr-2" />
          Nouvelle Vente
        </button>
        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
          {initials}
        </div>
      </div>
    </header>
  );
}
