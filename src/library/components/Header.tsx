import React, { useRef, useEffect } from 'react';
import { Search, Download, Upload, X, Loader2 } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
  onExport: () => void;
  isExporting: boolean;
  onImport: (file: File) => void;
  isImporting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
  onExport,
  isExporting,
  onImport,
  isImporting,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global '/' shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-void/90 backdrop-blur-md border-b border-graphite px-4 sm:px-6 lg:px-8 py-3 transition-colors">
      {/* Hidden file input for backup restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand & Stats */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5 group cursor-default">
            {/* Linear-style Geometric Icon with subtle hover rotation */}
            <div className="w-6 h-6 rounded-md bg-carbon border border-graphite flex items-center justify-center text-paper transition-transform duration-200 group-hover:scale-105">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-[510] tracking-tight text-paper">
                Inspo
              </span>
              <span className="font-mono text-[11px] text-fog bg-white/[0.04] border border-graphite px-1.5 py-0.5 rounded-[4px] transition-colors duration-150 group-hover:text-mist group-hover:border-smoke">
                {totalCount}
              </span>
            </div>
          </div>

          {/* Actions on mobile — Pill buttons (rounded-full) */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-[510] text-mist bg-carbon hover:bg-obsidian border border-graphite rounded-full active:scale-95 transition-all duration-120 disabled:opacity-40"
              title="Import backup"
            >
              {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              <span>Import</span>
            </button>

            <button
              onClick={onExport}
              disabled={isExporting || totalCount === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-[510] text-void bg-acid-lime rounded-full hover:bg-[#ecf748] active:scale-95 transition-all duration-120 disabled:opacity-40"
            >
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Search Input — Linear Precision Spec */}
        <div className="relative w-full sm:max-w-md md:max-w-lg">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-ash pointer-events-none transition-colors duration-120" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search references by note, title, or domain..."
              className="w-full pl-9 pr-14 py-1.5 bg-white/[0.02] border border-graphite hover:border-smoke focus:border-fog focus:bg-white/[0.04] rounded-md text-[13px] text-mist placeholder-fog focus:outline-none transition-all duration-150"
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 p-0.5 text-fog hover:text-mist hover:scale-110 active:scale-90 rounded-full transition-all duration-120"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 px-1.5 py-0.5 font-mono text-[10px] text-fog bg-white/[0.04] border border-graphite rounded-[4px] pointer-events-none transition-colors duration-120">
                /
              </kbd>
            )}
          </div>
          {searchQuery && (
            <div className="absolute right-2 -bottom-4 font-mono text-[10px] text-fog animate-fade-fast">
              {filteredCount} of {totalCount}
            </div>
          )}
        </div>

        {/* Desktop Actions (Import Ghost Pill + Export Acid Lime Pill) */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Import Backup Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-[510] tracking-tight text-mist hover:text-paper bg-obsidian hover:bg-carbon border border-graphite hover:border-smoke hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] rounded-full transition-all duration-120 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Import backup (ZIP or JSON)"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-fog" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-fog" />
                <span>Import</span>
              </>
            )}
          </button>

          {/* Export Library Button */}
          <button
            onClick={onExport}
            disabled={isExporting || totalCount === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-[510] tracking-tight text-void bg-acid-lime hover:bg-[#ecf748] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] rounded-full transition-all duration-120 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Choose export options (Metadata, Standard, or Full Archive)"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 transition-transform duration-120 group-hover:-translate-y-0.5" />
                <span>Export Library</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
