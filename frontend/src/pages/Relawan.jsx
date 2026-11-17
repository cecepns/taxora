import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, KeyRound, Lock, Pencil, Plus, ShieldCheck, Trash2, Upload, Users } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { downloadRelawanTemplate, parseRelawanExcelFile } from "@/utils/exporters";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const PROGRAM_OPTIONS = [
  { value: "", label: "Semua Program" },
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const ROLE_OPTIONS = [
  { value: "relawan", label: "Relawan" },
  { value: "koordinator", label: "Koordinator" },
  { value: "pengurus", label: "Pengurus" },
];

const ROLE_BADGE = {
  admin: "bg-purple-50 text-purple-700 ring-purple-200",
  pengurus: "bg-brand-50 text-brand ring-brand/20",
  koordinator: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  relawan: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function Relawan() {
  const user = getUser();
  const admin = user.role === "admin";
  const curYear = new Date().getFullYear();
  const YEAR_OPTIONS = [curYear + 1, curYear, curYear - 1, curYear - 2].map((y) => ({ value: String(y), label: `Tahun ${y}` }));

  const [year, setYear] = useState(String(curYear));
  const [pid, setPid] = useState("");
  const t = usePaginated(API_ENDPOINTS.RELAWAN.LIST, { year, programId: pid });

  const [m, setM] = useState(null);
  const [form, setForm] = useState({ nim: "", name: "", prodi: "", programId: "", role: "relawan", active: true, reason: "" });
  const [prodiOptions, setProdiOptions] = useState([]);
  const [creatingProdi, setCreatingProdi] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProdi = async () => {
    const r = await request("get", API_ENDPOINTS.PRODI.OPTIONS);
    if (r?.data) setProdiOptions(r.data.map((p) => ({ value: p.name, label: p.name })));
  };

  useEffect(() => {
    loadProdi();
  }, []);

  const handleCreateProdi = async (inputValue) => {
    const name = inputValue.trim();
    if (!name) return;
    setCreatingProdi(true);
    const r = await request("post", API_ENDPOINTS.PRODI.LIST, { name }, { success: true });
    setCreatingProdi(false);
    if (r?.data?.name) {
      await loadProdi();
      setForm((prev) => ({ ...prev, prodi: r.data.name }));
    }
  };

  const openForm = (row = null) => {
    setM(row || {});
    setForm({
      nim: row?.nim || "",
      name: row?.name || "",
      prodi: row?.prodi || "",
      programId: row?.program_id ? String(row.program_id) : "",
      role: row?.role || "relawan",
      active: row ? !!row.active : true,
      reason: "",
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!m?.id && admin && !form.programId) return toast.error("Pilih program terlebih dahulu");
    setBusy(true);
    const body = m?.id
      ? { name: form.name, prodi: form.prodi, active: form.active, reason: form.reason }
      : { nim: form.nim, name: form.name, prodi: form.prodi, programId: form.programId, role: form.role, year: Number(year) };

    const r = m?.id
      ? await request("put", API_ENDPOINTS.RELAWAN.DETAIL(m.id), body)
      : await request("post", API_ENDPOINTS.RELAWAN.LIST, body, { success: true });
    setBusy(false);
    if (r) {
      if (m?.id) toast.success("Data relawan diperbarui");
      setM(null);
      t.reload();
    }
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.RELAWAN.RESET(resetTarget.id), {}, { success: true });
    setBusy(false);
    if (r) {
      setResetTarget(null);
      t.reload();
    }
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setBusy(true);
    const r = await request(
      "delete",
      API_ENDPOINTS.RELAWAN.DETAIL(deleteTarget.id),
      { programId: deleteTarget.program_id, year: Number(year), reason: deleteReason.trim() || "Hapus relawan" },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setDeleteTarget(null);
      setDeleteReason("");
      t.reload();
    }
  };

  const runPreview = async () => {
    if (!importFile) return toast.error("Pilih file Excel/CSV terlebih dahulu");
    setBusy(true);
    try {
      const parsedRows = await parseRelawanExcelFile(importFile);
      const r = await request("post", API_ENDPOINTS.RELAWAN.IMPORT_PREVIEW, { year: Number(year), rows: parsedRows });
      if (r?.data) setImportPreview(r.data);
    } catch (err) {
      toast.error(err?.message || "Gagal membaca file Excel/CSV");
    } finally {
      setBusy(false);
    }
  };

  const commitImport = async () => {
    if (!importPreview?.rows?.length) return;
    setBusy(true);
    const r = await request(
      "post",
      API_ENDPOINTS.RELAWAN.IMPORT_COMMIT,
      { year: Number(year), rows: importPreview.rows, deactivateMissing },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setImportOpen(false);
      setImportPreview(null);
      setImportFile(null);
      t.reload();
    }
  };

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Manajemen Relawan"
        subtitle="Kelola data akun relawan, koordinator, pengurus, impor massal Excel dengan pratinjau, serta reset password."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={downloadRelawanTemplate}
            >
              <Download size={16} />
              Template Excel
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setImportFile(null);
                setImportPreview(null);
                setDeactivateMissing(false);
                setImportOpen(true);
              }}
            >
              <FileSpreadsheet size={16} />
              Impor Excel
            </button>
            <button type="button" className="btn" onClick={() => openForm(null)}>
              <Plus size={18} />
              Tambah Relawan
            </button>
          </div>
        }
      />

      <DataTable
        t={t}
        searchPlaceholder="Cari NIM, nama, atau prodi..."
        toolbar={
          <>
            {admin && (
              <div className="w-full md:w-44">
                <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={pid} onChange={setPid} />
              </div>
            )}
            <div className="w-full md:w-36">
              <AppSelect size="sm" isSearchable={false} options={YEAR_OPTIONS} value={year} onChange={setYear} />
            </div>
          </>
        }
        columns={[
          { label: "NIM", render: (r) => <span className="font-mono text-xs font-semibold text-slate-700">{r.nim}</span> },
          {
            label: "Nama",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-900">{r.name}</div>
                {admin && <div className="text-[11px] text-slate-400">{r.program_name}</div>}
              </div>
            ),
          },
          { label: "Prodi", render: (r) => r.prodi || "-" },
          {
            label: "Peran",
            render: (r) => (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${ROLE_BADGE[r.role] || ROLE_BADGE.relawan}`}>
                <ShieldCheck size={12} />
                {r.role}
              </span>
            ),
          },
          {
            label: "Status",
            render: (r) =>
              r.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                  <Lock size={11} /> Terkunci
                </span>
              ) : r.active && r.membership_active !== 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Nonaktif
                </span>
              ),
          },
          {
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button type="button" title="Ubah data" className="btn-ghost !rounded-lg !px-2.5 !py-1.5" onClick={() => openForm(r)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Reset password / buka kunci"
                  className="btn-ghost !rounded-lg !px-2.5 !py-1.5 hover:!bg-amber-50 hover:!text-amber-700 hover:!ring-amber-200"
                  onClick={() => setResetTarget(r)}
                >
                  <KeyRound size={14} />
                </button>
                <button
                  type="button"
                  title="Hapus relawan"
                  className="btn-ghost !rounded-lg !px-2.5 !py-1.5 text-rose-600 hover:!bg-rose-50 hover:!text-rose-700 hover:!ring-rose-200"
                  onClick={() => {
                    setDeleteReason("");
                    setDeleteTarget(r);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Modal Tambah/Ubah Relawan */}
      <Modal
        open={!!m}
        title={m?.id ? "Ubah Data Relawan" : "Tambah Relawan Baru"}
        subtitle={m?.id ? `NIM: ${m.nim}` : "Password awal otomatis menggunakan NIM + @taxora"}
        onClose={() => setM(null)}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">NIM *</label>
            <input className="input" placeholder="Masukkan NIM" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} required disabled={!!m?.id} />
          </div>
          <div>
            <label className="label">Nama Lengkap *</label>
            <input className="input" placeholder="Masukkan nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">
              Program Studi{" "}
              {admin && <span className="font-normal text-slate-400">(pilih atau ketik untuk tambah baru)</span>}
            </label>
            <AppSelect
              options={prodiOptions}
              value={form.prodi}
              onChange={(val) => setForm({ ...form, prodi: val })}
              isClearable
              isCreatable={admin}
              isLoading={creatingProdi}
              onCreateOption={handleCreateProdi}
              placeholder={admin ? "Pilih atau ketik Program Studi baru..." : "Pilih Program Studi..."}
            />
          </div>

          {admin && !m?.id && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Program *</label>
                <AppSelect options={PROGRAM_OPTIONS.slice(1)} value={form.programId} onChange={(val) => setForm({ ...form, programId: val })} placeholder="Pilih program" isSearchable={false} />
              </div>
              <div>
                <label className="label">Peran *</label>
                <AppSelect options={ROLE_OPTIONS} value={form.role} onChange={(val) => setForm({ ...form, role: val })} placeholder="Pilih peran" isSearchable={false} />
              </div>
            </div>
          )}

          {m?.id && (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Akun aktif
              </label>
              <div>
                <label className="label">Alasan Perubahan *</label>
                <input className="input" placeholder="Jelaskan alasan perubahan data" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setM(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Impor Excel Massal dengan Pratinjau (Bagian 3 & 5.4) */}
      <Modal
        open={importOpen}
        title={`Impor Excel Relawan — Tahun ${year}`}
        subtitle="Sistem mengenali relawan lama lewat NIM agar tidak dobel dan riwayat tahun lalu tetap terhubung."
        onClose={() => setImportOpen(false)}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="input flex-1 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand"
              onChange={(e) => {
                setImportFile(e.target.files[0] || null);
                setImportPreview(null);
              }}
            />
            <button type="button" className="btn" disabled={busy || !importFile} onClick={runPreview}>
              <Upload size={15} />
              Pratinjau
            </button>
          </div>

          {importPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {[
                  ["Total Baris", importPreview.summary.total, "bg-slate-100 text-slate-800"],
                  ["Valid", importPreview.summary.valid, "bg-emerald-50 text-emerald-800"],
                  ["Relawan Lama", importPreview.summary.existing, "bg-sky-50 text-sky-800"],
                  ["Ganda", importPreview.summary.duplicate, "bg-amber-50 text-amber-800"],
                  ["Error", importPreview.summary.error, "bg-rose-50 text-rose-800"],
                ].map(([l, v, cls]) => (
                  <div key={l} className={`rounded-xl p-3 text-center ${cls}`}>
                    <div className="text-lg font-extrabold">{v}</div>
                    <div className="text-[11px] font-semibold">{l}</div>
                  </div>
                ))}
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-brand-50 font-bold text-brand">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">NIM</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Program</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.rows.map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="px-3 py-2 text-slate-400">{r.rowNumber}</td>
                        <td className="px-3 py-2 font-mono">{r.nim}</td>
                        <td className="px-3 py-2 font-semibold">{r.name}</td>
                        <td className="px-3 py-2">{r.programName}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${r.status === "valid" ? "bg-emerald-50 text-emerald-700" : r.status === "duplicate" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                            }`}>
                            {r.message}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
                <input type="checkbox" checked={deactivateMissing} onChange={(e) => setDeactivateMissing(e.target.checked)} />
                Otomatis nonaktifkan relawan tahun {year} yang tidak tercantum di file ini (data tidak dihapus)
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setImportOpen(false)}>Batal</button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || importPreview.summary.valid === 0}
                  onClick={commitImport}
                >
                  {busy ? "Menyimpan..." : `Setujui & Simpan (${importPreview.summary.valid} baris valid)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        open={!!resetTarget}
        title="Reset Password & Buka Kunci"
        subtitle={resetTarget ? `${resetTarget.name} (${resetTarget.nim})` : ""}
        onClose={() => setResetTarget(null)}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Password akun ini akan diatur ulang ke <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-brand">{resetTarget?.nim}@taxora</code> dan status kunci akun akan dibuka.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setResetTarget(null)}>Batal</button>
            <button type="button" className="btn" disabled={busy} onClick={confirmReset}>
              <KeyRound size={15} />
              {busy ? "Memproses..." : "Ya, Reset Password"}
            </button>
          </div>
        </div>
      </Modal>
      {/* Modal Hapus Relawan */}
      <Modal
        open={!!deleteTarget}
        title="Hapus Relawan"
        subtitle={deleteTarget ? `${deleteTarget.name} (${deleteTarget.nim}) • ${deleteTarget.program_name || ""}` : ""}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={confirmDelete} className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs leading-relaxed text-rose-800">
            Data keanggotaan relawan pada periode <strong>{year}</strong> akan dihapus. Jika relawan tidak terdaftar di program/periode lain, akun serta data terkaitnya juga akan dihapus permanen.
          </div>
          <div>
            <label className="label">Alasan Penghapusan *</label>
            <input
              className="input"
              placeholder="Contoh: Salah input data / mengundurkan diri"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Batal</button>
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
