"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";

interface Chunk {
  id: string;
  content: string;
  created_at: string;
}

interface BotSettings {
  name: string;
  has_api_key: boolean;
  sheet_id?: string;
  collect_fields?: string[];
  welcome_message?: string;
  quick_replies?: { label: string }[];
  calendar_id?: string;
  slot_duration_minutes?: number;
  business_hours?: { start: string; end: string; weekdays: number[] };
  keyword_triggers?: { keyword: string; reply: string }[];
}

interface AnalyticsData {
  total: number;
  today: number;
  this_week: number;
  prev_week: number;
  week_growth: number;
  daily_counts: { date: string; count: number }[];
  hourly_distribution: { hour: number; count: number }[];
  top_questions: { question: string; count: number }[];
  recent_questions: string[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "https://graceful-patience-production-0170.up.railway.app";

const PROMPT_PRESETS = [
  { key: "customer_service", label: "👩‍💼 親切客服", desc: "耐心解答、親切有禮", prompt: "你是「{bot_name}」的客服人員，負責解答客戶問題、處理服務需求，保持親切耐心的態度。" },
  { key: "sales",            label: "💼 積極業務",  desc: "介紹產品、促成合作", prompt: "你是「{bot_name}」的業務專員，負責介紹產品優勢、了解客戶需求、促成合作，使用積極但不強迫的業務話術。" },
  { key: "tech_support",    label: "🔧 技術支援",  desc: "解決技術問題、清楚說明", prompt: "你是「{bot_name}」的技術支援工程師，負責協助客戶解決技術問題，說明要清楚易懂。" },
  { key: "consultant",      label: "🎯 專業顧問",  desc: "提供建議、輔助決策", prompt: "你是「{bot_name}」的諮詢顧問，負責提供專業建議，幫助客戶做出最適合的決策。" },
];

export default function BotDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"knowledge" | "persona" | "chat" | "embed" | "settings" | "assistant" | "analytics">("knowledge");

  // 關鍵字觸發
  const [keywordTriggers, setKeywordTriggers] = useState<{ keyword: string; reply: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordReply, setNewKeywordReply] = useState("");
  const [savingKeywords, setSavingKeywords] = useState(false);

  // Analytics
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [faqText, setFaqText] = useState("");
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [sessionId, setSessionId] = useState(() => Math.random().toString(36).slice(2));
  const [message, setMessage] = useState("");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingChunk, setSavingChunk] = useState(false);

  // Settings state
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const [collectFields, setCollectFields] = useState<string[]>([]);
  const [newField, setNewField] = useState("");
  const [savingSheet, setSavingSheet] = useState(false);

  // LINE 串接
  const [lineSecret, setLineSecret] = useState("");
  const [lineToken, setLineToken] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [lineConfigured, setLineConfigured] = useState(false);

  // Instagram
  const [instagramPageToken, setInstagramPageToken] = useState("");
  const [savingInstagram, setSavingInstagram] = useState(false);
  const [instagramConfigured, setInstagramConfigured] = useState(false);

  // 預約系統
  const [calendarId, setCalendarId] = useState("");
  const [slotDuration, setSlotDuration] = useState(60);
  const [businessStart, setBusinessStart] = useState("09:00");
  const [businessEnd, setBusinessEnd] = useState("18:00");
  const [workWeekdays, setWorkWeekdays] = useState<number[]>([1,2,3,4,5]);
  const [savingCalendar, setSavingCalendar] = useState(false);

  // 角色 tab state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [newQuickReply, setNewQuickReply] = useState("");
  const [savingGuide, setSavingGuide] = useState(false);

  // Quick replies shown in chat (hide after first user message)
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Onboarding checklist
  const [chatTested, setChatTested] = useState(false);

  // AI 助手 tab
  const [assistantMsgs, setAssistantMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "👋 你好！我是設定助手「小懶」。\n\n告訴我你想要什麼樣的機器人，我來幫你設定！例如：「幫我設定一個賣保險的機器人，要收集姓名和電話」" }
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const assistantSessionId = useRef(`assistant_${id}_${Date.now()}`);
  const assistantBottomRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { Authorization: `Bearer ${token}` };

  // ── 載入 bot 設定（可被 AI 助手呼叫刷新）──
  const fetchBotSettings = async () => {
    if (!id) return;
    try {
      const res = await axios.get(`${API}/bots/${id}`, { headers });
      const data: any = res.data;
      setBotSettings(data);
      setSheetId(data.sheet_id || "");
      setCollectFields(data.collect_fields || []);
      setSystemPrompt(data.system_prompt || "");
      setWelcomeMessage(data.welcome_message || "");
      setQuickReplies((data.quick_replies || []).map((q: any) => q.label || q));
      setLineConfigured(!!(data.line_channel_secret && data.line_channel_access_token));
      setCalendarId(data.calendar_id || "");
      setSlotDuration(data.slot_duration_minutes || 60);
      setBusinessStart(data.business_hours?.start || "09:00");
      setBusinessEnd(data.business_hours?.end || "18:00");
      setWorkWeekdays(data.business_hours?.weekdays || [1,2,3,4,5]);
      setKeywordTriggers(data.keyword_triggers || []);
      setInstagramConfigured(!!data.instagram_page_token);
    } catch (err: any) {
      console.error("[BotDetail] 載入 Bot 設定失敗", err?.response?.status, err?.message);
      setMessage("⚠️ 載入設定失敗，請重新整理頁面");
    }
  };

  // ── 初始化 ──
  useEffect(() => {
    if (!id) return;
    const tested = localStorage.getItem(`tested_${id}`) === "true";
    setChatTested(tested);
    fetchBotSettings();
  }, [id]);

  // ── 進測試 tab → 顯示歡迎訊息 ──
  useEffect(() => {
    if (tab === "chat" && chatMessages.length === 0 && welcomeMessage) {
      setChatMessages([{ role: "bot", text: welcomeMessage }]);
      setShowQuickReplies(true);
    }
  }, [tab]);

