require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const UP = path.join(__dirname, "uploads-taxora");
fs.mkdirSync(UP, { recursive: true });

const MONTHS_ID = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ---------- database & auto-migrasi ----------
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  dateStrings: true,
});

const DEFAULT_SETTINGS = (programName = "") => {
  const isClinic = programName.toLowerCase().includes("clinic");
  return {
    late_limit_min: 10,
    gps_radius_m: null,
    target_wp: 14,
    weight_service: 70,
    weight_attendance: 30,
    scores: { ontime: 30, late11_20: 24, late21_30: 18, late30plus: 12, absent: 0 },
    bonus: { pengganti: 5, bantu_kegiatan: 3, konten: 3, masukan: 2 },
    wp_required: isClinic,
    required_evidence: isClinic ? ["excel", "bpe", "report"] : [],
    max_file_mb: 5,
    allowed_types: "jpg,jpeg,png,webp,pdf,xlsx,xls,csv",
    prodi_list: [
      "D-IV Akuntansi Sektor Publik",
      "D-IV Manajemen Keuangan Negara",
      "D-IV Manajemen Aset Publik",
      "D-III Pajak",
      "D-III Akuntansi",
      "D-III Kebendaharaan Negara",
    ],
    report_letter_no: "LAP/TC-STAN/" + new Date().getFullYear(),
    report_signatory_name: "Ketua Tax Center PKN STAN",
    report_signatory_title: "Kepala Tax Center PKN STAN",
    report_narrative:
      "Laporan operasional bulanan kegiatan relawan Tax Center PKN STAN disusun berdasarkan data presensi, pendampingan Wajib Pajak, dan hasil verifikasi pengurus.",
    custom_fields: [],
  };
};

