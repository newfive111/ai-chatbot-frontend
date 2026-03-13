"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "/api/proxy";

interface UserRow {
  user_id: string;
  email: string;
  created_at: string;
  bot_slots: number;
  max_bots: number;
  bots_used: number;
  renews_at: string | null;
}

interface Stats {
  total_users: number;
  total_bots: number;
  paid_users: number;
  total_slots: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, uRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers }),
        fetch(`${API}/admin/users`, { headers }),
      ]);
      if (sRes.status === 403 || uRes.status === 403) {
        router.push("/dashboard");
        return;
      }
      setStats(await sRes.json());
      setUsers(await uRes.json());
    } catch {
      alert("載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const setSlots = async (userId: string, slots: number) => {
    setUpdating(userId);
    try {
      const res = await fetch(`${API}/admin/users/${userId}/slots`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }
      setUsers(u =>
        u.map(r =>
          r.user_id === userId
            ? { ...r, bot_slots: slots, max_bots: 1 + slots }
            : r
        )
      );
    } catch (err: any) {
      alert(err?.message || "更新失敗");
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">⚙️ 管理後台</h1>
            <p className="text-gray-500 text-sm mt-1">懶得回 LazyReply</p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white text-sm">
            ← 回 Dashboard
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "總用戶", value: stats.total_users, color: "text-white" },
              { label: "付費用戶", value: stats.paid_users, color: "text-green-400" },
              { label: "總 Bot 數", value: stats.total_bots, color: "text-blue-400" },
              { label: "付費 Bot 名額", value: stats.total_slots, color: "text-purple-400" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`}>{loading ? "…" : s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="搜尋 Email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 px-4 py-2.5 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />

        {/* User Table */}
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Bot 使用</th>
                <th className="text-left px-4 py-3">付費名額</th>
                <th className="text-left px-4 py-3">續費日</th>
                <th className="text-left px-4 py-3">手動授權</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">載入中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">無用戶</td></tr>
              ) : filtered.map(u => (
                <tr key={u.user_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.email || "—"}</div>
                    <div className="text-gray-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("zh-TW") : "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${u.bots_used >= u.max_bots ? "text-red-400" : "text-gray-200"}`}>
                      {u.bots_used} / {u.max_bots}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.bot_slots > 0 ? (
                      <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-1 rounded-full">
                        💎 {u.bot_slots} 個名額
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-1 rounded-full">
                        免費
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.renews_at
                      ? new Date(u.renews_at).toLocaleDateString("zh-TW")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={updating === u.user_id}
                      value={u.bot_slots}
                      onChange={e => setSlots(u.user_id, Number(e.target.value))}
                      className="bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg outline-none disabled:opacity-50 cursor-pointer"
                    >
                      <option value={0}>免費（0 名額）</option>
                      <option value={1}>1 個 Bot 名額</option>
                      <option value={2}>2 個 Bot 名額</option>
                      <option value={5}>5 個 Bot 名額</option>
                      <option value={10}>10 個 Bot 名額</option>
                    </select>
                    {updating === u.user_id && (
                      <span className="ml-2 text-xs text-gray-500">更新中…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-gray-600 text-xs mt-4 text-right">共 {filtered.length} 位用戶</p>
      </div>
    </main>
  );
}
