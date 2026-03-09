"use client";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "https://graceful-patience-production-0170.up.railway.app";
      const res = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem("token", res.data.token);
      router.push("/dashboard");
    } catch {
      setError("帳號或密碼錯誤");
    } finally {
      setLoading(false);
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
        <p className="mt-4 text-gray-400 text-sm text-center">
          <a href="/forgot-password" className="text-gray-500 hover:text-gray-300 transition">忘記密碼？</a>
        </p>
        <p className="mt-2 text-gray-400 text-sm text-center">
          沒有帳號？<a href="/register" className="text-blue-400 hover:underline">免費註冊</a>
        </p>
      </div>
    </main>
  );
}
