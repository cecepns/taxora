-- ========================================================================
-- TAXORA DATABASE MIGRATION SCRIPT
-- Fitur: Revisi Fitur Pengajuan Sesi Jaga, Galeri Pengumuman & Presensi 24 Jam
-- Tanggal: 20 November 2026
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
-- 2. PENAMBAHAN KOLOM BARU
-- ------------------------------------------------------------------------

-- 2.1. Tabel attendance: Flag izin khusus presensi selesai > 24 jam oleh Admin
CALL AddColumnIfNotExists('attendance', 'allow_late_finish', 'TINYINT NOT NULL DEFAULT 0 COMMENT "1 jika Admin mengizinkan presensi selesai lewat 24 jam"');

-- 2.2. Tabel announcements: Galeri foto tambahan (bisa lebih dari 1 foto)
CALL AddColumnIfNotExists('announcements', 'gallery_images', 'JSON NULL COMMENT "Array path JSON foto-foto galeri pengumuman"');

-- 2.3. Tabel schedule_submission_periods: Konfigurasi sesi (jumlah sesi & rentang waktu)
CALL AddColumnIfNotExists('schedule_submission_periods', 'session_config', 'JSON NULL COMMENT "Konfigurasi rentang jam dan kuota tiap sesi jaga"');

-- Hapus prosedur pembantu setelah selesai digunakan
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- ------------------------------------------------------------------------
-- 3. PENYESUAIAN PROGRAM_ID PADA PERIODE PENGAJUAN (DUKUNGAN SEMUA PROGRAM)
-- ------------------------------------------------------------------------
ALTER TABLE schedule_submission_periods MODIFY COLUMN program_id INT NULL DEFAULT 0 COMMENT "0 atau NULL untuk Semua Program (Tax Clinic & Renjani)";

-- ------------------------------------------------------------------------
-- 4. INDEKS TAMBAHAN UNTUK PERFORMA QUERY
-- ------------------------------------------------------------------------
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'substitutions' AND INDEX_NAME = 'idx_substitutions_date');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_substitutions_session ON substitutions(session_id)', 'SELECT "Index already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Selesai
SELECT "Migrasi 20261120_revisi_fitur_pengajuan_dan_presensi berhasil dijalankan!" AS status;
