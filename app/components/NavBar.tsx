"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // 5 下點 logo 進後台（彩蛋）
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      router.push("/admin");
    } else {
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
        router.push("/");
      }, 600);
    }
  };

  return (
    <nav className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
      <a href="/" onClick={handleLogoClick}>
        <img src="/logo.png" alt="攬得回" className="h-11 w-11 rounded-xl" />
      </a>
      <div className="flex gap-3 items-center">
        <a href="/login"    className="px-4 py-2 text-gray-300 hover:text-white transition text-sm">登入</a>
        <a href="/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">免費註冊</a>
      </div>
    </nav>
  );
}
