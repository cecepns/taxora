const STYLES = {
  menunggu: {
    pill: "bg-amber-50 text-amber-700 ring-amber-200/80",
    dot: "bg-amber-500",
  },
  disetujui: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    dot: "bg-emerald-500",
  },
  ditolak: {
    pill: "bg-rose-50 text-rose-700 ring-rose-200/80",
    dot: "bg-rose-500",
  },
  revisi: {
    pill: "bg-sky-50 text-sky-700 ring-sky-200/80",
    dot: "bg-sky-500",
  },
};

export default function StatusBadge({ s, note }) {
  const st = STYLES[s] || { pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span
      title={note || ""}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${st.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {s}
    </span>
  );
}
