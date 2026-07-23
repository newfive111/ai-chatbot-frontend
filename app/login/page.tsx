"use client";
import { useState, Suspense } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const API = "/api/proxy";
      const res = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem("token", res.data.token);
      // 只允許站內路徑，防止 open redirect 攻擊
      const raw = searchParams.get("redirect") || "/dashboard";
      const redirect = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
      router.push(redirect);
    } catch {
      setError("帳號或密碼錯誤");
    } finally {
      setLoading(false);
    }
  };

  const handleLineLogin = async () => {
    setError("");
    try {
      // 保留邀請/導向目標，登入完成後接續
      const redirect = searchParams.get("redirect");
      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
        sessionStorage.setItem("post_login_redirect", redirect);
      }
      const res = await axios.get("/api/proxy/auth/line/login");
      window.location.href = res.data.auth_url;
    } catch {
      setError("LINE 登入暫時無法使用");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-6">登入</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs">或</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <button
          type="button"
          onClick={handleLineLogin}
          className="w-full flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] py-3 rounded-lg font-semibold transition text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.02 3.55 7.39 8.35 8.03.32.07.77.21.88.49.1.25.06.64.03.9l-.14.86c-.04.25-.2.99.87.54 1.07-.45 5.76-3.39 7.86-5.81C21.36 13.5 22 11.9 22 10.13 22 5.64 17.52 2 12 2zM8.29 12.6H6.3a.53.53 0 01-.53-.53V8.09a.53.53 0 011.06 0v3.45h1.46a.53.53 0 010 1.06zm2.07-.53a.53.53 0 01-1.06 0V8.09a.53.53 0 011.06 0v3.98zm4.79 0a.53.53 0 01-.36.5.55.55 0 01-.17.03.52.52 0 01-.43-.21l-2.04-2.78v2.46a.53.53 0 01-1.06 0V8.09a.53.53 0 01.36-.5.53.53 0 01.6.18l2.04 2.78V8.09a.53.53 0 011.06 0v3.98zm3.14-2.52a.53.53 0 010 1.06h-1.46v.93h1.46a.53.53 0 010 1.06H16.3a.53.53 0 01-.53-.53V8.09a.53.53 0 01.53-.53h1.99a.53.53 0 010 1.06h-1.46v.93h1.46z"/>
          </svg>
          使用 LINE 登入
        </button>

        <p className="mt-5 text-gray-400 text-sm text-center">
          <a href="/forgot-password" className="text-gray-500 hover:text-gray-300 transition">忘記密碼？</a>
        </p>
        <p className="mt-2 text-gray-400 text-sm text-center">
          沒有帳號？<a href="/register" className="text-blue-400 hover:underline">免費註冊</a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
