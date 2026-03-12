"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = "/api/proxy";

const FREE_FEATURES = [
  { text: "1 個 Bot（功能受限）", included: true },
  { text: "每月 300 則訊息", included: true },
  { text: "網站嵌入（Widget）", included: true },
  { text: "基本數據分析", included: true },
  { text: "LINE Bot 整合", included: false },
  { text: "關鍵字觸發", included: false },
  { text: "移除 Powered by LazyReply", included: false },
  { text: "優先客服支援", included: false },
];

const BOT_FEATURES = [
  "1 個完整 Bot",
  "無限則訊息（用自己 API Key）",
  "網站嵌入（Widget）",
  "完整數據分析",
  "LINE Bot 整合",
  "關鍵字觸發",
  "移除 Powered by LazyReply",
  "優先客服支援",
];

const BIZ_FEATURES = [
  "10 個完整 Bot",
  "無限則訊息（用自己 API Key）",
  "網站嵌入（Widget）",
  "完整數據分析",
  "LINE Bot 整合",
  "關鍵字觸發",
  "移除 Powered by LazyReply",
  "優先客服支援",
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleBuy = async (plan: "bot" | "business") => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login?redirect=/pricing");
      return;
    }

    const key = `${plan}_${annual ? "annual" : "monthly"}`;
    setLoading(key);
    try {
      const res = await fetch(`${API}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, billing_cycle: annual ? "annual" : "monthly" }),
      });

      if (!res.ok) {
        let msg = "請稍後再試";
        try { msg = (await res.json()).detail || msg; } catch {}
        if (res.status === 401) { router.push("/login?redirect=/pricing"); return; }
        alert(`錯誤：${msg}`);
        return;
      }
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (err: unknown) {
      alert(`連線失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const botPrice    = annual ? "NT$12,900/年" : "NT$1,290/月";
  const botSub      = annual ? "約 NT$1,075/月，省 2 個月" : "月付，隨時取消";
  const bizPrice    = annual ? "NT$46,800/年" : "NT$4,680/月";
  const bizSub      = annual ? "約 NT$3,900/月，省 2 個月" : "月付，隨時取消";

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
        <a href="/" className="text-xl font-bold">😴 懶得回 LazyReply</a>
        <div className="flex gap-3 items-center">
          <a href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition text-sm">登入</a>
          <a href="/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">免費註冊</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">一個 Bot，一個價格</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
          不用猜方案、不用算額度。需要幾個 Bot 就買幾個，每個 NT$1,290/月。
        </p>
        {/* 月付 / 年付切換 */}
        <div className="inline-flex items-center gap-1 bg-gray-900 rounded-xl p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${!annual ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}
          >
            月付
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${annual ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}
          >
            年付
            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">省2個月</span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="flex flex-col md:flex-row gap-6 px-6 pb-16 max-w-5xl mx-auto">

        {/* Free */}
        <div className="flex-1 bg-gray-900 rounded-2xl p-8 border-2 border-gray-700 flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">免費</h2>
            <p className="text-gray-400 text-sm mb-4">試試看，不需信用卡</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold">NT$0</span>
            </div>
            <p className="text-gray-500 text-xs">永久免費</p>
          </div>
          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {FREE_FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm">
                <span className={f.included ? "text-green-400" : "text-gray-600"}>{f.included ? "✓" : "✗"}</span>
                <span className={f.included ? "text-gray-200" : "text-gray-500"}>{f.text}</span>
              </li>
            ))}
          </ul>
          <a href="/register" className="block w-full text-center py-3 rounded-xl font-semibold transition bg-gray-700 hover:bg-gray-600">
            免費開始
          </a>
        </div>

        {/* Bot 訂閱 */}
        <div className="flex-1 relative bg-gray-900 rounded-2xl p-8 border-2 border-blue-500 flex flex-col">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
            完整功能
          </div>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">Bot 訂閱</h2>
            <p className="text-gray-400 text-sm mb-4">每個 Bot 獨立訂閱，按需購買</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold">{botPrice}</span>
            </div>
            <p className="text-gray-500 text-xs">{botSub}</p>
          </div>
          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {BOT_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-gray-200">{f}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleBuy("bot")}
            disabled={loading !== null}
            className="w-full text-center py-3 rounded-xl font-semibold transition disabled:opacity-60 bg-blue-600 hover:bg-blue-700"
          >
            {loading?.startsWith("bot") ? "跳轉中..." : "立即購買"}
          </button>
        </div>

        {/* 商業版 */}
        <div className="flex-1 relative bg-gray-900 rounded-2xl p-8 border-2 border-purple-500 flex flex-col">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full">
            最划算
          </div>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">商業版</h2>
            <p className="text-gray-400 text-sm mb-4">3 個以上 Bot，選這個更省</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold">{bizPrice}</span>
            </div>
            <p className="text-gray-500 text-xs">{bizSub}・每個 Bot 只要 NT${annual ? "3,900" : "468"}</p>
          </div>
          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {BIZ_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-gray-200">{f}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleBuy("business")}
            disabled={loading !== null}
            className="w-full text-center py-3 rounded-xl font-semibold transition disabled:opacity-60 bg-purple-600 hover:bg-purple-700"
          >
            {loading?.startsWith("business") ? "跳轉中..." : "立即購買"}
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center mb-8">常見問題</h2>
        <div className="flex flex-col gap-4">
          {[
            { q: "免費版和付費版差在哪？", a: "免費版每月限 300 則訊息，且不含 LINE 整合、關鍵字觸發等功能。付費版完全解鎖，無訊息上限。" },
            { q: "我需要 3 個以上 Bot，怎麼辦？", a: "購買商業版 NT$4,680/月，包含 10 個 Bot 名額，每個 Bot 只要 NT$468，比單買划算許多。" },
            { q: "年付可以退款嗎？", a: "年付後 7 天內可申請全額退款。超過後恕不退費，但可繼續使用至年度到期。" },
            { q: "可以隨時取消嗎？", a: "可以。取消後該 Bot 降回免費限制，已付費的月份仍可使用到期末。" },
            { q: "支援哪些付款方式？", a: "信用卡、金融卡（Visa、Mastercard）。" },
          ].map((item) => (
            <div key={item.q} className="bg-gray-900 rounded-xl p-5">
              <h3 className="font-semibold mb-2">{item.q}</h3>
              <p className="text-gray-400 text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
