import React, { useState, useEffect, useMemo } from 'react';
import type { VisualItem } from '../../storage/types';
import {
  ExportMode,
  calculateExportEstimates,
  exportLibraryWithOptions,
} from '../../storage/exporter';
import {
  X,
  Download,
  FileText,
  Images,
  HardDrive,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  visuals: VisualItem[];
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  visuals,
  onSuccess,
  onError,
}) => {
  const [selectedMode, setSelectedMode] = useState<ExportMode>('standard');
  const [isExporting, setIsExporting] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);

  // Calculate dynamic size estimates
  const estimates = useMemo(() => {
    return calculateExportEstimates(visuals);
  }, [visuals]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (isExporting || visuals.length === 0) return;
    setIsExporting(true);
    setProgressStatus('Starting export...');
    setProgressPercent(5);

    try {
      const result = await exportLibraryWithOptions(selectedMode, (status, percent) => {
        setProgressStatus(status);
        if (typeof percent === 'number') {
          setProgressPercent(percent);
        }
      });
      onSuccess?.(`Exported ${result.count} references (${result.filename})`);
      onClose();
    } catch (err) {
      console.error('[Inspo ExportModal] Export error:', err);
      onError?.(err instanceof Error ? err.message : 'Failed to export library.');
    } finally {
      setIsExporting(false);
      setProgressStatus('');
      setProgressPercent(undefined);
    }
  };

  const options: {
    mode: ExportMode;
    title: string;
    badge?: string;
    description: string;
    size: string;
    icon: React.ComponentType<{ className?: string }>;
    details: string[];
  }[] = [
    {
      mode: 'metadata_only',
      title: 'Metadata Only',
      badge: 'Lightweight',
      description: 'Export structured data and notes without image/video files.',
      size: estimates.metadataFormatted,
      icon: FileText,
      details: [
        'metadata.json & metadata.csv',
        'Human-readable INDEX.md notes index',
        'Direct original post URLs & tags',
        'Instant download, zero bandwidth',
      ],
    },
    {
      mode: 'standard',
      title: 'Standard Library',
      badge: 'Recommended',
      description: 'All images in full resolution + complete notes. Videos linked.',
      size: estimates.standardFormatted,
      icon: Images,
      details: [
        `All ${estimates.imageCount} high-res images in /images`,
        'Complete notes, URLs, and metadata',
        `${estimates.videoCount} videos preserved as direct post links`,
        'Fast export, avoids large video files',
      ],
    },
    {
      mode: 'full',
      title: 'Full Offline Archive',
      badge: 'Complete',
      description: 'Complete offline package including all images and video files.',
      size: estimates.fullFormatted,
      icon: HardDrive,
      details: [
        `All ${estimates.imageCount} images bundled in /images`,
        `All ${estimates.videoCount} video files downloaded in /videos`,
        'Complete JSON, CSV, and Markdown notes',
        '100% self-contained offline archive',
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/85 backdrop-blur-md animate-fade-fast"
        onClick={() => {
          if (!isExporting) onClose();
        }}
      />

      {/* Modal Dialog (Linear 12px Card Specification) */}
      <div className="relative z-10 w-full max-w-xl bg-obsidian border border-graphite rounded-[12px] p-6 shadow-modal animate-modal-in flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-graphite/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-void border border-graphite flex items-center justify-center text-acid-lime">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-[15px] font-[510] text-paper tracking-tight">
                Export Library Archive
              </h2>
              <p className="text-xs text-fog mt-0.5">
                {visuals.length} visual reference{visuals.length === 1 ? '' : 's'} ({estimates.imageCount} image{estimates.imageCount === 1 ? '' : 's'}, {estimates.videoCount} video{estimates.videoCount === 1 ? '' : 's'})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            className="w-7 h-7 rounded-full bg-transparent hover:bg-graphite text-fog hover:text-paper flex items-center justify-center transition-colors duration-120 disabled:opacity-40"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options List */}
        <div className="flex flex-col gap-2.5">
          {options.map((opt) => {
            const isSelected = selectedMode === opt.mode;
            const Icon = opt.icon;

            return (
              <div
                key={opt.mode}
                onClick={() => {
                  if (!isExporting) setSelectedMode(opt.mode);
                }}
                className={`group relative p-3.5 rounded-[10px] border cursor-pointer transition-all duration-150 select-none ${
                  isSelected
                    ? 'bg-carbon border-acid-lime/50 shadow-sm'
                    : 'bg-void/40 hover:bg-void/80 border-graphite hover:border-smoke'
                } ${isExporting ? 'pointer-events-none opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Radio Check Circle */}
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-acid-lime border-acid-lime text-void'
                          : 'border-graphite bg-void group-hover:border-smoke'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-[510] text-paper">
                          {opt.title}
                        </span>
                        {opt.badge && (
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.2 rounded-[4px] border ${
                              opt.badge === 'Recommended'
                                ? 'bg-acid-lime/10 border-acid-lime/30 text-acid-lime'
                                : 'bg-white/[0.04] border-graphite text-fog'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-fog mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </div>

                  {/* Size Badge */}
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs text-mist bg-void border border-graphite px-2 py-0.5 rounded-[4px]">
                      {opt.size}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Export Progress Bar when active */}
        {isExporting && (
          <div className="space-y-1.5 p-3 rounded-md bg-carbon border border-graphite animate-fade-fast">
            <div className="flex items-center justify-between text-xs">
              <span className="text-mist font-medium flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-acid-lime" />
                <span>{progressStatus || 'Exporting library...'}</span>
              </span>
              {typeof progressPercent === 'number' && (
                <span className="font-mono text-[11px] text-fog">{progressPercent}%</span>
              )}
            </div>
            <div className="w-full h-1.5 bg-void rounded-full overflow-hidden border border-graphite/40">
              <div
                className="h-full bg-acid-lime transition-all duration-200"
                style={{ width: `${progressPercent || 20}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions (Pill Buttons) */}
        <div className="flex items-center justify-between pt-2 border-t border-graphite/60">
          <div className="text-[11px] text-ash font-mono">
            ZIP archive format
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-1.5 text-xs font-[510] text-fog hover:text-mist rounded-full hover:bg-carbon border border-graphite hover:border-smoke transition-all duration-120 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || visuals.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-1.5 text-xs font-[510] tracking-tight text-void bg-acid-lime hover:bg-[#ecf748] active:scale-[0.98] rounded-full transition-all duration-120 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Archive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
