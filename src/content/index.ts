import { InspoOverlay } from './overlay';
import { isSiteDisabled } from '../storage/settings';

let overlayInstance: InspoOverlay | null = null;

async function checkAndInit() {
  // Prevent duplicate instances
  if (overlayInstance || document.getElementById('inspo-shadow-host')) {
    return;
  }

  try {
    const disabled = await isSiteDisabled(window.location.hostname);
    if (disabled) {
      return;
    }

    overlayInstance = new InspoOverlay();
  } catch (err) {
    console.error('[Inspo] Failed to initialize overlay:', err);
  }
}

// Listen for dynamic settings changes (e.g. from context menu or settings modal)
chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message && message.type === 'SETTINGS_UPDATED') {
    (async () => {
      const disabled = await isSiteDisabled(window.location.hostname);
      if (disabled) {
        if (overlayInstance) {
          overlayInstance.destroy();
          overlayInstance = null;
        }
      } else {
        if (!overlayInstance && !document.getElementById('inspo-shadow-host')) {
          overlayInstance = new InspoOverlay();
        }
      }
    })();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndInit);
} else {
  checkAndInit();
}
