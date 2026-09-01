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

  private currentVisualInfo: DetectedVisualInfo | null = null;
  private currentSavedId: string | null = null;
  private currentNote = '';
  private isPopoverOpen = false;
  private isSaving = false;
  private hideTimeout: number | null = null;
  private isHoveringOverlay = false;

  // Local cache of saved items for instant hover state
  private savedCache = new Map<string, { id: string; note?: string }>();

  constructor() {
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

    // Save Button (Linear 6px radius, pure typography)
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
      </div>
      <textarea class="inspo-note-input" placeholder="Add a note... (Cmd+Enter to save)" rows="2" aria-label="Reference note"></textarea>
      <div class="inspo-popover-footer">
        <button type="button" class="inspo-done-btn" aria-label="Done">Done</button>
      </div>
    `;

    this.noteInput = this.popover.querySelector('.inspo-note-input') as HTMLTextAreaElement;
    this.doneBtn = this.popover.querySelector('.inspo-done-btn') as HTMLButtonElement;
    this.statusText = this.popover.querySelector('.inspo-status-label') as HTMLSpanElement;

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
    document.addEventListener('mouseover', this.handleMouseOver, { passive: true });
    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });

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

    // Dismiss on click outside
    document.addEventListener(
      'click',
      (e) => {
        if (this.isPopoverOpen) {
          const path = e.composedPath();
          if (!path.includes(this.container) && !path.includes(this.shadowHost)) {
            this.saveNoteAndClose();
          }
        }
      },
      { capture: true }
    );

    // Handle Escape key globally
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPopoverOpen) {
        this.closePopover();
      }
    });

    // Update position on scroll and resize
    window.addEventListener('scroll', this.updatePosition, { passive: true });
    window.addEventListener('resize', this.updatePosition, { passive: true });
  }

  private handleMouseOver = (e: MouseEvent) => {
    if (this.isPopoverOpen || this.isHoveringOverlay) return;

    const el = findTargetVisualElement(e.target, e.clientX, e.clientY);
    if (el && isValidVisualElement(el)) {
      this.cancelHide();
      this.showForElement(el);
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.isPopoverOpen || this.isHoveringOverlay) return;

    if (this.currentVisualInfo) {
      const el = this.currentVisualInfo.element;
      if (!el.isConnected) {
        this.hide();
        return;
      }

      const rect = el.getBoundingClientRect();
      const pad = 40;
      const inside =
        e.clientX >= rect.left - pad &&
        e.clientX <= rect.right + pad &&
        e.clientY >= rect.top - pad &&
        e.clientY <= rect.bottom + pad;

      if (!inside) {
        this.scheduleHide(200);
      } else {
        this.cancelHide();
      }
    } else {
      const el = findTargetVisualElement(e.target, e.clientX, e.clientY);
      if (el && isValidVisualElement(el)) {
        this.cancelHide();
        this.showForElement(el);
      }
    }
  };

  private showForElement(el: HTMLElement) {
    if (this.currentVisualInfo?.element === el && this.container.classList.contains('visible')) {
      return;
    }

    this.currentVisualInfo = getDetectedVisualInfo(el);
    this.currentSavedId = null;
    this.currentNote = '';
    this.updatePosition();

    // Check if item is already saved
    const cacheKey = `${this.currentVisualInfo.src}::${this.currentVisualInfo.sourceUrl}`;
    const cached = this.savedCache.get(cacheKey);

    if (cached) {
      this.currentSavedId = cached.id;
      this.currentNote = cached.note || '';
      this.renderSavedUI();
    } else {
      this.resetButtonUI();
      // Check asynchronously from IndexedDB
      this.checkSavedStatus(this.currentVisualInfo.src, this.currentVisualInfo.sourceUrl);
    }

    this.container.classList.add('visible');
  }

  private async checkSavedStatus(imageUrl: string, sourceUrl: string) {
    try {
      const res = await this.sendMessage<{ isDuplicate: boolean; item?: VisualItem }>({
        type: 'CHECK_DUPLICATE',
        payload: { imageUrl, sourceUrl },
      });

      if (res && res.success && res.data?.isDuplicate && res.data.item) {
        const item = res.data.item;
        const cacheKey = `${imageUrl}::${sourceUrl}`;
        this.savedCache.set(cacheKey, { id: item.id, note: item.note });

        if (
          this.currentVisualInfo &&
          this.currentVisualInfo.src === imageUrl &&
          this.currentVisualInfo.sourceUrl === sourceUrl
        ) {
          this.currentSavedId = item.id;
          this.currentNote = item.note || '';
          this.renderSavedUI();
        }
      }
    } catch {
      // ignore
    }
  }

  private updatePosition = () => {
    if (!this.currentVisualInfo || !this.currentVisualInfo.element.isConnected) {
      if (!this.isPopoverOpen) this.hide();
      return;
    }

    const rect = this.currentVisualInfo.element.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 30 || rect.bottom < 0 || rect.top > window.innerHeight) {
      if (!this.isPopoverOpen) this.hide();
      return;
    }

    // Viewport-safe clamping for Save button
    const safeTop = Math.max(10, Math.min(rect.top + 8, window.innerHeight - 44));
    const safeRight = Math.max(10, Math.min(window.innerWidth - rect.right + 8, window.innerWidth - 90));

    this.container.style.top = `${safeTop}px`;
    this.container.style.right = `${safeRight}px`;
    this.container.style.left = 'auto';

    // Auto flip popover if near bottom of viewport
    if (safeTop + 160 > window.innerHeight) {
      this.popover.style.top = 'auto';
      this.popover.style.bottom = 'calc(100% + 6px)';
      this.popover.style.transformOrigin = 'bottom right';
    } else {
      this.popover.style.top = 'calc(100% + 6px)';
      this.popover.style.bottom = 'auto';
      this.popover.style.transformOrigin = 'top right';
    }
  };

  private scheduleHide(delay: number) {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = window.setTimeout(() => {
      if (!this.isHoveringOverlay && !this.isPopoverOpen) {
        this.hide();
      }
    }, delay);
  }

  private cancelHide() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private hide() {
    this.cancelHide();
    this.container.classList.remove('visible');
    this.closePopover();
    this.currentVisualInfo = null;
  }

  private resetButtonUI() {
    this.saveBtn.className = 'inspo-save-btn';
    this.saveBtn.setAttribute('aria-label', 'Save to Inspo');
    this.saveBtn.innerHTML = `<span class="inspo-btn-label">Save</span>`;
    this.statusText.textContent = 'Saved';
  }

  private renderSavedUI() {
    this.saveBtn.className = 'inspo-save-btn saved';
    this.saveBtn.setAttribute('aria-label', 'Saved in Inspo');
    // Pure text without any icon
    this.saveBtn.innerHTML = `<span class="inspo-btn-label">Saved</span>`;
    this.statusText.textContent = 'Saved';
  }

  private extractElementDataUrl(el: HTMLElement): string | undefined {
    try {
      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(el.naturalWidth, 1920);
        canvas.height = Math.min(el.naturalHeight, 1920);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL(el.src.includes('.png') ? 'image/png' : 'image/jpeg', 0.92);
        }
      }
    } catch {
      // Cross-origin canvas taint will fallback to direct fetch in worker
    }
    return undefined;
  }

  private async handleSaveClick() {
    if (!this.currentVisualInfo || this.isSaving) return;

    // If already saved, open note popover directly
    if (this.currentSavedId) {
      this.renderSavedUI();
      this.openPopover(this.currentNote);
      return;
    }

    this.isSaving = true;

    // Immediate visual feedback
    this.renderSavedUI();
    this.openPopover('');

    const fallbackDataUrl = this.extractElementDataUrl(this.currentVisualInfo.element);

    const payload: SaveVisualPayload = {
      imageUrl: this.currentVisualInfo.src,
      dataUrl: fallbackDataUrl,
      mediaType: this.currentVisualInfo.mediaType,
      sourceUrl: this.currentVisualInfo.sourceUrl,
      sourceTitle: this.currentVisualInfo.sourceTitle,
      width: this.currentVisualInfo.width,
      height: this.currentVisualInfo.height,
    };

    try {
      const response = await this.sendMessage<{ item: { id: string; note?: string }; isDuplicate: boolean }>({
        type: 'SAVE_VISUAL',
        payload,
      });

      if (response && response.success && response.data) {
        const { item } = response.data;
        this.currentSavedId = item.id;
        this.currentNote = item.note || '';

        // Add to local cache
        if (this.currentVisualInfo) {
          const cacheKey = `${this.currentVisualInfo.src}::${this.currentVisualInfo.sourceUrl}`;
          this.savedCache.set(cacheKey, { id: item.id, note: this.currentNote });
        }
      } else {
        console.warn('[Inspo] Save response unsuccessful:', response?.error);
      }
    } catch (err) {
      console.error('[Inspo] Failed to save visual:', err);
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
