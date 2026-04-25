// popup.js – no settings UI needed, keys come from config.js

let pageContent = null;
let isLoading = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadPageInfo();
  setupEventListeners();
  showConfigStatus();
});

async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const faviconEl = document.getElementById('page-favicon');
    const titleEl = document.getElementById('page-title');
    try { faviconEl.src = `https://www.google.com/s2/favicons?sz=32&domain=${new URL(tab.url).hostname}`; } catch (e) { }
    faviconEl.onerror = () => { faviconEl.style.display = 'none'; };
    titleEl.textContent = tab.title || tab.url;

    chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        titleEl.textContent = '⚠ Cannot read this page';
        return;
      }
      pageContent = response.content;
      titleEl.textContent = pageContent.title || tab.title;
      const charsEl = document.getElementById('page-chars');
      charsEl.textContent = `${Math.round(pageContent.charCount / 100) / 10}kb`;
      charsEl.style.display = 'block';
    });
  } catch (err) { console.error(err); }
}

function showConfigStatus() {
  // Count how many keys are configured
  const ids = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'HUGGINGFACE_API_KEY'];
  const configured = ids.filter(k => {
    const v = PAGEMIND_CONFIG?.[k] || '';
    return v && !v.startsWith('YOUR_');
  });

  const badge = document.getElementById('active-provider-name');
  if (configured.length === 0) {
    badge.textContent = 'No keys set';
    badge.parentElement.style.borderColor = "#f87171";
    document.getElementById("no-keys-banner").classList.add("visible");
    badge.parentElement.querySelector('.dot').style.background = '#f87171';
  } else {
    const preferred = PAGEMIND_CONFIG?.PREFERRED_PROVIDER;
    const nameMap = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter', huggingface: 'HuggingFace', auto: 'Auto' };
    badge.textContent = `${configured.length} key${configured.length > 1 ? 's' : ''} · ${nameMap[preferred] || 'Auto'}`;
  }
}

function setupEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => { if (!isLoading) switchTab(tab.dataset.tab); });
  });
  document.getElementById('summarize-btn').addEventListener('click', handleSummarize);
  document.getElementById('copy-sum-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('sum-text').textContent).then(() => {
      const btn = document.getElementById('copy-sum-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  });
  document.getElementById('ask-btn').addEventListener('click', handleAsk);
  document.getElementById('qa-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAsk();
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-summarize').style.display = tab === 'summarize' ? 'flex' : 'none';
  document.getElementById('tab-qa').style.display = tab === 'qa' ? 'flex' : 'none';
}

async function handleSummarize() {
  if (isLoading) return;
  if (!pageContent) { showError('sum', [{ provider: 'Page', error: 'Could not read page. Try refreshing.' }]); return; }
  isLoading = true;
  setLoading('sum', true, 'Analyzing page...');
  hideOutput('sum');
  try {
    const result = await callBackground('summarize');
    result.success ? showOutput('sum', result.text, result.provider, result.icon) : showError('sum', result.errors);
  } catch (err) { showError('sum', [{ provider: 'Extension', error: err.message }]); }
  finally { setLoading('sum', false); isLoading = false; }
}

async function handleAsk() {
  if (isLoading) return;
  const question = document.getElementById('qa-input').value.trim();
  if (!question) { 
    document.getElementById('qa-input').focus(); 
    return; 
  }
  
  if (!pageContent) { 
    showError('qa', [{ provider: 'Page', error: 'Could not read page. Try refreshing.' }]); 
    return; 
  }
  
  isLoading = true;
  document.getElementById('qa-input').disabled = true;
  setLoading('qa', true, 'Finding answer...');
  hideError('qa');
  
  try {
    const result = await callBackground('qa', question);
    if (result.success) {
      addQAItem(question, result.text, result.provider);
      document.getElementById('qa-input').value = '';
    } else { 
      showError('qa', result.errors); 
    }
  } catch (err) { 
    showError('qa', [{ provider: 'Extension', error: err.message }]); 
  } finally { 
    setLoading('qa', false); 
    document.getElementById('qa-input').disabled = false; 
    isLoading = false; 
  }
}


function callBackground(task, question = null) {
  return new Promise((resolve, reject) => {
    const providerEl = document.getElementById(`${task === 'summarize' ? 'sum' : 'qa'}-loading-provider`);
    const msgs = ['Trying Gemini...', 'Trying Groq...', 'Trying OpenRouter...', 'Trying HuggingFace...'];
    let i = 0;
    const iv = setInterval(() => { if (providerEl && i < msgs.length) providerEl.textContent = msgs[i++]; }, 3000);
    chrome.runtime.sendMessage({ action: 'runAI', task, pageContent, question }, result => {
      clearInterval(iv);
      chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(result);
    });
  });
}

function setLoading(p, on, text = '') {
  const el = document.getElementById(`${p}-loading`);
  const textEl = document.getElementById(`${p}-loading-text`);
  el.classList.toggle('visible', on);
  if (text && textEl) textEl.textContent = text;
  const btn = document.getElementById(p === 'sum' ? 'summarize-btn' : 'ask-btn');
  if (btn) btn.disabled = on;
}

function showOutput(p, text, provider, icon = '') {
  if (p === 'sum') {
    document.getElementById('sum-text').innerHTML = renderMarkdown(text);
    document.getElementById('sum-provider-tag').innerHTML = `${icon} Generated by ${provider}`;
    document.getElementById('sum-output').classList.add('visible');
    hideError('sum');
  }
}

function hideOutput(p) {
  if (p === 'sum') { document.getElementById('sum-output').classList.remove('visible'); hideError('sum'); }
}

function showError(p, errors) {
  const box = document.getElementById(`${p}-error`);
  document.getElementById(`${p}-error-list`).innerHTML = (errors || []).map(e => `<li>${esc(e.provider)}: ${esc(e.error.substring(0, 80))}</li>`).join('');
  box.classList.add('visible');
}

function hideError(p) { document.getElementById(`${p}-error`).classList.remove('visible'); }

function addQAItem(q, a, provider) {
  const h = document.getElementById('qa-history');
  const el = document.createElement('div');
  el.className = 'qa-item';
  el.innerHTML = `<div class="qa-question">Q: ${esc(q)}</div><div class="qa-answer rendered">${renderMarkdown(a)}</div>`;
  h.insertBefore(el, h.firstChild);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdown(t) {
  return esc(t)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
