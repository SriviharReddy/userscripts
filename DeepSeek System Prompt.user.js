// ==UserScript==
// @name         DeepSeek System Prompt
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds an inline system prompt editor & toggle to DeepSeek chat. The prompt is injected as a system message before every new chat.
// @match        https://chat.deepseek.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-start
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/576012/DeepSeek%20System%20Prompt.user.js
// @updateURL https://update.greasyfork.org/scripts/576012/DeepSeek%20System%20Prompt.meta.js
// ==/UserScript==

(function () {
  'use strict';

  /* ── Storage keys ─────────────────────────────── */
  const STORAGE_KEY = 'ds_system_prompt';
  const ENABLED_KEY = 'ds_system_prompt_on';

  let systemPrompt = GM_getValue(STORAGE_KEY, '');
  let isEnabled    = GM_getValue(ENABLED_KEY, true);

  /* ── API patterns to intercept ────────────────── */
  const API_PATTERNS = [
    '/api/v0/chat/completion',
    '/chat/completions',
    '/v1/chat/completions',
  ];

  /* ── Helpers ──────────────────────────────────── */
  function log(...a) { console.log('[DS-SysPrompt]', ...a); }

  /* ── Network interception ─────────────────────── */
  const patched = new WeakSet();

  function modifyBody(body, url) {
    if (!body || !systemPrompt || !isEnabled) return body;
    try {
      let raw = typeof body === 'string' ? body : null;
      if (!raw) return body;
      const data = JSON.parse(raw);

      if (Array.isArray(data.messages)) {
        const hasSystem = data.messages.some(m => m.role === 'system');
        if (!hasSystem) {
          data.messages.unshift({ role: 'system', content: systemPrompt });
          log('Injected system message into messages[]', url);
          return JSON.stringify(data);
        }
      }

      if (typeof data.prompt === 'string') {
        data.prompt = `[SYSTEM INSTRUCTION]\n${systemPrompt}\n\n[USER MESSAGE]\n${data.prompt}`;
        log('Injected system prompt into prompt field', url);
        return JSON.stringify(data);
      }
    } catch (_) {}
    return body;
  }

  function matchesAPI(url) {
    return API_PATTERNS.some(p => String(url).includes(p));
  }

  function patchFetch() {
    const w = unsafeWindow;
    const orig = w.fetch;
    if (patched.has(orig)) return;
    w.fetch = async function (url, opts = {}) {
      if (matchesAPI(url) && opts.body) {
        const cloned = { ...opts };
        if (cloned.body instanceof Blob) {
          try {
            const text = await cloned.body.text();
            const mod = modifyBody(text, url);
            if (mod !== text) cloned.body = new Blob([mod], { type: cloned.body.type });
          } catch (_) {}
        } else {
          cloned.body = modifyBody(cloned.body, url);
        }
        return orig.call(this, url, cloned);
      }
      return orig.call(this, url, opts);
    };
    Object.keys(orig).forEach(k => { try { w.fetch[k] = orig[k]; } catch (_) {} });
    patched.add(orig);
    log('fetch patched');
  }

  function patchXHR() {
    const XHR = unsafeWindow.XMLHttpRequest;
    if (patched.has(XHR.prototype)) return;
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    XHR.prototype.open = function (method, url, ...rest) {
      this._dsUrl = url;
      return origOpen.call(this, method, url, ...rest);
    };
    XHR.prototype.send = function (body) {
      if (this._dsUrl && matchesAPI(this._dsUrl)) {
        arguments[0] = modifyBody(body, this._dsUrl);
      }
      return origSend.apply(this, arguments);
    };
    patched.add(XHR.prototype);
    log('XHR patched');
  }

  function patchWS() {
    const OrigWS = unsafeWindow.WebSocket;
    if (patched.has(OrigWS)) return;
    unsafeWindow.WebSocket = function (url, protocols) {
      const ws = new OrigWS(url, protocols);
      const origSend = ws.send;
      ws.send = function (data) {
        if (systemPrompt && isEnabled && typeof data === 'string') {
          try {
            const obj = JSON.parse(data);
            if (typeof obj.prompt === 'string') {
              obj.prompt = `[SYSTEM INSTRUCTION]\n${systemPrompt}\n\n[USER MESSAGE]\n${obj.prompt}`;
              data = JSON.stringify(obj);
            }
          } catch (_) {}
        }
        return origSend.call(this, data);
      };
      return ws;
    };
    Object.keys(OrigWS).forEach(k => { try { unsafeWindow.WebSocket[k] = OrigWS[k]; } catch (_) {} });
    patched.add(OrigWS);
    log('WebSocket patched');
  }

  function applyPatches() { patchFetch(); patchXHR(); patchWS(); }
  applyPatches();
  let n = 0;
  const iv = setInterval(() => { applyPatches(); if (++n > 15) clearInterval(iv); }, 400);

  /* ── Styles ───────────────────────────────────── */
  // Minimal CSS — panel positioning is done via JS inline styles to avoid
  // the CSS `position: fixed` bug caused by ancestor transforms on the page.
  GM_addStyle(`
    #ds-sp-toggle {
      cursor: pointer !important;
    }
  `);

  /* ── UI state ─────────────────────────────────── */
  let panelEl = null;
  let toggleBtn = null;
  let textareaEl = null;
  let charCountEl = null;
  let switchTrack = null;
  let toastEl = null;
  let injected = false;

  /* ── Toast ────────────────────────────────────── */
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed', bottom: '28px', left: '50%',
        transform: 'translateX(-50%) translateY(8px)',
        background: '#1a1a2e', color: '#fff',
        padding: '8px 20px', borderRadius: '10px',
        fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        opacity: '0', pointerEvents: 'none',
        transition: 'opacity .25s, transform .25s',
        zIndex: '2147483647', boxShadow: '0 4px 14px rgba(0,0,0,.2)',
      });
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(-50%) translateY(8px)';
    }, 2200);
  }

  /* ── State sync ───────────────────────────────── */
  function syncToggleState() {
    if (!toggleBtn) return;
    toggleBtn.classList.toggle('ds-toggle-button--selected', isEnabled && !!systemPrompt);
  }

  function updateCharCount() {
    if (charCountEl && textareaEl) {
      charCountEl.textContent = textareaEl.value.length + ' chars';
    }
  }

  /* ── Panel open/close ─────────────────────────── */
  function openPanel() {
    if (!panelEl) return;
    textareaEl.value = systemPrompt;
    updateCharCount();
    switchTrack.classList.toggle('ds-sp-on', isEnabled);
    panelEl.style.display = 'flex';
    // Animate in next frame
    requestAnimationFrame(() => {
      panelEl.style.opacity = '1';
      panelEl.style.transform = 'translateY(0)';
    });
    setTimeout(() => textareaEl.focus(), 80);
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.style.opacity = '0';
    panelEl.style.transform = 'translateY(8px)';
    setTimeout(() => { panelEl.style.display = 'none'; }, 200);
  }

  function save() {
    systemPrompt = textareaEl.value.trim();
    GM_setValue(STORAGE_KEY, systemPrompt);
    GM_setValue(ENABLED_KEY, isEnabled);
    syncToggleState();
    closePanel();
    showToast(systemPrompt ? '✓ System prompt saved' : '✓ System prompt cleared');
    log('Saved. Enabled:', isEnabled, 'Prompt length:', systemPrompt.length);
  }

  /* ── Build panel with inline styles ───────────── */
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'ds-sp-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '2147483647',
      left: '50%',
      transform: 'translateX(-50%) translateY(8px)',
      width: '520px',
      maxWidth: 'calc(100vw - 40px)',
      background: '#fff',
      border: '1px solid #e4e4e7',
      borderRadius: '16px',
      boxShadow: '0 12px 40px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)',
      padding: '0',
      display: 'none',
      opacity: '0',
      flexDirection: 'column',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      transition: 'opacity .2s ease, transform .2s ease',
      overflow: 'visible',
      boxSizing: 'border-box',
    });

    // --- Header ---
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px 10px', borderBottom: '1px solid #eee',
    });

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '14px', fontWeight: '600', color: '#1a1a2e',
      display: 'flex', alignItems: 'center', gap: '6px',
    });
    title.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> System Prompt`;

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      width: '28px', height: '28px', border: 'none', background: 'transparent',
      color: '#999', fontSize: '18px', cursor: 'pointer', borderRadius: '6px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closePanel);
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(0,0,0,.06)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'transparent'; });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // --- Body ---
    const body = document.createElement('div');
    Object.assign(body.style, { padding: '12px 18px 8px' });

    const ta = document.createElement('textarea');
    ta.placeholder = 'Enter a system-level instruction that will be sent with every new chat…\n\nExample: You are a senior software engineer. Always provide code examples and explain your reasoning step by step.';
    ta.spellcheck = false;
    Object.assign(ta.style, {
      width: '100%', minHeight: '120px', maxHeight: '260px', resize: 'vertical',
      border: '1.5px solid #e4e4e7', borderRadius: '10px', padding: '12px 14px',
      fontSize: '13.5px', lineHeight: '1.55',
      fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
      color: '#333', background: '#fafafa', outline: 'none',
      transition: 'border-color .2s', boxSizing: 'border-box',
      display: 'block',
    });
    ta.addEventListener('focus', () => { ta.style.borderColor = '#4772f6'; ta.style.background = '#fff'; });
    ta.addEventListener('blur', () => { ta.style.borderColor = '#e4e4e7'; ta.style.background = '#fafafa'; });
    ta.addEventListener('input', updateCharCount);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      if (e.key === 'Escape') closePanel();
    });

    const charCount = document.createElement('div');
    Object.assign(charCount.style, {
      textAlign: 'right', fontSize: '11px', color: '#aaa', marginTop: '4px', paddingRight: '2px',
    });
    charCount.textContent = '0 chars';

    body.appendChild(ta);
    body.appendChild(charCount);

    // --- Footer ---
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 18px 14px', borderTop: '1px solid #eee', gap: '10px',
    });

    const leftGroup = document.createElement('div');
    Object.assign(leftGroup.style, { display: 'flex', alignItems: 'center', gap: '12px' });

    // Toggle switch
    const switchLabel = document.createElement('label');
    Object.assign(switchLabel.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '13px', color: '#666', cursor: 'pointer', userSelect: 'none',
    });

    const track = document.createElement('div');
    Object.assign(track.style, {
      width: '36px', height: '20px', borderRadius: '12px',
      background: isEnabled ? '#4772f6' : '#ccc',
      position: 'relative', transition: 'background .2s', flexShrink: '0',
    });
    const thumb = document.createElement('div');
    Object.assign(thumb.style, {
      width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
      position: 'absolute', top: '2px', left: isEnabled ? '18px' : '2px',
      transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.18)',
    });
    track.appendChild(thumb);
    // Add ds-sp-on class handling via JS
    track._update = function (on) {
      track.style.background = on ? '#4772f6' : '#ccc';
      thumb.style.left = on ? '18px' : '2px';
    };

    const enabledText = document.createElement('span');
    enabledText.textContent = 'Enabled';

    switchLabel.appendChild(track);
    switchLabel.appendChild(enabledText);
    switchLabel.addEventListener('click', () => {
      isEnabled = !isEnabled;
      track._update(isEnabled);
    });

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    Object.assign(clearBtn.style, {
      background: 'none', border: 'none', color: '#e05555',
      fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px',
    });
    clearBtn.addEventListener('click', () => { ta.value = ''; updateCharCount(); });
    clearBtn.addEventListener('mouseenter', () => { clearBtn.style.background = 'rgba(224,85,85,.08)'; });
    clearBtn.addEventListener('mouseleave', () => { clearBtn.style.background = 'none'; });

    leftGroup.appendChild(switchLabel);
    leftGroup.appendChild(clearBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    Object.assign(saveBtn.style, {
      padding: '6px 20px', borderRadius: '8px', border: 'none',
      background: '#4772f6', color: '#fff', fontSize: '13px',
      fontWeight: '500', cursor: 'pointer',
    });
    saveBtn.addEventListener('click', save);
    saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = '#3b62e0'; });
    saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = '#4772f6'; });

    footer.appendChild(leftGroup);
    footer.appendChild(saveBtn);

    // --- Assemble ---
    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    // Store references
    textareaEl = ta;
    charCountEl = charCount;
    switchTrack = track; // we use track._update() instead of class toggling

    return panel;
  }

  /* override switchTrack class toggle to use JS */
  const origOpenPanel = openPanel;

  /* ── Position panel above the input area ───────── */
  function positionPanel() {
    if (!panelEl || !toggleBtn) return;
    const btnRect = toggleBtn.getBoundingClientRect();
    // Place panel so its bottom is just above the button row, centered horizontally
    const panelHeight = panelEl.offsetHeight || 300;
    const top = btnRect.top - panelHeight - 12;
    panelEl.style.top = Math.max(10, top) + 'px';
  }

  /* ── Build UI ─────────────────────────────────── */
  function buildUI() {
    if (injected) return;
    if (document.getElementById('ds-sp-toggle')) { injected = true; return; }

    const toggleButtons = document.querySelectorAll('.ds-toggle-button');
    if (!toggleButtons.length) return;

    const lastToggle = toggleButtons[toggleButtons.length - 1];
    const toolbar = lastToggle.parentElement;
    if (!toolbar) return;

    /* ── Toggle button ── */
    toggleBtn = document.createElement('div');
    toggleBtn.id = 'ds-sp-toggle';
    toggleBtn.setAttribute('role', 'button');
    toggleBtn.className = 'ds-atom-button ds-toggle-button ds-toggle-button--md';
    toggleBtn.innerHTML = '<div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><span><span>System</span></span>';
    toggleBtn.title = 'Click to edit system prompt';
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = panelEl && panelEl.style.display === 'flex';
      if (isOpen) closePanel();
      else { openPanel(); positionPanel(); }
    });
    syncToggleState();

    if (lastToggle.nextSibling) {
      toolbar.insertBefore(toggleBtn, lastToggle.nextSibling);
    } else {
      toolbar.appendChild(toggleBtn);
    }

    /* ── Panel ── */
    panelEl = createPanel();
    // Append to <html> to escape any transform containers
    document.documentElement.appendChild(panelEl);

    /* click-outside to close */
    document.addEventListener('mousedown', (e) => {
      if (panelEl.style.display === 'flex' &&
          !panelEl.contains(e.target) &&
          e.target !== toggleBtn &&
          !toggleBtn.contains(e.target)) {
        closePanel();
      }
    });

    // Re-center on resize
    window.addEventListener('resize', () => {
      if (panelEl.style.display === 'flex') positionPanel();
    });

    injected = true;
    log('UI injected (v1.1)');
  }

  /* ── Override openPanel to use JS-based switch ── */
  const _origOpen = openPanel;
  openPanel = function () {
    if (!panelEl) return;
    textareaEl.value = systemPrompt;
    updateCharCount();
    switchTrack._update(isEnabled);
    panelEl.style.display = 'flex';
    requestAnimationFrame(() => {
      panelEl.style.opacity = '1';
      panelEl.style.transform = 'translateX(-50%) translateY(0)';
      positionPanel();
    });
    setTimeout(() => textareaEl.focus(), 80);
  };

  /* ── Observer ─────────────────────────────────── */
  function tryInject() {
    if (document.getElementById('ds-sp-toggle')) { injected = true; syncToggleState(); return; }
    injected = false;
    buildUI();
  }

  const mo = new MutationObserver(() => {
    if (!document.getElementById('ds-sp-toggle')) injected = false;
    if (!injected) buildUI();
  });

  function start() {
    tryInject();
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      applyPatches();
      setTimeout(tryInject, 300);
    }
  }).observe(document, { subtree: true, childList: true });
})();
