import React from 'react';
import { Sparkles, Search, Image as ImageIcon } from 'lucide-react';

interface EmptyStateProps {
  isSearching: boolean;
  query?: string;
  onClearSearch?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ isSearching, query, onClearSearch }) => {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-10 h-10 rounded-md bg-carbon border border-graphite flex items-center justify-center mb-3 text-fog">
          <Search className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-[510] text-paper mb-1 tracking-tight">No references found</h3>
        <p className="text-xs text-fog max-w-sm mb-4">
          No matches for &ldquo;{query}&rdquo;.
        </p>
        {onClearSearch && (
          <button
            onClick={onClearSearch}
            className="px-4 py-1.5 bg-carbon hover:bg-obsidian border border-graphite hover:border-smoke text-xs font-[510] text-mist rounded-full transition"
          >
            Clear search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] py-16 px-4 text-center max-w-md mx-auto">
      <div className="relative mb-5">
        <div className="w-12 h-12 rounded-[12px] bg-carbon border border-graphite flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-mist" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-acid-lime flex items-center justify-center">
          <Sparkles className="w-2.5 h-2.5 text-void" />
        </div>
      </div>

      <h2 className="text-[17px] font-[510] text-paper tracking-tight mb-1.5">
        Personal Visual Memory
      </h2>
      <p className="text-xs text-fog leading-relaxed mb-6">
        Collect visual references with one click while browsing.
      </p>

      {/* 3 Step Guide — Linear Spec */}
      <div className="w-full space-y-2 text-left">
        <div className="p-3 rounded-[6px] bg-carbon border border-graphite flex items-center gap-3">
          <div className="w-5 h-5 rounded-[4px] bg-void border border-graphite text-fog font-mono flex items-center justify-center text-[11px] font-medium shrink-0">
            1
          </div>
          <div className="text-xs">
            <span className="font-[510] text-mist">Hover over any image</span>
            <p className="text-ash text-[11px] mt-0.5">A subtle Save button appears at the top-right corner.</p>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-carbon border border-graphite flex items-center gap-3">
          <div className="w-5 h-5 rounded-[4px] bg-void border border-acid-lime/40 text-acid-lime font-mono flex items-center justify-center text-[11px] font-medium shrink-0">
            2
          </div>
          <div className="text-xs">
            <span className="font-[510] text-mist">Click Save</span>
            <p className="text-ash text-[11px] mt-0.5">Image & direct post URL are preserved locally.</p>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-carbon border border-graphite flex items-center gap-3">
          <div className="w-5 h-5 rounded-[4px] bg-void border border-graphite text-fog font-mono flex items-center justify-center text-[11px] font-medium shrink-0">
            3
          </div>
          <div className="text-xs">
            <span className="font-[510] text-mist">Optionally add a note</span>
            <p className="text-ash text-[11px] mt-0.5">Record why you saved it, or continue browsing.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
