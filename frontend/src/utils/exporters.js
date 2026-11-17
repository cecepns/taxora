import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/utils/endpoints";

const MONTHS_ID = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function formatDateId(d = new Date()) {
  return `${d.getDate()} ${MONTHS_ID[d.getMonth() + 1]} ${d.getFullYear()}`;
}

async function loadImageAsDataUrl(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ---------- 1. Template & Parser Impor Excel Relawan ----------
export function downloadRelawanTemplate() {
  const rows = [
    { NIM: "41220001", Nama: "Budi Santoso", Prodi: "D-IV Akuntansi Sektor Publik", Program: "Tax Clinic", Peran: "relawan" },
    { NIM: "41220002", Nama: "Siti Rahma", Prodi: "D-III Pajak", Program: "Renjani", Peran: "relawan" },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 26 }, { wch: 28 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relawan");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "template_impor_relawan_taxora.xlsx"
  );
}

export async function parseRelawanExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Sheet Excel kosong");
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (matrix.length < 2) throw new Error("Data Excel kosong atau tidak memiliki baris data");

  const headers = matrix[0].map((h) => String(h ?? "").trim().toLowerCase());
  const colOf = (...names) => headers.findIndex((h) => h && names.some((n) => h.includes(n)));
  const cNim = colOf("nim");
  const cName = colOf("nama", "name");
  const cProdi = colOf("prodi", "program studi", "jurusan");
  const cProg = colOf("program");
  const cRole = colOf("peran", "role");

  if (cNim < 0 || cName < 0) {
    throw new Error("Kolom wajib 'NIM' dan 'Nama' tidak ditemukan di baris header");
  }

  return matrix
    .slice(1)
    .map((r, i) => ({
      rowNumber: i + 2,
      nim: String(r[cNim] ?? "").trim(),
      name: String(r[cName] ?? "").trim(),
      prodi: cProdi >= 0 ? String(r[cProdi] ?? "").trim() : "",
      program: cProg >= 0 ? String(r[cProg] ?? "").trim() : "",
      role: cRole >= 0 ? String(r[cRole] ?? "").trim() : "relawan",
    }))
    .filter((r) => r.nim || r.name);
}

