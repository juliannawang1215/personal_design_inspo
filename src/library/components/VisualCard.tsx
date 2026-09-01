import React, { useState, useEffect } from 'react';
import type { VisualItem } from '../../storage/types';
import { ExternalLink, MessageSquare, Globe, Film, Sparkles, ImageOff } from 'lucide-react';

interface VisualCardProps {
  item: VisualItem;
  onClick: () => void;
}

export const VisualCard: React.FC<VisualCardProps> = ({ item, onClick }) => {
  const [mediaSrc, setMediaSrc] = useState<string>(item.imageUrl);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const isVideo =
    item.mediaType === 'video' ||
    item.mimeType?.startsWith('video/') ||
    item.imageUrl.endsWith('.mp4') ||
    item.imageUrl.endsWith('.webm');
  const isGif =
    item.mediaType === 'gif' ||
    item.mimeType === 'image/gif' ||
    item.imageUrl.toLowerCase().includes('.gif');

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

  const domain = (() => {
    try {
      return new URL(item.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const cardLabel = item.note || item.sourceTitle || `Visual reference from ${domain || 'web'}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={cardLabel}
      className="masonry-item group relative cursor-pointer overflow-hidden rounded-[12px] bg-carbon border border-graphite transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-smoke hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mist"
      style={{
        boxShadow: 'rgba(0, 0, 0, 0.4) 0px 2px 4px 0px, rgb(35, 37, 42) 0px 0px 0px 1px inset',
      }}
    >
      {/* Media Container */}
      <div className="relative w-full overflow-hidden bg-void">
        {!loaded && !failed && (
          <div className="w-full aspect-[4/3] animate-shimmer" />
        )}

        {failed ? (
          <div className="w-full aspect-[4/3] flex flex-col items-center justify-center p-6 text-center bg-obsidian/40 border border-graphite/40">
            <ImageOff className="w-6 h-6 text-ash mb-2" />
            <p className="text-[11px] text-fog font-medium">Remote preview unavailable</p>
            <span className="text-[10px] text-ash mt-0.5 truncate max-w-[160px]">{domain}</span>
          </div>
        ) : isVideo ? (
          <video
            src={mediaSrc}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setLoaded(true)}
            onError={() => {
              if (mediaSrc !== item.imageUrl) setMediaSrc(item.imageUrl);
              else setFailed(true);
            }}
            className={`w-full h-auto object-cover transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.015] ${
              loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
            }`}
          />
        ) : (
          <img
            src={mediaSrc}
            alt={item.note || item.sourceTitle || 'Visual reference'}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (mediaSrc !== item.imageUrl) setMediaSrc(item.imageUrl);
              else setFailed(true);
            }}
            className={`w-full h-auto object-cover transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.015] ${
              loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
            }`}
          />
        )}

        {/* Media Badge */}
        {(isGif || isVideo) && (
          <div className="absolute top-2.5 left-2.5 z-10 px-1.5 py-0.5 rounded-[4px] bg-void/85 backdrop-blur-sm border border-graphite font-mono text-[10px] uppercase text-mist flex items-center gap-1 transition-transform duration-150 group-hover:scale-105">
            {isVideo ? <Film className="w-2.5 h-2.5 text-fog" /> : <Sparkles className="w-2.5 h-2.5 text-acid-lime" />}
            <span>{isVideo ? 'Video' : 'GIF'}</span>
          </div>
        )}

        {/* Linear Subtle Hover Overlay with Slide-Up Typography */}
        <div className="absolute inset-0 bg-gradient-to-t from-void/95 via-void/40 to-transparent opacity-0 transition-opacity duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 flex flex-col justify-end p-3.5">
          {item.note && (
            <div className="mb-2 flex items-start gap-1.5 text-xs text-mist line-clamp-2 font-normal leading-relaxed transform translate-y-1 transition-transform duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-acid-lime" />
              <span>{item.note}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-fog font-medium pt-1 border-t border-graphite/60 transform translate-y-1 transition-transform duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
            <span className="flex items-center gap-1 truncate max-w-[180px]" title={domain || item.sourceTitle}>
              <Globe className="w-3 h-3 shrink-0 text-ash" />
              <span className="truncate">{domain || item.sourceTitle || 'Web'}</span>
            </span>
            <span className="text-fog group-hover:text-paper transition-colors duration-120 flex items-center gap-1">
              <span>View</span>
              <ExternalLink className="w-3 h-3 transition-transform duration-120 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Card Info Footer if note exists on mobile */}
      {item.note && (
        <div className="p-2.5 bg-carbon border-t border-graphite md:hidden">
          <p className="text-xs text-fog line-clamp-2">{item.note}</p>
        </div>
      )}
    </div>
  );
};
