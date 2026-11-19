import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Info,
  ListPlus,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import CameraCaptureModal from "@/components/CameraCaptureModal";
import EvidencePreviewModal from "@/components/EvidencePreviewModal";
import usePaginated from "@/hooks/usePaginated";
import { downloadFile, request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const getGps = () =>
  new Promise((ok) =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { timeout: 8000 })
      : ok(null)
  );

const EVIDENCE_LABELS = { photo: "Foto Masuk", excel: "Excel", bpe: "BPE", report: "Laporan", renjani: "RENJANI" };

export default function Presensi() {
  const user = getUser();
  const isRenjaniProgram = user.programId === 2 || (user.programName || "").toLowerCase().includes("renjani");

  const schedules = usePaginated(API_ENDPOINTS.JADWAL.LIST);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [camSession, setCamSession] = useState(null);
  const [fin, setFin] = useState(null);
  const [renjaniFile, setRenjaniFile] = useState(null);

  // Modal Tambah Aktivitas
  const [activityModal, setActivityModal] = useState(null);
  const [activityForm, setActivityForm] = useState({
    activityName: "",
    wpCount: 1,
    wpName: "",
    wpNpwp: "",
    serviceType: "Konsultasi Coretax",
    notes: "",
  });
  const [activitiesList, setActivitiesList] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Evidence Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    request("get", API_ENDPOINTS.SETTINGS).then((r) => setSettings(r?.data?.settings || null));
  }, []);

  const reqEv = settings?.required_evidence || [];
  const wpRequired = settings ? !!settings.wp_required : true;

  // Cek reminder jadwal hari ini yang belum dipresensi
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUnfinished = (schedules.data || []).filter(
    (s) => s.date === todayStr && (!s.attendance_id || !s.end_at)
  );

  const submitStart = async (compressedPhoto) => {
    if (!camSession || !compressedPhoto) return;
    setBusy(true);
    const gps = await getGps();
    const fd = new FormData();
    fd.append("sessionId", camSession.id);
    fd.append("photo", compressedPhoto);
    if (gps) {
      fd.append("lat", gps.latitude);
      fd.append("lng", gps.longitude);
    }
    const r = await request("post", API_ENDPOINTS.PRESENSI.START, fd, { success: true });
    setBusy(false);
    if (r) {
      setCamSession(null);
      schedules.reload();
    }
  };

  const handleOpenFinishModal = (row) => {
    setFin(row);
    setRenjaniFile(null);
  };

  const submitFinish = async (e) => {
    e.preventDefault();
    if (isRenjaniProgram && !renjaniFile && !fin.has_renjani) {
      return toast.error("Khusus relawan RENJANI, wajib mengunggah screenshot bukti pelaporan web RENJANI");
    }

    setBusy(true);
    const fd = new FormData(e.target);
    if (renjaniFile) {
      fd.append("renjani", renjaniFile);
    }
    const r = await request("post", API_ENDPOINTS.PRESENSI.FINISH(fin.attendance_id || fin.id), fd, { success: true });
    setBusy(false);
    if (r) {
      setFin(null);
      setRenjaniFile(null);
      schedules.reload();
    }
  };

  // Aktivitas Sesi
  const openActivitiesModal = async (row) => {
    setActivityModal(row);
    setLoadingActivities(true);
    const r = await request("get", API_ENDPOINTS.PRESENSI.ACTIVITIES(row.attendance_id));
    setLoadingActivities(false);
    if (r?.data) setActivitiesList(r.data);
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!activityForm.activityName.trim()) return toast.error("Nama aktivitas wajib diisi");
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.PRESENSI.ACTIVITIES(activityModal.attendance_id), activityForm, { success: true });
    setBusy(false);
    if (r) {
      setActivityForm({ activityName: "", wpCount: 1, wpName: "", wpNpwp: "", serviceType: "Konsultasi Coretax", notes: "" });
      const refreshed = await request("get", API_ENDPOINTS.PRESENSI.ACTIVITIES(activityModal.attendance_id));
      if (refreshed?.data) setActivitiesList(refreshed.data);
      schedules.reload();
    }
  };

  const handleDeleteActivity = async (actId) => {
    if (!window.confirm("Hapus aktivitas ini?")) return;
    setBusy(true);
    const r = await request("delete", API_ENDPOINTS.PRESENSI.DELETE_ACTIVITY(actId), null, { success: true });
    setBusy(false);
    if (r) {
      const refreshed = await request("get", API_ENDPOINTS.PRESENSI.ACTIVITIES(activityModal.attendance_id));
      if (refreshed?.data) setActivitiesList(refreshed.data);
      schedules.reload();
    }
  };

  const handleOpenEvidence = (attId, field, label) => {
    setPreviewDoc({
      url: API_ENDPOINTS.PRESENSI.EVIDENCE(attId, field),
      field: label || EVIDENCE_LABELS[field] || field,
      title: `Bukti ${label || EVIDENCE_LABELS[field] || field}`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Presensi Saya (Terintegrasi)"
        subtitle="Presensi Masuk dan Presensi Keluar ditampilkan dalam satu kesatuan per jadwal sesi jaga."
      />

      {/* Reminder Banner Jadwal Hari Ini */}
      {todayUnfinished.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/60 to-yellow-50 p-5 shadow-sm text-amber-900">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-amber-950">
                Pemberitahuan Jadwal Jaga Hari Ini ({todayStr})
              </h3>
              <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                Anda memiliki <strong>{todayUnfinished.length} jadwal sesi jaga hari ini</strong> yang belum lengkap presensinya.
                Pastikan melakukan presensi masuk sebelum jam mulai sesi, dan presensi selesai maksimal 24 jam setelah sesi berakhir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {todayUnfinished.map((s) => (
              !s.attendance_id ? (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCamSession(s)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
                >
                  <Camera size={15} /> Presensi Masuk (Sesi {s.session_no})
                </button>
              ) : !s.end_at ? (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleOpenFinishModal(s)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                >
                  <Send size={15} /> Presensi Keluar (Sesi {s.session_no})
                </button>
              ) : null
            ))}
          </div>
        </div>
      )}

      {/* Special RENJANI Guidance Box */}
      {isRenjaniProgram && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-xs text-sky-900 flex items-start gap-3">
          <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sky-950">Ketentuan Khusus Relawan RENJANI:</div>
            <p className="leading-relaxed">
              Saat melakukan <strong>Presensi Selesai</strong>, Anda <strong>wajib melampirkan screenshot bukti pelaporan aktivitas pada website resmi RENJANI</strong>.
              Tombol presensi selesai akan terkunci jika screenshot belum diunggah. Batas waktu pelaporan maksimal 24 jam setelah sesi jaga berakhir.
            </p>
          </div>
        </div>
      )}

      {/* Tabel Jadwal & Presensi Terpadu */}
      <DataTable
        t={schedules}
        searchPlaceholder="Cari tanggal, sesi, atau judul jadwal..."
        empty="Belum ada jadwal jaga yang ditugaskan kepada Anda."
        columns={[
          {
            label: "Jadwal & Sesi",
            render: (r) => (
              <div className="space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>{r.date}</span>
                  {r.date === todayStr && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 animate-pulse">
                      Hari Ini
                    </span>
                  )}
                </div>
                <div className="inline-flex items-center gap-1.5 text-slate-700">
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand">
                    Sesi {r.session_no}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)} WIB)
                  </span>
                </div>
                <div className="text-xs text-slate-600">{r.title || "Pendampingan Wajib Pajak"}</div>
                {r.surat_tugas_no && (
                  <div className="text-[11px] text-slate-400">ST: {r.surat_tugas_no}</div>
                )}
              </div>
            ),
          },
          {
            label: "1. Presensi Masuk (Mulai)",
            render: (r) => {
              if (!r.attendance_id) {
                return (
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      <Clock size={12} /> Belum Presensi Masuk
                    </span>
                    <div>
                      <button
                        type="button"
                        className="btn !rounded-xl !px-3 !py-1.5 text-xs !bg-brand hover:!bg-brand-dark shadow-sm"
                        onClick={() => setCamSession(r)}
                      >
                        <Camera size={14} /> Presensi Masuk
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400">Sesuai jam mulai sesi jaga</div>
                  </div>
                );
              }

              const isLate = (r.late_minutes ?? 0) > 0;
              return (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Sudah Masuk ({r.start_at ? String(r.start_at).slice(11, 16) : "-"} WIB)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        isLate ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isLate ? `Terlambat ${r.late_minutes} mnt` : "Tepat Waktu"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                        r.gps_valid ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <MapPin size={10} />
                      {r.gps_valid ? "GPS Valid" : "Tanpa GPS"}
                    </span>
                  </div>
                  {r.has_photo && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline pt-0.5"
                      onClick={() => handleOpenEvidence(r.attendance_id, "photo", "Foto Presensi Masuk")}
                    >
                      <Eye size={11} /> Lihat Foto Masuk
                    </button>
                  )}
                </div>
              );
            },
          },
          {
            label: "2. Presensi Keluar & Laporan",
            render: (r) => {
              if (!r.attendance_id) {
                return (
                  <div className="inline-flex items-center gap-1 text-xs text-slate-400 italic">
                    <Lock size={12} /> Lakukan presensi masuk dulu
                  </div>
                );
              }

              if (!r.end_at) {
                const sessionDate = r.date;
                const sessionEndTime = r.end_time ? String(r.end_time).slice(0, 8) : "17:00:00";
                const sessionEndMs = new Date(`${sessionDate}T${sessionEndTime}`).getTime();
                const isOver24h = !isNaN(sessionEndMs) && Date.now() - sessionEndMs > 24 * 60 * 60 * 1000;

                return (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                        <Clock size={12} /> Belum Presensi Selesai
                      </span>
                      {r.allow_late_finish ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <Unlock size={11} /> Izin Khusus 24 Jam Aktif
                        </span>
                      ) : isOver24h ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                          <Lock size={11} /> Terkunci (&gt;24 Jam)
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={isOver24h && !r.allow_late_finish}
                        className={`btn !rounded-xl !px-3 !py-1.5 text-xs shadow-sm ${
                          isOver24h && !r.allow_late_finish
                            ? "!bg-slate-200 !text-slate-400 cursor-not-allowed"
                            : "!bg-emerald-600 hover:!bg-emerald-700"
                        }`}
                        onClick={() => handleOpenFinishModal(r)}
                      >
                        <Send size={13} /> Presensi Keluar & Laporan
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isOver24h && !r.allow_late_finish
                        ? "Batas waktu 24 jam lewat. Hubungi admin untuk buka kunci."
                        : "Maks. 24 jam setelah sesi selesai"}
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <StatusBadge s={r.attendance_status} note={r.verify_reason} />
                    <span className="text-slate-500 font-medium">
                      ({r.end_at ? String(r.end_at).slice(11, 16) : "-"} WIB)
                    </span>
                  </div>
                  <div className="text-slate-700 font-semibold">
                    WP Dilayani: <span className="text-brand font-bold">{r.wp_count ?? 0} Orang</span>
                  </div>

                  {/* Bukti Uploaded */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {r.has_excel ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-brand hover:text-white"
                        onClick={() => handleOpenEvidence(r.attendance_id, "excel", "Excel Pendampingan")}
                      >
                        <Eye size={10} /> Excel
                      </button>
                    ) : null}
                    {r.has_bpe ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-brand hover:text-white"
                        onClick={() => handleOpenEvidence(r.attendance_id, "bpe", "Bukti BPE")}
                      >
                        <Eye size={10} /> BPE
                      </button>
                    ) : null}
                    {r.has_report ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-brand hover:text-white"
                        onClick={() => handleOpenEvidence(r.attendance_id, "report", "Bukti Laporan")}
                      >
                        <Eye size={10} /> Laporan
                      </button>
                    ) : null}
                    {r.has_renjani ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-600 hover:text-white"
                        onClick={() => handleOpenEvidence(r.attendance_id, "renjani", "Screenshot RENJANI")}
                      >
                        <Eye size={10} /> RENJANI
                      </button>
                    ) : null}
                  </div>

                  {r.attendance_status === "revisi" && (
                    <button
                      type="button"
                      className="btn-ghost !rounded-lg !px-2.5 !py-1 text-[11px] font-bold text-rose-700 !bg-rose-50"
                      onClick={() => handleOpenFinishModal(r)}
                    >
                      <RefreshCw size={11} /> Perbaiki Laporan
                    </button>
                  )}
                </div>
              );
            },
          },
          {
            label: "3. Aktivitas Sesi",
            render: (r) => {
              if (!r.attendance_id) {
                return <span className="text-slate-400 text-xs">-</span>;
              }
              const count = r.activities_count || 0;
              return (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700">
                    {count > 0 ? (
                      <span className="text-emerald-700 font-bold">{count} Aktivitas Dicatat</span>
                    ) : (
                      <span className="text-slate-400">Belum ada rincian</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-brand hover:text-white transition shadow-sm"
                    onClick={() => openActivitiesModal(r)}
                  >
                    <ListPlus size={13} />
                    {count > 0 ? "Kelola Aktivitas" : "Tambah Aktivitas"}
                  </button>
                </div>
              );
            },
          },
        ]}
      />

      {/* Modal Kamera Presensi Mulai */}
      <CameraCaptureModal
        open={!!camSession}
        session={camSession}
        busy={busy}
        onClose={() => setCamSession(null)}
        onConfirm={submitStart}
      />

      {/* Modal Presensi Selesai & Laporan */}
      <Modal
        open={!!fin}
        title={fin?.end_at ? "Perbaiki Laporan Presensi" : "Presensi Selesai & Kirim Laporan"}
        subtitle={fin ? `Tanggal ${fin.date} • Sesi ${fin.session_no} (${fin.start_time?.slice(0, 5)}–${fin.end_time?.slice(0, 5)} WIB)` : ""}
        onClose={() => setFin(null)}
        maxWidth="max-w-xl"
      >
        {fin && (
          <form onSubmit={submitFinish} className="space-y-4">
            {/* Reminder Dokumentasi */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed">
              <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-950">
                <AlertCircle size={15} /> Reminder Bukti Dokumentasi Kegiatan:
              </div>
              Pastikan Anda mengunggah bukti pendampingan Wajib Pajak yang sah. Batas waktu pengisian presensi selesai maksimal <strong>24 jam</strong> setelah sesi berakhir.
            </div>

            {/* Input Khusus RENJANI */}
            {isRenjaniProgram && (
              <div className="rounded-2xl border-2 border-brand/40 bg-brand-50/50 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck size={16} /> Screenshot Bukti Pelaporan Website RENJANI *
                  </label>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                    WAJIB
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Unggah tangkapan layar (screenshot) bukti bahwa Anda telah melaporkan aktivitas pendampingan pada portal resmi RENJANI.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRenjaniFile(e.target.files?.[0] || null)}
                  className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark"
                  required={!fin.has_renjani}
                />
                {fin.has_renjani && (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Screenshot RENJANI sudah terunggah sebelumnya. Unggah file baru bila ingin mengganti.
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="label">Total WP Dilayani Pada Sesi Ini {wpRequired ? "*" : "(opsional)"}</label>
              <input
                className="input"
                name="wpCount"
                type="number"
                min="0"
                defaultValue={fin.wp_count ?? ""}
                placeholder="Contoh: 3"
                required={wpRequired}
              />
            </div>

            {/* Bukti Lainnya */}
            {[
              ["excel", "File Excel Rekap Pelayanan WP", fin.has_excel],
              ["bpe", "Bukti Tanda Terima / BPE SPT", fin.has_bpe],
              ["report", "Bukti Foto / Laporan Tambahan", fin.has_report],
            ].map(([n, l, hasOld]) => {
              const isReq = reqEv.includes(n);
              return (
                <div key={n}>
                  <label className="label">
                    {l}{" "}
                    {isReq ? (
                      <span className="text-rose-600 font-bold">* Wajib</span>
                    ) : (
                      <span className="font-normal text-slate-400">(opsional)</span>
                    )}
                    {hasOld ? <span className="ml-2 text-emerald-600 font-semibold">(sudah terunggah)</span> : null}
                  </label>
                  <input
                    className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand/15"
                    type="file"
                    name={n}
                    required={isReq && !hasOld}
                  />
                </div>
              );
            })}

            <div>
              <label className="label">Catatan Kendala / Aktivitas Khusus (opsional)</label>
              <textarea
                className="input min-h-[80px]"
                name="notes"
                defaultValue={fin.notes || ""}
                placeholder="Tuliskan kendala teknis atau catatan penting..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" className="btn-ghost" onClick={() => setFin(null)}>Batal</button>
              <button
                type="submit"
                className="btn"
                disabled={busy || (isRenjaniProgram && !renjaniFile && !fin.has_renjani)}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {busy ? "Mengirim..." : "Kirim Presensi Selesai"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Kelola Aktivitas Sesi */}
      <Modal
        open={!!activityModal}
        title="Catat Aktivitas & WP Dilayani"
        subtitle={activityModal ? `Tanggal ${activityModal.date} • Sesi ${activityModal.session_no}` : ""}
        onClose={() => setActivityModal(null)}
        maxWidth="max-w-2xl"
      >
        {activityModal && (
          <div className="space-y-5">
            {/* Form Tambah Aktivitas */}
            <form onSubmit={handleAddActivity} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Plus size={16} className="text-brand" /> Tambah Aktivitas Baru
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Nama / Judul Kegiatan *</label>
                  <input
                    className="input"
                    placeholder="Contoh: Pendampingan Pelaporan SPT Tahunan Orang Pribadi"
                    value={activityForm.activityName}
                    onChange={(e) => setActivityForm({ ...activityForm, activityName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Jumlah WP Dilayani *</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={activityForm.wpCount}
                    onChange={(e) => setActivityForm({ ...activityForm, wpCount: parseInt(e.target.value || 1, 10) })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Jenis Layanan</label>
                  <select
                    className="input"
                    value={activityForm.serviceType}
                    onChange={(e) => setActivityForm({ ...activityForm, serviceType: e.target.value })}
                  >
                    <option value="Konsultasi Coretax">Konsultasi Coretax</option>
                    <option value="Pelaporan SPT 1770 S/SS">Pelaporan SPT 1770 S/SS</option>
                    <option value="Pelaporan SPT 1770">Pelaporan SPT 1770</option>
                    <option value="Pembuatan Kode Billing">Pembuatan Kode Billing</option>
                    <option value="Aktivasi / Lupa EFIN">Aktivasi / Lupa EFIN</option>
                    <option value="Pemadanan NIK-NPWP">Pemadanan NIK-NPWP</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="label">Nama WP (opsional)</label>
                  <input
                    className="input"
                    placeholder="Nama Wajib Pajak"
                    value={activityForm.wpName}
                    onChange={(e) => setActivityForm({ ...activityForm, wpName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">NPWP (opsional)</label>
                  <input
                    className="input"
                    placeholder="16 digit NIK / 15 digit NPWP"
                    value={activityForm.wpNpwp}
                    onChange={(e) => setActivityForm({ ...activityForm, wpNpwp: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Simpan Aktivitas
                </button>
              </div>
            </form>

            {/* Riwayat Aktivitas yang Dicatat */}
            <div>
              <div className="font-bold text-sm text-slate-800 mb-2">Riwayat Aktivitas Tercatat:</div>
              {loadingActivities ? (
                <div className="py-6 text-center text-slate-400 text-xs">Memuat aktivitas...</div>
              ) : activitiesList.length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white">
                  {activitiesList.map((act) => (
                    <div key={act.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-slate-900 text-sm">{act.activity_name}</div>
                        <div className="flex flex-wrap items-center gap-2 text-slate-600">
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-brand font-bold">
                            {act.wp_count} WP
                          </span>
                          <span>•</span>
                          <span>{act.service_type || "Umum"}</span>
                          {act.wp_name && (
                            <>
                              <span>•</span>
                              <span>WP: {act.wp_name}</span>
                            </>
                          )}
                          {act.wp_npwp && <span className="text-slate-400">({act.wp_npwp})</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost !p-1.5 text-rose-600 hover:!bg-rose-50"
                        title="Hapus aktivitas"
                        onClick={() => handleDeleteActivity(act.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  Belum ada aktivitas yang dicatat untuk sesi ini.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" className="btn" onClick={() => setActivityModal(null)}>
                Selesai
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pratinjau Dokumen / Bukti Modal (Safari-Safe) */}
      <EvidencePreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.url}
        fieldName={previewDoc?.field}
        title={previewDoc?.title}
      />
    </div>
  );
}
