

function extractPageContent() {

  const unwanted = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 
                     'aside', 'advertisement', '.ad', '.ads', '.cookie-banner',
                     '[aria-hidden="true"]', 'iframe', 'svg'];
  
  const cloned = document.body.cloneNode(true);
  unwanted.forEach(sel => {
    try {
      cloned.querySelectorAll(sel).forEach(el => el.remove());
    } catch(e) {}
  });

  const mainSelectors = ['main', 'article', '[role="main"]', '.main-content', 
                          '#main-content', '.post-content', '.article-body', '.entry-content'];
  let contentEl = null;
  for (const sel of mainSelectors) {
    contentEl = cloned.querySelector(sel);
    if (contentEl) break;
  }
  if (!contentEl) contentEl = cloned;

  let text = contentEl.innerText || contentEl.textContent || '';
  text = text
    .replace(/\s{3,}/g, '\n\n')
    .replace(/\t+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();


  if (text.length > 12000) {
    text = text.substring(0, 12000) + '\n\n[Content truncated for length...]';
  }

  return {
    title: document.title,
    url: window.location.href,
    text: text,
    charCount: text.length
  };
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractContent') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, content });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; 
});
