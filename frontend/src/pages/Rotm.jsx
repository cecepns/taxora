import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Award, CheckCircle2, Crown, Plus, Sparkles, Star, Trash2, Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import AppSelect from "@/components/AppSelect";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { getUser } from "@/utils/auth";

const PROGRAM_OPTIONS = [
  { value: "1", label: "Tax Clinic" },
  { value: "2", label: "Renjani" },
];

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
].map((label, idx) => ({ value: String(idx + 1), label }));

const BONUS_CATEGORIES = [
  { value: "pengganti", label: "Menggantikan relawan berhalangan (+5)" },
  { value: "bantu_kegiatan", label: "Membantu kegiatan di luar tugas utama (+3)" },
  { value: "konten", label: "Membuat konten publikasi (+3)" },
  { value: "masukan", label: "Masukan / evaluasi / solusi konstruktif (+2)" },
];

export default function Rotm() {
  const user = getUser();
  const isAdmin = user.role === "admin";
  const canDecide = ["pengurus", "admin"].includes(user.role);
  const now = new Date();
  const curYear = now.getFullYear();
  const YEAR_OPTIONS = [curYear + 1, curYear, curYear - 1, curYear - 2].map((y) => ({ value: String(y), label: String(y) }));

  const [programId, setProgramId] = useState(String(user.programId || "1"));
  const [year, setYear] = useState(String(curYear));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [data, setData] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pointModal, setPointModal] = useState(false);
  const [pointForm, setPointForm] = useState({ userId: "", category: "bantu_kegiatan", points: "", note: "" });
  const [winnerModal, setWinnerModal] = useState(null);
  const [winnerNote, setWinnerNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { programId, year, month };
    const [r1, r2] = await Promise.all([
      request("get", API_ENDPOINTS.ROTM.RANKING, params),
      request("get", API_ENDPOINTS.ROTM.POINTS, params),
    ]);
    setData(r1?.data || null);
    setPoints(r2?.data || []);
    setLoading(false);
  }, [programId, year, month]);

  useEffect(() => { load(); }, [load]);

  const addPoint = async (e) => {
    e.preventDefault();
    if (!pointForm.userId) return toast.error("Pilih relawan");
    setBusy(true);
    const r = await request("post", API_ENDPOINTS.ROTM.POINTS, { ...pointForm, programId, year, month }, { success: true });
    setBusy(false);
    if (r) {
      setPointModal(false);
      setPointForm({ userId: "", category: "bantu_kegiatan", points: "", note: "" });
      load();
    }
  };

  const toggleVerify = async (pt) => {
    const r = await request("put", API_ENDPOINTS.ROTM.VERIFY_POINT(pt.id), { verified: !pt.verified }, { success: true });
    if (r) load();
  };

  const deletePoint = async (id) => {
    const r = await request("delete", API_ENDPOINTS.ROTM.DELETE_POINT(id), {}, { success: true });
    if (r) load();
  };

  const confirmWinner = async (e) => {
    e.preventDefault();
    if (!winnerModal) return;
    setBusy(true);
    const r = await request(
      "post",
      API_ENDPOINTS.ROTM.WINNER,
      { programId, year, month, userId: winnerModal.user_id, note: winnerNote },
      { success: true }
    );
    setBusy(false);
    if (r) {
      setWinnerModal(null);
      setWinnerNote("");
      load();
    }
  };

  const ranking = data?.ranking || [];
  const volunteerOptions = ranking.map((r) => ({ value: String(r.user_id), label: `${r.nim} — ${r.name}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Trophy}
        title="Relawan of the Month"
        subtitle="Papan peringkat otomatis per program: A. Kinerja Pelayanan + B. Kehadiran + C. Poin Apresiasi."
        actions={
          <button type="button" className="btn" onClick={() => setPointModal(true)}>
            <Plus size={18} />
            Input Poin Apresiasi
          </button>
        }
      />

      {/* Filters */}
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-center">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 md:flex md:items-center">
          {isAdmin && (
            <div className="w-full md:w-44">
              <AppSelect size="sm" isSearchable={false} options={PROGRAM_OPTIONS} value={programId} onChange={setProgramId} />
            </div>
          )}
          <div className="w-full md:w-44">
            <AppSelect size="sm" isSearchable={false} options={MONTHS} value={month} onChange={setMonth} />
          </div>
          <div className="w-full md:w-32">
            <AppSelect size="sm" isSearchable={false} options={YEAR_OPTIONS} value={year} onChange={setYear} />
          </div>
        </div>
        <div className="text-xs text-slate-500 md:ml-auto">
          Tie-breaker seri: <strong>(1) Skor Kehadiran</strong> → <strong>(2) Jumlah Shift</strong> → <strong>(3) Poin Apresiasi</strong>
        </div>
      </div>

      {/* Winner Banner if Decided */}
      {data?.winner && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-accent to-amber-600 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Crown size={30} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-100">
                  Relawan Terbaik Terpilih • {MONTHS[Number(month) - 1]?.label} {year}
                </div>
                <div className="text-2xl font-extrabold">{data.winner.name}</div>
                <div className="text-xs text-amber-50">
                  NIM {data.winner.nim} • Nilai Akhir <strong>{data.winner.total_score}</strong> • Ditetapkan oleh{" "}
                  <strong>{data.winner.decided_by_name}</strong> ({data.winner.decided_at})
                </div>
              </div>
            </div>
            <div className="flex gap-3 text-center">
              <div className="rounded-xl bg-white/15 px-3.5 py-2">
                <div className="text-lg font-extrabold">{data.winner.score_service}</div>
                <div className="text-[11px]">Pelayanan</div>
              </div>
              <div className="rounded-xl bg-white/15 px-3.5 py-2">
                <div className="text-lg font-extrabold">{data.winner.score_attendance}</div>
                <div className="text-[11px]">Kehadiran</div>
              </div>
              <div className="rounded-xl bg-white/15 px-3.5 py-2">
                <div className="text-lg font-extrabold">+{data.winner.score_bonus}</div>
                <div className="text-[11px]">Apresiasi</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Papan Peringkat */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Award size={18} className="text-brand" />
            Papan Peringkat {data?.program?.name || ""} ({ranking.length} kandidat aktif)
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="divide-y divide-slate-100 md:hidden">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : ranking.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Belum ada kandidat aktif pada periode ini.</p>
          ) : (
            ranking.map((r) => (
              <div key={r.user_id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      r.rank === 1 ? "bg-amber-100 text-amber-800" : r.rank === 2 ? "bg-slate-200 text-slate-700" : r.rank === 3 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"
                    }`}>
                      {r.rank}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.nim} • {r.prodi || "-"}</div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-brand-light px-2.5 py-1 text-sm font-extrabold text-brand">
                    {r.total_score}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs">
                  <div><div className="font-bold text-indigo-700">{r.score_service}</div><div className="text-[10px] text-slate-500">Pelayanan</div></div>
                  <div><div className="font-bold text-emerald-700">{r.score_attendance}</div><div className="text-[10px] text-slate-500">Kehadiran</div></div>
                  <div><div className="font-bold text-amber-700">+{r.score_bonus}</div><div className="text-[10px] text-slate-500">Apresiasi</div></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Shift: <strong>{r.shifts_done}/{r.total_scheduled}</strong> • WP: <strong>{r.total_wp}</strong> ({r.avg_wp}/shift)</span>
                  {canDecide && (
                    <button
                      type="button"
                      className="btn-ghost !rounded-lg !px-2.5 !py-1 text-xs"
                      onClick={() => { setWinnerNote(""); setWinnerModal(r); }}
                    >
                      <Crown size={13} className="text-accent-dark" /> Tetapkan
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-brand-50/70 text-xs font-bold uppercase tracking-wider text-brand">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">#</th>
                <th className="whitespace-nowrap px-4 py-3">Relawan</th>
                <th className="whitespace-nowrap px-4 py-3">Shift</th>
                <th className="whitespace-nowrap px-4 py-3">Total / Rata WP</th>
                <th className="whitespace-nowrap px-4 py-3">A. Pelayanan</th>
                <th className="whitespace-nowrap px-4 py-3">B. Kehadiran</th>
                <th className="whitespace-nowrap px-4 py-3">C. Apresiasi</th>
                <th className="whitespace-nowrap px-4 py-3">Nilai Akhir</th>
                {canDecide && <th className="whitespace-nowrap px-4 py-3">Penetapan</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={9} className="p-3"><div className="h-7 animate-pulse rounded bg-slate-100" /></td></tr>
                ))
              ) : ranking.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">Belum ada kandidat aktif pada periode ini.</td></tr>
              ) : (
                ranking.map((r) => (
                  <tr key={r.user_id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                        r.rank === 1 ? "bg-amber-100 text-amber-800" : r.rank === 2 ? "bg-slate-200 text-slate-700" : r.rank === 3 ? "bg-orange-100 text-orange-800" : "text-slate-500"
                      }`}>
                        {r.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.nim} • {r.prodi || "-"}</div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">{r.shifts_done}/{r.total_scheduled}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <strong>{r.total_wp}</strong> <span className="text-xs text-slate-400">({r.avg_wp}/shift)</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-indigo-700">{r.score_service}</td>
                    <td className="px-4 py-3.5 font-semibold text-emerald-700">{r.score_attendance}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-amber-700">+{r.score_bonus}</span>
                      {r.pending_bonus > 0 && (
                        <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {r.pending_bonus} perlu verifikasi
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-lg bg-brand-light px-2.5 py-1 text-sm font-extrabold text-brand">
                        {r.total_score}
                      </span>
                    </td>
                    {canDecide && (
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          className="btn-ghost !rounded-lg !px-2.5 !py-1.5 text-xs"
                          onClick={() => {
                            setWinnerNote("");
                            setWinnerModal(r);
                          }}
                        >
                          <Crown size={14} className="text-accent-dark" />
                          Tetapkan
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daftar Poin Apresiasi */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Sparkles size={18} className="text-accent-dark" />
            Daftar Poin Apresiasi Bulan Ini ({points.length})
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {points.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Belum ada catatan poin apresiasi bulan ini.</p>
          ) : (
            points.map((pt) => (
              <div key={pt.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{pt.user_name}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                      +{pt.points} ({pt.category})
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pt.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                      {pt.verified ? "Terverifikasi" : "Menunggu Verifikasi"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {pt.note} • Diinput oleh {pt.creator_name}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => toggleVerify(pt)}>
                    <CheckCircle2 size={13} />
                    {pt.verified ? "Batalkan" : "Verifikasi"}
                  </button>
                  {canDecide && (
                    <button type="button" className="btn-ghost !px-2 !py-1 text-rose-600 hover:!bg-rose-50" onClick={() => deletePoint(pt.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Input Poin Apresiasi */}
      <Modal open={pointModal} title="Input Poin Apresiasi" subtitle="Tambahkan poin bonus dengan catatan verifikasi." onClose={() => setPointModal(false)}>
        <form onSubmit={addPoint} className="space-y-4">
          <div>
            <label className="label">Relawan *</label>
            <AppSelect
              options={volunteerOptions}
              value={pointForm.userId}
              onChange={(val) => setPointForm({ ...pointForm, userId: val })}
              placeholder="Cari & pilih relawan..."
            />
          </div>
          <div>
            <label className="label">Kategori Poin *</label>
            <AppSelect
              isSearchable={false}
              options={BONUS_CATEGORIES}
              value={pointForm.category}
              onChange={(val) => setPointForm({ ...pointForm, category: val })}
            />
          </div>
          <div>
            <label className="label">Nilai Poin (kosongkan untuk default pengaturan)</label>
            <input
              className="input"
              type="number"
              placeholder="Otomatis sesuai kategori"
              value={pointForm.points}
              onChange={(e) => setPointForm({ ...pointForm, points: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Catatan Verifikasi *</label>
            <textarea
              className="input min-h-[84px]"
              placeholder="Contoh: Membantu koordinasi publikasi IG Tax Center"
              value={pointForm.note}
              onChange={(e) => setPointForm({ ...pointForm, note: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPointModal(false)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>
              <Star size={15} />
              {busy ? "Menyimpan..." : "Simpan Poin"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Tetapkan Relawan Terbaik */}
      <Modal open={!!winnerModal} title="Tetapkan Relawan of the Month" subtitle={winnerModal ? `${winnerModal.name} (Nilai Akhir: ${winnerModal.total_score})` : ""} onClose={() => setWinnerModal(null)} maxWidth="max-w-md">
        <form onSubmit={confirmWinner} className="space-y-4">
          <p className="text-sm text-slate-600">
            Penetapan ini akan tercatat beserta nama penetap dan waktu penetapan untuk program{" "}
            <strong>{data?.program?.name}</strong> bulan <strong>{MONTHS[Number(month) - 1]?.label} {year}</strong>.
          </p>
          <div>
            <label className="label">Catatan Penetapan (opsional)</label>
            <input className="input" placeholder="Misal: Disepakati dalam rapat evaluasi bulanan" value={winnerNote} onChange={(e) => setWinnerNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setWinnerModal(null)}>Batal</button>
            <button type="submit" className="btn" disabled={busy}>
              <Crown size={15} />
              {busy ? "Menetapkan..." : "Tetapkan Pemenang"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
