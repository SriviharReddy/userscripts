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

## Usage

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click the raw link for any script above and Tampermonkey will prompt you to install it.
