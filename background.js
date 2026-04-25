// background.js – loads config.js first, then ai-providers.js

importScripts('config.js', 'ai-providers.js');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'runAI') {
    callAIWithFallback(message.task, message.pageContent, message.question)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, text: err.message, errors: [] }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'pagemind-summarize',
    title: '🧠 Summarize this page (PageMind)',
    contexts: ['page', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'pagemind-summarize') chrome.action.openPopup();
});
