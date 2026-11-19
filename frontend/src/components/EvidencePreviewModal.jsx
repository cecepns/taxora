import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Modal from "@/components/Modal";
import { fetchBlobUrl, downloadFile, getAuthenticatedUrl } from "@/utils/request";

export default function EvidencePreviewModal({
  open,
  onClose,
  title = "Pratinjau Dokumen & Bukti",
  url,
  fieldName = "Dokumen",
}) {
  const [loading, setLoading] = useState(false);
  const [blobData, setBlobData] = useState(null);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (open && url) {
      setLoading(true);
      setError(false);
      setBlobData(null);
      setZoomed(false);

      fetchBlobUrl(url)
        .then((res) => {
          if (res) {
            setBlobData(res);
          }
        })
        .catch(() => {
          // If blob fetch fails, direct authUrl might still work
        })
        .finally(() => setLoading(false));
    } else {
      if (blobData?.url) URL.revokeObjectURL(blobData.url);
      setBlobData(null);
      setError(false);
      setZoomed(false);
    }

    return () => {
      if (blobData?.url) URL.revokeObjectURL(blobData.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  if (!open) return null;

  const authUrl = getAuthenticatedUrl(url);
  const lowerUrl = (url || "").toLowerCase();
  const lowerField = (fieldName || "").toLowerCase();

  const isExcel =
    blobData?.type?.includes("spreadsheet") ||
    blobData?.type?.includes("excel") ||
    /\.(xlsx|xls|csv)$/i.test(lowerUrl) ||
    lowerField.includes("excel") ||
    lowerUrl.includes("/excel");

  const isExplicitImage =
    blobData?.type?.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|heic|heif|svg)$/i.test(lowerUrl) ||
    lowerField.includes("foto") ||
    lowerField.includes("photo") ||
    lowerField.includes("screenshot") ||
    lowerField.includes("renjani") ||
    lowerUrl.includes("/photo") ||
    lowerUrl.includes("/renjani") ||
    lowerUrl.includes("/cover");

  const isExplicitPdf =
    blobData?.type === "application/pdf" ||
    /\.pdf$/i.test(lowerUrl) ||
    lowerField.includes("pdf") ||
    lowerField.includes("bpe") ||
    lowerField.includes("laporan") ||
    lowerField.includes("report") ||
    lowerUrl.includes("/bpe") ||
    lowerUrl.includes("/report") ||
    lowerUrl.includes("materi");

  const isImage =
    !isExcel &&
    (blobData?.type?.startsWith("image/") ||
      (isExplicitImage && blobData?.type !== "application/pdf"));

  const isPdf =
    !isExcel &&
    !isImage &&
    (blobData?.type === "application/pdf" || isExplicitPdf);

  const handleDownload = () => {
    const filename = fieldName.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    downloadFile(url, { download: 1 }, filename);
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
              <p className="mt-1 text-xs text-rose-600">
                Dokumen mungkin memiliki format khusus atau browser membatasi tampilan langsung.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn !bg-rose-600 hover:!bg-rose-700 text-white"
                onClick={handleDownload}
              >
                <Download size={15} /> Unduh File Langsung
              </button>
              {authUrl && (
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  <ExternalLink size={15} /> Buka di Tab Baru
                </a>
              )}
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900/5">
            {isImage ? (
              <div className="flex flex-col bg-slate-950 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ImageIcon size={14} className="text-sky-400" />
                    {fieldName}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoomed(!zoomed)}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-slate-200 hover:bg-slate-700 transition"
                      title={zoomed ? "Ukuran Pas" : "Perbesar Penuh"}
                    >
                      {zoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
                      <span>{zoomed ? "Kecilkan" : "Perbesar"}</span>
                    </button>
                    <a
                      href={authUrl || blobData?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-sky-600/80 px-2.5 py-1 font-semibold text-white hover:bg-sky-500 transition"
                      title="Buka gambar di tab baru"
                    >
                      <ExternalLink size={12} /> Tab Baru
                    </a>
                  </div>
                </div>
                <div
                  className={`flex items-center justify-center overflow-auto p-3 ${
                    zoomed ? "max-h-[82vh]" : "max-h-[68vh]"
                  }`}
                >
                  <img
                    src={authUrl || blobData?.url}
                    alt={fieldName}
                    className={`rounded-xl object-contain shadow-2xl transition duration-150 ${
                      zoomed ? "max-h-none w-auto max-w-none cursor-zoom-out" : "max-h-[64vh] w-auto max-w-full cursor-zoom-in"
                    }`}
                    onClick={() => setZoomed(!zoomed)}
                    onError={(e) => {
                      if (blobData?.url && e.currentTarget.src !== blobData.url) {
                        e.currentTarget.src = blobData.url;
                      } else {
                        setError(true);
                      }
                    }}
                  />
                </div>
              </div>
            ) : isPdf ? (
              <div className="relative h-[72vh] w-full bg-slate-100 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700">
                  <span className="font-semibold flex items-center gap-1.5">
                    <FileText size={14} className="text-brand" />
                    Pratinjau PDF {fieldName}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={authUrl || blobData?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1 font-semibold text-white shadow-sm hover:bg-brand-dark transition"
                      title="Buka dokumen di tab baru jika browser Safari membatasi frame"
                    >
                      <ExternalLink size={12} /> Buka PDF di Tab Baru
                    </a>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Download size={12} /> Unduh
                    </button>
                  </div>
                </div>

                <div className="relative flex-1 w-full bg-slate-200">
                  <object
                    data={`${authUrl || blobData?.url}#toolbar=1`}
                    type="application/pdf"
                    className="h-full w-full"
                  >
                    <iframe
                      src={`${authUrl || blobData?.url}#toolbar=1`}
                      title={fieldName}
                      className="h-full w-full border-0"
                    >
                      <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-white">
                        <FileText size={42} className="text-brand mb-3" />
                        <p className="font-semibold text-slate-800">
                          Pratinjau PDF tidak dapat ditampilkan langsung di dalam frame browser ini.
                        </p>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm mb-4">
                          Safari di Mac atau perangkat iOS memerlukan pembukaan tab baru untuk membaca PDF secara utuh.
                        </p>
                        <a
                          href={authUrl || blobData?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                        >
                          <ExternalLink size={15} /> Buka Dokumen PDF di Tab Baru
                        </a>
                      </div>
                    </iframe>
                  </object>
                </div>
              </div>
            ) : isExcel ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center bg-emerald-50/40 rounded-2xl border border-emerald-100 p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                  <FileSpreadsheet size={36} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">
                    Dokumen Spreadsheet Excel (.xlsx / .csv)
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-md">
                    File spreadsheet pendampingan Wajib Pajak tidak dapat dipratinjau langsung di dalam peramban. Silakan unduh untuk membuka di Microsoft Excel atau Google Sheets.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn !bg-emerald-600 hover:!bg-emerald-700 text-white shadow-md"
                  onClick={handleDownload}
                >
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
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={handleDownload}>
                    <Download size={16} /> Unduh Dokumen
                  </button>
                  {authUrl && (
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost"
                    >
                      <ExternalLink size={16} /> Buka di Tab Baru
                    </a>
                  )}
                </div>
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
            {authUrl && (
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost !rounded-xl !px-3 !py-2 text-xs inline-flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Buka di Tab Baru
              </a>
            )}
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
