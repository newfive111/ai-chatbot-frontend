(function () {
  var config = window.ChatbotConfig || {};
  var botId = config.botId;
  var API = 'https://graceful-patience-production-0170.up.railway.app';

  if (!botId) {
    console.warn('[LazyReply Widget] botId not set in window.ChatbotConfig');
    return;
  }

  var sessionId = 'widget_' + Math.random().toString(36).slice(2);
  var isOpen = false;
  var isLoading = false;
  var welcomeShown = false;
  var botName = 'AI 助理';
  var welcomeMessage = '';
  var quickReplies = [];

  // ── Styles ──────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = `
    #lr-btn {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #2563eb; color: white; border: none;
      cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.45);
      z-index: 2147483647; font-size: 24px;
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #lr-btn:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(37,99,235,0.55); }
    #lr-panel {
      position: fixed; bottom: 92px; right: 24px;
      width: 360px; height: 520px;
      background: #111827; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      z-index: 2147483646; display: flex; flex-direction: column;
      overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: opacity .2s, transform .2s;
    }
    #lr-panel.lr-hide { opacity: 0; transform: translateY(10px); pointer-events: none; }
    #lr-header {
      background: #1f2937; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #374151; flex-shrink: 0;
    }
    #lr-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #2563eb; display: flex; align-items: center;
      justify-content: center; font-size: 18px; flex-shrink: 0;
    }
    #lr-bot-name { color: #fff; font-weight: 600; font-size: 15px; }
    #lr-online { color: #10b981; font-size: 12px; margin-top: 2px; }
    #lr-msgs {
      flex: 1; overflow-y: auto; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    #lr-msgs::-webkit-scrollbar { width: 4px; }
    #lr-msgs::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
    .lr-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 16px;
      font-size: 14px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    }
    .lr-bot { background: #1f2937; color: #f3f4f6; align-self: flex-start; border-bottom-left-radius: 4px; }
    .lr-user { background: #2563eb; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .lr-typing {
      background: #1f2937; color: #9ca3af; align-self: flex-start;
      border-radius: 16px; border-bottom-left-radius: 4px;
      padding: 10px 14px; font-size: 14px;
    }
    #lr-qrs { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 10px; flex-shrink: 0; }
    .lr-qr {
      background: transparent; border: 1px solid #374151; border-radius: 20px;
      padding: 6px 14px; color: #9ca3af; font-size: 13px; cursor: pointer;
      transition: all .15s; font-family: inherit;
    }
    .lr-qr:hover { border-color: #2563eb; color: #fff; }
    #lr-footer {
      padding: 12px; border-top: 1px solid #374151;
      display: flex; gap: 8px; flex-shrink: 0;
    }
    #lr-input {
      flex: 1; background: #1f2937; border: 1px solid #374151;
      border-radius: 10px; padding: 10px 14px; color: #fff;
      font-size: 14px; outline: none; resize: none;
      font-family: inherit; max-height: 100px; line-height: 1.4;
    }
    #lr-input::placeholder { color: #6b7280; }
    #lr-input:focus { border-color: #2563eb; }
    #lr-send {
      background: #2563eb; border: none; border-radius: 10px;
      width: 40px; height: 40px; cursor: pointer; color: #fff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end; transition: background .15s;
    }
    #lr-send:hover { background: #1d4ed8; }
    #lr-send:disabled { opacity: .45; cursor: not-allowed; }
    @media (max-width: 480px) {
      #lr-panel { width: calc(100vw - 24px); right: 12px; height: 65vh; bottom: 80px; }
    }
  `;
  document.head.appendChild(styleEl);

  // ── Button ──────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'lr-btn';
  btn.setAttribute('aria-label', '開啟客服對話');
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  document.body.appendChild(btn);

  // ── Panel ──────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = 'lr-panel';
  panel.classList.add('lr-hide');
  panel.innerHTML = `
    <div id="lr-header">
      <div id="lr-avatar">🤖</div>
      <div>
        <div id="lr-bot-name">載入中...</div>
        <div id="lr-online">● 線上</div>
      </div>
    </div>
    <div id="lr-msgs"></div>
    <div id="lr-qrs" style="display:none"></div>
    <div id="lr-footer">
      <textarea id="lr-input" placeholder="輸入訊息..." rows="1"></textarea>
      <button id="lr-send" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  var msgsEl = document.getElementById('lr-msgs');
  var inputEl = document.getElementById('lr-input');
  var sendBtn = document.getElementById('lr-send');
  var botNameEl = document.getElementById('lr-bot-name');
  var qrsEl = document.getElementById('lr-qrs');

  // ── Load bot info ────────────────────────────────────────
  fetch(API + '/bots/' + botId + '/welcome')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      botName = data.bot_name || 'AI 助理';
      welcomeMessage = data.welcome_message || '';
      quickReplies = (data.quick_replies || []).map(function (q) { return q.label || q; });
      botNameEl.textContent = botName;
      sendBtn.disabled = false;
    })
    .catch(function () {
      botNameEl.textContent = 'AI 助理';
      sendBtn.disabled = false;
    });

  // ── Helpers ──────────────────────────────────────────────
  function addMsg(text, role) {
    var div = document.createElement('div');
    div.className = 'lr-msg lr-' + role;
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'lr-typing'; div.id = 'lr-typing'; div.textContent = '思考中...';
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function removeTyping() {
    var el = document.getElementById('lr-typing');
    if (el) el.remove();
  }

  function renderQRs() {
    qrsEl.innerHTML = '';
    if (!quickReplies.length) { qrsEl.style.display = 'none'; return; }
    qrsEl.style.display = 'flex';
    quickReplies.forEach(function (label) {
      var b = document.createElement('button');
      b.className = 'lr-qr'; b.textContent = label;
      b.onclick = function () { qrsEl.style.display = 'none'; sendMsg(label); };
      qrsEl.appendChild(b);
    });
  }

  async function sendMsg(text) {
    if (!text.trim() || isLoading) return;
    qrsEl.style.display = 'none';
    addMsg(text, 'user');
    inputEl.value = ''; inputEl.style.height = 'auto';
    isLoading = true; sendBtn.disabled = true;
    showTyping();

    try {
      var res = await fetch(API + '/bots/' + botId + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, session_id: sessionId })
      });
      var data = await res.json();
      removeTyping();
      addMsg(data.answer || '⚠️ 無法取得回應', 'bot');
      renderQRs();
    } catch (e) {
      removeTyping();
      addMsg('⚠️ 發生錯誤，請稍後再試', 'bot');
      renderQRs();
    }

    isLoading = false; sendBtn.disabled = false;
    inputEl.focus();
  }

  // ── Toggle ──────────────────────────────────────────────
  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.remove('lr-hide');
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      if (!welcomeShown) {
        welcomeShown = true;
        if (welcomeMessage) {
          setTimeout(function () { addMsg(welcomeMessage, 'bot'); renderQRs(); }, 200);
        } else {
          setTimeout(function () { renderQRs(); }, 200);
        }
      } else {
        renderQRs();
      }
      setTimeout(function () { inputEl.focus(); }, 300);
    } else {
      panel.classList.add('lr-hide');
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    }
  });

  // ── Send ────────────────────────────────────────────────
  sendBtn.addEventListener('click', function () { sendMsg(inputEl.value); });
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(inputEl.value); }
  });
  inputEl.addEventListener('input', function () {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

})();
