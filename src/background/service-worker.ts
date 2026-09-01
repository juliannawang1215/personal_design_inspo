import { saveVisual, isDuplicate, updateNote } from '../storage/db';
import type { MessageRequest, MessageResponse } from '../storage/types';

// Open library page when user clicks extension action icon in toolbar
chrome.action.onClicked.addListener(async () => {
  await openLibraryTab();
});

async function openLibraryTab() {
  const libraryUrl = chrome.runtime.getURL('library.html');
  const tabs = await chrome.tabs.query({ url: libraryUrl });

  if (tabs.length > 0 && tabs[0].id) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: libraryUrl });
  }
}

// Handle messages from content scripts & UI
chrome.runtime.onMessage.addListener((message: MessageRequest, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'SAVE_VISUAL') {
        const { item, isDuplicate: duplicate } = await saveVisual(message.payload);

        // Sanitize item to prevent Blob DataCloneError during chrome message serialization
        const safeItem = {
          id: item.id,
          imageUrl: item.imageUrl,
          mimeType: item.mimeType,
          mediaType: item.mediaType,
          sourceUrl: item.sourceUrl,
          sourceTitle: item.sourceTitle,
          note: item.note,
          width: item.width,
          height: item.height,
          createdAt: item.createdAt,
        };

        // Notify open library views of new visual item
        chrome.runtime.sendMessage({ type: 'LIBRARY_UPDATED' }).catch(() => {});

        sendResponse({ success: true, data: { item: safeItem, isDuplicate: duplicate } } as MessageResponse);
      } else if (message.type === 'CHECK_DUPLICATE') {
        const existing = await isDuplicate(message.payload.imageUrl, message.payload.sourceUrl);

        const safeItem = existing
          ? {
              id: existing.id,
              imageUrl: existing.imageUrl,
              mimeType: existing.mimeType,
              mediaType: existing.mediaType,
              sourceUrl: existing.sourceUrl,
              sourceTitle: existing.sourceTitle,
              note: existing.note,
              width: existing.width,
              height: existing.height,
              createdAt: existing.createdAt,
            }
          : null;

        sendResponse({ success: true, data: { isDuplicate: !!existing, item: safeItem } } as MessageResponse);
      } else if (message.type === 'UPDATE_NOTE') {
        await updateNote(message.payload.id, message.payload.note);
        chrome.runtime.sendMessage({ type: 'LIBRARY_UPDATED' }).catch(() => {});
        sendResponse({ success: true } as MessageResponse);
      } else if (message.type === 'OPEN_LIBRARY') {
        await openLibraryTab();
        sendResponse({ success: true } as MessageResponse);
      } else {
        sendResponse({ success: false, error: 'Unknown message type' } as MessageResponse);
      }
    } catch (err: unknown) {
      console.error('[Inspo Background] Error processing message:', err);
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      } as MessageResponse);
    }
  })();

  return true; // Keep message channel open for async response
});
