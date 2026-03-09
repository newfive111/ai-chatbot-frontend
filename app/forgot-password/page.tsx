"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError("發送失敗，請確認 Email 是否正確");
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-2">忘記密碼</h1>
        {sent ? (
          <div className="mt-6 text-center">
            <div className="text-4xl mb-4">📬</div>
            <p className="text-green-400 font-semibold mb-2">重設連結已寄出！</p>
            <p className="text-gray-400 text-sm">請檢查 <span className="text-white">{email}</span> 的收件匣，點擊信中連結重設密碼。</p>
            <p className="text-gray-600 text-xs mt-3">沒收到？請確認垃圾郵件資料夾</p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">輸入你的帳號 Email，我們會寄送密碼重設連結。</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {loading ? "寄送中..." : "寄送重設連結"}
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-gray-500 text-sm text-center">
          <a href="/login" className="text-blue-400 hover:underline">← 返回登入</a>
        </p>
      </div>
    </main>
  );
}
