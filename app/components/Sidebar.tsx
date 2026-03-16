"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", icon: "🤖", label: "我的 Bot" },
  { href: "/account",   icon: "👤", label: "會員中心" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname.startsWith("/dashboard")
      : pathname === href;

  return (
    <>
      {/* ── Mobile 漢堡按鈕 ── */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-300 hover:text-white"
        onClick={() => setOpen(!open)}
      >
        {open ? "✕" : "☰"}
      </button>

      {/* ── Mobile 遮罩 ── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-60 bg-gray-950 border-r border-gray-800
        flex flex-col z-40 transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-gray-800">
          <img src="/logo.png" alt="攬得回" className="w-9 h-9 rounded-xl" />
          <span className="font-bold text-white text-lg">攬得回</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, icon, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive(href)
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </a>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-800 flex flex-col gap-1">
          <a
            href="/pricing"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <span className="text-base">💰</span>
            定價方案
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition w-full text-left"
          >
            <span className="text-base">🚪</span>
            登出
          </button>
        </div>
      </aside>
    </>
  );
}
