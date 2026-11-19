import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale/id";
import {
  AlertTriangle,
  Award,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileCheck2,
  LayoutDashboard,
  Lock,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import AppSelect from "@/components/AppSelect";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const STAT_CONFIG = [
  {
    key: "relawan",
    label: "Relawan Aktif",
    icon: Users,
    cardBg: "bg-sky-50/70 border-sky-100 hover:border-sky-200",
    iconBg: "bg-sky-500/15 text-sky-700",
    valColor: "text-sky-900",
  },
  {
    key: "hadir",
    label: "Total Presensi",
    icon: ClipboardCheck,
    cardBg: "bg-emerald-50/70 border-emerald-100 hover:border-emerald-200",
    iconBg: "bg-emerald-500/15 text-emerald-700",
    valColor: "text-emerald-900",
  },
  {
    key: "total_wp",
    label: "WP Dilayani",
    icon: FileCheck2,
    cardBg: "bg-indigo-50/70 border-indigo-100 hover:border-indigo-200",
    iconBg: "bg-indigo-500/15 text-indigo-700",
    valColor: "text-indigo-900",
  },
  {
    key: "menunggu",
    label: "Menunggu Verifikasi",
    icon: Clock,
    cardBg: "bg-amber-50/70 border-amber-100 hover:border-amber-200",
    iconBg: "bg-amber-500/15 text-amber-700",
    valColor: "text-amber-900",
  },
  {
    key: "terlambat",
    label: "Terlambat",
    icon: AlertTriangle,
    cardBg: "bg-rose-50/70 border-rose-100 hover:border-rose-200",
    iconBg: "bg-rose-500/15 text-rose-700",
    valColor: "text-rose-900",
  },
  {
    key: "pergantian_menunggu",
    label: "Pergantian Menunggu",
    icon: RefreshCw,
    cardBg: "bg-purple-50/70 border-purple-100 hover:border-purple-200",
    iconBg: "bg-purple-500/15 text-purple-700",
    valColor: "text-purple-900",
  },
];

export default function Home() {
  const curYear = new Date().getFullYear();
  const [year, setYear] = useState(String(curYear));
  const [years, setYears] = useState([curYear, curYear - 1]);
  const [d, setD] = useState(null);
  const [nimQuery, setNimQuery] = useState("");
  const [nimResults, setNimResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const user = getUser();
  const isAdmin = user?.role === "admin";
  const todayLabel = format(new Date(), "EEEE, dd MMMM yyyy", { locale: id });

  useEffect(() => {
    request("get", API_ENDPOINTS.PERIODS.LIST).then((r) => {
      if (r?.years?.length) setYears(r.years);
    });
  }, []);

  useEffect(() => {
    setD(null);
    request("get", API_ENDPOINTS.SUMMARY, { year }).then((r) => setD(r?.data || []));
  }, [year]);

  const searchNim = async (e) => {
    e.preventDefault();
    if (!nimQuery.trim()) return setNimResults([]);
    setSearching(true);
    const r = await request("get", API_ENDPOINTS.RELAWAN.SEARCH_NIM, { nim: nimQuery.trim() });
    setSearching(false);
    setNimResults(r?.data || []);
  };

  const totals = d
    ? STAT_CONFIG.reduce((acc, s) => {
        acc[s.key] = d.reduce((sum, p) => sum + Number(p[s.key] || 0), 0);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0E5A7C] via-[#126C94] to-[#0A4259] p-6 text-white shadow-lg shadow-brand/15 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-36 w-36 rounded-full bg-accent/25 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-sky-100 backdrop-blur-sm">
              <LayoutDashboard size={14} />
              Ringkasan Operasional Periode {year}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Selamat datang, {user?.name || "Pengguna"}
            </h1>
            <p className="text-sm text-sky-100/85">
              Pantau statistik relawan, kehadiran, pelayanan WP, dan verifikasi per program tanpa mencampur penilaian.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-40 sm:w-44 min-w-[140px] text-slate-800">
              <AppSelect
                size="sm"
                isSearchable={false}
                options={years.map((y) => ({ value: String(y), label: `Tahun ${y}` }))}
                value={year}
                onChange={setYear}
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm">
              <CalendarDays size={18} className="text-accent" />
              <span className="capitalize">{todayLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {!d ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/80" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200/80" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Aggregate KPI Row when Admin views multiple programs (Divided 2 by 2 on mobile/tablet, 3 by 3 on desktop) */}
          {d.length > 1 && totals && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
              {STAT_CONFIG.map(({ key, label, icon: Icon, iconBg, valColor }) => (
                <div
                  key={key}
                  className="card group flex items-center gap-4 p-4.5 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${iconBg}`}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight leading-none mb-1.5 ${valColor}`}>
                      {Number(totals[key] || 0).toLocaleString("id-ID")}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug break-words">
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Program Breakdown Cards (side-by-side) */}
          <div className={`grid gap-6 ${d.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
            {d.map((p, idx) => {
              const ProgramIcon = p.name?.toLowerCase().includes("clinic") ? Building2 : Award;
              return (
                <section key={p.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-brand-50/80 to-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ${
                          idx % 2 === 0
                            ? "bg-gradient-to-br from-brand to-brand-dark"
                            : "bg-gradient-to-br from-accent to-accent-dark"
                        }`}
                      >
                        <ProgramIcon size={21} />
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-900">{p.name}</h2>
                        <p className="text-xs font-medium text-slate-500">Statistik Program Periode {year}</p>
                      </div>
                    </div>
                    {p.period_closed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                        <Lock size={12} />
                        Ditutup (Arsip)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Aktif
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-3.5 p-5 sm:grid-cols-3">
                    {STAT_CONFIG.map(({ key, label, icon: Icon, cardBg, iconBg, valColor }) => (
                      <div
                        key={key}
                        className={`group rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${cardBg}`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${iconBg}`}
                          >
                            <Icon size={20} />
                          </div>
                        </div>
                        <dd className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight leading-none mb-1.5 ${valColor}`}>
                          {Number(p[key] || 0).toLocaleString("id-ID")}
                        </dd>
                        <dt className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug">{label}</dt>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>

          {/* Pencarian Relawan Lintas Program lewat NIM (Admin Pusat — Bagian 6) */}
          {isAdmin && (
            <section className="card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pencarian Relawan Lintas Program (NIM)</h3>
                  <p className="text-xs text-slate-500">Cek keanggotaan Tax Clinic & Renjani serta riwayat tahun seorang relawan berdasarkan NIM.</p>
                </div>
                <form onSubmit={searchNim} className="flex w-full gap-2 sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="Ketik NIM relawan..."
                      value={nimQuery}
                      onChange={(e) => setNimQuery(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn" disabled={searching}>
                    {searching ? "Mencari..." : "Cari"}
                  </button>
                </form>
              </div>
              {nimResults.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {nimResults.map((u) => (
                    <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                      <div>
                        <div className="font-bold text-slate-900">
                          {u.name} <span className="font-mono text-xs font-normal text-slate-500">({u.nim})</span>
                        </div>
                        <div className="text-xs text-slate-500">{u.prodi || "-"} • Peran: {u.role}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {u.memberships.map((m, idx) => (
                          <span
                            key={idx}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                              m.active ? "bg-brand-50 text-brand ring-brand/20" : "bg-slate-100 text-slate-500 ring-slate-200"
                            }`}
                          >
                            {m.program_name} {m.year} {!m.active && "(Nonaktif)"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
