import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Lock, Save, Settings, Unlock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import AppSelect from "@/components/AppSelect";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const PROGRAM_OPTIONS = [
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const EVIDENCE_ITEMS = [
  { key: "excel", label: "File Excel Pendampingan" },
  { key: "bpe", label: "Bukti BPE SPT" },
  { key: "report", label: "Bukti Laporan Kegiatan" },
];

export default function Pengaturan() {
  const user = getUser();
  const isAdmin = user.role === "admin";
  const [programId, setProgramId] = useState(String(user.programId || "1"));
  const [st, setSt] = useState(null);
  const [prodiText, setProdiText] = useState("");
  const [periods, setPeriods] = useState([]);
  const [years, setYears] = useState([]);
  const [periodModal, setPeriodModal] = useState(null);
  const [periodReason, setPeriodReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      request("get", API_ENDPOINTS.SETTINGS, { programId }),
      request("get", API_ENDPOINTS.PERIODS.LIST),
    ]);
    if (r1?.data?.settings) {
      setSt(r1.data.settings);
      setProdiText((r1.data.settings.prodi_list || []).join("\n"));
    }
    if (r2) {
      setPeriods(r2.data || []);
      setYears(r2.years || [new Date().getFullYear()]);
    }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  const toggleEvidence = (key) => {
    const cur = st.required_evidence || [];
    const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    setSt({ ...st, required_evidence: next });
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      ...st,
      prodi_list: prodiText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const r = await request("put", API_ENDPOINTS.SETTINGS, { programId: Number(programId), settings: payload }, { success: true });
    setBusy(false);
    if (r) load();
  };

  const submitClosePeriod = async (e) => {
    e.preventDefault();
    if (!periodReason.trim()) return toast.error("Alasan wajib diisi");
    setBusy(true);
    const r = await request(
      "post",
      API_ENDPOINTS.PERIODS.CLOSE,
      { programId: periodModal.programId, year: periodModal.year, closed: periodModal.nextClosed, reason: periodReason.trim() },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setPeriodModal(null);
      setPeriodReason("");
      load();
    }
  };

  if (!st) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Pengaturan Program"
        subtitle="Atur parameter operasional, bukti wajib, bobot penilaian Relawan of the Month, daftar prodi, dan tutup periode."
        actions={
          isAdmin && (
            <div className="w-48">
              <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={programId} onChange={setProgramId} />
            </div>
          )
        }
      />

      <form onSubmit={saveSettings} className="space-y-6">
        {/* Parameter Operasional & Bukti Wajib */}
        <section className="card p-6 space-y-4">
          <h2 className="text-base font-extrabold text-brand">1. Presensi, GPS & Bukti Wajib</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Batas Terlambat (menit)</label>
              <input className="input" type="number" min="0" value={st.late_limit_min} onChange={(e) => setSt({ ...st, late_limit_min: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Radius GPS (meter — kosongkan jika belum ditentukan)</label>
              <input
                className="input"
                type="number"
                placeholder="Kosong"
                value={st.gps_radius_m ?? ""}
                onChange={(e) => setSt({ ...st, gps_radius_m: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Batas Ukuran File (MB)</label>
              <input className="input" type="number" min="1" max="25" value={st.max_file_mb ?? 5} onChange={(e) => setSt({ ...st, max_file_mb: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="label">Isian & Bukti Wajib Laporan Selesai</label>
            <div className="flex flex-wrap gap-2.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium">
                <input type="checkbox" checked={!!st.wp_required} onChange={(e) => setSt({ ...st, wp_required: e.target.checked })} />
                Jumlah WP Dilayani Wajib
              </label>
              {EVIDENCE_ITEMS.map((item) => (
                <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={(st.required_evidence || []).includes(item.key)}
                    onChange={() => toggleEvidence(item.key)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Bobot & Skor Relawan of the Month */}
        <section className="card p-6 space-y-4">
          <h2 className="text-base font-extrabold text-brand">2. Aturan Penilaian Relawan of the Month</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Bobot A: Kinerja Pelayanan</label>
              <input className="input" type="number" value={st.weight_service} onChange={(e) => setSt({ ...st, weight_service: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Bobot B: Kehadiran</label>
              <input className="input" type="number" value={st.weight_attendance} onChange={(e) => setSt({ ...st, weight_attendance: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Target WP per Shift</label>
              <input className="input" type="number" min="1" value={st.target_wp} onChange={(e) => setSt({ ...st, target_wp: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <label className="label">Skor Kehadiran (Komponen B)</label>
            <div className="grid gap-3 sm:grid-cols-5">
              {[
                ["ontime", "Tepat waktu / ≤batas"],
                ["late11_20", "Terlambat 11–20 mnt"],
                ["late21_30", "Terlambat 21–30 mnt"],
                ["late30plus", "Terlambat >30 mnt"],
                ["absent", "Tidak hadir"],
              ].map(([k, l]) => (
                <div key={k}>
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">{l}</span>
                  <input
                    className="input"
                    type="number"
                    value={st.scores?.[k] ?? 0}
                    onChange={(e) => setSt({ ...st, scores: { ...st.scores, [k]: Number(e.target.value) } })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Poin Apresiasi (Komponen C — Bonus)</label>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["pengganti", "Menggantikan relawan"],
                ["bantu_kegiatan", "Bantu kegiatan lain"],
                ["konten", "Konten publikasi"],
                ["masukan", "Masukan / evaluasi"],
              ].map(([k, l]) => (
                <div key={k}>
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">{l}</span>
                  <input
                    className="input"
                    type="number"
                    value={st.bonus?.[k] ?? 0}
                    onChange={(e) => setSt({ ...st, bonus: { ...st.bonus, [k]: Number(e.target.value) } })}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Daftar Prodi & Template Laporan */}
        <section className="card p-6 space-y-4">
          <h2 className="text-base font-extrabold text-brand">3. Daftar Prodi & Default Laporan</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label">Daftar Program Studi (satu prodi per baris)</label>
              <textarea className="input min-h-[140px]" value={prodiText} onChange={(e) => setProdiText(e.target.value)} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Default Nomor Surat Laporan</label>
                <input className="input" value={st.report_letter_no || ""} onChange={(e) => setSt({ ...st, report_letter_no: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Nama Penandatangan</label>
                  <input className="input" value={st.report_signatory_name || ""} onChange={(e) => setSt({ ...st, report_signatory_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Jabatan Penandatangan</label>
                  <input className="input" value={st.report_signatory_title || ""} onChange={(e) => setSt({ ...st, report_signatory_title: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Narasi Default Laporan</label>
                <textarea className="input min-h-[72px]" value={st.report_narrative || ""} onChange={(e) => setSt({ ...st, report_narrative: e.target.value })} />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="btn px-6" disabled={busy}>
            <Save size={16} />
            {busy ? "Menyimpan..." : "Simpan Pengaturan Program"}
          </button>
        </div>
      </form>

      {/* Tutup Tahun Periode (Admin Pusat) */}
      {isAdmin && (
        <section className="card p-6 space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-brand">4. Tutup Tahun & Buka Kunci Periode (Admin Pusat)</h2>
            <p className="text-xs text-slate-500">
              Periode yang ditutup akan dikunci menjadi hanya-baca. Data lama & bukti tetap bisa dibuka. Membuka kunci wajib disertai alasan tercatat.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROGRAM_OPTIONS.map((prog) =>
              years.slice(0, 2).map((yr) => {
                const found = periods.find((p) => String(p.program_id) === prog.value && Number(p.year) === Number(yr));
                const closed = !!found?.closed;
                return (
                  <div key={`${prog.value}-${yr}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                    <div>
                      <div className="font-bold text-slate-900">{prog.label} — Tahun {yr}</div>
                      <div className={`text-xs font-semibold ${closed ? "text-rose-600" : "text-emerald-600"}`}>
                        {closed ? "Tertutup (Hanya Baca)" : "Terbuka (Aktif)"}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={closed ? "btn-ghost !py-1.5 text-xs" : "btn-danger !py-1.5 text-xs"}
                      onClick={() => {
                        setPeriodReason("");
                        setPeriodModal({ programId: Number(prog.value), programName: prog.label, year: yr, nextClosed: !closed });
                      }}
                    >
                      {closed ? <Unlock size={14} /> : <Lock size={14} />}
                      {closed ? "Buka Kunci" : "Tutup Tahun"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      <Modal
        open={!!periodModal}
        title={periodModal?.nextClosed ? "Tutup Tahun Periode" : "Buka Kunci Periode"}
        subtitle={periodModal ? `${periodModal.programName} — Tahun ${periodModal.year}` : ""}
        onClose={() => setPeriodModal(null)}
        maxWidth="max-w-md"
      >
        <form onSubmit={submitClosePeriod} className="space-y-4">
          <div>
            <label className="label">Alasan (wajib tercatat di Riwayat Perubahan) *</label>
            <textarea
              className="input min-h-[84px]"
              placeholder="Tuliskan alasan penutupan atau pembukaan kunci periode..."
              value={periodReason}
              onChange={(e) => setPeriodReason(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPeriodModal(null)}>Batal</button>
            <button type="submit" className={periodModal?.nextClosed ? "btn-danger" : "btn"} disabled={busy}>
              {busy ? "Memproses..." : "Konfirmasi"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
