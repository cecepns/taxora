import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, Building2, Eye, EyeOff, KeyRound, Loader2, Lock, User } from "lucide-react";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { saveSession } from "@/utils/auth";

export default function Login() {
  const nav = useNavigate();
  const [f, setF] = useState({ nim: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [change, setChange] = useState(false);
  const [np, setNp] = useState("");

  const submit = async (programId) => {
    if (!f.nim || !f.password) return toast.error("NIM dan password wajib diisi");
    setLoading(true);
    const res = await request("post", API_ENDPOINTS.AUTH.LOGIN, { ...f, programId });
    setLoading(false);
    if (!res) return;
    if (res.choosePrograms) return setPrograms(res.choosePrograms);
    saveSession(res.token, res.user);
    if (res.user.mustChange) return setChange(true);
    nav("/");
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (np.length < 10) return toast.error("Password minimal 10 karakter");
    const res = await request("post", API_ENDPOINTS.AUTH.CHANGE_PASSWORD, { oldPassword: f.password, newPassword: np }, { success: true });
    if (res) {
      const savedUser = JSON.parse(localStorage.getItem("taxora_user") || "null");
      if (savedUser) localStorage.setItem("taxora_user", JSON.stringify({ ...savedUser, mustChange: false }));
      nav("/");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0A4259] via-[#0E5A7C] to-[#083042] p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-white/20">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-50 p-2 shadow-inner ring-1 ring-brand/10">
            <img src="/logo.jpeg" alt="Tax Center PKN STAN" className="h-full w-full rounded-xl object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand">TAXORA</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Tax Center Operational & Volunteer Resource Application
          </p>
        </div>

        {change ? (
          <form onSubmit={changePw} className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-3.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80">
              Ini login pertama Anda. Buat password baru minimal 10 karakter untuk melanjutkan.
            </div>
            <div>
              <label className="label">Password Baru</label>
              <div className="relative">
                <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  type="password"
                  placeholder="Minimal 10 karakter"
                  value={np}
                  onChange={(e) => setNp(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn w-full py-3">
              Simpan Password
              <ArrowRight size={16} />
            </button>
          </form>
        ) : programs.length ? (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-slate-600">Pilih program untuk masuk:</p>
            {programs.map((p) => (
              <button key={p.id} type="button" className="btn w-full justify-between py-3" onClick={() => submit(p.id)}>
                <span className="flex items-center gap-2.5">
                  <Building2 size={18} />
                  {p.name}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <label className="label">NIM / Username</label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  placeholder="Masukkan NIM"
                  autoComplete="username"
                  value={f.nim}
                  onChange={(e) => setF({ ...f, nim: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10 pr-10"
                  type={showPw ? "text" : "password"}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Tampilkan password"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn w-full py-3 text-base" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Tax Center PKN STAN &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
