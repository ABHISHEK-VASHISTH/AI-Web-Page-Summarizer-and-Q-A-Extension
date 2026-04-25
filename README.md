# 🧠 PageMind AI – Chrome Extension

Summarize any webpage or ask questions about it — powered by multiple free AI providers with **automatic fallback**.

---

## ✦ Features

- **One-click summarization** of any webpage
- **Q&A mode** – ask any question about the current page
- **Auto-fallback** across 4 free AI providers (no paid API needed)
- Works on articles, docs, blogs, Wikipedia, product pages, and more
- Clean, dark UI with chat history

---

## ⚡ Supported Free AI Providers

| Provider | Free Model | Free Limit | Get Key |
|----------|-----------|------------|---------|
| **Google Gemini** | gemini-1.5-flash | 15 req/min, 1M req/day | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Groq** | llama-3.1-8b-instant | 14,400 req/day | [console.groq.com](https://console.groq.com/keys) |
| **OpenRouter** | qwen-2.5-7b-instruct:free | ~20 req/min | [openrouter.ai](https://openrouter.ai/keys) |
| **HuggingFace** | Mistral-7B-Instruct | Free tier | [huggingface.co](https://huggingface.co/settings/tokens) |

> You don't need all 4. Even **1 key** is enough — the extension tries each configured provider and skips ones with no key.

---

## 🛠 Installation (Chrome / Edge / Brave)

### Step 1 – Load the extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (toggle top-right)
3. Click **"Load unpacked"**
4. Select the `web-ai-extension` folder

The PageMind icon will appear in your toolbar.

### Step 2 – Add your API keys

1. Click the PageMind icon (or pin it from the extensions menu)
2. Click the ⚙️ gear icon (top-right of the popup)
3. Add at least one API key (Gemini is recommended — easiest to get)
4. Click **Save Settings**

### Step 3 – Use it!

- Navigate to any webpage
- Click the PageMind icon
- Hit **"✦ Summarize This Page"** or switch to the **Ask** tab

---

## 🔄 How Fallback Works

```
You click "Summarize"
        ↓
  Try Provider #1 (e.g. Gemini)
        ↓ fails / rate limited
  Try Provider #2 (e.g. Groq)
        ↓ fails / no key
  Try Provider #3 (OpenRouter)
        ↓ succeeds ✓
  Show result + badge: "OpenRouter"
```

The preferred provider (set in Settings) is always tried first. The extension silently skips providers with no API key.

---

## 📁 File Structure

```
web-ai-extension/
├── manifest.json       # Extension config (Manifest V3)
├── popup.html          # Main UI
├── popup.js            # UI logic & tab management
├── content.js          # Extracts page text (injected into pages)
├── background.js       # Service worker (handles AI calls)
├── ai-providers.js     # All 4 AI providers + fallback engine
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔧 Customization

### Add a new AI provider
Edit `ai-providers.js` and add a new entry to the `AI_PROVIDERS` array:

```js
{
  id: 'myprovider',
  name: 'My Provider',
  icon: '🚀',
  async call(apiKey, systemPrompt, userPrompt) {
    const res = await fetch('https://api.myprovider.com/chat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ prompt: systemPrompt + userPrompt })
    });
    const data = await res.json();
    return data.text;
  }
}
```

Then add the key input in `popup.html` and the load/save logic in `popup.js`.

### Change content extraction limit
In `content.js`, change the `12000` character limit:
```js
if (text.length > 12000) { // increase for longer pages
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot read this page" | Extension can't run on chrome:// pages or PDFs. Try a regular webpage. |
| "All providers failed" | Check your API keys in Settings. Make sure at least one is valid. |
| Empty summary | The page may have very little readable text (e.g. a video page) |
| Rate limit errors | Normal on free tiers — the extension auto-falls back to next provider |

---

## 🔒 Privacy

- Your API keys are stored locally in `chrome.storage.sync` (encrypted by Chrome)
- Page content is sent directly to the AI provider you've configured — not through any intermediate server
- No data is collected by PageMind itself

---

*Built with ❤️ using free AI APIs — no subscription required.*
