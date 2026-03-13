"use client";
import { useEffect, useState } from "react";

export default function NavBar() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("token"));
  }, []);

  return (
    <nav className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
      <a href="/" className="text-xl font-bold">😴 懶得回 LazyReply</a>
      <div className="flex gap-3 items-center">
        <a href="/pricing" className="px-4 py-2 text-gray-300 hover:text-white transition text-sm">定價</a>
        {loggedIn ? (
          <a href="/dashboard" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">
            進入後台
          </a>
        ) : (
          <>
            <a href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition text-sm">登入</a>
            <a href="/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">免費註冊</a>
          </>
        )}
      </div>
    </nav>
  );
}
