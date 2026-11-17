import { useCallback, useEffect, useRef, useState } from "react";
import Compressor from "compressorjs";
import toast from "react-hot-toast";
import { AlertCircle, Camera, CheckCircle2, Loader2, RefreshCw, RotateCcw, Send } from "lucide-react";
import Modal from "@/components/Modal";

const MAX_BYTES = 350 * 1024; // 350 KB

function runCompressor(file, options) {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      ...options,
      mimeType: "image/jpeg",
      convertSize: 0,
      success: resolve,
      error: reject,
    });
  });
}

// Kompresi bertahap menggunakan compressorjs hingga ukuran <= 350 KB
async function compressToMax350KB(blob) {
  const presets = [
    { quality: 0.8, maxWidth: 1280, maxHeight: 1280 },
    { quality: 0.68, maxWidth: 1080, maxHeight: 1080 },
    { quality: 0.56, maxWidth: 960, maxHeight: 960 },
    { quality: 0.45, maxWidth: 800, maxHeight: 800 },
    { quality: 0.35, maxWidth: 640, maxHeight: 640 },
    { quality: 0.25, maxWidth: 512, maxHeight: 512 },
  ];

  let result = blob;
  for (const preset of presets) {
    result = await runCompressor(blob, preset);
    if (result.size <= MAX_BYTES) break;
  }

  if (result.size > MAX_BYTES) {
    throw new Error("Foto tidak dapat dikompres di bawah 350 KB. Coba ambil ulang dengan pencahayaan lebih baik.");
  }

  return new File([result], `presensi_${Date.now()}.jpg`, { type: "image/jpeg" });
}

export default function CameraCaptureModal({ open, session, busy, onClose, onConfirm }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("user");
  const [camError, setCamError] = useState("");
  const [starting, setStarting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [capturedFile, setCapturedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCamError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Browser tidak mendukung akses kamera langsung. Gunakan browser modern (Chrome/Safari/Edge) via HTTPS atau localhost.");
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { });
      }
    } catch (err) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCamError("Izin kamera ditolak. Presensi wajib menggunakan kamera langsung — silakan izinkan akses kamera pada browser lalu klik Coba Lagi.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setCamError("Perangkat kamera tidak ditemukan. Pastikan perangkat memiliki kamera aktif.");
      } else {
        setCamError("Gagal membuka kamera. Pastikan kamera tidak sedang dipakai aplikasi lain.");
      }
    } finally {
      setStarting(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (open && !capturedFile) {
      startCamera();
    } else if (!open) {
      stopCamera();
      setCapturedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setCamError("");
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode, capturedFile]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return toast.error("Kamera belum siap, tunggu sebentar");
    }

    setCompressing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const rawBlob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal mengambil gambar"))), "image/jpeg", 0.92)
      );

      const compressedFile = await compressToMax350KB(rawBlob);
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(compressedFile));
      setCapturedFile(compressedFile);
    } catch (err) {
      toast.error(err?.message || "Gagal mengambil & mengompres foto");
    } finally {
      setCompressing(false);
    }
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setCapturedFile(null);
  };

  const handleClose = () => {
    if (busy) return;
    stopCamera();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Presensi Mulai — Kamera Wajib"
      subtitle={session ? `${session.date} • Sesi ${session.session_no} (${session.start_time?.slice(0, 5)}–${session.end_time?.slice(0, 5)})` : ""}
      onClose={handleClose}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-[4/3] flex items-center justify-center">
          {capturedFile && previewUrl ? (
            <>
              <img src={previewUrl} alt="Pratinjau foto presensi" className="h-full w-full object-cover" />
            </>
          ) : camError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
                <AlertCircle size={26} />
              </div>
              <p className="text-sm leading-relaxed text-slate-200">{camError}</p>
              <button type="button" className="btn !bg-white !text-brand hover:!bg-slate-100" onClick={startCamera}>
                <RefreshCw size={15} />
                Coba Buka Kamera Lagi
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
              />
              {starting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-white">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-xs font-medium">Membuka kamera...</span>
                </div>
              )}
              {!starting && (
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Kamera Langsung Aktif
                </div>
              )}
              {!starting && (
                <button
                  type="button"
                  title="Ganti kamera depan/belakang"
                  onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" disabled={busy} onClick={handleClose}>
            Batal
          </button>

          {capturedFile ? (
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={handleRetake}>
                <RotateCcw size={15} />
                Ulangi Foto
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => onConfirm(capturedFile)}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {busy ? "Mengunggah..." : "Kirim Presensi"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={starting || compressing || !!camError}
              onClick={handleCapture}
            >
              {compressing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {compressing ? "Mengompres..." : "Ambil Foto"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
