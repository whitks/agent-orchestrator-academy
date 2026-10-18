// Stanford Portal Client Script & Widget Bridge
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Stanford Portal] Initialized with Agent College Chatbot.');

  // Hook into quick-prompt chips to launch and ask questions directly
  window.askAdvisor = function (query) {
    const host = document.getElementById('agent-college-widget-root');
    if (!host || !host.shadowRoot) {
      console.warn('Chatbot widget container not found yet.');
      return;
    }

    const shadow = host.shadowRoot;
    const panel = shadow.getElementById('panel');
    const input = shadow.getElementById('chat-input');
    const sendBtn = shadow.getElementById('send-btn');
    const launcherBtn = shadow.getElementById('launcher-btn');

    // Open panel if closed
    if (panel && !panel.classList.contains('open') && launcherBtn) {
      launcherBtn.click();
    }

    // Set input and send
    if (input && sendBtn) {
      input.value = query;
      setTimeout(() => {
        sendBtn.click();
      }, 150);
    }
  };
});
