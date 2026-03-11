"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "https://graceful-patience-production-0170.up.railway.app";

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const plans = [
    {
      key: "free",
      name: "免費",
      monthly: 0,
      yearly: 0,
      desc: "個人試用、小型測試",
      color: "border-gray-700",
      badge: null,
      cta: "免費開始",
      ctaStyle: "bg-gray-700 hover:bg-gray-600",
      features: [
        { text: "1 個 Bot", included: true },
        { text: "每月 300 則訊息", included: true },
        { text: "網站嵌入（Widget）", included: true },
        { text: "基本數據分析", included: true },
        { text: "LINE Bot 整合", included: false },
        { text: "關鍵字觸發", included: false },
        { text: "移除「Powered by LazyReply」", included: false },
        { text: "優先客服支援", included: false },
      ],
    },
    {
      key: "pro",
      name: "專業",
      monthly: 1290,
      yearly: 10790,
      desc: "成長中的企業首選",
      color: "border-blue-500",
      badge: "最受歡迎",
      cta: "立即升級",
      ctaStyle: "bg-blue-600 hover:bg-blue-700",
      features: [
        { text: "5 個 Bot", included: true },
        { text: "每月 5,000 則訊息", included: true },
        { text: "網站嵌入（Widget）", included: true },
        { text: "完整數據分析", included: true },
        { text: "LINE Bot 整合", included: true },
        { text: "關鍵字觸發", included: true },
        { text: "移除「Powered by LazyReply」", included: false },
        { text: "優先客服支援", included: false },
      ],
    },
    {
      key: "business",
      name: "商業",
      monthly: 3490,
      yearly: 29290,
      desc: "大型企業、代理商",
      color: "border-purple-500",
      badge: null,
      cta: "立即升級",
      ctaStyle: "bg-purple-600 hover:bg-purple-700",
      features: [
        { text: "無限 Bot", included: true },
        { text: "每月 30,000 則訊息", included: true },
        { text: "網站嵌入（Widget）", included: true },
        { text: "完整數據分析", included: true },
        { text: "LINE Bot 整合", included: true },
        { text: "關鍵字觸發", included: true },
        { text: "移除「Powered by LazyReply」", included: true },
        { text: "優先客服支援", included: true },
      ],
    },
  ];

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.monthly === 0) return { display: "NT$0", sub: "永久免費" };
    if (annual) {
      const monthly = Math.round(plan.yearly / 12);
      return { display: `NT$${monthly.toLocaleString()}`, sub: `年付 NT$${plan.yearly.toLocaleString()}` };
    }
    return { display: `NT$${plan.monthly.toLocaleString()}`, sub: "月付" };
  };

  const handleUpgrade = async (planKey: string) => {
    if (planKey === "free") {
      router.push("/register");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      // 未登入 → 導到登入頁，登入後回來
      router.push(`/login?redirect=/pricing`);
      return;
    }

    const loadingKey = `${planKey}_${annual ? "annual" : "monthly"}`;
    setLoading(loadingKey);

    try {
      const res = await fetch(`${API}/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planKey,
          billing_cycle: annual ? "annual" : "monthly",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`錯誤：${err.detail || "請稍後再試"}`);
        return;
      }

      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch {
      alert("連線失敗，請稍後再試");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* 頂部導覽 */}
      <nav className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
        <a href="/" className="text-xl font-bold">😴 懶得回 LazyReply</a>
        <div className="flex gap-3 items-center">
          <a href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition text-sm">
            登入
          </a>
          <a href="/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">
            免費註冊
          </a>
        </div>
      </nav>

      {/* 標題 */}
      <section className="text-center px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">簡單透明的定價</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
          從免費開始，按需升級。不需要信用卡，隨時可以取消。
        </p>

        {/* 月付 / 年付切換 */}
        <div className="inline-flex items-center gap-3 bg-gray-900 rounded-xl p-1">
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

      {/* 方案卡片 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 pb-16 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const price = getPrice(plan);
          const loadingKey = `${plan.key}_${annual ? "annual" : "monthly"}`;
          const isLoading = loading === loadingKey;

          return (
            <div
              key={plan.name}
              className={`relative bg-gray-900 rounded-2xl p-8 border-2 ${plan.color} flex flex-col`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                <p className="text-gray-400 text-sm mb-4">{plan.desc}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold">{price.display}</span>
                  {plan.monthly !== 0 && <span className="text-gray-400 mb-1">/月</span>}
                </div>
                <p className="text-gray-500 text-xs">{price.sub}</p>
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-center gap-3 text-sm">
                    <span className={f.included ? "text-green-400" : "text-gray-600"}>
                      {f.included ? "✓" : "✗"}
                    </span>
                    <span className={f.included ? "text-gray-200" : "text-gray-500"}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={isLoading}
                className={`w-full text-center py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${plan.ctaStyle}`}
              >
                {isLoading ? "跳轉中..." : plan.cta}
              </button>
            </div>
          );
        })}
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center mb-8">常見問題</h2>
        <div className="flex flex-col gap-4">
          {[
            {
              q: "訊息數量怎麼計算？",
              a: "每一則用戶傳送的訊息算一則。AI 的回覆不計入。每月 1 日重設。",
            },
            {
              q: "超出訊息限制會怎樣？",
              a: "Bot 會暫停回應，直到下個月重設。可隨時升級方案。",
            },
            {
              q: "年付可以退款嗎？",
              a: "年付後 7 天內可申請全額退款。超過後恕不退費，但可繼續使用至年度到期。",
            },
            {
              q: "可以隨時取消嗎？",
              a: "可以。取消後降為免費方案，已付費的月份仍可使用到期末。",
            },
            {
              q: "支援哪些付款方式？",
              a: "信用卡、金融卡（Visa、Mastercard）。",
            },
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
