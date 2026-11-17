import { useState } from "react";
import toast from "react-hot-toast";
import { GraduationCap, Pencil, Plus, Trash2, Users } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";

export default function Prodi() {
  const t = usePaginated(API_ENDPOINTS.PRODI.LIST);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", active: true });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const openModal = (row = null) => {
    setModal(row || {});
    setForm({ name: row?.name || "", active: row ? !!row.active : true });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Nama Program Studi wajib diisi");
    setBusy(true);
    const r = modal?.id
      ? await request("put", API_ENDPOINTS.PRODI.DETAIL(modal.id), { name: form.name.trim(), active: form.active }, { success: true })
      : await request("post", API_ENDPOINTS.PRODI.LIST, { name: form.name.trim() }, { success: true });
    setBusy(false);
    if (r) {
      setModal(null);
      t.reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const r = await request("delete", API_ENDPOINTS.PRODI.DETAIL(deleteTarget.id), {}, { success: true });
    setBusy(false);
    if (r) {
      setDeleteTarget(null);
      t.reload();
    }
  };

  return (
    <div>
      <PageHeader
        icon={GraduationCap}
        title="Program Studi"
        subtitle="Kelola master daftar Program Studi yang digunakan pada pendaftaran dan profil relawan."
        actions={
          <button type="button" className="btn" onClick={() => openModal(null)}>
            <Plus size={18} />
            Tambah Prodi
          </button>
        }
      />

      <DataTable
        t={t}
        searchPlaceholder="Cari nama Program Studi..."
        empty="Belum ada data Program Studi"
        columns={[
          {
            label: "Nama Program Studi",
            render: (r) => <span className="font-semibold text-slate-900">{r.name}</span>,
          },
          {
            label: "Jumlah Relawan",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand">
                <Users size={12} />
                {r.relawan_count ?? 0} relawan
              </span>
            ),
          },
          {
            label: "Status",
            tdClassName: "whitespace-nowrap",
            render: (r) =>
              r.active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Nonaktif
                </span>
              ),
          },
          {
            label: "Aksi",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Ubah Program Studi"
                  className="btn-ghost !rounded-lg !px-2.5 !py-1.5"
                  onClick={() => openModal(r)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Hapus Program Studi"
                  className="btn-ghost !rounded-lg !px-2.5 !py-1.5 text-rose-600 hover:!bg-rose-50 hover:!text-rose-700 hover:!ring-rose-200"
                  onClick={() => setDeleteTarget(r)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={!!modal}
        title={modal?.id ? "Ubah Program Studi" : "Tambah Program Studi"}
        subtitle={modal?.id ? "Perubahan nama otomatis disinkronkan ke relawan terkait." : "Program Studi baru langsung tersedia di pilihan pendaftaran relawan."}
        onClose={() => setModal(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Nama Program Studi *</label>
            <input
              className="input"
              placeholder="Contoh: D-IV Akuntansi Sektor Publik"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </div>
          {modal?.id && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Aktif (tampil di pilihan pendaftaran relawan)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Hapus Program Studi"
        subtitle={deleteTarget?.name}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin menghapus Program Studi <strong>{deleteTarget?.name}</strong> dari daftar master?
          </p>
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