async function addColumnIfMissing(table, col, def) {
  const [[row]] = await db.query(
    "SELECT COUNT(*) c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [table, col]
  );
  if (!row.c) await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

async function ensureSchema() {
  await addColumnIfMissing("programs", "settings", "JSON NULL");
  await addColumnIfMissing("sessions", "surat_tugas_no", "VARCHAR(120) NULL");
  await addColumnIfMissing("attendance", "original_snapshot", "JSON NULL");
  await addColumnIfMissing("attendance", "custom_answers", "JSON NULL");

  await db.query(`CREATE TABLE IF NOT EXISTS attendance_revisions(
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
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS substitutions(
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
    INDEX(program_id, year, status),
    INDEX(requester_id)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS materials(
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    year INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    category ENUM('SOP','Guidebook','Materi','Penilaian','Kegiatan','Lainnya') NOT NULL DEFAULT 'Materi',
    doc_date DATE NULL,
    description TEXT,
    file_path VARCHAR(255) NULL,
    external_url VARCHAR(500) NULL,
    visible_to_volunteer TINYINT NOT NULL DEFAULT 1,
    active TINYINT NOT NULL DEFAULT 1,
    version INT NOT NULL DEFAULT 1,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX(program_id, year, category)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS material_versions(
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    version INT NOT NULL,
    file_path VARCHAR(255) NULL,
    external_url VARCHAR(500) NULL,
    uploaded_by INT NOT NULL,
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(material_id)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS appreciation_points(
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
    INDEX(program_id, year, month)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS rotm_winners(
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
    UNIQUE(program_id, year, month)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS monthly_reports(
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
    UNIQUE(program_id, year, month)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS monthly_report_versions(
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    version INT NOT NULL,
    status VARCHAR(30) NOT NULL,
    summary_snapshot JSON,
    updated_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(report_id)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS evidence_tokens(
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(80) UNIQUE NOT NULL,
    attendance_id INT NOT NULL,
    field VARCHAR(20) NOT NULL,
    created_by INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(attendance_id)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS prodi(
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) UNIQUE NOT NULL,
    active TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const [[{ prodiCount }]] = await db.query("SELECT COUNT(*) prodiCount FROM prodi");
  if (!prodiCount) {
    for (const name of DEFAULT_SETTINGS("").prodi_list) {
      await db.query("INSERT IGNORE INTO prodi(name, active) VALUES(?, 1)", [name]);
    }
  }
  const [usedProdi] = await db.query("SELECT DISTINCT prodi FROM users WHERE prodi IS NOT NULL AND TRIM(prodi)!=''");
  for (const r of usedProdi) {
    await db.query("INSERT IGNORE INTO prodi(name, active) VALUES(?, 1)", [r.prodi.trim()]);
  }

  const [progs] = await db.query("SELECT id, name, required_evidence, late_limit_min, gps_radius_m, settings FROM programs");
  for (const p of progs) {
    if (!p.settings) {
      const def = DEFAULT_SETTINGS(p.name);
      const reqEv = typeof p.required_evidence === "string" ? JSON.parse(p.required_evidence) : p.required_evidence;
      def.required_evidence = Array.isArray(reqEv) ? reqEv : def.required_evidence;
      def.late_limit_min = p.late_limit_min ?? 10;
      def.gps_radius_m = p.gps_radius_m ?? null;
      await db.query("UPDATE programs SET settings=? WHERE id=?", [JSON.stringify(def), p.id]);
    }
  }
}

// ---------- helpers ----------
const ah = (f) => (q, s, n) =>
  Promise.resolve(f(q, s, n)).catch((e) => {
    console.error(e);
    if (!s.headersSent) s.status(500).json({ success: false, message: "Terjadi kesalahan server" });
  });

const fail = (s, c, m) => s.status(c).json({ success: false, message: m });

const auth = (...roles) => (q, s, n) => {
  try {
    const raw = (q.headers.authorization || "").startsWith("Bearer ")
      ? q.headers.authorization.slice(7)
      : q.query.token || "";
    q.u = jwt.verify(raw, process.env.JWT_SECRET || "taxora");
  } catch {
    return fail(s, 401, "Sesi berakhir, silakan login ulang");
  }
  if (roles.length && !roles.includes(q.u.role)) return fail(s, 403, "Tidak memiliki akses");
  n();
};

const clean = (v) => String(v ?? "").replace(/[<>]/g, "").trim();

const scope = (q) => (q.u.role === "admin" ? Number(q.query.programId || q.body?.programId) || null : q.u.programId);

const audit = (u, pid, action, entity, id, before, after, reason) =>
  db.query(
    "INSERT INTO audit_log(program_id,actor_id,action,entity,entity_id,before_val,after_val,reason) VALUES(?,?,?,?,?,?,?,?)",
    [pid || null, u.id, action, entity, id || null, JSON.stringify(before ?? null), JSON.stringify(after ?? null), reason || null]
  );

const isClosed = async (pid, year) => {
  const [[r]] = await db.query("SELECT closed FROM periods WHERE program_id=? AND year=?", [pid, year]);
  return !!r?.closed;
};

async function getProgramSettings(programId) {
  const [[p]] = await db.query("SELECT id, name, required_evidence, late_limit_min, gps_radius_m, settings FROM programs WHERE id=?", [programId]);
  if (!p) return null;
  const def = DEFAULT_SETTINGS(p.name);
  const parsed = p.settings ? (typeof p.settings === "string" ? JSON.parse(p.settings) : p.settings) : {};
  const merged = {
    ...def,
    ...parsed,
    scores: { ...def.scores, ...(parsed.scores || {}) },
    bonus: { ...def.bonus, ...(parsed.bonus || {}) },
  };
  return { program: p, settings: merged };
}

async function markFinalReportStale(programId, dateStr) {
  if (!programId || !dateStr) return;
  const year = Number(String(dateStr).slice(0, 4));
  const month = Number(String(dateStr).slice(5, 7));
  if (!year || !month) return;
  await db.query(
    "UPDATE monthly_reports SET status='perlu_diperbarui' WHERE program_id=? AND year=? AND month=? AND status='final'",
    [programId, year, month]
  );
}

async function paged(q, s, { sel, from, where = [], params = [], search = [], sorts = {}, defSort }) {
  const page = Math.max(1, +q.query.page || 1);
  const limit = [10, 25, 50, 100].includes(+q.query.limit) ? +q.query.limit : 10;
  const kw = clean(q.query.search);
  const wArr = [...where];
  const pArr = [...params];
  if (kw && search.length) {
    wArr.push("(" + search.map((c) => `${c} LIKE ?`).join(" OR ") + ")");
    search.forEach(() => pArr.push(`%${kw}%`));
  }
  const w = wArr.length ? "WHERE " + wArr.join(" AND ") : "";
  const dir = q.query.order === "desc" ? "DESC" : "ASC";
  const order = sorts[q.query.sort]
    ? `${sorts[q.query.sort]} ${dir}`
    : /\b(ASC|DESC)\s*$/i.test(defSort)
    ? defSort
    : `${defSort} ${dir}`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) total ${from} ${w}`, pArr);
  const [data] = await db.query(`SELECT ${sel} ${from} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [
    ...pArr,
    limit,
    (page - 1) * limit,
  ]);
  s.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (q, f, cb) => {
      const d = new Date();
      const pid = String(q.u?.programId || q.body?.programId || "general");
      const p = path.join(UP, pid, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"));
      fs.mkdirSync(p, { recursive: true });
      cb(null, p);
    },
    filename: (q, f, cb) =>
      cb(
        null,
        `${Date.now()}_${q.u?.nim || "file"}_${f.fieldname}${path
          .extname(f.originalname)
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, "")}`
      ),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (q, f, cb) =>
    cb(
      /image\/(jpeg|png|webp|gif)|pdf|spreadsheet|excel|csv|word|document|presentation|powerpoint|octet-stream/.test(f.mimetype)
        ? null
        : new Error("Jenis file tidak diizinkan"),
      true
    ),
});

// ---------- auth ----------
app.post("/api/auth/login", ah(async (q, s) => {
  const nim = clean(q.body.nim), { password, programId } = q.body;
  const [[u]] = await db.query("SELECT * FROM users WHERE nim=? AND active=1", [nim]);
  if (!u) return fail(s, 401, "NIM atau password salah");
  if (u.locked) return fail(s, 423, "Akun terkunci, hubungi pengurus");
  if (!(await bcrypt.compare(String(password || ""), u.password_hash))) {
    await db.query("UPDATE users SET failed_attempts=failed_attempts+1, locked=(failed_attempts+1>=5) WHERE id=?", [u.id]);
    return fail(s, 401, "NIM atau password salah");
  }
  await db.query("UPDATE users SET failed_attempts=0 WHERE id=?", [u.id]);
  let pid = null;
  let programName = "Semua Program";
  if (u.role !== "admin") {
    const [ms] = await db.query(
      "SELECT p.id, p.name FROM memberships m JOIN programs p ON p.id=m.program_id WHERE m.user_id=? AND m.active=1 AND m.year=?",
      [u.id, new Date().getFullYear()]
    );
    if (!ms.length) return fail(s, 403, "Anda tidak terdaftar pada periode aktif");
    if (ms.length > 1 && !programId) return s.json({ success: true, choosePrograms: ms });
    const chosen = programId ? ms.find((m) => m.id === +programId) : ms[0];
    if (!chosen) return fail(s, 403, "Program tidak valid");
    pid = chosen.id;
    programName = chosen.name;
  }
  const user = { id: u.id, nim: u.nim, name: u.name, role: u.role, programId: pid, programName, mustChange: !!u.must_change };
  await audit(user, pid, "login", "akun", user.id, null, { role: user.role, program: programName }, "Login ke sistem");
  s.json({ success: true, token: jwt.sign(user, process.env.JWT_SECRET || "taxora", { expiresIn: "12h" }), user });
}));

app.post("/api/auth/change-password", auth(), ah(async (q, s) => {
  const { oldPassword, newPassword } = q.body;
  const [[u]] = await db.query("SELECT password_hash FROM users WHERE id=?", [q.u.id]);
  if (!(await bcrypt.compare(String(oldPassword || ""), u.password_hash))) return fail(s, 400, "Password lama salah");
  if (String(newPassword || "").length < 10) return fail(s, 400, "Password minimal 10 karakter");
  await db.query("UPDATE users SET password_hash=?, must_change=0 WHERE id=?", [await bcrypt.hash(newPassword, 10), q.u.id]);
  await audit(q.u, q.u.programId, "change-password", "akun", q.u.id, null, null, "Mengubah password akun");
  s.json({ success: true, message: "Password berhasil diubah" });
}));

app.get("/api/auth/profile", auth(), (q, s) => s.json({ success: true, data: q.u }));
app.get("/api/programs", auth(), ah(async (q, s) => {
  const [d] = await db.query("SELECT id, name, required_evidence, late_limit_min, gps_radius_m FROM programs ORDER BY id ASC");
  s.json({ success: true, data: d });
}));

// ---------- beranda relawan ----------
app.get("/api/relawan-home", auth("relawan"), ah(async (q, s) => {
  const year = +(q.query.year || new Date().getFullYear());
  const pid = q.u.programId;
  const today = new Date().toISOString().slice(0, 10);

  const [todaySessions] = await db.query(
    `SELECT s.*, a.replaced_by,
      (SELECT t.id FROM attendance t WHERE t.session_id=s.id AND t.user_id=?) attendance_id,
      (SELECT t.status FROM attendance t WHERE t.session_id=s.id AND t.user_id=?) attendance_status,
      (SELECT t.end_at FROM attendance t WHERE t.session_id=s.id AND t.user_id=?) end_at
     FROM sessions s
     JOIN assignments a ON a.session_id=s.id AND a.user_id=?
     WHERE s.program_id=? AND s.date=? AND a.replaced_by IS NULL
     ORDER BY s.session_no ASC`,
    [q.u.id, q.u.id, q.u.id, q.u.id, pid, today]
  );

  const [upcomingSessions] = await db.query(
    `SELECT s.*, a.replaced_by
     FROM sessions s
     JOIN assignments a ON a.session_id=s.id AND a.user_id=?
     WHERE s.program_id=? AND s.date>? AND a.replaced_by IS NULL
     ORDER BY s.date ASC, s.session_no ASC LIMIT 5`,
    [q.u.id, pid, today]
  );

  const [[counts]] = await db.query(
    `SELECT
      COUNT(a.id) total_presensi,
      COALESCE(SUM(a.end_at IS NULL),0) belum_diisi,
      COALESCE(SUM(a.end_at IS NOT NULL AND a.status='menunggu'),0) menunggu,
      COALESCE(SUM(a.status='revisi'),0) perlu_revisi,
      COALESCE(SUM(a.status='disetujui'),0) disetujui,
      COALESCE(SUM(a.wp_count),0) total_wp
     FROM attendance a JOIN sessions s ON s.id=a.session_id
     WHERE a.user_id=? AND a.program_id=? AND s.year=?`,
    [q.u.id, pid, year]
  );

  const [revisions] = await db.query(
    `SELECT a.id, s.date, s.title, a.verify_reason
     FROM attendance a JOIN sessions s ON s.id=a.session_id
     WHERE a.user_id=? AND a.program_id=? AND a.status='revisi'
     ORDER BY s.date DESC LIMIT 5`,
    [q.u.id, pid]
  );

  const [subNotices] = await db.query(
    `SELECT sub.id, sub.status, sub.review_reason, sub.reviewed_at, s.date, s.title
     FROM substitutions sub JOIN sessions s ON s.id=sub.session_id
     WHERE sub.requester_id=? AND sub.program_id=? AND sub.status IN ('disetujui','ditolak')
     ORDER BY sub.reviewed_at DESC LIMIT 5`,
    [q.u.id, pid]
  );

  const cfg = await getProgramSettings(pid);
  s.json({
    success: true,
    data: {
      today,
      todaySessions,
      upcomingSessions,
      counts,
      notifications: { revisions, substitutions: subNotices },
      settings: cfg?.settings || null,
    },
  });
}));

// ---------- relawan & akun ----------
app.get("/api/relawan", auth("pengurus", "admin", "koordinator"), ah(async (q, s) => {
  const pid = scope(q);
  const year = +q.query.year || new Date().getFullYear();
  return paged(q, s, {
    sel: "u.id,u.nim,u.name,u.prodi,u.role,u.active,u.locked,m.program_id,p.name program_name,m.active membership_active",
    from: "FROM users u JOIN memberships m ON m.user_id=u.id JOIN programs p ON p.id=m.program_id",
    where: ["m.year=?", ...(pid ? ["m.program_id=?"] : [])],
    params: [year, ...(pid ? [pid] : [])],
    search: ["u.nim", "u.name", "u.prodi"],
    sorts: { nim: "u.nim", name: "u.name", prodi: "u.prodi" },
    defSort: "u.name",
  });
}));

app.get("/api/relawan/search-nim", auth("admin"), ah(async (q, s) => {
  const nim = clean(q.query.nim);
  if (!nim) return s.json({ success: true, data: [] });
  const [users] = await db.query("SELECT id, nim, name, prodi, role, active, locked FROM users WHERE nim LIKE ? LIMIT 20", [`%${nim}%`]);
  const ids = users.map((u) => u.id);
  let mems = [];
  if (ids.length) {
    const [mRows] = await db.query(
      `SELECT m.user_id, m.year, m.active, p.id program_id, p.name program_name
       FROM memberships m JOIN programs p ON p.id=m.program_id
       WHERE m.user_id IN (${ids.map(() => "?").join(",")})
       ORDER BY m.year DESC, p.id ASC`,
      ids
    );
    mems = mRows;
  }
  const data = users.map((u) => ({ ...u, memberships: mems.filter((m) => m.user_id === u.id) }));
  s.json({ success: true, data });
}));

app.post("/api/relawan", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = scope(q) || +q.body.programId;
  const year = +q.body.year || new Date().getFullYear();
  const nim = clean(q.body.nim);
  const name = clean(q.body.name);
  if (!pid || !nim || !name) return fail(s, 400, "NIM, nama, dan program wajib diisi");
  const role = q.u.role === "admin" && ["koordinator", "pengurus"].includes(q.body.role) ? q.body.role : "relawan";
  let [[u]] = await db.query("SELECT id FROM users WHERE nim=?", [nim]);
  if (!u) {
    const [r] = await db.query(
      "INSERT INTO users(nim,name,prodi,role,password_hash) VALUES(?,?,?,?,?)",
      [nim, name, clean(q.body.prodi), role, await bcrypt.hash(nim + "@taxora", 10)]
    );
    u = { id: r.insertId };
  }
  await db.query("INSERT INTO memberships(user_id,program_id,year) VALUES(?,?,?) ON DUPLICATE KEY UPDATE active=1", [u.id, pid, year]);
  await audit(q.u, pid, "create", "relawan", u.id, null, { nim, name, role });
  s.json({ success: true, message: `Relawan disimpan. Password awal: ${nim}@taxora` });
}));

app.put("/api/relawan/:id", auth("pengurus", "admin"), ah(async (q, s) => {
  const [[b]] = await db.query("SELECT name,prodi,active FROM users WHERE id=?", [q.params.id]);
  if (!b) return fail(s, 404, "Data tidak ditemukan");
  const a = { name: clean(q.body.name) || b.name, prodi: clean(q.body.prodi), active: q.body.active ? 1 : 0 };
  await db.query("UPDATE users SET name=?,prodi=?,active=? WHERE id=?", [a.name, a.prodi, a.active, q.params.id]);
  await audit(q.u, scope(q), "update", "relawan", +q.params.id, b, a, clean(q.body.reason) || "Ubah data");
  s.json({ success: true });
}));

app.post("/api/relawan/:id/reset-password", auth("pengurus", "admin"), ah(async (q, s) => {
  const [[u]] = await db.query("SELECT nim FROM users WHERE id=?", [q.params.id]);
  if (!u) return fail(s, 404, "Akun tidak ditemukan");
  await db.query("UPDATE users SET password_hash=?,must_change=1,locked=0,failed_attempts=0 WHERE id=?", [
    await bcrypt.hash(u.nim + "@taxora", 10),
    q.params.id,
  ]);
  await audit(q.u, scope(q), "reset-password", "relawan", +q.params.id);
  s.json({ success: true, message: `Password diatur ulang ke ${u.nim}@taxora & akun dibuka` });
}));

app.delete("/api/relawan/:id", auth("pengurus", "admin"), ah(async (q, s) => {
  const uid = +q.params.id;
  if (uid === q.u.id) return fail(s, 400, "Tidak dapat menghapus akun sendiri");
  const [[u]] = await db.query("SELECT id, nim, name, prodi, role FROM users WHERE id=?", [uid]);
  if (!u) return fail(s, 404, "Data relawan tidak ditemukan");
  if (u.role === "admin") return fail(s, 403, "Akun Admin Pusat tidak dapat dihapus");

  const pid = q.u.role === "admin" ? (Number(q.body?.programId || q.query.programId) || null) : q.u.programId;
  const year = Number(q.body?.year || q.query.year) || null;
  const reason = clean(q.body?.reason || q.query.reason) || "Hapus data relawan";

  if (q.u.role !== "admin") {
    const [[mem]] = await db.query("SELECT id FROM memberships WHERE user_id=? AND program_id=? LIMIT 1", [uid, q.u.programId]);
    if (!mem) return fail(s, 403, "Relawan bukan bagian dari program Anda");
  }

  if (pid && year) {
    await db.query("DELETE FROM memberships WHERE user_id=? AND program_id=? AND year=?", [uid, pid, year]);
  } else if (pid) {
    await db.query("DELETE FROM memberships WHERE user_id=? AND program_id=?", [uid, pid]);
  } else {
    await db.query("DELETE FROM memberships WHERE user_id=?", [uid]);
  }

  const [[{ leftMem }]] = await db.query("SELECT COUNT(*) leftMem FROM memberships WHERE user_id=?", [uid]);
  if (!leftMem) {
    const [atts] = await db.query("SELECT id, photo, ev_excel, ev_bpe, ev_report FROM attendance WHERE user_id=?", [uid]);
    for (const a of atts) {
      [a.photo, a.ev_excel, a.ev_bpe, a.ev_report].forEach(safeUnlink);
      await db.query("DELETE FROM evidence_tokens WHERE attendance_id=?", [a.id]);
      await db.query("DELETE FROM attendance_revisions WHERE attendance_id=?", [a.id]);
    }
    await db.query("DELETE FROM attendance WHERE user_id=?", [uid]);
    await db.query("DELETE FROM assignments WHERE user_id=?", [uid]);
    await db.query("UPDATE assignments SET replaced_by=NULL WHERE replaced_by=?", [uid]);
    await db.query("DELETE FROM substitutions WHERE requester_id=? OR substitute_id=?", [uid, uid]);
    await db.query("DELETE FROM appreciation_points WHERE user_id=?", [uid]);
    await db.query("DELETE FROM rotm_winners WHERE user_id=?", [uid]);
    await db.query("DELETE FROM users WHERE id=?", [uid]);
  }

  await audit(q.u, pid, "delete", "relawan", uid, u, null, reason);
  s.json({
    success: true,
    message: leftMem ? `Relawan ${u.name} dihapus dari program/periode ini` : `Relawan ${u.name} berhasil dihapus`,
  });
}));

// ---------- jadwal & surat tugas ----------
app.get("/api/jadwal", auth(), ah(async (q, s) => {
  const mine = q.u.role === "relawan";
  const pid = mine ? q.u.programId : scope(q);
  const me = db.escape(q.u.id);
  const where = [];
  const params = [];
  if (pid) { where.push("s.program_id=?"); params.push(pid); }
  if (q.query.year) { where.push("s.year=?"); params.push(+q.query.year); }
  if (q.query.month) { where.push("MONTH(s.date)=?"); params.push(+q.query.month); }

  return paged(q, s, {
    sel:
      "s.id,s.program_id,p.name program_name,s.surat_tugas_no,s.title,s.date,s.session_no,s.start_time,s.end_time," +
      "(SELECT COUNT(*) FROM assignments a WHERE a.session_id=s.id AND a.replaced_by IS NULL) crew" +
      (mine
        ? `,a.replaced_by,(SELECT t.id FROM attendance t WHERE t.session_id=s.id AND t.user_id=${me}) attendance_id`
        : ""),
    from:
      "FROM sessions s JOIN programs p ON p.id=s.program_id" +
      (mine ? ` JOIN assignments a ON a.session_id=s.id AND a.user_id=${me}` : ""),
    where,
    params,
    search: ["s.title", "s.surat_tugas_no"],
    sorts: { date: "s.date" },
    defSort: "s.date DESC, s.session_no",
  });
}));

app.post("/api/jadwal", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = scope(q) || +q.body.programId;
  const { date, startTime, endTime } = q.body;
  const ids = Array.isArray(q.body.userIds) ? q.body.userIds : [];
  if (!pid || !date || !startTime || !endTime) return fail(s, 400, "Tanggal dan jam sesi wajib diisi");
  const year = +String(date).slice(0, 4);
  if (await isClosed(pid, year)) return fail(s, 423, "Periode sudah ditutup");
  const suratNo = clean(q.body.suratTugasNo) || null;
  const [r] = await db.query(
    "INSERT INTO sessions(program_id,year,surat_tugas_no,title,date,session_no,start_time,end_time) VALUES(?,?,?,?,?,?,?,?)",
    [pid, year, suratNo, clean(q.body.title), date, +q.body.sessionNo || 1, startTime, endTime]
  );
  for (const id of ids) await db.query("INSERT IGNORE INTO assignments(session_id,user_id) VALUES(?,?)", [r.insertId, +id]);
  await audit(q.u, pid, "create", "jadwal", r.insertId, null, { ...q.body, suratTugasNo: suratNo });
  await markFinalReportStale(pid, date);
  s.json({ success: true });
}));

// ---------- presensi & monitoring ----------
app.post("/api/presensi/start", auth("relawan"), upload.single("photo"), ah(async (q, s) => {
  const sid = +q.body.sessionId;
  const [[j]] = await db.query(
    "SELECT s.*,TIMESTAMPDIFF(MINUTE,CONCAT(s.date,' ',s.start_time),NOW()) late FROM sessions s JOIN assignments a ON a.session_id=s.id AND a.user_id=? AND a.replaced_by IS NULL WHERE s.id=? AND s.program_id=?",
    [q.u.id, sid, q.u.programId]
  );
  if (!j) return fail(s, 403, "Ini bukan jadwal aktif Anda");
  if (!q.file) return fail(s, 400, "Foto presensi wajib diunggah");
  if (q.file.size > 350 * 1024) {
    try { fs.unlinkSync(q.file.path); } catch {}
    return fail(s, 400, "Ukuran foto presensi melebihi batas maksimal 350 KB");
  }
  if (await isClosed(j.program_id, j.year)) return fail(s, 423, "Periode sudah ditutup");
  const lat = parseFloat(q.body.lat), lng = parseFloat(q.body.lng), ok = Number.isFinite(lat) && Number.isFinite(lng);
  let attId = null;
  try {
    const [ins] = await db.query(
      "INSERT INTO attendance(session_id,user_id,program_id,start_at,lat,lng,gps_valid,late_minutes,photo) VALUES(?,?,?,NOW(),?,?,?,?,?)",
      [sid, q.u.id, j.program_id, ok ? lat : null, ok ? lng : null, ok ? 1 : 0, Math.max(0, j.late), q.file.path]
    );
    attId = ins.insertId;
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return fail(s, 409, "Anda sudah presensi di sesi ini");
    throw e;
  }
  await audit(
    q.u,
    j.program_id,
    "presensi-mulai",
    "presensi",
    attId,
    null,
    { sessionId: sid, late_minutes: Math.max(0, j.late), gps_valid: ok ? 1 : 0 },
    ok ? "Presensi mulai (GPS valid)" : "Presensi mulai (lokasi tidak tervalidasi)"
  );
  await markFinalReportStale(j.program_id, j.date);
  s.json({ success: true, message: ok ? "Presensi tercatat" : "Presensi tercatat (lokasi tidak tervalidasi)" });
}));

app.post(
  "/api/presensi/:id/finish",
  auth("relawan"),
  upload.fields([{ name: "excel", maxCount: 1 }, { name: "bpe", maxCount: 1 }, { name: "report", maxCount: 1 }]),
  ah(async (q, s) => {
    const [[a]] = await db.query(
      "SELECT a.*, p.required_evidence req, s.date, s.year FROM attendance a JOIN programs p ON p.id=a.program_id JOIN sessions s ON s.id=a.session_id WHERE a.id=? AND a.user_id=?",
      [q.params.id, q.u.id]
    );
    if (!a) return fail(s, 404, "Presensi tidak ditemukan");
    if (a.status === "disetujui") return fail(s, 403, "Data sudah diverifikasi dan tidak bisa diubah");
    if (await isClosed(a.program_id, a.year)) return fail(s, 423, "Periode sudah ditutup");

    const cfg = await getProgramSettings(a.program_id);
    const reqEv = cfg?.settings?.required_evidence ?? (typeof a.req === "string" ? JSON.parse(a.req) : a.req);
    const wpRequired = cfg?.settings?.wp_required ?? true;
    const f = q.files || {};
    const wp = q.body.wpCount !== undefined && q.body.wpCount !== "" ? parseInt(q.body.wpCount, 10) : null;
    if (wpRequired && (!Number.isInteger(wp) || wp < 0)) return fail(s, 400, "Jumlah WP dilayani wajib diisi");

    const missing = (reqEv || []).filter((k) => !f[k] && !a["ev_" + k]);
    if (missing.length) return fail(s, 400, "Bukti wajib belum lengkap: " + missing.join(", "));

    if (a.end_at) {
      const [[{ cnt }]] = await db.query("SELECT COUNT(*) cnt FROM attendance_revisions WHERE attendance_id=?", [a.id]);
      await db.query(
        "INSERT INTO attendance_revisions(attendance_id,version_no,actor_id,kind,before_val,after_val,reason) VALUES(?,?,?,?,?,?,?)",
        [
          a.id,
          cnt + 1,
          q.u.id,
          "revisi_relawan",
          JSON.stringify({ wp_count: a.wp_count, notes: a.notes, ev_excel: a.ev_excel, ev_bpe: a.ev_bpe, ev_report: a.ev_report }),
          JSON.stringify({ wp_count: wp, notes: clean(q.body.notes) }),
          "Perbaikan laporan oleh relawan",
        ]
      );
    }

    await db.query(
      "UPDATE attendance SET end_at=NOW(),wp_count=?,notes=?,status='menunggu',verify_reason=NULL,ev_excel=COALESCE(?,ev_excel),ev_bpe=COALESCE(?,ev_bpe),ev_report=COALESCE(?,ev_report) WHERE id=?",
      [wp, clean(q.body.notes), f.excel?.[0].path, f.bpe?.[0].path, f.report?.[0].path, a.id]
    );
    await audit(
      q.u,
      a.program_id,
      a.end_at ? "revisi-laporan" : "kirim-laporan",
      "presensi",
      a.id,
      a.end_at ? { wp_count: a.wp_count, notes: a.notes } : null,
      { wp_count: wp, notes: clean(q.body.notes) },
      a.end_at ? "Perbaikan laporan oleh relawan" : "Presensi selesai & kirim laporan"
    );
    await markFinalReportStale(a.program_id, a.date);
    s.json({ success: true, message: "Laporan terkirim" });
  })
);

app.get("/api/monitoring/summary", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = scope(q);
  const year = +(q.query.year || new Date().getFullYear());
  const month = q.query.month ? +q.query.month : null;
  const where = ["s.year=?"];
  const params = [year];
  if (pid) { where.push("s.program_id=?"); params.push(pid); }
  if (month) { where.push("MONTH(s.date)=?"); params.push(month); }
  if (q.query.date) { where.push("s.date=?"); params.push(clean(q.query.date)); }
  const w = "WHERE " + where.join(" AND ");

  const [[r]] = await db.query(
    `SELECT
      COUNT(a.id) total_jadwal,
      COALESCE(SUM(a.replaced_by IS NOT NULL),0) diganti,
      COALESCE(SUM(a.replaced_by IS NULL AND att.id IS NOT NULL),0) hadir,
      COALESCE(SUM(a.replaced_by IS NULL AND att.id IS NULL AND s.date <= CURDATE()),0) tidak_hadir,
      COALESCE(SUM(att.late_minutes > p.late_limit_min),0) terlambat,
      COALESCE(SUM(att.status='menunggu'),0) menunggu,
      COALESCE(SUM(att.id IS NOT NULL AND att.end_at IS NULL),0) belum_lengkap,
      COALESCE(SUM(att.wp_count),0) total_wp
     FROM assignments a
     JOIN sessions s ON s.id=a.session_id
     JOIN programs p ON p.id=s.program_id
     LEFT JOIN attendance att ON att.session_id=a.session_id AND att.user_id=a.user_id
     ${w}`,
    params
  );
  s.json({ success: true, data: r });
}));

app.get("/api/presensi", auth(), ah(async (q, s) => {
  const mine = q.u.role === "relawan";
  const pid = mine ? q.u.programId : scope(q);
  const where = [];
  const params = [];
  if (pid) { where.push("a.program_id=?"); params.push(pid); }
  if (mine) { where.push("a.user_id=?"); params.push(q.u.id); }
  if (q.query.year) { where.push("s.year=?"); params.push(+q.query.year); }
  if (q.query.month) { where.push("MONTH(s.date)=?"); params.push(+q.query.month); }
  if (q.query.sessionNo) { where.push("s.session_no=?"); params.push(+q.query.sessionNo); }
  if (q.query.status) { where.push("a.status=?"); params.push(clean(q.query.status)); }
  if (q.query.date) { where.push("s.date=?"); params.push(clean(q.query.date)); }
  if (q.query.userId && !mine) { where.push("a.user_id=?"); params.push(+q.query.userId); }

  return paged(q, s, {
    sel: "a.id,a.session_id,a.user_id,a.program_id,p.name program_name,u.nim,u.name,u.prodi,s.date,s.session_no,s.title session_title,a.start_at,a.end_at,a.lat,a.lng,a.late_minutes,a.gps_valid,a.wp_count,a.notes,a.status,a.verify_reason,(a.ev_excel IS NOT NULL) has_excel,(a.ev_bpe IS NOT NULL) has_bpe,(a.ev_report IS NOT NULL) has_report",
    from: "FROM attendance a JOIN users u ON u.id=a.user_id JOIN sessions s ON s.id=a.session_id JOIN programs p ON p.id=a.program_id",
    where,
    params,
    search: ["u.nim", "u.name", "s.title"],
    sorts: { date: "s.date", name: "u.name", late: "a.late_minutes" },
    defSort: "s.date DESC, a.start_at",
  });
}));

app.get("/api/presensi/:id/detail", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const [[row]] = await db.query(
    `SELECT a.*, u.nim, u.name, u.prodi, p.name program_name, s.date, s.session_no, s.start_time, s.end_time, s.title session_title, s.surat_tugas_no
     FROM attendance a
     JOIN users u ON u.id=a.user_id
     JOIN sessions s ON s.id=a.session_id
     JOIN programs p ON p.id=a.program_id
     WHERE a.id=?`,
    [q.params.id]
  );
  if (!row || (q.u.role !== "admin" && row.program_id !== q.u.programId)) return fail(s, 404, "Data tidak ditemukan");
  const [revisions] = await db.query(
    `SELECT r.*, u.name actor_name
     FROM attendance_revisions r JOIN users u ON u.id=r.actor_id
     WHERE r.attendance_id=? ORDER BY r.created_at DESC`,
    [row.id]
  );
  s.json({ success: true, data: { ...row, revisions } });
}));

app.put("/api/presensi/:id/correct", auth("pengurus", "admin"), ah(async (q, s) => {
  const reason = clean(q.body.reason);
  if (!reason) return fail(s, 400, "Alasan koreksi wajib diisi");
  const [[a]] = await db.query(
    "SELECT a.*, s.date, s.year FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.id=?",
    [q.params.id]
  );
  if (!a || (q.u.role !== "admin" && a.program_id !== q.u.programId)) return fail(s, 404, "Data tidak ditemukan");
  if (await isClosed(a.program_id, a.year)) return fail(s, 423, "Periode sudah ditutup");

  const original = a.original_snapshot || {
    late_minutes: a.late_minutes,
    wp_count: a.wp_count,
    gps_valid: a.gps_valid,
    notes: a.notes,
    status: a.status,
  };
  const nextLate = q.body.lateMinutes !== undefined && q.body.lateMinutes !== "" ? Number(q.body.lateMinutes) : a.late_minutes;
  const nextWp = q.body.wpCount !== undefined && q.body.wpCount !== "" ? Number(q.body.wpCount) : a.wp_count;
  const nextGps = q.body.gpsValid !== undefined ? (q.body.gpsValid ? 1 : 0) : a.gps_valid;
  const nextNotes = q.body.notes !== undefined ? clean(q.body.notes) : a.notes;

  const before = { late_minutes: a.late_minutes, wp_count: a.wp_count, gps_valid: a.gps_valid, notes: a.notes };
  const after = { late_minutes: nextLate, wp_count: nextWp, gps_valid: nextGps, notes: nextNotes };

  await db.query(
    "UPDATE attendance SET late_minutes=?, wp_count=?, gps_valid=?, notes=?, original_snapshot=COALESCE(original_snapshot, ?) WHERE id=?",
    [nextLate, nextWp, nextGps, nextNotes, JSON.stringify(original), a.id]
  );

  const [[{ cnt }]] = await db.query("SELECT COUNT(*) cnt FROM attendance_revisions WHERE attendance_id=?", [a.id]);
  await db.query(
    "INSERT INTO attendance_revisions(attendance_id,version_no,actor_id,kind,before_val,after_val,reason) VALUES(?,?,?,?,?,?,?)",
    [a.id, cnt + 1, q.u.id, "koreksi_pengurus", JSON.stringify(before), JSON.stringify(after), reason]
  );
  await audit(q.u, a.program_id, "correct", "presensi", a.id, before, after, reason);
  await markFinalReportStale(a.program_id, a.date);
  s.json({ success: true, message: "Koreksi presensi tersimpan (data asli tetap tercatat)" });
}));

app.put("/api/presensi/:id/verify", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const st = { setujui: "disetujui", tolak: "ditolak", revisi: "revisi" }[q.body.action];
  const reason = clean(q.body.reason);
  if (!st || (st !== "disetujui" && !reason)) return fail(s, 400, "Alasan wajib untuk tolak/revisi");
  const [[b]] = await db.query(
    "SELECT a.status, a.program_id, s.date, s.year FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.id=?",
    [q.params.id]
  );
  if (!b || (q.u.role !== "admin" && b.program_id !== q.u.programId)) return fail(s, 404, "Data tidak ditemukan");
  if (await isClosed(b.program_id, b.year)) return fail(s, 423, "Periode sudah ditutup");
  await db.query("UPDATE attendance SET status=?,verify_reason=? WHERE id=?", [st, reason || null, q.params.id]);
  await audit(q.u, b.program_id, "verify", "presensi", +q.params.id, { status: b.status }, { status: st }, reason);
  await markFinalReportStale(b.program_id, b.date);
  s.json({ success: true });
}));

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  } catch (e) {
    console.error("Gagal menghapus file:", filePath, e.message);
  }
}

app.delete("/api/presensi/:id", auth("admin"), ah(async (q, s) => {
  const id = +q.params.id;
  const reason = clean(q.body?.reason || q.query.reason) || "Hapus data presensi";
  const [[a]] = await db.query(
    "SELECT a.*, s.date, s.year FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.id=?",
    [id]
  );
  if (!a) return fail(s, 404, "Data presensi tidak ditemukan");
  if (await isClosed(a.program_id, a.year)) return fail(s, 423, "Periode sudah ditutup");

  // Kumpulkan semua file bukti & foto (termasuk versi lama di riwayat revisi) lalu unlink dari disk
  const filesToDelete = new Set([a.photo, a.ev_excel, a.ev_bpe, a.ev_report].filter(Boolean));
  const [revs] = await db.query("SELECT before_val FROM attendance_revisions WHERE attendance_id=?", [id]);
  for (const rev of revs) {
    try {
      const bv = typeof rev.before_val === "string" ? JSON.parse(rev.before_val) : rev.before_val;
      if (bv) {
        [bv.photo, bv.ev_excel, bv.ev_bpe, bv.ev_report].filter(Boolean).forEach((fp) => filesToDelete.add(fp));
      }
    } catch {}
  }
  for (const fp of filesToDelete) safeUnlink(fp);

  await db.query("DELETE FROM evidence_tokens WHERE attendance_id=?", [id]);
  await db.query("DELETE FROM attendance_revisions WHERE attendance_id=?", [id]);
  await db.query("DELETE FROM attendance WHERE id=?", [id]);

  await audit(
    q.u,
    a.program_id,
    "delete",
    "presensi",
    id,
    { user_id: a.user_id, session_id: a.session_id, date: a.date, wp_count: a.wp_count, status: a.status },
    null,
    reason
  );
  await markFinalReportStale(a.program_id, a.date);
  s.json({ success: true, message: "Data presensi dan file bukti berhasil dihapus" });
}));

app.get("/api/evidence/:id/:field", auth(), ah(async (q, s) => {
  const col = { photo: "photo", excel: "ev_excel", bpe: "ev_bpe", report: "ev_report" }[q.params.field];
  if (!col) return fail(s, 404, "Bukti tidak ada");
  const [[a]] = await db.query(`SELECT ${col} f,user_id,program_id FROM attendance WHERE id=?`, [q.params.id]);
  if (!a?.f || !fs.existsSync(path.resolve(a.f))) return fail(s, 404, "Bukti tidak ditemukan");
  const own = q.u.role === "relawan" ? a.user_id === q.u.id : q.u.role === "admin" || a.program_id === q.u.programId;
  if (!own) return fail(s, 403, "Tidak memiliki akses");
  if (q.u.role !== "relawan") await audit(q.u, a.program_id, "view-evidence", "presensi", +q.params.id, null, { field: q.params.field });
  if (q.query.download === "1") return s.download(path.resolve(a.f));
  s.sendFile(path.resolve(a.f));
}));

app.post("/api/evidence/:id/:field/share", auth("pengurus", "admin"), ah(async (q, s) => {
  const col = { photo: "photo", excel: "ev_excel", bpe: "ev_bpe", report: "ev_report" }[q.params.field];
  if (!col) return fail(s, 404, "Jenis bukti tidak valid");
  const [[a]] = await db.query(`SELECT ${col} f, program_id FROM attendance WHERE id=?`, [q.params.id]);
  if (!a?.f || (q.u.role !== "admin" && a.program_id !== q.u.programId)) return fail(s, 404, "Bukti tidak ditemukan");
  const days = Math.min(90, Math.max(1, +(q.body.days || 30)));
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.query(
    "INSERT INTO evidence_tokens(token,attendance_id,field,created_by,expires_at) VALUES(?,?,?,?,?)",
    [token, +q.params.id, q.params.field, q.u.id, expiresAt]
  );
  await audit(q.u, a.program_id, "share-evidence", "presensi", +q.params.id, null, { field: q.params.field, days, expiresAt }, clean(q.body.reason) || "Buat tautan bukti berbatas waktu");
  const url = `${q.protocol}://${q.get("host")}/api/public/evidence/${token}`;
  s.json({ success: true, data: { url, expiresAt, days } });
}));

