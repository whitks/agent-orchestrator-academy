(function () {
  'use strict';

  // Read config from script tag attributes
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var tenantId = script.getAttribute('data-tenant-id') || 'apex_university';
  var apiBase = script.getAttribute('data-api-url') || (function () {
    var src = script.src;
    if (src && src.indexOf('/widget.js') !== -1) {
      return src.substring(0, src.indexOf('/widget.js'));
    }
    return 'http://localhost:8000';
  })();
  var themeColor = script.getAttribute('data-theme-color') || '#4f46e5';

  // Create Host Container with isolated Shadow DOM
  var container = document.createElement('div');
  container.id = 'agent-college-widget-root';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '999999';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  document.body.appendChild(container);

  var shadow = container.attachShadow({ mode: 'open' });

  // Styles isolated in Shadow DOM
  var style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: inherit; }
    
    .launcher-btn {
      width: 56px;
      height: 56px;
      border-radius: 28px;
      background: ${themeColor};
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .launcher-btn:hover {
      transform: scale(1.05);
    }
    .launcher-btn svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .chat-panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 380px;
      height: 580px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 100px);
      background: #FBFBFD;
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 20px;
      box-shadow: 0 12px 40px -8px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px) scale(0.98);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .chat-panel.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    .panel-header {
      background: #ffffff;
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .online-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
    }
    .panel-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
    }
    .close-btn:hover {
      background: #f1f5f9;
      color: #334155;
    }

    /* Advisors bar */
    .advisors-pill-bar {
      background: #f8fafc;
      padding: 8px 14px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      font-size: 11px;
    }
    .advisor-chip {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 3px 8px;
      border-radius: 12px;
      white-space: nowrap;
      color: #475569;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .advisor-chip.active {
      border-color: ${themeColor};
      color: ${themeColor};
      font-weight: 600;
    }

    /* Message list */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .msg-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.5;
      max-width: 85%;
      word-wrap: break-word;
    }
    .msg-user {
      align-self: flex-end;
      background: ${themeColor};
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }
    .msg-bot {
      align-self: flex-start;
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .meta-sources {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 6px;
      border-top: 1px solid #f1f5f9;
      padding-top: 4px;
    }

    /* Footer Input */
    .chat-footer {
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      padding: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .chat-input {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 13px;
      outline: none;
      color: #0f172a;
    }
    .chat-input:focus {
      border-color: ${themeColor};
      background: #ffffff;
    }
    .send-btn {
      width: 34px;
      height: 34px;
      border-radius: 17px;
      background: ${themeColor};
      color: #ffffff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      shrink: 0;
    }
    .send-btn svg {
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
    }
  `;
  shadow.appendChild(style);

  // Widget HTML Shell
  var wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="chat-panel" id="panel">
      <div class="panel-header">
        <div>
          <div class="panel-title">
            <span class="online-indicator"></span>
            <span id="tenant-name">Campus Assistant</span>
          </div>
          <div class="panel-subtitle">Multi-Advisor Intelligence</div>
        </div>
        <button class="close-btn" id="close-btn" title="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="advisors-pill-bar" id="advisors-bar">
        <span class="advisor-chip">📚 Academics</span>
        <span class="advisor-chip">💼 Placements</span>
        <span class="advisor-chip">🎯 Activities</span>
        <span class="advisor-chip">🏠 Facilities</span>
      </div>

      <div class="chat-messages" id="messages">
        <div class="msg-bubble msg-bot">
          Hello! How can I assist you with college policies, exam regulations, placements, or campus events?
        </div>
      </div>

      <div class="chat-footer">
        <input type="text" class="chat-input" id="chat-input" placeholder="Ask a question..." />
        <button class="send-btn" id="send-btn" title="Send">
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <button class="launcher-btn" id="launcher-btn" title="Chat with Campus Assistant">
      <svg viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
  `;
  shadow.appendChild(wrapper);

  // References inside shadow
  var panel = shadow.getElementById('panel');
  var launcherBtn = shadow.getElementById('launcher-btn');
  var closeBtn = shadow.getElementById('close-btn');
  var sendBtn = shadow.getElementById('send-btn');
  var chatInput = shadow.getElementById('chat-input');
  var messagesContainer = shadow.getElementById('messages');
  var tenantNameElem = shadow.getElementById('tenant-name');
  var advisorsBar = shadow.getElementById('advisors-bar');

  var isOpen = false;
  var sessionId = 'wgt-' + Math.random().toString(36).substring(2, 8);

  // Load tenant profile dynamically
  fetch(apiBase + '/api/tenants/' + encodeURIComponent(tenantId))
    .then(function (res) { return res.json(); })
    .then(function (cfg) {
      if (cfg && cfg.name) {
        tenantNameElem.textContent = cfg.name;
        if (cfg.theme_color) {
          themeColor = cfg.theme_color;
          launcherBtn.style.background = themeColor;
          sendBtn.style.background = themeColor;
        }
      }
    })
    .catch(function () {});

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('open');
      chatInput.focus();
    } else {
      panel.classList.remove('open');
    }
  }

  launcherBtn.onclick = toggle;
  closeBtn.onclick = toggle;

  function appendMsg(text, role, sources) {
    var div = document.createElement('div');
    div.className = 'msg-bubble ' + (role === 'user' ? 'msg-user' : 'msg-bot');
    div.textContent = text;
    if (sources && sources.length) {
      var s = document.createElement('div');
      s.className = 'meta-sources';
      s.textContent = 'Sources: ' + sources.join(', ');
      div.appendChild(s);
    }
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return div;
  }

  function sendQuestion() {
    var q = chatInput.value.trim();
    if (!q) return;
    chatInput.value = '';

    appendMsg(q, 'user');

    var botMsg = appendMsg('...', 'msg-bot');
    var fullAnswer = '';

    var url = apiBase + '/chat/stream?session_id=' + encodeURIComponent(sessionId) +
      '&message=' + encodeURIComponent(q) +
      '&tenant_id=' + encodeURIComponent(tenantId);

    var es = new EventSource(url);

    es.onmessage = function (e) {
      try {
        var parsed = JSON.parse(e.data);
        if (parsed.event === 'final_answer_tokens') {
          if (botMsg.textContent === '...') botMsg.textContent = '';
          fullAnswer += parsed.data;
          botMsg.textContent = fullAnswer;
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else if (parsed.event === 'done') {
          es.close();
          if (parsed.sources && parsed.sources.length) {
            var s = document.createElement('div');
            s.className = 'meta-sources';
            s.textContent = 'Verified: ' + parsed.sources.join(', ');
            botMsg.appendChild(s);
          }
        }
      } catch (err) {}
    };

    es.onerror = function () {
      es.close();
      if (!fullAnswer) {
        botMsg.textContent = 'Could not establish connection to college advisors.';
      }
    };
  }

  sendBtn.onclick = sendQuestion;
  chatInput.onkeydown = function (e) {
    if (e.key === 'Enter') sendQuestion();
  };

})();
