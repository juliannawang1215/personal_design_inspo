import overlayStyles from './overlay.css?raw';
import {
  findTargetVisualElement,
  getDetectedVisualInfo,
  isValidVisualElement,
  type DetectedVisualInfo,
} from './image-detector';
import type { MessageRequest, MessageResponse, SaveVisualPayload, VisualItem } from '../storage/types';

export class InspoOverlay {
  private shadowHost: HTMLElement;
  private shadowRoot: ShadowRoot;
  private container: HTMLDivElement;
  private saveBtn: HTMLButtonElement;
  private popover: HTMLDivElement;
  private noteInput: HTMLTextAreaElement;
  private doneBtn: HTMLButtonElement;
  private statusText: HTMLSpanElement;
  private disableSiteBtn: HTMLButtonElement;

  private currentVisualInfo: DetectedVisualInfo | null = null;
  private currentSavedId: string | null = null;
  private currentNote = '';
  private isPopoverOpen = false;
  private isSaving = false;
  private hideTimeout: number | null = null;
  private isHoveringOverlay = false;
  private isDestroyed = false;

  // Local cache of saved items for instant hover state
  private savedCache = new Map<string, { id: string; note?: string }>();

  // Event handler references for clean removal
  private handleMouseOverBound: (e: MouseEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleClickOutsideBound: (e: MouseEvent) => void;
  private handleScrollBound: () => void;

  constructor() {
    this.handleMouseOverBound = this.handleMouseOver.bind(this);
    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleClickOutsideBound = this.handleClickOutside.bind(this);
    this.handleScrollBound = this.handleScroll.bind(this);

    // 1. Create Shadow Host on root documentElement
    this.shadowHost = document.createElement('div');
    this.shadowHost.id = 'inspo-shadow-host';
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = overlayStyles;
    this.shadowRoot.appendChild(styleEl);

    // 2. Build DOM inside Shadow Root
    this.container = document.createElement('div');
    this.container.className = 'inspo-overlay-container';

    // Save Button (Linear Pill 9999px radius, pure typography)
    this.saveBtn = document.createElement('button');
    this.saveBtn.className = 'inspo-save-btn';
    this.saveBtn.setAttribute('type', 'button');
    this.saveBtn.setAttribute('aria-label', 'Save to Inspo library');
    this.saveBtn.innerHTML = `<span class="inspo-btn-label">Save</span>`;

    // Note Popover (Linear 12px radius)
    this.popover = document.createElement('div');
    this.popover.className = 'inspo-note-popover';
    this.popover.setAttribute('role', 'dialog');
    this.popover.setAttribute('aria-label', 'Add note to reference');
    this.popover.innerHTML = `
      <div class="inspo-popover-header">
        <span class="inspo-popover-status">
          <span class="inspo-status-label">Saved</span>
        </span>
        <div class="inspo-header-actions">
          <button type="button" class="inspo-site-disable-btn" title="Don't show Inspo on this website">Disable on site</button>
        </div>
      </div>
      <textarea class="inspo-note-input" placeholder="Add a note... (Cmd+Enter to save)" rows="2" aria-label="Reference note"></textarea>
      <div class="inspo-popover-footer">
        <span class="inspo-footer-hint">Cmd+Enter to save</span>
        <button type="button" class="inspo-done-btn" aria-label="Done">Done</button>
      </div>
    `;

    this.noteInput = this.popover.querySelector('.inspo-note-input') as HTMLTextAreaElement;
    this.doneBtn = this.popover.querySelector('.inspo-done-btn') as HTMLButtonElement;
    this.statusText = this.popover.querySelector('.inspo-status-label') as HTMLSpanElement;
    this.disableSiteBtn = this.popover.querySelector('.inspo-site-disable-btn') as HTMLButtonElement;

    this.container.appendChild(this.saveBtn);
    this.container.appendChild(this.popover);
    this.shadowRoot.appendChild(this.container);

    // Append host to page documentElement
    (document.documentElement || document.body).appendChild(this.shadowHost);

    // 3. Attach Event Listeners
    this.initEvents();
  }

  private initEvents() {
    // Mouse over/move delegation
    document.addEventListener('mouseover', this.handleMouseOverBound, { passive: true });
    document.addEventListener('mousemove', this.handleMouseMoveBound, { passive: true });
    window.addEventListener('scroll', this.handleScrollBound, { passive: true });

    // Track overlay hover
    this.container.addEventListener('mouseenter', () => {
      this.isHoveringOverlay = true;
      this.cancelHide();
    });

    this.container.addEventListener('mouseleave', () => {
      this.isHoveringOverlay = false;
      if (!this.isPopoverOpen) {
        this.scheduleHide(150);
      }
    });

    // Save Button Click
    this.saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.handleSaveClick();
    });

    // Note input auto-resize and keyboard actions (Cmd/Ctrl+Enter saves, Enter creates new line, Esc closes)
    this.noteInput.addEventListener('input', () => {
      this.autoResizeNoteInput();
    });

