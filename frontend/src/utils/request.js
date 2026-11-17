import toast from "react-hot-toast";
import { api } from "./api";

export const errMsg = (e) => e.response?.data?.message || "Gagal terhubung ke server";

// request reusable: toast error otomatis, kembalikan data atau null
export async function request(method, url, data, { success = false, config } = {}) {
  try {
    const res = await api.request({ method, url, ...(method === "get" ? { params: data } : { data }), ...config });
    if (success && res.data.message) toast.success(res.data.message);
    return res.data;
  } catch (e) {
    toast.error(errMsg(e));
    return null;
  }
}

export async function openEvidence(url) {
  const res = await api.get(url, { responseType: "blob" }).catch((e) => {
    toast.error(errMsg(e));
    return null;
  });
  if (res) window.open(URL.createObjectURL(res.data), "_blank");
}

export async function fetchBlobUrl(url) {
  const res = await api.get(url, { responseType: "blob" }).catch(() => null);
  if (!res) return null;
  return { url: URL.createObjectURL(res.data), type: res.data.type };
}

export async function downloadFile(url, params = {}, fallbackName = "unduhan") {
  try {
    const res = await api.get(url, { params, responseType: "blob" });
    const disp = res.headers["content-disposition"] || "";
    const match = disp.match(/filename="?([^"]+)"?/i);
    const filename = match ? match[1] : fallbackName;
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch (e) {
    toast.error(errMsg(e));
    return false;
  }
}
