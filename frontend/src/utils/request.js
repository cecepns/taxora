import toast from "react-hot-toast";
import { api } from "./api";

export const errMsg = (e) => e.response?.data?.message || "Gagal terhubung ke server";

export function getAuthenticatedUrl(url) {
  if (!url) return "";
  const token = localStorage.getItem("taxora_token") || localStorage.getItem("token") || "";
  const rawBase = api.defaults.baseURL || "/api";
  const base = rawBase.replace(/\/+$/, "");
  let cleanUrl = url;

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    if (cleanUrl.startsWith(base)) {
      // already has base
    } else if (cleanUrl.startsWith("/api") && base.endsWith("/api")) {
      cleanUrl = `${base.slice(0, -4)}${cleanUrl}`;
    } else {
      cleanUrl = `${base}${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`;
    }
  }

  if (!token) return cleanUrl;
  const separator = cleanUrl.includes("?") ? "&" : "?";
  return `${cleanUrl}${separator}token=${encodeURIComponent(token)}`;
}

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

export function openEvidence(url) {
  const authUrl = getAuthenticatedUrl(url);
  if (!authUrl) return;
  const a = document.createElement("a");
  a.href = authUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fetchBlobUrl(url) {
  try {
    const res = await api.get(url, { responseType: "blob" });
    if (!res || !res.data) return null;
    return {
      url: URL.createObjectURL(res.data),
      type: res.data.type || res.headers?.["content-type"] || "",
    };
  } catch {
    return null;
  }
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