  // ── 自動捲動到底部 ──
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    assistantBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMsgs]);

  // ── 知識庫 ──
  const fetchChunks = async () => {
    setLoadingChunks(true);
    const res = await axios.get(`${API}/bots/${id}/knowledge`, { headers });
    setChunks(res.data);
    setLoadingChunks(false);
  };

  useEffect(() => {
    if (tab === "knowledge") fetchChunks();
    if (tab === "analytics") fetchAnalytics();
  }, [tab]);

  const deleteChunk = async (chunkId: string) => {
    await axios.delete(`${API}/bots/${id}/knowledge/${chunkId}`, { headers });
    setChunks((prev) => prev.filter((c) => c.id !== chunkId));
    if (editingId === chunkId) setEditingId(null);
  };

  const saveChunk = async (chunkId: string) => {
    setSavingChunk(true);
    await axios.patch(`${API}/bots/${id}/knowledge/${chunkId}`, { content: editingContent }, { headers });
    setChunks((prev) => prev.map((c) => (c.id === chunkId ? { ...c, content: editingContent } : c)));
    setEditingId(null);
    setSavingChunk(false);
  };

  const clearAll = async () => {
    if (!confirm("確定要清除所有知識庫內容嗎？")) return;
    setClearing(true);
    await axios.delete(`${API}/bots/${id}/knowledge`, { headers });
    setChunks([]);
    setClearing(false);
    setMessage("✅ 知識庫已清除");
    setTimeout(() => setMessage(""), 3000);
  };

  const submitFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    await axios.post(`${API}/bots/${id}/faq`, { content: faqText }, { headers });
    setFaqText("");
    setMessage("✅ FAQ 已加入知識庫");
    await fetchChunks();
    setBotSettings((prev) => prev ? { ...prev } : prev); // trigger re-render for checklist
    setUploading(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── 測試對話 ──
  const sendMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const userMsg = text.trim();
    setQuestion("");
    setShowQuickReplies(false);
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API}/bots/${id}/chat`, {
        question: userMsg,
        session_id: sessionId,
      });
      setChatMessages((prev) => [...prev, { role: "bot", text: res.data.answer }]);
      // Mark as tested
      if (!chatTested) {
        localStorage.setItem(`tested_${id}`, "true");
        setChatTested(true);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "bot", text: "⚠️ 發生錯誤，請確認 Gemini API Key 是否已在「⚙️ 設定」頁面填入。" },
      ]);
    }
    setChatLoading(false);
  };

  const testChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(question);
  };

  const resetChat = async () => {
    try {
      await axios.delete(`${API}/sessions/${sessionId}`);
    } catch {}
    const newId = Math.random().toString(36).slice(2);
    setSessionId(newId);
    setChatMessages([]);
    setShowQuickReplies(false);
    // Show welcome message again if set
    if (welcomeMessage) {
      setTimeout(() => {
        setChatMessages([{ role: "bot", text: welcomeMessage }]);
        setShowQuickReplies(true);
      }, 100);
    }
  };

  // ── AI 助手：發送訊息 ──
  const sendAssistantMsg = async (text: string) => {
    if (!text.trim() || assistantLoading) return;
    const userMsg = text.trim();
    setAssistantInput("");
    setAssistantMsgs((prev) => [...prev, { role: "user", content: userMsg }]);
    setAssistantLoading(true);
    try {
      const res = await axios.post(`${API}/assistant/chat`, {
        bot_id: id,
        message: userMsg,
        session_id: assistantSessionId.current,
      }, { headers });
      setAssistantMsgs((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      // 助手可能已修改設定，刷新
      fetchBotSettings();
    } catch {
      setAssistantMsgs((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ 發生錯誤，請確認 Gemini API Key 已在「設定」頁面填入。" }
      ]);
    }
    setAssistantLoading(false);
  };

  // ── Settings：儲存 API Key ──
  const saveApiKey = async () => {
    setSavingKey(true);
    await axios.patch(`${API}/bots/${id}`, { anthropic_api_key: apiKey }, { headers });
    setBotSettings((prev) => prev ? { ...prev, has_api_key: true } : prev);
    setMessage("✅ API Key 已儲存");
    setApiKey("");
    setSavingKey(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── 角色 tab：儲存 System Prompt ──
  const savePrompt = async () => {
    setSavingPrompt(true);
    await axios.patch(`${API}/bots/${id}`, { system_prompt: systemPrompt }, { headers });
    setMessage("✅ 角色設定已儲存");
    setSavingPrompt(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── 角色 tab：儲存引導設定 ──
  const saveGuide = async () => {
    setSavingGuide(true);
    await axios.patch(`${API}/bots/${id}`, {
      welcome_message: welcomeMessage,
      quick_replies: quickReplies.map((label) => ({ label })),
    }, { headers });
    setBotSettings((prev) => prev ? { ...prev, welcome_message: welcomeMessage } : prev);
    setMessage("✅ 引導設定已儲存");
    setSavingGuide(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── Settings：儲存預約系統 ──
  const saveCalendar = async () => {
    setSavingCalendar(true);
    await axios.patch(`${API}/bots/${id}`, {
      calendar_id: calendarId || null,
      slot_duration_minutes: slotDuration,
      business_hours: { start: businessStart, end: businessEnd, weekdays: workWeekdays },
    }, { headers });
    setMessage("✅ 預約系統設定已儲存");
    setSavingCalendar(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── Settings：儲存 LINE 憑證 ──
  const saveLineConfig = async () => {
    setSavingLine(true);
    await axios.patch(`${API}/bots/${id}`, {
      line_channel_secret: lineSecret,
      line_channel_access_token: lineToken,
    }, { headers });
    setLineConfigured(true);
    setLineSecret("");
    setLineToken("");
    setMessage("✅ LINE 設定已儲存");
    setSavingLine(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── Analytics：載入數據 ──
  const fetchAnalytics = async () => {
    if (!id) return;
    setAnalyticsLoading(true);
    try {
      const res = await axios.get(`${API}/bots/${id}/analytics`, { headers });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error("Analytics fetch failed", err);
    }
    setAnalyticsLoading(false);
  };

  // ── Settings：儲存 Sheet ──
  const saveSheet = async () => {
    setSavingSheet(true);
    await axios.patch(`${API}/bots/${id}`, {
      sheet_id: sheetId,
      collect_fields: collectFields,
    }, { headers });
    setMessage("✅ Google Sheet 設定已儲存");
    setSavingSheet(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── 儲存 Instagram ──
  const saveInstagram = async () => {
    if (!instagramPageToken.trim()) return;
    setSavingInstagram(true);
    await axios.patch(`${API}/bots/${id}`, { instagram_page_token: instagramPageToken }, { headers });
    setInstagramConfigured(true);
    setInstagramPageToken("");
    setMessage("✅ Instagram 設定已儲存");
    setSavingInstagram(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── Settings：儲存關鍵字觸發 ──
  const saveKeywordTriggers = async () => {
    setSavingKeywords(true);
    await axios.patch(`${API}/bots/${id}`, { keyword_triggers: keywordTriggers }, { headers });
    setMessage("✅ 關鍵字設定已儲存");
    setSavingKeywords(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── Onboarding 進度 ──
  const onboardingSteps = [
    { label: "建立 Bot", done: true },
    { label: "設定 API Key", done: !!botSettings?.has_api_key, tab: "settings" as const },
    { label: "設定歡迎語", done: !!welcomeMessage, tab: "persona" as const },
    { label: "上傳知識庫", done: chunks.length > 0, tab: "knowledge" as const },
    { label: "完成對話測試", done: chatTested, tab: "chat" as const },
  ];
  const doneCount = onboardingSteps.filter((s) => s.done).length;
  const allDone = doneCount === onboardingSteps.length;

  const embedCode = `<script>
  window.ChatbotConfig = { botId: "${id}" };
