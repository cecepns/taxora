# TAXORA - Tax Center PKN STAN
Tax Center Operational & Volunteer Resource Application.

## Menjalankan
1. MySQL: `mysql -u root -p < backend/sql/database.sql`
2. Backend: `cd backend && cp .env.example .env` (isi DB & JWT_SECRET) lalu `npm i && npm run dev`. Admin awal dibuat otomatis dari ADMIN_NIM/ADMIN_PASSWORD di .env.
3. Frontend: `cd frontend && cp .env.example .env && npm i && npm run dev`.

## Alur
Admin Pusat login -> tambah pengurus per program (menu Relawan, peran Pengurus) -> pengurus tambah relawan (password awal `NIM@taxora`, wajib diganti) -> buat jadwal -> relawan presensi -> pengurus verifikasi.
Bukti wajib per program ada di kolom `programs.required_evidence` (Tax Clinic: excel, bpe, report; Renjani: kosong).

## Belum termasuk
Impor Excel massal, pergantian relawan, Pusat Materi, laporan XLSX/DOCX/PDF/ZIP, Relawan of the Month, UI tutup tahun (API `/api/periods/close` sudah ada), tautan bukti berbatas waktu.
# taxora