app.get("/api/public/evidence/:token", ah(async (q, s) => {
  const [[t]] = await db.query("SELECT * FROM evidence_tokens WHERE token=?", [q.params.token]);
  if (!t) return fail(s, 404, "Tautan bukti tidak valid");
  if (new Date(t.expires_at) < new Date()) return fail(s, 410, "Tautan bukti sudah kedaluwarsa");
  const col = { photo: "photo", excel: "ev_excel", bpe: "ev_bpe", report: "ev_report" }[t.field];
  const [[a]] = await db.query(`SELECT ${col} f FROM attendance WHERE id=?`, [t.attendance_id]);
  if (!a?.f || !fs.existsSync(path.resolve(a.f))) return fail(s, 404, "File bukti tidak ditemukan");
  s.sendFile(path.resolve(a.f));
}));

// ---------- ringkasan, audit, tutup tahun ----------
app.get("/api/summary", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const year = +(q.query.year || new Date().getFullYear());
  const [d] = await db.query(
    `SELECT p.id, p.name,
      (SELECT COUNT(*) FROM memberships m WHERE m.program_id=p.id AND m.active=1 AND m.year=?) relawan,
      (SELECT COUNT(*) FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.program_id=p.id AND s.year=?) hadir,
      (SELECT COALESCE(SUM(a.wp_count),0) FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.program_id=p.id AND s.year=?) total_wp,
      (SELECT COALESCE(SUM(a.status='menunggu'),0) FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.program_id=p.id AND s.year=?) menunggu,
      (SELECT COALESCE(SUM(a.late_minutes>p.late_limit_min),0) FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.program_id=p.id AND s.year=?) terlambat,
      (SELECT COUNT(*) FROM substitutions sub WHERE sub.program_id=p.id AND sub.year=? AND sub.status='menunggu') pergantian_menunggu,
      (SELECT COALESCE(per.closed,0) FROM periods per WHERE per.program_id=p.id AND per.year=?) period_closed
     FROM programs p
     WHERE (?=0 OR p.id=?)
     ORDER BY p.id ASC`,
    [year, year, year, year, year, year, year, q.u.role === "admin" ? 0 : 1, q.u.programId]
  );
  s.json({ success: true, data: d, year });
}));

