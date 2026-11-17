import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import { getUser } from "@/utils/auth";
import Login from "@/pages/Login";
import Presensi from "@/pages/Presensi";
import Monitoring from "@/pages/Monitoring";
import Relawan from "@/pages/Relawan";
import Jadwal from "@/pages/Jadwal";
import Audit from "@/pages/Audit";
import Home from "@/pages/Home";
import RelawanHome from "@/pages/RelawanHome";
import Pergantian from "@/pages/Pergantian";
import Materi from "@/pages/Materi";
import Rotm from "@/pages/Rotm";
import Laporan from "@/pages/Laporan";
import Pengaturan from "@/pages/Pengaturan";
import Prodi from "@/pages/Prodi";
import Users from "@/pages/Users";

function Guard() {
  const u = getUser();
  return u ? <Layout /> : <Navigate to="/login" replace />;
}

function DashboardIndex() {
  const u = getUser();
  return u?.role === "relawan" ? <RelawanHome /> : <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard />}>
        <Route path="/" element={<DashboardIndex />} />
        <Route path="/presensi" element={<Presensi />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/pergantian" element={<Pergantian />} />
        <Route path="/jadwal" element={<Jadwal />} />
        <Route path="/relawan" element={<Relawan />} />
        <Route path="/users" element={<Users />} />
        <Route path="/prodi" element={<Prodi />} />
        <Route path="/rotm" element={<Rotm />} />
        <Route path="/laporan" element={<Laporan />} />
        <Route path="/materi" element={<Materi />} />
        <Route path="/pengaturan" element={<Pengaturan />} />
        <Route path="/audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
