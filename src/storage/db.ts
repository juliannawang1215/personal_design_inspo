import Dexie, { type Table } from 'dexie';
import type { VisualItem, SaveVisualPayload } from './types';

export class InspoDatabase extends Dexie {
  visuals!: Table<VisualItem, string>;

  constructor() {
    super('InspoDB');
    // Multi-version support ensures compatibility across all past and current installs
    this.version(1).stores({
      visuals: 'id, imageUrl, sourceUrl, createdAt',
    });
    this.version(2).stores({
      visuals: 'id, imageUrl, sourceUrl, createdAt',
    });
    this.version(3).stores({
      visuals: 'id, imageUrl, sourceUrl, createdAt',
    });
  }
}

export const db = new InspoDatabase();

/**
 * Mirror metadata snapshot into chrome.storage.local for secondary redundancy
 */
async function syncSnapshotToChromeStorage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const all = await db.visuals.toArray();
      const metadataOnly = all.map((item) => ({
        id: item.id,
        imageUrl: item.imageUrl,
        mimeType: item.mimeType,
        mediaType: item.mediaType,
        sourceUrl: item.sourceUrl,
        sourceTitle: item.sourceTitle,
        note: item.note,
        width: item.width,
        height: item.height,
        createdAt: item.createdAt,
      }));
      await chrome.storage.local.set({ inspo_backup_snapshot: metadataOnly });
    }
  } catch {
    // ignore
  }
}

/**
 * Check if the exact same image URL and source URL have already been saved
 */
export async function isDuplicate(imageUrl: string, sourceUrl: string): Promise<VisualItem | null> {
  if (!imageUrl) return null;

  try {
    const matches = await db.visuals.where('imageUrl').equals(imageUrl).toArray();
    for (const item of matches) {
      if (item.sourceUrl === sourceUrl) {
        return item;
      }
    }
  } catch {
    try {
      const all = await db.visuals.toArray();
      return all.find((item) => item.imageUrl === imageUrl && item.sourceUrl === sourceUrl) || null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Fetch an image / GIF and convert it to a Blob (images only, skip videos)
 */
export async function fetchImageBlob(
  url: string,
  sourceUrl?: string,
  fallbackDataUrl?: string
): Promise<{ blob?: Blob; mimeType?: string }> {
  // If URL is already a data URL or blob URL
  if (url.startsWith('data:')) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return { blob, mimeType: blob.type };
    } catch {
      // ignore
    }
  }

  // 1. Direct fetch with headers
  try {
    const headers: Record<string, string> = {
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (sourceUrl) {
      try {
        const origin = new URL(sourceUrl).origin;
        headers['Referer'] = origin;
      } catch {
        // ignore
      }
    }

    const res = await fetch(url, {
      headers,
      credentials: 'omit',
      cache: 'force-cache',
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        let mimeType = blob.type;
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (url.includes('.gif')) mimeType = 'image/gif';
          else if (url.includes('.webp')) mimeType = 'image/webp';
          else if (url.includes('.png')) mimeType = 'image/png';
          else mimeType = 'image/jpeg';
        }
        return { blob, mimeType };
      }
    }
  } catch (err) {
    console.warn('[Inspo] Direct fetch error for image URL:', url, err);
  }

  // 2. Fallback to passed fallbackDataUrl from in-page canvas/DOM capture
  if (fallbackDataUrl) {
    try {
      const res = await fetch(fallbackDataUrl);
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return { blob, mimeType: blob.type };
      }
    } catch {
      // ignore
    }
  }

  return {};
}

/**
 * Save a new visual item or return existing if duplicate
 */