app.get("/api/audit", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = scope(q);
  const where = [];
  const params = [];
  if (pid) { where.push("l.program_id=?"); params.push(pid); }
  if (q.query.entity) { where.push("l.entity=?"); params.push(clean(q.query.entity)); }
  return paged(q, s, {
    sel: "l.id,l.action,l.entity,l.entity_id,l.before_val,l.after_val,l.reason,l.created_at,COALESCE(u.name,'Pengguna terhapus') actor",
    from: "FROM audit_log l LEFT JOIN users u ON u.id=l.actor_id",
    where,
    params,
    search: ["l.action", "l.entity", "u.name", "l.reason"],
    sorts: { date: "l.created_at" },
    defSort: "l.created_at DESC",
  });
}));

app.post("/api/periods/close", auth("admin"), ah(async (q, s) => {
  const { programId, year, closed, reason } = q.body;
  if (!programId || !year) return fail(s, 400, "Program dan tahun wajib diisi");
  if (!clean(reason)) return fail(s, 400, "Alasan wajib diisi");
  await db.query(
    "INSERT INTO periods(program_id,year,closed) VALUES(?,?,?) ON DUPLICATE KEY UPDATE closed=?",
    [+programId, +year, closed ? 1 : 0, closed ? 1 : 0]
  );
  await audit(q.u, +programId, closed ? "close-period" : "open-period", "periode", +year, null, { closed: !!closed }, clean(reason));
  s.json({ success: true, message: closed ? `Periode ${year} ditutup (hanya baca)` : `Periode ${year} dibuka kembali` });
}));

// ---------- pergantian sesi ----------
app.get("/api/pergantian", auth(), ah(async (q, s) => {
  const mine = q.u.role === "relawan";
  const pid = mine ? q.u.programId : scope(q);
  const where = [];
  const params = [];
  if (pid) { where.push("sub.program_id=?"); params.push(pid); }
  if (mine) { where.push("(sub.requester_id=? OR sub.substitute_id=?)"); params.push(q.u.id, q.u.id); }
  if (q.query.year) { where.push("sub.year=?"); params.push(+q.query.year); }
  if (q.query.status) { where.push("sub.status=?"); params.push(clean(q.query.status)); }

  return paged(q, s, {
    sel: `sub.*, ses.date, ses.session_no, ses.start_time, ses.end_time, ses.title session_title,
      req.nim requester_nim, req.name requester_name,
      rep.nim sub_nim, COALESCE(rep.name, sub.substitute_name) sub_display_name,
      rev.name reviewer_name`,
    from: `FROM substitutions sub
      JOIN sessions ses ON ses.id=sub.session_id
      JOIN users req ON req.id=sub.requester_id
      LEFT JOIN users rep ON rep.id=sub.substitute_id
      LEFT JOIN users rev ON rev.id=sub.reviewer_id`,
    where,
    params,
    search: ["req.name", "req.nim", "sub.substitute_name", "ses.title", "sub.reason"],
    sorts: { date: "ses.date", created: "sub.created_at" },
    defSort: "sub.created_at DESC",
  });
}));

