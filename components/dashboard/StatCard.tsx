export default function StatCard({
  title,
  value,
  valueClass,
  note,
  noteTone,
  iconClass,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string;
  valueClass?: string;
  note: string;
  noteTone: "good" | "info" | "warn" | "muted";
  iconClass: string;
  iconBg: string;
  iconColor: string;
}) {
  const noteClass =
    noteTone === "good"
      ? "text-green-500"
      : noteTone === "info"
      ? "text-indigo-500"
      : noteTone === "warn"
      ? "text-amber-500"
      : "text-slate-400";

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-sm">{title}</p>
          <h3 className={`text-2xl font-bold mt-1 text-slate-800 ${valueClass ?? ""}`}>
            {value}
          </h3>
        </div>
        <div className={`p-3 rounded-xl ${iconBg} ${iconColor}`}>
          <i className={iconClass} />
        </div>
      </div>
      <p className={`text-xs mt-4 font-bold ${noteClass}`}>{note}</p>
    </div>
  );
}
