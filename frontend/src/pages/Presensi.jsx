import { useEffect, useState } from "react";
import { CalendarDays, Camera, CheckCircle2, ClipboardCheck, Clock, Eye, MapPin, Send, Upload } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import CameraCaptureModal from "@/components/CameraCaptureModal";
import usePaginated from "@/hooks/usePaginated";
import { openEvidence, request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";

const getGps = () =>
  new Promise((ok) =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { timeout: 8000 })
      : ok(null)
  );

const EVIDENCE_LABELS = { photo: "Foto", excel: "Excel", bpe: "BPE", report: "Laporan" };

export default function Presensi() {
  const jadwal = usePaginated(API_ENDPOINTS.JADWAL.LIST);
  const riwayat = usePaginated(API_ENDPOINTS.PRESENSI.LIST);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [camSession, setCamSession] = useState(null);
  const [fin, setFin] = useState(null);

  useEffect(() => {
    request("get", API_ENDPOINTS.SETTINGS).then((r) => setSettings(r?.data?.settings || null));
  }, []);

  const reqEv = settings?.required_evidence || [];
  const wpRequired = settings ? !!settings.wp_required : true;

  const submitStart = async (compressedPhoto) => {
    if (!camSession || !compressedPhoto) return;
    setBusy(true);
    const gps = await getGps();
    const fd = new FormData();
    fd.append("sessionId", camSession.id);
    fd.append("photo", compressedPhoto);
    if (gps) {
      fd.append("lat", gps.latitude);
      fd.append("lng", gps.longitude);
    }
    const r = await request("post", API_ENDPOINTS.PRESENSI.START, fd, { success: true });
    setBusy(false);
    if (r) {
      setCamSession(null);
      jadwal.reload();
      riwayat.reload();
    }
  };

  const finish = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.PRESENSI.FINISH(fin.id), new FormData(e.target), { success: true });
    setBusy(false);
    if (r) {
      setFin(null);
      riwayat.reload();
    }
  };

  const ev = (r, f, ok) =>
    ok ? (
      <button
        type="button"
        key={f}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand transition hover:bg-brand hover:text-white"
        onClick={() => openEvidence(API_ENDPOINTS.PRESENSI.EVIDENCE(r.id, f))}
      >
        <Eye size={11} />
        {EVIDENCE_LABELS[f]}
      </button>
    ) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={ClipboardCheck}
        title="Presensi & Laporan Saya"
        subtitle="Langkah 1: Lakukan Presensi Mulai (wajib kamera langsung). Langkah 2: Klik Isi Laporan pada Riwayat & Laporan."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-light text-brand">
            <CalendarDays size={18} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">1. Jadwal Saya (Presensi Mulai)</h2>
        </div>

        <DataTable
          t={jadwal}
          searchPlaceholder="Cari jadwal kegiatan..."
          empty="Belum ada jadwal yang ditugaskan kepada Anda. Hubungi pengurus untuk penugasan jadwal."
          columns={[
            { label: "Tanggal", render: (r) => <span className="font-semibold text-slate-800">{r.date}</span> },
            {
              label: "Sesi",
              render: (r) => (
                <span className="inline-flex items-center gap-1.5 text-slate-700">
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand">Sesi {r.session_no}</span>
                  <span className="text-xs text-slate-500">
                    ({r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)})
                  </span>
                </span>
              ),
            },
            { label: "Kegiatan", render: (r) => r.title || "-" },
            {
              label: "Aksi",
              render: (r) =>
                r.replaced_by ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    Digantikan
                  </span>
                ) : r.attendance_id ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} />
                    Sudah presensi
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn !px-3 !py-1.5 text-xs"
                    onClick={() => setCamSession(r)}
                  >
                    <Camera size={14} />
                    Presensi Mulai
                  </button>
                ),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-light text-accent-dark">
            <Upload size={18} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">2. Riwayat & Laporan (Presensi Selesai)</h2>
        </div>

        <DataTable
          t={riwayat}
          searchPlaceholder="Cari riwayat presensi..."
          empty="Belum ada riwayat presensi. Lakukan Presensi Mulai terlebih dahulu pada jadwal di atas."
          columns={[
            {
              label: "Tanggal",
              render: (r) => (
                <div>
                  <div className="font-semibold text-slate-800">{r.date}</div>
                  <div className="text-[11px] text-slate-400">Sesi {r.session_no}</div>
                </div>
              ),
            },
            {
              label: "Terlambat",
              render: (r) => (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                  <Clock size={12} />
                  {r.late_minutes} mnt
                </span>
              ),
            },
            {
              label: "GPS",
              render: (r) => (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                    r.gps_valid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <MapPin size={12} />
                  {r.gps_valid ? "Valid" : "Tdk tervalidasi"}
                </span>
              ),
            },
            { label: "WP", render: (r) => <span className="font-semibold">{r.wp_count ?? "-"}</span> },
            {
              label: "Bukti Saya",
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {ev(r, "photo", true)}
                  {ev(r, "excel", r.has_excel)}
                  {ev(r, "bpe", r.has_bpe)}
                  {ev(r, "report", r.has_report)}
                </div>
              ),
            },
            {
              label: "Status",
              render: (r) => (
                <div>
                  <StatusBadge s={r.status} note={r.verify_reason} />
                  {r.verify_reason && (
                    <div className="mt-1 max-w-[180px] text-[11px] text-rose-600">{r.verify_reason}</div>
                  )}
                </div>
              ),
            },
            {
              label: "Laporan",
              render: (r) =>
                r.status !== "disetujui" ? (
                  <button
                    type="button"
                    className={r.end_at ? "btn-ghost !rounded-lg !px-3 !py-1.5 text-xs" : "btn !rounded-lg !px-3 !py-1.5 text-xs"}
                    onClick={() => setFin(r)}
                  >
                    <Send size={13} />
                    {r.end_at ? "Perbaiki" : "Isi Laporan"}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700">Terverifikasi</span>
                ),
            },
          ]}
        />
      </section>

      <CameraCaptureModal
        open={!!camSession}
        session={camSession}
        busy={busy}
        onClose={() => setCamSession(null)}
        onConfirm={submitStart}
      />

      <Modal
        open={!!fin}
        title={fin?.end_at ? "Perbaiki Laporan Presensi" : "Presensi Selesai & Isi Laporan"}
        subtitle={fin ? `Tanggal ${fin.date} • Sesi ${fin.session_no}` : ""}
        onClose={() => setFin(null)}
      >
        {fin && (
          <form onSubmit={finish} className="space-y-4">
            <div>
              <label className="label">Jumlah WP Dilayani {wpRequired ? "*" : "(opsional)"}</label>
              <input
                className="input"
                name="wpCount"
                type="number"
                min="0"
                defaultValue={fin.wp_count ?? ""}
                placeholder="0"
                required={wpRequired}
              />
            </div>
            {[
              ["excel", "File Excel Pendampingan", fin.has_excel],
              ["bpe", "Bukti BPE SPT", fin.has_bpe],
              ["report", "Bukti Laporan Kegiatan", fin.has_report],
            ].map(([n, l, hasOld]) => {
              const isReq = reqEv.includes(n);
              return (
                <div key={n}>
                  <label className="label">
                    {l}{" "}
                    {isReq ? (
                      <span className="text-rose-600">* Wajib</span>
                    ) : (
                      <span className="font-normal text-slate-400">(opsional)</span>
                    )}
                    {hasOld ? <span className="ml-2 text-emerald-600">(sudah terunggah)</span> : null}
                  </label>
                  <input
                    className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand/15"
                    type="file"
                    name={n}
                    required={isReq && !hasOld}
                  />
                </div>
              );
            })}
            <div>
              <label className="label">Catatan Kendala (opsional)</label>
              <textarea
                className="input min-h-[84px]"
                name="notes"
                defaultValue={fin.notes || ""}
                placeholder="Tuliskan catatan kendala jika ada..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setFin(null)}>Batal</button>
              <button type="submit" className="btn" disabled={busy}>
                <Send size={15} />
                {busy ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
