import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Plus, RefreshCw, X } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import AppSelect from "@/components/AppSelect";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
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

export default function Pergantian() {
  const user = getUser();
  const isRelawan = user.role === "relawan";
  const isAdmin = user.role === "admin";
  const [status, setStatus] = useState("");
  const [pid, setPid] = useState("");
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({ sessionId: "", substituteId: "", substituteName: "", scope: "penuh", reason: "" });
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const [busy, setBusy] = useState(false);

  const t = usePaginated(API_ENDPOINTS.PERGANTIAN.LIST, { status, programId: pid });

  useEffect(() => {
    if (open && isRelawan) {
      request("get", API_ENDPOINTS.JADWAL.LIST, { limit: 100 }).then((r) => setSessions(r?.data || []));
      request("get", API_ENDPOINTS.PERGANTIAN.CANDIDATES).then((r) => setCandidates(r?.data || []));
    }
  }, [open, isRelawan]);

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!form.sessionId) return toast.error("Pilih jadwal yang akan digantikan");
    if (!form.substituteId && !form.substituteName.trim()) return toast.error("Pilih relawan pengganti atau ketik namanya");
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.PERGANTIAN.LIST, form, { success: true });
    setBusy(false);
    if (r) {
      setOpen(false);
      setForm({ sessionId: "", substituteId: "", substituteName: "", scope: "penuh", reason: "" });
      t.reload();
    }
  };

  const submitReview = async (id, action, reason = "") => {
    setBusy(true);
    const r = await request("put", API_ENDPOINTS.PERGANTIAN.REVIEW(id), { action, reason }, { success: true });
    setBusy(false);
    if (r) {
      setReviewModal(null);
      setReviewReason("");
      t.reload();
    }
  };

  return (
    <div>
      <PageHeader
        icon={RefreshCw}
        title="Pergantian Sesi"
        subtitle={
          isRelawan
            ? "Ajukan pergantian jadwal penuh atau sebagian sesi dengan mencantumkan relawan pengganti."
            : "Tinjau dan setujui atau tolak pengajuan pergantian jadwal dari relawan."
        }
        actions={
          isRelawan && (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              <Plus size={18} />
              Ajukan Pergantian
            </button>
          )
        }
      />

      <DataTable
        t={t}
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
                <div className="text-xs text-slate-500">{r.session_title || `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`}</div>
              </div>
            ),
          },
          {
            label: "Pemohon",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-900">{r.requester_name}</div>
                <div className="text-xs text-slate-500">{r.requester_nim}</div>
              </div>
            ),
          },
          {
            label: "Pengganti",
            render: (r) => (
              <div>
                <div className="font-semibold text-brand">{r.sub_display_name || "-"}</div>
                {r.sub_nim && <div className="text-xs text-slate-500">{r.sub_nim}</div>}
              </div>
            ),
          },
          {
            label: "Cakupan",
            render: (r) => (
              <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
                {r.scope}
              </span>
            ),
          },
          { label: "Alasan", key: "reason" },
          {
            label: "Status",
            render: (r) => <StatusBadge s={r.status} note={r.review_reason} />,
          },
          ...(!isRelawan
            ? [
                {
                  label: "Aksi",
                  render: (r) =>
                    r.status === "menunggu" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Setujui pergantian"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => submitReview(r.id, "setujui", "Disetujui")}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          title="Tolak pergantian"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-600 hover:text-white"
                          onClick={() => {
                            setReviewReason("");
                            setReviewModal(r);
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

      {/* Modal Ajukan Pergantian (Relawan) */}
      <Modal open={open} title="Ajukan Pergantian Sesi" subtitle="Relawan asli tetap tercatat; satu posisi tidak dihitung dua orang." onClose={() => setOpen(false)}>
        <form onSubmit={submitRequest} className="space-y-4">
          <div>
            <label className="label">Jadwal yang Digantikan *</label>
            <AppSelect
              options={sessions
                .filter((s) => !s.attendance_id && !s.replaced_by)
                .map((s) => ({
                  value: String(s.id),
                  label: `${s.date} — Sesi ${s.session_no} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}) ${s.title || ""}`,
                }))}
              value={form.sessionId}
              onChange={(val) => setForm({ ...form, sessionId: val })}
              placeholder="Pilih jadwal Anda..."
            />
          </div>

          <div>
            <label className="label">Cakupan Pergantian *</label>
            <AppSelect
              isSearchable={false}
              options={SCOPE_OPTIONS}
              value={form.scope}
              onChange={(val) => setForm({ ...form, scope: val })}
            />
          </div>

          <div>
            <label className="label">Pilih Relawan Pengganti (Program Sama)</label>
            <AppSelect
              isClearable
              options={candidates.map((c) => ({ value: String(c.id), label: `${c.nim} — ${c.name}` }))}
              value={form.substituteId}
              onChange={(val) => setForm({ ...form, substituteId: val })}
              placeholder="Cari nama / NIM relawan pengganti..."
            />
          </div>

          {!form.substituteId && (
            <div>
              <label className="label">Atau Ketik Nama Pengganti</label>
              <input
                className="input"
                placeholder="Nama lengkap pengganti"
                value={form.substituteName}
                onChange={(e) => setForm({ ...form, substituteName: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="label">Alasan Pergantian *</label>
            <textarea
              className="input min-h-[88px]"
              placeholder="Jelaskan alasan tidak dapat hadir..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Mengirim..." : "Kirim Pengajuan"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Tolak Pergantian */}
      <Modal open={!!reviewModal} title="Tolak Pengajuan Pergantian" subtitle={reviewModal ? `Pemohon: ${reviewModal.requester_name}` : ""} onClose={() => setReviewModal(null)} maxWidth="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reviewReason.trim()) return toast.error("Alasan penolakan wajib diisi");
            submitReview(reviewModal.id, "tolak", reviewReason.trim());
          }}
        >
          <div>
            <label className="label">Alasan Penolakan *</label>
            <textarea
              className="input min-h-[88px]"
              placeholder="Tuliskan alasan penolakan..."
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setReviewModal(null)}>Batal</button>
            <button type="submit" className="btn-danger" disabled={busy}>Tolak Pengajuan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