app.get("/api/pergantian/candidates", auth(), ah(async (q, s) => {
  const pid = q.u.role === "relawan" ? q.u.programId : scope(q);
  const year = +q.query.year || new Date().getFullYear();
  const [rows] = await db.query(
    `SELECT u.id, u.nim, u.name FROM users u
     JOIN memberships m ON m.user_id=u.id
     WHERE m.program_id=? AND m.year=? AND m.active=1 AND u.active=1 AND u.role='relawan' AND u.id!=?
     ORDER BY u.name ASC`,
    [pid, year, q.u.id]
  );
  s.json({ success: true, data: rows });
}));

app.post("/api/pergantian", auth("relawan"), ah(async (q, s) => {
  const sessionId = +q.body.sessionId;
  const substituteId = q.body.substituteId ? +q.body.substituteId : null;
  const substituteName = clean(q.body.substituteName);
  const scopeVal = q.body.scope === "sebagian" ? "sebagian" : "penuh";
  const reason = clean(q.body.reason);
  if (!sessionId || !reason) return fail(s, 400, "Jadwal dan alasan wajib diisi");
  if (!substituteId && !substituteName) return fail(s, 400, "Pilih atau isi nama pengganti");

  const [[asgn]] = await db.query(
    "SELECT s.id, s.program_id, s.year, s.date FROM sessions s JOIN assignments a ON a.session_id=s.id AND a.user_id=? WHERE s.id=? AND s.program_id=?",
    [q.u.id, sessionId, q.u.programId]
  );
  if (!asgn) return fail(s, 403, "Jadwal bukan milik Anda");
  if (await isClosed(asgn.program_id, asgn.year)) return fail(s, 423, "Periode sudah ditutup");

  let resolvedName = substituteName;
  if (substituteId) {
    const [[subU]] = await db.query("SELECT name FROM users WHERE id=?", [substituteId]);
    if (subU) resolvedName = subU.name;
  }

  const [r] = await db.query(
    "INSERT INTO substitutions(session_id,program_id,year,requester_id,substitute_id,substitute_name,scope,reason) VALUES(?,?,?,?,?,?,?,?)",
    [sessionId, asgn.program_id, asgn.year, q.u.id, substituteId, resolvedName, scopeVal, reason]
  );
  await audit(q.u, asgn.program_id, "create", "pergantian", r.insertId, null, { sessionId, substituteId, resolvedName, scope: scopeVal }, reason);
  s.json({ success: true, message: "Pengajuan pergantian dikirim dan menunggu persetujuan pengurus" });
}));

app.put("/api/pergantian/:id/review", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const action = q.body.action;
  const reviewReason = clean(q.body.reason);
  const substituteIdOverride = q.body.substituteId ? +q.body.substituteId : null;
  if (!["setujui", "tolak"].includes(action)) return fail(s, 400, "Aksi tidak valid");
  if (action === "tolak" && !reviewReason) return fail(s, 400, "Alasan penolakan wajib diisi");

  const [[sub]] = await db.query(
    "SELECT sub.*, ses.date FROM substitutions sub JOIN sessions ses ON ses.id=sub.session_id WHERE sub.id=?",
    [q.params.id]
  );
  if (!sub || (q.u.role !== "admin" && sub.program_id !== q.u.programId)) return fail(s, 404, "Pengajuan tidak ditemukan");
  if (await isClosed(sub.program_id, sub.year)) return fail(s, 423, "Periode sudah ditutup");

  const finalSubId = substituteIdOverride || sub.substitute_id;
  const status = action === "setujui" ? "disetujui" : "ditolak";

  await db.query(
    "UPDATE substitutions SET status=?, substitute_id=?, reviewer_id=?, review_reason=?, reviewed_at=NOW() WHERE id=?",
    [status, finalSubId, q.u.id, reviewReason || null, sub.id]
  );

  if (status === "disetujui" && finalSubId) {
    await db.query("UPDATE assignments SET replaced_by=? WHERE session_id=? AND user_id=?", [finalSubId, sub.session_id, sub.requester_id]);
    await db.query("INSERT IGNORE INTO assignments(session_id,user_id) VALUES(?,?)", [sub.session_id, finalSubId]);

    const cfg = await getProgramSettings(sub.program_id);
    const pts = cfg?.settings?.bonus?.pengganti ?? 5;
    const month = Number(String(sub.date).slice(5, 7));
    const [[exists]] = await db.query("SELECT id FROM appreciation_points WHERE substitution_id=?", [sub.id]);
    if (!exists) {
      await db.query(
        "INSERT INTO appreciation_points(program_id,user_id,year,month,category,points,note,substitution_id,verified,created_by,verified_by) VALUES(?,?,?,?,?,?,?,?,0,?,NULL)",
        [sub.program_id, finalSubId, sub.year, month, "pengganti", pts, `Menggantikan sesi tanggal ${sub.date}`, sub.id, q.u.id]
      );
    }
    await markFinalReportStale(sub.program_id, sub.date);
  }

  await audit(q.u, sub.program_id, "review-pergantian", "pergantian", sub.id, { status: sub.status }, { status, substituteId: finalSubId }, reviewReason);
  s.json({ success: true, message: status === "disetujui" ? "Pergantian disetujui" : "Pergantian ditolak" });
}));

// ---------- pusat materi & panduan ----------
const MATERIAL_CATEGORIES = ["SOP", "Guidebook", "Materi", "Penilaian", "Kegiatan", "Lainnya"];

app.get("/api/materi", auth(), ah(async (q, s) => {
  const isVol = q.u.role === "relawan";
  const pid = isVol ? q.u.programId : scope(q);
  const where = [];
  const params = [];
  if (pid) { where.push("m.program_id=?"); params.push(pid); }
  if (isVol) { where.push("m.visible_to_volunteer=1 AND m.active=1"); }
  if (q.query.category) { where.push("m.category=?"); params.push(clean(q.query.category)); }
  if (q.query.year) { where.push("m.year=?"); params.push(+q.query.year); }
  if (q.query.month) { where.push("MONTH(COALESCE(m.doc_date, m.created_at))=?"); params.push(+q.query.month); }

  return paged(q, s, {
    sel: "m.*, p.name program_name, u.name uploader_name",
    from: "FROM materials m JOIN programs p ON p.id=m.program_id JOIN users u ON u.id=m.uploaded_by",
    where,
    params,
    search: ["m.title", "m.description", "m.category"],
    sorts: { date: "m.doc_date", title: "m.title" },
    defSort: "m.updated_at DESC",
  });
}));

app.get("/api/materi/:id/versions", auth(), ah(async (q, s) => {
  const [[mat]] = await db.query("SELECT * FROM materials WHERE id=?", [q.params.id]);
  if (!mat) return fail(s, 404, "Materi tidak ditemukan");
  if (q.u.role !== "admin" && mat.program_id !== q.u.programId) return fail(s, 403, "Tidak memiliki akses");
  const [rows] = await db.query(
    "SELECT v.*, u.name uploader_name FROM material_versions v JOIN users u ON u.id=v.uploaded_by WHERE v.material_id=? ORDER BY v.version DESC",
    [mat.id]
  );
  s.json({ success: true, data: rows });
}));

app.post("/api/materi", auth("pengurus", "admin"), upload.single("file"), ah(async (q, s) => {
  const pid = scope(q) || +q.body.programId;
  const title = clean(q.body.title);
  const category = MATERIAL_CATEGORIES.includes(q.body.category) ? q.body.category : "Materi";
  const year = +q.body.year || new Date().getFullYear();
  const docDate = clean(q.body.docDate) || null;
  const description = clean(q.body.description);
  const externalUrl = clean(q.body.externalUrl) || null;
  const filePath = q.file ? q.file.path : null;
  const visible = q.body.visibleToVolunteer === "false" || q.body.visibleToVolunteer === false || q.body.visibleToVolunteer === "0" ? 0 : 1;
  const active = q.body.active === "false" || q.body.active === false || q.body.active === "0" ? 0 : 1;

  if (!pid || !title) return fail(s, 400, "Program dan judul materi wajib diisi");
  if (!filePath && !externalUrl) return fail(s, 400, "Unggah file atau tempel tautan eksternal");

  const [r] = await db.query(
    `INSERT INTO materials(program_id,year,title,category,doc_date,description,file_path,external_url,visible_to_volunteer,active,version,uploaded_by)
     VALUES(?,?,?,?,?,?,?,?,?,?,1,?)`,
    [pid, year, title, category, docDate, description, filePath, externalUrl, visible, active, q.u.id]
  );
  await db.query(
    "INSERT INTO material_versions(material_id,version,file_path,external_url,uploaded_by,note) VALUES(?,1,?,?,?,'Versi awal')",
    [r.insertId, filePath, externalUrl, q.u.id]
  );
  await audit(q.u, pid, "create", "materi", r.insertId, null, { title, category, visible });
  s.json({ success: true, message: "Materi berhasil disimpan" });
}));

app.put("/api/materi/:id", auth("pengurus", "admin"), upload.single("file"), ah(async (q, s) => {
  const [[mat]] = await db.query("SELECT * FROM materials WHERE id=?", [q.params.id]);
  if (!mat || (q.u.role !== "admin" && mat.program_id !== q.u.programId)) return fail(s, 404, "Materi tidak ditemukan");

  const title = clean(q.body.title) || mat.title;
  const category = MATERIAL_CATEGORIES.includes(q.body.category) ? q.body.category : mat.category;
  const docDate = q.body.docDate !== undefined ? clean(q.body.docDate) || null : mat.doc_date;
  const description = q.body.description !== undefined ? clean(q.body.description) : mat.description;
  const visible =
    q.body.visibleToVolunteer !== undefined
      ? q.body.visibleToVolunteer === "false" || q.body.visibleToVolunteer === false || q.body.visibleToVolunteer === "0"
        ? 0
        : 1
      : mat.visible_to_volunteer;
  const active =
    q.body.active !== undefined
      ? q.body.active === "false" || q.body.active === false || q.body.active === "0"
        ? 0
        : 1
      : mat.active;

  const newFile = q.file ? q.file.path : null;
  const newUrl = q.body.externalUrl !== undefined ? clean(q.body.externalUrl) || null : mat.external_url;
  const isNewVersion = Boolean(newFile || (newUrl && newUrl !== mat.external_url));
  const nextVersion = isNewVersion ? mat.version + 1 : mat.version;
  const finalFile = newFile || mat.file_path;

  await db.query(
    `UPDATE materials SET title=?, category=?, doc_date=?, description=?, file_path=?, external_url=?, visible_to_volunteer=?, active=?, version=? WHERE id=?`,
    [title, category, docDate, description, finalFile, newUrl, visible, active, nextVersion, mat.id]
  );
  if (isNewVersion) {
    await db.query(
      "INSERT INTO material_versions(material_id,version,file_path,external_url,uploaded_by,note) VALUES(?,?,?,?,?,?)",
      [mat.id, nextVersion, finalFile, newUrl, q.u.id, clean(q.body.versionNote) || `Pembaruan versi ${nextVersion}`]
    );
  }
  await audit(q.u, mat.program_id, "update", "materi", mat.id, { title: mat.title, version: mat.version }, { title, version: nextVersion, visible, active });
  s.json({ success: true, message: isNewVersion ? `Versi baru (v${nextVersion}) tersimpan` : "Materi diperbarui" });
}));

app.get("/api/materi/:id/download", auth(), ah(async (q, s) => {
  const versionId = q.query.versionId ? +q.query.versionId : null;
  const [[mat]] = await db.query("SELECT * FROM materials WHERE id=?", [q.params.id]);
  if (!mat) return fail(s, 404, "Materi tidak ditemukan");
  if (q.u.role !== "admin" && mat.program_id !== q.u.programId) return fail(s, 403, "Tidak memiliki akses");
  if (q.u.role === "relawan" && (!mat.visible_to_volunteer || !mat.active)) return fail(s, 403, "Materi tidak tersedia untuk relawan");

  let targetPath = mat.file_path;
  if (versionId) {
    const [[v]] = await db.query("SELECT file_path FROM material_versions WHERE id=? AND material_id=?", [versionId, mat.id]);
    if (v?.file_path) targetPath = v.file_path;
  }
  if (!targetPath || !fs.existsSync(path.resolve(targetPath))) return fail(s, 404, "File tidak ditemukan");
  await audit(q.u, mat.program_id, "download-materi", "materi", mat.id, null, { title: mat.title, versionId }, "Unduh materi/panduan");
  s.sendFile(path.resolve(targetPath));
}));

