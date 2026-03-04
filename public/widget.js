(function () {
  const config = window.ChatbotConfig || {};
  const botId = config.botId;
  const apiBase = config.apiBase || "http://localhost:8000";
  if (!botId) return;

  // 注入樣式
  const style = document.createElement("style");
  style.textContent = `
    #ai-chatbot-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #2563eb; color: white; border: none;
      font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.2s;
    }
    #ai-chatbot-btn:hover { transform: scale(1.1); }
    #ai-chatbot-box {
      display: none; position: fixed; bottom: 92px; right: 24px; z-index: 9999;
      width: 340px; height: 480px; background: #111827; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); flex-direction: column;
      font-family: sans-serif; overflow: hidden;
    }
    #ai-chatbot-box.open { display: flex; }
    #ai-chatbot-header {
      background: #2563eb; padding: 16px; color: white;
      font-weight: bold; font-size: 15px;
    }
    #ai-chatbot-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .ai-msg, .user-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 12px;
      font-size: 14px; line-height: 1.5;
    }
    .ai-msg { background: #1f2937; color: #f9fafb; align-self: flex-start; }
    .user-msg { background: #2563eb; color: white; align-self: flex-end; }
    #ai-chatbot-input-area {
      display: flex; padding: 12px; gap: 8px; border-top: 1px solid #1f2937;
    }
    #ai-chatbot-input {
      flex: 1; background: #1f2937; color: white; border: none;
      padding: 10px 14px; border-radius: 8px; font-size: 14px; outline: none;
    }
    #ai-chatbot-send {
      background: #2563eb; color: white; border: none;
      padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 14px;
    }
    #ai-chatbot-send:hover { background: #1d4ed8; }
  `;
  document.head.appendChild(style);

  // 建立 HTML
  document.body.insertAdjacentHTML("beforeend", `
    <button id="ai-chatbot-btn">💬</button>
    <div id="ai-chatbot-box">
      <div id="ai-chatbot-header">🤖 AI 客服</div>
      <div id="ai-chatbot-messages">
        <div class="ai-msg">你好！有什麼可以幫你的嗎？</div>
      </div>
      <div id="ai-chatbot-input-area">
        <input id="ai-chatbot-input" placeholder="輸入問題..." />
        <button id="ai-chatbot-send">送出</button>
      </div>
    </div>
  `);

  const btn = document.getElementById("ai-chatbot-btn");
  const box = document.getElementById("ai-chatbot-box");
  const input = document.getElementById("ai-chatbot-input");
  const send = document.getElementById("ai-chatbot-send");
  const messages = document.getElementById("ai-chatbot-messages");

  btn.onclick = () => box.classList.toggle("open");

  const addMessage = (text, type) => {
    const div = document.createElement("div");
    div.className = type === "user" ? "user-msg" : "ai-msg";
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  };

  const sendMessage = async () => {
    const q = input.value.trim();
    if (!q) return;
    addMessage(q, "user");
    input.value = "";

    addMessage("思考中...", "ai");

    try {
      const res = await fetch(`${apiBase}/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      messages.lastChild.textContent = data.answer;
    } catch {
      messages.lastChild.textContent = "抱歉，目前服務暫時無法使用。";
    }
    messages.scrollTop = messages.scrollHeight;
  };

  send.onclick = sendMessage;
  input.onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };
})();
