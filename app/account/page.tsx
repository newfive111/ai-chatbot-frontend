"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";

const API = "/api/proxy";

interface Profile {
  email: string;
  created_at: string | null;
  plan: string;
  bot_slots: number;
  bots_used: number;
  renews_at: string | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);

  // 修改密碼
  const [newPwd, setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg]     = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login?redirect=/account"); return; }
    setToken(t);
    fetchAll(t);
  }, []);

  const fetchAll = async (t?: string | null) => {
    const h = { Authorization: `Bearer ${t ?? token}` };
    setLoading(true);
    try {
      const pRes = await fetch(`${API}/me/profile`, { headers: h });
      if (pRes.status === 401) { router.push("/login?redirect=/account"); return; }
      if (pRes.ok) setProfile(await pRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) { setPwdMsg("❌ 密碼至少 8 個字元"); return; }
    if (newPwd !== confirmPwd) { setPwdMsg("❌ 兩次密碼不一致"); return; }
    setPwdLoading(true);
    setPwdMsg("");
    try {
      const res = await fetch(`${API}/me/change-password`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ new_password: newPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwdMsg("✅ 密碼已更新");
        setNewPwd(""); setConfirmPwd("");
      } else {
        setPwdMsg(`❌ ${data.detail || "更新失敗"}`);
      }
    } catch {
      setPwdMsg("❌ 連線失敗");
    } finally {
      setPwdLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex">
        <Sidebar />
        <main className="flex-1 md:ml-60 flex items-center justify-center">
          <span className="text-gray-500">載入中...</span>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <Sidebar />
      <main className="flex-1 md:ml-60">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
        <h1 className="text-2xl font-bold">會員中心</h1>

        {/* ── 帳號資訊 ── */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-4">👤 帳號資訊</h2>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">電子信箱</span>
              <span className="text-white font-mono">{profile?.email || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">註冊時間</span>
              <span className="text-white">{formatDate(profile?.created_at || null)}</span>
            </div>
          </div>
        </div>

        {/* ── 訂閱狀態 ── */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-4">📦 目前方案</h2>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">方案</span>
              <span className={`font-semibold px-3 py-1 rounded-full text-xs ${
                profile?.plan === "paid"
                  ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                  : "bg-gray-800 text-gray-400 border border-gray-700"
              }`}>
                {profile?.plan === "paid" ? "付費版" : "免費版"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Bot 名額</span>
              <span className="text-white">
                {profile?.bots_used ?? 0} / {1 + (profile?.bot_slots ?? 0)} 個使用中
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">到期日</span>
              <span className="text-white">
                {profile?.plan === "paid" ? formatDate(profile.renews_at) : "永久免費"}
              </span>
            </div>
          </div>
        </div>

        {/* ── 修改密碼 ── */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-4">🔒 修改密碼</h2>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">新密碼</label>
              <input
                type="password"
                placeholder="至少 8 個字元"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">確認新密碼</label>
              <input
                type="password"
                placeholder="再輸入一次"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
            {pwdMsg && (
              <p className={`text-sm ${pwdMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
                {pwdMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={pwdLoading || !newPwd || !confirmPwd}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50"
            >
              {pwdLoading ? "更新中..." : "更新密碼"}
            </button>
          </form>
        </div>

      </div>
      </main>
    </div>
  );
}
