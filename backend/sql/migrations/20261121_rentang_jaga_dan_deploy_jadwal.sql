-- ========================================================================
-- TAXORA DATABASE MIGRATION SCRIPT
-- Fitur: Pemisahan Rentang Pembukaan Form & Rentang Tugas Jaga,
--        Pilihan Prioritas Tanggal Spesifik, dan Deploy ke Jadwal Resmi
-- Tanggal: 21 November 2026
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
-- 2. PENAMBAHAN KOLOM PERIODE DINAS JAGA PADA schedule_submission_periods
-- ------------------------------------------------------------------------
-- duty_start_date & duty_end_date: Rentang tanggal dinas jaga (misal 30 hari penugasan),
-- terpisah dari start_date & end_date (rentang pembukaan form pengajuan, misal 3 hari).
CALL AddColumnIfNotExists('schedule_submission_periods', 'duty_start_date', 'DATE NULL COMMENT "Tanggal mulai dinas jaga (30 hari)"');
CALL AddColumnIfNotExists('schedule_submission_periods', 'duty_end_date', 'DATE NULL COMMENT "Tanggal selesai dinas jaga"');

-- ------------------------------------------------------------------------
-- 3. PENAMBAHAN KOLOM DEPLOY & TANGGAL PRIORITAS PADA schedule_submissions
-- ------------------------------------------------------------------------
CALL AddColumnIfNotExists('schedule_submissions', 'priority_1_date', 'DATE NULL COMMENT "Tanggal spesifik P1"');
CALL AddColumnIfNotExists('schedule_submissions', 'priority_1_session', 'INT NULL COMMENT "Nomor sesi P1"');
CALL AddColumnIfNotExists('schedule_submissions', 'priority_2_date', 'DATE NULL COMMENT "Tanggal spesifik P2"');
CALL AddColumnIfNotExists('schedule_submissions', 'priority_2_session', 'INT NULL COMMENT "Nomor sesi P2"');
CALL AddColumnIfNotExists('schedule_submissions', 'priority_3_date', 'DATE NULL COMMENT "Tanggal spesifik P3"');
CALL AddColumnIfNotExists('schedule_submissions', 'priority_3_session', 'INT NULL COMMENT "Nomor sesi P3"');

CALL AddColumnIfNotExists('schedule_submissions', 'approved_priority', 'INT NULL DEFAULT 1 COMMENT "Nomor prioritas yang disetujui (1, 2, atau 3)"');
CALL AddColumnIfNotExists('schedule_submissions', 'assigned_session_id', 'INT NULL COMMENT "ID sesi jaga resmi setelah dideploy"');
CALL AddColumnIfNotExists('schedule_submissions', 'deployed_at', 'DATETIME NULL COMMENT "Waktu pengajuan diterapkan ke jadwal resmi"');
CALL AddColumnIfNotExists('schedule_submissions', 'deployed_by', 'INT NULL COMMENT "User pengurus/admin yang mendeploy"');

-- Perpanjang tipe data string pilihan prioritas agar memuat nama hari, tanggal lengkap, sesi, dan jam
ALTER TABLE schedule_submissions MODIFY COLUMN priority_1 VARCHAR(255) NOT NULL;
ALTER TABLE schedule_submissions MODIFY COLUMN priority_2 VARCHAR(255) NOT NULL;
ALTER TABLE schedule_submissions MODIFY COLUMN priority_3 VARCHAR(255) NOT NULL;

-- Hapus prosedur pembantu setelah selesai digunakan
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- Selesai
SELECT "Migrasi 20261121_rentang_jaga_dan_deploy_jadwal berhasil dijalankan!" AS status;
