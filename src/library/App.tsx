import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllVisuals, updateNote, deleteVisual } from '../storage/db';
import { importLibrary } from '../storage/importer';
import type { VisualItem } from '../storage/types';
import { playHapticSound, SoundPresets } from '../utils/sound';
import { Header } from './components/Header';
import { VisualGrid } from './components/VisualGrid';
import { DetailModal } from './components/DetailModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { EmptyState } from './components/EmptyState';

export const App: React.FC = () => {
  const [visuals, setVisuals] = useState<VisualItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<VisualItem | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const items = await getAllVisuals();
      setVisuals(items);
    } catch (err) {
      console.error('[Inspo Library] Failed to load visuals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Reload when window regains focus
    const onFocus = () => {
      loadData();
    };
    window.addEventListener('focus', onFocus);

    // Real-time live sync: reload immediately when a new visual is saved from any tab
    const messageListener = (msg: { type?: string }) => {
      if (msg && msg.type === 'LIBRARY_UPDATED') {
        loadData();
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      window.removeEventListener('focus', onFocus);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadData]);

  // Filtered visuals based on real-time search
  const filteredVisuals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visuals;

    return visuals.filter((item) => {
      const noteMatch = item.note?.toLowerCase().includes(q) ?? false;
      const titleMatch = item.sourceTitle?.toLowerCase().includes(q) ?? false;
      const urlMatch = item.sourceUrl.toLowerCase().includes(q);
      return noteMatch || titleMatch || urlMatch;
    });
  }, [visuals, searchQuery]);

  // Navigation within detail modal
  const selectedIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return filteredVisuals.findIndex((v) => v.id === selectedItem.id);
  }, [selectedItem, filteredVisuals]);

  const handlePrev = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedItem(filteredVisuals[selectedIndex - 1]);
    }
  }, [selectedIndex, filteredVisuals]);

  const handleNext = useCallback(() => {
    if (selectedIndex < filteredVisuals.length - 1) {
      setSelectedItem(filteredVisuals[selectedIndex + 1]);
    }
  }, [selectedIndex, filteredVisuals]);

  const handleUpdateNote = async (id: string, newNote: string) => {
    await updateNote(id, newNote);
    playHapticSound(SoundPresets.noteSaved);
    setVisuals((prev) =>
      prev.map((item) => (item.id === id ? { ...item, note: newNote } : item))
    );
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, note: newNote } : null));
    }
  };

  const handleDelete = async (id: string) => {
    playHapticSound(SoundPresets.deletePop);
    await deleteVisual(id);
    setVisuals((prev) => prev.filter((item) => item.id !== id));
    setSelectedItem(null);
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    try {
      const result = await importLibrary(file);
      await loadData();
      playHapticSound(SoundPresets.exportSuccess);
      setFeedback(`Restored ${result.importedCount} references from backup`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('[Inspo] Import error:', err);
      setFeedback(err instanceof Error ? err.message : 'Failed to import backup.');
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-void text-mist">
      {/* Top Bar Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={visuals.length}
        filteredCount={filteredVisuals.length}
        onExport={() => setIsExportModalOpen(true)}
        isExporting={false}
        onImport={handleImport}
        isImporting={isImporting}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Toast Notification with Slide-Up Motion */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-obsidian border border-graphite text-mist px-3.5 py-2 rounded-full shadow-modal text-xs font-[510] animate-slide-up flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-pulse-green animate-pulse-dot" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[50vh]">
            <div className="w-5 h-5 border-2 border-graphite border-t-acid-lime rounded-full animate-spin" />
          </div>
        ) : filteredVisuals.length > 0 ? (
          <VisualGrid
            items={filteredVisuals}
            onSelectItem={(item) => setSelectedItem(item)}
          />
        ) : (
          <EmptyState
            isSearching={Boolean(searchQuery)}
            query={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdateNote={handleUpdateNote}
          onDelete={handleDelete}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < filteredVisuals.length - 1}
        />
      )}

      {/* Export Options Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        visuals={visuals}
        onSuccess={(msg) => {
          playHapticSound(SoundPresets.exportSuccess);
          setFeedback(msg);
          setTimeout(() => setFeedback(null), 4000);
        }}
        onError={(err) => {
          setFeedback(err);
          setTimeout(() => setFeedback(null), 4000);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onNotification={(msg) => {
          setFeedback(msg);
          setTimeout(() => setFeedback(null), 4000);
        }}
      />
    </div>
  );
};
