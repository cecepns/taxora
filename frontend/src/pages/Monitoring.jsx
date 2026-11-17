import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileWarning,
  Info,
  Link2,
  Loader2,
  MapPin,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import AppSelect from "@/components/AppSelect";
import AppDatePicker from "@/components/AppDatePicker";
import usePaginated from "@/hooks/usePaginated";
import { downloadFile, fetchBlobUrl, openEvidence, request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const PROGRAM_OPTIONS = [
  { value: "", label: "Semua Program" },
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const MONTHS = [
  { value: "", label: "Semua Bulan" },
  ...["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map(
    (label, idx) => ({ value: String(idx + 1), label })
  ),
];

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "menunggu", label: "Menunggu" },
  { value: "disetujui", label: "Disetujui" },
  { value: "revisi", label: "Revisi" },
  { value: "ditolak", label: "Ditolak" },
];

const EVIDENCE_LABELS = { photo: "Foto", excel: "Excel", bpe: "BPE", report: "Laporan" };

export default function Monitoring() {
  const user = getUser();
  const isAdmin = user.role === "admin";
  const canCorrect = ["pengurus", "admin"].includes(user.role);
  const curYear = new Date().getFullYear();
  const YEAR_OPTIONS = [curYear + 1, curYear, curYear - 1, curYear - 2].map((y) => ({ value: String(y), label: String(y) }));

  const [year, setYear] = useState(String(curYear));
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [pid, setPid] = useState("");
  const [summary, setSummary] = useState(null);

  const [reasonModal, setReasonModal] = useState(null);
  const [reason, setReason] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [detailModal, setDetailModal] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [loadingEv, setLoadingEv] = useState("");
  const [shareLink, setShareLink] = useState(null);
  const [correctForm, setCorrectForm] = useState({ lateMinutes: "", wpCount: "", gpsValid: true, notes: "", reason: "" });
  const [busy, setBusy] = useState(false);

  const t = usePaginated(API_ENDPOINTS.PRESENSI.LIST, { year, month, status, date, programId: pid });

  const loadSummary = () => {
    request("get", API_ENDPOINTS.PRESENSI.MONITORING_SUMMARY, { year, month, date, programId: pid }).then((r) =>
      setSummary(r?.data || null)
    );
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, date, pid]);

  const openDetail = async (row) => {
    setShareLink(null);
    setPhotoPreview(null);
    const r = await request("get", API_ENDPOINTS.PRESENSI.DETAIL(row.id));
    if (!r?.data) return;
    setDetailModal(r.data);
    setCorrectForm({
      lateMinutes: r.data.late_minutes ?? 0,
      wpCount: r.data.wp_count ?? 0,
      gpsValid: !!r.data.gps_valid,
      notes: r.data.notes || "",
      reason: "",
    });
    if (r.data.photo) {
      setPhotoLoading(true);
      const blob = await fetchBlobUrl(API_ENDPOINTS.PRESENSI.EVIDENCE(row.id, "photo"));
      if (blob) setPhotoPreview(blob.url);
      setPhotoLoading(false);
    }
  };

  const submitVerify = async (id, action, note = "") => {
    setBusy(true);
    const r = await request("put", API_ENDPOINTS.PRESENSI.VERIFY(id), { action, reason: note }, { success: true });
    setBusy(false);
    if (r) {
      toast.success("Status verifikasi tersimpan");
      setReasonModal(null);
      setReason("");
      t.reload();
    }
  };

  const submitCorrection = async (e) => {
    e.preventDefault();
    if (!correctForm.reason.trim()) return toast.error("Alasan koreksi wajib diisi");
    setBusy(true);
    const r = await request("put", API_ENDPOINTS.PRESENSI.CORRECT(detailModal.id), correctForm, { success: true });
    setBusy(false);
    if (r) {
      t.reload();
      openDetail(detailModal);
    }
  };

  const createShareLink = async (id, field) => {
    const r = await request("post", API_ENDPOINTS.PRESENSI.SHARE_EVIDENCE(id, field), { days: 30 });
    if (r?.data?.url) {
      setShareLink({ field, url: r.data.url });
      navigator.clipboard?.writeText(r.data.url);
      toast.success("Tautan 30 hari dibuat & disalin ke clipboard");
    }
  };

  const handleVerify = (row, action) => {
    if (action === "setujui") return submitVerify(row.id, "setujui", "");
    setReason("");
    setReasonModal({ id: row.id, name: row.name, action });
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!deleteModal) return;
    if (!deleteReason.trim()) return toast.error("Alasan penghapusan wajib diisi");
    setBusy(true);
    const r = await request(
      "delete",
      API_ENDPOINTS.PRESENSI.DELETE(deleteModal.id),
      { reason: deleteReason.trim() },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setDeleteModal(null);
      setDeleteReason("");
      t.reload();
      loadSummary();
    }
  };

  const handleOpenEvidence = async (id, field) => {
    const key = `${id}-${field}`;
    setLoadingEv(key);
    await openEvidence(API_ENDPOINTS.PRESENSI.EVIDENCE(id, field));
    setLoadingEv("");
  };

  const ev = (r, f, ok) =>
    ok ? (
      <button
        type="button"
        key={f}
        disabled={loadingEv === `${r.id}-${f}`}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white disabled:opacity-60"
        onClick={() => handleOpenEvidence(r.id, f)}
      >
        {loadingEv === `${r.id}-${f}` ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
        {EVIDENCE_LABELS[f]}
      </button>
    ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardCheck}
        title="Monitoring Presensi"
        subtitle="Pantau kehadiran, lokasi GPS, pratinjau bukti, koreksi tercatat, dan verifikasi laporan relawan."
      />

      {/* Ringkasan Monitoring Lengkap (Bagian 5.1) */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ["Hadir", summary.hadir, "bg-emerald-50 text-emerald-800"],
            ["Tidak Hadir", summary.tidak_hadir, "bg-rose-50 text-rose-800"],
            ["Digantikan", summary.diganti, "bg-sky-50 text-sky-800"],
            ["Terlambat", summary.terlambat, "bg-amber-50 text-amber-800"],
            ["Belum Lengkap", summary.belum_lengkap, "bg-orange-50 text-orange-800"],
            ["Menunggu", summary.menunggu, "bg-purple-50 text-purple-800"],
            ["Total WP", summary.total_wp, "bg-brand-50 text-brand"],
          ].map(([label, val, cls]) => (
            <div key={label} className={`rounded-2xl border border-slate-200/70 p-3.5 ${cls}`}>
              <div className="text-xl font-extrabold tabular-nums">{val ?? 0}</div>
              <div className="text-[11px] font-semibold opacity-80">{label}</div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        t={t}
        searchPlaceholder="Cari nama, NIM, atau kegiatan..."
        toolbar={
          <>
            {isAdmin && (
              <div className="w-full md:w-44">
                <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={pid} onChange={setPid} />
              </div>
            )}
            <div className="w-full md:w-28">
              <AppSelect size="sm" isSearchable={false} options={YEAR_OPTIONS} value={year} onChange={setYear} />
            </div>
            <div className="w-full md:w-40">
              <AppSelect size="sm" isSearchable={false} options={MONTHS} value={month} onChange={setMonth} />
            </div>
            <div className="w-full md:w-44">
              <AppDatePicker value={date} onChange={setDate} placeholder="Filter tanggal" isClearable />
            </div>
            <div className="w-full md:w-40">
              <AppSelect size="sm" isSearchable={false} options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </div>
          </>
        }
        columns={[
          {
            label: "Relawan",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">{r.nim}</div>
              </div>
            ),
          },
          {
            label: "Tanggal",
            render: (r) => (
              <div>
                <div className="font-medium text-slate-800">{r.date}</div>
                <div className="text-[11px] text-slate-400">Sesi {r.session_no}</div>
              </div>
            ),
          },
          {
            label: "Terlambat",
            render: (r) => (
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                  r.late_minutes > 10
                    ? "bg-rose-50 text-rose-700"
                    : r.late_minutes > 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <Clock size={12} />
                {r.late_minutes > 0 ? `${r.late_minutes} mnt` : "Tepat"}
              </span>
            ),
          },
          {
            label: "GPS",
            tdClassName: "whitespace-nowrap",
            render: (r) =>
              r.gps_valid && r.lat != null && r.lng != null ? (
                <a
                  href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Buka lokasi di Google Maps (${r.lat}, ${r.lng})`}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80 transition hover:bg-emerald-600 hover:text-white"
                >
                  <MapPin size={12} />
                  Valid
                  <ExternalLink size={11} />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  <MapPin size={12} />
                  Tdk tervalidasi
                </span>
              ),
          },
          { label: "WP", render: (r) => <span className="font-semibold">{r.wp_count ?? "-"}</span> },
          {
            label: "Bukti",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {ev(r, "photo", true)}
                {ev(r, "excel", r.has_excel)}
                {ev(r, "bpe", r.has_bpe)}
                {ev(r, "report", r.has_report)}
              </div>
            ),
          },
          { label: "Status", render: (r) => <StatusBadge s={r.status} note={r.verify_reason} /> },
          {
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Detail, pratinjau & koreksi"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-brand hover:text-white"
                  onClick={() => openDetail(r)}
                >
                  <Info size={15} />
                </button>
                <button
                  type="button"
                  title="Setujui"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => handleVerify(r, "setujui")}
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  title="Minta revisi"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-600 hover:text-white"
                  onClick={() => handleVerify(r, "revisi")}
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  title="Tolak"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-600 hover:text-white"
                  onClick={() => handleVerify(r, "tolak")}
                >
                  <X size={15} />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    title="Hapus presensi"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      setDeleteReason("");
                      setDeleteModal(r);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Modal Detail, Pratinjau Bukti, Share Link 30 Hari & Koreksi */}
      <Modal
        open={!!detailModal}
        title="Detail Presensi & Pratinjau Bukti"
        subtitle={detailModal ? `${detailModal.name} (${detailModal.nim}) • ${detailModal.date} Sesi ${detailModal.session_no}` : ""}
        onClose={() => setDetailModal(null)}
        maxWidth="max-w-2xl"
      >
        {detailModal && (
          <div className="space-y-5">
            {/* Pratinjau Foto & Unduhan Bukti */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {photoLoading ? (
                  <div className="flex h-52 flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                    <Loader2 size={24} className="animate-spin text-brand" />
                    Memuat foto...
                  </div>
                ) : photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Foto presensi"
                    className="h-52 w-full cursor-zoom-in object-cover"
                    onClick={() => window.open(photoPreview, "_blank")}
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center text-xs text-slate-400">
                    <FileWarning size={20} className="mr-1.5" /> Pratinjau foto tidak tersedia
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                  <div><strong>Program:</strong> {detailModal.program_name}</div>
                  <div><strong>Waktu Mulai:</strong> {detailModal.start_at}</div>
                  <div><strong>Waktu Selesai:</strong> {detailModal.end_at || "Belum selesai"}</div>
                  <div>
                    <strong>Status GPS:</strong>{" "}
                    {detailModal.gps_valid && detailModal.lat != null && detailModal.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${detailModal.lat},${detailModal.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand underline hover:text-brand-dark"
                      >
                        Valid ({detailModal.lat}, {detailModal.lng})
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      "Tidak tervalidasi"
                    )}
                  </div>
                  <div><strong>Catatan Relawan:</strong> {detailModal.notes || "-"}</div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700">Unduh Satuan / Buat Tautan 30 Hari:</div>
                  {[
                    ["photo", "Foto Presensi", !!detailModal.photo],
                    ["excel", "Excel Pendampingan", !!detailModal.ev_excel],
                    ["bpe", "Bukti BPE SPT", !!detailModal.ev_bpe],
                    ["report", "Bukti Laporan", !!detailModal.ev_report],
                  ]
                    .filter(([, , ok]) => ok)
                    .map(([f, lbl]) => (
                      <div key={f} className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5">
                        <span className="font-semibold text-slate-700">{lbl}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white"
                            onClick={() => downloadFile(API_ENDPOINTS.PRESENSI.EVIDENCE(detailModal.id, f), { download: 1 }, `${detailModal.nim}_${f}`)}
                          >
                            <Download size={12} className="inline" /> Unduh
                          </button>
                          {canCorrect && (
                            <button
                              type="button"
                              className="rounded bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-600 hover:text-white"
                              onClick={() => createShareLink(detailModal.id, f)}
                            >
                              <Link2 size={12} className="inline" /> Link 30h
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {shareLink && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs">
                <div className="min-w-0 flex-1 truncate font-mono text-purple-900">{shareLink.url}</div>
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(shareLink.url);
                    toast.success("Disalin");
                  }}
                >
                  <Copy size={12} /> Salin
                </button>
              </div>
            )}

            {/* Form Koreksi Pengurus */}
            {canCorrect && (
              <form onSubmit={submitCorrection} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Edit3 size={16} className="text-brand" />
                  Koreksi Data Presensi (Data Asli Tetap Tersimpan)
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Terlambat (menit)</label>
                    <input className="input" type="number" min="0" value={correctForm.lateMinutes} onChange={(e) => setCorrectForm({ ...correctForm, lateMinutes: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Jumlah WP</label>
                    <input className="input" type="number" min="0" value={correctForm.wpCount} onChange={(e) => setCorrectForm({ ...correctForm, wpCount: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold">
                      <input type="checkbox" checked={correctForm.gpsValid} onChange={(e) => setCorrectForm({ ...correctForm, gpsValid: e.target.checked })} />
                      GPS Valid
                    </label>
                  </div>
                </div>
                <div>
                  <label className="label">Alasan Koreksi *</label>
                  <input className="input" placeholder="Wajib diisi — tercatat di Riwayat Perubahan" value={correctForm.reason} onChange={(e) => setCorrectForm({ ...correctForm, reason: e.target.value })} required />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Koreksi"}</button>
                </div>
              </form>
            )}

            {/* Riwayat Revisi & Koreksi */}
            {detailModal.revisions?.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Riwayat Revisi & Koreksi</div>
                {detailModal.revisions.map((rev) => (
                  <div key={rev.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>v{rev.version_no} • {rev.kind === "revisi_relawan" ? "Revisi Relawan" : "Koreksi Pengurus"}</span>
                      <span className="font-normal text-slate-400">{rev.created_at}</span>
                    </div>
                    <div className="mt-0.5 text-slate-600">Oleh {rev.actor_name} — {rev.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Alasan Tolak / Revisi */}
      <Modal
        open={!!reasonModal}
        title={reasonModal?.action === "tolak" ? "Tolak Presensi" : "Minta Revisi Presensi"}
        subtitle={reasonModal ? `Relawan: ${reasonModal.name}` : ""}
        onClose={() => setReasonModal(null)}
        maxWidth="max-w-md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason.trim()) return toast.error("Alasan wajib diisi");
            submitVerify(reasonModal.id, reasonModal.action, reason.trim());
          }}
        >
          <div>
            <label className="label">Alasan {reasonModal?.action}</label>
            <textarea
              className="input min-h-[96px]"
              placeholder="Tuliskan catatan atau alasan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setReasonModal(null)}>Batal</button>
            <button type="submit" disabled={busy} className={reasonModal?.action === "tolak" ? "btn-danger" : "btn"}>
              {busy ? "Menyimpan..." : "Kirim"}
            </button>
          </div>
        </form>
      </Modal>
      {/* Modal Konfirmasi Hapus Presensi (Khusus Admin) */}
      <Modal
        open={!!deleteModal}
        title="Hapus Data Presensi"
        subtitle={deleteModal ? `${deleteModal.name} (${deleteModal.nim}) • ${deleteModal.date} Sesi ${deleteModal.session_no}` : ""}
        onClose={() => setDeleteModal(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={confirmDelete} className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs leading-relaxed text-rose-800">
            Data presensi beserta seluruh file foto dan bukti unggahan akan <strong>dihapus permanen dari server</strong>. Relawan dapat melakukan presensi ulang pada sesi ini bila periode masih terbuka.
          </div>
          <div>
            <label className="label">Alasan Penghapusan *</label>
            <input
              className="input"
              placeholder="Contoh: Presensi uji coba / foto salah"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDeleteModal(null)}>Batal</button>
            <button type="submit" className="btn-danger" disabled={busy}>
              <Trash2 size={15} />
              {busy ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
