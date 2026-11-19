import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  Clock,
  Download,
  FileBadge,
  FileSpreadsheet,
  Loader2,
  Plus,
  Upload,
  Users,
} from "lucide-react";
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
  const user = getUser();
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

  // Excel Mass Import State
  const [importOpen, setImportOpen] = useState(false);
  const [importProgramId, setImportProgramId] = useState(admin ? "1" : String(user.programId || "1"));
  const [previewRows, setPreviewRows] = useState([]);
  const [importBusy, setImportBusy] = useState(false);

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

  // Download Template Excel Jadwal Berbasis Surat Tugas (ST)
  const handleDownloadTemplate = () => {
    const headers = [
      "nomor_surat_tugas",
      "program_id",
      "tanggal",
      "sesi",
      "jam_mulai",
      "jam_selesai",
      "judul_kegiatan",
      "nim_relawan",
    ];

    const sampleData = [
      [
        "ST-01/TC/2026",
        1,
        "2026-03-02",
        1,
        "08:00",
        "12:00",
        "Pendampingan Login Coretax & Validasi Data",
        "233040101, 233040102",
      ],
      [
        "ST-01/TC/2026",
        1,
        "2026-03-02",
        2,
        "12:00",
        "16:00",
        "Pendampingan Asistensi SPT Tahunan",
        "233040103, 233040104",
      ],
      [
        "ST-02/RENJANI/2026",
        2,
        "2026-03-03",
        1,
        "08:00",
        "12:00",
        "Asistensi Pelaporan SPT Tahunan RENJANI",
        "233040105",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    ws["!cols"] = [
      { wch: 22 }, // nomor_surat_tugas
      { wch: 12 }, // program_id
      { wch: 14 }, // tanggal
      { wch: 8 },  // sesi
      { wch: 10 }, // jam_mulai
      { wch: 12 }, // jam_selesai
      { wch: 40 }, // judul_kegiatan
      { wch: 30 }, // nim_relawan
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Draft_Jadwal_ST");
    XLSX.writeFile(wb, "Template_Jadwal_Massal_Surat_Tugas.xlsx");
    toast.success("Template Excel Surat Tugas berhasil diunduh");
  };

  // Baca File Excel Yang Diunggah
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!data.length) {
          toast.error("File Excel kosong");
          return;
        }

        const formatted = data.map((row, idx) => {
          const stNo = row.nomor_surat_tugas || row.surat_tugas || row.no_st || "";
          const date = String(row.tanggal || row.date || "").trim();
          const sess = String(row.sesi || row.session || "1").trim();
          const start = String(row.jam_mulai || row.start_time || "08:00").trim();
          const end = String(row.jam_selesai || row.end_time || "12:00").trim();
          const title = String(row.judul_kegiatan || row.kegiatan || row.title || `Sesi ${sess}`).trim();
          const nims = String(row.nim_relawan || row.nim || row.relawan || "").trim();

          return {
            id: idx + 1,
            suratTugasNo: stNo,
            date,
            sessionNo: parseInt(sess, 10) || 1,
            startTime: start.length === 5 ? start : start.slice(0, 5),
            endTime: end.length === 5 ? end : end.slice(0, 5),
            title,
            nims,
            valid: Boolean(date && start && end && nims),
          };
        });

        setPreviewRows(formatted);
        toast.success(`Berhasil membaca ${formatted.length} baris jadwal.`);
      } catch (err) {
        toast.error("Format Excel tidak sesuai. Gunakan template yang disediakan.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Kirim data import massal ke backend
  const handleCommitImport = async () => {
    const validRows = previewRows.filter((r) => r.valid);
    if (!validRows.length) {
      return toast.error("Tidak ada baris jadwal yang valid untuk diimpor");
    }

    setImportBusy(true);
    const r = await request("post", API_ENDPOINTS.JADWAL.IMPORT_EXCEL, {
      programId: importProgramId,
      items: validRows,
    }, { success: true });
    setImportBusy(false);

    if (r) {
      setImportOpen(false);
      setPreviewRows([]);
      t.reload();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title="Jadwal & Surat Tugas"
        subtitle="Kelola surat tugas (ST), sesi jaga, dan input massal jadwal relawan berbasis Excel."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost !bg-white shadow-sm text-xs"
              onClick={handleDownloadTemplate}
            >
              <Download size={15} />
              Unduh Template ST (Excel)
            </button>
            <button
              type="button"
              className="btn-ghost !bg-emerald-50 !text-emerald-700 !ring-emerald-200 hover:!bg-emerald-600 hover:!text-white text-xs"
              onClick={() => {
                setPreviewRows([]);
                setImportOpen(true);
              }}
            >
              <FileSpreadsheet size={15} />
              Import Jadwal Massal Excel
            </button>
            <button type="button" className="btn text-xs" onClick={openModal}>
              <Plus size={16} />
              Buat Jadwal Satuan
            </button>
          </div>
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
            label: "Program",
            render: (r) => <span className="text-xs font-medium text-slate-600">{r.program_name}</span>,
          },
          {
            label: "Sesi",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span className="rounded-md bg-brand-50 px-2 py-0.5 font-bold text-brand">Sesi {r.session_no}</span>
                <span className="text-slate-500">
                  ({r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)} WIB)
                </span>
              </span>
            ),
          },
          {
            label: "Kegiatan",
            render: (r) => <div className="font-medium text-slate-800">{r.title || "-"}</div>,
          },
          {
            label: "Petugas Ditugaskan",
            tdClassName: "whitespace-nowrap",
            render: (r) => (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                <Users size={12} />
                {r.crew || 0} relawan
              </span>
            ),
          },
        ]}
      />

      {/* Modal Import Jadwal Massal Excel Berbasis ST */}
      <Modal
        open={importOpen}
        title="Import Jadwal Massal Excel (Draft Surat Tugas)"
        subtitle="Unggah susunan jadwal dari draft Surat Tugas (ST) tanpa perlu menginputkan satu per satu."
        onClose={() => setImportOpen(false)}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-50/50 p-4 text-xs text-brand">
            <div>
              <strong>Petunjuk Format:</strong> File Excel harus memiliki kolom <code>nomor_surat_tugas</code>, <code>tanggal</code>, <code>sesi</code>, <code>jam_mulai</code>, <code>jam_selesai</code>, <code>judul_kegiatan</code>, dan <code>nim_relawan</code>.
            </div>
            <button
              type="button"
              className="btn !rounded-xl !px-3 !py-1 text-xs"
              onClick={handleDownloadTemplate}
            >
              <Download size={13} /> Unduh Format Template
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {admin && (
              <div>
                <label className="label">Target Program *</label>
                <AppSelect
                  isSearchable={false}
                  options={PROGRAM_OPTIONS.slice(1)}
                  value={importProgramId}
                  onChange={setImportProgramId}
                />
              </div>
            )}
            <div className={admin ? "" : "sm:col-span-2"}>
              <label className="label">Pilih File Excel (.xlsx / .xls) *</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Pratinjau Tabel Excel */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Pratinjau Data ({previewRows.length} baris):</span>
                <span className="text-emerald-700">
                  {previewRows.filter((r) => r.valid).length} baris valid
                </span>
              </div>
              <div className="max-h-60 overflow-auto rounded-xl border border-slate-200 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2">No ST</th>
                      <th className="p-2">Tanggal</th>
                      <th className="p-2">Sesi</th>
                      <th className="p-2">Jam</th>
                      <th className="p-2">Judul</th>
                      <th className="p-2">NIM Relawan</th>
                      <th className="p-2">Valid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((r) => (
                      <tr key={r.id} className={r.valid ? "hover:bg-slate-50" : "bg-rose-50/50"}>
                        <td className="p-2 font-mono">{r.suratTugasNo || "-"}</td>
                        <td className="p-2 font-semibold">{r.date}</td>
                        <td className="p-2">Sesi {r.sessionNo}</td>
                        <td className="p-2">{r.startTime}–{r.endTime}</td>
                        <td className="p-2 truncate max-w-[140px]">{r.title}</td>
                        <td className="p-2 truncate max-w-[140px] font-mono">{r.nims}</td>
                        <td className="p-2">
                          {r.valid ? (
                            <span className="text-emerald-700 font-bold">OK</span>
                          ) : (
                            <span className="text-rose-600 font-bold">Kurang Lengkap</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={() => setImportOpen(false)}>Batal</button>
            <button
              type="button"
              className="btn"
              disabled={importBusy || !previewRows.filter((r) => r.valid).length}
              onClick={handleCommitImport}
            >
              {importBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importBusy ? "Memproses..." : "Proses Import ke Sistem"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Buat Jadwal Satuan */}
      <Modal open={open} title="Buat Jadwal Sesi Satuan" subtitle="Isi form berikut untuk membuat sesi jadwal dan penugasan relawan." onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          {admin && (
            <div>
              <label className="label">Program *</label>
              <AppSelect
                options={PROGRAM_OPTIONS.slice(1)}
                value={form.programId}
                onChange={(val) => setForm({ ...form, programId: val, userIds: [] })}
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Jadwal"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
