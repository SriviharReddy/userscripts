// ==UserScript==
// @name         Google AI Studio - System Instruction via Fetch Intercept
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Injects a persisted system instruction into every GenerateContent request. Inline chatbox button.
// @author       You
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ─── Storage ──────────────────────────────────────────────────────────────

    const store = {
        get: () => {
            try { return GM_getValue('system_instruction', ''); }
            catch { return localStorage.getItem('ai_studio_system_instruction') || ''; }
        },
        set: (val) => {
            try { GM_setValue('system_instruction', val); }
            catch { localStorage.setItem('ai_studio_system_instruction', val); }
        }
    };

    // ─── Body patcher ─────────────────────────────────────────────────────────

    function injectInstruction(bodyText, instruction) {
        try {
            const data = JSON.parse(bodyText);
            if (!instruction || !instruction.trim()) return bodyText;

            if (Array.isArray(data)) {
                // Google internal JSPB array format (used by AI Studio via XHR).
                // Index 5 is the system_instruction Content field.
                // Content is serialised as [[parts], role] where each Part is [null, text].
                data[5] = [[[null, instruction.trim()]], 'user'];
            } else if (typeof data === 'object' && data !== null) {
                // Standard Gemini REST JSON format (used if the page switches to fetch).
                data.systemInstruction = {
                    parts: [{ text: instruction.trim() }]
                };
            } else {
                return bodyText;
            }

            return JSON.stringify(data);
        } catch (err) {
            console.warn('[SI] Failed to parse request body:', err);
            return bodyText;
        }
    }

    // ─── Intercepts ───────────────────────────────────────────────────────────

    const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const originalFetch = pageWindow.fetch;
    pageWindow.fetch = async function (...args) {
        let [url, options] = args;
        const urlStr = typeof url === 'string' ? url
            : (url instanceof Request ? url.url : String(url));

        if (/generatecontent/i.test(urlStr)) {
            const instruction = store.get();
            if (options && options.body) {
                let bodyText = null;
                if (typeof options.body === 'string') {
                    bodyText = options.body;
                } else if (options.body instanceof Uint8Array || options.body instanceof ArrayBuffer) {
                    console.warn('[SI] Body is binary (protobuf?). Fetch injection skipped.');
                } else if (options.body instanceof ReadableStream) {
                    console.warn('[SI] Body is a ReadableStream. Fetch injection skipped.');
                }
                if (bodyText !== null) {
                    options = { ...options, body: injectInstruction(bodyText, instruction) };
                    args = [url, options];
                }
            } else if (url instanceof Request && url.body) {
                try {
                    const originalBodyText = await url.clone().text();
                    url = new Request(url, { body: injectInstruction(originalBodyText, instruction) });
                    args = [url];
                } catch (err) {
                    console.warn('[SI] Failed to modify Request body:', err);
                }
            }
        }
        return originalFetch.apply(this, args);
    };

    // ── XHR (Angular HttpClient uses this for GenerateContent) ────────────────
    const OrigXHR = pageWindow.XMLHttpRequest;
    pageWindow.XMLHttpRequest = function () {
        const xhr = new OrigXHR();
        const origOpen = xhr.open.bind(xhr);
        const origSend = xhr.send.bind(xhr);
        let _url = '';

        xhr.open = function (method, url, ...rest) {
            _url = String(url);
            return origOpen(method, url, ...rest);
        };

        xhr.send = function (body) {
            if (/generatecontent/i.test(_url)) {
                const instruction = store.get();
                if (typeof body === 'string' && instruction.trim()) {
                    const patched = injectInstruction(body, instruction);
                    console.log('[SI] XHR injection:', patched !== body ? '\u2713 applied' : '\u2717 unchanged');
                    return origSend(patched);
                }
            }
            return origSend(body);
        };

        return xhr;
    };
    Object.assign(pageWindow.XMLHttpRequest, OrigXHR);

    // ─── UI ───────────────────────────────────────────────────────────────────
    // All DOM built with createElement (no innerHTML) to satisfy Trusted Types CSP.

    function mk(tag, attrs, ...children) {
        const node = document.createElement(tag);
        if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
                if (k === 'cls') node.className = v;
                else if (k === 'id') node.id = v;
                else if (k === 'style') node.style.cssText = v;
                else node.setAttribute(k, v);
            }
        }
        for (const c of children) {
            if (c == null) continue;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
        return node;
    }

    function injectUI() {
        // Guard: already injected, or chatbox not yet rendered by Angular.
        if (document.getElementById('si-btn')) return true;
        const buttonRowLeft = document.querySelector('.button-row-left');
        if (!buttonRowLeft) return false; // Not ready — MutationObserver will retry.

        // ── CSS ───────────────────────────────────────────────────────────────
        const style = document.createElement('style');
        style.id = 'si-styles';
        style.textContent = `
            /* Inline trigger — matches the other chatbox icon buttons */
            #si-btn {
                display: inline-flex; align-items: center; justify-content: center;
                width: 36px; height: 36px; border-radius: 50%; border: none;
                cursor: pointer; background: transparent; color: #9aa0a6;
                flex-shrink: 0; padding: 0;
                transition: background .15s, color .15s;
            }
            #si-btn:hover  { background: rgba(255,255,255,.08); color: #e3e3e3; }
            #si-btn.active { color: #4fc3f7; }
            #si-btn span   { font-size: 20px; line-height: 1; user-select: none; }

            /* Popover — anchored via JS each time it opens */
            #si-pop {
                position: fixed; z-index: 99999;
                width: 360px; background: #1f1f1f;
                border: 1px solid rgba(255,255,255,.1); border-radius: 16px;
                box-shadow: 0 16px 48px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04);
                display: flex; flex-direction: column; overflow: hidden;
                font-family: 'Google Sans', 'Roboto', system-ui, sans-serif;
                opacity: 0; transform: translateY(6px) scale(.97);
                pointer-events: none; transition: opacity .18s ease, transform .18s ease;
            }
            #si-pop.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

            #si-ph { display:flex; align-items:center; padding:14px 16px 10px; gap:8px; border-bottom:1px solid rgba(255,255,255,.07); }
            #si-ph .ico { font-size:18px; color:#4fc3f7; line-height:1; }
            #si-pt { flex:1; font-size:13px; font-weight:600; color:#e3e3e3; }
            #si-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; background:rgba(79,195,247,.15); color:#4fc3f7; display:none; }
            #si-badge.on { display:inline-block; }

            #si-pb { padding:12px 14px 8px; }
            #si-ta {
                width:100%; min-height:120px; max-height:280px; resize:vertical;
                background:#141414; border:1px solid rgba(255,255,255,.1); border-radius:10px;
                color:#e3e3e3; font-family:inherit; font-size:13px; line-height:1.65;
                padding:10px 12px; outline:none; box-sizing:border-box; transition:border-color .15s;
            }
            #si-ta:focus { border-color:#4fc3f7; }
            #si-ta::placeholder { color:#5f6368; font-size:12.5px; }

            #si-pf { display:flex; align-items:center; padding:8px 14px 14px; gap:8px; }
            #si-st { flex:1; font-size:11.5px; color:#4fc3f7; min-height:16px; }
            #si-clr { padding:6px 14px; border-radius:8px; border:1px solid rgba(255,255,255,.12); background:transparent; color:#9aa0a6; font-family:inherit; font-size:12.5px; font-weight:500; cursor:pointer; transition:background .15s, color .15s; }
            #si-clr:hover { background:rgba(255,255,255,.06); color:#e3e3e3; }
            #si-sav { padding:6px 18px; border-radius:8px; border:none; background:#4fc3f7; color:#000; font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s; }
            #si-sav:hover { background:#81d4fa; }
        `;
        document.head.appendChild(style);

        // ── Inline button ─────────────────────────────────────────────────────
        const btn = mk('button', { id: 'si-btn', title: 'System Instruction' },
            mk('span', { cls: 'material-symbols-outlined' }, 'edit_note')
        );
        // Insert before ms-prompt-box-tools if present, otherwise append.
        const toolsEl = buttonRowLeft.querySelector('ms-prompt-box-tools');
        buttonRowLeft.insertBefore(btn, toolsEl ?? null);

        // ── Popover ───────────────────────────────────────────────────────────
        const badge    = mk('span', { id: 'si-badge' }, 'ACTIVE');
        const header   = mk('div',  { id: 'si-ph' },
            mk('span', { cls: 'material-symbols-outlined ico' }, 'edit_note'),
            mk('span', { id: 'si-pt' }, 'System Instruction'),
            badge
        );
        const textarea = mk('textarea', {
            id: 'si-ta',
            placeholder: 'Injected into every GenerateContent request\u2026',
            spellcheck: 'true'
        });
        const pbody    = mk('div', { id: 'si-pb' }, textarea);
        const statusEl = mk('span',   { id: 'si-st' });
        const clearBtn = mk('button', { id: 'si-clr' }, 'Clear');
        const saveBtn  = mk('button', { id: 'si-sav' }, 'Save');
        const footer   = mk('div', { id: 'si-pf' }, statusEl, clearBtn, saveBtn);
        const pop      = mk('div', { id: 'si-pop' }, header, pbody, footer);
        document.body.appendChild(pop);

        // ── Logic ─────────────────────────────────────────────────────────────
        function syncState() {
            const active = !!store.get().trim();
            btn.classList.toggle('active', active);
            badge.classList.toggle('on', active);
        }

        function showStatus(msg) {
            statusEl.textContent = msg;
            if (msg) setTimeout(() => { statusEl.textContent = ''; }, 2000);
        }

        function positionPop() {
            // Anchor popover above the button, flip below if no room, clamp to viewport.
            const r    = btn.getBoundingClientRect();
            const popH = pop.offsetHeight || 300;
            let top  = r.top - popH - 8;
            if (top < 8) top = r.bottom + 8;
            let left = r.left - 160;
            left = Math.max(8, Math.min(left, window.innerWidth - 368));
            pop.style.top    = top + 'px';
            pop.style.left   = left + 'px';
            pop.style.bottom = '';
            pop.style.right  = '';
        }

        function open() {
            textarea.value = store.get();
            syncState();
            positionPop();
            pop.classList.add('open');
            setTimeout(() => textarea.focus(), 50);
        }

        function close() { pop.classList.remove('open'); }

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            pop.classList.contains('open') ? close() : open();
        });

        document.addEventListener('click', (e) => {
            if (!pop.contains(e.target) && e.target !== btn) close();
        });

        let autoTimer;
        textarea.addEventListener('input', () => {
            clearTimeout(autoTimer);
            autoTimer = setTimeout(() => {
                store.set(textarea.value);
                syncState();
                showStatus(textarea.value.trim() ? '\u2713 Auto-saved' : '');
            }, 800);
        });

        saveBtn.addEventListener('click', () => {
            store.set(textarea.value);
            syncState();
            showStatus(textarea.value.trim() ? '\u2713 Saved' : '\u2713 Cleared');
        });

        clearBtn.addEventListener('click', () => {
            textarea.value = '';
            store.set('');
            syncState();
            showStatus('\u2713 Cleared');
        });

        syncState();
        console.log('[SI] Inline button injected into chatbox.');
        return true;
    }

    // ─── Bootstrap ────────────────────────────────────────────────────────────
    // Angular renders the chatbox asynchronously — poll via MutationObserver
    // until .button-row-left exists, inject once, then disconnect.

    function tryInject() {
        if (injectUI()) uiObserver.disconnect();
    }

    const uiObserver = new MutationObserver(tryInject);

    if (document.body) {
        uiObserver.observe(document.body, { childList: true, subtree: true });
        tryInject();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            uiObserver.observe(document.body, { childList: true, subtree: true });
            tryInject();
        });
    }

})();