app.delete("/api/materi/:id", auth("pengurus", "admin"), ah(async (q, s) => {
  const id = +q.params.id;
  const [[mat]] = await db.query("SELECT * FROM materials WHERE id=?", [id]);
  if (!mat || (q.u.role !== "admin" && mat.program_id !== q.u.programId)) return fail(s, 404, "Materi tidak ditemukan");

  const filesToDelete = new Set([mat.file_path].filter(Boolean));
  const [vers] = await db.query("SELECT file_path FROM material_versions WHERE material_id=?", [id]);
  vers.forEach((v) => { if (v.file_path) filesToDelete.add(v.file_path); });
  for (const fp of filesToDelete) safeUnlink(fp);

  await db.query("DELETE FROM material_versions WHERE material_id=?", [id]);
  await db.query("DELETE FROM materials WHERE id=?", [id]);
  await audit(
    q.u,
    mat.program_id,
    "delete",
    "materi",
    id,
    { title: mat.title, category: mat.category, version: mat.version },
    null,
    clean(q.body?.reason || q.query.reason) || "Hapus materi/panduan"
  );
  s.json({ success: true, message: `Materi "${mat.title}" dan file terkait berhasil dihapus` });
}));

// ---------- pengaturan & periode ----------
app.get("/api/settings", auth(), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.query.programId || 1) : q.u.programId;
  const data = await getProgramSettings(pid);
  if (!data) return fail(s, 404, "Program tidak ditemukan");
  s.json({ success: true, data });
}));

app.put("/api/settings", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.body.programId || q.query.programId || 1) : q.u.programId;
  const current = await getProgramSettings(pid);
  if (!current) return fail(s, 404, "Program tidak ditemukan");

  const incoming = q.body.settings || {};
  const merged = {
    ...current.settings,
    ...incoming,
    scores: { ...current.settings.scores, ...(incoming.scores || {}) },
    bonus: { ...current.settings.bonus, ...(incoming.bonus || {}) },
  };

  const reqEv = Array.isArray(merged.required_evidence) ? merged.required_evidence : current.settings.required_evidence;
  const lateLimit = Number(merged.late_limit_min) >= 0 ? Number(merged.late_limit_min) : 10;
  const gpsRadius = merged.gps_radius_m === "" || merged.gps_radius_m === null || merged.gps_radius_m === undefined
    ? null
    : Number(merged.gps_radius_m);
  merged.gps_radius_m = Number.isFinite(gpsRadius) ? gpsRadius : null;

  await db.query(
    "UPDATE programs SET required_evidence=?, late_limit_min=?, gps_radius_m=?, settings=? WHERE id=?",
    [JSON.stringify(reqEv), lateLimit, merged.gps_radius_m, JSON.stringify(merged), pid]
  );
  await audit(q.u, pid, "update-settings", "pengaturan", pid, current.settings, merged, clean(q.body.reason) || "Ubah pengaturan program");
  s.json({ success: true, message: "Pengaturan program disimpan", data: merged });
}));

app.get("/api/periods", auth(), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? (q.query.programId ? +q.query.programId : null) : q.u.programId;
  const curYear = new Date().getFullYear();
  const [existing] = await db.query(
    `SELECT p.id program_id, p.name program_name, per.year, COALESCE(per.closed,0) closed
     FROM programs p LEFT JOIN periods per ON per.program_id=p.id
     ${pid ? "WHERE p.id=?" : ""}
     ORDER BY per.year DESC, p.id ASC`,
    pid ? [pid] : []
  );
  const [yearsRaw] = await db.query(
    "SELECT DISTINCT year FROM (SELECT year FROM memberships UNION SELECT year FROM sessions UNION SELECT year FROM periods) y ORDER BY year DESC"
  );
  const years = Array.from(new Set([curYear + 1, curYear, curYear - 1, ...yearsRaw.map((r) => r.year)])).sort((a, b) => b - a);
  s.json({ success: true, data: existing, years });
}));

// ---------- program studi (master) ----------
app.get("/api/prodi/options", auth(), ah(async (q, s) => {
  const [rows] = await db.query("SELECT id, name FROM prodi WHERE active=1 ORDER BY name ASC");
  s.json({ success: true, data: rows });
}));

app.get("/api/prodi", auth("admin"), ah(async (q, s) => {
  return paged(q, s, {
    sel: "p.id, p.name, p.active, p.created_at, (SELECT COUNT(*) FROM users u WHERE u.prodi=p.name) relawan_count",
    from: "FROM prodi p",
    search: ["p.name"],
    sorts: { name: "p.name", created: "p.created_at" },
    defSort: "p.name ASC",
  });
}));

app.post("/api/prodi", auth("admin"), ah(async (q, s) => {
  const name = clean(q.body.name);
  if (!name) return fail(s, 400, "Nama Program Studi wajib diisi");

  const [[existing]] = await db.query("SELECT id, name, active FROM prodi WHERE LOWER(name)=LOWER(?)", [name]);
  if (existing) {
    if (!existing.active) {
      await db.query("UPDATE prodi SET active=1 WHERE id=?", [existing.id]);
      await audit(q.u, null, "reactivate", "prodi", existing.id, { active: 0 }, { name: existing.name, active: 1 });
      return s.json({ success: true, message: `Program Studi "${existing.name}" diaktifkan kembali`, data: { id: existing.id, name: existing.name } });
    }
    return fail(s, 409, `Program Studi "${existing.name}" sudah ada`);
  }

  const [r] = await db.query("INSERT INTO prodi(name, active) VALUES(?, 1)", [name]);
  await audit(q.u, null, "create", "prodi", r.insertId, null, { name });
  s.json({ success: true, message: `Program Studi "${name}" berhasil ditambahkan`, data: { id: r.insertId, name } });
}));

app.put("/api/prodi/:id", auth("admin"), ah(async (q, s) => {
  const id = +q.params.id;
  const [[before]] = await db.query("SELECT id, name, active FROM prodi WHERE id=?", [id]);
  if (!before) return fail(s, 404, "Program Studi tidak ditemukan");

  const name = clean(q.body.name) || before.name;
  const active = q.body.active !== undefined ? (q.body.active ? 1 : 0) : before.active;

  const [[dup]] = await db.query("SELECT id FROM prodi WHERE LOWER(name)=LOWER(?) AND id!=?", [name, id]);
  if (dup) return fail(s, 409, `Program Studi "${name}" sudah ada`);

  await db.query("UPDATE prodi SET name=?, active=? WHERE id=?", [name, active, id]);
  if (name !== before.name) {
    await db.query("UPDATE users SET prodi=? WHERE prodi=?", [name, before.name]);
  }
  await audit(q.u, null, "update", "prodi", id, before, { name, active }, clean(q.body.reason) || "Ubah Program Studi");
  s.json({ success: true, message: "Program Studi diperbarui" });
}));

app.delete("/api/prodi/:id", auth("admin"), ah(async (q, s) => {
  const id = +q.params.id;
  const [[before]] = await db.query("SELECT id, name, active FROM prodi WHERE id=?", [id]);
  if (!before) return fail(s, 404, "Program Studi tidak ditemukan");

  await db.query("DELETE FROM prodi WHERE id=?", [id]);
  await audit(q.u, null, "delete", "prodi", id, before, null, clean(q.body?.reason || q.query.reason) || "Hapus Program Studi");
  s.json({ success: true, message: `Program Studi "${before.name}" dihapus` });
}));

// ---------- relawan of the month ----------
function calcAttendanceScore(lateMinutes, scores, lateLimit) {
  if (lateMinutes === null || lateMinutes === undefined) return Number(scores.absent ?? 0);
  if (lateMinutes <= lateLimit) return Number(scores.ontime ?? 30);
  if (lateMinutes <= 20) return Number(scores.late11_20 ?? 24);
  if (lateMinutes <= 30) return Number(scores.late21_30 ?? 18);
  return Number(scores.late30plus ?? 12);
}

async function computeRanking(programId, year, month) {
  const cfg = await getProgramSettings(programId);
  if (!cfg) return null;
  const st = cfg.settings;
  const targetWp = Number(st.target_wp) || 14;
  const weightService = Number(st.weight_service) || 70;
  const lateLimit = Number(st.late_limit_min) ?? 10;

  const [vols] = await db.query(
    `SELECT u.id, u.nim, u.name, u.prodi
     FROM users u JOIN memberships m ON m.user_id=u.id
     WHERE m.program_id=? AND m.year=? AND m.active=1 AND u.active=1 AND u.role='relawan'
     ORDER BY u.name ASC`,
    [programId, year]
  );

  const [assigns] = await db.query(
    `SELECT a.user_id, a.session_id, att.id att_id, att.late_minutes, att.wp_count, att.status
     FROM assignments a
     JOIN sessions s ON s.id=a.session_id
     LEFT JOIN attendance att ON att.session_id=a.session_id AND att.user_id=a.user_id
     WHERE s.program_id=? AND s.year=? AND MONTH(s.date)=? AND a.replaced_by IS NULL`,
    [programId, year, month]
  );

  const [pts] = await db.query(
    `SELECT ap.*, u.name actor_name
     FROM appreciation_points ap
     LEFT JOIN users u ON u.id=ap.created_by
     WHERE ap.program_id=? AND ap.year=? AND ap.month=?`,
    [programId, year, month]
  );

  const byUserAssigns = new Map();
  for (const a of assigns) {
    if (!byUserAssigns.has(a.user_id)) byUserAssigns.set(a.user_id, []);
    byUserAssigns.get(a.user_id).push(a);
  }
  const byUserPts = new Map();
  for (const p of pts) {
    if (!byUserPts.has(p.user_id)) byUserPts.set(p.user_id, []);
    byUserPts.get(p.user_id).push(p);
  }

  const rows = vols.map((v) => {
    const myAssigns = byUserAssigns.get(v.id) || [];
    const totalScheduled = myAssigns.length;
    const attended = myAssigns.filter((a) => a.att_id && a.status !== "ditolak");
    const shiftsDone = attended.length;
    const totalWp = attended.reduce((acc, a) => acc + Number(a.wp_count || 0), 0);
    const avgWp = shiftsDone > 0 ? totalWp / shiftsDone : 0;
    const scoreService = Math.min(weightService, targetWp > 0 ? (avgWp / targetWp) * weightService : 0);

    let scoreAttendance = 0;
    if (totalScheduled > 0) {
      const sumScore = myAssigns.reduce((acc, a) => {
        if (!a.att_id || a.status === "ditolak") return acc + calcAttendanceScore(null, st.scores, lateLimit);
        return acc + calcAttendanceScore(a.late_minutes, st.scores, lateLimit);
      }, 0);
      scoreAttendance = sumScore / totalScheduled;
    }

    const myPts = byUserPts.get(v.id) || [];
    const scoreBonus = myPts.filter((p) => p.verified).reduce((acc, p) => acc + Number(p.points || 0), 0);
    const pendingBonus = myPts.filter((p) => !p.verified).length;
    const totalScore = scoreService + scoreAttendance + scoreBonus;

    return {
      user_id: v.id,
      nim: v.nim,
      name: v.name,
      prodi: v.prodi,
      total_scheduled: totalScheduled,
      shifts_done: shiftsDone,
      total_wp: totalWp,
      avg_wp: Number(avgWp.toFixed(2)),
      score_service: Number(scoreService.toFixed(2)),
      score_attendance: Number(scoreAttendance.toFixed(2)),
      score_bonus: Number(scoreBonus.toFixed(2)),
      pending_bonus: pendingBonus,
      total_score: Number(totalScore.toFixed(2)),
      points_detail: myPts,
    };
  });

  rows.sort(
    (a, b) =>
      b.total_score - a.total_score ||
      b.score_attendance - a.score_attendance ||
      b.shifts_done - a.shifts_done ||
      b.score_bonus - a.score_bonus ||
      a.name.localeCompare(b.name)
  );
  rows.forEach((r, idx) => { r.rank = idx + 1; });

  const [[winner]] = await db.query(
    `SELECT w.*, u.nim, u.name, u.prodi, d.name decided_by_name
     FROM rotm_winners w
     JOIN users u ON u.id=w.user_id
     JOIN users d ON d.id=w.decided_by
     WHERE w.program_id=? AND w.year=? AND w.month=?`,
    [programId, year, month]
  );

  return { program: cfg.program, settings: st, year, month, ranking: rows, winner: winner || null };
}

