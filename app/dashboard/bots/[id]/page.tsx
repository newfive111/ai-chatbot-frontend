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
  debounce_seconds?: number;
  instagram_account_id?: string;
  facebook_page_id?: string;
}

const API = "/api/proxy";

// 極簡 markdown 渲染（## / ### / - / **bold**）
function renderReport(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return <h3 key={i} className="text-base font-bold text-white mt-5 mb-2 first:mt-0">{line.replace("## ", "")}</h3>;
    }
    if (line.startsWith("### ")) {
      return <h4 key={i} className="text-sm font-semibold text-gray-300 mt-3 mb-1">{line.replace("### ", "")}</h4>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong>
        : p
    );
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return <div key={i} className="flex gap-2 mb-1"><span className="text-purple-400 shrink-0">•</span><span>{rendered}</span></div>;
    }
    if (line.trim() === "" || line === "---") {
      return <div key={i} className="h-2" />;
    }
    return <p key={i} className="mb-1">{rendered}</p>;
  });
}

// 時間 helper：解析 "HH:MM" 字串 ↔ 小時/分鐘
const parseTime = (t: string) => {
  const [h = "0", m = "0"] = (t || "00:00").split(":");
  return { h: parseInt(h, 10), m: parseInt(m, 10) };
};
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

// 24 小時制時間選擇器（取代原生 input[type=time]）
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { h, m } = parseTime(value);
  const selClass = "bg-gray-800 px-2 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer";
  return (
    <div className="flex items-center gap-1">
      <select value={h} onChange={(e) => onChange(fmtTime(parseInt(e.target.value), m))} className={selClass}>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
        ))}
      </select>
      <span className="text-gray-500 font-bold">:</span>
      <select value={m} onChange={(e) => onChange(fmtTime(h, parseInt(e.target.value)))} className={selClass}>
        {[0, 15, 30, 45].map((min) => (
          <option key={min} value={min}>{String(min).padStart(2, "0")}</option>
        ))}
      </select>
    </div>
  );
}

const PROMPT_PRESETS = [
  { key: "customer_service", label: "👩‍💼 親切客服", desc: "耐心解答、親切有禮", prompt: "你是「{bot_name}」的客服人員，負責解答客戶問題、處理服務需求，保持親切耐心的態度。" },
  { key: "sales",            label: "💼 積極業務",  desc: "介紹產品、促成合作", prompt: "你是「{bot_name}」的業務專員，負責介紹產品優勢、了解客戶需求、促成合作，使用積極但不強迫的業務話術。" },
  { key: "tech_support",    label: "🔧 技術支援",  desc: "解決技術問題、清楚說明", prompt: "你是「{bot_name}」的技術支援工程師，負責協助客戶解決技術問題，說明要清楚易懂。" },
  { key: "consultant",      label: "🎯 專業顧問",  desc: "提供建議、輔助決策", prompt: "你是「{bot_name}」的諮詢顧問，負責提供專業建議，幫助客戶做出最適合的決策。" },
];

// 簡單模式：結構化角色填空
const PERSONA_ROLES = [
  { key: "customer_service", label: "客服人員" },
  { key: "sales",            label: "業務專員" },
  { key: "booking",          label: "預約助理" },
  { key: "consultant",       label: "諮詢顧問" },
  { key: "general",          label: "一般助理" },
];
const PERSONA_TONES = ["親切", "專業", "簡潔", "熱情活潑", "正式禮貌", "幽默輕鬆"];

interface PersonaForm {
  business: string;
  role: string;
  tones: string[];
  highlights: string;
  taboos: string;
}

// 把填空表單組成 system_prompt（平台規則後端會自動補，不用寫）
function buildPersonaPrompt(form: PersonaForm, botName: string): string {
  const roleLabel = PERSONA_ROLES.find((r) => r.key === form.role)?.label || "客服人員";
  const name = botName || "Bot";
  const lines: string[] = [`你是「${name}」的${roleLabel}。`];
  if (form.business.trim())   lines.push(`【關於我們】\n${form.business.trim()}`);
  if (form.tones.length)      lines.push(`【說話語氣】${form.tones.join("、")}，用繁體中文自然回覆。`);
  if (form.highlights.trim()) lines.push(`【一定要讓客戶知道的重點】\n${form.highlights.trim()}`);
  if (form.taboos.trim())     lines.push(`【絕對不要做的事】\n${form.taboos.trim()}`);
  return lines.join("\n\n");
}

