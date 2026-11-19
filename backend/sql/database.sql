CREATE DATABASE IF NOT EXISTS taxora CHARACTER SET utf8mb4;
USE taxora;

CREATE TABLE IF NOT EXISTS programs(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  required_evidence JSON NOT NULL,
  late_limit_min INT NOT NULL DEFAULT 10,
  gps_radius_m INT NULL,
  settings JSON NULL
);

CREATE TABLE IF NOT EXISTS users(
  id INT AUTO_INCREMENT PRIMARY KEY,
  nim VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NULL,
  phone VARCHAR(50) NULL,
  prodi VARCHAR(100),
  semester VARCHAR(20) NULL,
  profile_photo VARCHAR(255) NULL,
  program_id INT NULL,
  role ENUM('relawan','koordinator','pengurus','admin') NOT NULL DEFAULT 'relawan',
  password_hash VARCHAR(100) NOT NULL,
  must_change TINYINT NOT NULL DEFAULT 1,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(name)
);

CREATE TABLE IF NOT EXISTS memberships(
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  program_id INT NOT NULL,
  year INT NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  UNIQUE(user_id,program_id,year),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(program_id) REFERENCES programs(id)
);

CREATE TABLE IF NOT EXISTS periods(
  program_id INT NOT NULL,
  year INT NOT NULL,
  closed TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY(program_id,year)
);

CREATE TABLE IF NOT EXISTS sessions(
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  year INT NOT NULL,
  surat_tugas_no VARCHAR(120) NULL,
  title VARCHAR(150),
  date DATE NOT NULL,
  session_no INT NOT NULL DEFAULT 1,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  INDEX(program_id,date)
);

CREATE TABLE IF NOT EXISTS assignments(
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  replaced_by INT NULL,
  UNIQUE(session_id,user_id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS attendance(
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  program_id INT NOT NULL,
  start_at DATETIME NOT NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  gps_valid TINYINT NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  photo VARCHAR(255),
  end_at DATETIME NULL,
  wp_count INT NULL,
  ev_excel VARCHAR(255),
  ev_bpe VARCHAR(255),
  ev_report VARCHAR(255),
  renjani_screenshot VARCHAR(255) NULL,
  notes TEXT,
  custom_answers JSON NULL,
  original_snapshot JSON NULL,
  status ENUM('menunggu','disetujui','ditolak','revisi') NOT NULL DEFAULT 'menunggu',
  verify_reason VARCHAR(255),
  UNIQUE(session_id,user_id),
  INDEX(program_id,status)
);

CREATE TABLE IF NOT EXISTS attendance_revisions(
  id INT AUTO_INCREMENT PRIMARY KEY,
  attendance_id INT NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  actor_id INT NOT NULL,
  kind ENUM('revisi_relawan','koreksi_pengurus') NOT NULL DEFAULT 'koreksi_pengurus',
  before_val JSON,
  after_val JSON,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(attendance_id)
);

CREATE TABLE IF NOT EXISTS substitutions(
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  program_id INT NOT NULL,
  year INT NOT NULL,
  requester_id INT NOT NULL,
  substitute_id INT NULL,
  substitute_name VARCHAR(120),
  scope ENUM('penuh','sebagian') NOT NULL DEFAULT 'penuh',
  reason VARCHAR(255) NOT NULL,
  status ENUM('menunggu','disetujui','ditolak') NOT NULL DEFAULT 'menunggu',
  reviewer_id INT NULL,
  review_reason VARCHAR(255) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(program_id,year,status),
  INDEX(requester_id)
);

CREATE TABLE IF NOT EXISTS materials(
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  year INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  category ENUM('SOP','Guidebook','Materi','Penilaian','Kegiatan','Lainnya') NOT NULL DEFAULT 'Materi',
  doc_date DATE NULL,
  description TEXT,
  file_path VARCHAR(255) NULL,
  cover_image VARCHAR(255) NULL,
  external_url VARCHAR(500) NULL,
  visible_to_volunteer TINYINT NOT NULL DEFAULT 1,
  active TINYINT NOT NULL DEFAULT 1,
  version INT NOT NULL DEFAULT 1,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(program_id,year,category)
);

CREATE TABLE IF NOT EXISTS material_versions(
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  version INT NOT NULL,
  file_path VARCHAR(255) NULL,
  cover_image VARCHAR(255) NULL,
  external_url VARCHAR(500) NULL,
  uploaded_by INT NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(material_id)
);

CREATE TABLE IF NOT EXISTS appreciation_points(
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  user_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  category ENUM('pengganti','bantu_kegiatan','konten','masukan') NOT NULL,
  points INT NOT NULL,
  note VARCHAR(255),
  substitution_id INT NULL,
  verified TINYINT NOT NULL DEFAULT 1,
  created_by INT NOT NULL,
  verified_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(program_id,year,month)
);

CREATE TABLE IF NOT EXISTS rotm_winners(
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  user_id INT NOT NULL,
  score_service DECIMAL(6,2) NOT NULL DEFAULT 0,
  score_attendance DECIMAL(6,2) NOT NULL DEFAULT 0,
  score_bonus DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  shifts INT NOT NULL DEFAULT 0,
  decided_by INT NOT NULL,
  note VARCHAR(255),
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(program_id,year,month)
);

CREATE TABLE IF NOT EXISTS monthly_reports(
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  status ENUM('draft','final','perlu_diperbarui') NOT NULL DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  letter_no VARCHAR(120),
  narrative TEXT,
  signatory_name VARCHAR(120),
  signatory_title VARCHAR(120),
  summary_snapshot JSON,
  updated_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(program_id,year,month)
);

CREATE TABLE IF NOT EXISTS monthly_report_versions(
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  version INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  summary_snapshot JSON,
  updated_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(report_id)
);

CREATE TABLE IF NOT EXISTS evidence_tokens(
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(80) UNIQUE NOT NULL,
  attendance_id INT NOT NULL,
  field VARCHAR(20) NOT NULL,
  created_by INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(attendance_id)
);

CREATE TABLE IF NOT EXISTS audit_log(
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NULL,
  actor_id INT NOT NULL,
  action VARCHAR(50),
  entity VARCHAR(50),
  entity_id INT,
  before_val JSON,
  after_val JSON,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(program_id,created_at)
);

CREATE TABLE IF NOT EXISTS prodi(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

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
);

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
);

INSERT IGNORE INTO programs(name,required_evidence) VALUES
  ('Tax Clinic','["excel","bpe","report"]'),
  ('Renjani','[]');

INSERT IGNORE INTO prodi(name,active) VALUES
  ('D-IV Akuntansi Sektor Publik',1),
  ('D-IV Manajemen Keuangan Negara',1),
  ('D-IV Manajemen Aset Publik',1),
  ('D-III Pajak',1),
  ('D-III Akuntansi',1),
  ('D-III Kebendaharaan Negara',1);

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
