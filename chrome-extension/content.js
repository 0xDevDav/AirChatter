(function() {
  'use strict';

  let aiButtonSimple = null;
  let aiButtonFull = null;
  let bootstrapLoaded = false;

  // Load Bootstrap CSS and JS from extension local files
  function loadBootstrap() {
    if (bootstrapLoaded) return;

    try {
      // Set dark theme on the entire site
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      document.body.style.backgroundColor = '#121212';

      // Bootstrap CSS
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = chrome.runtime.getURL('bootstrap.min.css');
      document.head.appendChild(css);

      // Bootstrap Icons CSS
      const icons = document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = chrome.runtime.getURL('bootstrap-icons.min.css');
      document.head.appendChild(icons);

      // Bootstrap JS
      const js = document.createElement('script');
      js.src = chrome.runtime.getURL('bootstrap.bundle.min.js');
      js.onload = () => console.log('[AI Extractor] Bootstrap JS loaded');
      document.head.appendChild(js);

      bootstrapLoaded = true;
      console.log('[AI Extractor] Bootstrap loaded with dark theme');
    } catch (e) {
      console.log('[AI Extractor] Error loading Bootstrap:', e);
    }
  }

  // Create button with same style as Script (copy classes from existing button)
  function createAIButton(id, text, includeModelInfo) {
    const scriptBtn = findScriptButton();
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.tabIndex = 0;
    button.textContent = text;

    // Copy classes from Script button if it exists
    if (scriptBtn) {
      button.className = scriptBtn.className;
    }

    button.addEventListener('click', () => handleAIButtonClick(includeModelInfo));
    return button;
  }

  // Create simple AI button (without model info)
  function createAIButtonSimple() {
    return createAIButton('ai-button-simple', 'AI', false);
  }

  // Create full AI button (with model info)
  function createAIButtonFull() {
    return createAIButton('ai-button-full', 'AI+', true);
  }

  // Extract chat messages
  function extractChatMessages() {
    const messages = [];
    let chatContainer = document.querySelector('.infinite-scroll-component');
    if (!chatContainer) {
      chatContainer = document.querySelector('[class*="infinite-scroll"]');
    }
    if (!chatContainer) {
      return { type: 'error', content: 'Chat container not found' };
    }

    const allGridItems = document.querySelectorAll('div[class*="MuiGrid-item"][id]');

    allGridItems.forEach((block) => {
      const id = block.getAttribute('id');
      if (!id || !/^\d+$/.test(id)) return;

      const hasCheckIcon = block.querySelector('[data-testid="CheckIcon"], [data-testid="DoneAllIcon"]');
      const hasAlignRight = block.querySelector('[class*="MuiTypography-alignRight"]');
      const hasAlignLeft = block.querySelector('[class*="MuiTypography-alignLeft"]');

      // Determine sender based on timestamp alignment
      let sender = 'unknown';
      if (hasAlignRight || hasCheckIcon) {
        sender = 'sent';
      } else if (hasAlignLeft) {
        sender = 'received';
      }

      // Extract timestamp (h6 with subtitle2)
      let timestamp = '';
      const timeElements = block.querySelectorAll('h6[class*="MuiTypography-subtitle2"]');
      timeElements.forEach(el => {
        const text = el.innerText?.trim();
        // Timestamp is like "19:31" - pattern HH:MM
        if (text && /^\d{1,2}:\d{2}$/.test(text)) {
          timestamp = text;
        }
      });

      // Extract chatter name who sent (for sent messages)
      let chatterName = null;
      if (sender === 'sent') {
        const chatterEl = block.querySelector('h6[class*="MuiTypography-subtitle2"]:not([class*="alignRight"]):not([class*="alignLeft"])');
        if (chatterEl) {
          const name = chatterEl.innerText?.trim();
          if (name && !/^\d{1,2}:\d{2}$/.test(name)) {
            chatterName = name;
          }
        }
      }

      // Extract quoted/reply message if present
      let quotedMessage = null;
      const captionEl = block.querySelector('[class*="MuiTypography-caption"]');
      if (captionEl) {
        const captionText = captionEl.innerText?.trim(); // e.g., "Clarissa, Today 7:15 PM"
        // Look for quoted text (usually in an h6 before the divider)
        const divider = block.querySelector('[class*="MuiDivider"]');
        if (divider) {
          const quotedTextEl = divider.previousElementSibling;
          if (quotedTextEl && quotedTextEl.tagName === 'H6') {
            quotedMessage = {
              context: captionText,
              text: quotedTextEl.innerText?.trim()?.replace(/^"|"$/g, '') // remove quotes
            };
          }
        }
      }

      // Extract main message text (exclude quoted text)
      let messageText = '';
      const cardContent = block.querySelector('[class*="MuiCardContent-root"]');
      if (cardContent) {
        // If there's a divider, only take text AFTER the divider
        const divider = cardContent.querySelector('[class*="MuiDivider"]');
        if (divider && divider.nextElementSibling) {
          messageText = divider.nextElementSibling.innerText?.trim() || '';
        } else {
          // Otherwise get all h6
          const textElements = cardContent.querySelectorAll('h6[class*="MuiTypography-h6"]');
          textElements.forEach(el => {
            // Avoid getting quoted text
            if (!el.closest('[class*="css-1lxwves"]')) {
              const text = el.innerText?.trim();
              if (text) messageText += (messageText ? ' ' : '') + text;
            }
          });
        }
      }

      // Fallback if not found in card content
      if (!messageText) {
        const textElements = block.querySelectorAll('h6[class*="MuiTypography-h6"]');
        textElements.forEach(el => {
          const text = el.innerText?.trim();
          if (text && text !== quotedMessage?.text) {
            messageText += (messageText ? ' ' : '') + text;
          }
        });
      }

      if (sender === 'unknown' && !messageText) return;

      // Detect media (blurred images = locked content, no blur = unlocked)
      let hasMedia = false;
      let mediaCount = 0;
      let mediaLocked = false;
      const slickSlider = block.querySelector('.slick-slider');
      if (slickSlider) {
        hasMedia = true;
        const slides = slickSlider.querySelectorAll('.slick-slide');
        mediaCount = slides.length || 1;
        // Check if there's blur (locked content)
        const blurDiv = slickSlider.querySelector('[style*="blur"]');
        mediaLocked = !!blurDiv;
      }
      // Fallback for other media types
      if (!hasMedia) {
        const mediaElements = block.querySelectorAll('img[src*="api-"], video');
        if (mediaElements.length > 0) {
          hasMedia = true;
          mediaCount = mediaElements.length;
        }
      }

      // Extract price if present
      let price = null;
      const priceText = block.innerText;
      const priceMatch = priceText.match(/\$[\d.]+/);
      if (priceMatch) {
        price = priceMatch[0];
      }

      // Read status (DoneAllIcon = read, CheckIcon = delivered)
      let readStatus = null;
      if (sender === 'sent') {
        if (block.querySelector('[data-testid="DoneAllIcon"]')) {
          readStatus = 'read';
        } else if (block.querySelector('[data-testid="CheckIcon"]')) {
          readStatus = 'delivered';
        }
      }

      messages.push({
        id: id,
        sender: sender,
        text: messageText,
        time: timestamp,
        hasMedia: hasMedia,
        mediaCount: mediaCount,
        mediaLocked: mediaLocked,
        price: price,
        quotedMessage: quotedMessage,
        chatterName: chatterName,
        readStatus: readStatus
      });
    });

    return {
      type: 'messages',
      count: messages.length,
      content: messages
    };
  }

  // Find message textarea
  function findMessageTextarea() {
    const textarea = document.querySelector('textarea[id^="message-ui-text-field-"]');
    if (textarea) return textarea;
    return document.querySelector('textarea[placeholder="Type a message..."]');
  }

  // Extract fan info (username and user ID) from sidebar
  function extractFanInfo() {
    // Look for element with username (span with MuiListItemText-primary)
    const usernameEl = document.querySelector('[class*="MuiListItemText-primary"]');
    // Look for element with user ID (p with MuiListItemText-secondary containing @u...)
    const userIdEl = document.querySelector('[class*="MuiListItemText-secondary"]');

    let username = null;
    let userId = null;

    if (usernameEl) {
      username = usernameEl.textContent?.trim() || null;
    }

    if (userIdEl) {
      const text = userIdEl.textContent?.trim() || '';
      // Extract only the ID (remove @ if present)
      if (text.startsWith('@')) {
        userId = text.substring(1);
      } else {
        userId = text;
      }
    }

    return { username, userId };
  }

  // Extract model name from active tab
  function extractModelName() {
    const activeTab = document.querySelector('.w-tabs-draggable-item.w-active');
    if (activeTab) {
      const h6 = activeTab.querySelector('h6.MuiTypography-subtitle2, h6[class*="MuiTypography-subtitle2"]');
      if (h6 && h6.textContent) return h6.textContent.trim();

      const img = activeTab.querySelector('img[alt]');
      if (img && img.alt) return img.alt.trim();
    }

    const tabImages = document.querySelectorAll('.w-tabs-draggable-item img[alt]');
    for (const img of tabImages) {
      if (img.alt && img.alt.length > 0) return img.alt.trim();
    }
    return null;
  }

  // Show notification toast with Bootstrap
  function showNotification(message, isError = false) {
    const existing = document.getElementById('ai-toast-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'ai-toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '999999';

    const toast = document.createElement('div');
    toast.className = `toast show align-items-center ${isError ? 'text-bg-danger' : 'text-bg-primary'}`;
    toast.setAttribute('role', 'alert');

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body fw-semibold">
          ${message}
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    container.appendChild(toast);
    document.body.appendChild(container);

    toast.querySelector('.btn-close').addEventListener('click', () => container.remove());
    setTimeout(() => container.remove(), isError ? 5000 : 3000);
  }

  // Show error modal with Bootstrap
  function showErrorModal(title, message) {
    const existing = document.getElementById('ai-error-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ai-error-modal';
    modal.className = 'modal fade show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-danger">
          <div class="modal-header border-danger">
            <h5 class="modal-title text-danger">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>${title}
            </h5>
            <button type="button" class="btn-close" id="close-error-modal"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" id="dismiss-error-modal">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#close-error-modal').addEventListener('click', closeModal);
    modal.querySelector('#dismiss-error-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  }

  // Show modal with multiple responses
  async function showMultipleResponsesModal(responses, textarea) {
    const existing = document.getElementById('ai-responses-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ai-responses-modal';
    modal.className = 'modal fade show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '999999';

    // Extract fan info
    const fanInfo = extractFanInfo();

    // Normalize responses: supports both new format {text, it} and old string format
    const normalizedResponses = responses.map(r => {
      if (typeof r === 'string') {
        return { text: r, it: r };
      }
      return { text: r.text || r, it: r.it || r.text || r };
    });

    let cardsHTML = '';
    for (let i = 0; i < normalizedResponses.length; i++) {
      const response = normalizedResponses[i];
      const showTranslation = response.text !== response.it;
      cardsHTML += `
        <div class="card mb-2 response-card" data-index="${i}" style="cursor: pointer; transition: all 0.2s;">
          <div class="card-body py-2 px-3">
            <p class="card-text mb-1">${escapeHtml(response.text)}</p>
            ${showTranslation ? `<small class="text-info"><i class="bi bi-translate"></i> ${escapeHtml(response.it)}</small>` : ''}
          </div>
        </div>
      `;
    }

    // Build header with fan info if available
    let fanInfoHTML = '';
    if (fanInfo.username || fanInfo.userId) {
      fanInfoHTML = `
        <div class="d-flex align-items-center ms-3">
          <i class="bi bi-person-fill text-info me-2"></i>
          <span class="text-info fw-semibold">${fanInfo.username || 'User'}</span>
          ${fanInfo.userId ? `<small class="text-secondary ms-2">@${escapeHtml(fanInfo.userId)}</small>` : ''}
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <div class="d-flex align-items-center">
              <h5 class="modal-title mb-0">
                <i class="bi bi-chat-quote-fill me-2 text-primary"></i>Choose a response
              </h5>
              ${fanInfoHTML}
            </div>
            <button type="button" class="btn-close" id="close-responses-modal"></button>
          </div>
          <div class="modal-body">
            ${cardsHTML}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-primary" id="regenerate-btn">
              <i class="bi bi-arrow-clockwise"></i> Regenerate
            </button>
            <button type="button" class="btn btn-outline-secondary" id="cancel-responses-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Click on card to select response
    modal.querySelectorAll('.response-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.classList.add('border-primary');
      });
      card.addEventListener('mouseleave', () => {
        card.classList.remove('border-primary');
      });
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.index);
        let selectedText = normalizedResponses[index].text.trim();
        if (selectedText.length > 0) {
          selectedText = selectedText.charAt(0).toUpperCase() + selectedText.slice(1);
        }
        textarea.value = '';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.value = selectedText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.focus();
        modal.remove();
        showNotification('✅ Response inserted!');
      });
    });

    // Close modal
    const closeModal = () => modal.remove();
    modal.querySelector('#close-responses-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancel-responses-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Regenerate
    modal.querySelector('#regenerate-btn').addEventListener('click', () => {
      modal.remove();
      // Retrigger click to regenerate
      const lastClickedButton = document.getElementById('ai-button-full') || document.getElementById('ai-button-simple');
      if (lastClickedButton) lastClickedButton.click();
    });
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Handle AI button click
  async function handleAIButtonClick(includeModelInfo = true) {
    const textarea = findMessageTextarea();
    if (!textarea) {
      showNotification('❌ Textarea not found', true);
      return;
    }

    const chatData = extractChatMessages();
    if (chatData.type === 'error') {
      showNotification('❌ ' + chatData.content, true);
      return;
    }
    if (chatData.count === 0) {
      showNotification('❌ No messages found', true);
      return;
    }

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });

    let conversationText = `CURRENT TIME: ${time} (${day})\n\nCONVERSATION (${chatData.count} messages):\n\n`;
    const messagesReversed = [...chatData.content].reverse();

    messagesReversed.forEach((msg) => {
      const senderLabel = msg.sender === 'sent' ? '[CREATOR]' : '[USER]';
      conversationText += `${senderLabel} ${msg.time}\n`;

      // If it's a reply to a previous message
      if (msg.quotedMessage) {
        conversationText += `> Reply to: "${msg.quotedMessage.text}"\n`;
      }

      if (msg.text) conversationText += `${msg.text}\n`;

      // Media with details
      if (msg.hasMedia) {
        if (msg.mediaLocked) {
          conversationText += `[Locked media: ${msg.mediaCount} files - NOT UNLOCKED]\n`;
        } else {
          conversationText += `[Media: ${msg.mediaCount} files]\n`;
        }
      }

      if (msg.price) conversationText += `[Price: ${msg.price}]\n`;

      // Read status for sent messages
      if (msg.readStatus === 'read') {
        conversationText += `[Read ✓✓]\n`;
      }

      conversationText += `\n`;
    });

    conversationText += `\n---\nSuggest ONE response to continue the conversation.`;

    let modelName = null;
    let modelProfile = null;

    // Extract fan info
    const fanInfo = extractFanInfo();
    console.log('[AI Extractor] Fan detected:', fanInfo.username, fanInfo.userId);

    if (includeModelInfo) {
      modelName = extractModelName();
      console.log('[AI Extractor] Model detected:', modelName);
      showNotification('<i class="bi bi-robot"></i> AI+ generating response...');
    } else {
      showNotification('<i class="bi bi-lightning-charge"></i> AI fast generation...');
    }

    if (!chrome?.storage?.sync || !chrome?.runtime?.id) {
      showErrorModal('Extension Reloaded', 'The extension was updated. Reload the page (F5) and try again.');
      return;
    }

    try {
      chrome.storage.sync.get(['aiProvider', 'claudeApiKey', 'openaiApiKey', 'modelProfiles', 'multipleResponses'], async (result) => {
        const provider = result.aiProvider || 'claude';
        const hasApiKey = provider === 'claude' ? result.claudeApiKey : result.openaiApiKey;
        const useMultiple = result.multipleResponses || false;

        if (!hasApiKey) {
          showNotification('⚠️ Configure API key in options', true);
          return;
        }

        if (includeModelInfo && modelName && result.modelProfiles) {
          modelProfile = result.modelProfiles[modelName];
          if (modelProfile) {
            console.log('[AI Extractor] Profile found for:', modelName);
          }
        }

        try {
          if (useMultiple) {
            // Multiple responses
            const response = await chrome.runtime.sendMessage({
              action: 'callAIMultiple',
              messages: conversationText,
              modelName: includeModelInfo ? modelName : null,
              modelProfile: includeModelInfo ? modelProfile : null,
              fanName: fanInfo.username
            });

            if (response && response.success && response.data) {
              showMultipleResponsesModal(response.data, textarea);
            } else {
              const errorMsg = response?.error || 'Unknown error';
              console.error('[AI Extractor] API error:', errorMsg);
              showErrorModal('Generation Error', errorMsg);
            }
          } else {
            // Single response
            const response = await chrome.runtime.sendMessage({
              action: 'callAI',
              messages: conversationText,
              modelName: includeModelInfo ? modelName : null,
              modelProfile: includeModelInfo ? modelProfile : null,
              fanName: fanInfo.username
            });

            if (response && response.success) {
              let suggestedText = response.data.trim();
              if (suggestedText.length > 0) {
                suggestedText = suggestedText.charAt(0).toUpperCase() + suggestedText.slice(1);
              }
              textarea.value = '';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.value = suggestedText;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
              textarea.focus();
              showNotification('✅ Response inserted!');
            } else {
              const errorMsg = response?.error || 'Unknown error';
              console.error('[AI Extractor] API error:', errorMsg);
              showErrorModal('Generation Error', errorMsg);
            }
          }
        } catch (error) {
          console.error('[AI Extractor] Error:', error);
          showErrorModal('Error', error.message || 'Connection error');
        }
      });
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        showErrorModal('Extension Reloaded', 'The extension was updated. Reload the page (F5) and try again.');
      } else {
        showErrorModal('Error', error.message || 'Unknown error');
      }
    }
  }

  // Find Script button
  function findScriptButton() {
    // Look for button containing "Script" in text
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('Script')) {
        return btn;
      }
    }
    return null;
  }

  // Inject AI buttons next to Script button
  function injectButton() {
    if (document.getElementById('ai-buttons-container')) {
      return;
    }

    const scriptButton = findScriptButton();

    if (scriptButton) {
      // Create container for AI buttons
      const container = document.createElement('div');
      container.id = 'ai-buttons-container';
      container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-right: 8px;';

      aiButtonSimple = createAIButtonSimple();
      aiButtonFull = createAIButtonFull();

      container.appendChild(aiButtonSimple);
      container.appendChild(aiButtonFull);

      // Insert before Script button
      scriptButton.parentElement.insertBefore(container, scriptButton);

      console.log('[AI Extractor] AI buttons added next to Script');
    } else {
      console.log('[AI Extractor] Script button not found, retrying...');
    }
  }

  // Observe DOM changes
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!document.getElementById('ai-buttons-container')) {
        injectButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialization
  function init() {
    // Load Bootstrap (non-blocking)
    loadBootstrap();

    // Try immediately
    injectButton();

    // If not found, retry after delay
    if (!document.getElementById('ai-buttons-container')) {
      setTimeout(injectButton, 1000);
      setTimeout(injectButton, 2000);
      setTimeout(injectButton, 3000);
    }

    // Setup observer for dynamic content
    setupObserver();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
