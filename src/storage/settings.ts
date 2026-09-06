import type { InspoSettings } from './types';

const SETTINGS_STORAGE_KEY = 'inspo_user_settings';

export const DEFAULT_SETTINGS: InspoSettings = {
  disabledDomains: [],
  isGloballyPaused: false,
};

/**
 * Clean and normalize a domain or URL string to a standard hostname
 * e.g. "https://www.Notion.so/my-page?x=1" -> "notion.so"
 */
export function normalizeDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  if (!cleaned) return '';

  try {
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }
    const parsed = new URL(cleaned);
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host;
  } catch {
    // If URL parsing fails, clean manually
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split(':')[0];
  }
}

/**
 * Check whether a target hostname matches any entry in the disabled domains list
 * Supports exact matches and subdomain matches (e.g., "figma.com" blocks "www.figma.com" and "staging.figma.com")
 */
export function isDomainMatch(hostname: string, disabledDomains: string[]): boolean {
  if (!hostname || !disabledDomains || disabledDomains.length === 0) {
    return false;
  }

  const normalizedTarget = normalizeDomain(hostname);
  if (!normalizedTarget) return false;

  return disabledDomains.some((d) => {
    const norm = normalizeDomain(d);
    if (!norm) return false;

    // Exact match
    if (normalizedTarget === norm) return true;

    // Subdomain match: target ends with ".norm" (e.g., "docs.github.com" matches "github.com")
    if (normalizedTarget.endsWith('.' + norm)) return true;

    return false;
  });
}

/**
 * Retrieve user settings from chrome.storage.local
 */
export async function getSettings(): Promise<InspoSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
      if (res && res[SETTINGS_STORAGE_KEY]) {
        return {
          ...DEFAULT_SETTINGS,
          ...res[SETTINGS_STORAGE_KEY],
        };
      }
    }
  } catch (err) {
    console.warn('[Inspo Settings] Failed to load settings:', err);
  }

  return DEFAULT_SETTINGS;
}

/**
 * Save settings to chrome.storage.local and broadcast update to all tabs & workers
 */
export async function saveSettings(settings: InspoSettings): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });

      // Notify all components and tabs of updated settings
      chrome.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        payload: settings,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Inspo Settings] Failed to save settings:', err);
  }
}

/**
 * Add a domain to the disabled list and persist
 */
export async function addDisabledDomain(domain: string): Promise<InspoSettings> {
  const norm = normalizeDomain(domain);
  if (!norm) return await getSettings();

  const current = await getSettings();
  const set = new Set(current.disabledDomains.map(normalizeDomain));
  set.add(norm);

  const updated: InspoSettings = {
    ...current,
    disabledDomains: Array.from(set).sort(),
  };

  await saveSettings(updated);
  return updated;
}

/**
 * Remove a domain from the disabled list and persist
 */
export async function removeDisabledDomain(domain: string): Promise<InspoSettings> {
  const norm = normalizeDomain(domain);
  const current = await getSettings();

  const updated: InspoSettings = {
    ...current,
    disabledDomains: current.disabledDomains.filter((d) => normalizeDomain(d) !== norm),
  };

  await saveSettings(updated);
  return updated;
}

/**
 * Toggle or set global pause state
 */
export async function setGlobalPause(paused: boolean): Promise<InspoSettings> {
  const current = await getSettings();
  const updated: InspoSettings = {
    ...current,
    isGloballyPaused: paused,
  };

  await saveSettings(updated);
  return updated;
}

/**
 * Helper to check if a specific website is currently disabled
 */
export async function isSiteDisabled(hostname: string): Promise<boolean> {
  const settings = await getSettings();
  if (settings.isGloballyPaused) return true;
  return isDomainMatch(hostname, settings.disabledDomains);
}
