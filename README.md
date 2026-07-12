# userscripts

A collection of personal Tampermonkey userscripts.

---

## Google AI Studio — Consumer UI Redesign
**`ai_studio_redesign_v2.user.js`**

Redesigns the Google AI Studio interface to feel like a modern consumer chat app (think Gemini) rather than a developer tool.

**What it does:**
- Applies a dark radial-gradient background to the chat area
- Styles chat turns as clean message bubbles with distinct user/model sides
- Hides developer-oriented sidebar sections (Build links, Documentation links)
- Compresses the "Grounding with Google Search" chip to icon-only
- Hides the API key icon button in the prompt box
- Replaces the verbose "Thinking…" label with a compact "Thought" label
- Injects Inter/Outfit fonts for cleaner typography

**Install:** [ai_studio_redesign_v2.user.js](./ai_studio_redesign_v2.user.js)

---

## Google AI Studio — Persistent System Instruction
**`ai_studio_system_instruction_fetch.user.js`**

Adds a persistent system instruction that is injected into every `GenerateContent` request, surviving page reloads and new chats — without touching the UI's own system instruction panel.

**What it does:**
- Intercepts AI Studio's XHR calls (Angular's `HttpClient`) at the JSPB wire level and patches `data[5]` — the `system_instruction` Content field — before each request is sent
- Also intercepts `fetch` calls as a fallback (covers the standard REST JSON format)
- Adds an inline `edit_note` icon button directly into the chatbox toolbar (alongside Tools/mic/attach), so the instruction is always one click away
- The popover auto-positions above the button and flips below if there's no room
- Instruction is persisted via `GM_getValue`/`GM_setValue` (falls back to `localStorage`)
- Active state is shown with a teal highlight on the button and an `ACTIVE` badge in the popover header

**Install:** [ai_studio_system_instruction_fetch.user.js](./ai_studio_system_instruction_fetch.user.js)

> **Note:** AI Studio serialises its API requests as JSPB (JavaScript Protocol Buffers) arrays over XHR, not standard REST JSON — this script handles both formats.

---

## DeepSeek — Inline System Prompt
**`DeepSeek System Prompt.user.js`**

Adds an inline system prompt editor and toggle to the DeepSeek chat interface. The prompt is injected as a system message before every new chat session.

**What it does:**
- Injects a system prompt dynamically by intercepting fetch/XHR requests to API endpoints (`/api/v0/chat/completion`, `/chat/completions`, etc.)
- Adds an inline editor/toggle UI to DeepSeek's sidebar to view, edit, and toggle the prompt
- Persists the prompt and active state via Tampermonkey storage

**Install:** [DeepSeek System Prompt.user.js](./DeepSeek%20System%20Prompt.user.js)

---

## YouTube — Channel → Videos Tab Redirect
**`YouTube Channel → Videos Tab.user.js`**

Redirects YouTube channel home pages to their Videos tab automatically.

**What it does:**
- Detects visits to bare channel homepages (handles handles, IDs, custom URLs, and legacy user pages)
- Automatically appends `/videos` and redirects to the videos listing
- Integrates with YouTube's single-page app (SPA) transition system to intercept inner navigation

**Install:** [YouTube Channel → Videos Tab.user.js](./YouTube%20Channel%20%E2%86%92%20Videos%20Tab.user.js)

---

## YouTube — Player Speed Controls
**`YouTube Speed Controls.user.js`**

Adds speed control buttons directly into the YouTube video player toolbar using YouTube's native speed API.

**What it does:**
- Injects reset (1&times;), +0.10&times;, and +0.25&times; speed buttons into the player's bottom right control bar
- Displays the current playback speed (e.g. `1.25x`)
- Supports hover tooltip information and mouse wheel scrolling on the buttons to fine-tune speed
- Saves your custom speed across sessions using `sessionStorage`
- Keeps in sync if the speed is changed via YouTube's native menu or keyboard shortcuts

**Install:** [YouTube Speed Controls.user.js](./YouTube%20Speed%20Controls.user.js)

---

## Usage

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click the raw link for any script above and Tampermonkey will prompt you to install it.