// ---------- 2. Ekspor Excel Riwayat Perubahan ----------
export function exportAuditExcel(rows = []) {
  const formatted = rows.map((r) => ({
    Waktu: r.created_at,
    Pelaku: r.actor,
    Aksi: r.action,
    Objek: r.entity,
    "ID Objek": r.entity_id ?? "",
    Alasan: r.reason || "",
    Sebelum: typeof r.before_val === "string" ? r.before_val : JSON.stringify(r.before_val ?? ""),
    Sesudah: typeof r.after_val === "string" ? r.after_val : JSON.stringify(r.after_val ?? ""),
  }));
  const ws = XLSX.utils.json_to_sheet(formatted);
  ws["!cols"] = [
    { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
    { wch: 10 }, { wch: 30 }, { wch: 32 }, { wch: 32 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat Perubahan");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "Riwayat_Perubahan_TAXORA.xlsx"
  );
}

// ---------- 3. Ekspor Laporan Bulanan XLSX ----------
function buildMonthlyXlsxArray(dataset) {
  const headers = [
    "Relawan", "NIM", "Prodi", "Tanggal", "Sesi", "Waktu Mulai", "Waktu Selesai",
    "Status Kehadiran", "Terlambat (mnt)", "Jumlah WP", "Status Lokasi",
    "Foto Presensi", "Excel Pendampingan", "Bukti BPE SPT", "Bukti Laporan", "Status Verifikasi",
  ];
  const aoa = [headers];
  const rows = dataset.rows || [];

  rows.forEach((r) => {
    aoa.push([
      r.name,
      r.nim,
      r.prodi || "-",
      r.date,
      r.session_no,
      r.start_at || "-",
      r.end_at || "-",
      r.attendance_status,
      r.late_minutes ?? "-",
      r.wp_count ?? 0,
      r.attendance_id ? (r.gps_valid ? "Valid" : "Tidak tervalidasi") : "-",
      r.links?.photo ? "Buka Foto" : "-",
      r.links?.excel ? "Buka Excel" : "-",
      r.links?.bpe ? "Buka BPE" : "-",
      r.links?.report ? "Buka Laporan" : "-",
      r.verify_status || "-",
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 13 }, { wch: 8 }, { wch: 19 }, { wch: 19 },
    { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ];

  // Tambahkan hyperlink yang bisa diklik pada kolom bukti (L, M, N, O)
  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const linkCols = [
      ["L", r.links?.photo],
      ["M", r.links?.excel],
      ["N", r.links?.bpe],
      ["O", r.links?.report],
    ];
    linkCols.forEach(([col, url]) => {
      if (url && ws[`${col}${rowNum}`]) {
        ws[`${col}${rowNum}`].l = { Target: url };
      }
    });
  });

  const wb = XLSX.utils.book_new();
  const sheetTitle = `${dataset.program.name} ${dataset.monthName} ${dataset.year}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function exportMonthlyXlsx(dataset) {
  const ym = `${dataset.year}-${String(dataset.month).padStart(2, "0")}`;
  const safeProg = dataset.program.name.replace(/\s+/g, "_");
  const out = buildMonthlyXlsxArray(dataset);
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Laporan_${safeProg}_${ym}.xlsx`
  );
}

// ---------- 4. Ekspor Laporan Bulanan DOCX ----------
export async function exportMonthlyDocx(dataset) {
  const ym = `${dataset.year}-${String(dataset.month).padStart(2, "0")}`;
  const safeProg = dataset.program.name.replace(/\s+/g, "_");
  const sumRows = [
    ["Total Penugasan", String(dataset.summary?.total_penugasan ?? 0)],
    ["Hadir", String(dataset.summary?.hadir ?? 0)],
    ["Tidak Hadir", String(dataset.summary?.tidak_hadir ?? 0)],
    ["Digantikan", String(dataset.summary?.diganti ?? 0)],
    ["Terlambat", String(dataset.summary?.terlambat ?? 0)],
    ["Total WP Dilayani", String(dataset.summary?.total_wp ?? 0)],
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `LAPORAN BULANAN RELAWAN ${dataset.program.name.toUpperCase()}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Tax Center PKN STAN — Periode ${dataset.monthName} ${dataset.year}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Nomor Surat: ${dataset.meta?.letter_no || "-"}`,
            spacing: { before: 240, after: 180 },
          }),
          new Paragraph({
            text: dataset.meta?.narrative || "",
            spacing: { after: 280 },
          }),
          new Paragraph({
            text: "Ringkasan Operasional",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 120 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: sumRows.map(
              ([k, v]) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
                    new TableCell({ children: [new Paragraph(v)] }),
                  ],
                })
            ),
          }),
          new Paragraph({ text: "", spacing: { before: 480 } }),
          new Paragraph({
            text: `Tangerang Selatan, ${formatDateId(new Date())}`,
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            text: dataset.meta?.signatory_title || "Kepala Tax Center PKN STAN",
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({ text: "", spacing: { before: 600 } }),
          new Paragraph({
            children: [new TextRun({ text: dataset.meta?.signatory_name || "Ketua Tax Center PKN STAN", bold: true })],
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `Laporan_${safeProg}_${ym}.docx`);
}

// ---------- 5. Ekspor Laporan Bulanan PDF (Layout Resmi & Rapi di FE) ----------
const PDF_STATUS = {
  final: { label: "FINAL", bg: [220, 252, 231], text: [22, 101, 52], border: [134, 239, 172] },
  draft: { label: "DRAFT", bg: [254, 243, 199], text: [146, 64, 14], border: [252, 211, 77] },
  perlu_diperbarui: { label: "PERLU DIPERBARUI", bg: [255, 228, 230], text: [159, 18, 57], border: [253, 164, 175] },
};

export async function exportMonthlyPdf(dataset) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm
  const marginL = 15;
  const contentW = pageW - marginL * 2; // 180mm
  const printedDate = formatDateId(new Date());

  // 1. Strip warna brand & emas di atas
  doc.setFillColor(14, 90, 124);
  doc.rect(0, 0, pageW, 3.2, "F");
  doc.setFillColor(242, 161, 0);
  doc.rect(0, 3.2, pageW, 1.1, "F");

  // 2. Kop Surat
  let y = 10;
  const logoData = await loadImageAsDataUrl("/logo.jpeg");
  if (logoData) {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(marginL, y, 18, 18, 2.5, 2.5, "FD");
    doc.addImage(logoData, "JPEG", marginL + 1.5, y + 1.5, 15, 15);
  }

  const textX = logoData ? marginL + 22 : marginL;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(14, 90, 124);
  doc.text("TAX CENTER POLITEKNIK KEUANGAN NEGARA STAN", textX, y + 4.5);

  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`LAPORAN BULANAN ${dataset.program.name.toUpperCase()}`, textX, y + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode ${dataset.monthName} ${dataset.year}  •  Sistem Operasional Relawan TAXORA`, textX, y + 15.8);

  // Status badge di kanan atas
  const st = PDF_STATUS[dataset.meta?.status] || PDF_STATUS.draft;
  const badgeW = 34;
  const badgeX = marginL + contentW - badgeW;
  doc.setFillColor(...st.bg);
  doc.setDrawColor(...st.border);
  doc.roundedRect(badgeX, y + 2.5, badgeW, 7.5, 3.5, 3.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...st.text);
  doc.text(st.label, badgeX + badgeW / 2, y + 7.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`Versi ${dataset.meta?.version || 1}`, badgeX + badgeW / 2, y + 14, { align: "center" });

  // Garis pemisah ganda
  y += 22;
  doc.setDrawColor(14, 90, 124);
  doc.setLineWidth(0.6);
  doc.line(marginL, y, marginL + contentW, y);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(marginL, y + 1.2, marginL + contentW, y + 1.2);
  y += 6;

  // 3. Blok Metadata 2 Kolom
  const metaH = 21;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginL, y, contentW, metaH, 2.5, 2.5, "FD");
  doc.line(marginL + contentW / 2, y + 3, marginL + contentW / 2, y + metaH - 3);

  const leftMeta = [
    ["Nomor Surat", dataset.meta?.letter_no || "-"],
    ["Program", dataset.program.name],
    ["Periode", `${dataset.monthName} ${dataset.year}`],
  ];
  const rightMeta = [
    ["Status Dokumen", `${st.label} (v${dataset.meta?.version || 1})`],
    ["Tanggal Cetak", printedDate],
    ["Total Baris Data", `${(dataset.rows || []).length} penugasan`],
  ];

  leftMeta.forEach(([k, v], i) => {
    const ry = y + 5.8 + i * 5.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(100, 116, 139);
    doc.text(k, marginL + 4, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`:  ${v}`, marginL + 30, ry);
  });

  const col2X = marginL + contentW / 2 + 4;
  rightMeta.forEach(([k, v], i) => {
    const ry = y + 5.8 + i * 5.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(100, 116, 139);
    doc.text(k, col2X, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`:  ${v}`, col2X + 28, ry);
  });
  y += metaH + 7;

  const drawSectionHeading = (title) => {
    doc.setFillColor(14, 90, 124);
    doc.roundedRect(marginL, y, 1.5, 5, 0.7, 0.7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(14, 90, 124);
    doc.text(title, marginL + 4, y + 4);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginL, y + 6.5, marginL + contentW, y + 6.5);
    y += 10.5;
  };

  // 4. Narasi Laporan
  drawSectionHeading("I. Ringkasan Eksekutif");
  const narrative = (dataset.meta?.narrative || "").trim() ||
    `Laporan operasional bulanan kegiatan relawan ${dataset.program.name} periode ${dataset.monthName} ${dataset.year}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const narLines = doc.splitTextToSize(narrative, contentW);
  doc.text(narLines, marginL, y, { align: "left", lineHeightFactor: 1.45 });
  y += narLines.length * 4.8 + 5;

  // 5. Ringkasan Operasional (6 Kartu KPI dalam grid 3x2)
  drawSectionHeading("II. Ringkasan Operasional");
  const s = dataset.summary || {};
  const kpis = [
    { label: "Total Penugasan", value: s.total_penugasan ?? 0, accent: [14, 90, 124], bg: [240, 247, 250] },
    { label: "Hadir", value: s.hadir ?? 0, accent: [5, 150, 105], bg: [236, 253, 245] },
    { label: "Terlambat", value: s.terlambat ?? 0, accent: [217, 119, 6], bg: [255, 251, 235] },
    { label: "Digantikan", value: s.diganti ?? 0, accent: [2, 132, 199], bg: [240, 249, 255] },
    { label: "Tidak Hadir", value: s.tidak_hadir ?? 0, accent: [225, 29, 72], bg: [255, 241, 242] },
    { label: "Total WP Dilayani", value: s.total_wp ?? 0, accent: [79, 70, 229], bg: [238, 242, 255] },
  ];

  const gap = 4;
  const cardW = (contentW - gap * 2) / 3;
  const cardH = 18;
  kpis.forEach((kpi, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = marginL + col * (cardW + gap);
    const cy = y + row * (cardH + gap);

    doc.setFillColor(...kpi.bg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cy, cardW, cardH, 2.5, 2.5, "FD");
    doc.setFillColor(...kpi.accent);
    doc.roundedRect(cx, cy, 1.6, cardH, 0.8, 0.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...kpi.accent);
    doc.text(Number(kpi.value).toLocaleString("id-ID"), cx + 5, cy + 8.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, cx + 5, cy + 14.5);
  });
  y += cardH * 2 + gap + 8;

  // 6. Tabel Rincian Presensi & Pendampingan (autoTable)
  if (y > 235) {
    doc.addPage();
    y = 18;
  }
  drawSectionHeading("III. Rincian Presensi & Pendampingan");

  const tableRows = (dataset.rows || []).map((r, idx) => [
    String(idx + 1),
    `${r.date || "-"}\nSesi ${r.session_no}`,
    `${r.name || "-"}\n${r.nim || "-"}`,
    r.attendance_status || "-",
    r.late_minutes !== null && r.late_minutes !== undefined ? `${r.late_minutes} mnt` : "-",
    String(r.wp_count ?? 0),
    r.attendance_id ? (r.gps_valid ? "Valid" : "Tdk Valid") : "-",
    r.verify_status ? r.verify_status.charAt(0).toUpperCase() + r.verify_status.slice(1) : "-",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginL, bottom: 20 },
    head: [["No", "Tanggal / Sesi", "Relawan (NIM)", "Kehadiran", "Terlambat", "WP", "Lokasi", "Verifikasi"]],
    body: tableRows.length ? tableRows : [[{ content: "Belum ada data penugasan atau presensi pada periode ini.", colSpan: 8, styles: { halign: "center", fontStyle: "italic", textColor: [148, 163, 184] } }]],
    theme: "grid",
    headStyles: {
      fillColor: [14, 90, 124],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.8,
      halign: "center",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.6,
      textColor: [30, 41, 59],
      cellPadding: 2.4,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: 26 },
      2: { cellWidth: 50 },
      3: { cellWidth: 28 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 12, fontStyle: "bold", textColor: [14, 90, 124] },
      6: { halign: "center", cellWidth: 18 },
      7: { halign: "center", cellWidth: 19, fontStyle: "bold" },
    },
  });

  // 7. Blok Tanda Tangan
  let sigY = (doc.lastAutoTable?.finalY || y) + 12;
  if (sigY + 38 > pageH - 18) {
    doc.addPage();
    sigY = 22;
  }
  const sigCenterX = marginL + contentW - 38;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tangerang Selatan, ${printedDate}`, sigCenterX, sigY, { align: "center" });
  doc.setTextColor(51, 65, 85);
  doc.text(dataset.meta?.signatory_title || "Kepala Tax Center PKN STAN", sigCenterX, sigY + 5, { align: "center" });

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(sigCenterX - 30, sigY + 28, sigCenterX + 30, sigY + 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  doc.text(dataset.meta?.signatory_name || "Ketua Tax Center PKN STAN", sigCenterX, sigY + 33, { align: "center" });

  // 8. Footer di setiap halaman
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footY = pageH - 10;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginL, footY - 4, marginL + contentW, footY - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `TAXORA — Tax Center PKN STAN  |  ${dataset.program.name} (${dataset.monthName} ${dataset.year})`,
      marginL,
      footY
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(`Halaman ${i} dari ${totalPages}`, marginL + contentW, footY, { align: "right" });
  }

  const ym = `${dataset.year}-${String(dataset.month).padStart(2, "0")}`;
  const safeProg = dataset.program.name.replace(/\s+/g, "_");
  doc.save(`Laporan_${safeProg}_${ym}.pdf`);
}

// ---------- 6. Ekspor Paket ZIP Bukti + Excel Ringkasan (di FE via JSZip) ----------
export async function exportMonthlyZip(dataset, zipGroup = "relawan") {
  const ym = `${dataset.year}-${String(dataset.month).padStart(2, "0")}`;
  const safeProg = dataset.program.name.replace(/\s+/g, "_");
  const zip = new JSZip();

  // Sertakan ringkasan Excel di dalam ZIP
  const excelBytes = buildMonthlyXlsxArray(dataset);
  zip.file(`Ringkasan_${safeProg}_${ym}.xlsx`, excelBytes);

  const fields = [
    ["photo", "foto", "photo"],
    ["ev_excel", "excel", "excel"],
    ["ev_bpe", "bpe", "bpe"],
    ["ev_report", "laporan", "report"],
  ];

  for (const r of dataset.rows || []) {
    if (!r.attendance_id) continue;
    const cleanName = String(r.name || "relawan").replace(/[^a-zA-Z0-9]+/g, "_");
    for (const [col, label, fieldKey] of fields) {
      if (!r[col]) continue;
      try {
        const res = await api.get(API_ENDPOINTS.PRESENSI.EVIDENCE(r.attendance_id, fieldKey), {
          responseType: "blob",
        });
        const ext = r.exts?.[fieldKey] || ".bin";
        const fileName = `${ym}_${r.nim}_${cleanName}_${r.date}_sesi${r.session_no}_${label}${ext}`;
        const folder = zipGroup === "tanggal" ? r.date : `${r.nim}_${cleanName}`;
        zip.file(`${folder}/${fileName}`, res.data);
      } catch {
        // lewati jika file tidak tersedia
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `Bukti_${safeProg}_${ym}.zip`);
}
