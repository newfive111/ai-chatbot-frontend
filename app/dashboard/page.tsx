"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

interface Bot {
  id: string;
  name: string;
  created_at: string;
  has_api_key?: boolean;
  collect_fields?: string[];
}

interface Subscription {
  plan: "free" | "pro" | "business";
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
}

const API = "/api/proxy";

function getBotProgress(bot: Bot, knowledgeCounts: Record<string, number>): number {
  let done = 1; // Bot 建立
  if ((knowledgeCounts[bot.id] ?? 0) > 0) done++;
  if (bot.has_api_key) done++;
  if (typeof window !== "undefined" && localStorage.getItem(`tested_${bot.id}`) === "true") done++;
  return done;
}

const PLAN_LABEL: Record<string, string> = {
  free:     "免費版",
  pro:      "專業版",
  business: "商業版",
};
const PLAN_COLOR: Record<string, string> = {
  free:     "bg-gray-800 text-gray-400",
  pro:      "bg-blue-900/50 text-blue-400 border border-blue-800",
  business: "bg-purple-900/50 text-purple-400 border border-purple-800",
};

export default function DashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [newBotName, setNewBotName] = useState("");
  const [loading, setLoading] = useState(false);
  const [knowledgeCounts, setKnowledgeCounts] = useState<Record<string, number>>({});
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    fetchBots();
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await axios.get(`${API}/me/subscription`, { headers });
      setSubscription(res.data);
    } catch {
      setSubscription({ plan: "free", status: "active", billing_cycle: null, current_period_end: null });
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await axios.post(`${API}/stripe/portal`, {}, { headers });
      window.location.href = res.data.portal_url;
    } catch {
      alert("無法開啟訂閱管理頁，請確認是否已有訂閱");
    } finally {
      setPortalLoading(false);
    }
  };

  const fetchBots = async () => {
    const res = await axios.get(`${API}/bots`, { headers });
    const botList: Bot[] = res.data;
    setBots(botList);

    // Fetch knowledge count for each bot
    const counts: Record<string, number> = {};
    await Promise.all(
      botList.map(async (bot) => {
        try {
          const r = await axios.get(`${API}/bots/${bot.id}/knowledge`, { headers });
          counts[bot.id] = r.data.length;
        } catch {
          counts[bot.id] = 0;
        }
      })
    );
    setKnowledgeCounts(counts);
  };

  const createBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setLoading(true);
    await axios.post(`${API}/bots?name=${encodeURIComponent(newBotName)}`, {}, { headers });
    setNewBotName("");
    await fetchBots();
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">🤖 我的 Bot</h1>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">登出</button>
        </div>

        {/* 訂閱狀態列 */}
        {subscription && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-6 text-sm ${PLAN_COLOR[subscription.plan]}`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{PLAN_LABEL[subscription.plan]}</span>
              {subscription.status === "past_due" && (
                <span className="text-red-400 text-xs">⚠️ 付款逾期</span>
              )}
              {subscription.current_period_end && (
                <span className="opacity-60 text-xs">
                  到期：{new Date(subscription.current_period_end).toLocaleDateString("zh-TW")}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {subscription.plan === "free" ? (
                <a href="/pricing" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition font-medium">
                  ⚡ 升級方案
                </a>
              ) : (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="text-xs opacity-70 hover:opacity-100 transition underline"
                >
                  {portalLoading ? "..." : "管理訂閱"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 付款成功提示 */}
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "success" && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl px-4 py-3 mb-6 text-sm text-green-400">
            🎉 付款成功！訂閱已啟用，功能即刻生效。
          </div>
        )}

        {/* 建立新 Bot */}
        <form onSubmit={createBot} className="flex gap-3 mb-8">
          <input
            type="text"
            placeholder="Bot 名稱（例如：台灣科技客服）"
            value={newBotName}
            onChange={(e) => setNewBotName(e.target.value)}
            className="flex-1 bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            + 建立
          </button>
        </form>

        {/* Bot 列表 */}
        {bots.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <p className="text-4xl mb-4">🤖</p>
            <p className="text-lg mb-2">還沒有 Bot</p>
            <p className="text-sm">輸入名稱，建立你的第一個 AI 客服 Bot！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bots.map((bot) => {
              const progress = getBotProgress(bot, knowledgeCounts);
              const isSetupDone = progress === 4;
              return (
                <div
                  key={bot.id}
                  onClick={() => router.push(`/dashboard/bots/${bot.id}`)}
                  className="bg-gray-900 rounded-xl p-5 cursor-pointer hover:bg-gray-800 transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="font-semibold text-lg">{bot.name}</h2>
                      <p className="text-gray-500 text-xs mt-0.5">ID: {bot.id}</p>
                    </div>
                    {isSetupDone ? (
                      <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full">✅ 已就緒</span>
                    ) : (
                      <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded-full">⚙️ 設定中</span>
                    )}
                  </div>

                  {/* 進度條 */}
                  {!isSetupDone && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>設定進度</span>
                        <span>{progress} / 4</span>
                      </div>
                      <div className="w-full h-1 bg-gray-800 rounded-full">
                        <div
                          className="h-1 bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(progress / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
