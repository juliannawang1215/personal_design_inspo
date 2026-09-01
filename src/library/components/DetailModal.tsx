import React, { useState, useEffect, useRef } from 'react';
import type { VisualItem } from '../../storage/types';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Calendar,
  Globe,
  Plus,
  ChevronLeft,
  ChevronRight,
  Film,
  Sparkles,
  ImageOff,
} from 'lucide-react';

interface DetailModalProps {
  item: VisualItem;
  onClose: () => void;
  onUpdateNote: (id: string, newNote: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  onClose,
  onUpdateNote,
  onDelete,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const [mediaSrc, setMediaSrc] = useState<string>(item.imageUrl);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || '');
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isVideo =
    item.mediaType === 'video' ||
    item.mimeType?.startsWith('video/') ||
    item.imageUrl.endsWith('.mp4') ||
    item.imageUrl.endsWith('.webm');
  const isGif =
    item.mediaType === 'gif' ||
    item.mimeType === 'image/gif' ||
    item.imageUrl.toLowerCase().includes('.gif');

  // Sync state when active item changes
  useEffect(() => {
    setNoteText(item.note || '');
    setIsEditingNote(false);
    setIsDeleting(false);
    setMediaError(false);
  }, [item.id, item.note]);

  // Auto-resize textarea when entering edit mode or typing
  useEffect(() => {
    if (isEditingNote && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const targetHeight = Math.max(90, Math.min(textareaRef.current.scrollHeight, 400));
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [isEditingNote, noteText]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Object URL resolution
  useEffect(() => {
    let objectUrl: string | null = null;
    if (item.imageBlob) {
      try {
        objectUrl = URL.createObjectURL(item.imageBlob);
        setMediaSrc(objectUrl);
      } catch {
        setMediaSrc(item.imageUrl);
      }
    } else {
      setMediaSrc(item.imageUrl);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.imageBlob, item.imageUrl]);

  // Keyboard navigation & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingNote) {
          setIsEditingNote(false);
        } else {
          onClose();
        }
      } else if (!isEditingNote) {
        if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
          onPrev();
        } else if (e.key === 'ArrowRight' && hasNext && onNext) {
          onNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingNote, onClose, onPrev, onNext, hasPrev, hasNext]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.sourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      await onUpdateNote(item.id, noteText);
      setIsEditingNote(false);
    } finally {
      setIsSavingNote(false);
    }
  };

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const domain = (() => {
    try {
      return new URL(item.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return item.sourceUrl;
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/90 backdrop-blur-md animate-fade-fast"
        onClick={onClose}
      />

      {/* Nav Buttons (Left/Right) */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev?.();
          }}
          aria-label="Previous visual reference (Left arrow)"
          className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-carbon/90 border border-graphite text-fog hover:text-paper hover:border-smoke hover:-translate-x-0.5 active:translate-x-0 transition-all duration-120 focus-visible:ring-1 focus-visible:ring-mist"
          title="Previous (←)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          aria-label="Next visual reference (Right arrow)"
          className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-carbon/90 border border-graphite text-fog hover:text-paper hover:border-smoke hover:translate-x-0.5 active:translate-x-0 transition-all duration-120 focus-visible:ring-1 focus-visible:ring-mist"
          title="Next (→)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Expansive 2X Detail Canvas Modal */}
      <div
        className="relative z-10 w-[96vw] max-w-[1720px] h-[92vh] max-h-[96vh] bg-obsidian border border-graphite rounded-[12px] overflow-hidden flex flex-col md:flex-row animate-modal-in"
      >
        {/* Left: Expansive Media Canvas */}
        <div className="flex-1 min-w-0 bg-void flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden h-[55vh] md:h-full">
          {mediaError ? (
            <div className="flex flex-col items-center justify-center text-center p-8">
              <ImageOff className="w-10 h-10 text-ash mb-3" />
              <p className="text-sm text-fog font-medium">Image preview not available</p>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 text-xs text-acid-lime hover:underline"
              >
                Open original website →
              </a>
            </div>
          ) : isVideo ? (
            <video
              key={item.id}
              src={mediaSrc}
              controls
              autoPlay
              loop
              playsInline
              onError={() => setMediaError(true)}
              className="max-h-[85vh] max-w-full object-contain rounded-[8px] border border-graphite/40 select-none animate-fade-fast shadow-2xl"
            />
          ) : (
            <img
              key={item.id}
              src={mediaSrc}
              alt={item.note || item.sourceTitle || 'Visual reference'}
              onError={() => setMediaError(true)}
              className="max-h-[85vh] max-w-full object-contain rounded-[8px] border border-graphite/40 select-none animate-fade-fast shadow-2xl"
            />
          )}
        </div>

        {/* Right: Metadata & Notes Side Panel */}
        <div className="w-full md:w-[360px] lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col justify-between p-5 sm:p-6 md:p-7 bg-carbon border-t md:border-t-0 md:border-l border-graphite overflow-y-auto">
          {/* Top Section */}
          <div className="space-y-5">
            {/* Header row: Domain/badge on left, Close button cleanly on right */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-graphite/60">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="w-3.5 h-3.5 text-ash shrink-0" />
                <span className="text-xs text-fog font-medium truncate" title={domain}>{domain}</span>
                {(isGif || isVideo) && (
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-void border border-graphite font-mono text-[10px] uppercase text-fog flex items-center gap-1 shrink-0">
                    {isVideo ? <Film className="w-2.5 h-2.5 text-fog" /> : <Sparkles className="w-2.5 h-2.5 text-acid-lime" />}
                    <span>{isVideo ? 'Video' : 'GIF'}</span>
                  </span>
                )}
              </div>

              {/* Close Button - Pill rounded-full */}
              <button
                onClick={onClose}
                aria-label="Close detail dialog"
                className="w-8 h-8 rounded-full bg-void/60 hover:bg-graphite text-fog hover:text-paper flex items-center justify-center transition-colors duration-120 shrink-0 focus-visible:ring-1 focus-visible:ring-mist"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Post Title */}
            <div>
              <h2
                id="modal-title"
                className="text-[17px] font-[510] text-paper line-clamp-3 leading-snug tracking-tight"
                title={item.sourceTitle}
              >
                {item.sourceTitle || 'Saved Visual'}
              </h2>
            </div>

            {/* Note Section (Click block directly to edit) */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-fog">
                  Note
                </span>
              </div>

              {isEditingNote ? (
                <div className="space-y-2.5 animate-fade-fast">
                  <textarea
                    ref={textareaRef}
                    value={noteText}
                    onChange={(e) => {
                      setNoteText(e.target.value);
                      e.target.style.height = 'auto';
                      const targetHeight = Math.max(90, Math.min(e.target.scrollHeight, 400));
                      e.target.style.height = `${targetHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSaveNote();
                      }
                    }}
                    placeholder="Add your thoughts, context, or tags... (Cmd+Enter to save)"
                    autoFocus
                    className="w-full p-3 bg-void border border-graphite hover:border-smoke focus:border-fog rounded-md text-[13px] text-mist placeholder-ash focus:outline-none transition-colors duration-120 resize-none overflow-hidden leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-ash">Cmd+Enter to save</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setNoteText(item.note || '');
                          setIsEditingNote(false);
                        }}
                        className="px-3.5 py-1.5 text-xs text-fog hover:text-mist rounded-full hover:bg-obsidian transition-colors duration-120"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                        className="px-4 py-1.5 text-xs font-[510] text-void bg-acid-lime hover:bg-[#ecf748] hover:scale-[1.02] active:scale-[0.98] rounded-full transition-all duration-120 disabled:opacity-50 cursor-pointer"
                      >
                        <span>{isSavingNote ? 'Saving...' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : item.note ? (
                <div
                  onClick={() => setIsEditingNote(true)}
                  className="p-3.5 bg-void/60 rounded-md border border-graphite/80 hover:border-smoke hover:bg-void/80 text-[13px] text-mist cursor-pointer transition-all duration-120 min-h-[80px]"
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{item.note}</p>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingNote(true)}
                  className="w-full text-left p-3 px-4 rounded-full border border-dashed border-graphite/80 hover:border-smoke hover:bg-void/40 text-xs text-ash hover:text-fog transition-all duration-120 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-fog" />
                  <span>Add a note, thought, or context...</span>
                </button>
              )}
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-2 pt-3 text-[11px] font-mono text-fog border-t border-graphite/40">
              <div className="flex items-center gap-1.5" title="Date saved">
                <Calendar className="w-3 h-3 text-ash" />
                <span>{formattedDate}</span>
              </div>
              {item.width && item.height && (
                <div className="text-right text-ash" title="Dimensions">
                  {item.width} × {item.height}px
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions Bar (Pill Buttons) */}
          <div className="pt-4 mt-6 border-t border-graphite space-y-3">
            <div className="flex items-center gap-2">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-obsidian hover:bg-graphite border border-graphite hover:border-smoke text-mist hover:text-paper text-xs font-[510] rounded-full hover:-translate-y-0.5 active:translate-y-0 transition-all duration-120"
              >
                <span>Visit Source</span>
                <ExternalLink className="w-3.5 h-3.5 text-fog" />
              </a>

              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-obsidian hover:bg-graphite border border-graphite hover:border-smoke text-mist hover:text-paper text-xs font-[510] rounded-full hover:-translate-y-0.5 active:translate-y-0 transition-all duration-120 flex items-center gap-1.5"
                title="Copy source link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-pulse-green animate-fade-fast" /> : <Copy className="w-3.5 h-3.5 text-fog" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Delete button with confirmation */}
            <div>
              {isDeleting ? (
                <div className="flex items-center justify-between p-2 px-3 bg-coral-red/10 border border-coral-red/30 rounded-full animate-fade-fast">
                  <span className="text-xs text-coral-red font-medium pl-1">Delete reference?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsDeleting(false)}
                      className="px-3 py-1 text-xs text-fog hover:text-mist hover:bg-white/[0.04] rounded-full transition-colors duration-120"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="px-3.5 py-1 text-xs font-[510] bg-coral-red hover:bg-[#d94444] text-paper rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all duration-120"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsDeleting(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-ash hover:text-coral-red hover:bg-coral-red/5 rounded-full transition-all duration-120"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete reference</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
