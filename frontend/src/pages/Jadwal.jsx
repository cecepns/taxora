import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, Clock, FileBadge, Plus, Users } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import AppDatePicker from "@/components/AppDatePicker";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
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

const INITIAL_FORM = {
  programId: "",
  suratTugasNo: "",
  title: "",
  date: "",
  sessionNo: "1",
  startTime: "",
  endTime: "",
  userIds: [],
};

export default function Jadwal() {
  const admin = getUser().role === "admin";
  const curYear = new Date().getFullYear();
  const YEAR_OPTIONS = [curYear + 1, curYear, curYear - 1, curYear - 2].map((y) => ({ value: String(y), label: `Tahun ${y}` }));

  const [year, setYear] = useState(String(curYear));
  const [month, setMonth] = useState("");
  const [pid, setPid] = useState("");
  const t = usePaginated(API_ENDPOINTS.JADWAL.LIST, { year, month, programId: pid });

  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      request("get", API_ENDPOINTS.RELAWAN.LIST, { limit: 100, year, programId: form.programId || undefined }).then((r) =>
        setPeople(r?.data || [])
      );
    }
  }, [open, year, form.programId]);

  const peopleOptions = people.map((p) => ({
    value: p.id,
    label: `${p.nim} — ${p.name}`,
  }));

  const openModal = () => {
    setForm(INITIAL_FORM);
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (admin && !form.programId) return toast.error("Pilih program terlebih dahulu");
    if (!form.date) return toast.error("Tanggal sesi wajib dipilih");
    if (!form.startTime || !form.endTime) return toast.error("Jam mulai dan selesai wajib diisi");

    setBusy(true);
    const payload = { ...form, userIds: form.userIds.map(Number) };
    const r = await request("post", API_ENDPOINTS.JADWAL.LIST, payload);
    setBusy(false);
    if (r) {
      toast.success("Jadwal & surat tugas dibuat");
      setOpen(false);
      t.reload();
    }
  };

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Jadwal & Surat Tugas"
        subtitle="Kelola surat tugas bulanan, jam sesi yang fleksibel, serta penugasan relawan."
        actions={
          <button type="button" className="btn" onClick={openModal}>
            <Plus size={18} />
            Buat Jadwal
          </button>
        }
      />

      <DataTable
        t={t}
        searchPlaceholder="Cari nama kegiatan atau nomor surat tugas..."
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
            <div className="w-full md:w-44">
              <AppSelect size="sm" isSearchable={false} options={MONTHS} value={month} onChange={setMonth} />
            </div>
          </>
        }
        columns={[
          {
            label: "Tanggal",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-slate-800">
                <CalendarDays size={14} className="shrink-0 text-brand" />
                {r.date}
              </span>
            ),
          },
          {
            label: "Surat Tugas",
            tdClassName: "whitespace-nowrap",
            render: (r) =>
              r.surat_tugas_no ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                  <FileBadge size={12} className="shrink-0 text-brand" />
                  {r.surat_tugas_no}
                </span>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              ),
          },
          {
            label: "Sesi",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">
                Sesi {r.session_no}
              </span>
            ),
          },
          {
            label: "Jam",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                <Clock size={14} className="shrink-0 text-slate-400" />
                {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
              </span>
            ),
          },
          {
            label: "Kegiatan",
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-800">{r.title || "-"}</div>
                {admin && <div className="text-[11px] text-slate-400">{r.program_name}</div>}
              </div>
            ),
          },
          {
            label: "Petugas",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                <Users size={13} className="shrink-0 text-brand" />
                {r.crew} orang
              </span>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title="Buat Jadwal & Surat Tugas"
        subtitle="Jam sesi dapat berbeda untuk setiap surat tugas."
        onClose={() => setOpen(false)}
      >
        <form onSubmit={save} className="space-y-4">
          {admin && (
            <div>
              <label className="label">Program *</label>
              <AppSelect
                options={PROGRAM_OPTIONS.slice(1)}
                value={form.programId}
                onChange={(val) => setForm({ ...form, programId: val, userIds: [] })}
                placeholder="Pilih program"
                isSearchable={false}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nomor Surat Tugas</label>
              <input
                className="input"
                placeholder="Contoh: ST-01/TC/2026"
                value={form.suratTugasNo}
                onChange={(e) => setForm({ ...form, suratTugasNo: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nama Kegiatan</label>
              <input
                className="input"
                placeholder="Pendampingan SPT Tahunan"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Sesi *</label>
              <AppDatePicker
                value={form.date}
                onChange={(val) => setForm({ ...form, date: val })}
                placeholder="Pilih tanggal"
                required
              />
            </div>
            <div>
              <label className="label">Sesi Ke-</label>
              <input
                className="input"
                type="number"
                min="1"
                value={form.sessionNo}
                onChange={(e) => setForm({ ...form, sessionNo: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Jam Mulai *</label>
              <input
                className="input"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Jam Selesai *</label>
              <input
                className="input"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Petugas / Relawan</label>
            <AppSelect
              isMulti
              options={peopleOptions}
              value={form.userIds}
              onChange={(vals) => setForm({ ...form, userIds: vals })}
              placeholder="Cari & pilih relawan..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Jadwal"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
