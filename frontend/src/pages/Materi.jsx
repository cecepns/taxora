import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Award,
  BookOpen,
  Calendar,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  History,
  ImageIcon,
  Info,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import AppDatePicker from "@/components/AppDatePicker";
import EvidencePreviewModal from "@/components/EvidencePreviewModal";
import usePaginated from "@/hooks/usePaginated";
import { downloadFile, request, getAuthenticatedUrl } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const CATEGORY_OPTIONS = [
  { value: "", label: "Semua Kategori" },
  { value: "SOP", label: "SOP" },
  { value: "Guidebook", label: "Guidebook" },
  { value: "Materi", label: "Materi Pelatihan" },
  { value: "Penilaian", label: "Kriteria Penilaian" },
  { value: "Kegiatan", label: "Dokumentasi Kegiatan" },
  { value: "Lainnya", label: "Lainnya" },
];

const FORM_CATEGORY_OPTIONS = CATEGORY_OPTIONS.slice(1);
const PROGRAM_OPTIONS = [
  { value: "", label: "Semua Program" },
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const CATEGORY_GRADIENTS = {
  SOP: "from-blue-600 to-indigo-700",
  Guidebook: "from-emerald-600 to-teal-700",
  Materi: "from-sky-600 to-cyan-700",
  Penilaian: "from-amber-500 to-orange-600",
  Kegiatan: "from-purple-600 to-pink-700",
  Lainnya: "from-slate-600 to-slate-800",
};

export default function Materi() {
  const user = getUser();
  const canManage = ["pengurus", "admin"].includes(user.role);
  const isAdmin = user.role === "admin";
  const [category, setCategory] = useState("");
  const [pid, setPid] = useState("");
  const [viewMode, setViewMode] = useState(user.role === "relawan" ? "grid" : "table");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    programId: "1",
    title: "",
    category: "Materi",
    docDate: "",
    description: "",
    externalUrl: "",
    visibleToVolunteer: true,
    active: true,
    versionNote: "",
  });
  const [file, setFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  const [versionsModal, setVersionsModal] = useState(null);
  const [versions, setVersions] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [settings, setSettings] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePreviewMaterial = (mat) => {
    if (mat.file_path) {
      setPreviewDoc({
        url: `${API_ENDPOINTS.MATERI.DOWNLOAD(mat.id)}?preview=1`,
        field: mat.category || "Materi",
        title: mat.title,
      });
    } else if (mat.external_url) {
      window.open(mat.external_url, "_blank");
    }
  };

  const t = usePaginated(API_ENDPOINTS.MATERI.LIST, { category, programId: pid });

  useEffect(() => {
    if (user.role === "relawan") {
      request("get", API_ENDPOINTS.SETTINGS).then((r) => setSettings(r?.data?.settings || null));
    }
  }, [user.role]);

  const openModal = (row = null) => {
    setFile(null);
    setCoverFile(null);
    setCoverPreview(row?.cover_image ? getAuthenticatedUrl(API_ENDPOINTS.MATERI.COVER(row.id)) : "");
    setModal(row || {});
    setForm({
      programId: row?.program_id ? String(row.program_id) : String(user.programId || "1"),
      title: row?.title || "",
      category: row?.category || "Materi",
      docDate: row?.doc_date || "",
      description: row?.description || "",
      externalUrl: row?.external_url || "",
      visibleToVolunteer: row ? !!row.visible_to_volunteer : true,
      active: row ? !!row.active : true,
      versionNote: "",
    });
  };

  const handleCoverChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setCoverFile(f);
      setCoverPreview(URL.createObjectURL(f));
    }
  };

  const openVersions = async (row) => {
    setVersionsModal(row);
    const r = await request("get", API_ENDPOINTS.MATERI.VERSIONS(row.id));
    setVersions(r?.data || []);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Judul materi wajib diisi");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append("file", file);
    if (coverFile) fd.append("cover", coverFile);

    setBusy(true);
    const r = modal?.id
      ? await request("put", API_ENDPOINTS.MATERI.DETAIL(modal.id), fd, { success: true })
      : await request("post", API_ENDPOINTS.MATERI.LIST, fd, { success: true });
    setBusy(false);
    if (r) {
      setModal(null);
      t.reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const r = await request("delete", API_ENDPOINTS.MATERI.DETAIL(deleteTarget.id), {}, { success: true });
    setBusy(false);
    if (r) {
      setDeleteTarget(null);
      t.reload();
    }
  };

  const materials = t.rows || t.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Pusat Materi & Panduan"
        subtitle="SOP, Guidebook, materi pelatihan CoreTax, rubrik penilaian, dan panduan dokumentasi penugasan relawan."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "grid" ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={14} /> Kartu Visual
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "table" ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <List size={14} /> Tabel
              </button>
            </div>

            {user.role === "relawan" && (
              <button type="button" className="btn-ghost" onClick={() => setInfoOpen(true)}>
                <Info size={17} className="text-brand" />
                Info Poin & Penilaian
              </button>
            )}

            {canManage && (
              <button type="button" className="btn" onClick={() => openModal(null)}>
                <Plus size={18} />
                Unggah Dokumen Baru
              </button>
            )}
          </div>
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

      {/* TAMPILAN KARTU VISUAL (COVER GRID) */}
      {viewMode === "grid" && (
        <div>
          {materials.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {materials.map((r) => {
                const grad = CATEGORY_GRADIENTS[r.category] || "from-slate-700 to-slate-900";
                return (
                  <div
                    key={r.id}
                    className="card flex flex-col overflow-hidden border border-slate-200/90 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    {/* Cover Image Area */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                      {r.cover_image ? (
                        <img
                          src={getAuthenticatedUrl(API_ENDPOINTS.MATERI.COVER(r.id))}
                          alt={r.title}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${grad} p-4 flex flex-col justify-between text-white`}>
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-sm">
                              {r.category}
                            </span>
                            <BookOpen size={20} className="text-white/60" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-white/80">{r.program_name}</div>
                            <div className="font-extrabold text-sm line-clamp-2 leading-snug mt-0.5">{r.title}</div>
                          </div>
                        </div>
                      )}

                      {/* Badges on top of cover */}
                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-slate-950/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm shadow">
                          {r.category}
                        </span>
                        <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-brand shadow">
                          v{r.version}
                        </span>
                      </div>

                      {canManage && (
                        <div className="absolute top-2.5 right-2.5 flex gap-1">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold shadow ${
                              r.visible_to_volunteer ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"
                            }`}
                          >
                            {r.visible_to_volunteer ? "Relawan" : "Pengurus"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold text-brand">{r.program_name}</div>
                        <h3 className="font-extrabold text-slate-900 text-sm line-clamp-2 leading-snug mt-0.5" title={r.title}>
                          {r.title}
                        </h3>
                        {r.description && (
                          <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {r.description}
                          </p>
                        )}
                        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Calendar size={12} />
                          <span>{r.doc_date || String(r.created_at || "").slice(0, 10)}</span>
                          <span>•</span>
                          <span>Oleh {r.uploader_name || "Admin"}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {r.file_path && (
                            <>
                              <button
                                type="button"
                                className="btn-ghost !rounded-xl !px-2.5 !py-1 text-xs text-brand hover:bg-brand-50"
                                onClick={() => handlePreviewMaterial(r)}
                                title="Pratinjau Dokumen"
                              >
                                <Eye size={13} /> Lihat
                              </button>
                              <button
                                type="button"
                                className="btn !rounded-xl !px-3 !py-1 text-xs"
                                onClick={() => downloadFile(API_ENDPOINTS.MATERI.DOWNLOAD(r.id), {}, r.title)}
                              >
                                <Download size={13} /> Unduh
                              </button>
                            </>
                          )}
                          {r.external_url && (
                            <a
                              href={r.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost !rounded-xl !px-2.5 !py-1 text-xs"
                            >
                              <ExternalLink size={13} /> Link
                            </a>
                          )}
                          <button
                            type="button"
                            title="Riwayat versi"
                            className="btn-ghost !rounded-xl !px-2 !py-1"
                            onClick={() => openVersions(r)}
                          >
                            <History size={14} />
                          </button>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Ubah / Versi Baru"
                              className="btn-ghost !p-1.5 !rounded-lg text-slate-600 hover:text-brand"
                              onClick={() => openModal(r)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              title="Hapus Materi"
                              className="btn-ghost !p-1.5 !rounded-lg text-rose-600 hover:!bg-rose-50"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-12 text-center text-slate-400 text-sm">
              Belum ada materi atau panduan pada kategori ini.
            </div>
          )}
        </div>
      )}

      {/* TAMPILAN TABEL */}
      {viewMode === "table" && (
        <DataTable
          t={t}
          searchPlaceholder="Cari judul atau deskripsi materi..."
          columns={[
            {
              label: "Sampul",
              render: (r) => (
                <div className="h-12 w-16 overflow-hidden rounded-lg bg-slate-100 shrink-0 border border-slate-200">
                  {r.cover_image ? (
                    <img src={getAuthenticatedUrl(API_ENDPOINTS.MATERI.COVER(r.id))} alt={r.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-brand-light text-brand">
                      <BookOpen size={16} />
                    </div>
                  )}
                </div>
              ),
            },
            {
              label: "Dokumen",
              render: (r) => (
                <div>
                  <div className="font-bold text-slate-900">{r.title}</div>
                  {r.description && <div className="mt-0.5 text-xs text-slate-500">{r.description}</div>}
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                    <span>v{r.version}</span>
                    <span>•</span>
                    <span>{r.program_name}</span>
                    {r.doc_date && (
                      <>
                        <span>•</span>
                        <span>{r.doc_date}</span>
                      </>
                    )}
                  </div>
                </div>
              ),
            },
            {
              label: "Kategori",
              render: (r) => (
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand ring-1 ring-brand/20">
                  {r.category}
                </span>
              ),
            },
            ...(canManage
              ? [
                  {
                    label: "Visibilitas",
                    render: (r) => (
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            r.visible_to_volunteer ? "text-emerald-700" : "text-slate-400"
                          }`}
                        >
                          {r.visible_to_volunteer ? <Eye size={13} /> : <EyeOff size={13} />}
                          {r.visible_to_volunteer ? "Tampil ke Relawan" : "Internal Pengurus"}
                        </span>
                        {!r.active && <span className="text-[11px] font-semibold text-rose-600">Nonaktif</span>}
                      </div>
                    ),
                  },
                ]
              : []),
            {
              label: "Akses",
              render: (r) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.file_path && (
                    <>
                      <button
                        type="button"
                        className="btn-ghost !rounded-lg !px-2.5 !py-1.5 text-xs text-brand hover:bg-brand-50"
                        onClick={() => handlePreviewMaterial(r)}
                        title="Pratinjau Dokumen"
                      >
                        <Eye size={13} />
                        Lihat
                      </button>
                      <button
                        type="button"
                        className="btn !rounded-lg !px-3 !py-1.5 text-xs"
                        onClick={() => downloadFile(API_ENDPOINTS.MATERI.DOWNLOAD(r.id), {}, r.title)}
                      >
                        <Download size={13} />
                        Unduh
                      </button>
                    </>
                  )}
                  {r.external_url && (
                    <a
                      href={r.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost !rounded-lg !px-3 !py-1.5 text-xs"
                    >
                      <ExternalLink size={13} />
                      Buka Link
                    </a>
                  )}
                  <button
                    type="button"
                    title="Riwayat versi"
                    className="btn-ghost !rounded-lg !px-2 !py-1.5"
                    onClick={() => openVersions(r)}
                  >
                    <History size={14} />
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        title="Ubah / unggah versi baru"
                        className="btn-ghost !rounded-lg !px-2 !py-1.5"
                        onClick={() => openModal(r)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Hapus materi"
                        className="btn-ghost !rounded-lg !px-2 !py-1.5 text-rose-600 hover:!bg-rose-50"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Modal Tambah / Edit Materi */}
      <Modal
        open={!!modal}
        title={modal?.id ? `Ubah / Versi Baru (Saat ini v${modal.version})` : "Unggah Materi & Panduan"}
        subtitle="Admin dapat mengunggah file materi dan gambar sampul (cover) sekaligus mengatur hak akses relawan."
        onClose={() => setModal(null)}
        maxWidth="max-w-xl"
      >
        <form onSubmit={save} className="space-y-4">
          {isAdmin && !modal?.id && (
            <div>
              <label className="label">Program *</label>
              <AppSelect
                isSearchable={false}
                options={PROGRAM_OPTIONS.slice(1)}
                value={form.programId}
                onChange={(val) => setForm({ ...form, programId: val })}
              />
            </div>
          )}

          <div>
            <label className="label">Judul Dokumen *</label>
            <input
              className="input"
              placeholder="Contoh: Modul Pelatihan CoreTax 2026"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Kategori *</label>
              <AppSelect
                isSearchable={false}
                options={FORM_CATEGORY_OPTIONS}
                value={form.category}
                onChange={(val) => setForm({ ...form, category: val })}
              />
            </div>
            <div>
              <label className="label">Tanggal Dokumen</label>
              <AppDatePicker value={form.docDate} onChange={(val) => setForm({ ...form, docDate: val })} isClearable />
            </div>
          </div>

          <div>
            <label className="label">Keterangan / Ringkasan Isi</label>
            <textarea
              className="input min-h-[72px]"
              placeholder="Deskripsi singkat mengenai isi panduan atau materi..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Unggah Cover / Gambar Sampul */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
            <label className="label !mb-0 font-bold flex items-center gap-1.5 text-slate-800">
              <ImageIcon size={15} className="text-brand" /> Cover / Gambar Sampul Dokumen (JPG / PNG / WebP)
            </label>
            <p className="text-xs text-slate-500">
              Cover akan ditampilkan pada kartu materi relawan agar visual lebih menarik dan mudah dikenali.
            </p>
            <input
              type="file"
              accept="image/*"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
              onChange={handleCoverChange}
            />
            {coverPreview && (
              <div className="mt-2 h-28 w-44 overflow-hidden rounded-xl border border-slate-200">
                <img src={coverPreview} alt="Preview cover" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="label">File Dokumen Materi (PDF / DOCX / XLSX)</label>
            <input
              type="file"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
          </div>

          <div>
            <label className="label">Atau Tautan Eksternal (Opsional)</label>
            <input
              className="input"
              type="url"
              placeholder="https://drive.google.com/..."
              value={form.externalUrl}
              onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
            />
          </div>

          {modal?.id && (
            <div>
              <label className="label">Catatan Pembaruan Versi (jika ganti file/link)</label>
              <input
                className="input"
                placeholder="Misal: Penyesuaian formulir CoreTax terbaru"
                value={form.versionNote}
                onChange={(e) => setForm({ ...form, versionNote: e.target.value })}
              />
            </div>
          )}

          {/* Pengaturan Hak Akses (Checkbox) */}
          <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 shadow-sm">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand focus:ring-brand"
                checked={form.visibleToVolunteer}
                onChange={(e) => setForm({ ...form, visibleToVolunteer: e.target.checked })}
              />
              Tampilkan ke Akun Relawan
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
              {busy ? "Menyimpan..." : "Simpan Materi"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Riwayat Versi */}
      <Modal open={!!versionsModal} title="Riwayat Versi Dokumen" subtitle={versionsModal?.title} onClose={() => setVersionsModal(null)}>
        <div className="space-y-2.5">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
              <div>
                <div className="font-bold text-slate-900">Versi {v.version} — {v.note || "Pembaruan"}</div>
                <div className="text-xs text-slate-500">Oleh {v.uploader_name} • {v.created_at}</div>
              </div>
              <div className="flex gap-1.5">
                {v.file_path && (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1 text-xs"
                    onClick={() => downloadFile(API_ENDPOINTS.MATERI.DOWNLOAD(versionsModal.id), { versionId: v.id }, `${versionsModal.title}_v${v.version}`)}
                  >
                    <Download size={13} /> Unduh
                  </button>
                )}
                {v.external_url && (
                  <a href={v.external_url} target="_blank" rel="noreferrer" className="btn-ghost !px-2.5 !py-1 text-xs">
                    <ExternalLink size={13} /> Link
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal Informasi Penilaian & Aturan (Relawan) */}
      <Modal
        open={infoOpen}
        title="Informasi Penilaian Relawan of the Month"
        subtitle={`Program ${user?.programName || ""}`}
        onClose={() => setInfoOpen(false)}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs text-slate-700">
          {settings ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-brand/20 bg-brand-50/60 p-4 space-y-1.5">
                <div className="font-bold text-brand text-sm">Komponen Penilaian Relawan of the Month</div>
                <p><strong>Pelayanan ({settings.weight_service}%):</strong> Rasio rata-rata WP per shift dibandingkan target bulanan ({settings.target_wp} WP).</p>
                <p><strong>Kehadiran ({settings.weight_attendance}%):</strong> Mengacu pada ketepatan waktu absensi masuk (Ontime: {settings.scores?.ontime} poin, Keterlambatan &gt;30 mnt: {settings.scores?.late30plus} poin).</p>
                <p><strong>Bonus Poin:</strong> Tambahan poin apresiasi (Pengganti +{settings.bonus?.pengganti}, Bantu +{settings.bonus?.bantu_kegiatan}, Konten +{settings.bonus?.konten}, Masukan +{settings.bonus?.masukan}).</p>
              </div>
            </div>
          ) : (
            <p>Memuat aturan penilaian...</p>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn" onClick={() => setInfoOpen(false)}>Mengerti</button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hapus Materi */}
      <Modal
        open={!!deleteTarget}
        title="Hapus Materi & Dokumen"
        subtitle={deleteTarget?.title}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Materi <strong>{deleteTarget?.title}</strong> beserta file sampul dan riwayat seluruh versinya akan dihapus permanen dari server. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
            <button type="button" className="btn-danger" disabled={busy} onClick={confirmDelete}>
              {busy ? "Menghapus..." : "Ya, Hapus Materi"}
            </button>
          </div>
        </div>
      </Modal>

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