app.get("/api/rotm", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.query.programId || 1) : q.u.programId;
  const year = +(q.query.year || new Date().getFullYear());
  const month = +(q.query.month || new Date().getMonth() + 1);
  const data = await computeRanking(pid, year, month);
  if (!data) return fail(s, 404, "Program tidak ditemukan");
  s.json({ success: true, data });
}));

app.get("/api/rotm/points", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.query.programId || 1) : q.u.programId;
  const year = +(q.query.year || new Date().getFullYear());
  const month = +(q.query.month || new Date().getMonth() + 1);
  const [rows] = await db.query(
    `SELECT ap.*, u.nim, u.name user_name, c.name creator_name, v.name verifier_name
     FROM appreciation_points ap
     JOIN users u ON u.id=ap.user_id
     JOIN users c ON c.id=ap.created_by
     LEFT JOIN users v ON v.id=ap.verified_by
     WHERE ap.program_id=? AND ap.year=? AND ap.month=?
     ORDER BY ap.created_at DESC`,
    [pid, year, month]
  );
  s.json({ success: true, data: rows });
}));

app.post("/api/rotm/points", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.body.programId || 1) : q.u.programId;
  const userId = +q.body.userId;
  const year = +(q.body.year || new Date().getFullYear());
  const month = +(q.body.month || new Date().getMonth() + 1);
  const category = q.body.category;
  const note = clean(q.body.note);
  if (!userId || !["pengganti", "bantu_kegiatan", "konten", "masukan"].includes(category)) {
    return fail(s, 400, "Relawan dan kategori poin wajib diisi");
  }
  if (!note) return fail(s, 400, "Catatan verifikasi poin apresiasi wajib diisi");

  const cfg = await getProgramSettings(pid);
  const defaultPts = cfg?.settings?.bonus?.[category] ?? 2;
  const points = q.body.points !== undefined && q.body.points !== "" ? Number(q.body.points) : defaultPts;

  const [r] = await db.query(
    "INSERT INTO appreciation_points(program_id,user_id,year,month,category,points,note,verified,created_by,verified_by) VALUES(?,?,?,?,?,?,?,1,?,?)",
    [pid, userId, year, month, category, points, note, q.u.id, q.u.id]
  );
  await audit(q.u, pid, "create", "poin-apresiasi", r.insertId, null, { userId, category, points, year, month }, note);
  s.json({ success: true, message: "Poin apresiasi berhasil ditambahkan" });
}));

app.put("/api/rotm/points/:id/verify", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const [[pt]] = await db.query("SELECT * FROM appreciation_points WHERE id=?", [q.params.id]);
  if (!pt || (q.u.role !== "admin" && pt.program_id !== q.u.programId)) return fail(s, 404, "Data poin tidak ditemukan");
  const verified = q.body.verified === false || q.body.verified === 0 ? 0 : 1;
  await db.query("UPDATE appreciation_points SET verified=?, verified_by=? WHERE id=?", [verified, verified ? q.u.id : null, pt.id]);
  await audit(q.u, pt.program_id, "verify", "poin-apresiasi", pt.id, { verified: pt.verified }, { verified }, clean(q.body.note) || "Verifikasi poin");
  s.json({ success: true, message: verified ? "Poin diverifikasi" : "Verifikasi poin dibatalkan" });
}));

app.delete("/api/rotm/points/:id", auth("pengurus", "admin"), ah(async (q, s) => {
  const [[pt]] = await db.query("SELECT * FROM appreciation_points WHERE id=?", [q.params.id]);
  if (!pt || (q.u.role !== "admin" && pt.program_id !== q.u.programId)) return fail(s, 404, "Data poin tidak ditemukan");
  await db.query("DELETE FROM appreciation_points WHERE id=?", [pt.id]);
  await audit(q.u, pt.program_id, "delete", "poin-apresiasi", pt.id, pt, null, "Hapus poin apresiasi");
  s.json({ success: true, message: "Poin apresiasi dihapus" });
}));

app.post("/api/rotm/winner", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.body.programId || 1) : q.u.programId;
  const year = +(q.body.year || new Date().getFullYear());
  const month = +(q.body.month || new Date().getMonth() + 1);
  const userId = +q.body.userId;
  const note = clean(q.body.note);
  if (!userId) return fail(s, 400, "Pilih relawan yang akan ditetapkan");

  const calc = await computeRanking(pid, year, month);
  const entry = calc?.ranking?.find((r) => r.user_id === userId);
  if (!entry) return fail(s, 404, "Relawan tidak ditemukan di daftar kandidat program ini");

  await db.query(
    `INSERT INTO rotm_winners(program_id,year,month,user_id,score_service,score_attendance,score_bonus,total_score,shifts,decided_by,note,decided_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), score_service=VALUES(score_service), score_attendance=VALUES(score_attendance),
       score_bonus=VALUES(score_bonus), total_score=VALUES(total_score), shifts=VALUES(shifts), decided_by=VALUES(decided_by),
       note=VALUES(note), decided_at=NOW()`,
    [pid, year, month, userId, entry.score_service, entry.score_attendance, entry.score_bonus, entry.total_score, entry.shifts_done, q.u.id, note || null]
  );
  await audit(q.u, pid, "set-rotm", "rotm", userId, null, { year, month, userId, total_score: entry.total_score }, note || "Penetapan Relawan of the Month");
  s.json({ success: true, message: `${entry.name} ditetapkan sebagai Relawan of the Month` });
}));

// ---------- impor relawan (validasi & simpan JSON dari FE) ----------
function normalizeProgramId(val, fallbackPid) {
  const s = String(val ?? "").trim().toLowerCase();
  if (!s) return fallbackPid || null;
  if (s === "1" || s.includes("clinic")) return 1;
  if (s === "2" || s.includes("renjani")) return 2;
  return null;
}

app.post("/api/relawan/import/preview", auth("pengurus", "admin"), ah(async (q, s) => {
  const year = +(q.body.year || new Date().getFullYear());
  const fallbackPid = q.u.role === "admin" ? (+q.body.programId || null) : q.u.programId;
  const rawRows = Array.isArray(q.body.rows) ? q.body.rows : [];
  if (!rawRows.length) return fail(s, 400, "Data Excel kosong");

  const [existingUsers] = await db.query("SELECT id, nim, name FROM users");
  const existingMap = new Map(existingUsers.map((u) => [u.nim, u]));

  const seenKeys = new Set();
  const rows = [];
  const summary = { total: 0, valid: 0, existing: 0, duplicate: 0, error: 0 };

  rawRows.forEach((raw, idx) => {
    const rowNumber = raw.rowNumber || idx + 2;
    const nim = clean(raw.nim);
    const name = clean(raw.name);
    const prodi = clean(raw.prodi);
    const rawProg = clean(raw.program);
    const rawRole = clean(raw.role).toLowerCase() || "relawan";

    if (!nim && !name) return;
    summary.total++;

    let programId = normalizeProgramId(rawProg, fallbackPid);
    if (q.u.role !== "admin") programId = q.u.programId;

    const role = q.u.role === "admin" && ["koordinator", "pengurus", "relawan"].includes(rawRole) ? rawRole : "relawan";
    const key = `${nim}_${programId}`;

    let status = "valid";
    let message = existingMap.has(nim) ? "Relawan lama (terhubung lewat NIM)" : "Relawan baru";

    if (!nim || !name) {
      status = "error";
      message = "NIM dan Nama wajib diisi";
      summary.error++;
    } else if (!programId) {
      status = "error";
      message = "Program tidak valid (gunakan Tax Clinic / Renjani)";
      summary.error++;
    } else if (seenKeys.has(key)) {
      status = "duplicate";
      message = "Baris ganda dalam file";
      summary.duplicate++;
    } else {
      seenKeys.add(key);
      summary.valid++;
      if (existingMap.has(nim)) summary.existing++;
    }

    rows.push({
      rowNumber,
      nim,
      name,
      prodi,
      programId,
      programName: programId === 1 ? "Tax Clinic" : programId === 2 ? "Renjani" : "-",
      role,
      isExisting: existingMap.has(nim),
      status,
      message,
    });
  });

  s.json({ success: true, data: { year, summary, rows } });
}));

app.post("/api/relawan/import/commit", auth("pengurus", "admin"), ah(async (q, s) => {
  const year = +(q.body.year || new Date().getFullYear());
  const deactivateMissing = Boolean(q.body.deactivateMissing);
  const items = Array.isArray(q.body.rows) ? q.body.rows.filter((r) => r.status === "valid") : [];
  if (!items.length) return fail(s, 400, "Tidak ada baris valid untuk disimpan");

  const importedUserIdsByProg = new Map();
  let created = 0;
  let updated = 0;

  for (const item of items) {
    const pid = q.u.role === "admin" ? +item.programId : q.u.programId;
    if (!pid) continue;
    const nim = clean(item.nim);
    const name = clean(item.name);
    const prodi = clean(item.prodi);
    const role = q.u.role === "admin" && ["koordinator", "pengurus", "relawan"].includes(item.role) ? item.role : "relawan";

    let [[u]] = await db.query("SELECT id FROM users WHERE nim=?", [nim]);
    if (!u) {
      const hash = await bcrypt.hash(nim + "@taxora", 10);
      const [r] = await db.query(
        "INSERT INTO users(nim,name,prodi,role,password_hash,must_change,active) VALUES(?,?,?,?,?,1,1)",
        [nim, name, prodi, role, hash]
      );
      u = { id: r.insertId };
      created++;
    } else {
      await db.query("UPDATE users SET name=?, prodi=COALESCE(NULLIF(?,''), prodi), active=1 WHERE id=?", [name, prodi, u.id]);
      updated++;
    }

    if (prodi) await db.query("INSERT IGNORE INTO prodi(name, active) VALUES(?, 1)", [prodi]);
    await db.query(
      "INSERT INTO memberships(user_id,program_id,year,active) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE active=1",
      [u.id, pid, year]
    );

    if (!importedUserIdsByProg.has(pid)) importedUserIdsByProg.set(pid, []);
    importedUserIdsByProg.get(pid).push(u.id);
  }

  let deactivated = 0;
  if (deactivateMissing) {
    for (const [pid, ids] of importedUserIdsByProg.entries()) {
      if (!ids.length) continue;
      const [res] = await db.query(
        `UPDATE memberships m JOIN users u ON u.id=m.user_id
         SET m.active=0
         WHERE m.program_id=? AND m.year=? AND u.role='relawan' AND m.user_id NOT IN (${ids.map(() => "?").join(",")})`,
        [pid, year, ...ids]
      );
      deactivated += res.affectedRows || 0;
    }
  }

  await audit(
    q.u,
    q.u.role === "admin" ? null : q.u.programId,
    "import-relawan",
    "relawan",
    null,
    null,
    { year, created, updated, deactivated },
    `Impor massal ${items.length} relawan tahun ${year}`
  );

  s.json({
    success: true,
    message: `Impor selesai: ${created} baru, ${updated} diperbarui${deactivateMissing ? `, ${deactivated} dinonaktifkan` : ""}`,
    data: { created, updated, deactivated },
  });
}));

