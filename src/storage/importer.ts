import JSZip from 'jszip';
import { db } from './db';
import type { VisualItem } from './types';

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  totalCount: number;
}

/**
 * Import a backup ZIP or JSON file into the local Inspo library
 */
export async function importLibrary(file: File): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.zip')) {
    return await importZipFile(file);
  } else if (fileName.endsWith('.json')) {
    return await importJsonFile(file);
  } else {
    throw new Error('Unsupported file format. Please select a .zip or .json backup file.');
  }
}

/**
 * Parse and restore from an Inspo export ZIP file
 */
async function importZipFile(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  // Look for metadata.json in root or subdirectories
  let metadataFile = zip.file('metadata.json');
  if (!metadataFile) {
    const matchingFiles = zip.file(/metadata\.json$/i);
    if (matchingFiles.length > 0) {
      metadataFile = matchingFiles[0];
    }
  }

  if (!metadataFile) {
    throw new Error('Invalid backup ZIP: metadata.json not found inside the archive.');
  }

  const metadataText = await metadataFile.async('text');
  let rawItems: any[];
  try {
    rawItems = JSON.parse(metadataText);
    if (!Array.isArray(rawItems)) {
      if (rawItems && Array.isArray((rawItems as any).items)) {
        rawItems = (rawItems as any).items;
      } else {
        throw new Error('Invalid metadata.json structure.');
      }
    }
  } catch (err) {
    throw new Error('Failed to parse metadata.json in ZIP: ' + (err instanceof Error ? err.message : String(err)));
  }

  let importedCount = 0;
  let skippedCount = 0;

  for (const raw of rawItems) {
    try {
      const id = raw.id || crypto.randomUUID();
      const imageUrl = raw.imageUrl || raw.sourceUrl || '';
      const sourceUrl = raw.sourceUrl || imageUrl || '';
      const createdAt = raw.createdAt || new Date().toISOString();

      let imageBlob: Blob | undefined;

      // Extract image blob if present in the ZIP
      if (raw.filename && !raw.filename.includes('omitted')) {
        let imageEntry = zip.file(`images/${raw.filename}`) || zip.file(raw.filename);
        if (!imageEntry) {
          // Search flexibly
          const matches = zip.file(new RegExp(`${raw.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
          if (matches.length > 0) {
            imageEntry = matches[0];
          }
        }

        if (imageEntry) {
          const blobData = await imageEntry.async('blob');
          if (blobData && blobData.size > 0) {
            imageBlob = blobData;
          }
        }
      }

      // Check if item exists
      const existing = await db.visuals.get(id);

      const itemToSave: VisualItem = {
        id,
        imageUrl,
        imageBlob: imageBlob || existing?.imageBlob,
        mimeType: raw.mimeType || (imageBlob ? imageBlob.type : undefined),
        mediaType: raw.mediaType || (raw.imageUrl?.includes('.mp4') ? 'video' : 'image'),
        sourceUrl,
        sourceTitle: raw.sourceTitle || existing?.sourceTitle || '',
        note: raw.note !== undefined ? raw.note : existing?.note || '',
        width: raw.width || existing?.width,
        height: raw.height || existing?.height,
        createdAt,
      };

      await db.visuals.put(itemToSave);
      importedCount++;
    } catch (err) {
      console.warn('[Inspo Import] Failed to restore single item:', err);
      skippedCount++;
    }
  }

  return {
    importedCount,
    skippedCount,
    totalCount: rawItems.length,
  };
}

/**
 * Parse and restore from an Inspo JSON file
 */
async function importJsonFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  let rawItems: any[];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (parsed && Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else {
      throw new Error('Invalid JSON format. Expected an array of references.');
    }
  } catch (err) {
    throw new Error('Failed to parse JSON file: ' + (err instanceof Error ? err.message : String(err)));
  }

  let importedCount = 0;
  let skippedCount = 0;

  for (const raw of rawItems) {
    try {
      const id = raw.id || crypto.randomUUID();
      const imageUrl = raw.imageUrl || raw.sourceUrl || '';
      const sourceUrl = raw.sourceUrl || imageUrl || '';
      const createdAt = raw.createdAt || new Date().toISOString();

      const existing = await db.visuals.get(id);

      const itemToSave: VisualItem = {
        id,
        imageUrl,
        imageBlob: existing?.imageBlob,
        mimeType: raw.mimeType,
        mediaType: raw.mediaType || (imageUrl.includes('.mp4') ? 'video' : 'image'),
        sourceUrl,
        sourceTitle: raw.sourceTitle || existing?.sourceTitle || '',
        note: raw.note !== undefined ? raw.note : existing?.note || '',
        width: raw.width || existing?.width,
        height: raw.height || existing?.height,
        createdAt,
      };

      await db.visuals.put(itemToSave);
      importedCount++;
    } catch (err) {
      console.warn('[Inspo Import] Failed to restore JSON item:', err);
      skippedCount++;
    }
  }

  return {
    importedCount,
    skippedCount,
    totalCount: rawItems.length,
  };
}
