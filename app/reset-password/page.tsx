"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase 把 token 放在 URL hash，監聽 session 變化確認有效
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("兩次密碼不一致");
      return;
    }
    if (password.length < 6) {
      setError("密碼至少需要 6 個字元");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("重設失敗，請重新申請重設連結");
    } else {
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-green-400 text-xl font-semibold mb-2">密碼已重設成功！</p>
          <p className="text-gray-400 text-sm">正在跳轉到登入頁...</p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center text-gray-500">
          <div className="animate-spin text-3xl mb-4">⏳</div>
          <p>驗證連結中...</p>
          <p className="text-sm mt-2">如果一直停在這裡，請重新申請密碼重設連結</p>
          <a href="/forgot-password" className="text-blue-400 hover:underline text-sm mt-4 block">重新申請</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-2">設定新密碼</h1>
        <p className="text-gray-400 text-sm mb-6">請輸入你的新密碼</p>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="新密碼（至少 6 字元）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="確認新密碼"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? "重設中..." : "確認重設密碼"}
          </button>
        </form>
      </div>
    </main>
  );
}
