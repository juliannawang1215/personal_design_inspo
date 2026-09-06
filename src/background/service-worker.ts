import { saveVisual, isDuplicate, updateNote } from '../storage/db';
import {
  getSettings,
  addDisabledDomain,
  removeDisabledDomain,
  setGlobalPause,
  isSiteDisabled,
  normalizeDomain,
} from '../storage/settings';
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

// Setup context menus
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'inspo-open-library',
      title: 'Open Inspo Library',
      contexts: ['all'],
    });

    chrome.contextMenus.create({
      id: 'inspo-disable-site',
      title: 'Inspo: Disable on this site',
      contexts: ['page', 'image', 'video', 'link'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'inspo-open-library') {
    await openLibraryTab();
  } else if (info.menuItemId === 'inspo-disable-site' && tab?.url) {
    try {
      const domain = normalizeDomain(tab.url);
      if (domain) {
        await addDisabledDomain(domain);
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Inspo Background] Context menu disable error:', err);
    }
  }
});

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
      } else if (message.type === 'GET_SETTINGS') {
        const settings = await getSettings();
        sendResponse({ success: true, data: settings } as MessageResponse);
      } else if (message.type === 'DISABLE_SITE') {
        const updated = await addDisabledDomain(message.payload.domain);
        sendResponse({ success: true, data: updated } as MessageResponse);
      } else if (message.type === 'ENABLE_SITE') {
        const updated = await removeDisabledDomain(message.payload.domain);
        sendResponse({ success: true, data: updated } as MessageResponse);
      } else if (message.type === 'TOGGLE_GLOBAL_PAUSE') {
        const updated = await setGlobalPause(message.payload.paused);
        sendResponse({ success: true, data: updated } as MessageResponse);
      } else if (message.type === 'CHECK_DOMAIN_DISABLED') {
        const disabled = await isSiteDisabled(message.payload.domain);
        sendResponse({ success: true, data: { disabled } } as MessageResponse);
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
