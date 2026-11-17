import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { id } from "date-fns/locale/id";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileWarning,
  Info,
  RefreshCw,
} from "lucide-react";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";

export default function RelawanHome() {
  const [data, setData] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const user = getUser();
  const todayLabel = format(new Date(), "EEEE, dd MMMM yyyy", { locale: id });

  useEffect(() => {
    request("get", API_ENDPOINTS.RELAWAN_HOME).then((r) => setData(r?.data || null));
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      </div>
    );
  }

  const c = data.counts || {};
  const stats = [
    { label: "Belum Diisi", val: c.belum_diisi || 0, icon: FileWarning, bg: "bg-slate-100 text-slate-700", valCls: "text-slate-900" },
    { label: "Menunggu Verifikasi", val: c.menunggu || 0, icon: Clock, bg: "bg-amber-500/15 text-amber-700", valCls: "text-amber-900" },
    { label: "Perlu Revisi", val: c.perlu_revisi || 0, icon: AlertCircle, bg: "bg-sky-500/15 text-sky-700", valCls: "text-sky-900" },
    { label: "Disetujui", val: c.disetujui || 0, icon: CheckCircle2, bg: "bg-emerald-500/15 text-emerald-700", valCls: "text-emerald-900" },
  ];

  const revisions = data.notifications?.revisions || [];
  const subNotices = data.notifications?.substitutions || [];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0E5A7C] via-[#126C94] to-[#0A4259] p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-sky-100">
              <ClipboardCheck size={14} />
              Dashboard Relawan {user?.programName || ""}
            </span>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Halo, {user?.name}</h1>
            <p className="mt-1 text-sm text-sky-100/85">
              Total WP dilayani tahun ini: <strong className="text-accent">{c.total_wp || 0} WP</strong> dari{" "}
              <strong>{c.total_presensi || 0}</strong> sesi presensi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-accent-dark"
            >
              <Info size={17} />
              Info & Aturan
            </button>
            <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-medium">
              <CalendarDays size={18} className="text-accent" />
              <span className="capitalize">{todayLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Laporan Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, val, icon: Icon, bg, valCls }) => (
          <div key={label} className="card flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${bg}`}>
              <Icon size={22} />
            </div>
            <div>
              <div className={`text-2xl font-extrabold tabular-nums ${valCls}`}>{val}</div>
              <div className="text-xs font-semibold text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Notifikasi Revisi & Pergantian */}
      {(revisions.length > 0 || subNotices.length > 0) && (
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell size={18} className="text-accent-dark" />
            <h2 className="text-base font-bold text-slate-900">Pemberitahuan Penting</h2>
          </div>
          <div className="space-y-2.5">
            {revisions.map((r) => (
              <div key={`rev-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm">
                <div>
                  <span className="font-bold text-sky-900">Revisi diminta ({r.date}):</span>{" "}
                  <span className="text-sky-800">{r.verify_reason || "Silakan perbaiki laporan Anda"}</span>
                </div>
                <Link to="/presensi" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                  Perbaiki <ArrowRight size={14} />
                </Link>
              </div>
            ))}
            {subNotices.map((n) => (
              <div key={`sub-${n.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-800">Pergantian jadwal {n.date}:</span>{" "}
                  <StatusBadge s={n.status} note={n.review_reason} />
                  {n.review_reason && <span className="ml-2 text-xs text-slate-500">({n.review_reason})</span>}
                </div>
                <Link to="/pergantian" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                  Lihat <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jadwal Hari Ini & Mendatang */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand">
                <CalendarDays size={19} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Jadwal Hari Ini</h2>
            </div>
            <Link to="/presensi" className="text-xs font-bold text-brand hover:underline">
              Ke Presensi →
            </Link>
          </div>
          {data.todaySessions?.length ? (
            <div className="space-y-2.5">
              {data.todaySessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div>
                    <div className="font-bold text-slate-900">{s.title || `Sesi ${s.session_no}`}</div>
                    <div className="text-xs text-slate-500">
                      Sesi {s.session_no} • {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </div>
                  </div>
                  {s.attendance_id ? (
                    <StatusBadge s={s.attendance_status || "menunggu"} />
                  ) : (
                    <Link to="/presensi" className="btn !px-3 !py-1.5 text-xs">
                      Presensi
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">Tidak ada jadwal jaga hari ini.</p>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <FileCheck2 size={19} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Jadwal Mendatang</h2>
            </div>
            <Link to="/pergantian" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
              <RefreshCw size={13} /> Ajukan Pergantian
            </Link>
          </div>
          {data.upcomingSessions?.length ? (
            <div className="space-y-2.5">
              {data.upcomingSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div>
                    <div className="font-bold text-slate-900">{s.title || `Sesi ${s.session_no}`}</div>
                    <div className="text-xs text-slate-500">
                      {s.date} • Sesi {s.session_no} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                    </div>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">Terjadwal</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">Belum ada jadwal mendatang.</p>
          )}
        </section>
      </div>

      {/* Quick link Pusat Materi */}
      <div className="card flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand-50 to-white p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="font-bold text-slate-900">Pusat Materi, SOP & Kriteria Penilaian</div>
            <div className="text-xs text-slate-500">Buka Guidebook, SOP, materi pelatihan, dan rumus Relawan of the Month program Anda.</div>
          </div>
        </div>
        <Link to="/materi" className="btn">
          Buka Pusat Materi <ArrowRight size={16} />
        </Link>
      </div>

      <Modal
        open={infoOpen}
        title="Informasi & Aturan Relawan"
        subtitle={`Program ${user?.programName || ""}`}
        onClose={() => setInfoOpen(false)}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <div className="mb-1.5 flex items-center gap-2 font-bold text-amber-800">
              <Info size={18} />
              Aturan Konfirmasi Lupa Presensi
            </div>
            <p className="leading-relaxed">
              Apabila lupa melakukan presensi, relawan wajib konfirmasi ke pengurus paling lambat{" "}
              <strong>1 × 24 jam</strong> setelah jadwal berakhir disertai bukti. Jika tidak, kehadiran dianggap tidak
              tercatat dan tidak dihitung dalam penilaian bulanan.
            </p>
          </div>
          {data.settings && (
            <div className="rounded-2xl border border-brand/20 bg-brand-50/60 p-4 text-sm text-slate-700 space-y-1.5">
              <div className="font-bold text-brand">Ringkasan Penilaian Relawan of the Month</div>
              <p><strong>A. Pelayanan (maks {data.settings.weight_service}):</strong> (Rata WP/shift ÷ {data.settings.target_wp}) × {data.settings.weight_service}.</p>
              <p><strong>B. Kehadiran (maks {data.settings.weight_attendance}):</strong> Tepat waktu/≤{data.settings.late_limit_min} mnt ({data.settings.scores?.ontime}), 11–20 mnt ({data.settings.scores?.late11_20}), 21–30 mnt ({data.settings.scores?.late21_30}), &gt;30 mnt ({data.settings.scores?.late30plus}).</p>
              <p><strong>C. Bonus Poin:</strong> Pengganti (+{data.settings.bonus?.pengganti}), Bantu (+{data.settings.bonus?.bantu_kegiatan}), Konten (+{data.settings.bonus?.konten}), Masukan (+{data.settings.bonus?.masukan}).</p>
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn" onClick={() => setInfoOpen(false)}>Mengerti</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
