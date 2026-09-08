import React, { useState, useEffect, useMemo } from 'react';
import {
  getSettings,
  addDisabledDomain,
  removeDisabledDomain,
  setGlobalPause,
  setSoundEnabled,
  normalizeDomain,
} from '../../storage/settings';
import type { InspoSettings } from '../../storage/types';
import { playHapticSound, SoundPresets } from '../../utils/sound';
import {
  X,
  Globe,
  Plus,
  Trash2,
  PauseCircle,
  PlayCircle,
  Volume2,
  VolumeX,
  Search,
  Check,
  ShieldAlert,
  Settings as SettingsIcon,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNotification,
}) => {
  const [settings, setSettings] = useState<InspoSettings>({
    disabledDomains: [],
    isGloballyPaused: false,
    soundEnabled: true,
  });
  const [newDomainInput, setNewDomainInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getSettings().then((s) => {
        setSettings(s);
        setLoading(false);
      });
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredDomains = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return settings.disabledDomains;
    return settings.disabledDomains.filter((d) => d.toLowerCase().includes(q));
  }, [settings.disabledDomains, searchFilter]);

  if (!isOpen) return null;

  const handleToggleGlobalPause = async () => {
    const nextState = !settings.isGloballyPaused;
    const updated = await setGlobalPause(nextState);
    setSettings(updated);
    playHapticSound(SoundPresets.clickTap);
    onNotification?.(
      nextState
        ? 'Inspo capture paused globally on all websites.'
        : 'Inspo capture resumed on active websites.'
    );
  };

  const handleToggleSound = async () => {
    const nextState = !settings.soundEnabled;
    const updated = await setSoundEnabled(nextState);
    setSettings(updated);
    if (nextState) {
      playHapticSound(SoundPresets.savePop);
    }
    onNotification?.(
      nextState
        ? 'Acoustic UI sound effects enabled.'
        : 'Acoustic UI sound effects muted.'
    );
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = normalizeDomain(newDomainInput);
    if (!domain) return;

    if (settings.disabledDomains.includes(domain)) {
      onNotification?.(`${domain} is already in the disabled list.`);
      setNewDomainInput('');
      return;
    }

    const updated = await addDisabledDomain(domain);
    setSettings(updated);
    setNewDomainInput('');
    playHapticSound(SoundPresets.clickTap);
    onNotification?.(`Inspo disabled on ${domain}`);
  };

  const handleRemoveDomain = async (domain: string) => {
    const updated = await removeDisabledDomain(domain);
    setSettings(updated);
    playHapticSound(SoundPresets.noteSaved);
    onNotification?.(`Inspo re-enabled on ${domain}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/85 backdrop-blur-md animate-fade-fast"
        onClick={onClose}
      />

      {/* Modal Dialog (Linear 12px Card Specification) */}
      <div className="relative z-10 w-full max-w-xl bg-obsidian border border-graphite rounded-[12px] p-6 shadow-modal animate-modal-in flex flex-col gap-5 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-graphite/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-void border border-graphite flex items-center justify-center text-paper">
              <SettingsIcon className="w-3.5 h-3.5 text-fog" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-[15px] font-[510] text-paper tracking-tight">
                Extension Settings
              </h2>
              <p className="text-xs text-fog mt-0.5">
                Manage site exclusions, sound effects, and preferences
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-transparent hover:bg-graphite text-fog hover:text-paper flex items-center justify-center transition-colors duration-120"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{ scrollbarWidth: 'none' }}>
          {/* Section 1: Global Pause Mode */}
          <div className="p-4 rounded-[10px] bg-carbon border border-graphite flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  settings.isGloballyPaused
                    ? 'bg-coral-red/10 border-coral-red/30 text-coral-red'
                    : 'bg-void border-graphite text-fog'
                }`}
              >
                {settings.isGloballyPaused ? (
                  <PauseCircle className="w-4 h-4" />
                ) : (
                  <PlayCircle className="w-4 h-4 text-pulse-green" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-[510] text-paper">
                    Pause Reference Capture Everywhere
                  </span>
                  {settings.isGloballyPaused && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-[4px] bg-coral-red/15 border border-coral-red/30 text-coral-red">
                      Paused
                    </span>
                  )}
                </div>
                <p className="text-xs text-fog mt-0.5 leading-relaxed">
                  Temporarily hide the hover save button on all websites without uninstalling the extension.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={handleToggleGlobalPause}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                settings.isGloballyPaused ? 'bg-coral-red' : 'bg-smoke'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-150 ease-in-out ${
                  settings.isGloballyPaused ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Section 2: Acoustic Sound Feedback Toggle */}
          <div className="p-4 rounded-[10px] bg-carbon border border-graphite flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  settings.soundEnabled
                    ? 'bg-acid-lime/10 border-acid-lime/30 text-acid-lime'
                    : 'bg-void border-graphite text-fog'
                }`}
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 text-ash" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-[510] text-paper">
                    Acoustic Haptic Feedback
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-[4px] bg-white/[0.04] border border-graphite text-fog">
                    Web Audio
                  </span>
                </div>
                <p className="text-xs text-fog mt-0.5 leading-relaxed">
                  Play subtle, tactile micro-sound feedback on save, note updates, and library actions.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                settings.soundEnabled ? 'bg-acid-lime' : 'bg-smoke'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-void shadow-sm ring-0 transition duration-150 ease-in-out ${
                  settings.soundEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Section 3: Disabled Websites (Blacklist) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-[510] text-paper">
                  Disabled Websites
                </h3>
                <p className="text-xs text-fog mt-0.5">
                  The Inspo overlay will never appear on these websites.
                </p>
              </div>
              <span className="font-mono text-[11px] text-fog bg-void border border-graphite px-2 py-0.5 rounded-[4px]">
                {settings.disabledDomains.length} site{settings.disabledDomains.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Add Domain Form */}
            <form onSubmit={handleAddDomain} className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ash pointer-events-none" />
                <input
                  type="text"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  placeholder="e.g. github.com, figma.com, docs.google.com"
                  className="w-full pl-9 pr-3 py-1.5 bg-void border border-graphite hover:border-smoke focus:border-fog rounded-md text-[13px] text-mist placeholder-ash focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!newDomainInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-[510] text-void bg-acid-lime hover:bg-[#ecf748] active:scale-[0.98] rounded-full transition-all duration-120 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Site</span>
              </button>
            </form>

            {/* Search Filter if many sites */}
            {settings.disabledDomains.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-ash pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter disabled domains..."
                  className="w-full pl-7 pr-3 py-1 bg-void/50 border border-graphite/60 rounded-md text-xs text-mist placeholder-ash focus:outline-none"
                />
              </div>
            )}

            {/* Disabled Domain List */}
            <div className="rounded-[10px] border border-graphite bg-void/50 overflow-hidden divide-y divide-graphite/60 max-h-52 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-fog">Loading settings...</div>
              ) : filteredDomains.length > 0 ? (
                filteredDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-2.5 hover:bg-carbon/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-void border border-graphite flex items-center justify-center text-fog shrink-0">
                        <Globe className="w-2.5 h-2.5" />
                      </div>
                      <span className="font-mono text-xs text-mist truncate">
                        {domain}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(domain)}
                      className="px-2.5 py-1 text-[11px] font-[510] text-fog hover:text-mist hover:bg-obsidian border border-transparent hover:border-graphite rounded-full transition-all duration-120 flex items-center gap-1"
                      title={`Re-enable Inspo on ${domain}`}
                    >
                      <span>Re-enable</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-fog flex flex-col items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-ash" />
                  <span>
                    {searchFilter
                      ? 'No matching disabled domains found.'
                      : 'No websites are currently disabled. Inspo will run on all sites.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-graphite/60 shrink-0">
          <span className="text-[11px] text-ash font-mono">
            Changes save and apply immediately across all tabs
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-[510] text-void bg-acid-lime hover:bg-[#ecf748] rounded-full transition-all duration-120"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
