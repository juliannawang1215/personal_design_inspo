import React from 'react';
import type { VisualItem } from '../../storage/types';
import { VisualCard } from './VisualCard';

interface VisualGridProps {
  items: VisualItem[];
  onSelectItem: (item: VisualItem) => void;
}

export const VisualGrid: React.FC<VisualGridProps> = ({ items, onSelectItem }) => {
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="masonry-columns">
        {items.map((item) => (
          <VisualCard
            key={item.id}
            item={item}
            onClick={() => onSelectItem(item)}
          />
        ))}
      </div>
    </div>
  );
};
