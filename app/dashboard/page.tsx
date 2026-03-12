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
  plan?: "free" | "paid";
}

interface Subscription {
  plan: "free" | "paid";
  bot_slots: number;
  max_bots: number;
  bots_used: number;
  status: string;
}

const API = "/api/proxy";

function getBotProgress(bot: Bot, knowledgeCounts: Record<string, number>): number {
  let done = 1; // Bot 建立
  if ((knowledgeCounts[bot.id] ?? 0) > 0) done++;
  if (bot.has_api_key) done++;
  if (typeof window !== "undefined" && localStorage.getItem(`tested_${bot.id}`) === "true") done++;
  return done;
}

const PLAN_COLOR: Record<string, string> = {
  free: "bg-gray-800/60 text-gray-400 border border-gray-700",
  paid: "bg-blue-900/40 text-blue-300 border border-blue-800",
};

export default function DashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [newBotName, setNewBotName] = useState("");
  const [loading, setLoading] = useState(false);
  const [knowledgeCounts, setKnowledgeCounts] = useState<Record<string, number>>({});
  const [subscription, setSubscription] = useState<Subscription | null>(null);

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
      setSubscription({ plan: "free", bot_slots: 0, max_bots: 1, bots_used: 0, status: "active" });
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

        {/* Bot 名額狀態列 */}
        {subscription && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-6 text-sm ${PLAN_COLOR[subscription.plan]}`}>
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                🤖 Bot {subscription.bots_used} / {subscription.max_bots}
              </span>
              <span className="opacity-60 text-xs">
                {subscription.bot_slots > 0
                  ? `${subscription.bot_slots} 個付費訂閱`
                  : "免費方案"}
              </span>
            </div>
            <div className="flex gap-2">
              <a
                href="/pricing"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition font-medium"
              >
                + 新增 Bot 名額
              </a>
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
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="font-semibold text-lg">{bot.name}</h2>
                        {bot.plan === "paid" ? (
                          <span className="text-xs bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full">💎 付費</span>
                        ) : (
                          <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full">🔒 免費</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">ID: {bot.id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {isSetupDone ? (
                        <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full">✅ 已就緒</span>
                      ) : (
                        <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded-full">⚙️ 設定中</span>
                      )}
                      {bot.plan === "free" && (
                        <a
                          href="/pricing"
                          onClick={e => e.stopPropagation()}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-full transition"
                        >
                          ⚡ 啟用完整功能
                        </a>
                      )}
                    </div>
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
