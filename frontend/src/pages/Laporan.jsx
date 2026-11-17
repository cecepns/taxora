import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileType,
  Layers,
  Save,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import { request } from "@/utils/request";
import { exportMonthlyDocx, exportMonthlyPdf, exportMonthlyXlsx, exportMonthlyZip } from "@/utils/exporters";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const PROGRAM_OPTIONS = [
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
].map((label, idx) => ({ value: String(idx + 1), label }));

const ZIP_GROUP_OPTIONS = [
  { value: "relawan", label: "Susun ZIP per Relawan" },
  { value: "tanggal", label: "Susun ZIP per Tanggal" },
];

const REPORT_STATUS_BADGE = {
  belum_ada: "bg-slate-100 text-slate-500 ring-slate-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  final: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  perlu_diperbarui: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function Laporan() {
  const user = getUser();
  const isAdmin = user.role === "admin";
  const canFinalize = ["pengurus", "admin"].includes(user.role);
  const now = new Date();
  const curYear = now.getFullYear();
  const YEAR_OPTIONS = [curYear + 1, curYear, curYear - 1, curYear - 2].map((y) => ({ value: String(y), label: String(y) }));

  const [tab, setTab] = useState("bulanan");
  const [programId, setProgramId] = useState(String(user.programId || "1"));
  const [year, setYear] = useState(String(curYear));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const [monthly, setMonthly] = useState(null);
  const [annual, setAnnual] = useState(null);
  const [combined, setCombined] = useState(null);

  const [metaForm, setMetaForm] = useState({ letterNo: "", narrative: "", signatoryName: "", signatoryTitle: "" });
  const [publicShare, setPublicShare] = useState(false);
  const [zipGroup, setZipGroup] = useState("relawan");
  const [busy, setBusy] = useState(false);

  const loadMonthly = useCallback(async () => {
    const r = await request("get", API_ENDPOINTS.REPORTS.MONTHLY, { programId, year, month });
    if (r?.data) {
      setMonthly(r.data);
      setMetaForm({
        letterNo: r.data.meta?.letter_no || "",
        narrative: r.data.meta?.narrative || "",
        signatoryName: r.data.meta?.signatory_name || "",
        signatoryTitle: r.data.meta?.signatory_title || "",
      });
    }
  }, [programId, year, month]);

  const loadAnnual = useCallback(async () => {
    const r = await request("get", API_ENDPOINTS.REPORTS.ANNUAL, { programId, year });
    if (r?.data) setAnnual(r.data);
  }, [programId, year]);

  const loadCombined = useCallback(async () => {
    if (!isAdmin) return;
    const r = await request("get", API_ENDPOINTS.REPORTS.COMBINED, { year });
    if (r?.data) setCombined(r.data);
  }, [isAdmin, year]);

  useEffect(() => {
    if (tab === "bulanan") loadMonthly();
    else if (tab === "tahunan") loadAnnual();
    else if (tab === "gabungan") loadCombined();
  }, [tab, loadMonthly, loadAnnual, loadCombined]);

  const saveReport = async (status) => {
    setBusy(true);
    const r = await request(
      "post",
      API_ENDPOINTS.REPORTS.MONTHLY_SAVE,
      { programId, year, month, status, ...metaForm },
      { success: true }
    );
    setBusy(false);
    if (r) loadMonthly();
  };

  const exportFormat = async (format) => {
    setBusy(true);
    try {
      const r = await request("get", API_ENDPOINTS.REPORTS.MONTHLY_EXPORT, {
        programId,
        year,
        month,
        format,
        publicShare: publicShare ? "1" : "0",
        groupBy: zipGroup,
      });
      if (!r?.data) return;
      const dataset = {
        ...r.data,
        meta: {
          ...r.data.meta,
          letter_no: metaForm.letterNo || r.data.meta?.letter_no,
          narrative: metaForm.narrative || r.data.meta?.narrative,
          signatory_name: metaForm.signatoryName || r.data.meta?.signatory_name,
          signatory_title: metaForm.signatoryTitle || r.data.meta?.signatory_title,
        },
      };
      if (format === "xlsx") exportMonthlyXlsx(dataset);
      else if (format === "docx") await exportMonthlyDocx(dataset);
      else if (format === "pdf") await exportMonthlyPdf(dataset);
      else if (format === "zip") await exportMonthlyZip(dataset, zipGroup);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Laporan & Ekspor"
        subtitle="Pratinjau dan unduh laporan bulanan (XLSX, DOCX, PDF, ZIP), rekap tahunan 12 bulan, dan ringkasan gabungan."
      />

      {/* Tabs & Filters */}
      <div className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
          {[
            ["bulanan", "Laporan Bulanan"],
            ["tahunan", "Laporan Tahunan"],
            ...(isAdmin ? [["gabungan", "Gabungan (Admin Pusat)"]] : []),
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg px-3.5 py-2 text-center text-sm font-semibold transition sm:flex-none ${
                tab === k ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:items-center">
          {isAdmin && tab !== "gabungan" && (
            <div className="w-full lg:w-44">
              <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={programId} onChange={setProgramId} />
            </div>
          )}
          {tab === "bulanan" && (
            <div className="w-full lg:w-40">
              <AppSelect size="sm" isSearchable={false} options={MONTHS} value={month} onChange={setMonth} />
            </div>
          )}
          <div className="w-full lg:w-32">
            <AppSelect size="sm" isSearchable={false} options={YEAR_OPTIONS} value={year} onChange={setYear} />
          </div>
        </div>
      </div>

      {/* TAB 1: LAPORAN BULANAN */}
      {tab === "bulanan" && monthly && (
        <div className="space-y-6">
          {/* Status & Export Actions */}
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-extrabold text-slate-900">
                  {monthly.program.name} — {monthly.monthName} {monthly.year}
                </h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ring-1 ${REPORT_STATUS_BADGE[monthly.meta.status] || REPORT_STATUS_BADGE.draft}`}>
                  {monthly.meta.status?.replace("_", " ")} (v{monthly.meta.version || 0})
                </span>
              </div>
              {canFinalize && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => saveReport("draft")}>
                    <Save size={15} /> Simpan Draft
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => saveReport("final")}>
                    <ShieldCheck size={15} /> Tetapkan Final
                  </button>
                </div>
              )}
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ["Penugasan", monthly.summary.total_penugasan],
                ["Hadir", monthly.summary.hadir],
                ["Tidak Hadir", monthly.summary.tidak_hadir],
                ["Digantikan", monthly.summary.diganti],
                ["Terlambat", monthly.summary.terlambat],
                ["Menunggu", monthly.summary.menunggu_verifikasi],
                ["Total WP", monthly.summary.total_wp],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-100 bg-brand-50/50 p-3 text-center">
                  <div className="text-xl font-extrabold text-brand">{v}</div>
                  <div className="text-[11px] font-semibold text-slate-500">{k}</div>
                </div>
              ))}
            </div>

            {/* Narasi & Penandatangan */}
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div>
                <label className="label">Nomor Surat</label>
                <input className="input" value={metaForm.letterNo} onChange={(e) => setMetaForm({ ...metaForm, letterNo: e.target.value })} />
              </div>
              <div>
                <label className="label">Nama Penandatangan</label>
                <input className="input" value={metaForm.signatoryName} onChange={(e) => setMetaForm({ ...metaForm, signatoryName: e.target.value })} />
              </div>
              <div>
                <label className="label">Jabatan Penandatangan</label>
                <input className="input" value={metaForm.signatoryTitle} onChange={(e) => setMetaForm({ ...metaForm, signatoryTitle: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Narasi Laporan (untuk DOCX & PDF)</label>
              <textarea className="input min-h-[76px]" value={metaForm.narrative} onChange={(e) => setMetaForm({ ...metaForm, narrative: e.target.value })} />
            </div>

            {/* Opsi Ekspor & Tombol Unduh */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={publicShare} onChange={(e) => setPublicShare(e.target.checked)} />
                  Gunakan tautan bukti berbatas waktu (30 hari) di Excel
                </label>
                <div className="w-52">
                  <AppSelect size="sm" isSearchable={false} options={ZIP_GROUP_OPTIONS} value={zipGroup} onChange={setZipGroup} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn !bg-emerald-600 hover:!bg-emerald-700" disabled={busy} onClick={() => exportFormat("xlsx")}>
                  <FileSpreadsheet size={16} /> XLSX
                </button>
                <button type="button" className="btn !bg-sky-600 hover:!bg-sky-700" disabled={busy} onClick={() => exportFormat("docx")}>
                  <FileType size={16} /> DOCX
                </button>
                <button type="button" className="btn !bg-rose-600 hover:!bg-rose-700" disabled={busy} onClick={() => exportFormat("pdf")}>
                  <FileText size={16} /> PDF
                </button>
                <button type="button" className="btn !bg-amber-600 hover:!bg-amber-700" disabled={busy} onClick={() => exportFormat("zip")}>
                  <Archive size={16} /> ZIP Bukti
                </button>
              </div>
            </div>
          </div>

          {/* Pratinjau Tabel Data */}
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-sm font-bold text-slate-800">
              Pratinjau Data Bulanan ({monthly.rows.length} baris)
            </div>
            {/* Mobile Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {monthly.rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Belum ada data jadwal/presensi pada bulan ini.</p>
              ) : (
                monthly.rows.map((r) => (
                  <div key={r.assignment_id} className="space-y-2 p-4 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{r.name}</div>
                        <div className="text-slate-500">{r.nim} • {r.prodi || "-"}</div>
                      </div>
                      <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-bold text-brand">
                        {r.date} • Sesi {r.session_no}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-50 p-2.5 text-slate-700">
                      <div>Kehadiran: <strong>{r.attendance_status}</strong></div>
                      <div>Terlambat: <strong>{r.late_minutes ?? "-"} mnt</strong></div>
                      <div>WP: <strong>{r.wp_count ?? 0}</strong></div>
                      <div>Verifikasi: <strong className="capitalize">{r.verify_status || "-"}</strong></div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-brand-50/60 font-bold uppercase text-brand">
                  <tr>
                    <th className="whitespace-nowrap px-3.5 py-3">Relawan</th>
                    <th className="whitespace-nowrap px-3.5 py-3">Tanggal</th>
                    <th className="whitespace-nowrap px-3.5 py-3">Sesi</th>
                    <th className="whitespace-nowrap px-3.5 py-3">Kehadiran</th>
                    <th className="whitespace-nowrap px-3.5 py-3">Terlambat</th>
                    <th className="whitespace-nowrap px-3.5 py-3">WP</th>
                    <th className="whitespace-nowrap px-3.5 py-3">Lokasi</th>
                    <th className="whitespace-nowrap px-3.5 py-3">Verifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthly.rows.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-400">Belum ada data jadwal/presensi pada bulan ini.</td></tr>
                  ) : (
                    monthly.rows.map((r) => (
                      <tr key={r.assignment_id} className="hover:bg-brand-50/30">
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-slate-900">{r.name}</div>
                          <div className="text-[11px] text-slate-500">{r.nim} • {r.prodi || "-"}</div>
                        </td>
                        <td className="px-3.5 py-2.5">{r.date}</td>
                        <td className="px-3.5 py-2.5">Sesi {r.session_no}</td>
                        <td className="px-3.5 py-2.5 font-semibold">{r.attendance_status}</td>
                        <td className="px-3.5 py-2.5">{r.late_minutes ?? "-"} mnt</td>
                        <td className="px-3.5 py-2.5 font-semibold">{r.wp_count ?? 0}</td>
                        <td className="px-3.5 py-2.5">{r.attendance_id ? (r.gps_valid ? "Valid" : "Tidak tervalidasi") : "-"}</td>
                        <td className="px-3.5 py-2.5 capitalize">{r.verify_status || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LAPORAN TAHUNAN (12 BULAN) */}
      {tab === "tahunan" && annual && (
        <div className="space-y-4">
          <div className="card grid gap-4 p-5 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-2xl font-extrabold text-emerald-800">{annual.totals.final_months} / 12</div>
              <div className="text-xs font-semibold text-emerald-700">Bulan Final Tervalidasi</div>
            </div>
            <div className="rounded-xl bg-brand-50 p-4">
              <div className="text-2xl font-extrabold text-brand">{annual.totals.hadir}</div>
              <div className="text-xs font-semibold text-slate-600">Total Hadir (Final)</div>
            </div>
            <div className="rounded-xl bg-indigo-50 p-4">
              <div className="text-2xl font-extrabold text-indigo-800">{annual.totals.total_wp}</div>
              <div className="text-xs font-semibold text-indigo-700">Total WP (Final)</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <div className="text-2xl font-extrabold text-rose-800">{annual.totals.terlambat}</div>
              <div className="text-xs font-semibold text-rose-700">Total Terlambat (Final)</div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-sm font-bold text-slate-800">
              Matriks Laporan Tahunan {annual.program.name} — {annual.year} (Hanya bulan berstatus FINAL yang dijumlahkan)
            </div>
            {/* Mobile Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {annual.months.map((m) => (
                <div key={m.month} className="space-y-2 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{m.monthName}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ring-1 ${REPORT_STATUS_BADGE[m.status]}`}>
                      {m.status === "final" && <CheckCircle2 size={12} />}
                      {m.status.replace("_", " ")}
                      {m.version > 0 ? ` (v${m.version})` : ""}
                    </span>
                  </div>
                  {m.validated && m.summary ? (
                    <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs">
                      <div><div className="font-bold">{m.summary.hadir}</div><div className="text-[10px] text-slate-500">Hadir</div></div>
                      <div><div className="font-bold">{m.summary.tidak_hadir}</div><div className="text-[10px] text-slate-500">Alfa</div></div>
                      <div><div className="font-bold">{m.summary.terlambat}</div><div className="text-[10px] text-slate-500">Telat</div></div>
                      <div><div className="font-bold text-brand">{m.summary.total_wp}</div><div className="text-[10px] text-slate-500">WP</div></div>
                    </div>
                  ) : (
                    <p className="text-xs italic text-slate-400">Belum tervalidasi (belum final)</p>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-brand-50/60 text-xs font-bold uppercase text-brand">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">Bulan</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <th className="whitespace-nowrap px-4 py-3">Hadir</th>
                    <th className="whitespace-nowrap px-4 py-3">Tidak Hadir</th>
                    <th className="whitespace-nowrap px-4 py-3">Terlambat</th>
                    <th className="whitespace-nowrap px-4 py-3">Total WP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {annual.months.map((m) => (
                    <tr key={m.month} className="hover:bg-brand-50/30">
                      <td className="px-4 py-3 font-bold text-slate-900">{m.monthName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ring-1 ${REPORT_STATUS_BADGE[m.status]}`}>
                          {m.status === "final" && <CheckCircle2 size={12} />}
                          {m.status.replace("_", " ")}
                          {m.version > 0 ? ` (v${m.version})` : ""}
                        </span>
                      </td>
                      {m.validated && m.summary ? (
                        <>
                          <td className="px-4 py-3 font-semibold">{m.summary.hadir}</td>
                          <td className="px-4 py-3">{m.summary.tidak_hadir}</td>
                          <td className="px-4 py-3">{m.summary.terlambat}</td>
                          <td className="px-4 py-3 font-bold text-brand">{m.summary.total_wp}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="px-4 py-3 text-xs italic text-slate-400">
                          Belum tervalidasi (belum final)
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAPORAN GABUNGAN ADMIN PUSAT */}
      {tab === "gabungan" && combined && (
        <div className="grid gap-6 lg:grid-cols-2">
          {combined.programs.map(({ program, stats, monthly: mList }) => (
            <div key={program.id} className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
                    <Layers size={19} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{program.name}</h3>
                    <p className="text-xs text-slate-500">Ringkasan Tahun {combined.year} (terpisah, tidak dicampur)</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-sky-50 p-3.5"><div className="text-xl font-extrabold text-sky-900">{stats.relawan_aktif}</div><div className="text-xs text-slate-600">Relawan Aktif</div></div>
                <div className="rounded-xl bg-emerald-50 p-3.5"><div className="text-xl font-extrabold text-emerald-900">{stats.total_hadir}</div><div className="text-xs text-slate-600">Total Kehadiran</div></div>
                <div className="rounded-xl bg-indigo-50 p-3.5"><div className="text-xl font-extrabold text-indigo-900">{stats.total_wp}</div><div className="text-xs text-slate-600">Total WP Dilayani</div></div>
                <div className="rounded-xl bg-amber-50 p-3.5"><div className="text-xl font-extrabold text-amber-900">{stats.bulan_final} / 12</div><div className="text-xs text-slate-600">Laporan Final</div></div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((mo, idx) => {
                  const found = mList.find((x) => x.month === idx + 1);
                  const st = found?.status || "belum_ada";
                  return (
                    <span key={mo.value} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 ${REPORT_STATUS_BADGE[st]}`}>
                      {mo.label.slice(0, 3)}: {st === "belum_ada" ? "-" : st.replace("_", " ")}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
