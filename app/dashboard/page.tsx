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

const BOT_TEMPLATES = [
  {
    id: "blank",
    name: "空白",
    icon: "🆕",
    desc: "從零開始自訂",
    system_prompt: "",
    collect_fields: [],
    welcome_message: "",
  },
  {
    id: "clinic",
    name: "診所/醫美",
    icon: "🏥",
    desc: "預約掛號、諮詢",
    system_prompt: "你是一位親切的診所客服助理，負責協助患者預約掛號與諮詢。請用繁體中文回覆，語氣溫和有禮，主動詢問預約所需資訊。",
    collect_fields: ["姓名", "電話", "預約日期", "項目"],
    welcome_message: "您好！歡迎聯繫我們的診所，請問有什麼可以幫助您的？😊",
  },
  {
    id: "beauty",
    name: "美容美髮",
    icon: "💇",
    desc: "預約造型、收集需求",
    system_prompt: "你是一位專業的美容美髮沙龍客服，負責協助客人預約服務。請用繁體中文回覆，語氣活潑友善，介紹服務並收集預約資訊。",
    collect_fields: ["姓名", "電話", "預約日期", "服務項目"],
    welcome_message: "嗨！歡迎來到我們的沙龍 💆‍♀️ 想預約什麼服務呢？",
  },
  {
    id: "realestate",
    name: "房仲/裝潢",
    icon: "🏠",
    desc: "物件詢問、買方需求",
    system_prompt: "你是一位專業的房地產客服顧問，負責瞭解客戶的購屋或裝潢需求，並協助安排看屋或估價。請用繁體中文回覆，語氣專業有信任感。",
    collect_fields: ["姓名", "電話", "預算", "需求"],
    welcome_message: "您好！歡迎洽詢，請問您在尋找什麼樣的物件或服務？🏡",
  },
  {
    id: "insurance",
    name: "保險/理財",
    icon: "💼",
    desc: "保險諮詢、客戶需求",
    system_prompt: "你是一位友善的保險理財顧問助理，負責初步瞭解客戶的保障需求。請用繁體中文回覆，語氣專業令人安心，收集基本資訊後安排後續諮詢。",
    collect_fields: ["姓名", "電話", "年齡", "需求"],
    welcome_message: "您好！歡迎諮詢保險規劃，我來幫您瞭解最適合的保障方案 😊",
  },
];

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

  const [token, setToken] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${token}` };
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);
    fetchBots(t);
    fetchSubscription(t);
  }, []);

  const fetchSubscription = async (t?: string | null) => {
    const h = { Authorization: `Bearer ${t ?? token}` };
    try {
      const res = await axios.get(`${API}/me/subscription`, { headers: h });
      setSubscription(res.data);
    } catch {
      setSubscription({ plan: "free", bot_slots: 0, max_bots: 1, bots_used: 0, status: "active" });
    }
  };

  const fetchBots = async (t?: string | null) => {
    const h = { Authorization: `Bearer ${t ?? token}` };
    try {
      const res = await axios.get(`${API}/bots`, { headers: h });
      const botList: Bot[] = res.data;
      setBots(botList);

      // Fetch knowledge count for each bot
      const counts: Record<string, number> = {};
      await Promise.all(
        botList.map(async (bot) => {
          try {
            const r = await axios.get(`${API}/bots/${bot.id}/knowledge`, { headers: h });
            counts[bot.id] = r.data.length;
          } catch {
            counts[bot.id] = 0;
          }
        })
      );
      setKnowledgeCounts(counts);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "載入 Bot 列表失敗，請重新整理";
      alert(msg);
    }
  };

  const createBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setLoading(true);
    try {
      const tmpl = BOT_TEMPLATES.find((t) => t.id === selectedTemplate) ?? BOT_TEMPLATES[0];
      const body = tmpl.id === "blank"
        ? {}
        : { system_prompt: tmpl.system_prompt, collect_fields: tmpl.collect_fields, welcome_message: tmpl.welcome_message };
      const res = await axios.post(`${API}/bots?name=${encodeURIComponent(newBotName)}`, body, { headers });
      const newBotId = res.data.bot_id;
      router.push(`/dashboard/bots/${newBotId}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "建立失敗，請稍後再試";
      alert(msg);
      setLoading(false);
    }
  };

  const deleteBot = async (botId: string, botName: string) => {
    if (!confirm(`確定要刪除「${botName}」嗎？此操作無法復原。`)) return;
    try {
      await axios.delete(`${API}/bots/${botId}`, { headers });
      setBots((prev) => prev.filter((b) => b.id !== botId));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "刪除失敗");
    }
  };

  return (
    <div className="px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center mb-8">
          <h1 className="text-2xl font-bold">我的 Bot</h1>
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
        <form onSubmit={createBot} className="flex gap-3 mb-4">
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

        {/* 範本選擇 */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 mb-2">選擇範本（可之後修改）</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {BOT_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelectedTemplate(tmpl.id)}
                className={`cursor-pointer flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-center transition border ${
                  selectedTemplate === tmpl.id
                    ? "border-blue-500 bg-blue-900/30 text-white"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
              >
                <span className="text-2xl">{tmpl.icon}</span>
                <span className="text-xs font-medium leading-tight">{tmpl.name}</span>
                <span className="text-[10px] text-gray-500 leading-tight">{tmpl.desc}</span>
              </button>
            ))}
          </div>
        </div>

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
                  className="bg-gray-900 rounded-xl p-5 hover:bg-gray-800 transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div onClick={() => router.push(`/dashboard/bots/${bot.id}`)} className="flex-1 cursor-pointer">
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
                    <div className="flex items-center gap-2">
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/bots/${bot.id}`);
                        }}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition"
                        title="編輯"
                      >
                        ✏️ 編輯
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBot(bot.id, bot.name);
                        }}
                        className="text-xs bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg transition"
                        title="刪除"
                      >
                        🗑️ 刪除
                      </button>
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
    </div>
  );
}
