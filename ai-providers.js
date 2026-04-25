// ai-providers.js – reads keys from config.js automatically

const AI_PROVIDERS = [
  {
    id: 'gemini', name: 'Google Gemini', icon: '',
    async call(apiKey, sys, user) {
      // Try multiple Gemini models in order (newest to oldest)
      const models = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-pro-latest',
        'gemini-pro'
      ];
      
      let lastError = null;
      
      for (const model of models) {
        try {
          console.log(`[PageMind] Trying Gemini model: ${model}...`);
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              contents: [{ parts: [{ text: sys + '\n\n' + user }] }], 
              generationConfig: { maxOutputTokens: 1024, temperature: 0.4 } 
            })
          });
          
          if (res.ok) {
            const d = await res.json();
            const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              console.log(`[PageMind] Gemini model ${model} succeeded!`);
              return text;
            }
          } else {
            const errorText = await res.text();
            lastError = `${model}: ${res.status} ${errorText}`;
            console.log(`[PageMind] Gemini ${model} failed (${res.status}), trying next...`);
          }
        } catch (err) {
          lastError = `${model}: ${err.message}`;
          console.log(`[PageMind] Gemini ${model} error: ${err.message}`);
        }
      }
      
      throw new Error(lastError || 'All Gemini models failed');
    }
  },
  {
    id: 'groq', name: 'Groq (Llama 3.1)', icon: '',
    async call(apiKey, sys, user) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}` 
        },
        body: JSON.stringify({ 
          model: 'llama-3.1-8b-instant', 
          messages: [
            { role: 'system', content: sys }, 
            { role: 'user', content: user }
          ], 
          max_tokens: 1024, 
          temperature: 0.4 
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq ${res.status}: ${errorText}`);
      }
      const d = await res.json();
      return d.choices?.[0]?.message?.content || '';
    }
  },
  {
    id: 'openrouter', name: 'OpenRouter', icon: '',
    async call(apiKey, sys, user) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}`, 
          'HTTP-Referer': 'chrome-extension://pagemind', 
          'X-Title': 'PageMind AI' 
        },
        body: JSON.stringify({ 
          model: 'qwen/qwen-2.5-7b-instruct:free', 
          messages: [
            { role: 'system', content: sys }, 
            { role: 'user', content: user }
          ], 
          max_tokens: 1024 
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errorText}`);
      }
      const d = await res.json();
      return d.choices?.[0]?.message?.content || '';
    }
  },
  {
    id: 'huggingface', name: 'HuggingFace', icon: '',
    async call(apiKey, sys, user) {
      const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}` 
        },
        body: JSON.stringify({ 
          model: 'mistralai/Mistral-7B-Instruct-v0.3', 
          messages: [
            { role: 'system', content: sys }, 
            { role: 'user', content: user }
          ], 
          max_tokens: 1024 
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HuggingFace ${res.status}: ${errorText}`);
      }
      const d = await res.json();
      return d.choices?.[0]?.message?.content || '';
    }
  }
];

const CONFIG_KEY_MAP = { 
  gemini: 'GEMINI_API_KEY', 
  groq: 'GROQ_API_KEY', 
  openrouter: 'OPENROUTER_API_KEY', 
  huggingface: 'HUGGINGFACE_API_KEY' 
};

function getKeyFromConfig(id) {
  const val = PAGEMIND_CONFIG?.[CONFIG_KEY_MAP[id]] || '';
  return (!val || val.startsWith('YOUR_')) ? null : val.trim();
}

async function callAIWithFallback(task, pageContent, question = null) {
  const preferred = PAGEMIND_CONFIG?.PREFERRED_PROVIDER || 'auto';
  
  let sys, user;
  
  if (task === 'summarize') {
    sys = `You are PageMind, an AI assistant that helps users understand web pages. Be concise, accurate, and helpful. Format your response clearly.`;
    user = `Summarize this webpage:\n- **Main Topic**\n- **Key Points** (3-5 bullets)\n- **Conclusion**\n\nTITLE: ${pageContent.title}\nURL: ${pageContent.url}\n\nCONTENT:\n${pageContent.text}`;
  } else {
    sys = `You are PageMind, an AI assistant. Answer questions about the webpage content provided. Be helpful and accurate.`;
    user = `Based on this webpage, answer the question.\n\nQUESTION: ${question}\n\nWEBPAGE TITLE: ${pageContent.title}\nWEBPAGE URL: ${pageContent.url}\n\nWEBPAGE CONTENT:\n${pageContent.text}\n\nProvide a clear answer based on the content above.`;
  }

  let providers = [...AI_PROVIDERS];
  if (preferred !== 'auto') {
    providers.sort((a, b) => a.id === preferred ? -1 : b.id === preferred ? 1 : 0);
  }

  const errors = [];
  for (const p of providers) {
    const key = getKeyFromConfig(p.id);
    if (!key) { 
      console.log(`[PageMind] Skipping ${p.name} - no key configured`);
      errors.push({ provider: p.name, error: 'No key in config.js' }); 
      continue; 
    }
    
    try {
      console.log(`[PageMind] Trying ${p.name}...`);
      const result = await p.call(key, sys, user);
      if (result?.trim()) {
        console.log(`[PageMind] ${p.name} succeeded!`);
        return { 
          success: true, 
          text: result.trim(), 
          provider: p.name, 
          providerId: p.id, 
          icon: p.icon 
        };
      }
      throw new Error('Empty response');
    } catch (err) {
      console.warn(`[PageMind] ${p.name} failed:`, err.message);
      errors.push({ provider: p.name, error: err.message });
    }
  }
  
  console.error('[PageMind] All providers failed');
  return { 
    success: false, 
    errors, 
    text: 'All providers failed. Check config.js and console for details.' 
  };
}
