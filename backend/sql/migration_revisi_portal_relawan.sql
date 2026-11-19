-- ========================================================================
-- TAXORA DATABASE MIGRATION SCRIPT
-- Fitur: Revisi Portal Relawan Tax Clinic & RENJANI
-- Tanggal: 19 November 2026
-- Database: taxora
-- ========================================================================

USE taxora;

-- ------------------------------------------------------------------------
-- 1. PROSEDUR PEMBANTU (IDEMPOTENT COLUMN ADDITION)
-- ------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DELIMITER //
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN colName VARCHAR(64),
    IN colDef VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = tableName
          AND COLUMN_NAME = colName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', colName, '` ', colDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- ------------------------------------------------------------------------
-- 2. PENAMBAHAN KOLOM PADA TABEL YANG SUDAH ADA
-- ------------------------------------------------------------------------

-- Tabel users: Foto profil, semester, kontak & penugasan unit
CALL AddColumnIfNotExists('users', 'profile_photo', 'VARCHAR(255) NULL COMMENT "Path foto profil pribadi"');
CALL AddColumnIfNotExists('users', 'semester', 'VARCHAR(20) NULL COMMENT "Data semester relawan (1-8)"');
CALL AddColumnIfNotExists('users', 'email', 'VARCHAR(120) NULL COMMENT "Email aktif relawan"');
CALL AddColumnIfNotExists('users', 'phone', 'VARCHAR(50) NULL COMMENT "Nomor WhatsApp / telepon"');
CALL AddColumnIfNotExists('users', 'program_id', 'INT NULL COMMENT "ID unit program penugasan"');

-- Tabel attendance: Bukti tangkapan layar web RENJANI & snapshot
CALL AddColumnIfNotExists('attendance', 'renjani_screenshot', 'VARCHAR(255) NULL COMMENT "Wajib bagi relawan program RENJANI"');
CALL AddColumnIfNotExists('attendance', 'custom_answers', 'JSON NULL');
CALL AddColumnIfNotExists('attendance', 'original_snapshot', 'JSON NULL');

-- Tabel materials: Gambar sampul materi (Visual Card Gallery)
CALL AddColumnIfNotExists('materials', 'cover_image', 'VARCHAR(255) NULL COMMENT "Gambar sampul / thumbnail visual modul"');

-- Tabel sessions: Nomor Surat Tugas untuk import massal Excel
CALL AddColumnIfNotExists('sessions', 'surat_tugas_no', 'VARCHAR(120) NULL COMMENT "Nomor Surat Tugas penugasan shift"');

-- Tabel programs: Pengaturan JSON
CALL AddColumnIfNotExists('programs', 'settings', 'JSON NULL');

-- Hapus prosedur pembantu setelah selesai digunakan
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- ------------------------------------------------------------------------
-- 3. PEMBUATAN TABEL BARU
-- ------------------------------------------------------------------------

-- Tabel 3.1: Pencatatan Detail Aktivitas Presensi & Wajib Pajak yang Dilayani
CREATE TABLE IF NOT EXISTS attendance_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attendance_id INT NOT NULL,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  program_id INT NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  wp_count INT NOT NULL DEFAULT 0,
  wp_name VARCHAR(150) NULL,
  wp_npwp VARCHAR(50) NULL,
  service_type VARCHAR(100) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_att_act_attendance (attendance_id),
  INDEX idx_att_act_user (user_id),
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 3.2: Pengumuman Terpadu, Reminder Jadwal, Panduan & Relawan Terbaik (ROTM)
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category ENUM('umum','rotm','panduan','urgent') NOT NULL DEFAULT 'umum',
  cover_image VARCHAR(255) NULL,
  attachment_url VARCHAR(255) NULL,
  is_popup TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  rotm_user_name VARCHAR(120) NULL,
  rotm_period VARCHAR(50) NULL,
  created_by INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ann_program_active (program_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 3.3: Periode Pembukaan Pengajuan Sesi Jaga Reguler (Admin)
CREATE TABLE IF NOT EXISTS schedule_submission_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  year INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_open TINYINT NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_by INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ssp_program_year (program_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel 3.4: Data Pengajuan Sesi Jaga Reguler Relawan (3 Pilihan Prioritas)
CREATE TABLE IF NOT EXISTS schedule_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NULL,
  program_id INT NOT NULL,
  user_id INT NOT NULL,
  year INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  nim VARCHAR(50) NOT NULL,
  prodi VARCHAR(120) NOT NULL,
  semester VARCHAR(20) NOT NULL,
  priority_1 VARCHAR(100) NOT NULL,
  priority_2 VARCHAR(100) NOT NULL,
  priority_3 VARCHAR(100) NOT NULL,
  reason TEXT NULL,
  status ENUM('diajukan','disetujui','ditolak') NOT NULL DEFAULT 'diajukan',
  admin_notes VARCHAR(255) NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ss_program_status (program_id, year, status),
  INDEX idx_ss_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 4. DATA INISIAL (SEEDS)
-- ------------------------------------------------------------------------

-- Pengumuman panduan awal (hanya diinsert jika tabel masih kosong)
INSERT INTO announcements (program_id, title, content, category, is_popup, active, created_by)
SELECT NULL, 
       'Panduan Wajib: Ketentuan Presensi Masuk & Keluar', 
       'Relawan wajib presensi masuk tepat waktu via kamera langsung. Presensi keluar maksimal 24 jam setelah sesi jaga berakhir dengan menyertakan bukti pendampingan.', 
       'panduan', 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE '%Panduan Wajib%');

INSERT INTO announcements (program_id, title, content, category, is_popup, active, created_by)
SELECT 2, 
       'Khusus Relawan RENJANI: Kewajiban Screenshot Pelaporan Web RENJANI', 
       'Bagi seluruh relawan penugasan RENJANI, presensi selesai wajib melampirkan screenshot bukti pelaporan aktivitas di web resmi RENJANI. Tanpa screenshot tersebut, presensi selesai tidak dapat diproses.', 
       'urgent', 0, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE '%Khusus Relawan RENJANI%');

-- Contoh periode pembukaan sesi jaga reguler jika belum ada
INSERT INTO schedule_submission_periods (program_id, year, title, start_date, end_date, is_open, notes, created_by)
SELECT 1, YEAR(CURRENT_DATE), 'Periode Pengajuan Jadwal Jaga Reguler Semester Berjalan', 
       DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), 
       DATE_FORMAT(LAST_DAY(CURRENT_DATE), '%Y-%m-%d'), 
       1, 'Silakan pilih 3 opsi prioritas sesi jaga mingguan Anda.', 1
WHERE NOT EXISTS (SELECT 1 FROM schedule_submission_periods WHERE year = YEAR(CURRENT_DATE));
