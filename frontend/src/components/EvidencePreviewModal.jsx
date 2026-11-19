import { useEffect, useState } from "react";
import { Download, ExternalLink, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Maximize2, X } from "lucide-react";
import Modal from "@/components/Modal";
import { fetchBlobUrl, downloadFile, getAuthenticatedUrl } from "@/utils/request";

export default function EvidencePreviewModal({ open, onClose, title = "Pratinjau Dokumen & Bukti", url, fieldName = "Dokumen" }) {
  const [loading, setLoading] = useState(false);
  const [blobData, setBlobData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open && url) {
      setLoading(true);
      setError(false);
      setBlobData(null);
      fetchBlobUrl(url)
        .then((res) => {
          if (res) {
            setBlobData(res);
          } else {
            setError(true);
          }
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    } else {
      if (blobData?.url) URL.revokeObjectURL(blobData.url);
      setBlobData(null);
      setError(false);
    }
    return () => {
      if (blobData?.url) URL.revokeObjectURL(blobData.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  if (!open) return null;

  const isImage = blobData?.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(url);
  const isPdf = blobData?.type === "application/pdf" || /\.pdf$/i.test(url);
  const isExcel =
    blobData?.type?.includes("spreadsheet") ||
    blobData?.type?.includes("excel") ||
    /\.(xlsx|xls|csv)$/i.test(url) ||
    fieldName.toLowerCase().includes("excel");

  const handleDownload = () => {
    downloadFile(url, { download: 1 }, `${fieldName.toLowerCase().replace(/\s+/g, "_")}`);
  };

  const handleOpenNewTab = () => {
    const authUrl = getAuthenticatedUrl(url);
    if (authUrl) {
      window.open(authUrl, "_blank");
    } else if (blobData?.url) {
      window.open(blobData.url, "_blank");
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      subtitle={fieldName ? `Jenis Bukti: ${fieldName}` : ""}
      onClose={onClose}
      maxWidth={isPdf ? "max-w-4xl" : "max-w-3xl"}
    >
      <div className="space-y-4">
        {loading && (
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 text-slate-500">
            <Loader2 className="animate-spin text-brand" size={32} />
            <span className="text-sm font-semibold">Memuat dokumen / file bukti...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center text-rose-700">
            <FileText size={36} className="text-rose-400" />
            <div>
              <div className="font-bold">Gagal Menampilkan Pratinjau Dokumen</div>
              <p className="mt-1 text-xs text-rose-600">Dokumen mungkin memiliki format biner atau tidak dapat dipratinjau langsung di browser.</p>
            </div>
            <button type="button" className="btn !bg-rose-600 hover:!bg-rose-700 text-white" onClick={handleDownload}>
              <Download size={15} /> Unduh File Langsung
            </button>
          </div>
        )}

        {!loading && !error && blobData && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900/5">
            {isImage ? (
              <div className="flex max-h-[72vh] items-center justify-center overflow-auto bg-slate-950 p-2 rounded-2xl">
                <img
                  src={blobData.url}
                  alt={fieldName}
                  className="max-h-[68vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
                  onError={(e) => {
                    const fallback = getAuthenticatedUrl(url);
                    if (fallback && e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
              </div>
            ) : isPdf ? (
              <div className="relative h-[72vh] w-full bg-slate-100 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-600">
                  <span className="font-medium">Pratinjau PDF {fieldName}</span>
                  <a
                    href={getAuthenticatedUrl(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                    title="Buka PDF di tab baru jika browser Safari tidak menampilkan isi dokumen"
                  >
                    Buka PDF di Tab Baru <ExternalLink size={12} />
                  </a>
                </div>
                <iframe
                  src={`${blobData.url}#toolbar=1`}
                  title={fieldName}
                  className="h-full w-full border-0"
                />
              </div>
            ) : isExcel ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center bg-emerald-50/40 rounded-2xl border border-emerald-100 p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                  <FileSpreadsheet size={36} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Dokumen Spreadsheet Excel (.xlsx / .csv)</h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-md">
                    File spreadsheet pendampingan Wajib Pajak tidak dapat dipratinjau langsung dalam tab peramban. Silakan klik tombol di bawah untuk mengunduh.
                  </p>
                </div>
                <button type="button" className="btn !bg-emerald-600 hover:!bg-emerald-700 text-white shadow-md" onClick={handleDownload}>
                  <Download size={16} /> Unduh File Excel
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center bg-slate-50 rounded-2xl p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-brand shadow-sm">
                  <FileText size={36} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Dokumen Terlampir</h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-md">
                    File dokumen siap diunduh atau dibuka menggunakan aplikasi pembaca dokumen di perangkat Anda.
                  </p>
                </div>
                <button type="button" className="btn" onClick={handleDownload}>
                  <Download size={16} /> Unduh Dokumen
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost !rounded-xl !px-3 !py-2 text-xs"
              onClick={handleDownload}
            >
              <Download size={14} /> Unduh File
            </button>
            <button
              type="button"
              className="btn-ghost !rounded-xl !px-3 !py-2 text-xs"
              onClick={handleOpenNewTab}
            >
              <ExternalLink size={14} /> Buka di Tab Baru
            </button>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