// ---------- laporan bulanan, tahunan, gabungan & ekspor ----------
async function getMonthlyDataset(programId, year, month, filters = {}) {
  const cfg = await getProgramSettings(programId);
  if (!cfg) return null;

  const where = ["s.program_id=?", "s.year=?", "MONTH(s.date)=?"];
  const params = [programId, year, month];
  if (filters.userId) { where.push("u.id=?"); params.push(+filters.userId); }
  if (filters.date) { where.push("s.date=?"); params.push(clean(filters.date)); }

  const [rows] = await db.query(
    `SELECT a.id assignment_id, a.session_id, a.user_id, a.replaced_by,
      u.nim, u.name, u.prodi,
      s.date, s.session_no, s.start_time, s.end_time, s.title session_title, s.surat_tugas_no,
      att.id attendance_id, att.start_at, att.end_at, att.late_minutes, att.gps_valid,
      att.wp_count, att.photo, att.ev_excel, att.ev_bpe, att.ev_report, att.notes,
      att.status verify_status, att.verify_reason
     FROM assignments a
     JOIN sessions s ON s.id=a.session_id
     JOIN users u ON u.id=a.user_id
     LEFT JOIN attendance att ON att.session_id=a.session_id AND att.user_id=a.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY s.date ASC, s.session_no ASC, u.name ASC`,
    params
  );

  const reqEv = cfg.settings.required_evidence || [];
  let hadir = 0, tidakHadir = 0, diganti = 0, terlambat = 0, menunggu = 0, buktiBelumLengkap = 0, totalWp = 0;

  const formatted = rows.map((r) => {
    let attendanceStatus = "Tidak Hadir";
    if (r.replaced_by) {
      attendanceStatus = "Digantikan";
      diganti++;
    } else if (r.attendance_id) {
      attendanceStatus = r.late_minutes > (cfg.settings.late_limit_min ?? 10) ? "Hadir (Terlambat)" : "Hadir";
      hadir++;
      if (r.late_minutes > (cfg.settings.late_limit_min ?? 10)) terlambat++;
      if (r.verify_status === "menunggu") menunggu++;
      const missing = reqEv.filter((k) => !r["ev_" + k]);
      if (missing.length) buktiBelumLengkap++;
      totalWp += Number(r.wp_count || 0);
    } else {
      tidakHadir++;
    }
    return { ...r, attendance_status: attendanceStatus };
  });

  const [[meta]] = await db.query(
    "SELECT r.*, u.name updated_by_name FROM monthly_reports r LEFT JOIN users u ON u.id=r.updated_by WHERE r.program_id=? AND r.year=? AND r.month=?",
    [programId, year, month]
  );

  return {
    program: cfg.program,
    settings: cfg.settings,
    year,
    month,
    monthName: MONTHS_ID[month],
    summary: {
      total_penugasan: rows.length,
      hadir,
      tidak_hadir: tidakHadir,
      diganti,
      terlambat,
      menunggu_verifikasi: menunggu,
      bukti_belum_lengkap: buktiBelumLengkap,
      total_wp: totalWp,
    },
    meta: meta || {
      status: "draft",
      version: 0,
      letter_no: cfg.settings.report_letter_no,
      narrative: cfg.settings.report_narrative,
      signatory_name: cfg.settings.report_signatory_name,
      signatory_title: cfg.settings.report_signatory_title,
    },
    rows: formatted,
  };
}

async function getOrCreateEvidenceUrl(req, actor, attendanceId, field, publicShare) {
  const baseUrl = `${req.protocol}://${req.get("host")}/api`;
  if (!publicShare) return `${baseUrl}/evidence/${attendanceId}/${field}`;
  const token = crypto.randomBytes(20).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.query(
    "INSERT INTO evidence_tokens(token,attendance_id,field,created_by,expires_at) VALUES(?,?,?,?,?)",
    [token, attendanceId, field, actor.id, expiresAt]
  );
  return `${baseUrl}/public/evidence/${token}`;
}

app.get("/api/reports/monthly", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.query.programId || 1) : q.u.programId;
  const year = +(q.query.year || new Date().getFullYear());
  const month = +(q.query.month || new Date().getMonth() + 1);
  const data = await getMonthlyDataset(pid, year, month, { userId: q.query.userId, date: q.query.date });
  if (!data) return fail(s, 404, "Program tidak ditemukan");
  s.json({ success: true, data });
}));

app.post("/api/reports/monthly/save", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.body.programId || 1) : q.u.programId;
  const year = +(q.body.year || new Date().getFullYear());
  const month = +(q.body.month || new Date().getMonth() + 1);
  const status = q.body.status === "final" ? "final" : "draft";
  const letterNo = clean(q.body.letterNo);
  const narrative = clean(q.body.narrative);
  const signatoryName = clean(q.body.signatoryName);
  const signatoryTitle = clean(q.body.signatoryTitle);

  const dataset = await getMonthlyDataset(pid, year, month);
  if (!dataset) return fail(s, 404, "Program tidak ditemukan");

  const [[existing]] = await db.query("SELECT * FROM monthly_reports WHERE program_id=? AND year=? AND month=?", [pid, year, month]);
  const nextVersion = existing ? existing.version + 1 : 1;

  if (existing) {
    await db.query(
      "UPDATE monthly_reports SET status=?, version=?, letter_no=?, narrative=?, signatory_name=?, signatory_title=?, summary_snapshot=?, updated_by=? WHERE id=?",
      [status, nextVersion, letterNo, narrative, signatoryName, signatoryTitle, JSON.stringify(dataset.summary), q.u.id, existing.id]
    );
    await db.query(
      "INSERT INTO monthly_report_versions(report_id,version,status,summary_snapshot,updated_by) VALUES(?,?,?,?,?)",
      [existing.id, nextVersion, status, JSON.stringify(dataset.summary), q.u.id]
    );
  } else {
    const [r] = await db.query(
      "INSERT INTO monthly_reports(program_id,year,month,status,version,letter_no,narrative,signatory_name,signatory_title,summary_snapshot,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [pid, year, month, status, 1, letterNo, narrative, signatoryName, signatoryTitle, JSON.stringify(dataset.summary), q.u.id]
    );
    await db.query(
      "INSERT INTO monthly_report_versions(report_id,version,status,summary_snapshot,updated_by) VALUES(?,1,?,?,?)",
      [r.insertId, status, JSON.stringify(dataset.summary), q.u.id]
    );
  }

  await audit(q.u, pid, status === "final" ? "finalize-report" : "save-report", "laporan", month, null, { year, month, status, version: nextVersion });
  s.json({ success: true, message: status === "final" ? `Laporan v${nextVersion} ditetapkan sebagai FINAL` : `Draft laporan v${nextVersion} disimpan` });
}));

// Data JSON untuk ekspor XLSX/DOCX/PDF/ZIP di frontend + catat audit & buat tautan bukti bila diperlukan
app.get("/api/reports/monthly/export", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.query.programId || 1) : q.u.programId;
  const year = +(q.query.year || new Date().getFullYear());
  const month = +(q.query.month || new Date().getMonth() + 1);
  const fmt = String(q.query.format || "xlsx").toLowerCase();
  const publicShare = q.query.publicShare === "1" || q.query.publicShare === "true";
  const zipGroup = q.query.groupBy === "tanggal" ? "tanggal" : "relawan";

  const dataset = await getMonthlyDataset(pid, year, month, { userId: q.query.userId, date: q.query.date });
  if (!dataset) return fail(s, 404, "Program tidak ditemukan");

  await audit(q.u, pid, `export-${fmt}`, "laporan", month, null, { year, month, publicShare, zipGroup });

  const rowsWithLinks = [];
  for (const r of dataset.rows) {
    const links = { photo: null, excel: null, bpe: null, report: null };
    const exts = {
      photo: r.photo ? path.extname(r.photo) || ".jpg" : null,
      excel: r.ev_excel ? path.extname(r.ev_excel) || ".xlsx" : null,
      bpe: r.ev_bpe ? path.extname(r.ev_bpe) || ".pdf" : null,
      report: r.ev_report ? path.extname(r.ev_report) || ".pdf" : null,
    };
    if (r.attendance_id && (fmt === "xlsx" || fmt === "zip")) {
      if (r.photo) links.photo = await getOrCreateEvidenceUrl(q, q.u, r.attendance_id, "photo", publicShare);
      if (r.ev_excel) links.excel = await getOrCreateEvidenceUrl(q, q.u, r.attendance_id, "excel", publicShare);
      if (r.ev_bpe) links.bpe = await getOrCreateEvidenceUrl(q, q.u, r.attendance_id, "bpe", publicShare);
      if (r.ev_report) links.report = await getOrCreateEvidenceUrl(q, q.u, r.attendance_id, "report", publicShare);
    }
    rowsWithLinks.push({ ...r, links, exts });
  }

  s.json({ success: true, data: { ...dataset, rows: rowsWithLinks } });
}));

app.get("/api/reports/annual", auth("pengurus", "koordinator", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? +(q.query.programId || 1) : q.u.programId;
  const year = +(q.query.year || new Date().getFullYear());
  const [[prog]] = await db.query("SELECT id, name FROM programs WHERE id=?", [pid]);
  if (!prog) return fail(s, 404, "Program tidak ditemukan");

  const [reports] = await db.query("SELECT * FROM monthly_reports WHERE program_id=? AND year=?", [pid, year]);
  const byMonth = new Map(reports.map((r) => [r.month, r]));

  const months = [];
  const totals = { hadir: 0, tidak_hadir: 0, terlambat: 0, total_wp: 0, final_months: 0 };

  for (let m = 1; m <= 12; m++) {
    const rep = byMonth.get(m);
    const snap = rep?.summary_snapshot
      ? typeof rep.summary_snapshot === "string"
        ? JSON.parse(rep.summary_snapshot)
        : rep.summary_snapshot
      : null;
    const status = rep ? rep.status : "belum_ada";
    const isFinal = status === "final";
    if (isFinal && snap) {
      totals.hadir += Number(snap.hadir || 0);
      totals.tidak_hadir += Number(snap.tidak_hadir || 0);
      totals.terlambat += Number(snap.terlambat || 0);
      totals.total_wp += Number(snap.total_wp || 0);
      totals.final_months++;
    }
    months.push({
      month: m,
      monthName: MONTHS_ID[m],
      status,
      version: rep?.version || 0,
      validated: isFinal,
      summary: isFinal ? snap : null,
    });
  }

  s.json({ success: true, data: { program: prog, year, months, totals } });
}));

app.get("/api/reports/combined", auth("admin"), ah(async (q, s) => {
  const year = +(q.query.year || new Date().getFullYear());
  const [progs] = await db.query("SELECT id, name FROM programs ORDER BY id ASC");
  const result = [];
  for (const p of progs) {
    const [[stats]] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM memberships m WHERE m.program_id=? AND m.year=? AND m.active=1) relawan_aktif,
        (SELECT COUNT(*) FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.program_id=? AND s.year=?) total_hadir,
        (SELECT COALESCE(SUM(a.wp_count),0) FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.program_id=? AND s.year=?) total_wp,
        (SELECT COUNT(*) FROM monthly_reports r WHERE r.program_id=? AND r.year=? AND r.status='final') bulan_final`,
      [p.id, year, p.id, year, p.id, year, p.id, year]
    );
    const [monthly] = await db.query("SELECT month, status, version FROM monthly_reports WHERE program_id=? AND year=? ORDER BY month ASC", [p.id, year]);
    result.push({ program: p, stats, monthly });
  }
  s.json({ success: true, data: { year, programs: result } });
}));

app.get("/api/audit/export", auth("pengurus", "admin"), ah(async (q, s) => {
  const pid = q.u.role === "admin" ? (q.query.programId ? +q.query.programId : null) : q.u.programId;
  const [rows] = await db.query(
    `SELECT l.created_at, COALESCE(u.name,'Pengguna terhapus') actor, l.action, l.entity, l.entity_id, l.reason, l.before_val, l.after_val
     FROM audit_log l LEFT JOIN users u ON u.id=l.actor_id
     ${pid ? "WHERE l.program_id=?" : ""}
     ORDER BY l.created_at DESC LIMIT 5000`,
    pid ? [pid] : []
  );
  s.json({ success: true, data: rows });
}));

app.use((e, q, s, n) => fail(s, 400, e.message || "Permintaan tidak valid"));

(async () => {
  await ensureSchema();
  const [[{ c }]] = await db.query("SELECT COUNT(*) c FROM users WHERE role='admin'");
  if (!c) {
    await db.query(
      "INSERT INTO users(nim,name,role,password_hash,must_change) VALUES(?,?,?,?,0)",
      [process.env.ADMIN_NIM || "admin", "Admin Pusat", "admin", await bcrypt.hash(process.env.ADMIN_PASSWORD || "GantiPasswordAdmin123", 10)]
    );
  }
  app.listen(process.env.PORT || 4000, () => console.log("TAXORA API berjalan"));
})();
