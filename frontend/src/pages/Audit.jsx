import { useState } from "react";
import { Download, History } from "lucide-react";
import DataTable from "@/components/DataTable";
import PageHeader from "@/components/PageHeader";
import AppSelect from "@/components/AppSelect";
import usePaginated from "@/hooks/usePaginated";
import { request } from "@/utils/request";
import { exportAuditExcel } from "@/utils/exporters";
import { API_ENDPOINTS } from "@/utils/endpoints";

const ENTITY_OPTIONS = [
  { value: "", label: "Semua Objek" },
  { value: "akun", label: "Akun / Login" },
  { value: "user", label: "Manajemen User" },
  { value: "presensi", label: "Presensi" },
  { value: "relawan", label: "Relawan" },
  { value: "prodi", label: "Program Studi" },
  { value: "jadwal", label: "Jadwal" },
  { value: "pergantian", label: "Pergantian" },
  { value: "materi", label: "Materi" },
  { value: "poin-apresiasi", label: "Poin Apresiasi" },
  { value: "rotm", label: "Relawan Terbaik" },
  { value: "laporan", label: "Laporan" },
  { value: "pengaturan", label: "Pengaturan" },
  { value: "periode", label: "Periode" },
];

const ACTION_COLOR = {
  create: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  update: "bg-sky-50 text-sky-700 ring-sky-200",
  delete: "bg-rose-50 text-rose-700 ring-rose-200",
  login: "bg-teal-50 text-teal-700 ring-teal-200",
  "change-password": "bg-amber-50 text-amber-700 ring-amber-200",
  "presensi-mulai": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "kirim-laporan": "bg-brand-50 text-brand ring-brand/20",
  "revisi-laporan": "bg-sky-50 text-sky-700 ring-sky-200",
  "download-materi": "bg-slate-100 text-slate-700 ring-slate-200",
  verify: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  correct: "bg-amber-50 text-amber-800 ring-amber-200",
  "reset-password": "bg-amber-50 text-amber-700 ring-amber-200",
  "view-evidence": "bg-slate-100 text-slate-600 ring-slate-200",
  "share-evidence": "bg-purple-50 text-purple-700 ring-purple-200",
};

export default function Audit() {
  const [entity, setEntity] = useState("");
  const t = usePaginated(API_ENDPOINTS.AUDIT, { entity });

  return (
    <div>
      <PageHeader
        icon={History}
        title="Riwayat Perubahan"
        subtitle="Log aktivitas permanen (tidak dapat diedit atau dihapus) mencatat pelaku, waktu, nilai sebelum/sesudah, dan alasan."
        actions={
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              const r = await request("get", API_ENDPOINTS.AUDIT_EXPORT);
              if (r?.data) exportAuditExcel(r.data);
            }}
          >
            <Download size={16} />
            Ekspor Excel
          </button>
        }
      />
      <DataTable
        t={t}
        searchPlaceholder="Cari pelaku, aksi, objek, atau alasan..."
        toolbar={
          <div className="w-full md:w-44">
            <AppSelect size="sm" isSearchable={false} options={ENTITY_OPTIONS} value={entity} onChange={setEntity} />
          </div>
        }
        columns={[
          {
            label: "Waktu",
            render: (r) => <span className="whitespace-nowrap font-mono text-xs text-slate-600">{r.created_at}</span>,
          },
          {
            label: "Pelaku",
            render: (r) => <span className="font-semibold text-slate-900">{r.actor}</span>,
          },
          {
            label: "Aksi",
            render: (r) => (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  ACTION_COLOR[r.action] || "bg-slate-100 text-slate-700 ring-slate-200"
                }`}
              >
                {r.action}
              </span>
            ),
          },
          {
            label: "Objek",
            render: (r) => (
              <span className="capitalize text-slate-700">
                {r.entity} {r.entity_id ? <span className="font-mono text-xs text-slate-400">#{r.entity_id}</span> : ""}
              </span>
            ),
          },
          { label: "Alasan", render: (r) => r.reason || "-" },
        ]}
      />
    </div>
  );
}