export async function saveVisual(
  payload: SaveVisualPayload
): Promise<{ item: VisualItem; isDuplicate: boolean }> {
  // Check for duplicate safely
  try {
    const existing = await isDuplicate(payload.imageUrl, payload.sourceUrl);
    if (existing) {
      return { item: existing, isDuplicate: true };
    }
  } catch (dupErr) {
    console.warn('[Inspo] Duplicate check error:', dupErr);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Infer media type
  let mediaType: 'image' | 'gif' | 'video' = payload.mediaType || 'image';
  const checkStr = (payload.imageUrl + ' ' + (payload.mimeType || '')).toLowerCase();
  if (checkStr.includes('gif') || checkStr.includes('image/gif')) {
    mediaType = 'gif';
  } else if (checkStr.includes('mp4') || checkStr.includes('webm') || checkStr.includes('video/')) {
    mediaType = 'video';
  }

  // Preserve image blob only for images/GIFs, skipping heavy videos
  let imageBlob: Blob | undefined;
  let detectedMime: string | undefined = payload.mimeType;

  if (mediaType !== 'video') {
    try {
      const { blob, mimeType } = await fetchImageBlob(
        payload.imageUrl,
        payload.sourceUrl,
        payload.dataUrl
      );
      if (blob) {
        imageBlob = blob;
        detectedMime = mimeType || detectedMime;
      }
    } catch (err) {
      console.warn('[Inspo] Failed to fetch image blob:', err);
    }
  } else {
    detectedMime = detectedMime || 'video/mp4';
  }

  const item: VisualItem = {
    id,
    imageUrl: payload.imageUrl,
    imageBlob,
    mimeType: detectedMime,
    mediaType,
    sourceUrl: payload.sourceUrl,
    sourceTitle: payload.sourceTitle || '',
    note: payload.note || '',
    width: payload.width,
    height: payload.height,
    createdAt,
  };

  try {
    await db.visuals.add(item);
  } catch (addErr) {
    console.warn('[Inspo] db.visuals.add error, retrying with put:', addErr);
    try {
      await db.visuals.put(item);
    } catch (putErr) {
      console.warn('[Inspo] db.visuals.put error without blob:', putErr);
      const safeItem = { ...item, imageBlob: undefined };
      await db.visuals.put(safeItem);
    }
  }

  // Sync snapshot
  syncSnapshotToChromeStorage();

  return { item, isDuplicate: false };
}

/**
 * Update the note of an existing item
 */
export async function updateNote(id: string, note: string): Promise<void> {
  try {
    await db.visuals.update(id, { note: note.trim() });
  } catch {
    const item = await db.visuals.get(id);
    if (item) {
      item.note = note.trim();
      await db.visuals.put(item);
    }
  }
  syncSnapshotToChromeStorage();
}

/**
 * Delete a visual item from storage
 */
export async function deleteVisual(id: string): Promise<void> {
  await db.visuals.delete(id);
  syncSnapshotToChromeStorage();
}

/**
 * Get all visual references ordered by newest first, with auto-healing from snapshot if empty
 */
export async function getAllVisuals(): Promise<VisualItem[]> {
  try {
    const results = await db.visuals.orderBy('createdAt').reverse().toArray();
    if (results.length > 0) return results;

    // If IndexedDB returned 0 items, check chrome.storage.local snapshot redundancy
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const snap = await chrome.storage.local.get('inspo_backup_snapshot');
      if (snap && Array.isArray(snap.inspo_backup_snapshot) && snap.inspo_backup_snapshot.length > 0) {
        for (const item of snap.inspo_backup_snapshot) {
          await db.visuals.put(item);
        }
        return snap.inspo_backup_snapshot.sort(
          (a: VisualItem, b: VisualItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    }
    return [];
  } catch {
    try {
      const all = await db.visuals.toArray();
      return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }
}

/**
 * Simple search across note, source title, and source URL
 */
export async function searchVisuals(query: string): Promise<VisualItem[]> {
  const q = query.trim().toLowerCase();
  const all = await getAllVisuals();
  if (!q) return all;

  return all.filter((item) => {
    const noteMatch = item.note?.toLowerCase().includes(q) ?? false;
    const titleMatch = item.sourceTitle?.toLowerCase().includes(q) ?? false;
    const urlMatch = item.sourceUrl.toLowerCase().includes(q);
    return noteMatch || titleMatch || urlMatch;
  });
}
