import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  ListPlus,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import AppSelect from "@/components/AppSelect";
import AppDatePicker from "@/components/AppDatePicker";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "diajukan", label: "Diajukan" },
  { value: "menunggu", label: "Menunggu" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
];

const SCOPE_OPTIONS = [
  { value: "penuh", label: "Satu Sesi Penuh" },
  { value: "sebagian", label: "Sebagian Sesi" },
];

const PROGRAM_OPTIONS = [
  { value: "", label: "Semua Program" },
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const SHIFT_OPTIONS = [
  { value: "Senin, 08.00 - 12.00 WIB", label: "Senin, 08.00 - 12.00 WIB" },
  { value: "Senin, 12.00 - 16.00 WIB", label: "Senin, 12.00 - 16.00 WIB" },
  { value: "Selasa, 08.00 - 12.00 WIB", label: "Selasa, 08.00 - 12.00 WIB" },
  { value: "Selasa, 12.00 - 16.00 WIB", label: "Selasa, 12.00 - 16.00 WIB" },
  { value: "Rabu, 08.00 - 12.00 WIB", label: "Rabu, 08.00 - 12.00 WIB" },
  { value: "Rabu, 12.00 - 16.00 WIB", label: "Rabu, 12.00 - 16.00 WIB" },
  { value: "Kamis, 08.00 - 12.00 WIB", label: "Kamis, 08.00 - 12.00 WIB" },
  { value: "Kamis, 12.00 - 16.00 WIB", label: "Kamis, 12.00 - 16.00 WIB" },
  { value: "Jumat, 08.00 - 12.00 WIB", label: "Jumat, 08.00 - 12.00 WIB" },
  { value: "Jumat, 12.00 - 16.00 WIB", label: "Jumat, 12.00 - 16.00 WIB" },
];

export default function Pergantian() {
  const user = getUser();
  const isRelawan = user.role === "relawan";
  const canManage = ["pengurus", "admin"].includes(user.role);
  const isAdmin = user.role === "admin";

  const [activeTab, setActiveTab] = useState("reguler"); // 'reguler' | 'tukar'
  const [status, setStatus] = useState("");
  const [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false);

  // Tab 1: Pengajuan Sesi Reguler
  const [period, setPeriod] = useState(null);
  const [regulerOpen, setRegulerOpen] = useState(false);
  const [periodModal, setPeriodModal] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    title: "Periode Pengajuan Sesi Jaga Reguler",
    programId: "1",
    startDate: "",
    endDate: "",
    isOpen: true,
    notes: "",
  });

  const [regulerForm, setRegulerForm] = useState({
    name: user.name || "",
    nim: user.nim || "",
    prodi: user.prodi || "D-III Pajak",
    semester: user.semester || "Semester 4",
    priority1: "",
    priority2: "",
    priority3: "",
    reason: "",
  });

  const [regReviewModal, setRegReviewModal] = useState(null);
  const [regReviewStatus, setRegReviewStatus] = useState("disetujui");
  const [regReviewNotes, setRegReviewNotes] = useState("");

  const tReguler = usePaginated(API_ENDPOINTS.SCHEDULE_SUBMISSIONS.LIST, { status, programId: pid });

  // Tab 2: Pertukaran Jadwal (Substitusi)
  const [swapOpen, setSwapOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [swapForm, setSwapForm] = useState({ sessionId: "", substituteId: "", substituteName: "", scope: "penuh", reason: "" });
  const [swapReviewModal, setSwapReviewModal] = useState(null);
  const [swapReviewReason, setSwapReviewReason] = useState("");

  const tSwap = usePaginated(API_ENDPOINTS.PERGANTIAN.LIST, { status, programId: pid });

  // Load active period for regular schedule submissions
  useEffect(() => {
    request("get", API_ENDPOINTS.SCHEDULE_SUBMISSIONS.PERIOD).then((r) => setPeriod(r?.data || null));
  }, []);

  useEffect(() => {
    if (swapOpen && isRelawan) {
      request("get", API_ENDPOINTS.JADWAL.LIST, { limit: 100 }).then((r) => setSessions(r?.data || []));
      request("get", API_ENDPOINTS.PERGANTIAN.CANDIDATES).then((r) => setCandidates(r?.data || []));
    }
  }, [swapOpen, isRelawan]);

  // Tab 1 Submissions
  const submitReguler = async (e) => {
    e.preventDefault();
    if (!regulerForm.priority1 || !regulerForm.priority2 || !regulerForm.priority3) {
      return toast.error("Silakan tentukan 3 prioritas hari dan jam");
    }
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.SCHEDULE_SUBMISSIONS.LIST, regulerForm, { success: true });
    setBusy(false);
    if (r) {
      setRegulerOpen(false);
      tReguler.reload();
    }
  };

  const submitPeriodConfig = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.SCHEDULE_SUBMISSIONS.PERIODS, periodForm, { success: true });
    setBusy(false);
    if (r) {
      setPeriodModal(false);
      request("get", API_ENDPOINTS.SCHEDULE_SUBMISSIONS.PERIOD).then((res) => setPeriod(res?.data || null));
    }
  };

  const submitRegReview = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await request(
      "put",
      API_ENDPOINTS.SCHEDULE_SUBMISSIONS.REVIEW(regReviewModal.id),
      { status: regReviewStatus, adminNotes: regReviewNotes },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setRegReviewModal(null);
      tReguler.reload();
    }
  };

  // Tab 2 Swap Submissions
  const submitSwapRequest = async (e) => {
    e.preventDefault();
    if (!swapForm.sessionId) return toast.error("Pilih jadwal yang akan digantikan");
    if (!swapForm.substituteId && !swapForm.substituteName.trim()) return toast.error("Pilih relawan pengganti atau ketik namanya");
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.PERGANTIAN.LIST, swapForm, { success: true });
    setBusy(false);
    if (r) {
      setSwapOpen(false);
      setSwapForm({ sessionId: "", substituteId: "", substituteName: "", scope: "penuh", reason: "" });
      tSwap.reload();
    }
  };

  const submitSwapReview = async (id, action, reason = "") => {
    setBusy(true);
    const r = await request("put", API_ENDPOINTS.PERGANTIAN.REVIEW(id), { action, reason }, { success: true });
    setBusy(false);
    if (r) {
      setSwapReviewModal(null);
      setSwapReviewReason("");
      tSwap.reload();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={RefreshCw}
        title="Pengajuan & Pertukaran Sesi Jaga"
        subtitle="Menu terpadu untuk pengajuan sesi jaga reguler (3 prioritas) dan pertukaran jadwal mandiri."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "reguler" && isRelawan && (
              <button
                type="button"
                className="btn"
                disabled={!period}
                onClick={() => setRegulerOpen(true)}
              >
                <Plus size={18} />
                Ajukan Sesi Reguler
              </button>
            )}

            {activeTab === "reguler" && canManage && (
              <button
                type="button"
                className="btn-ghost !bg-white shadow-sm"
                onClick={() => setPeriodModal(true)}
              >
                <Settings2 size={16} />
                Atur Periode Pengajuan
              </button>
            )}

            {activeTab === "tukar" && isRelawan && (
              <button type="button" className="btn" onClick={() => setSwapOpen(true)}>
                <Plus size={18} />
                Ajukan Pertukaran Jadwal
              </button>
            )}
          </div>
        }
      />

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("reguler")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition ${
            activeTab === "reguler"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarDays size={18} />
          1. Pengajuan Sesi Jaga Reguler
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tukar")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition ${
            activeTab === "tukar"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <RefreshCw size={17} />
          2. Pertukaran Jadwal (Substitusi)
        </button>
      </div>

      {/* ================= TAB 1: PENGAJUAN SESI JAGA REGULER ================= */}
      {activeTab === "reguler" && (
        <div className="space-y-5">
          {/* Status Periode Pengajuan Banner */}
          {period ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 shadow-sm text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-extrabold text-emerald-950">
                    {period.title} Sedang Dibuka!
                  </span>{" "}
                  Periode aktif dari <strong>{period.start_date}</strong> s.d. <strong>{period.end_date}</strong>.
                  {period.notes && <span className="ml-1 text-emerald-700">({period.notes})</span>}
                </div>
              </div>
              {isRelawan && (
                <button
                  type="button"
                  className="btn !rounded-xl !px-3.5 !py-1.5 text-xs !bg-emerald-700 hover:!bg-emerald-800"
                  onClick={() => setRegulerOpen(true)}
                >
                  <Plus size={14} /> Isi Formulir 3 Prioritas
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 text-xs">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Periode Pengajuan Sesi Jaga Reguler Saat Ini Ditutup.</span>{" "}
                Pengajuan hanya dapat dilakukan pada rentang tanggal yang ditentukan oleh Admin/Pengurus (misal tgl 1–20).
              </div>
            </div>
          )}

          {/* Tabel Pengajuan Reguler */}
          <DataTable
            t={tReguler}
            searchPlaceholder="Cari nama, NIM, prodi, atau prioritas..."
            toolbar={
              <>
                {isAdmin && (
                  <div className="w-full md:w-44">
                    <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={pid} onChange={setPid} />
                  </div>
                )}
                <div className="w-full md:w-44">
                  <AppSelect size="sm" isSearchable={false} options={STATUS_OPTIONS} value={status} onChange={setStatus} />
                </div>
              </>
            }
            columns={[
              {
                label: "Relawan",
                render: (r) => (
                  <div>
                    <div className="font-bold text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.nim} • {r.prodi} ({r.semester})</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{r.program_name}</div>
                  </div>
                ),
              },
              {
                label: "3 Prioritas Pilihan Hari & Jam",
                render: (r) => (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand">P1</span>
                      <span>{r.priority_1}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">P2</span>
                      <span>{r.priority_2}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">P3</span>
                      <span>{r.priority_3}</span>
                    </div>
                    {r.reason && (
                      <div className="text-[11px] text-slate-400 italic mt-0.5">Alasan: {r.reason}</div>
                    )}
                  </div>
                ),
              },
              {
                label: "Tanggal Pengajuan",
                render: (r) => (
                  <span className="text-xs text-slate-600 font-medium">
                    {r.created_at ? String(r.created_at).slice(0, 10) : "-"}
                  </span>
                ),
              },
              {
                label: "Status",
                render: (r) => (
                  <div>
                    <StatusBadge s={r.status} note={r.admin_notes} />
                    {r.admin_notes && (
                      <div className="mt-1 text-[11px] text-slate-500 max-w-[180px]">Catatan: {r.admin_notes}</div>
                    )}
                  </div>
                ),
              },
              ...(canManage
                ? [
                    {
                      label: "Aksi",
                      render: (r) => (
                        <button
                          type="button"
                          className="btn-ghost !rounded-lg !px-2.5 !py-1 text-xs"
                          onClick={() => {
                            setRegReviewModal(r);
                            setRegReviewStatus(r.status === "diajukan" ? "disetujui" : r.status);
                            setRegReviewNotes(r.admin_notes || "");
                          }}
                        >
                          Tinjau Pengajuan
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      {/* ================= TAB 2: PERTUKARAN JADWAL (SUBSTITUSI MANDIRI) ================= */}
      {activeTab === "tukar" && (
        <div className="space-y-4">
          <DataTable
            t={tSwap}
            searchPlaceholder="Cari relawan, pengganti, atau alasan..."
            toolbar={
              <>
                {isAdmin && (
                  <div className="w-full md:w-44">
                    <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={pid} onChange={setPid} />
                  </div>
                )}
                <div className="w-full md:w-44">
                  <AppSelect size="sm" isSearchable={false} options={STATUS_OPTIONS} value={status} onChange={setStatus} />
                </div>
              </>
            }
            columns={[
              {
                label: "Jadwal",
                render: (r) => (
                  <div>
                    <div className="font-semibold text-slate-900">{r.date} • Sesi {r.session_no}</div>
                    <div className="text-xs text-slate-500">{r.session_title || `${r.start_time?.slice(0, 5)}–${r.end_time?.slice(0, 5)} WIB`}</div>
                  </div>
                ),
              },
              {
                label: "Pemohon",
                render: (r) => (
                  <div>
                    <div className="font-semibold text-slate-900">{r.requester_name}</div>
                    <div className="text-xs text-slate-500">{r.requester_nim} • {r.program_name}</div>
                  </div>
                ),
              },
              {
                label: "Pengganti",
                render: (r) => (
                  <div>
                    <div className="font-semibold text-slate-900">{r.substitute_user_name || r.substitute_name || "-"}</div>
                    <div className="text-xs text-slate-500">{r.substitute_nim || "Relawan Pengganti"}</div>
                  </div>
                ),
              },
              {
                label: "Cakupan & Alasan",
                render: (r) => (
                  <div className="max-w-xs text-xs">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand uppercase">
                      {r.scope}
                    </span>
                    <p className="mt-1 text-slate-600 line-clamp-2">{r.reason}</p>
                  </div>
                ),
              },
              {
                label: "Status",
                render: (r) => (
                  <div>
                    <StatusBadge s={r.status} note={r.review_reason} />
                    {r.review_reason && (
                      <div className="mt-1 text-[11px] text-rose-600">{r.review_reason}</div>
                    )}
                  </div>
                ),
              },
              ...(canManage
                ? [
                    {
                      label: "Aksi Review",
                      render: (r) =>
                        r.status === "menunggu" ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Setujui pergantian"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-600 hover:text-white transition"
                              onClick={() => submitSwapReview(r.id, "setujui")}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              title="Tolak pergantian"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-600 hover:text-white transition"
                              onClick={() => {
                                setSwapReviewReason("");
                                setSwapReviewModal(r);
                              }}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{r.reviewer_name || "Selesai"}</span>
                        ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      {/* Modal Form Pengajuan Sesi Reguler (3 Prioritas) */}
      <Modal
        open={regulerOpen}
        title="Pengajuan Sesi Jaga Reguler"
        subtitle="Lengkapi data diri dan tentukan 3 prioritas pilihan hari & jam dinas jaga Anda."
        onClose={() => setRegulerOpen(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={submitReguler} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nama Lengkap *</label>
              <input
                className="input"
                value={regulerForm.name}
                onChange={(e) => setRegulerForm({ ...regulerForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">NIM *</label>
              <input
                className="input"
                value={regulerForm.nim}
                onChange={(e) => setRegulerForm({ ...regulerForm, nim: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Program Studi *</label>
              <input
                className="input"
                value={regulerForm.prodi}
                onChange={(e) => setRegulerForm({ ...regulerForm, prodi: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Semester *</label>
              <input
                className="input"
                placeholder="Misal: Semester 4"
                value={regulerForm.semester}
                onChange={(e) => setRegulerForm({ ...regulerForm, semester: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-500">
              3 Pilihan Prioritas Jadwal Dinas:
            </div>

            <div>
              <label className="label">Prioritas 1 (Pilihan Utama) *</label>
              <AppSelect
                isSearchable={false}
                options={SHIFT_OPTIONS}
                value={regulerForm.priority1}
                onChange={(val) => setRegulerForm({ ...regulerForm, priority1: val })}
                placeholder="Pilih prioritas 1..."
              />
            </div>

            <div>
              <label className="label">Prioritas 2 *</label>
              <AppSelect
                isSearchable={false}
                options={SHIFT_OPTIONS}
                value={regulerForm.priority2}
                onChange={(val) => setRegulerForm({ ...regulerForm, priority2: val })}
                placeholder="Pilih prioritas 2..."
              />
            </div>

            <div>
              <label className="label">Prioritas 3 *</label>
              <AppSelect
                isSearchable={false}
                options={SHIFT_OPTIONS}
                value={regulerForm.priority3}
                onChange={(val) => setRegulerForm({ ...regulerForm, priority3: val })}
                placeholder="Pilih prioritas 3..."
              />
            </div>
          </div>

          <div>
            <label className="label">Catatan / Alasan Khusus (opsional)</label>
            <textarea
              className="input min-h-[72px]"
              placeholder="Misal: Bentrok jadwal kuliah praktikum pada hari Selasa..."
              value={regulerForm.reason}
              onChange={(e) => setRegulerForm({ ...regulerForm, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={() => setRegulerOpen(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Mengirim..." : "Kirim Pengajuan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Atur Periode Pengajuan (Admin) */}
      <Modal
        open={periodModal}
        title="Pengaturan Periode Pengajuan Sesi Reguler"
        subtitle="Atur tanggal buka dan tutup pengajuan sesi jaga agar relawan dapat memilih jadwal."
        onClose={() => setPeriodModal(false)}
        maxWidth="max-w-md"
      >
        <form onSubmit={submitPeriodConfig} className="space-y-4">
          {isAdmin && (
            <div>
              <label className="label">Program *</label>
              <AppSelect
                isSearchable={false}
                options={PROGRAM_OPTIONS.slice(1)}
                value={periodForm.programId}
                onChange={(val) => setPeriodForm({ ...periodForm, programId: val })}
              />
            </div>
          )}

          <div>
            <label className="label">Judul Periode *</label>
            <input
              className="input"
              value={periodForm.title}
              onChange={(e) => setPeriodForm({ ...periodForm, title: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Mulai *</label>
              <AppDatePicker
                value={periodForm.startDate}
                onChange={(val) => setPeriodForm({ ...periodForm, startDate: val })}
              />
            </div>
            <div>
              <label className="label">Tanggal Selesai *</label>
              <AppDatePicker
                value={periodForm.endDate}
                onChange={(val) => setPeriodForm({ ...periodForm, endDate: val })}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand focus:ring-brand"
              checked={periodForm.isOpen}
              onChange={(e) => setPeriodForm({ ...periodForm, isOpen: e.target.checked })}
            />
            Buka Pengajuan (Relawan Dapat Mengisi Form)
          </label>

          <div>
            <label className="label">Catatan Tambahan (opsional)</label>
            <input
              className="input"
              placeholder="Contoh: Terbuka untuk periode Maret 2026"
              value={periodForm.notes}
              onChange={(e) => setPeriodForm({ ...periodForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={() => setPeriodModal(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan Periode"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Review Pengajuan Reguler (Admin) */}
      <Modal
        open={!!regReviewModal}
        title="Tinjau Pengajuan Sesi Reguler"
        subtitle={regReviewModal ? `Relawan: ${regReviewModal.name} (${regReviewModal.nim})` : ""}
        onClose={() => setRegReviewModal(null)}
        maxWidth="max-w-md"
      >
        {regReviewModal && (
          <form onSubmit={submitRegReview} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div><strong>Prioritas 1:</strong> {regReviewModal.priority_1}</div>
              <div><strong>Prioritas 2:</strong> {regReviewModal.priority_2}</div>
              <div><strong>Prioritas 3:</strong> {regReviewModal.priority_3}</div>
              {regReviewModal.reason && (
                <div><strong>Alasan Relawan:</strong> {regReviewModal.reason}</div>
              )}
            </div>

            <div>
              <label className="label">Pilih Keputusan *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition border ${
                    regReviewStatus === "disetujui"
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  onClick={() => setRegReviewStatus("disetujui")}
                >
                  Setujui
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition border ${
                    regReviewStatus === "ditolak"
                      ? "border-rose-600 bg-rose-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  onClick={() => setRegReviewStatus("ditolak")}
                >
                  Tolak
                </button>
              </div>
            </div>

            <div>
              <label className="label">Catatan Admin</label>
              <textarea
                className="input min-h-[72px]"
                placeholder="Catatan penugasan atau alasan penolakan..."
                value={regReviewNotes}
                onChange={(e) => setRegReviewNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" className="btn-ghost" onClick={() => setRegReviewModal(null)}>Batal</button>
              <button type="submit" className="btn" disabled={busy}>
                Simpan Keputusan
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Ajukan Pertukaran Jadwal (Relawan) */}
      <Modal open={swapOpen} title="Ajukan Pertukaran Jadwal" subtitle="Relawan asli tetap tercatat; relawan pengganti dicatat mandiri." onClose={() => setSwapOpen(false)}>
        <form onSubmit={submitSwapRequest} className="space-y-4">
          <div>
            <label className="label">Jadwal yang Ingin Ditukar *</label>
            <AppSelect
              options={sessions
                .filter((s) => !s.attendance_id && !s.replaced_by)
                .map((s) => ({
                  value: String(s.id),
                  label: `${s.date} — Sesi ${s.session_no} (${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)}) ${s.title || ""}`,
                }))}
              value={swapForm.sessionId}
              onChange={(val) => setSwapForm({ ...swapForm, sessionId: val })}
              placeholder="Pilih jadwal sesi Anda..."
            />
          </div>

          <div>
            <label className="label">Cakupan Pertukaran *</label>
            <AppSelect
              isSearchable={false}
              options={SCOPE_OPTIONS}
              value={swapForm.scope}
              onChange={(val) => setSwapForm({ ...swapForm, scope: val })}
            />
          </div>

          <div>
            <label className="label">Pilih Relawan Pengganti (Program Sama)</label>
            <AppSelect
              isClearable
              options={candidates.map((c) => ({ value: String(c.id), label: `${c.nim} — ${c.name}` }))}
              value={swapForm.substituteId}
              onChange={(val) => setSwapForm({ ...swapForm, substituteId: val })}
              placeholder="Cari nama / NIM relawan pengganti..."
            />
          </div>

          {!swapForm.substituteId && (
            <div>
              <label className="label">Atau Ketik Nama Pengganti</label>
              <input
                className="input"
                placeholder="Nama lengkap relawan pengganti"
                value={swapForm.substituteName}
                onChange={(e) => setSwapForm({ ...swapForm, substituteName: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="label">Alasan Pertukaran *</label>
            <textarea
              className="input min-h-[88px]"
              placeholder="Jelaskan alasan berhalangan hadir..."
              value={swapForm.reason}
              onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={() => setSwapOpen(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Mengirim..." : "Kirim Pengajuan"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Tolak Pertukaran */}
      <Modal open={!!swapReviewModal} title="Tolak Pengajuan Pertukaran" subtitle={swapReviewModal ? `Pemohon: ${swapReviewModal.requester_name}` : ""} onClose={() => setSwapReviewModal(null)} maxWidth="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!swapReviewReason.trim()) return toast.error("Alasan penolakan wajib diisi");
            submitSwapReview(swapReviewModal.id, "tolak", swapReviewReason.trim());
          }}
        >
          <div>
            <label className="label">Alasan Penolakan *</label>
            <textarea
              className="input min-h-[88px]"
              placeholder="Tuliskan alasan penolakan..."
              value={swapReviewReason}
              onChange={(e) => setSwapReviewReason(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setSwapReviewModal(null)}>Batal</button>
            <button type="submit" className="btn-danger" disabled={busy}>Tolak Pengajuan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