</script>
<script src="https://ai-chatbot-frontend-38vx81gy4-newfive111s-projects.vercel.app/widget.js" async></script>`;

  const lineWebhookUrl = `https://graceful-patience-production-0170.up.railway.app/line/webhook/${id}`;

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white mb-6 text-sm">
          ← 返回
        </button>
        <h1 className="text-2xl font-bold mb-4">Bot 設定</h1>

        {/* ── 新手引導進度清單 ── */}
        {!allDone && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-300">🚀 Bot 設定進度</p>
              <span className="text-xs text-gray-500">{doneCount} / {onboardingSteps.length} 完成</span>
            </div>
            {/* 進度條 */}
            <div className="w-full h-1.5 bg-gray-800 rounded-full mb-3">
              <div
                className="h-1.5 bg-blue-500 rounded-full transition-all"
                style={{ width: `${(doneCount / onboardingSteps.length) * 100}%` }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {onboardingSteps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => step.tab && setTab(step.tab)}
                  disabled={!step.tab}
                  className={`flex items-center gap-2 text-sm text-left transition ${
                    step.done ? "text-green-400" : step.tab ? "text-gray-400 hover:text-white" : "text-gray-600"
                  }`}
                >
                  <span className="text-base">{step.done ? "✅" : "⬜"}</span>
                  {step.label}
                  {!step.done && step.tab && <span className="ml-auto text-xs text-blue-400">點此設定 →</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {allDone && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl p-3 mb-6 text-center text-sm text-green-400">
            🎉 Bot 已完整設定！可以開始部署使用了。
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 overflow-x-auto">
          {(["knowledge", "persona", "chat", "embed", "settings", "analytics", "assistant"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t
                  ? t === "assistant" ? "border-purple-500 text-white"
                  : t === "analytics" ? "border-yellow-500 text-white"
                  : "border-blue-500 text-white"
                  : "border-transparent text-gray-500 hover:text-white"
              }`}
            >
              {{ knowledge: "📚 知識庫", persona: "🤖 角色", chat: "💬 測試對話", embed: "🔗 嵌入代碼", settings: "⚙️ 設定", analytics: "📊 數據", assistant: "✨ AI 助手" }[t]}
            </button>
          ))}
        </div>

        {/* ── 知識庫 Tab ── */}
        {tab === "knowledge" && (
          <div className="flex flex-col gap-6">
            {message && <div className="bg-green-900 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-4">上傳 PDF / TXT 文件</h2>
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const formData = new FormData();
                  formData.append("file", file);
                  await axios.post(`${API}/bots/${id}/upload`, formData, { headers });
                  setMessage("✅ 文件已上傳並加入知識庫");
                  await fetchChunks();
                  setUploading(false);
                  setTimeout(() => setMessage(""), 3000);
                }}
                disabled={uploading}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:bg-blue-600 file:text-white file:cursor-pointer file:border-0 hover:file:bg-blue-700"
              />
            </div>

            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-4">手動輸入 FAQ</h2>
              <form onSubmit={submitFAQ} className="flex flex-col gap-3">
                <textarea
                  value={faqText}
                  onChange={(e) => setFaqText(e.target.value)}
                  placeholder="貼上你的 FAQ、產品說明、常見問題..."
                  rows={6}
                  className="bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={uploading || !faqText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {uploading ? "處理中..." : "加入知識庫"}
                </button>
              </form>
            </div>

            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">
                  📋 知識庫紀錄
                  <span className="ml-2 text-sm text-gray-400 font-normal">({chunks.length} 筆)</span>
                </h2>
                {chunks.length > 0 && (
                  <button
                    onClick={clearAll}
                    disabled={clearing}
                    className="text-red-400 hover:text-red-300 text-sm transition disabled:opacity-50"
                  >
                    {clearing ? "清除中..." : "🗑️ 全部清除"}
                  </button>
                )}
              </div>
              {loadingChunks ? (
                <p className="text-gray-500 text-sm">載入中...</p>
              ) : chunks.length === 0 ? (
                <p className="text-gray-500 text-sm">尚無知識庫內容，請上傳 FAQ 或文件。</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                  {chunks.map((chunk) => (
                    <div key={chunk.id} className="bg-gray-800 rounded-lg p-3">
                      {editingId === chunk.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            rows={4}
                            className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white text-xs px-3 py-1 rounded transition">
                              取消
                            </button>
                            <button
                              onClick={() => saveChunk(chunk.id)}
                              disabled={savingChunk}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded transition disabled:opacity-50"
                            >
                              {savingChunk ? "儲存中..." : "✅ 儲存"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 items-start">
                          <p className="flex-1 text-sm text-gray-300 leading-relaxed">{chunk.content}</p>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingId(chunk.id); setEditingContent(chunk.content); }}
                              className="text-blue-400 hover:text-blue-300 text-xs transition"
                            >
                              ✏️ 編輯
                            </button>
                            <button onClick={() => deleteChunk(chunk.id)} className="text-red-400 hover:text-red-300 text-xs transition">
                              🗑️ 刪除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 角色 Tab ── */}
        {tab === "persona" && (
          <div className="flex flex-col gap-6">
            {message && <div className="bg-green-900 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

            {/* 歡迎語未設定警告 */}
            {!welcomeMessage && (
              <div className="flex items-start gap-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-4 py-3 text-sm text-yellow-300">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <p className="font-medium">尚未設定歡迎語</p>
                  <p className="text-yellow-400/70 text-xs mt-0.5">
                    客人加入 LINE 或開啟對話時，Bot 會沉默不回應。設定歡迎語可大幅提升客人留存率。
                  </p>
                </div>
              </div>
            )}

            {/* 角色 & 說話風格 */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-1">🤖 角色 & 說話風格</h2>
              <p className="text-gray-400 text-sm mb-5">決定 Bot 扮演什麼角色、用什麼口吻說話。</p>

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

              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-gray-400">自訂角色描述</label>
                  {systemPrompt && (
                    <button onClick={() => setSystemPrompt("")} className="text-xs text-gray-500 hover:text-red-400 transition">清除</button>
                  )}
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={`例如：你是「${botSettings?.name || "Bot"}」的業務專員，說話風格積極有親和力...`}
                  rows={5}
                  className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
              </div>
              <p className="text-gray-600 text-xs mb-4">
                可用 <code className="bg-gray-800 px-1 rounded text-gray-400">{"{bot_name}"}</code> 代入 Bot 名稱。
              </p>
              <button
                onClick={savePrompt}
                disabled={savingPrompt}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {savingPrompt ? "儲存中..." : "💾 儲存角色設定"}
              </button>
            </div>

            {/* 開場引導 */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-1">🎯 開場引導</h2>
              <p className="text-gray-400 text-sm mb-5">
                用戶開啟對話時，Bot 會先發送歡迎訊息並顯示快速選項按鈕。
              </p>

              {/* 即時預覽 */}
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
                        <span key={i} className="px-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-full text-gray-300">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-1.5 block">歡迎訊息</label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder={`您好！歡迎來到 ${botSettings?.name || "Bot"} 客服 😊\n請問您需要哪方面的協助？`}
                  rows={3}
                  className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
              </div>

              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-2 block">快速選項按鈕</label>
                {quickReplies.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quickReplies.map((label, i) => (
                      <span key={i} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full text-sm">
                        {label}
                        <button onClick={() => setQuickReplies((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400 transition text-xs">✕</button>
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newQuickReply.trim()) {
                        e.preventDefault();
                        setQuickReplies((prev) => [...prev, newQuickReply.trim()]);
                        setNewQuickReply("");
                      }
                    }}
                    className="flex-1 bg-gray-800 px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    onClick={() => { if (newQuickReply.trim()) { setQuickReplies((prev) => [...prev, newQuickReply.trim()]); setNewQuickReply(""); } }}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2.5 rounded-xl text-sm transition"
                  >
                    + 新增
                  </button>
                </div>
                <p className="text-gray-600 text-xs mt-2">用戶點選按鈕 = 傳送該文字，Bot 會根據知識庫回答</p>
              </div>

              <button
                onClick={saveGuide}
                disabled={savingGuide}
                className="w-full bg-teal-600 hover:bg-teal-700 py-3 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {savingGuide ? "儲存中..." : "💾 儲存引導設定"}
              </button>
            </div>
          </div>
        )}

        {/* ── 測試對話 Tab ── */}
        {tab === "chat" && (
          <div className="bg-gray-900 rounded-xl flex flex-col" style={{ height: "580px" }}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold">💬 測試對話</h2>
              <button
                onClick={resetChat}
                className="text-xs text-gray-400 hover:text-white transition px-3 py-1 bg-gray-800 rounded-lg"
              >
                🔄 重置對話
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">傳送訊息開始測試 Bot 👇</p>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-gray-800 text-gray-100 rounded-bl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {/* Quick reply buttons (shown after welcome message, before user sends) */}
                  {showQuickReplies && quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {quickReplies.map((label, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(label)}
                          className="px-4 py-2 text-sm bg-gray-800 hover:bg-blue-700 border border-gray-700 hover:border-blue-500 rounded-full transition text-gray-300 hover:text-white"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 text-gray-400 px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
                    思考中...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={testChat} className="flex gap-2 px-4 py-4 border-t border-gray-800">
              <input
                type="text"
                placeholder="輸入訊息..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1 bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="submit"
                disabled={chatLoading || !question.trim()}
                className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-semibold transition disabled:opacity-50 text-sm"
              >
                送出
              </button>
            </form>
          </div>
        )}

        {/* ── 設定 Tab ── */}
        {tab === "settings" && (
          <div className="flex flex-col gap-6">
            {message && <div className="bg-green-900 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

            {/* 🔑 Gemini API Key */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">🔑 Gemini API Key</h2>
                {botSettings?.has_api_key && (
                  <span className="text-green-400 text-xs bg-green-900/40 border border-green-800 px-2 py-0.5 rounded-full">✅ 已設定</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-5">
                Bot 使用 Google Gemini 2.5 Flash 驅動，對話費用由你的 Google 帳號承擔。
              </p>

              {/* 取得 Key 的步驟說明 */}
              {!botSettings?.has_api_key && (
                <div className="bg-gray-800 rounded-xl p-4 mb-5">
                  <p className="text-sm font-medium text-gray-300 mb-3">📋 如何取得 Gemini API Key？</p>
                  <ol className="flex flex-col gap-2.5 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                      前往
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline transition">
                        Google AI Studio
                      </a>
                      （用 Google 帳號登入）
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                      點擊「<strong className="text-white">Create API key</strong>」
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                      選擇或建立一個 Google Cloud 專案
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">4</span>
                      複製 <code className="bg-gray-700 px-1 rounded text-green-400">AIzaSy...</code> 開頭的金鑰，貼到下方
                    </li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-3">💡 免費方案每天可發送大量訊息，一般使用不需付費。</p>
                </div>
              )}

              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <button
                  disabled={savingKey || !apiKey.trim()}
                  onClick={saveApiKey}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {savingKey ? "儲存中..." : "儲存"}
                </button>
              </div>
            </div>

            {/* 📊 Google Sheet */}
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-1">📊 Google Sheet 資料收集</h2>
              <p className="text-gray-400 text-sm mb-3">
                Bot 會主動向用戶收集這些欄位，並自動存到你的 Google Sheet。
              </p>

              <div className="bg-gray-800 rounded-lg p-4 mb-4 text-sm">
                <p className="text-gray-300 font-medium mb-2">📋 設定步驟：</p>
                <ol className="text-gray-400 flex flex-col gap-1 list-decimal list-inside">
                  <li>去 <a href="https://sheets.google.com" target="_blank" className="text-blue-400 underline">Google Sheets</a> 建立一個新的試算表</li>
                  <li>點右上角「共用」，將以下 Email 設為<strong className="text-white">編輯者</strong>：</li>
                </ol>
                <div className="mt-2 bg-gray-700 rounded px-3 py-2 font-mono text-xs text-green-400 flex items-center justify-between">
                  <span>bothelper-sheets@bothelper-489007.iam.gserviceaccount.com</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("bothelper-sheets@bothelper-489007.iam.gserviceaccount.com");
                      setMessage("✅ Email 已複製");
                      setTimeout(() => setMessage(""), 2000);
                    }}
                    className="text-gray-400 hover:text-white ml-3 text-xs shrink-0"
                  >
                    複製
                  </button>
                </div>
                <div className="mt-3">
                  <p className="text-gray-400">3. 開啟試算表，複製網址列中間那段 ID（如下圖）</p>
                  <div className="mt-2 bg-gray-700 rounded px-3 py-2 font-mono text-xs leading-relaxed">
                    <span className="text-gray-500">https://docs.google.com/spreadsheets/d/</span>
                    <span className="text-yellow-400 font-bold">1_jQr75dpxABCDEFGHIJKLMN</span>
                    <span className="text-gray-500">/edit</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">👆 黃色部分就是 ID，複製後貼到下方欄位</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1 block">Google Sheet ID</label>
                <input
                  type="text"
                  placeholder="1_jQr75dpx..."
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">要收集的欄位</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {collectFields.map((field, i) => (
                    <span key={i} className="flex items-center gap-1 bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-sm">
                      {field}
                      <button
                        onClick={() => setCollectFields((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-blue-300 hover:text-white ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {collectFields.length === 0 && <p className="text-gray-500 text-sm">尚未設定欄位</p>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="新增欄位（例如：姓名、電話、生日）"
                    value={newField}
                    onChange={(e) => setNewField(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newField.trim()) {
                        setCollectFields((prev) => [...prev, newField.trim()]);
                        setNewField("");
                      }
                    }}
                    className="flex-1 bg-gray-800 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (newField.trim()) {
                        setCollectFields((prev) => [...prev, newField.trim()]);
                        setNewField("");
                      }
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                  >
                    + 新增
                  </button>
                </div>
              </div>

              <button
                onClick={saveSheet}
                disabled={savingSheet}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingSheet ? "儲存中..." : "💾 儲存 Sheet 設定"}
              </button>
            </div>

            {/* 📅 預約系統 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">📅 預約系統</h2>
                {calendarId && (
                  <span className="text-green-400 text-xs bg-green-900/40 border border-green-800 px-2 py-0.5 rounded-full">✅ 已啟用</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-5">
                啟用後 Bot 可自動查詢空檔並在 Google Calendar 建立預約。
              </p>

              {/* 設定步驟說明 */}
              <div className="bg-gray-800 rounded-xl p-4 mb-5 text-sm">
                <p className="text-gray-300 font-medium mb-2">📋 設定步驟：</p>
                <ol className="text-gray-400 flex flex-col gap-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                    開啟 <a href="https://calendar.google.com" target="_blank" className="text-blue-400 underline">Google Calendar</a>，建立一個專用行事曆（例如「預約系統」）
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      點該行事曆旁的 ⋮ → 「設定及共用」→「與特定使用者或群組共用」<br/>
                      加入以下 Email，並設為<strong className="text-white">「更改事件」</strong>：
                      <div className="mt-1.5 bg-gray-700 rounded px-3 py-1.5 font-mono text-xs text-green-400 flex items-center justify-between">
                        <span>bothelper-sheets@bothelper-489007.iam.gserviceaccount.com</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText("bothelper-sheets@bothelper-489007.iam.gserviceaccount.com"); setMessage("✅ Email 已複製"); setTimeout(() => setMessage(""), 2000); }}
                          className="text-gray-400 hover:text-white ml-3 text-xs shrink-0"
                        >複製</button>
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div>
                      在「整合行事曆」區塊找到「行事曆 ID」，格式類似：
                      <div className="mt-1 bg-gray-700 rounded px-2 py-1 font-mono text-xs text-yellow-400">
                        abc123@group.calendar.google.com
                      </div>
                      複製後貼到下方欄位
                    </div>
                  </li>
                </ol>
              </div>

              {/* Calendar ID */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Google Calendar ID</label>
                <input
                  type="text"
                  placeholder="abc123@group.calendar.google.com（留空=關閉預約功能）"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              {/* 每次時長 */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">每次預約時長</label>
                <div className="flex gap-2 flex-wrap">
                  {[30, 60, 90, 120].map((min) => (
                    <button
                      key={min}
                      onClick={() => setSlotDuration(min)}
                      className={`px-4 py-2 rounded-lg text-sm transition ${
                        slotDuration === min
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      {min} 分鐘
                    </button>
                  ))}
                </div>
              </div>

              {/* 上班時間 */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">上班時間</label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={businessStart}
                    onChange={(e) => setBusinessStart(e.target.value)}
                    className="bg-gray-800 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-gray-500">～</span>
                  <input
                    type="time"
                    value={businessEnd}
                    onChange={(e) => setBusinessEnd(e.target.value)}
                    className="bg-gray-800 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* 上班日 */}
              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-2 block">上班日</label>
                <div className="flex gap-2">
                  {[["一",1],["二",2],["三",3],["四",4],["五",5],["六",6],["日",7]].map(([label, day]) => (
                    <button
                      key={day}
                      onClick={() => setWorkWeekdays((prev) =>
                        prev.includes(day as number)
                          ? prev.filter((d) => d !== day)
                          : [...prev, day as number].sort()
                      )}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                        workWeekdays.includes(day as number)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-500 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={saveCalendar}
                disabled={savingCalendar}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingCalendar ? "儲存中..." : "💾 儲存預約設定"}
              </button>
            </div>

            {/* ⚡ 關鍵字觸發 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">⚡ 關鍵字觸發</h2>
                {keywordTriggers.length > 0 && (
                  <span className="text-yellow-400 text-xs bg-yellow-900/30 border border-yellow-800 px-2 py-0.5 rounded-full">{keywordTriggers.length} 筆</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-5">
                輸入特定關鍵字時，直接回覆固定答案，<strong className="text-white">不消耗 AI token</strong>，速度更快。
              </p>

              {/* 已設定列表 */}
              <div className="flex flex-col gap-2 mb-4">
                {keywordTriggers.length === 0 && (
                  <p className="text-gray-500 text-sm">尚未設定關鍵字</p>
                )}
                {keywordTriggers.map((kt, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-800 rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-yellow-400 mb-0.5">🔑 {kt.keyword}</div>
                      <div className="text-sm text-gray-300 truncate">↩ {kt.reply}</div>
                    </div>
                    <button
                      onClick={() => setKeywordTriggers((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-500 hover:text-red-400 transition text-lg leading-none shrink-0"
                    >×</button>
                  </div>
                ))}
              </div>

              {/* 新增表單 */}
              <div className="flex flex-col gap-2 mb-4">
                <input
                  type="text"
                  placeholder="關鍵字（例如：退款、營業時間）"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="w-full bg-gray-800 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
                <textarea
                  placeholder="固定回覆內容..."
                  value={newKeywordReply}
                  onChange={(e) => setNewKeywordReply(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-800 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm resize-none"
                />
                <button
                  onClick={() => {
                    if (newKeyword.trim() && newKeywordReply.trim()) {
                      setKeywordTriggers((prev) => [...prev, { keyword: newKeyword.trim(), reply: newKeywordReply.trim() }]);
                      setNewKeyword("");
                      setNewKeywordReply("");
                    }
                  }}
                  disabled={!newKeyword.trim() || !newKeywordReply.trim()}
                  className="bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition disabled:opacity-40"
                >
                  + 新增關鍵字
                </button>
              </div>

              <button
                onClick={saveKeywordTriggers}
                disabled={savingKeywords}
                className="w-full bg-yellow-600 hover:bg-yellow-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingKeywords ? "儲存中..." : "💾 儲存關鍵字設定"}
              </button>
            </div>

          </div>
        )}

        {/* ── 嵌入代碼 Tab ── */}
        {tab === "embed" && (
          <div className="flex flex-col gap-6">
            {message && <div className="bg-green-900 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

            {/* 網站嵌入 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-2">🌐 網站嵌入代碼</h2>
              <p className="text-gray-400 text-sm mb-4">貼到你網站的 &lt;/body&gt; 前</p>
              <pre className="bg-gray-800 rounded-lg p-4 text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">
                {embedCode}
              </pre>
            </div>

            {/* LINE Bot 串接 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">📱 LINE Bot 串接</h2>
                {lineConfigured && (
                  <span className="text-green-400 text-xs bg-green-900/40 border border-green-800 px-2 py-0.5 rounded-full">✅ 已設定</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-5">將 Bot 連接到你的 LINE 官方帳號。</p>

              {/* 步驟說明 */}
              <div className="bg-gray-800 rounded-xl p-4 mb-5">
                <p className="text-sm font-medium text-gray-300 mb-3">📋 設定步驟</p>
                <ol className="flex flex-col gap-3 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>前往 <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline transition">LINE Developers Console</a> → 選擇你的 Messaging API Channel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>「Basic settings」→「Channel secret」複製後貼到下方</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span>「Messaging API」→「Channel access token」點「Issue」後複製貼到下方</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <span>儲存後，將下方 Webhook URL 貼到「Messaging API」→「Webhook URL」，並開啟「Use webhook」</span>
                  </li>
                </ol>
              </div>

              {/* Channel Secret */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Channel Secret</label>
                <input
                  type="password"
                  placeholder={lineConfigured ? "（已設定，重新輸入以更新）" : "貼上 Channel secret..."}
                  value={lineSecret}
                  onChange={(e) => setLineSecret(e.target.value)}
                  className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              {/* Channel Access Token */}
              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-1.5 block">Channel Access Token</label>
                <input
                  type="password"
                  placeholder={lineConfigured ? "（已設定，重新輸入以更新）" : "貼上 Channel access token..."}
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <button
                onClick={saveLineConfig}
                disabled={savingLine || (!lineSecret.trim() && !lineToken.trim())}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition disabled:opacity-50 mb-5"
              >
                {savingLine ? "儲存中..." : "💾 儲存 LINE 設定"}
              </button>

              {/* Webhook URL */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Webhook URL（儲存後貼到 LINE 後台）</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-3 rounded-lg text-green-400 text-xs font-mono overflow-x-auto">
                    {`https://api.landehui.online/line/webhook/${id}`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://api.landehui.online/line/webhook/${id}`);
                      setMessage("✅ Webhook URL 已複製");
                      setTimeout(() => setMessage(""), 2000);
                    }}
                    className="shrink-0 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                  >
                    複製
                  </button>
                </div>
              </div>
            </div>

            {/* 📸 Instagram DM 串接 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">📸 Instagram DM 串接</h2>
                {instagramConfigured && (
                  <span className="text-green-400 text-xs bg-green-900/40 border border-green-800 px-2 py-0.5 rounded-full">✅ 已設定</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-5">將 Bot 連接到你的 Instagram 商業帳號，自動回覆 DM。</p>

              {/* 設定步驟 */}
              <div className="bg-gray-800 rounded-xl p-4 mb-5">
                <p className="text-sm font-medium text-gray-300 mb-3">📋 設定步驟</p>
                <ol className="flex flex-col gap-3 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>前往 <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 underline">Meta for Developers</a> → 建立 App → 選「Business」類型</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>App 中加入「Instagram」產品，連結你的 Instagram 商業帳號（需先連接 Facebook Page）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span>「Tools」→「Graph API Explorer」→ 取得 <strong className="text-white">Page Access Token</strong>（需有 instagram_manage_messages 權限）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <span>設定 Webhook：填入下方的 Webhook URL 和 Verify Token，訂閱 <strong className="text-white">messages</strong> 欄位</span>
                  </li>
                </ol>
              </div>

              {/* Webhook URL */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Webhook URL</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-2.5 rounded-lg text-pink-400 text-xs font-mono overflow-x-auto">
                    {`https://api.landehui.online/instagram/webhook/${id}`}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://api.landehui.online/instagram/webhook/${id}`); setMessage("✅ 已複製"); setTimeout(() => setMessage(""), 2000); }}
                    className="shrink-0 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                  >複製</button>
                </div>
              </div>

              {/* Verify Token */}
              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-1.5 block">Verify Token（填到 Meta Webhook 設定）</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-2.5 rounded-lg text-pink-400 text-xs font-mono overflow-x-auto">
                    {id}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(id as string); setMessage("✅ 已複製"); setTimeout(() => setMessage(""), 2000); }}
                    className="shrink-0 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                  >複製</button>
                </div>
                <p className="text-gray-600 text-xs mt-1.5">在 Meta 的 Webhook 設定頁，把這串 Token 貼到「Verify Token」欄位</p>
              </div>

              {/* Page Access Token */}
              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-1.5 block">Page Access Token</label>
                <input
                  type="password"
                  placeholder={instagramConfigured ? "（已設定，重新輸入以更新）" : "貼上 Page Access Token..."}
                  value={instagramPageToken}
                  onChange={(e) => setInstagramPageToken(e.target.value)}
                  className="w-full bg-gray-800 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 font-mono text-sm"
                />
              </div>

              <button
                onClick={saveInstagram}
                disabled={savingInstagram || !instagramPageToken.trim()}
                className="w-full bg-pink-600 hover:bg-pink-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingInstagram ? "儲存中..." : "💾 儲存 Instagram 設定"}
              </button>
            </div>

          </div>
        )}
        {/* ── 數據 Tab ── */}
        {tab === "analytics" && (
          <div className="flex flex-col gap-6">
            {analyticsLoading ? (
              <div className="text-center text-gray-500 py-20">載入中...</div>
            ) : analyticsData ? (
              <>
                {/* 統計卡片列 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-xl p-5 text-center">
                    <div className="text-3xl font-bold text-blue-400">{analyticsData.total}</div>
                    <div className="text-gray-400 text-sm mt-1">總對話數</div>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-5 text-center">
                    <div className="text-3xl font-bold text-green-400">{analyticsData.today}</div>
                    <div className="text-gray-400 text-sm mt-1">今日</div>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-5 text-center">
                    <div className="text-3xl font-bold text-yellow-400">{analyticsData.this_week}</div>
                    <div className="text-gray-400 text-sm mt-1">本週</div>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-5 text-center">
                    <div className={`text-3xl font-bold ${analyticsData.week_growth >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {analyticsData.week_growth >= 0 ? "↑" : "↓"}{Math.abs(analyticsData.week_growth)}%
                    </div>
                    <div className="text-gray-400 text-sm mt-1">週成長率</div>
                    <div className="text-gray-600 text-xs mt-0.5">上週 {analyticsData.prev_week} 則</div>
                  </div>
                </div>

                {/* 7 天趨勢圖 */}
                <div className="bg-gray-900 rounded-xl p-6">
                  <h2 className="font-semibold mb-5">📈 最近 7 天對話量</h2>
                  {(() => {
                    const max = Math.max(...analyticsData.daily_counts.map((d) => d.count), 1);
                    return (
                      <div className="flex items-end gap-2 h-32">
                        {analyticsData.daily_counts.map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">{d.count > 0 ? d.count : ""}</span>
                            <div
                              className="w-full rounded-t-sm bg-blue-600 transition-all"
                              style={{ height: `${Math.max((d.count / max) * 96, d.count > 0 ? 4 : 2)}px`, opacity: d.count > 0 ? 1 : 0.2 }}
                            />
                            <span className="text-xs text-gray-500">{d.date.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* ⏰ 峰值時段 */}
                <div className="bg-gray-900 rounded-xl p-6">
                  <h2 className="font-semibold mb-2">⏰ 峰值時段</h2>
                  <p className="text-gray-500 text-xs mb-5">最近 7 天各時段對話量（台灣時間）</p>
                  {(() => {
                    const max = Math.max(...analyticsData.hourly_distribution.map((h) => h.count), 1);
                    const peakHour = analyticsData.hourly_distribution.reduce((a, b) => a.count >= b.count ? a : b);
                    return (
                      <>
                        {peakHour.count > 0 && (
                          <div className="text-sm text-yellow-400 mb-4">
                            🔥 尖峰時段：{peakHour.hour}:00 – {peakHour.hour + 1}:00（{peakHour.count} 則）
                          </div>
                        )}
                        <div className="flex items-end gap-0.5 h-16">
                          {analyticsData.hourly_distribution.map((h) => (
                            <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                              <div
                                className={`w-full rounded-t-sm transition-all ${h.count === peakHour.count && h.count > 0 ? "bg-yellow-500" : "bg-blue-800"}`}
                                style={{ height: `${Math.max((h.count / max) * 52, h.count > 0 ? 3 : 1)}px`, opacity: h.count > 0 ? 1 : 0.3 }}
                              />
                              {h.hour % 6 === 0 && (
                                <span className="text-xs text-gray-600">{h.hour}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1 px-0.5">
                          <span>0時</span><span>6時</span><span>12時</span><span>18時</span><span>23時</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 🔥 熱門問題排行 */}
                <div className="bg-gray-900 rounded-xl p-6">
                  <h2 className="font-semibold mb-1">🔥 熱門問題 TOP 10</h2>
                  <p className="text-gray-500 text-xs mb-4">最常被問的問題，考慮加入關鍵字觸發或 FAQ</p>
                  {analyticsData.top_questions.length === 0 ? (
                    <p className="text-gray-500 text-sm">還沒有對話記錄</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {analyticsData.top_questions.map((q, i) => (
                        <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
                          <span className={`text-sm font-bold shrink-0 w-5 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-gray-600"}`}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-300 flex-1 line-clamp-2">{q.question}</span>
                          <span className={`text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full ${q.count >= 3 ? "bg-red-900/50 text-red-400" : "bg-gray-700 text-gray-400"}`}>
                            ×{q.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 💬 最近問題 */}
                <div className="bg-gray-900 rounded-xl p-6">
                  <h2 className="font-semibold mb-4">💬 最近對話</h2>
                  {analyticsData.recent_questions.length === 0 ? (
                    <p className="text-gray-500 text-sm">還沒有對話記錄</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {analyticsData.recent_questions.map((q, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-800 rounded-lg px-4 py-3">
                          <span className="text-gray-600 text-sm shrink-0">{i + 1}.</span>
                          <span className="text-sm text-gray-300">{q}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={fetchAnalytics}
                  className="w-full bg-gray-800 hover:bg-gray-700 py-3 rounded-lg text-sm text-gray-400 transition"
                >
                  🔄 重新載入
                </button>
              </>
            ) : (
              <div className="text-center text-gray-500 py-20">載入失敗，請重試</div>
            )}
          </div>
        )}

        {/* ── AI 助手 Tab ── */}
        {tab === "assistant" && (
          <div className="flex flex-col gap-4">
            {/* 說明卡 */}
            <div className="bg-purple-900/20 border border-purple-800/40 rounded-xl px-4 py-3">
              <p className="text-sm text-purple-300 leading-relaxed">
                ✨ <strong>設定助手「小懶」</strong> 使用 AI 幫你直接操作 Bot 設定。告訴它你的需求，它會幫你寫角色描述、設定收集欄位、更新歡迎訊息等。
              </p>
              <p className="text-xs text-purple-400/70 mt-1.5">
                ⚠️ 需先設定 Gemini API Key（設定頁面）才能使用。設定變更會即時套用。
              </p>
            </div>

            {/* 快速啟動建議 */}
            {assistantMsgs.length <= 1 && (
              <div className="flex flex-wrap gap-2">
                {[
                  "幫我設定角色描述",
                  "設定要收集的客戶資料",
                  "幫我寫歡迎訊息",
                  "查看目前設定",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendAssistantMsg(suggestion)}
                    className="px-3 py-1.5 text-xs bg-purple-900/40 border border-purple-800/50 hover:bg-purple-800/50 text-purple-300 rounded-full transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* 聊天介面 */}
            <div className="bg-gray-900 rounded-xl flex flex-col" style={{ height: "540px" }}>
              <div className="flex justify-between items-center px-5 py-4 border-b border-gray-800">
                <div>
                  <h2 className="font-semibold">✨ AI 設定助手</h2>
                  <p className="text-xs text-gray-500 mt-0.5">對話完成後，設定會即時套用到你的 Bot</p>
                </div>
                <button
                  onClick={() => {
                    setAssistantMsgs([
                      { role: "assistant", content: "👋 你好！我是設定助手「小懶」。\n\n告訴我你想要什麼樣的機器人，我來幫你設定！" }
                    ]);
                    assistantSessionId.current = `assistant_${id}_${Date.now()}`;
                  }}
                  className="text-xs text-gray-400 hover:text-white transition px-3 py-1 bg-gray-800 rounded-lg"
                >
                  🔄 重置對話
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {assistantMsgs.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-purple-900/40 border border-purple-800/40 text-gray-100 rounded-bl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {assistantLoading && (
                  <div className="flex justify-start">
                    <div className="bg-purple-900/40 border border-purple-800/40 text-purple-300 px-4 py-3 rounded-2xl rounded-bl-sm text-sm flex items-center gap-2">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                    </div>
                  </div>
                )}
                <div ref={assistantBottomRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); sendAssistantMsg(assistantInput); }}
                className="flex gap-2 px-4 py-4 border-t border-gray-800"
              >
                <input
                  type="text"
                  placeholder="例：幫我設定一個賣保險的機器人，要收集姓名和電話..."
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  className="flex-1 bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={assistantLoading || !assistantInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700 px-5 py-3 rounded-xl font-semibold transition disabled:opacity-50 text-sm"
                >
                  送出
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
