import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { id } from "date-fns/locale/id";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileCheck2,
  FileWarning,
  Info,
  Megaphone,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";

export default function RelawanHome() {
  const [data, setData] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const user = getUser();
  const todayLabel = format(new Date(), "EEEE, dd MMMM yyyy", { locale: id });

  useEffect(() => {
    request("get", API_ENDPOINTS.RELAWAN_HOME).then((r) => {
      const d = r?.data || null;
      setData(d);

      // Auto pop-up logic
      if (d?.popupAnnouncement) {
        const seenKey = `taxora_popup_seen_${d.popupAnnouncement.id}`;
        if (!sessionStorage.getItem(seenKey)) {
          setPopupOpen(true);
        }
      }
    });
  }, []);

  const handleClosePopup = () => {
    if (data?.popupAnnouncement) {
      sessionStorage.setItem(`taxora_popup_seen_${data.popupAnnouncement.id}`, "1");
    }
    setPopupOpen(false);
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const c = data.counts || {};
  const stats = [
    { label: "Belum Selesai", val: c.belum_diisi || 0, icon: FileWarning, bg: "bg-slate-100 text-slate-700", valCls: "text-slate-900" },
    { label: "Menunggu Verifikasi", val: c.menunggu || 0, icon: Clock, bg: "bg-amber-500/15 text-amber-700", valCls: "text-amber-900" },
    { label: "Perlu Revisi", val: c.perlu_revisi || 0, icon: AlertCircle, bg: "bg-sky-500/15 text-sky-700", valCls: "text-sky-900" },
    { label: "Disetujui", val: c.disetujui || 0, icon: CheckCircle2, bg: "bg-emerald-500/15 text-emerald-700", valCls: "text-emerald-900" },
  ];

  const revisions = data.notifications?.revisions || [];
  const subNotices = data.notifications?.substitutions || [];
  const announcements = data.announcements || [];
  const todaySessions = data.todaySessions || [];
  const hasUnfinishedToday = todaySessions.some((s) => !s.attendance_id || !s.end_at);

  return (
    <div className="space-y-6">
      {/* Banner Utama dengan Tombol Presensi Menonjol */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0E5A7C] via-[#126C94] to-[#0A4259] p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute right-48 -bottom-10 h-44 w-44 rounded-full bg-amber-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold text-sky-100 backdrop-blur-sm">
              <ClipboardCheck size={14} className="text-amber-300" />
              Portal Relawan {user?.programName || ""}
            </span>
            <h1 className="text-2xl font-extrabold sm:text-3xl tracking-tight">Halo, {user?.name}</h1>
            <p className="text-sm text-sky-100/90 leading-relaxed">
              Total pelayanan Anda tahun ini: <strong className="text-amber-300 font-bold">{c.total_wp || 0} WP</strong> dari{" "}
              <strong>{c.total_presensi || 0}</strong> sesi presensi jaga.
            </p>
          </div>

          {/* Tombol Presensi Menonjol (High-Visibility CTA) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              to="/presensi"
              className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-amber-500/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl hover:from-amber-300 hover:to-amber-500 focus:outline-none ring-4 ring-white/25 active:scale-95"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/10 text-slate-950 group-hover:bg-slate-950/15">
                <Camera size={22} />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900/80">Menu Utama</div>
                <div className="text-lg font-black leading-tight text-slate-950">PRESENSI SAYA</div>
              </div>
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </Link>

            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <Info size={16} />
              Aturan & Poin
            </button>
          </div>
        </div>

        {/* Info Tanggal */}
        <div className="relative mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-100/75">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-amber-300" />
            <span className="capitalize font-medium">{todayLabel}</span>
          </div>
          {hasUnfinishedToday && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/80 px-3 py-1 font-bold text-white">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Ada Jadwal Hari Ini yang Belum Presensi Lengkap
            </span>
          )}
        </div>
      </div>

      {/* Reminder Banner Khusus Jadwal Hari Ini */}
      {hasUnfinishedToday && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-amber-300 bg-amber-50/90 p-5 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/25">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-amber-950">
                Reminder Presensi: Anda Memiliki Jadwal Hari Ini!
              </h2>
              <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                Jangan lupa lakukan <strong>Presensi Masuk</strong> via kamera langsung dan <strong>Presensi Selesai</strong> maksimal 24 jam setelah sesi berakhir.
              </p>
            </div>
          </div>
          <Link
            to="/presensi"
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
          >
            <Camera size={16} /> Buka Presensi Hari Ini
          </Link>
        </div>
      )}

      {/* Info Terbaru & Pengumuman Admin Feed */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Megaphone size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Info Terbaru & Pengumuman</h2>
            </div>
            <Link to="/pengumuman" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
              Lihat Semua Pengumuman <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {announcements.slice(0, 3).map((ann) => {
              const isRotm = ann.category === "rotm";
              return (
                <div
                  key={ann.id}
                  onClick={() => setSelectedAnnouncement(ann)}
                  className={`card p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border ${
                    isRotm ? "border-amber-200 bg-gradient-to-br from-amber-50/60 to-white" : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                        isRotm
                          ? "bg-amber-100 text-amber-800"
                          : ann.category === "urgent"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-brand-50 text-brand"
                      }`}
                    >
                      {isRotm ? "Relawan of the Month" : ann.category}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {ann.created_at ? String(ann.created_at).slice(0, 10) : ""}
                    </span>
                  </div>

                  {ann.cover_image && (
                    <div className="mb-3 h-28 w-full overflow-hidden rounded-xl bg-slate-100">
                      <img
                        src={API_ENDPOINTS.ANNOUNCEMENTS.COVER(ann.id)}
                        alt={ann.title}
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                    </div>
                  )}

                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">{ann.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{ann.content}</p>

                  {isRotm && ann.rotm_user_name && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100/70 p-2 text-xs font-bold text-amber-900">
                      <Trophy size={14} className="text-amber-600" />
                      <span>Pemenang: {ann.rotm_user_name} ({ann.rotm_period || "Bulan Ini"})</span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-brand">
                    Baca Selengkapnya <ArrowRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Status Laporan Cards (Divided 2 by 2 on mobile/tablet/laptop, 4 on wide screen) */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, val, icon: Icon, bg, valCls }) => (
          <div key={label} className="card flex items-center gap-4 p-4.5 sm:p-5 shadow-sm">
            <div className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl ${bg}`}>
              <Icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight leading-none mb-1.5 ${valCls}`}>
                {val}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-600 leading-snug break-words">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notifikasi Revisi & Pergantian */}
      {(revisions.length > 0 || subNotices.length > 0) && (
        <div className="card p-5 border-l-4 border-amber-500 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Bell size={18} className="text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Pemberitahuan & Perlu Tindakan</h2>
          </div>
          <div className="space-y-2">
            {revisions.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50/70 p-3 text-xs border border-amber-200/60">
                <div className="min-w-0">
                  <span className="font-bold text-amber-950">Laporan Tanggal {r.date}</span>: {r.verify_reason || "Perlu revisi data/bukti pendampingan."}
                </div>
                <Link to="/presensi" className="btn !rounded-lg !px-3 !py-1 text-xs !bg-amber-600 hover:!bg-amber-700">
                  Perbaiki Sekarang
                </Link>
              </div>
            ))}
            {subNotices.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  Pengajuan pergantian sesi tanggal <strong>{s.date}</strong> berstatus{" "}
                  <strong className={s.status === "disetujui" ? "text-emerald-700" : "text-rose-600"}>
                    {s.status}
                  </strong>
                  {s.review_reason ? ` (${s.review_reason})` : ""}.
                </div>
                <Link to="/pergantian" className="text-xs font-semibold text-brand hover:underline">
                  Detail
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dua Kolom: Jadwal Hari Ini & Jadwal Mendatang */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand">
                <CalendarDays size={19} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Jadwal Hari Ini</h2>
            </div>
            <Link to="/presensi" className="text-xs font-bold text-brand hover:underline">
              Buka Presensi
            </Link>
          </div>

          {todaySessions.length ? (
            <div className="space-y-3">
              {todaySessions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{s.title || `Sesi ${s.session_no}`}</span>
                    <span className="rounded-md bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
                      Sesi {s.session_no} ({s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} WIB)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                    <div>
                      {!s.attendance_id ? (
                        <span className="text-amber-800 font-semibold flex items-center gap-1">
                          <Clock size={12} /> Belum Presensi Masuk
                        </span>
                      ) : !s.end_at ? (
                        <span className="text-sky-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Sudah Masuk • Belum Presensi Selesai
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Presensi Lengkap
                        </span>
                      )}
                    </div>
                    <Link to="/presensi" className="btn !rounded-xl !px-3.5 !py-1 text-xs">
                      Presensi
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Tidak ada jadwal sesi jaga hari ini.</p>
          )}
        </section>

        <section className="card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <FileCheck2 size={19} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Jadwal Mendatang</h2>
            </div>
            <Link to="/pergantian" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
              <RefreshCw size={13} /> Ajukan / Tukar Sesi
            </Link>
          </div>

          {data.upcomingSessions?.length ? (
            <div className="space-y-2.5">
              {data.upcomingSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{s.title || `Sesi ${s.session_no}`}</div>
                    <div className="text-slate-500 mt-0.5">
                      {s.date} • Sesi {s.session_no} ({s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} WIB)
                    </div>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">Terjadwal</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Belum ada jadwal sesi mendatang.</p>
          )}
        </section>
      </div>

      {/* Quick link Pusat Materi */}
      <div className="card flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand-50 via-sky-50/40 to-white p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-brand/20">
            <BookOpen size={22} />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base">Pusat Materi, SOP & Panduan Poin</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Akses materi pelatihan ber-cover, modul CoreTax, SOP asistensi, dan guidebook penilaian poin Relawan of the Month.
            </div>
          </div>
        </div>
        <Link to="/materi" className="btn shadow-sm">
          Buka Pusat Materi <ArrowRight size={16} />
        </Link>
      </div>

      {/* Modal Otomatis Pop-Up Pengumuman Penting (Muncul Pertama Kali Buka Portal) */}
      <Modal
        open={popupOpen}
        title="Pengumuman Penting"
        subtitle={data?.popupAnnouncement?.title || "Informasi Terbaru dari Pengurus"}
        onClose={handleClosePopup}
        maxWidth="max-w-lg"
      >
        {data?.popupAnnouncement && (
          <div className="space-y-4">
            {data.popupAnnouncement.cover_image && (
              <div className="h-44 w-full overflow-hidden rounded-2xl bg-slate-100">
                <img
                  src={API_ENDPOINTS.ANNOUNCEMENTS.COVER(data.popupAnnouncement.id)}
                  alt={data.popupAnnouncement.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {data.popupAnnouncement.content}
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" className="btn" onClick={handleClosePopup}>
                Saya Mengerti
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Detail Pengumuman Feed */}
      <Modal
        open={!!selectedAnnouncement}
        title={selectedAnnouncement?.title || "Detail Pengumuman"}
        subtitle={`Dipublikasikan pada ${selectedAnnouncement?.created_at ? String(selectedAnnouncement.created_at).slice(0, 10) : ""}`}
        onClose={() => setSelectedAnnouncement(null)}
        maxWidth="max-w-xl"
      >
        {selectedAnnouncement && (
          <div className="space-y-4">
            {selectedAnnouncement.cover_image && (
              <div className="max-h-64 w-full overflow-hidden rounded-2xl bg-slate-100">
                <img
                  src={API_ENDPOINTS.ANNOUNCEMENTS.COVER(selectedAnnouncement.id)}
                  alt={selectedAnnouncement.title}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            {selectedAnnouncement.category === "rotm" && selectedAnnouncement.rotm_user_name && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 flex items-center gap-2">
                <Trophy size={18} className="text-amber-600" />
                <span>Pemenang Relawan of the Month: {selectedAnnouncement.rotm_user_name} ({selectedAnnouncement.rotm_period || "Bulan Ini"})</span>
              </div>
            )}
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {selectedAnnouncement.content}
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" className="btn" onClick={() => setSelectedAnnouncement(null)}>
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Info & Aturan Penilaian */}
      <Modal
        open={infoOpen}
        title="Informasi, Aturan & Panduan Poin"
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
            <p className="leading-relaxed text-xs">
              Apabila lupa melakukan presensi, relawan wajib konfirmasi ke pengurus paling lambat{" "}
              <strong>1 × 24 jam</strong> setelah jadwal berakhir disertai bukti. Jika tidak, kehadiran dianggap tidak
              tercatat dan tidak dihitung dalam penilaian bulanan.
            </p>
          </div>
          {data.settings && (
            <div className="rounded-2xl border border-brand/20 bg-brand-50/60 p-4 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-brand text-sm">Rumus Penilaian Relawan of the Month</div>
              <p><strong>A. Pelayanan (bobot {data.settings.weight_service}%):</strong> (Rata WP/shift ÷ {data.settings.target_wp}) × {data.settings.weight_service}.</p>
              <p><strong>B. Kehadiran (bobot {data.settings.weight_attendance}%):</strong> Tepat waktu/≤{data.settings.late_limit_min} mnt ({data.settings.scores?.ontime}), 11–20 mnt ({data.settings.scores?.late11_20}), 21–30 mnt ({data.settings.scores?.late21_30}), &gt;30 mnt ({data.settings.scores?.late30plus}).</p>
              <p><strong>C. Bonus Poin:</strong> Pengganti (+{data.settings.bonus?.pengganti}), Bantu Kegiatan (+{data.settings.bonus?.bantu_kegiatan}), Konten (+{data.settings.bonus?.konten}), Masukan (+{data.settings.bonus?.masukan}).</p>
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
