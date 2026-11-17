import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { KeyRound, Lock, Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "Semua Peran" },
  { value: "admin", label: "Admin Pusat" },
  { value: "pengurus", label: "Pengurus" },
  { value: "koordinator", label: "Koordinator" },
  { value: "relawan", label: "Relawan" },
];

const ROLE_FORM_OPTIONS = ROLE_FILTER_OPTIONS.slice(1);

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Nonaktif" },
  { value: "terkunci", label: "Terkunci" },
];

const PROGRAM_OPTIONS = [
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const ROLE_BADGE = {
  admin: "bg-purple-50 text-purple-700 ring-purple-200",
  pengurus: "bg-brand-50 text-brand ring-brand/20",
  koordinator: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  relawan: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function Users() {
  const me = getUser();
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const t = usePaginated(API_ENDPOINTS.USERS.LIST, { role: roleFilter, status: statusFilter });

  const [prodiOptions, setProdiOptions] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    nim: "",
    name: "",
    role: "admin",
    programId: "",
    prodi: "",
    password: "",
    active: true,
    reason: "",
  });

  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request("get", API_ENDPOINTS.PRODI.OPTIONS).then((r) => {
      if (r?.data) setProdiOptions(r.data.map((p) => ({ value: p.name, label: p.name })));
    });
  }, []);

  const openModal = (row = null) => {
    setModal(row || {});
    setForm({
      nim: row?.nim || "",
      name: row?.name || "",
      role: row?.role || "admin",
      programId: row?.program_id ? String(row.program_id) : "",
      prodi: row?.prodi || "",
      password: "",
      active: row ? !!row.active : true,
      reason: "",
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.nim.trim() || !form.name.trim()) return toast.error("Username/NIM dan nama wajib diisi");
    if (form.role !== "admin" && !form.programId && !modal?.id) return toast.error("Program wajib dipilih untuk peran non-Admin");
    if (!modal?.id && form.password && form.password.length < 10) return toast.error("Password minimal 10 karakter");

    setBusy(true);
    const r = modal?.id
      ? await request(
          "put",
          API_ENDPOINTS.USERS.DETAIL(modal.id),
          {
            name: form.name,
            role: form.role,
            prodi: form.prodi,
            active: form.active,
            programId: form.role !== "admin" ? form.programId : undefined,
            reason: form.reason,
          },
          { success: true }
        )
      : await request(
          "post",
          API_ENDPOINTS.USERS.LIST,
          {
            nim: form.nim,
            name: form.name,
            role: form.role,
            prodi: form.prodi,
            password: form.password,
            programId: form.role !== "admin" ? form.programId : undefined,
          },
          { success: true }
        );
    setBusy(false);
    if (r) {
      setModal(null);
      t.reload();
    }
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (newPassword && newPassword.length < 10) return toast.error("Password baru minimal 10 karakter");
    setBusy(true);
    const r = await request(
      "post",
      API_ENDPOINTS.USERS.RESET(resetTarget.id),
      { newPassword: newPassword.trim() },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setResetTarget(null);
      setNewPassword("");
      t.reload();
    }
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setBusy(true);
    const r = await request(
      "delete",
      API_ENDPOINTS.USERS.DETAIL(deleteTarget.id),
      { reason: deleteReason.trim() || "Hapus akun user" },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setDeleteTarget(null);
      setDeleteReason("");
      t.reload();
    }
  };

  return (
    <div>
      <PageHeader
        icon={UserCog}
        title="Manajemen Users"
        subtitle="Kelola seluruh akun Admin Pusat, Pengurus, Koordinator, dan Relawan — termasuk menambah lebih dari 1 Admin."
        actions={
          <button type="button" className="btn" onClick={() => openModal(null)}>
            <Plus size={18} />
            Tambah User
          </button>
        }
      />

      <DataTable
        t={t}
        searchPlaceholder="Cari username/NIM, nama, atau prodi..."
        toolbar={
          <>
            <div className="w-full md:w-44">
              <AppSelect size="sm" isSearchable={false} options={ROLE_FILTER_OPTIONS} value={roleFilter} onChange={setRoleFilter} />
            </div>
            <div className="w-full md:w-40">
              <AppSelect size="sm" isSearchable={false} options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            </div>
          </>
        }
        columns={[
          {
            label: "Username / NIM",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="font-mono text-xs font-semibold text-slate-700">
                {r.nim}
                {r.id === me.id && (
                  <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 font-sans text-[10px] font-bold text-brand">
                    Anda
                  </span>
                )}
              </span>
            ),
          },
          {
            label: "Nama",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-900">{r.name}</div>
                {r.prodi && <div className="text-[11px] text-slate-400">{r.prodi}</div>}
              </div>
            ),
          },
          {
            label: "Peran",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${ROLE_BADGE[r.role] || ROLE_BADGE.relawan}`}>
                <ShieldCheck size={12} />
                {r.role === "admin" ? "Admin Pusat" : r.role}
              </span>
            ),
          },
          {
            label: "Program",
            render: (r) => (
              <span className="text-xs font-medium text-slate-600">
                {r.role === "admin" ? "Semua Program" : r.programs || "-"}
              </span>
            ),
          },
          {
            label: "Status",
            tdClassName: "whitespace-nowrap",
            render: (r) =>
              r.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                  <Lock size={11} /> Terkunci
                </span>
              ) : r.active ? (
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
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Ubah user"
                  className="btn-ghost !rounded-lg !px-2.5 !py-1.5"
                  onClick={() => openModal(r)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Reset password / buka kunci"
                  className="btn-ghost !rounded-lg !px-2.5 !py-1.5 hover:!bg-amber-50 hover:!text-amber-700 hover:!ring-amber-200"
                  onClick={() => {
                    setNewPassword("");
                    setResetTarget(r);
                  }}
                >
                  <KeyRound size={14} />
                </button>
                {r.id !== me.id && (
                  <button
                    type="button"
                    title="Hapus user"
                    className="btn-ghost !rounded-lg !px-2.5 !py-1.5 text-rose-600 hover:!bg-rose-50 hover:!text-rose-700 hover:!ring-rose-200"
                    onClick={() => {
                      setDeleteReason("");
                      setDeleteTarget(r);
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

      {/* Modal Tambah / Edit User */}
      <Modal
        open={!!modal}
        title={modal?.id ? "Ubah Data User" : "Tambah User Baru"}
        subtitle={modal?.id ? `Username / NIM: ${modal.nim}` : "Bisa digunakan untuk menambah Admin Pusat tambahan, Pengurus, Koordinator, atau Relawan."}
        onClose={() => setModal(null)}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Username / NIM *</label>
              <input
                className="input"
                placeholder="Contoh: admin2 atau 41220001"
                value={form.nim}
                onChange={(e) => setForm({ ...form, nim: e.target.value })}
                required
                disabled={!!modal?.id}
              />
            </div>
            <div>
              <label className="label">Peran *</label>
              <AppSelect
                isSearchable={false}
                options={ROLE_FORM_OPTIONS}
                value={form.role}
                onChange={(val) => setForm({ ...form, role: val })}
                isDisabled={modal?.id === me.id}
              />
            </div>
          </div>

          <div>
            <label className="label">Nama Lengkap *</label>
            <input
              className="input"
              placeholder="Masukkan nama lengkap"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          {form.role !== "admin" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Program {modal?.id ? "(opsional)" : "*"}</label>
                <AppSelect
                  isSearchable={false}
                  options={PROGRAM_OPTIONS}
                  value={form.programId}
                  onChange={(val) => setForm({ ...form, programId: val })}
                  placeholder="Pilih program..."
                />
              </div>
              <div>
                <label className="label">Program Studi</label>
                <AppSelect
                  isClearable
                  options={prodiOptions}
                  value={form.prodi}
                  onChange={(val) => setForm({ ...form, prodi: val })}
                  placeholder="Pilih prodi..."
                />
              </div>
            </div>
          )}

          {!modal?.id && (
            <div>
              <label className="label">
                Password{" "}
                <span className="font-normal text-slate-400">(opsional, min. 10 karakter — kosongkan untuk default NIM@taxora)</span>
              </label>
              <input
                className="input"
                type="password"
                placeholder="Kosongkan untuk default <username>@taxora"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          )}

          {modal?.id && (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={modal.id === me.id}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Akun aktif
              </label>
              <div>
                <label className="label">Alasan Perubahan (opsional)</label>
                <input
                  className="input"
                  placeholder="Catatan perubahan data user"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Reset Password & Buka Kunci */}
      <Modal
        open={!!resetTarget}
        title="Reset Password & Buka Kunci"
        subtitle={resetTarget ? `${resetTarget.name} (${resetTarget.nim})` : ""}
        onClose={() => setResetTarget(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={confirmReset} className="space-y-4">
          <div>
            <label className="label">
              Password Baru{" "}
              <span className="font-normal text-slate-400">(kosongkan untuk reset ke {resetTarget?.nim}@taxora)</span>
            </label>
            <input
              className="input"
              type="password"
              placeholder="Minimal 10 karakter atau biarkan kosong"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setResetTarget(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>
              <KeyRound size={15} />
              {busy ? "Memproses..." : "Reset & Buka Kunci"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus User */}
      <Modal
        open={!!deleteTarget}
        title="Hapus Akun User"
        subtitle={deleteTarget ? `${deleteTarget.name} (${deleteTarget.nim}) • ${deleteTarget.role}` : ""}
        onClose={() => setDeleteTarget(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={confirmDelete} className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs leading-relaxed text-rose-800">
            Akun user ini beserta data terkaitnya akan <strong>dihapus permanen</strong>.
          </div>
          <div>
            <label className="label">Alasan Penghapusan *</label>
            <input
              className="input"
              placeholder="Tuliskan alasan penghapusan akun"
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
