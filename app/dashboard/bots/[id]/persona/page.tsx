"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";

const API = "https://graceful-patience-production-0170.up.railway.app";

const PROMPT_PRESETS = [
  {
    key: "customer_service",
    label: "👩‍💼 親切客服",
    desc: "耐心解答、親切有禮",
    prompt: "你是「{bot_name}」的客服人員，負責解答客戶問題、處理服務需求，保持親切耐心的態度。",
  },
  {
    key: "sales",
    label: "💼 積極業務",
    desc: "介紹產品、促成合作",
    prompt: "你是「{bot_name}」的業務專員，負責介紹產品優勢、了解客戶需求、促成合作，使用積極但不強迫的業務話術。",
  },
  {
    key: "tech_support",
    label: "🔧 技術支援",
    desc: "解決技術問題、清楚說明",
    prompt: "你是「{bot_name}」的技術支援工程師，負責協助客戶解決技術問題，說明要清楚易懂。",
  },
  {
    key: "consultant",
    label: "🎯 專業顧問",
    desc: "提供建議、輔助決策",
    prompt: "你是「{bot_name}」的諮詢顧問，負責提供專業建議，幫助客戶做出最適合的決策。",
  },
];

export default function PersonaPage() {
  const { id } = useParams();
  const router = useRouter();

  const [botName, setBotName] = useState("Bot");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [newQuickReply, setNewQuickReply] = useState("");

  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingGuide, setSavingGuide] = useState(false);
  const [promptMsg, setPromptMsg] = useState("");
  const [guideMsg, setGuideMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!id) return;
    axios.get(`${API}/bots/${id}`, { headers }).then((res) => {
      const data = res.data;
      setBotName(data.name || "Bot");
      setSystemPrompt(data.system_prompt || "");
      setWelcomeMessage(data.welcome_message || "");
      setQuickReplies((data.quick_replies || []).map((q: any) => q.label || q));
      setLoading(false);
    }).catch(() => router.push("/dashboard"));
  }, [id]);

  const savePrompt = async () => {
    setSavingPrompt(true);
    await axios.patch(`${API}/bots/${id}`, { system_prompt: systemPrompt }, { headers });
    setPromptMsg("✅ 已儲存");
    setSavingPrompt(false);
    setTimeout(() => setPromptMsg(""), 3000);
  };

  const saveGuide = async () => {
    setSavingGuide(true);
    await axios.patch(`${API}/bots/${id}`, {
      welcome_message: welcomeMessage,
      quick_replies: quickReplies.map((label) => ({ label })),
    }, { headers });
    setGuideMsg("✅ 已儲存");
    setSavingGuide(false);
    setTimeout(() => setGuideMsg(""), 3000);
  };

  const addQuickReply = () => {
    if (newQuickReply.trim()) {
      setQuickReplies((prev) => [...prev, newQuickReply.trim()]);
      setNewQuickReply("");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <button
          onClick={() => router.push(`/dashboard/bots/${id}`)}
          className="text-gray-400 hover:text-white mb-6 text-sm"
        >
          ← 返回 Bot 設定
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">🎨 Bot 個性設定</h1>
          <p className="text-gray-400 text-sm mt-1">定義 <span className="text-white font-medium">{botName}</span> 的角色、說話風格與開場引導</p>
        </div>

        {/* ── 角色設定 ── */}
        <section className="bg-gray-900 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-lg font-semibold">🤖 角色 & 說話風格</h2>
            {promptMsg && <span className="text-green-400 text-sm">{promptMsg}</span>}
          </div>
          <p className="text-gray-400 text-sm mb-5">
            決定 Bot 扮演什麼角色、用什麼口吻說話。
          </p>

          {/* 預設範本 */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {PROMPT_PRESETS.map((preset) => {
              const isActive = systemPrompt.trim() === preset.prompt.trim();
              return (
                <button
                  key={preset.key}
                  onClick={() => setSystemPrompt(preset.prompt)}
                  className={`text-left p-4 rounded-xl border transition ${
                    isActive
                      ? "border-blue-500 bg-blue-900/30 text-white"
                      : "border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-300"
                  }`}
                >
                  <p className="font-medium text-sm">{preset.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{preset.desc}</p>
                </button>
              );
            })}
          </div>

          {/* 自訂 prompt */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm text-gray-400">自訂角色描述</label>
              {systemPrompt && (
                <button
                  onClick={() => setSystemPrompt("")}
                  className="text-xs text-gray-500 hover:text-red-400 transition"
                >
                  清除
                </button>
              )}
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={`例如：你是「${botName}」的業務專員，說話風格積極有親和力，擅長了解客戶需求並推薦最適合的方案...`}
              rows={5}
              className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            />
          </div>
          <p className="text-gray-600 text-xs mb-4">
            可用 <code className="bg-gray-800 px-1 rounded text-gray-400">{"{bot_name}"}</code> 代入 Bot 名稱。知識庫內容會自動附加，不需手動填入。
          </p>

          <button
            onClick={savePrompt}
            disabled={savingPrompt}
            className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition disabled:opacity-50"
          >
            {savingPrompt ? "儲存中..." : "💾 儲存角色設定"}
          </button>
        </section>

        {/* ── 引導式對話 ── */}
        <section className="bg-gray-900 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-lg font-semibold">🎯 開場引導</h2>
            {guideMsg && <span className="text-green-400 text-sm">{guideMsg}</span>}
          </div>
          <p className="text-gray-400 text-sm mb-5">
            用戶開啟對話時，Bot 會先發送歡迎訊息並顯示快速選項按鈕。
          </p>

          {/* 預覽 */}
          {(welcomeMessage || quickReplies.length > 0) && (
            <div className="bg-gray-800 rounded-xl p-4 mb-5">
              <p className="text-xs text-gray-500 mb-3">預覽效果</p>
              <div className="flex justify-start mb-3">
                <div className="max-w-[80%] bg-gray-700 text-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed whitespace-pre-wrap">
                  {welcomeMessage || "（歡迎訊息）"}
                </div>
              </div>
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((label, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-full text-gray-300"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 歡迎訊息 */}
          <div className="mb-5">
            <label className="text-sm text-gray-400 mb-1.5 block">歡迎訊息</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder={`您好！歡迎來到 ${botName} 客服 😊\n請問您需要哪方面的協助？`}
              rows={3}
              className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            />
          </div>

          {/* 快速選項 */}
          <div className="mb-5">
            <label className="text-sm text-gray-400 mb-2 block">快速選項按鈕</label>

            {quickReplies.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {quickReplies.map((label, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full text-sm"
                  >
                    {label}
                    <button
                      onClick={() => setQuickReplies((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-500 hover:text-red-400 transition text-xs"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm mb-3">尚未新增選項</p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="輸入選項文字，按 Enter 新增"
                value={newQuickReply}
                onChange={(e) => setNewQuickReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuickReply(); } }}
                className="flex-1 bg-gray-800 px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={addQuickReply}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2.5 rounded-xl text-sm transition"
              >
                + 新增
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-2">
              用戶點選按鈕 = 傳送該文字，Bot 會根據知識庫回答
            </p>
          </div>

          <button
            onClick={saveGuide}
            disabled={savingGuide}
            className="w-full bg-teal-600 hover:bg-teal-700 py-3 rounded-xl font-semibold transition disabled:opacity-50"
          >
            {savingGuide ? "儲存中..." : "💾 儲存引導設定"}
          </button>
        </section>

      </div>
    </main>
  );
}