export default function BotDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const assistantScrollRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"knowledge" | "persona" | "chat" | "embed" | "settings" | "analytics">("knowledge");

  // AI 助手 floating widget
  const [assistantOpen, setAssistantOpen] = useState(false);

  // 關鍵字觸發
  const [keywordTriggers, setKeywordTriggers] = useState<{ keyword: string; reply: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordReply, setNewKeywordReply] = useState("");
  const [savingKeywords, setSavingKeywords] = useState(false);

  // Analytics
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiStats, setAiStats] = useState<{ total_sessions: number; completed_sessions: number; completion_rate: number; total_messages: number } | null>(null);
  const [analysisDays, setAnalysisDays] = useState(30);
  const [styleReport, setStyleReport] = useState<string | null>(null);
  const [styleReportLoading, setStyleReportLoading] = useState(false);
  const [styleStats, setStyleStats] = useState<{ total_sessions: number; human_reply_count: number; total_messages: number } | null>(null);
  const [cleaningFortune, setCleaningFortune] = useState(false);
  // 查看對話紀錄
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsData, setLogsData] = useState<{
    total_sessions: number;
    total_messages: number;
    sessions: {
      session_id: string;
      channel: string;
      message_count: number;
      first_at: string;
      last_at: string;
      completed: boolean;
      can_mute?: boolean;
      muted?: boolean;
      display_name?: string;
      messages: { q: string; a: string; at: string }[];
    }[];
  } | null>(null);
  const [expandedSid, setExpandedSid] = useState<string | null>(null);
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
  const [myRole, setMyRole] = useState<string>("owner");
  const isViewer = myRole === "viewer";
  const [editingName, setEditingName] = useState(false);
  const [botName, setBotName] = useState("");
  const [savingName, setSavingName] = useState(false);
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
  const [debounceSeconds, setDebounceSeconds] = useState(15);
  const [savingDebounce, setSavingDebounce] = useState(false);
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

  // 下班時間自動回應
  const [offHoursMessage, setOffHoursMessage] = useState("");
  const [savingOffHours, setSavingOffHours] = useState(false);

  // 角色 tab state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  // 簡單填空模式
  const [personaMode, setPersonaMode] = useState<"simple" | "advanced">("simple");
  const [pBusiness, setPBusiness] = useState("");
  const [pRole, setPRole] = useState("customer_service");
  const [pTones, setPTones] = useState<string[]>(["親切"]);
  const [pHighlights, setPHighlights] = useState("");
  const [pTaboos, setPTaboos] = useState("");
  const [pGenDesc, setPGenDesc] = useState("");
  const [pGenLoading, setPGenLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [newQuickReply, setNewQuickReply] = useState("");
  const [savingGuide, setSavingGuide] = useState(false);

  // 歷史紀錄
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API}/bots/${id}/settings-history`, { headers });
      setHistoryList(res.data);
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  };

  const restoreSnapshot = async (snapshotId: string) => {
    if (!confirm("確定要還原到這個版本？目前的設定會被覆蓋（還原前會自動備份）。")) return;
    setRestoringId(snapshotId);
    try {
      await axios.post(`${API}/bots/${id}/settings-history/${snapshotId}/restore`, {}, { headers });
      setHistoryOpen(false);
      await fetchBotSettings();
      setMessage("✅ 已還原到指定版本");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      alert("還原失敗，請稍後再試");
    } finally {
      setRestoringId(null);
    }
  };

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
      setMyRole(data.my_role || "owner");
      setBotName(data.name || "");
      setSheetId(data.sheet_id || "");
      setCollectFields(data.collect_fields || []);
      setSystemPrompt(data.system_prompt || "");
      const pf = data.persona_form;
      if (pf && typeof pf === "object") {
        setPBusiness(pf.business || "");
        setPRole(pf.role || "customer_service");
        setPTones(Array.isArray(pf.tones) && pf.tones.length ? pf.tones : ["親切"]);
        setPHighlights(pf.highlights || "");
        setPTaboos(pf.taboos || "");
        setPersonaMode("simple");
      } else {
        // 沒有填空紀錄：有舊的自訂 prompt → 進階；全新 → 簡單
        setPersonaMode(data.system_prompt ? "advanced" : "simple");
      }
      setWelcomeMessage(data.welcome_message || "");
      setQuickReplies((data.quick_replies || []).map((q: any) => q.label || q));
      setLineConfigured(!!(data.line_channel_secret && data.line_channel_access_token));
      setCalendarId(data.calendar_id || "");
      setSlotDuration(data.slot_duration_minutes || 60);
      setBusinessStart(data.business_hours?.start || "09:00");
      setBusinessEnd(data.business_hours?.end || "18:00");
      setWorkWeekdays(data.business_hours?.weekdays || [1,2,3,4,5]);
      setKeywordTriggers(data.keyword_triggers || []);
      setOffHoursMessage(data.off_hours_message || "");
      setDebounceSeconds(data.debounce_seconds ?? 15);
      setInstagramConfigured(!!data.instagram_page_token);
    } catch (err: any) {
      console.error("[BotDetail] 載入 Bot 設定失敗", err?.response?.status, err?.message);
      setMessage("⚠️ 載入設定失敗，請重新整理頁面");
    }
  };

  // ── 初始化 ──
  useEffect(() => {
    if (!id) return;
    if (!token) { router.push("/login"); return; }
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
  const scrollChatToBottom = () => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  };
  const scrollAssistantToBottom = () => {
    if (assistantScrollRef.current) assistantScrollRef.current.scrollTop = assistantScrollRef.current.scrollHeight;
  };

  useEffect(() => { scrollChatToBottom(); }, [chatMessages]);
  useEffect(() => { scrollAssistantToBottom(); }, [assistantMsgs]);

  // ── 切換回 chat tab 時捲到底部 ──
  useEffect(() => {
    if (tab === "chat") setTimeout(scrollChatToBottom, 50);
  }, [tab]);

  // ── AI 助手 widget 開啟時捲到底部 ──
  useEffect(() => {
    if (assistantOpen) setTimeout(scrollAssistantToBottom, 100);
  }, [assistantOpen]);

  // ── 知識庫 ──
  const fetchChunks = async () => {
    setLoadingChunks(true);
    const res = await axios.get(`${API}/bots/${id}/knowledge`, { headers });
    setChunks(res.data);
    setLoadingChunks(false);
  };

  useEffect(() => {
    if (tab === "knowledge") fetchChunks();
  }, [tab]);

  // ── 未儲存變更警告 ──
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
    try {
      await axios.post(`${API}/bots/${id}/faq`, { content: faqText }, { headers });
      setFaqText("");
      setMessage("✅ FAQ 已加入知識庫");
      await fetchChunks();
      setBotSettings((prev) => prev ? { ...prev } : prev);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "加入失敗，請稍後再試";
      setMessage(`❌ ${detail}`);
    } finally {
      setUploading(false);
      setTimeout(() => setMessage(""), 4000);
    }
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

  // ── AI 助手：從回覆裡抓 code block（system prompt 提案）──
  const extractCodeBlock = (text: string): string | null => {
    const match = text.match(/```[^\n]*\n?([\s\S]+?)```/);
    const content = match ? match[1].trim() : null;
    return content && content.length > 80 ? content : null;
  };

  const [applyingPrompt, setApplyingPrompt] = useState(false);

  const applyProposedPrompt = async (proposed: string) => {
    if (!confirm("確定要套用此角色設定？")) return;
    setApplyingPrompt(true);
    try {
      await axios.patch(`${API}/bots/${id}`, { system_prompt: proposed }, { headers });
      setSystemPrompt(proposed);
      setAssistantMsgs((prev) => [...prev,
        { role: "assistant", content: "✅ 角色設定已套用！建議到「測試對話」確認效果。" }
      ]);
      fetchBotSettings();
    } catch {
      alert("套用失敗，請稍後再試");
    } finally {
      setApplyingPrompt(false);
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
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "未知錯誤";
      const isApiKeyErr = detail.includes("API") || detail.includes("api") || err?.response?.status === 401;
      setAssistantMsgs((prev) => [
        ...prev,
        { role: "assistant", content: isApiKeyErr
            ? "⚠️ 發生錯誤，請確認 Gemini API Key 已在「設定」頁面填入。"
            : `⚠️ 發生錯誤：${detail}，請稍後再試。` }
      ]);
    }
    setAssistantLoading(false);
  };

  // ── Settings：儲存 API Key ──
  const saveApiKey = async () => {
    setSavingKey(true);
    try {
      await axios.patch(`${API}/bots/${id}`, { anthropic_api_key: apiKey }, { headers });
      setBotSettings((prev) => prev ? { ...prev, has_api_key: true } : prev);
      setMessage("✅ API Key 已儲存");
      setApiKey("");
      setIsDirty(false);
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗，請稍後再試"}`);
    } finally {
      setSavingKey(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── 角色 tab：儲存 System Prompt ──
  const savePrompt = async () => {
    setSavingPrompt(true);
    try {
      let payload: any;
      if (personaMode === "simple") {
        const form: PersonaForm = {
          business: pBusiness, role: pRole, tones: pTones,
          highlights: pHighlights, taboos: pTaboos,
        };
        payload = { system_prompt: buildPersonaPrompt(form, botName), persona_form: form };
      } else {
        payload = { system_prompt: systemPrompt };
      }
      await axios.patch(`${API}/bots/${id}`, payload, { headers });
      setMessage("✅ 角色設定已儲存");
      setIsDirty(false);
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗，請稍後再試"}`);
    } finally {
      setSavingPrompt(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // 方案 2：一句話 → AI 幫忙填好結構化表單
  const generatePersona = async () => {
    if (!pGenDesc.trim() || !id) return;
    setPGenLoading(true);
    try {
      const res = await axios.post(`${API}/bots/${id}/generate-persona`, { description: pGenDesc }, { headers });
      const d = res.data;
      setPBusiness(d.business || "");
      setPRole(d.role || "customer_service");
      setPTones(Array.isArray(d.tones) && d.tones.length ? d.tones : ["親切"]);
      setPHighlights(d.highlights || "");
      setPTaboos(d.taboos || "");
      setPersonaMode("simple");
      setIsDirty(true);
      setMessage("✅ 已幫你填好，確認內容後按「儲存角色設定」");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "生成失敗，請稍後再試"}`);
    } finally {
      setPGenLoading(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  // 把現有 system_prompt 反向拆成簡單填空（給老 bot）
  const extractPersona = async () => {
    if (!id) return;
    setPGenLoading(true);
    try {
      const res = await axios.post(`${API}/bots/${id}/extract-persona`, {}, { headers });
      const d = res.data;
      setPBusiness(d.business || "");
      setPRole(d.role || "customer_service");
      setPTones(Array.isArray(d.tones) && d.tones.length ? d.tones : ["親切"]);
      setPHighlights(d.highlights || "");
      setPTaboos(d.taboos || "");
      setPersonaMode("simple");
      setIsDirty(true);
      setMessage("✅ 已轉成簡單填空，確認內容後按「儲存角色設定」");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "轉換失敗，請稍後再試"}`);
    } finally {
      setPGenLoading(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  // ── 角色 tab：儲存引導設定 ──
  const saveGuide = async () => {
    setSavingGuide(true);
    try {
      await axios.patch(`${API}/bots/${id}`, {
        welcome_message: welcomeMessage,
        quick_replies: quickReplies.map((label) => ({ label })),
      }, { headers });
      setBotSettings((prev) => prev ? { ...prev, welcome_message: welcomeMessage } : prev);
      setMessage("✅ 引導設定已儲存");
      setIsDirty(false);
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗，請稍後再試"}`);
    } finally {
      setSavingGuide(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── Settings：儲存預約系統 ──
  const saveCalendar = async () => {
    setSavingCalendar(true);
    try {
      await axios.patch(`${API}/bots/${id}`, {
        calendar_id: calendarId || null,
        slot_duration_minutes: slotDuration,
        business_hours: { start: businessStart, end: businessEnd, weekdays: workWeekdays },
      }, { headers });
      setMessage("✅ 預約系統設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗，請稍後再試"}`);
    } finally {
      setSavingCalendar(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── 儲存 Bot 名稱 ──
  const saveBotName = async () => {
    if (!botName.trim()) return;
    setSavingName(true);
    try {
      await axios.patch(`${API}/bots/${id}`, { name: botName.trim() }, { headers });
      setBotSettings((prev) => prev ? { ...prev, name: botName.trim() } : prev);
      setEditingName(false);
      setMessage("✅ Bot 名稱已更新");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingName(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── Settings：儲存 LINE 憑證 ──
  const saveLineConfig = async () => {
    setSavingLine(true);
    try {
      await axios.patch(`${API}/bots/${id}`, {
        line_channel_secret: lineSecret,
        line_channel_access_token: lineToken,
      }, { headers });
      setLineConfigured(true);
      setLineSecret("");
      setLineToken("");
      setMessage("✅ LINE 設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingLine(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── Settings：儲存防抖秒數 ──
  const saveDebounce = async () => {
    setSavingDebounce(true);
    try {
      await axios.patch(`${API}/bots/${id}`, { debounce_seconds: debounceSeconds }, { headers });
      setMessage("✅ 防抖設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingDebounce(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const saveOffHours = async () => {
    setSavingOffHours(true);
    try {
      await axios.patch(`${API}/bots/${id}`, {
        off_hours_message: offHoursMessage,
        business_hours: { start: businessStart, end: businessEnd, weekdays: workWeekdays },
      }, { headers });
      setMessage("✅ 下班時間設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingOffHours(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── Analytics：AI 分析 ──
  const fetchAiReport = async () => {
    if (!id) return;
    setAiReportLoading(true);
    setAiReport(null);
    setAiStats(null);
    try {
      const res = await axios.post(`${API}/bots/${id}/ai-analysis`, { days: analysisDays }, { headers });
      setAiReport(res.data.report);
      setAiStats(res.data.stats ?? null);
    } catch (err: any) {
      setAiReport(`❌ ${err?.response?.data?.detail || "分析失敗，請稍後再試"}`);
    }
    setAiReportLoading(false);
  };

  const fetchStyleReport = async () => {
    if (!id) return;
    setStyleReportLoading(true);
    setStyleReport(null);
    setStyleStats(null);
    try {
      const res = await axios.post(`${API}/bots/${id}/style-analysis`, { days: analysisDays }, { headers });
      setStyleReport(res.data.report);
      setStyleStats(res.data.stats ?? null);
    } catch (err: any) {
      setStyleReport(`❌ ${err?.response?.data?.detail || "分析失敗，請稍後再試"}`);
    }
    setStyleReportLoading(false);
  };

  const cleanFortune = async () => {
    if (!id) return;
    if (!confirm("確定要永久刪除這個 Bot 的全部對話記錄嗎？此操作無法復原。")) return;
    setCleaningFortune(true);
    try {
      const res = await axios.delete(`${API}/bots/${id}/conversations/all`, { headers });
      alert(`✅ 已刪除 ${res.data.deleted} 筆對話記錄`);
    } catch (err: any) {
      alert(`❌ ${err?.response?.data?.detail || "刪除失敗"}`);
    }
    setCleaningFortune(false);
  };

  // ── 查看對話紀錄 ──
  const fetchLogs = async () => {
    if (!id) return;
    setLogsOpen(true);
    setLogsLoading(true);
    setLogsData(null);
    setExpandedSid(null);
    try {
      const res = await axios.get(`${API}/bots/${id}/conversations/sessions`, {
        params: { days: analysisDays },
        headers,
      });
      setLogsData(res.data);
    } catch (err: any) {
      alert(`❌ ${err?.response?.data?.detail || "讀取失敗"}`);
      setLogsOpen(false);
    }
    setLogsLoading(false);
  };

  // ── 真人接手 / 恢復 AI（靜音切換）──
  const [mutingSid, setMutingSid] = useState<string | null>(null);
  const toggleMute = async (sessionId: string, currentlyMuted: boolean) => {
    if (!id) return;
    setMutingSid(sessionId);
    try {
      if (currentlyMuted) {
        await axios.delete(`${API}/bots/${id}/mute`, { params: { session_id: sessionId }, headers });
      } else {
        await axios.post(`${API}/bots/${id}/mute`, { session_id: sessionId }, { headers });
      }
      setLogsData((prev) => prev && {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.session_id === sessionId ? { ...s, muted: !currentlyMuted } : s
        ),
      });
    } catch (err: any) {
      alert(`❌ ${err?.response?.data?.detail || "操作失敗"}`);
    }
    setMutingSid(null);
  };

  // ── 把分析報告帶入 AI 助手討論改善建議 ──
  const discussWithAssistant = async () => {
    if (!aiReport || !id) return;
    setAssistantOpen(true);
    // 開新 session，避免被舊上下文干擾
    assistantSessionId.current = `assistant_${id}_${Date.now()}`;
    const fullMsg = `這是剛產生的 Bot 對話分析報告，請仔細閱讀：\n\n---\n${aiReport}\n---\n\n請根據報告裡的「改善建議」幫我優化 Bot 設定（可用工具修改 system_prompt、collect_fields、welcome_message、quick_replies、keyword_triggers 等）。\n\n請先簡短列出你建議優先改的 2-3 項（標號 1./2./3.）並說明原因，等我同意再用工具實際修改。`;
    const displayMsg = "📋 已載入剛剛的 AI 分析報告，請依「改善建議」協助我優化 Bot 設定";
    setAssistantMsgs([{ role: "user", content: displayMsg }]);
    setAssistantLoading(true);
    try {
      const res = await axios.post(`${API}/assistant/chat`, {
        bot_id: id,
        message: fullMsg,
        session_id: assistantSessionId.current,
      }, { headers });
      setAssistantMsgs((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      fetchBotSettings();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "未知錯誤";
      setAssistantMsgs((prev) => [...prev, { role: "assistant", content: `❌ ${detail}` }]);
    }
    setAssistantLoading(false);
  };

  // ── 把語氣風格報告帶入 AI 助手，套用到 system_prompt ──
  const applyStyleWithAssistant = async () => {
    if (!styleReport || !id) return;
    setAssistantOpen(true);
    assistantSessionId.current = `assistant_${id}_${Date.now()}`;
    const fullMsg = `這是剛產生的「語氣風格分析」報告，請仔細閱讀：\n\n---\n${styleReport}\n---\n\n請把報告最後「可貼進設定的風格段落」那段語氣與話術規範，融入這個 Bot 的 system_prompt（用工具修改 system_prompt）。要求：\n1. 只調整「語氣、口吻、用字遣詞」相關內容，不要更動原本的業務邏輯、角色設定、資料收集規則。\n2. 若 system_prompt 已有語氣相關描述，就更新它，不要重複堆疊。\n\n請先簡短說明你打算怎麼改（改哪裡、加什麼），等我回覆「好」或「改」再用工具實際修改。`;
    const displayMsg = "🎨 已載入語氣風格報告，請把建議的語氣規範套進 Bot 的 system_prompt";
    setAssistantMsgs([{ role: "user", content: displayMsg }]);
    setAssistantLoading(true);
    try {
      const res = await axios.post(`${API}/assistant/chat`, {
        bot_id: id,
        message: fullMsg,
        session_id: assistantSessionId.current,
      }, { headers });
      setAssistantMsgs((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      fetchBotSettings();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "未知錯誤";
      setAssistantMsgs((prev) => [...prev, { role: "assistant", content: `❌ ${detail}` }]);
    }
    setAssistantLoading(false);
  };

  // ── Settings：儲存 Sheet ──
  const saveSheet = async () => {
    setSavingSheet(true);
    try {
      await axios.patch(`${API}/bots/${id}`, {
        sheet_id: sheetId,
        collect_fields: collectFields,
      }, { headers });
      setMessage("✅ Google Sheet 設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingSheet(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── 儲存 Instagram ──
  const saveInstagram = async () => {
    if (!instagramPageToken.trim()) return;
    setSavingInstagram(true);
    try {
      await axios.patch(`${API}/bots/${id}`, { instagram_page_token: instagramPageToken }, { headers });
      setInstagramConfigured(true);
      setInstagramPageToken("");
      setMessage("✅ Instagram 設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingInstagram(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // ── Settings：儲存關鍵字觸發 ──
  const saveKeywordTriggers = async () => {
    setSavingKeywords(true);
    try {
      await axios.patch(`${API}/bots/${id}`, { keyword_triggers: keywordTriggers }, { headers });
      setMessage("✅ 關鍵字設定已儲存");
    } catch (err: any) {
      setMessage(`❌ ${err?.response?.data?.detail || "儲存失敗"}`);
    } finally {
      setSavingKeywords(false);
      setTimeout(() => setMessage(""), 3000);
    }
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

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const embedCode = `<script>
  window.ChatbotConfig = { botId: "${id}" };
</script>
<script src="${appOrigin}/widget.js" async></script>`;

  return (
    <>
    <main className={`min-h-screen bg-gray-950 text-white px-4 py-8 transition-all duration-300 ${assistantOpen ? "md:pr-[376px]" : ""}`}>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white mb-6 text-sm">
          ← 返回
        </button>
        {isViewer && (
          <div className="mb-4 bg-yellow-900/30 border border-yellow-700/50 text-yellow-200 text-sm rounded-lg px-4 py-3">
            你是此團隊的「檢視者」，僅能查看設定與數據，無法修改。如需編輯權限請聯絡團隊管理員。
          </div>
        )}
        <div className="flex items-center gap-3 mb-4">
          {editingName ? (
            <>
              <input
                autoFocus
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveBotName(); if (e.key === "Escape") setEditingName(false); }}
                className="text-2xl font-bold bg-gray-800 px-3 py-1 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 flex-1"
              />
              <button onClick={saveBotName} disabled={savingName} className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition disabled:opacity-50">
                {savingName ? "儲存中..." : "儲存"}
              </button>
              <button onClick={() => { setEditingName(false); setBotName(botSettings?.name || ""); }} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition">
                取消
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{botSettings?.name || "Bot 設定"}</h1>
              <button onClick={() => setEditingName(true)} className="text-gray-500 hover:text-white transition text-sm">
                ✏️
              </button>
            </>
          )}
        </div>

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
          {(["knowledge", "persona", "chat", "embed", "settings", "analytics"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t
                  ? t === "analytics" ? "border-yellow-500 text-white"
                  : "border-blue-500 text-white"
                  : "border-transparent text-gray-500 hover:text-white"
              }`}
            >
              {{ knowledge: "📚 知識庫", persona: "🤖 角色", chat: "💬 測試對話", embed: "🔗 嵌入代碼", settings: "⚙️ 設定", analytics: "📊 數據" }[t]}
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
              <div className="flex justify-between items-start mb-1">
                <h2 className="text-lg font-semibold">🤖 角色 & 說話風格</h2>
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1 text-xs">
                  <button
                    onClick={() => setPersonaMode("simple")}
                    className={`px-3 py-1 rounded-md transition ${personaMode === "simple" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    簡單填空
                  </button>
                  <button
                    onClick={() => setPersonaMode("advanced")}
                    className={`px-3 py-1 rounded-md transition ${personaMode === "advanced" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    進階編輯
                  </button>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-5">決定 Bot 扮演什麼角色、用什麼口吻說話。平台會自動處理防失憶、資料收集等規則，你只要填角色重點就好。</p>

              {personaMode === "simple" ? (
                <div className="space-y-5">
                  {/* 方案 2：一句話 → AI 幫你填 */}
                  <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/30 border border-purple-800/50 rounded-xl p-4">
                    <label className="text-sm font-medium text-purple-200 block mb-2">✨ 懶得填？用一句話描述你的生意，讓 AI 幫你填</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pGenDesc}
                        onChange={(e) => setPGenDesc(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !pGenLoading) generatePersona(); }}
                        placeholder="例如：我開美甲店，想幫客人預約跟報價"
                        className="flex-1 bg-gray-800 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      />
                      <button
                        onClick={generatePersona}
                        disabled={pGenLoading || !pGenDesc.trim()}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
                      >
                        {pGenLoading ? "⏳ 生成中..." : "AI 幫我填"}
                      </button>
                    </div>
                  </div>

                  {/* 生意描述 */}
                  <div>
                    <label className="text-sm text-gray-300 font-medium block mb-1.5">你的生意在做什麼？</label>
                    <textarea
                      value={pBusiness}
                      onChange={(e) => { setPBusiness(e.target.value); setIsDirty(true); }}
                      placeholder="例如：我們是專營韓式美甲的工作室，提供光療、卸甲、手足保養等服務。"
                      rows={2}
                      className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                    />
                  </div>

                  {/* 角色 */}
                  <div>
                    <label className="text-sm text-gray-300 font-medium block mb-1.5">Bot 扮演什麼角色？</label>
                    <div className="flex flex-wrap gap-2">
                      {PERSONA_ROLES.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => { setPRole(r.key); setIsDirty(true); }}
                          className={`px-4 py-2 rounded-lg text-sm border transition ${
                            pRole === r.key
                              ? "border-blue-500 bg-blue-900/30 text-white"
                              : "border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-300"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 語氣 */}
                  <div>
                    <label className="text-sm text-gray-300 font-medium block mb-1.5">說話語氣（可多選）</label>
                    <div className="flex flex-wrap gap-2">
                      {PERSONA_TONES.map((t) => (
                        <button
                          key={t}
                          onClick={() => { setPTones((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]); setIsDirty(true); }}
                          className={`px-3 py-1.5 rounded-full text-sm border transition ${
                            pTones.includes(t)
                              ? "border-purple-500 bg-purple-900/40 text-white"
                              : "border-gray-700 bg-gray-800 hover:border-gray-500 text-gray-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 重點 */}
                  <div>
                    <label className="text-sm text-gray-300 font-medium block mb-1.5">一定要讓客戶知道的重點 <span className="text-gray-600">（選填）</span></label>
                    <textarea
                      value={pHighlights}
                      onChange={(e) => { setPHighlights(e.target.value); setIsDirty(true); }}
                      placeholder="例如：營業時間週二到週日 11:00-20:00、採預約制、可加 LINE 詢問價格。"
                      rows={3}
                      className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                    />
                  </div>

                  {/* 禁忌 */}
                  <div>
                    <label className="text-sm text-gray-300 font-medium block mb-1.5">絕對不能說 / 不能做的事 <span className="text-gray-600">（選填）</span></label>
                    <textarea
                      value={pTaboos}
                      onChange={(e) => { setPTaboos(e.target.value); setIsDirty(true); }}
                      placeholder="例如：不要隨便報明確價格、不要承諾療程效果。"
                      rows={2}
                      className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                    />
                  </div>

                  {/* 即時預覽 */}
                  <details className="bg-gray-800/50 rounded-xl px-4 py-3">
                    <summary className="text-xs text-gray-400 cursor-pointer select-none">🔍 預覽實際套用的角色設定</summary>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap mt-3 leading-relaxed">{buildPersonaPrompt({ business: pBusiness, role: pRole, tones: pTones, highlights: pHighlights, taboos: pTaboos }, botName)}</pre>
                  </details>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {PROMPT_PRESETS.map((preset) => {
                      const isActive = systemPrompt.trim() === preset.prompt.trim();
                      return (
                        <button
                          key={preset.key}
                          onClick={() => { setSystemPrompt(preset.prompt); setIsDirty(true); }}
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
                        <button onClick={() => { setSystemPrompt(""); setIsDirty(true); }} className="text-xs text-gray-500 hover:text-red-400 transition">清除</button>
                      )}
                    </div>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => { setSystemPrompt(e.target.value); setIsDirty(true); }}
                      placeholder={`例如：你是「${botSettings?.name || "Bot"}」的業務專員，說話風格積極有親和力...`}
                      rows={12}
                      className="w-full bg-gray-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm min-h-[200px]"
                    />
                  </div>
                  <p className="text-gray-600 text-xs mb-4">
                    可用 <code className="bg-gray-800 px-1 rounded text-gray-400">{"{bot_name}"}</code> 代入 Bot 名稱。
                  </p>
                  {systemPrompt.trim() && (
                    <button
                      onClick={extractPersona}
                      disabled={pGenLoading}
                      className="w-full mb-2 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-purple-300 hover:text-purple-200 transition disabled:opacity-50"
                    >
                      {pGenLoading ? "⏳ 轉換中..." : "🪄 轉成簡單填空（AI 幫你拆解目前的設定）"}
                    </button>
                  )}
                </>
              )}
              <div className="h-4" />
              <div className="flex gap-2">
                <button
                  onClick={savePrompt}
                  disabled={savingPrompt}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {savingPrompt ? "儲存中..." : "💾 儲存角色設定"}
                </button>
                <button
                  onClick={() => { setHistoryOpen(true); fetchHistory(); }}
                  className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm transition"
                  title="歷史紀錄"
                >
                  🕐 歷史
                </button>
              </div>
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
                  onChange={(e) => { setWelcomeMessage(e.target.value); setIsDirty(true); }}
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

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
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
                  onChange={(e) => { setApiKey(e.target.value); setIsDirty(true); }}
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
                  <TimePicker value={businessStart} onChange={setBusinessStart} />
                  <span className="text-gray-500">～</span>
                  <TimePicker value={businessEnd} onChange={setBusinessEnd} />
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

            {/* 🌙 下班時間自動回應 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-1">🌙 下班時間自動回應</h2>
              <p className="text-gray-400 text-sm mb-5">
                非上班時間收到訊息，資料收集完成後 Bot 會附上這則通知。留空則不啟用。
              </p>

              {/* 上班時間 */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">上班時間</label>
                <div className="flex items-center gap-3">
                  <TimePicker value={businessStart} onChange={setBusinessStart} />
                  <span className="text-gray-500">～</span>
                  <TimePicker value={businessEnd} onChange={setBusinessEnd} />
                </div>
              </div>

              {/* 上班日 */}
              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-2 block">上班日</label>
                <div className="flex gap-2">
                  {([["一",1],["二",2],["三",3],["四",4],["五",5],["六",6],["日",7]] as [string,number][]).map(([label, day]) => (
                    <button key={day}
                      onClick={() => setWorkWeekdays((prev) =>
                        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
                      )}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                        workWeekdays.includes(day) ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white"
                      }`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* 下班訊息 */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">下班通知訊息</label>
                <textarea
                  value={offHoursMessage}
                  onChange={(e) => setOffHoursMessage(e.target.value)}
                  placeholder="例：目前非上班時間，您的訊息已收到，上班時間將盡快與您聯繫 🙏"
                  rows={3}
                  className="w-full bg-gray-800 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <button
                onClick={saveOffHours}
                disabled={savingOffHours}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingOffHours ? "儲存中..." : "💾 儲存設定"}
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
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">5</span>
                    <div className="flex flex-col gap-1.5">
                      <span>前往 <a href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline transition">LINE Official Account Manager</a> → 選擇帳號 → 右上角「設定」→「回應設定」，調整以下三項：</span>
                      <div className="bg-gray-700 rounded-lg px-3 py-2.5 flex flex-col gap-1 text-xs mt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-bold">✓</span>
                          <span className="text-gray-300"><span className="font-medium text-white">聊天</span> → <span className="text-green-400 font-semibold">開啟</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-bold">✓</span>
                          <span className="text-gray-300"><span className="font-medium text-white">Webhook</span> → <span className="text-green-400 font-semibold">開啟</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-bold">✗</span>
                          <span className="text-gray-300"><span className="font-medium text-white">自動回應訊息</span> → <span className="text-red-400 font-semibold">關閉</span>（否則 LINE 預設回覆會干擾 Bot）</span>
                        </div>
                      </div>
                    </div>
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

            {/* ⏱ 防抖設定 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-1">⏱ LINE 防抖時間</h2>
              <p className="text-gray-400 text-sm mb-5">
                用戶連續傳訊息時，等待幾秒後才合併回覆。設太短容易重複回應，設太長用戶等太久。建議 10-20 秒。
              </p>
              <div className="flex items-center gap-4 mb-4">
                <input
                  type="range"
                  min={3}
                  max={60}
                  step={1}
                  value={debounceSeconds}
                  onChange={(e) => setDebounceSeconds(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-white font-bold text-lg w-16 text-right">{debounceSeconds} 秒</span>
              </div>
              <button
                onClick={saveDebounce}
                disabled={savingDebounce}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingDebounce ? "儲存中..." : "💾 儲存防抖設定"}
              </button>
            </div>

            {/* 📸 Instagram 串接 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">📸 Instagram 自動回覆</h2>
                {instagramConfigured && (
                  <span className="text-pink-400 text-xs bg-pink-900/40 border border-pink-800 px-2 py-0.5 rounded-full">✅ 已設定</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-5">自動回覆 Instagram 貼文<strong className="text-white">留言</strong>與 <strong className="text-white">DM</strong>，需要 Meta 商業帳號。</p>

              {/* 步驟說明 */}
              <div className="bg-gray-800 rounded-xl p-4 mb-5">
                <p className="text-sm font-medium text-gray-300 mb-3">📋 設定步驟</p>
                <ol className="flex flex-col gap-3 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>前往 <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 underline transition">Meta for Developers</a> → 建立或選擇 App → 加入「Instagram」產品</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>Instagram → Settings → 「Generate access token」取得 Page Access Token 後貼到下方</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span>Webhooks → 選「Instagram」→ 「Add Callback URL」貼入下方 Webhook URL，Verify Token 欄位貼入下方的 Verify Token</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <span>訂閱欄位勾選 <code className="text-pink-300">messages</code>（DM）與 <code className="text-pink-300">feed</code>（留言）</span>
                  </li>
                </ol>
              </div>

              {/* Page Access Token */}
              <div className="mb-4">
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
                className="w-full bg-pink-600 hover:bg-pink-700 py-3 rounded-lg font-semibold transition disabled:opacity-50 mb-5"
              >
                {savingInstagram ? "儲存中..." : "💾 儲存 Instagram 設定"}
              </button>

              {/* 綁定狀態 */}
              {botSettings && (botSettings.instagram_account_id || botSettings.facebook_page_id) && (
                <div className="mb-5 p-3 bg-green-900/20 border border-green-800/50 rounded-lg text-xs">
                  <p className="text-green-400 font-semibold mb-1">✅ 已綁定 Instagram 帳號</p>
                  {botSettings.instagram_account_id && (
                    <p className="text-gray-400">IG Business Account ID: <span className="text-green-300 font-mono">{botSettings.instagram_account_id}</span></p>
                  )}
                  {botSettings.facebook_page_id && (
                    <p className="text-gray-400">Facebook Page ID: <span className="text-green-300 font-mono">{botSettings.facebook_page_id}</span></p>
                  )}
                </div>
              )}

              {/* Webhook URL */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1.5 block">Webhook URL（貼到 Meta Developers → Webhooks）</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-3 rounded-lg text-pink-400 text-xs font-mono overflow-x-auto">
                    {`https://api.landehui.online/instagram/webhook/${id}`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://api.landehui.online/instagram/webhook/${id}`);
                      setMessage("✅ Webhook URL 已複製");
                      setTimeout(() => setMessage(""), 2000);
                    }}
                    className="shrink-0 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                  >
                    複製
                  </button>
                </div>
              </div>

              {/* Verify Token */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Verify Token（在 Meta Developers 驗證時使用）</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 px-4 py-3 rounded-lg text-yellow-400 text-xs font-mono overflow-x-auto">
                    {id}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(id as string);
                      setMessage("✅ Verify Token 已複製");
                      setTimeout(() => setMessage(""), 2000);
                    }}
                    className="shrink-0 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
                  >
                    複製
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
        {/* ── 數據 Tab ── */}
        {tab === "analytics" && (
          <div className="flex flex-col gap-6">
            {/* Stats 卡片（分析後才顯示）*/}
            {aiStats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{aiStats.total_sessions}</div>
                  <div className="text-gray-400 text-xs mt-1">對話組數</div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{aiStats.total_messages}</div>
                  <div className="text-gray-400 text-xs mt-1">總訊息數</div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{aiStats.completed_sessions}</div>
                  <div className="text-gray-400 text-xs mt-1">完成資料收集</div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${aiStats.completion_rate >= 50 ? "text-green-400" : aiStats.completion_rate >= 25 ? "text-yellow-400" : "text-red-400"}`}>
                    {aiStats.completion_rate}%
                  </div>
                  <div className="text-gray-400 text-xs mt-1">完成率</div>
                </div>
              </div>
            )}

            {/* AI 分析區 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">🤖 AI 對話分析</h2>
              </div>
              <p className="text-gray-500 text-xs mb-4">依對話 session 分組，分析完成率、客戶疑慮、Bot 問題與改善建議</p>

              {/* 時間範圍選擇 */}
              <div className="flex gap-2 mb-4">
                {[
                  { label: "7 天", value: 7 },
                  { label: "30 天", value: 30 },
                  { label: "90 天", value: 90 },
                  { label: "全部", value: 0 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAnalysisDays(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                      analysisDays === opt.value
                        ? "bg-purple-800 border-purple-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchAiReport}
                disabled={aiReportLoading}
                className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-50 py-3 rounded-xl font-semibold text-sm transition mb-3"
              >
                {aiReportLoading ? "⏳ AI 分析中（約 15-30 秒）..." : aiReport ? "🔄 重新分析" : "✨ 開始 AI 分析"}
              </button>

              {/* 查看對話紀錄 / 清除資料 */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={fetchLogs}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-600 py-2 rounded-xl text-xs text-gray-300 hover:text-blue-300 transition"
                >
                  📋 查看對話紀錄
                </button>
                <button
                  onClick={cleanFortune}
                  disabled={cleaningFortune}
                  className="flex-1 bg-gray-800 hover:bg-red-900/40 disabled:opacity-50 border border-gray-700 hover:border-red-700 py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 transition"
                >
                  {cleaningFortune ? "刪除中..." : "🗑️ 清除資料"}
                </button>
              </div>
              {aiReport && (
                <>
                  <div className="bg-gray-800 rounded-xl p-5 text-sm text-gray-200 leading-relaxed">
                    {renderReport(aiReport)}
                  </div>
                  {/* 把報告帶到 AI 助手，邊聊邊自動改設定 */}
                  <button
                    onClick={discussWithAssistant}
                    disabled={assistantLoading}
                    className="w-full mt-4 bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                  >
                    {assistantLoading ? "⏳ 小懶閱讀中..." : "💬 跟 AI 討論改善建議（自動套用設定）"}
                  </button>
                  <p className="text-gray-500 text-xs mt-2 text-center">點擊後會打開設定助手「小懶」，並把這份報告交給它分析，你只要回覆「好」或「改」它就會自動修改設定</p>
                </>
              )}
            </div>

            {/* 語氣風格分析 */}
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="font-semibold mb-1">🎨 語氣風格分析</h2>
              <p className="text-gray-500 text-xs mb-4">讀客戶訊息 + 員工真人代回 + Bot 回覆，分析語氣口吻與遣詞用字，產出一份話術風格指南（沿用上方的時間範圍）</p>

              <button
                onClick={fetchStyleReport}
                disabled={styleReportLoading}
                className="w-full bg-pink-700 hover:bg-pink-600 disabled:opacity-50 py-3 rounded-xl font-semibold text-sm transition mb-3"
              >
                {styleReportLoading ? "⏳ 分析語氣中（約 15-30 秒）..." : styleReport ? "🔄 重新分析語氣" : "🎨 開始語氣分析"}
              </button>

              {styleStats && (
                <p className="text-xs text-gray-500 mb-3">
                  分析 {styleStats.total_sessions} 組對話・{styleStats.total_messages} 則訊息・
                  {styleStats.human_reply_count > 0
                    ? `${styleStats.human_reply_count} 則員工真人代回可當範本`
                    : "尚無員工真人代回範例（改用一般客服建議）"}
                </p>
              )}

              {styleReport && (
                <>
                  <div className="bg-gray-800 rounded-xl p-5 text-sm text-gray-200 leading-relaxed">
                    {renderReport(styleReport)}
                  </div>
                  <button
                    onClick={applyStyleWithAssistant}
                    disabled={assistantLoading}
                    className="w-full mt-4 bg-gradient-to-r from-pink-700 to-purple-700 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                  >
                    {assistantLoading ? "⏳ 小懶閱讀中..." : "🎨 套用語氣到 Bot（改 system_prompt）"}
                  </button>
                  <p className="text-gray-500 text-xs mt-2 text-center">點擊後會打開設定助手「小懶」，把這份語氣指南交給它，你回覆「好」或「改」它就會把語氣規範併進 Bot 的 system_prompt</p>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </main>

    {/* ── 對話紀錄 Modal ── */}
    {logsOpen && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
        <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-800">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <h2 className="font-semibold text-white">📋 對話紀錄</h2>
              {logsData && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {analysisDays > 0 ? `近 ${analysisDays} 天` : "全部"}・{logsData.total_sessions} 個 session・{logsData.total_messages} 則訊息
                </p>
              )}
            </div>
            <button onClick={() => setLogsOpen(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-2">
            {logsLoading ? (
              <p className="text-gray-500 text-sm text-center py-8">載入中...</p>
            ) : !logsData || logsData.sessions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">這個範圍內沒有對話紀錄</p>
            ) : logsData.sessions.map((s) => {
              const expanded = expandedSid === s.session_id;
              const channelColor =
                s.channel === "LINE" ? "bg-green-900/40 text-green-300 border-green-800" :
                s.channel === "IG" || s.channel === "IG 留言" ? "bg-pink-900/40 text-pink-300 border-pink-800" :
                s.channel === "網頁/測試" ? "bg-blue-900/40 text-blue-300 border-blue-800" :
                s.channel === "設定助手" ? "bg-purple-900/40 text-purple-300 border-purple-800" :
                "bg-gray-800 text-gray-400 border-gray-700";
              return (
                <div key={s.session_id} className="bg-gray-800/60 border border-gray-700 rounded-xl">
                  <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setExpandedSid(expanded ? null : s.session_id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${channelColor}`}>{s.channel}</span>
                        {s.completed && <span className="text-[10px] px-2 py-0.5 rounded border bg-yellow-900/40 text-yellow-300 border-yellow-800">✅ 完成</span>}
                        {s.muted && <span className="text-[10px] px-2 py-0.5 rounded border bg-orange-900/40 text-orange-300 border-orange-800">🙋 真人接手中</span>}
                        {s.display_name
                          ? <span className="text-sm text-gray-200 font-medium truncate">{s.display_name}</span>
                          : <span className="text-xs text-gray-500 font-mono truncate">{s.session_id}</span>}
                      </div>
                      <p className="text-xs text-gray-400">
                        {s.message_count} 則・{new Date(s.first_at).toLocaleString("zh-TW", { hour12: false })}
                        {s.first_at !== s.last_at && ` → ${new Date(s.last_at).toLocaleString("zh-TW", { hour12: false })}`}
                      </p>
                    </button>
                    {s.can_mute && (
                      <button
                        onClick={() => toggleMute(s.session_id, !!s.muted)}
                        disabled={mutingSid === s.session_id}
                        className={`shrink-0 text-[11px] px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
                          s.muted
                            ? "bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-900/60"
                            : "bg-orange-900/40 text-orange-300 border-orange-800 hover:bg-orange-900/60"
                        }`}
                        title={s.muted ? "讓 AI 重新自動回覆這位客戶" : "AI 停止回覆，改由真人接手這位客戶"}
                      >
                        {mutingSid === s.session_id ? "…" : s.muted ? "🤖 恢復 AI" : "🙋 真人接手"}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedSid(expanded ? null : s.session_id)}
                      className="shrink-0 text-gray-500 text-sm"
                    >{expanded ? "▾" : "▸"}</button>
                  </div>
                  {expanded && (
                    <div className="px-4 pb-3 flex flex-col gap-2 border-t border-gray-700 pt-3">
                      {s.messages.map((m, i) => (
                        <div key={i} className="text-xs">
                          <div className="text-gray-500 mb-1">{new Date(m.at).toLocaleString("zh-TW", { hour12: false })}</div>
                          <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-2 mb-1 text-gray-200 whitespace-pre-wrap"><b className="text-blue-300">客戶：</b>{m.q}</div>
                          <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 whitespace-pre-wrap"><b className="text-gray-400">Bot：</b>{m.a}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-6 py-3 border-t border-gray-800 text-xs text-gray-500">
            💡 每個 session_id 對應一位獨立來源（LINE 用戶／網頁訪客／IG 用戶）。<br />
            🙋 LINE 對話可按「真人接手」讓 AI 暫停自動回覆，改由真人在 LINE 官方帳號後台回覆客戶；按「恢復 AI」即可讓 AI 重新接手。
          </div>
        </div>
      </div>
    )}

    {/* ── AI 助手 Floating Widget ── */}
    <>
      {/* ── 歷史紀錄 Modal ── */}
      {historyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-gray-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">🕐 設定歷史紀錄</h2>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-3">
              {historyLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">載入中...</p>
              ) : historyList.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">目前沒有歷史紀錄</p>
              ) : historyList.map((snap) => {
                const date = new Date(snap.created_at);
                const label = snap.source === "restore" ? "🔄 還原點" : snap.source === "assistant" ? "🤖 小懶修改" : "✏️ 手動儲存";
                const preview = snap.system_prompt
                  ? snap.system_prompt.slice(0, 60) + (snap.system_prompt.length > 60 ? "..." : "")
                  : "（無角色設定）";
                return (
                  <div key={snap.id} className="bg-gray-800 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{label}</span>
                        <span className="text-gray-500 text-xs">
                          {date.toLocaleDateString("zh-TW")} {date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <button
                        onClick={() => restoreSnapshot(snap.id)}
                        disabled={restoringId === snap.id}
                        className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        {restoringId === snap.id ? "還原中..." : "還原"}
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{preview}</p>
                    {snap.collect_fields?.length > 0 && (
                      <p className="text-gray-500 text-xs">收集欄位：{snap.collect_fields.join("、")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 觸發按鈕 */}
      {!assistantOpen && (
        <button
          onClick={() => setAssistantOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl font-semibold text-sm transition-all duration-200 bg-purple-600 hover:bg-purple-700 text-white"
          title="AI 設定助手「小懶」"
        >
          <span className="text-base">✨</span>
          <span>小懶</span>
        </button>
      )}

      {/* 側邊 Panel */}
      <div
        className={`fixed bottom-0 right-0 z-40 flex flex-col bg-gray-900 border-l border-t border-gray-800 shadow-2xl transition-all duration-300 ease-in-out ${
          assistantOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
        }`}
        style={{ width: "360px", height: "calc(100vh - 0px)", top: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-purple-400 text-base">✨</span>
              <h2 className="font-semibold text-white">AI 設定助手「小懶」</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">說需求，我幫你設定 Bot</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setAssistantMsgs([
                  { role: "assistant", content: "👋 你好！我是設定助手「小懶」。\n\n告訴我你想要什麼樣的機器人，我來幫你設定！" }
                ]);
                assistantSessionId.current = `assistant_${id}_${Date.now()}`;
              }}
              className="text-xs text-gray-500 hover:text-white transition px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg"
              title="重置對話"
            >
              🔄
            </button>
            <button
              onClick={() => setAssistantOpen(false)}
              className="text-gray-500 hover:text-white transition text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* 快速建議（對話剛開始時） */}
        {assistantMsgs.length <= 1 && (
          <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5 shrink-0">
            {["幫我設定角色描述", "設定收集欄位", "幫我寫歡迎訊息", "查看目前設定"].map((s) => (
              <button
                key={s}
                onClick={() => sendAssistantMsg(s)}
                className="px-2.5 py-1 text-xs bg-purple-900/50 border border-purple-800/50 hover:bg-purple-800/60 text-purple-300 rounded-full transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 訊息列表 */}
        <div ref={assistantScrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {assistantMsgs.map((msg, i) => {
            const proposed = msg.role === "assistant" ? extractCodeBlock(msg.content) : null;
            // 把 code block 從顯示文字裡移除，另外顯示
            const displayText = proposed
              ? msg.content.replace(/```[^\n]*\n?[\s\S]+?```/, "").trim()
              : msg.content;
            return (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm"
                }`}>
                  {displayText}
                </div>
                {proposed && (
                  <div className="max-w-[85%] mt-2 rounded-xl overflow-hidden border border-gray-700">
                    <div className="bg-gray-900 px-3 py-1.5 text-xs text-gray-400 flex items-center justify-between">
                      <span>📋 提案角色設定</span>
                    </div>
                    <pre className="bg-gray-950 px-3 py-3 text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                      {proposed}
                    </pre>
                    <button
                      onClick={() => applyProposedPrompt(proposed)}
                      disabled={applyingPrompt}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 font-semibold transition disabled:opacity-50"
                    >
                      {applyingPrompt ? "套用中..." : "✅ 套用此設定"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {assistantLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 text-purple-400 px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm flex items-center gap-1.5">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: "0.15s" }}>●</span>
                <span className="animate-pulse" style={{ animationDelay: "0.3s" }}>●</span>
              </div>
            </div>
          )}
          <div ref={assistantBottomRef} />
        </div>

        {/* 輸入框 */}
        <form
          onSubmit={(e) => { e.preventDefault(); sendAssistantMsg(assistantInput); }}
          className="flex gap-2 px-4 py-4 border-t border-gray-800 shrink-0"
        >
          <input
            type="text"
            placeholder="輸入需求..."
            value={assistantInput}
            onChange={(e) => setAssistantInput(e.target.value)}
            className="flex-1 bg-gray-800 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <button
            type="submit"
            disabled={assistantLoading || !assistantInput.trim()}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-xl font-semibold transition disabled:opacity-50 text-sm"
          >
            送
          </button>
        </form>

        {/* Footer 提示 */}
        <p className="text-xs text-gray-600 text-center pb-3 shrink-0">
          ⚠️ 需先在「⚙️ 設定」填入 Gemini API Key
        </p>
      </div>

      {/* 背景遮罩（手機版） */}
      {assistantOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setAssistantOpen(false)}
        />
      )}
    </>
    </>
  );
}
