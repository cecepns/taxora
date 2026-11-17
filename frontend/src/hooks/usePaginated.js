import { useCallback, useEffect, useState } from "react";
import { request } from "@/utils/request";
import useDebounce from "./useDebounce";
export default function usePaginated(url, extra = {}) {
  const [state, setState] = useState({ rows: [], loading: true, pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [page, setPage] = useState(1), [limit, setLimit] = useState(10), [search, setSearch] = useState("");
  const q = useDebounce(search, 300), key = JSON.stringify(extra);
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await request("get", url, { page, limit, search: q, ...JSON.parse(key) });
    setState((s) => ({ rows: res?.data || [], pagination: res?.pagination || s.pagination, loading: false }));
  }, [url, page, limit, q, key]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(1), [q, limit, key]);
  return { ...state, page, setPage, limit, setLimit, search, setSearch, reload: load };
}
