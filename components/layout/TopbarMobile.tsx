"use client";

export default function TopbarMobile({
  brand,
  onToggle,
}: {
  brand: string;
  onToggle: () => void;
}) {
  return (
    <div className="lg:hidden flex items-center justify-between bg-indigo-600 p-4 text-white">
      <span className="text-xl font-bold">{brand}</span>
      <button onClick={onToggle} className="p-2 focus:outline-none" aria-label="Ouvrir le menu">
        <i className="fa-solid fa-bars text-2xl" />
      </button>
    </div>
  );
}
