import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  FileCheck,
  ImageIcon,
  Info,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const CATEGORY_OPTIONS = [
  { value: "", label: "Semua Kategori" },
  { value: "umum", label: "Pengumuman Umum" },
  { value: "rotm", label: "Relawan of the Month" },
  { value: "panduan", label: "Panduan & Poin" },
  { value: "urgent", label: "Penting / Mendesak" },
];

const PROGRAM_OPTIONS = [
  { value: "", label: "Semua Program" },
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

export default function Pengumuman() {
  const user = getUser();
  const canManage = ["pengurus", "admin"].includes(user.role);
  const isAdmin = user.role === "admin";

  const [category, setCategory] = useState("");
  const [pid, setPid] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "umum",
    programId: "",
    isPopup: false,
    active: true,
    rotmUserName: "",
    rotmPeriod: "",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const t = usePaginated(API_ENDPOINTS.ANNOUNCEMENTS.LIST, { category, programId: pid });

  const openModal = (ann = null) => {
    setCoverFile(null);
    setCoverPreview(ann?.cover_image ? API_ENDPOINTS.ANNOUNCEMENTS.COVER(ann.id) : "");
    setModal(ann || {});
    setForm({
      title: ann?.title || "",
      content: ann?.content || "",
      category: ann?.category || "umum",
      programId: ann?.program_id ? String(ann.program_id) : "",
      isPopup: ann ? !!ann.is_popup : false,
      active: ann ? !!ann.active : true,
      rotmUserName: ann?.rotm_user_name || "",
      rotmPeriod: ann?.rotm_period || "",
    });
  };

  const handleCoverChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setCoverFile(f);
      setCoverPreview(URL.createObjectURL(f));
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Judul pengumuman wajib diisi");
    if (!form.content.trim()) return toast.error("Isi pengumuman wajib diisi");

    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (coverFile) fd.append("cover", coverFile);

    const r = modal?.id
      ? await request("put", API_ENDPOINTS.ANNOUNCEMENTS.DETAIL(modal.id), fd, { success: true })
      : await request("post", API_ENDPOINTS.ANNOUNCEMENTS.LIST, fd, { success: true });
    setBusy(false);
    if (r) {
      setModal(null);
      t.reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const r = await request("delete", API_ENDPOINTS.ANNOUNCEMENTS.DETAIL(deleteTarget.id), null, { success: true });
    setBusy(false);
    if (r) {
      setDeleteTarget(null);
      t.reload();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Pengumuman, Informasi & Relawan Terbaik"
        subtitle="Pusat informasi resmi, panduan teknis pelaporan RENJANI, dan publikasi Relawan of the Month."
        actions={
          canManage && (
            <button type="button" className="btn" onClick={() => openModal(null)}>
              <Plus size={18} />
              Buat Pengumuman Baru
            </button>
          )
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="w-full md:w-44">
            <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={pid} onChange={setPid} />
          </div>
        )}
        <div className="w-full md:w-48">
          <AppSelect size="sm" isSearchable={false} options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </div>
      </div>

      {/* Grid Kartu Pengumuman */}
      {t.data?.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.data.map((ann) => {
            const isRotm = ann.category === "rotm";
            return (
              <div
                key={ann.id}
                className={`card flex flex-col justify-between overflow-hidden border shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  isRotm
                    ? "border-amber-300 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30"
                    : "border-slate-200"
                }`}
              >
                <div>
                  {/* Cover Image Area */}
                  {ann.cover_image ? (
                    <div className="h-44 w-full overflow-hidden bg-slate-900">
                      <img
                        src={API_ENDPOINTS.ANNOUNCEMENTS.COVER(ann.id)}
                        alt={ann.title}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  ) : isRotm ? (
                    <div className="h-32 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 p-4 flex flex-col justify-between text-white">
                      <div className="flex justify-between items-center">
                        <Trophy size={28} className="text-white/90" />
                        <Sparkles size={20} className="text-amber-200 animate-pulse" />
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider">Apresiasi Relawan Terbaik</div>
                    </div>
                  ) : null}

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          isRotm
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : ann.category === "urgent"
                            ? "bg-rose-100 text-rose-700"
                            : ann.category === "panduan"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-brand-50 text-brand"
                        }`}
                      >
                        {isRotm ? "Relawan of the Month" : ann.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {ann.created_at ? String(ann.created_at).slice(0, 10) : ""}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2">
                      {ann.title}
                    </h3>

                    {isRotm && ann.rotm_user_name && (
                      <div className="rounded-xl border border-amber-200 bg-amber-100/60 p-2.5 text-xs font-bold text-amber-950 flex items-center gap-2">
                        <Trophy size={16} className="text-amber-600 shrink-0" />
                        <div>
                          <div>Pemenang: <span className="text-brand font-extrabold">{ann.rotm_user_name}</span></div>
                          <div className="text-[11px] font-normal text-amber-800">{ann.rotm_period || "Periode Berjalan"}</div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed whitespace-pre-line">
                      {ann.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                      <span>{ann.program_name || "Semua Program"}</span>
                      {ann.is_popup ? (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-brand flex items-center gap-1">
                            <Sparkles size={11} /> Pop-up Aktif
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    type="button"
                    className="btn !rounded-xl !px-3.5 !py-1.5 text-xs"
                    onClick={() => setDetailModal(ann)}
                  >
                    Baca Lengkap
                  </button>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Ubah pengumuman"
                        className="btn-ghost !p-2 !rounded-lg text-slate-600 hover:text-brand"
                        onClick={() => openModal(ann)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Hapus pengumuman"
                        className="btn-ghost !p-2 !rounded-lg text-rose-600 hover:!bg-rose-50"
                        onClick={() => setDeleteTarget(ann)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-400 text-sm">
          Belum ada pengumuman pada kategori ini.
        </div>
      )}

      {/* Modal Detail Pengumuman */}
      <Modal
        open={!!detailModal}
        title={detailModal?.title || "Detail Pengumuman"}
        subtitle={`Dipublikasikan pada ${detailModal?.created_at ? String(detailModal.created_at).slice(0, 10) : ""} oleh ${detailModal?.author_name || "Admin"}`}
        onClose={() => setDetailModal(null)}
        maxWidth="max-w-2xl"
      >
        {detailModal && (
          <div className="space-y-4">
            {detailModal.cover_image && (
              <div className="max-h-72 w-full overflow-hidden rounded-2xl bg-slate-900 flex items-center justify-center">
                <img
                  src={API_ENDPOINTS.ANNOUNCEMENTS.COVER(detailModal.id)}
                  alt={detailModal.title}
                  className="max-h-72 w-auto max-w-full object-contain"
                />
              </div>
            )}

            {detailModal.category === "rotm" && detailModal.rotm_user_name && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
                  <Trophy size={20} />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-amber-950">
                    Pemenang Relawan of the Month: {detailModal.rotm_user_name}
                  </div>
                  <div className="font-medium text-amber-800">
                    {detailModal.rotm_period || "Periode Berjalan"} • Program {detailModal.program_name || "Tax Center PKN STAN"}
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line p-1">
              {detailModal.content}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" className="btn" onClick={() => setDetailModal(null)}>
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Buat / Edit Pengumuman (Admin) */}
      <Modal
        open={!!modal}
        title={modal?.id ? "Ubah Pengumuman" : "Buat Pengumuman Baru"}
        subtitle="Publikasikan pengumuman, panduan pelaporan RENJANI, atau publikasi Relawan of the Month."
        onClose={() => setModal(null)}
        maxWidth="max-w-xl"
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Judul Pengumuman *</label>
            <input
              className="input"
              placeholder="Contoh: Pengumuman Relawan of the Month Februari 2026"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Kategori *</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="umum">Pengumuman Umum</option>
                <option value="rotm">Relawan of the Month</option>
                <option value="panduan">Panduan & Poin</option>
                <option value="urgent">Penting / Mendesak</option>
              </select>
            </div>

            <div>
              <label className="label">Target Program</label>
              <select
                className="input"
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
              >
                <option value="">Semua Program (Publik)</option>
                <option value="1">Tax Clinic</option>
                <option value="2">Renjani</option>
              </select>
            </div>
          </div>

          {/* Form Tambahan Relawan of the Month */}
          {form.category === "rotm" && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
              <div>
                <label className="label text-amber-900 font-bold">Nama Relawan Pemenang</label>
                <input
                  className="input bg-white"
                  placeholder="Nama relawan terpilih"
                  value={form.rotmUserName}
                  onChange={(e) => setForm({ ...form, rotmUserName: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-amber-900 font-bold">Bulan / Periode Penilaian</label>
                <input
                  className="input bg-white"
                  placeholder="Misal: Februari 2026"
                  value={form.rotmPeriod}
                  onChange={(e) => setForm({ ...form, rotmPeriod: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Upload Cover Image */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
            <label className="label !mb-0 font-bold flex items-center gap-1.5 text-slate-800">
              <ImageIcon size={15} className="text-brand" /> Foto Sampul / Foto Pemenang (JPG / PNG / WebP)
            </label>
            <p className="text-xs text-slate-500">
              Unggah foto relawan pemenang ROTM atau gambar panduan screenshot asistensi.
            </p>
            <input
              type="file"
              accept="image/*"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
              onChange={handleCoverChange}
            />
            {coverPreview && (
              <div className="mt-2 h-28 w-44 overflow-hidden rounded-xl border border-slate-200">
                <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="label">Isi Pengumuman / Panduan *</label>
            <textarea
              className="input min-h-[120px]"
              placeholder="Tuliskan isi pengumuman atau instruksi secara lengkap..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>

          {/* Checkboxes: Pop-Up Otomatis & Status Aktif */}
          <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 shadow-sm">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand focus:ring-brand"
                checked={form.isPopup}
                onChange={(e) => setForm({ ...form, isPopup: e.target.checked })}
              />
              Tampilkan Pop-up Otomatis Saat Relawan Buka Web
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 shadow-sm">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand focus:ring-brand"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Status Aktif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Menyimpan..." : "Publikasikan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Pengumuman */}
      <Modal
        open={!!deleteTarget}
        title="Hapus Pengumuman"
        subtitle={deleteTarget?.title}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Pengumuman <strong>{deleteTarget?.title}</strong> beserta file gambarnya akan dihapus permanen.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
            <button type="button" className="btn-danger" disabled={busy} onClick={confirmDelete}>
              {busy ? "Menghapus..." : "Ya, Hapus Pengumuman"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
