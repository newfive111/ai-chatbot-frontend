"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "/api/proxy";

const PLAN_LABEL: Record<string, string> = { free: "免費", pro: "專業", business: "商業" };
const PLAN_COLOR: Record<string, string> = {
  free:     "bg-gray-700 text-gray-300",
  pro:      "bg-blue-900 text-blue-300",
  business: "bg-purple-900 text-purple-300",
};

interface UserRow {
  user_id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  bot_count: number;
}

interface Stats {
  total_users: number;
  total_bots: number;
  paid_users: number;
  plan_counts: Record<string, number>;
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

  const updatePlan = async (userId: string, plan: string, billing_cycle: string | null) => {
    setUpdating(userId);
    try {
      const res = await fetch(`${API}/admin/users/${userId}/plan`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ plan, billing_cycle }),
      });
      if (!res.ok) throw new Error();
      setUsers(u => u.map(r => r.user_id === userId ? { ...r, plan, billing_cycle } : r));
    } catch {
      alert("更新失敗");
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
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
              { label: "免費用戶", value: stats.plan_counts.free ?? 0, color: "text-gray-400" },
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
                <th className="text-left px-4 py-3">Bot 數</th>
                <th className="text-left px-4 py-3">方案</th>
                <th className="text-left px-4 py-3">到期</th>
                <th className="text-left px-4 py-3">操作</th>
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
                    <div className="font-medium">{u.email}</div>
                    <div className="text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("zh-TW")}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.bot_count}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${PLAN_COLOR[u.plan] || PLAN_COLOR.free}`}>
                      {PLAN_LABEL[u.plan] || u.plan}
                      {u.billing_cycle && ` · ${u.billing_cycle === "monthly" ? "月" : "年"}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.current_period_end
                      ? new Date(u.current_period_end).toLocaleDateString("zh-TW")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={updating === u.user_id}
                      value={`${u.plan}|${u.billing_cycle ?? ""}`}
                      onChange={e => {
                        const [plan, cycle] = e.target.value.split("|");
                        updatePlan(u.user_id, plan, cycle || null);
                      }}
                      className="bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg outline-none disabled:opacity-50 cursor-pointer"
                    >
                      <option value="free|">免費版</option>
                      <option value="pro|monthly">專業版 · 月付</option>
                      <option value="pro|annual">專業版 · 年付</option>
                      <option value="business|monthly">商業版 · 月付</option>
                      <option value="business|annual">商業版 · 年付</option>
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
