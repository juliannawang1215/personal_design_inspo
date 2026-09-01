import { InspoOverlay } from './overlay';

function init() {
  // Prevent multiple injections
  if (document.getElementById('inspo-shadow-host')) return;

  try {
    new InspoOverlay();
  } catch (err) {
    console.error('[Inspo] Failed to initialize overlay:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
