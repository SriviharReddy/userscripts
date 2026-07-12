// ==UserScript==
// @name         Google AI Studio - Consumer UI Redesign v2
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Redesigns the Google AI Studio UI to look like a modern consumer app (like Gemini) with vibrant colors, cleaner sidebar, and chat bubble styles.
// @author       Antigravity
// @match        https://aistudio.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // -------------------------------------------------------------------------
    // 1. Inject Google Fonts (Outfit & Inter)
    // -------------------------------------------------------------------------
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(fontLink);

    // -------------------------------------------------------------------------
    // 2. Inject CSS Stylesheet
    // -------------------------------------------------------------------------
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        /* --- General Typography & Layout --- */
        body, html, .mat-typography {
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
        }

        /* --- Main Chat Section / Playground Redesign --- */
        section.chunk-editor-main,
        .chunk-editor-main-container,
        .main-container,
        .play-ground-container,
        ms-authoring-stage {
            background: radial-gradient(circle at 50% 50%, #18181c 0%, #0d0d0f 100%) !important;
        }

        /* --- Hide Zero-State only when conversation content is present ---
           Rather than always hiding, we use :has() to only suppress it when
           chat turns exist. Falls back gracefully in browsers without :has(). */
        ms-prompt-response-panel:has(ms-chat-turn) ~ ms-zero-state,
        ms-prompt-response-panel:has(ms-chat-turn) ~ .v3-zero-state,
        ms-prompt-response-panel:has(ms-chat-turn) ~ .zero-state-container {
            display: none !important;
        }

        /* --- Chat Turn Bubbles --- */
        ms-chat-turn {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 2px 16px !important;
        }

        .chat-turn-container {
            max-width: 80% !important;
            padding: 14px 20px !important;
            border-radius: 20px !important;
            margin-bottom: 4px !important;
            font-size: 15px !important;
            line-height: 1.6 !important;
            box-sizing: border-box !important;
            transition: all 0.2s ease !important;
        }

        /* User Message Style (cyan/sky gradient bubble aligned right) */
        .chat-turn-container.user {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(3, 105, 161, 0.15) 100%) !important;
            border: 1px solid rgba(14, 165, 233, 0.28) !important;
            margin-left: auto !important;
            margin-right: 0 !important;
            color: #f0f9ff !important;
            border-bottom-right-radius: 4px !important;
            box-shadow: 0 4px 20px rgba(14, 165, 233, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
            font-family: 'Outfit', 'Inter', sans-serif !important;
        }

        /* Model Message Style (no bubbles, transparent background, full width) */
        .chat-turn-container.model {
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            margin-right: 0 !important;
            margin-left: 0 !important;
            max-width: 100% !important;
            color: #e2e8f0 !important;
            padding: 2px 0 8px 0 !important;
            box-shadow: none !important;
        }

        /* Chat Turn Headers - Hidden for clean consumer look */
        .chat-turn-container .author-label {
            display: none !important;
        }

        /* Hide thumbs up/down feedback footer */
        .turn-footer {
            display: none !important;
        }

        /* --- Model Thoughts Redesign (Single-line style like Gemini) --- */
        ms-thought-chunk {
            display: block !important;
            margin: 2px 0 6px 0 !important;
        }

        /* Hide the top header panel completely */
        ms-thought-chunk .top-panel-header {
            display: none !important;
        }

        /* Make expansion panels completely borderless and backgroundless */
        ms-thought-chunk mat-expansion-panel {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            margin: 0 !important;
        }

        ms-thought-chunk mat-expansion-panel-header {
            background: transparent !important;
            padding: 0 !important;
            height: 24px !important;
            min-height: 24px !important;
            cursor: pointer !important;
            display: inline-flex !important;
        }

        /* Order panels so trigger is on top and content is below */
        ms-thought-chunk mat-accordion {
            display: flex !important;
            flex-direction: column !important;
            background: transparent !important;
        }

        ms-thought-chunk mat-expansion-panel.thought-panel {
            order: 2 !important;
        }

        ms-thought-chunk mat-expansion-panel:not(.thought-panel) {
            order: 1 !important;
        }

        /* Style the footer trigger content as a clean inline row */
        ms-thought-chunk .thought-panel-footer {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            font-family: 'Outfit', sans-serif !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            color: #38bdf8 !important;
            transition: opacity 0.2s ease !important;
        }

        ms-thought-chunk .thought-panel-footer:hover {
            opacity: 0.85 !important;
        }

        /* Thought label — styled cleanly; text content set via JS (see below) */
        ms-thought-chunk .thought-collapsed-text {
            font-size: 13px !important;
            color: #38bdf8 !important;
            font-weight: 500 !important;
            font-family: 'Outfit', sans-serif !important;
        }

        ms-thought-chunk .thought-collapsed-text-container {
            flex: none !important;
        }

        /* Style the chevron icon */
        ms-thought-chunk .footer-icon {
            font-size: 16px !important;
            width: 16px !important;
            height: 16px !important;
            color: #38bdf8 !important;
            display: inline-block !important;
            margin-left: 2px !important;
            transform: none !important;
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Rotate chevron down when expanded */
        ms-thought-chunk mat-expansion-panel-header[aria-expanded="true"] .footer-icon,
        ms-thought-chunk .footer-icon.expanded {
            transform: rotate(90deg) !important;
        }

        /* Style the thinking text inside the expanded panel */
        ms-thought-chunk mat-expansion-panel.thought-panel .mat-expansion-panel-body {
            padding: 8px 0 8px 16px !important;
            border-left: 2px solid rgba(56, 189, 248, 0.3) !important;
            margin: 4px 0 8px 0 !important;
            font-size: 13px !important;
            color: #94a3b8 !important;
            background: transparent !important;
        }

        /* Layout overrides to prevent text from being truncated */
        ms-thought-chunk mat-expansion-panel-header,
        ms-thought-chunk mat-expansion-panel-header * {
            width: auto !important;
            max-width: none !important;
            overflow: visible !important;
        }

        /* --- Bottom Prompt Box Redesign --- */
        ms-prompt-box {
            border-radius: 28px !important;
            background: rgba(22, 22, 26, 0.65) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255, 255, 255, 0.06) !important;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.02) !important;
            padding: 0 !important;
            max-width: 840px !important;
            width: 90% !important;
            margin: 0 auto 28px auto !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-sizing: border-box !important;
            display: block !important;
        }

        ms-prompt-box:focus-within {
            border-color: rgba(14, 165, 233, 0.4) !important;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(14, 165, 233, 0.15) !important;
            background: rgba(18, 18, 22, 0.85) !important;
        }

        /* Make inner container transparent and borderless to remove double borders */
        .prompt-box-container {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 10px 18px !important;
            margin: 0 !important;
            width: 100% !important;
        }

        /* Textarea style inside prompt box */
        ms-prompt-box textarea {
            background: transparent !important;
            border: none !important;
            color: #ffffff !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 15px !important;
            line-height: 1.5 !important;
            resize: none !important;
            outline: none !important;
            box-shadow: none !important;
        }

        /* Prompt Box buttons */
        ms-prompt-box button,
        ms-prompt-box .run-button-container {
            border-radius: 20px !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
        }

        /* --- Left Sidebar Cleaning & Redesign --- */
        ms-nav-items-build-v2 {
            display: none !important;
        }

        /* Hide Documentation links */
        a[href*="gemini-api/docs"],
        a[href*="ai.google.dev"] {
            display: none !important;
        }

        /* Redesigned Dashboard Button */
        .redesigned-dashboard-btn {
            margin: 8px 16px !important;
            padding: 10px 16px !important;
            border-radius: 12px !important;
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px solid rgba(255, 255, 255, 0.07) !important;
            color: #e3e3e3 !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            text-decoration: none !important;
            font-family: 'Outfit', sans-serif !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
        }

        .redesigned-dashboard-btn:hover {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(3, 105, 161, 0.15) 100%) !important;
            border-color: rgba(14, 165, 233, 0.4) !important;
            color: #ffffff !important;
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15) !important;
            transform: translateY(-1px) !important;
        }

        .redesigned-dashboard-btn svg,
        .redesigned-dashboard-btn mat-icon {
            color: #38bdf8 !important;
            transition: color 0.2s ease !important;
        }

        .redesigned-dashboard-btn:hover svg,
        .redesigned-dashboard-btn:hover mat-icon {
            color: #0ea5e9 !important;
        }

        /* --- Chatbox clutter --- */
        /* Hide the API key icon button in the prompt box */
        ms-paid-api-key-button { display: none !important; }

        /* Compress the Grounding chip so only the icon shows, no label text */
        button.tool-chip-button span.tool-name { display: none !important; }
        button.tool-chip-button { min-width: 0 !important; padding: 0 8px !important; gap: 0 !important; }
    `;
    document.head.appendChild(styleEl);

    // -------------------------------------------------------------------------
    // 3. Utility — simple debounce helper
    // -------------------------------------------------------------------------
    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // -------------------------------------------------------------------------
    // 4. Sidebar restructuring
    // -------------------------------------------------------------------------

    // Track which one-time mutations are done so we stop querying unnecessarily.
    const done = { dashboard: false, headers: false };

    /**
     * Find the dashboard link with multiple selector fallbacks.
     * Returns the element or null.
     */
    function findDashboardLink() {
        // Primary: exact href
        let el = document.querySelector('a[href="/api-keys"]');
        if (el) return el;

        // Fallback 1: href contains "api-keys"
        el = document.querySelector('a[href*="api-keys"]');
        if (el) return el;

        // Fallback 2: any nav link whose visible text mentions "API Keys"
        for (const a of document.querySelectorAll('a')) {
            if (/api\s*keys?/i.test(a.textContent)) return a;
        }

        return null;
    }

    function restructureSidebar() {
        // -- Dashboard link --
        if (!done.dashboard) {
            const dashboardLink = findDashboardLink();
            const bottomActions = document.querySelector('div.bottom-actions');

            if (dashboardLink && bottomActions && !bottomActions.contains(dashboardLink)) {
                dashboardLink.classList.add('redesigned-dashboard-btn');
                bottomActions.insertBefore(dashboardLink, bottomActions.firstChild);
                done.dashboard = true;
            }
        }

        // -- Section headers (BUILD / MANAGE) --
        if (!done.headers) {
            const headers = document.querySelectorAll('.section-header');
            if (headers.length > 0) {
                headers.forEach(header => {
                    const text = header.textContent.trim().toUpperCase();
                    if (text === 'BUILD' || text === 'MANAGE') {
                        header.style.display = 'none';
                    }
                });
                done.headers = true;
            }
        }
    }

    // -------------------------------------------------------------------------
    // 5. Thought label text replacement (replaces font-size:0 trick)
    //    Idempotently sets the visible text of .thought-collapsed-text to
    //    "Thought" without clobbering any child icon elements.
    // -------------------------------------------------------------------------
    function fixThoughtLabels() {
        document.querySelectorAll('ms-thought-chunk .thought-collapsed-text').forEach(el => {
            // Find the first raw text node child
            const textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
            if (textNode) {
                if (textNode.textContent.trim() !== 'Thought') {
                    textNode.textContent = 'Thought';
                }
            } else if (el.textContent.trim() !== 'Thought') {
                // No existing text node — set directly
                el.textContent = 'Thought';
            }
        });
    }

    // -------------------------------------------------------------------------
    // 6. Combined init
    // -------------------------------------------------------------------------
    function init() {
        restructureSidebar();
        fixThoughtLabels();
    }

    // -------------------------------------------------------------------------
    // 7. Bootstrapping
    // -------------------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Debounced sidebar observer — disconnects itself once all one-time tasks
    // are complete, so it stops consuming CPU on every Angular DOM mutation.
    const debouncedSidebarCheck = debounce(() => {
        restructureSidebar();
        if (done.dashboard && done.headers) {
            sidebarObserver.disconnect();
        }
    }, 150);

    const sidebarObserver = new MutationObserver(debouncedSidebarCheck);
    sidebarObserver.observe(document.body, { childList: true, subtree: true });

    // Separate, narrower observer scoped to the chat panel for thought labels.
    // Keeps running since new conversation turns arrive throughout the session.
    function attachThoughtObserver() {
        const chatRoot = document.querySelector('ms-prompt-response-panel') || document.body;
        const thoughtObserver = new MutationObserver(debounce(fixThoughtLabels, 200));
        thoughtObserver.observe(chatRoot, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachThoughtObserver);
    } else {
        attachThoughtObserver();
    }

})();
