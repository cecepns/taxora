import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Award, BookOpen, Download, ExternalLink, Eye, EyeOff, History, Info, Pencil, Plus, Trash2 } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import AppDatePicker from "@/components/AppDatePicker";
import usePaginated from "@/hooks/usePaginated";
import { downloadFile, request } from "@/utils/request";
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

export default function Materi() {
  const user = getUser();
  const canManage = ["pengurus", "admin"].includes(user.role);
  const isAdmin = user.role === "admin";
  const [category, setCategory] = useState("");
  const [pid, setPid] = useState("");
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
  const [versionsModal, setVersionsModal] = useState(null);
  const [versions, setVersions] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [settings, setSettings] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const t = usePaginated(API_ENDPOINTS.MATERI.LIST, { category, programId: pid });

  useEffect(() => {
    if (user.role === "relawan") {
      request("get", API_ENDPOINTS.SETTINGS).then((r) => setSettings(r?.data?.settings || null));
    }
  }, [user.role]);

  const openModal = (row = null) => {
    setFile(null);
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Pusat Materi & Panduan"
        subtitle="SOP, Guidebook, materi pelatihan, rubrik penilaian, dan dokumentasi kegiatan per program."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user.role === "relawan" && (
              <button type="button" className="btn-ghost" onClick={() => setInfoOpen(true)}>
                <Info size={17} className="text-brand" />
                Informasi Penilaian & Aturan
              </button>
            )}
            {canManage && (
              <button type="button" className="btn" onClick={() => openModal(null)}>
                <Plus size={18} />
                Unggah Materi
              </button>
            )}
          </div>
        }
      />

      <DataTable
        t={t}
        searchPlaceholder="Cari judul atau deskripsi materi..."
        toolbar={
          <>
            {isAdmin && (
              <div className="w-full md:w-44">
                <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={pid} onChange={setPid} />
              </div>
            )}
            <div className="w-full md:w-48">
              <AppSelect size="sm" isSearchable={false} options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
            </div>
          </>
        }
        columns={[
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
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${r.visible_to_volunteer ? "text-emerald-700" : "text-slate-400"}`}>
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
                  <button
                    type="button"
                    className="btn !rounded-lg !px-3 !py-1.5 text-xs"
                    onClick={() => downloadFile(API_ENDPOINTS.MATERI.DOWNLOAD(r.id), {}, r.title)}
                  >
                    <Download size={13} />
                    Unduh
                  </button>
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
                      className="btn-ghost !rounded-lg !px-2 !py-1.5 text-rose-600 hover:!bg-rose-50 hover:!text-rose-700 hover:!ring-rose-200"
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

      {/* Modal Tambah / Edit Materi */}
      <Modal
        open={!!modal}
        title={modal?.id ? `Ubah / Versi Baru (Saat ini v${modal.version})` : "Unggah Materi & Panduan"}
        subtitle="Versi lama otomatis tersimpan apabila Anda mengunggah file/tautan baru."
        onClose={() => setModal(null)}
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
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
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
            <label className="label">Keterangan</label>
            <textarea className="input min-h-[76px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <label className="label">Unggah File (PDF / DOCX / XLSX / Gambar)</label>
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
              <input className="input" placeholder="Misal: Revisi format BPE 2026" value={form.versionNote} onChange={(e) => setForm({ ...form, versionNote: e.target.value })} />
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium">
              <input type="checkbox" checked={form.visibleToVolunteer} onChange={(e) => setForm({ ...form, visibleToVolunteer: e.target.checked })} />
              Tampil ke relawan
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Status aktif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button>
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
        title="Informasi Penilaian & Aturan"
        subtitle={`Program ${user.programName || "Relawan"}`}
        onClose={() => setInfoOpen(false)}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {settings && (
            <div className="rounded-2xl border border-brand/20 bg-brand-50/60 p-4">
              <div className="mb-2.5 flex items-center gap-2 text-brand">
                <Award size={19} />
                <h4 className="font-bold">Cara Penilaian Relawan of the Month</h4>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="rounded-xl bg-white/80 p-3">
                  <strong className="text-slate-900">A. Kinerja Pelayanan (maks {settings.weight_service}):</strong>{" "}
                  (Rata-rata WP/shift ÷ {settings.target_wp}) × {settings.weight_service}.
                </li>
                <li className="rounded-xl bg-white/80 p-3">
                  <strong className="text-slate-900">B. Kehadiran & Ketepatan Waktu (maks {settings.weight_attendance}):</strong>{" "}
                  Tepat waktu/≤{settings.late_limit_min} mnt ({settings.scores?.ontime}), 11–20 mnt ({settings.scores?.late11_20}),
                  21–30 mnt ({settings.scores?.late21_30}), &gt;30 mnt ({settings.scores?.late30plus}), Tidak hadir ({settings.scores?.absent ?? 0}).
                </li>
                <li className="rounded-xl bg-white/80 p-3">
                  <strong className="text-slate-900">C. Bonus Poin Apresiasi:</strong> Menggantikan (+{settings.bonus?.pengganti}),
                  Bantu kegiatan (+{settings.bonus?.bantu_kegiatan}), Konten (+{settings.bonus?.konten}), Masukan (+{settings.bonus?.masukan}).
                </li>
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-amber-800">
              <Info size={19} />
              <h4 className="font-bold">Aturan Konfirmasi Lupa Presensi</h4>
            </div>
            <p className="text-sm leading-relaxed text-amber-900">
              Jika lupa presensi saat bertugas, relawan wajib melapor dan mengirim bukti kepada pengurus maksimal{" "}
              <strong>1 × 24 jam</strong> setelah jadwal berakhir. Lewat dari batas waktu tersebut, kehadiran dianggap
              tidak tercatat dan tidak dihitung dalam penilaian bulanan.
            </p>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn" onClick={() => setInfoOpen(false)}>
              Mengerti
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hapus Materi */}
      <Modal
        open={!!deleteTarget}
        title="Hapus Materi & Panduan"
        subtitle={deleteTarget ? `${deleteTarget.title} (${deleteTarget.category} • v${deleteTarget.version})` : ""}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs leading-relaxed text-rose-800">
            Dokumen ini beserta seluruh riwayat versi dan file unggahannya akan <strong>dihapus permanen dari server</strong>.
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
            <button type="button" className="btn-danger" disabled={busy} onClick={confirmDelete}>
              <Trash2 size={15} />
              {busy ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