    this.noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.saveNoteAndClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closePopover();
      }
    });

    // Done button click
    this.doneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.saveNoteAndClose();
    });

    // Disable on this site button click
    this.disableSiteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.handleDisableSite();
    });

    // Dismiss on click outside
    document.addEventListener('click', this.handleClickOutsideBound, true);
  }

  private handleClickOutside(e: MouseEvent) {
    if (this.isPopoverOpen) {
      const path = e.composedPath();
      if (!path.includes(this.container) && !path.includes(this.shadowHost)) {
        this.saveNoteAndClose();
      }
    }
  }

  private handleScroll() {
    if (this.currentVisualInfo && !this.isPopoverOpen) {
      this.updatePosition();
    }
  }

  /**
   * Disable Inspo on current domain permanently
   */
  private async handleDisableSite() {
    const domain = window.location.hostname;
    this.closePopover();
    this.hideOverlay();

    // Show stylish transient toast
    const toast = document.createElement('div');
    toast.className = 'inspo-toast';
    toast.innerHTML = `
      <span class="inspo-toast-dot"></span>
      <span>Inspo disabled on ${domain}</span>
    `;
    this.shadowRoot.appendChild(toast);

    try {
      await this.sendMessage({
        type: 'DISABLE_SITE',
        payload: { domain },
      });
    } catch (err) {
      console.warn('[Inspo] Failed to save disabled site setting:', err);
    }

    setTimeout(() => {
      this.destroy();
    }, 1800);
  }

  /**
   * Destroy and clean up this overlay completely
   */
  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Remove event listeners
    document.removeEventListener('mouseover', this.handleMouseOverBound);
    document.removeEventListener('mousemove', this.handleMouseMoveBound);
    window.removeEventListener('scroll', this.handleScrollBound);
    document.removeEventListener('click', this.handleClickOutsideBound, true);

    if (this.hideTimeout) {
      window.clearTimeout(this.hideTimeout);
    }

    // Remove DOM
    try {
      this.shadowHost.remove();
    } catch {
      // ignore
    }
  }

  private handleMouseOver(e: MouseEvent) {
    if (this.isPopoverOpen || this.isHoveringOverlay || this.isDestroyed) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Ignore events originating from our own shadow DOM
    if (target === this.shadowHost || this.shadowHost.contains(target)) return;

    const visualEl = findTargetVisualElement(target);
    if (!visualEl || !isValidVisualElement(visualEl)) return;

    this.showForElement(visualEl);
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isPopoverOpen || this.isHoveringOverlay || this.isDestroyed) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (target === this.shadowHost || this.shadowHost.contains(target)) return;

    const visualEl = findTargetVisualElement(target);
    if (visualEl && isValidVisualElement(visualEl)) {
      if (this.currentVisualInfo?.element !== visualEl) {
        this.showForElement(visualEl);
      } else {
        this.cancelHide();
      }
    } else if (this.currentVisualInfo) {
      this.scheduleHide(150);
    }
  }

  private async showForElement(el: HTMLElement) {
    this.cancelHide();

    const info = getDetectedVisualInfo(el);
    if (!info) return;

    this.currentVisualInfo = info;
    this.updatePosition();

    // Check saved state instantly from cache or background
    const cacheKey = `${info.src}::${info.sourceUrl}`;
    const cached = this.savedCache.get(cacheKey);

    if (cached) {
      this.setSavedState(true, cached.id, cached.note);
    } else {
      this.setSavedState(false);
      // Query service worker for duplicate
      this.checkDuplicateStatus(info);
    }

    this.container.classList.add('visible');
  }

  private async checkDuplicateStatus(info: DetectedVisualInfo) {
    try {
      const res = await this.sendMessage<{ isDuplicate: boolean; item?: VisualItem }>({
        type: 'CHECK_DUPLICATE',
        payload: {
          imageUrl: info.src,
          sourceUrl: info.sourceUrl,
        },
      });

      if (
        this.currentVisualInfo &&
        this.currentVisualInfo.src === info.src &&
        this.currentVisualInfo.sourceUrl === info.sourceUrl
      ) {
        if (res.success && res.data?.isDuplicate && res.data.item) {
          const item = res.data.item;
          this.savedCache.set(`${info.src}::${info.sourceUrl}`, {
            id: item.id,
            note: item.note,
          });
          this.setSavedState(true, item.id, item.note);
        }
      }
    } catch {
      // ignore
    }
  }

  private updatePosition() {
    if (!this.currentVisualInfo || this.isDestroyed) return;

    const rect = this.currentVisualInfo.element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      this.hideOverlay();
      return;
    }

    const padding = 12;
    const top = rect.top + padding;
    const right = window.innerWidth - rect.right + padding;

    this.container.style.top = `${Math.max(10, top)}px`;
    this.container.style.right = `${Math.max(10, right)}px`;
  }

  private setSavedState(isSaved: boolean, id?: string, note?: string) {
    if (isSaved) {
      this.saveBtn.classList.add('saved');
      this.saveBtn.innerHTML = `<span class="inspo-btn-label">Saved</span>`;
      this.currentSavedId = id || this.currentSavedId;
      this.currentNote = note || '';
    } else {
      this.saveBtn.classList.remove('saved');
      this.saveBtn.innerHTML = `<span class="inspo-btn-label">Save</span>`;
      this.currentSavedId = null;
      this.currentNote = '';
    }
  }

  private async handleSaveClick() {
    if (!this.currentVisualInfo || this.isSaving || this.isDestroyed) return;

    // If already saved, clicking opens note editor directly
    if (this.currentSavedId) {
      this.openPopover(this.currentNote);
      return;
    }

    this.isSaving = true;
    this.saveBtn.innerHTML = `<span class="inspo-btn-label">Saving...</span>`;

    const info = this.currentVisualInfo;

    // In-page fallback snapshot data URL if needed
    let fallbackDataUrl: string | undefined;
    if (info.element instanceof HTMLImageElement && info.element.complete && info.element.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = info.element.naturalWidth;
        canvas.height = info.element.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(info.element, 0, 0);
          fallbackDataUrl = canvas.toDataURL('image/png');
        }
      } catch {
        // ignore cross-origin taint
      }
    }

    const payload: SaveVisualPayload = {
      imageUrl: info.src,
      sourceUrl: info.sourceUrl,
      sourceTitle: info.sourceTitle || document.title,
      width: info.width,
      height: info.height,
      dataUrl: fallbackDataUrl,
    };

    try {
      const res = await this.sendMessage<{ item: VisualItem; isDuplicate: boolean }>({
        type: 'SAVE_VISUAL',
        payload,
      });

      if (res.success && res.data) {
        const item = res.data.item;
        this.setSavedState(true, item.id, item.note);

        const cacheKey = `${info.src}::${info.sourceUrl}`;
        this.savedCache.set(cacheKey, { id: item.id, note: item.note });

        this.openPopover(item.note || '');
      } else {
        this.saveBtn.innerHTML = `<span class="inspo-btn-label">Error</span>`;
        setTimeout(() => {
          this.setSavedState(false);
        }, 1200);
      }
    } catch (err) {
      console.error('[Inspo] Save failed:', err);
      this.saveBtn.innerHTML = `<span class="inspo-btn-label">Error</span>`;
      setTimeout(() => {
        this.setSavedState(false);
      }, 1200);
    } finally {
      this.isSaving = false;
    }
  }

  private autoResizeNoteInput() {
    this.noteInput.style.height = 'auto';
    const targetHeight = Math.max(52, Math.min(this.noteInput.scrollHeight, 280));
    this.noteInput.style.height = `${targetHeight}px`;
    this.noteInput.style.overflow = this.noteInput.scrollHeight > 280 ? 'auto' : 'hidden';
    this.updatePosition();
  }

  private openPopover(initialNote = '') {
    this.isPopoverOpen = true;
    this.popover.classList.add('open');
    this.noteInput.value = initialNote;
    this.noteInput.style.overflow = 'hidden';
    this.autoResizeNoteInput();
    setTimeout(() => {
      this.noteInput.focus({ preventScroll: true });
    }, 50);
  }

  private closePopover() {
    this.isPopoverOpen = false;
    this.popover.classList.remove('open');
  }

  private async saveNoteAndClose() {
    const note = this.noteInput.value.trim();
    if (this.currentSavedId && note !== this.currentNote) {
      this.currentNote = note;
      try {
        await this.sendMessage({
          type: 'UPDATE_NOTE',
          payload: { id: this.currentSavedId, note },
        });

        // Update local cache
        if (this.currentVisualInfo) {
          const cacheKey = `${this.currentVisualInfo.src}::${this.currentVisualInfo.sourceUrl}`;
          const cached = this.savedCache.get(cacheKey);
          if (cached) {
            cached.note = note;
          }
        }
      } catch (err) {
        console.error('[Inspo] Failed to update note:', err);
      }
    }
    this.closePopover();
    this.scheduleHide(800);
  }

  private scheduleHide(delayMs = 200) {
    this.cancelHide();
    this.hideTimeout = window.setTimeout(() => {
      this.hideOverlay();
    }, delayMs);
  }

  private cancelHide() {
    if (this.hideTimeout !== null) {
      window.clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private hideOverlay() {
    if (this.isPopoverOpen || this.isHoveringOverlay || this.isDestroyed) return;
    this.container.classList.remove('visible');
    this.currentVisualInfo = null;
  }

  private sendMessage<T>(message: MessageRequest): Promise<MessageResponse<T>> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (res: MessageResponse<T>) => {
          if (chrome.runtime.lastError) {
            console.warn('[Inspo] Message error:', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response' });
          }
        });
      } catch (err) {
        resolve({ success: false, error: String(err) });
      }
    });
  }
}
