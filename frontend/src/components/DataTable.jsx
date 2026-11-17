import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import AppSelect from "@/components/AppSelect";

const LIMIT_OPTIONS = [10, 25, 50, 100].map((n) => ({ value: n, label: `${n} / hal` }));
const ACTION_LABELS = new Set(["aksi", "laporan", "akses", "penetapan"]);

export default function DataTable({
  t,
  columns,
  toolbar,
  empty = "Belum ada data",
  searchPlaceholder = "Cari data...",
}) {
  const { rows, loading, pagination: p, page, setPage, limit, setLimit, search, setSearch } = t;
  const pages = Array.from({ length: p.totalPages }, (_, i) => i + 1).filter(
    (n) => Math.abs(n - page) <= 2 || n === 1 || n === p.totalPages
  );

  const infoCols = columns.filter((c) => !ACTION_LABELS.has(c.label.toLowerCase()));
  const actionCols = columns.filter((c) => ACTION_LABELS.has(c.label.toLowerCase()));

  return (
    <div className="card overflow-hidden">
      {/* Responsive Toolbar */}
      <div className="flex flex-col gap-2.5 border-b border-slate-100 bg-slate-50/60 p-4 md:flex-row md:flex-wrap md:items-center">
        <div className="relative w-full md:min-w-[220px] md:flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="input pl-10"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
          {toolbar}
          <div className="w-full md:w-32 md:shrink-0">
            <AppSelect
              size="sm"
              isSearchable={false}
              options={LIMIT_OPTIONS}
              value={limit}
              onChange={(val) => setLimit(Number(val) || 10)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Responsive Card View (< md) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500">{empty}</p>
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="space-y-2.5 bg-white p-4">
              {infoCols.map((c) => {
                const content = c.render ? c.render(r) : r[c.key] ?? "-";
                return (
                  <div key={c.label} className="flex items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {c.label}
                    </span>
                    <div className="min-w-0 text-right text-slate-800">{content}</div>
                  </div>
                );
              })}

              {actionCols.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {actionCols.map((c) => (
                    <div key={c.label} className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {c.label}
                      </span>
                      <div>{c.render ? c.render(r) : r[c.key]}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Crisp Table View (>= md) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200/80 bg-brand-50/70 text-xs font-bold uppercase tracking-wider text-brand">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.label}
                  className={`whitespace-nowrap px-4 py-3.5 ${c.thClassName || ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={columns.length} className="px-4 py-3">
                    <div className="h-7 animate-pulse rounded-lg bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-14 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Inbox size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">{empty}</p>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-brand-50/40">
                  {columns.map((c) => (
                    <td
                      key={c.label}
                      className={`px-4 py-3.5 align-middle text-slate-700 ${c.tdClassName || ""}`}
                    >
                      {c.render ? c.render(r) : r[c.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 text-sm text-slate-500">
        <span>
          Total <strong className="font-semibold text-slate-700">{p.total}</strong> data
          {p.totalPages > 1 && (
            <span className="ml-1.5 text-slate-400">
              (Hal. {page} dari {p.totalPages})
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn-ghost !rounded-lg !px-2.5 !py-1.5"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          {pages.map((n, idx) => (
            <span key={n} className="flex items-center gap-1.5">
              {idx > 0 && n - pages[idx - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
              <button
                type="button"
                onClick={() => setPage(n)}
                className={`h-8 min-w-[2rem] rounded-lg px-2 text-sm font-semibold transition ${
                  n === page
                    ? "bg-brand text-white shadow-sm shadow-brand/30"
                    : "text-slate-600 hover:bg-brand-light hover:text-brand"
                }`}
              >
                {n}
              </button>
            </span>
          ))}
          <button
            type="button"
            className="btn-ghost !rounded-lg !px-2.5 !py-1.5"
            disabled={page >= p.totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
