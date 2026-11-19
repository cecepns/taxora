import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Award,
  CalendarCheck,
  Camera,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  Users,
} from "lucide-react";
import { getUser } from "@/utils/auth";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";

export default function Profil() {
  const currentUser = getUser();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prodiOptions, setProdiOptions] = useState([]);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    prodi: "",
    semester: "",
  });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Password state
  const [pw, setPw] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwBusy, setPwBusy] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    const [resProfile, resProdi] = await Promise.all([
      request("get", API_ENDPOINTS.PROFILE.GET),
      request("get", API_ENDPOINTS.PRODI.OPTIONS),
    ]);
    setLoading(false);

    if (resProfile?.data) {
      const p = resProfile.data;
      setProfile(p);
      setFormData({
        name: p.name || "",
        phone: p.phone || "",
        email: p.email || "",
        prodi: p.prodi || "",
        semester: p.semester || "",
      });
      if (p.profile_photo) {
        setPhotoPreview(
          `${import.meta.env.VITE_API_BASE_URL || ""}${API_ENDPOINTS.PROFILE.PHOTO(p.id)}?t=${Date.now()}`
        );
      }
    }
    if (resProdi?.data) {
      setProdiOptions(resProdi.data);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("File harus berupa gambar (JPG, PNG, atau WEBP)");
    }
    if (file.size > 3 * 1024 * 1024) {
      return toast.error("Ukuran foto maksimal 3MB");
    }
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Nama lengkap tidak boleh kosong");

    setSaving(true);
    const body = new FormData();
    body.append("name", formData.name.trim());
    body.append("phone", formData.phone.trim());
    body.append("email", formData.email.trim());
    body.append("prodi", formData.prodi.trim());
    body.append("semester", formData.semester || "");
    if (selectedPhoto) {
      body.append("photo", selectedPhoto);
    }

    const res = await request("put", API_ENDPOINTS.PROFILE.UPDATE, body, {
      success: "Profil berhasil diperbarui",
    });
    setSaving(false);

    if (res?.success) {
      // Update session storage so navbar updates
      const updatedUser = {
        ...currentUser,
        name: formData.name.trim(),
      };
      localStorage.setItem("taxora_user", JSON.stringify(updatedUser));
      loadProfile();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pw.oldPassword) return toast.error("Password lama wajib diisi");
    if (pw.newPassword.length < 10) return toast.error("Password baru minimal 10 karakter");
    if (pw.newPassword !== pw.confirmPassword) {
      return toast.error("Konfirmasi password baru tidak cocok");
    }

    setPwBusy(true);
    const res = await request(
      "post",
      API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
      {
        oldPassword: pw.oldPassword,
        newPassword: pw.newPassword,
      },
      { success: "Password berhasil diganti!" }
    );
    setPwBusy(false);

    if (res?.success) {
      setPw({ oldPassword: "", newPassword: "", confirmPassword: "" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  const isRelawan = profile?.role === "relawan";
  const stats = profile?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profil Saya</h1>
        <p className="text-sm text-slate-500">
          Kelola informasi data diri, foto profil, dan kredensial akun Anda.
        </p>
      </div>

      {/* Volunteer Stats Banner (if relawan) */}
      {isRelawan && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/20">
              <CalendarCheck size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Sesi Hadir
              </div>
              <div className="text-2xl font-extrabold text-slate-800">
                {stats?.total_hadir || 0}{" "}
                <span className="text-xs font-medium text-slate-500">Sesi</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Users size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                WP Dilayani
              </div>
              <div className="text-2xl font-extrabold text-slate-800">
                {stats?.total_wp || 0}{" "}
                <span className="text-xs font-medium text-slate-500">Orang</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <Award size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Poin Apresiasi
              </div>
              <div className="text-2xl font-extrabold text-slate-800">
                {stats?.total_points || 0}{" "}
                <span className="text-xs font-medium text-slate-500">Poin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Photo & Summary Card */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="relative mx-auto mb-4 h-32 w-32">
              <div className="h-full w-full overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-2 ring-slate-200">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={profile?.name}
                    className="h-full w-full object-cover"
                    onError={() => setPhotoPreview(null)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand text-3xl font-extrabold text-white">
                    {(profile?.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <label
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-md hover:bg-brand-dark transition"
                title="Ganti Foto"
              >
                <Camera size={18} />
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            <h2 className="text-lg font-bold text-slate-800">{profile?.name}</h2>
            <p className="text-xs font-medium text-slate-500">
              {profile?.nim ? `NIM: ${profile.nim}` : "Pengguna Taxora"}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold capitalize text-sky-800">
                <Shield size={12} />
                {profile?.role}
              </span>
              {profile?.program_name && (
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {profile.program_name}
                </span>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 text-left text-xs text-slate-500 space-y-2">
              <div className="flex items-center justify-between">
                <span>Program Studi:</span>
                <span className="font-semibold text-slate-700">{profile?.prodi || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Semester:</span>
                <span className="font-semibold text-slate-700">
                  {profile?.semester ? `Semester ${profile.semester}` : "-"}
                </span>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-400">
              Format: JPG, PNG, atau WEBP. Maksimal 3MB. Disarankan foto formal rasio 1:1.
            </p>
          </div>

          {/* Quick Notice Card */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5 text-xs text-sky-900">
            <h3 className="font-bold mb-1 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-brand" /> Informasi Akun
            </h3>
            <p className="text-sky-800/80 leading-relaxed">
              NIM dan unit penugasan dikunci oleh sistem. Jika terdapat kesalahan data NIM atau unit
              Tax Center, silakan hubungi pengurus atau koordinator.
            </p>
          </div>
        </div>

        {/* Right Column: Edit Profile & Password */}
        <div className="space-y-6 lg:col-span-2">
          {/* Form Biodata */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-800 flex items-center gap-2">
              <User size={18} className="text-brand" /> Data Diri & Kontak
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Nama Lengkap *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-1">
                    NIM / NIP <Lock size={12} className="text-slate-400" />
                  </label>
                  <input
                    type="text"
                    className="input bg-slate-100 text-slate-500 cursor-not-allowed"
                    value={profile?.nim || "-"}
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label flex items-center gap-1">
                    <Mail size={14} className="text-slate-400" /> Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="email@pknstan.ac.id"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-1">
                    <Phone size={14} className="text-slate-400" /> Nomor WhatsApp / Telepon
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="0812xxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Program Studi</label>
                  {prodiOptions.length > 0 ? (
                    <select
                      className="input"
                      value={formData.prodi}
                      onChange={(e) => setFormData({ ...formData, prodi: e.target.value })}
                    >
                      <option value="">-- Pilih Program Studi --</option>
                      {prodiOptions.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input"
                      placeholder="Contoh: D4 Akuntansi Sektor Publik"
                      value={formData.prodi}
                      onChange={(e) => setFormData({ ...formData, prodi: e.target.value })}
                    />
                  )}
                </div>

                <div>
                  <label className="label">Semester</label>
                  <select
                    className="input"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  >
                    <option value="">-- Pilih Semester --</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn flex items-center gap-2"
                >
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>

          {/* Form Ganti Password */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-slate-800 flex items-center gap-2">
              <KeyRound size={18} className="text-amber-600" /> Ganti Password
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Pastikan gunakan kombinasi huruf dan angka minimal 10 karakter untuk keamanan akun.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="label">Password Lama *</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Masukkan password lama"
                  value={pw.oldPassword}
                  onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Password Baru (min. 10 karakter) *</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Minimal 10 karakter"
                    value={pw.newPassword}
                    onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Konfirmasi Password Baru *</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Ulangi password baru"
                    value={pw.confirmPassword}
                    onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={pwBusy}
                  className="btn-accent flex items-center gap-2"
                >
                  <KeyRound size={16} />
                  {pwBusy ? "Memproses..." : "Ganti Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
