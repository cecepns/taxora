import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  RefreshCw,
  Settings,
  Trophy,
  User,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Modal from "@/components/Modal";
import { getUser, logout } from "@/utils/auth";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";

const MENUS = [
  { to: "/", label: "Beranda", icon: LayoutDashboard, roles: ["relawan", "koordinator", "pengurus", "admin"] },
  { to: "/presensi", label: "Presensi Saya", icon: ClipboardCheck, roles: ["relawan"] },
  { to: "/monitoring", label: "Monitoring", icon: ClipboardCheck, roles: ["koordinator", "pengurus", "admin"] },
  { to: "/pergantian", label: "Pengajuan & Tukar Sesi", icon: RefreshCw, roles: ["relawan", "koordinator", "pengurus", "admin"] },
  { to: "/jadwal", label: "Jadwal & ST", icon: CalendarDays, roles: ["pengurus", "admin"] },
  { to: "/relawan", label: "Relawan", icon: Users, roles: ["pengurus", "admin"] },
  { to: "/users", label: "Manajemen Users", icon: UserCog, roles: ["admin"] },
  { to: "/prodi", label: "Program Studi", icon: GraduationCap, roles: ["admin"] },
  { to: "/rotm", label: "Relawan Terbaik", icon: Trophy, roles: ["koordinator", "pengurus", "admin"] },
  { to: "/laporan", label: "Laporan", icon: FileText, roles: ["koordinator", "pengurus", "admin"] },
  { to: "/materi", label: "Pusat Materi", icon: BookOpen, roles: ["relawan", "koordinator", "pengurus", "admin"] },
  { to: "/pengumuman", label: "Pengumuman", icon: Megaphone, roles: ["relawan", "koordinator", "pengurus", "admin"] },
  { to: "/profil", label: "Profil Saya", icon: User, roles: ["relawan", "koordinator", "pengurus", "admin"] },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, roles: ["pengurus", "admin"] },
  { to: "/audit", label: "Riwayat Perubahan", icon: History, roles: ["pengurus", "admin"] },
];

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join("") || "U"
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ oldPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const { pathname } = useLocation();
  const u = getUser();
  const allowedMenus = MENUS.filter((m) => m.roles.includes(u.role));
  const currentMenu = allowedMenus.find((m) => (m.to === "/" ? pathname === "/" : pathname.startsWith(m.to)));

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pw.newPassword.length < 10) return toast.error("Password baru minimal 10 karakter");
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.AUTH.CHANGE_PASSWORD, pw, { success: true });
    setBusy(false);
    if (r) {
      setPwOpen(false);
      setPw({ oldPassword: "", newPassword: "" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col bg-gradient-to-b from-[#0E5A7C] via-[#0B4B68] to-[#073246] text-white shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-1 shadow-md shadow-black/15">
              <img src="/logo.jpeg" alt="Logo TAXORA" className="h-full w-full rounded-xl object-contain" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-wide text-white">TAXORA</div>
              <div className="text-xs font-medium text-sky-100/75">
                {u.programName || "Tax Center PKN STAN"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-2 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-sky-200/60">
            Menu Utama
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3.5 py-1">
          {allowedMenus.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3.5 rounded-xl px-4 py-3 text-base transition-all duration-150 ${
                  isActive
                    ? "bg-accent font-bold text-white shadow-lg shadow-amber-900/25"
                    : "font-medium text-sky-50/85 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    className={`shrink-0 transition-transform duration-150 ${
                      isActive ? "scale-105 text-white" : "text-sky-200/80 group-hover:text-white"
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <Link
              to="/profil"
              className="flex min-w-0 flex-1 items-center gap-3 group transition"
              title="Buka Profil Saya"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent font-bold text-white shadow-sm group-hover:scale-105 transition-transform">
                {getInitials(u.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white group-hover:text-amber-200 transition-colors">
                  {u.name}
                </div>
                <div className="truncate text-xs capitalize text-sky-200/80">
                  {u.role} {u.programName && u.role !== "admin" ? `• ${u.programName}` : ""}
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={logout}
              title="Keluar"
              aria-label="Keluar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sky-100/80 transition hover:bg-white/15 hover:text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-3.5 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Menu"
            >
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <span className="font-semibold text-brand">TAXORA</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-800">{currentMenu?.label || "Dashboard"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to="/profil" className="hidden text-right sm:block group" title="Buka Profil">
              <div className="text-sm font-bold text-slate-800 group-hover:text-brand transition-colors">
                {u.name}
              </div>
              <div className="text-xs font-medium capitalize text-slate-500">
                {u.role} {u.programName && u.role !== "admin" ? `• ${u.programName}` : ""}
              </div>
            </Link>
            <Link
              to="/profil"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-xs font-bold text-brand ring-1 ring-brand/15 hover:ring-brand/40 transition"
              title="Buka Profil"
            >
              {getInitials(u.name)}
            </Link>
            <button
              type="button"
              title="Ganti Password"
              className="btn-ghost !px-2.5 !py-2 text-xs"
              onClick={() => setPwOpen(true)}
            >
              <KeyRound size={15} />
              <span className="hidden md:inline">Password</span>
            </button>
            <button
              type="button"
              className="btn-ghost !px-3 !py-2 text-xs"
              onClick={logout}
              aria-label="Keluar"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Modal open={pwOpen} title="Ganti Password" subtitle="Password baru minimal 10 karakter." onClose={() => setPwOpen(false)} maxWidth="max-w-md">
        <form onSubmit={handleChangePw} className="space-y-4">
          <div>
            <label className="label">Password Lama *</label>
            <input
              className="input"
              type="password"
              value={pw.oldPassword}
              onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Password Baru (min. 10 karakter) *</label>
            <input
              className="input"
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPwOpen(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Password"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
