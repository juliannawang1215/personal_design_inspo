import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getAllVisuals } from './db';
import type { VisualItem, ExportMetadataItem } from './types';

export type ExportMode = 'metadata_only' | 'standard' | 'full';

export interface ExportSizeEstimates {
  metadataBytes: number;
  metadataFormatted: string;
  imagesBytes: number;
  imagesFormatted: string;
  videosEstimatedBytes: number;
  videosFormatted: string;
  standardTotalBytes: number;
  standardFormatted: string;
  fullTotalBytes: number;
  fullFormatted: string;
  totalVisuals: number;
  imageCount: number;
  videoCount: number;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0));
  return `${val} ${sizes[i]}`;
}

function getFileExtension(url: string, mimeType?: string): string {
  if (mimeType) {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('svg')) return 'svg';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  }

  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|mov)($|\?)/i);
    if (match && match[1]) {
      const ext = match[1].toLowerCase();
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {
    // fallback
  }

  return 'jpg';
}

function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

export function isVideoItem(item: VisualItem): boolean {
  return (
    item.mediaType === 'video' ||
    item.mimeType?.startsWith('video/') ||
    item.imageUrl.endsWith('.mp4') ||
    item.imageUrl.endsWith('.webm') ||
    item.imageUrl.endsWith('.mov') ||
    item.imageUrl.includes('/video/') ||
    false
  );
}

/**
 * Calculate dynamic size estimates for all export modes based on current library items
 */
export function calculateExportEstimates(visuals: VisualItem[]): ExportSizeEstimates {
  let imagesBytes = 0;
  let imageCount = 0;
  let videoCount = 0;
  let videosEstimatedBytes = 0;

  // Estimate metadata overhead: ~800 bytes per record across JSON + CSV + Markdown
  const metadataBytes = Math.max(1024, visuals.length * 850);

  for (const item of visuals) {
    if (isVideoItem(item)) {
      videoCount++;
      // Average video size estimate: ~12 MB if not known
      videosEstimatedBytes += item.imageBlob ? item.imageBlob.size : 12 * 1024 * 1024;
    } else {
      imageCount++;
      // Actual blob size if cached, or typical web image ~350 KB
      imagesBytes += item.imageBlob ? item.imageBlob.size : 350 * 1024;
    }
  }

  const standardTotalBytes = metadataBytes + imagesBytes;
  const fullTotalBytes = metadataBytes + imagesBytes + videosEstimatedBytes;

  return {
    metadataBytes,
    metadataFormatted: formatBytes(metadataBytes),
    imagesBytes,
    imagesFormatted: formatBytes(imagesBytes),
    videosEstimatedBytes,
    videosFormatted: `~${formatBytes(videosEstimatedBytes)}`,
    standardTotalBytes,
    standardFormatted: formatBytes(standardTotalBytes),
    fullTotalBytes,
    fullFormatted: `~${formatBytes(fullTotalBytes)}`,
    totalVisuals: visuals.length,
    imageCount,
    videoCount,
  };
}

/**
 * Export library with user-selected mode and progress reporting
 */
export async function exportLibraryWithOptions(
  mode: ExportMode = 'standard',
  onProgress?: (status: string, percent?: number) => void
): Promise<{ count: number; filename: string }> {
  const visuals: VisualItem[] = await getAllVisuals();
  const zip = new JSZip();

  const metadataList: (ExportMetadataItem & { imageUrl: string })[] = [];
  const imagesFolder = mode !== 'metadata_only' ? zip.folder('images') : null;
  const videosFolder = mode === 'full' ? zip.folder('videos') : null;

  onProgress?.('Preparing references and metadata...', 10);

  for (let i = 0; i < visuals.length; i++) {
    const item = visuals[i];
    const indexStr = String(i + 1).padStart(3, '0');
    const isVideo = isVideoItem(item);
    const ext = getFileExtension(item.imageUrl, item.imageBlob?.type || item.mimeType);

    let filename = '';

    if (isVideo) {
      if (mode === 'full' && videosFolder) {
        filename = `video-${indexStr}-${item.id.slice(0, 8)}.${ext === 'jpg' ? 'mp4' : ext}`;
        onProgress?.(`Processing video ${i + 1}/${visuals.length}...`, Math.round(10 + (i / visuals.length) * 60));

        if (item.imageBlob) {
          videosFolder.file(filename, item.imageBlob);
        } else {
          try {
            const res = await fetch(item.imageUrl);
            if (res.ok) {
              const blob = await res.blob();
              videosFolder.file(filename, blob);
            }
          } catch (err) {
            console.warn(`[Inspo Export] Could not download video for ${item.id}:`, err);
          }
        }
      } else {
        filename = `(video omitted - original link preserved)`;
      }
    } else if (mode !== 'metadata_only' && imagesFolder) {
      filename = `image-${indexStr}-${item.id.slice(0, 8)}.${ext}`;
      onProgress?.(`Processing image ${i + 1}/${visuals.length}...`, Math.round(10 + (i / visuals.length) * 60));

      if (item.imageBlob) {
        imagesFolder.file(filename, item.imageBlob);
      } else {
        try {
          const res = await fetch(item.imageUrl);
          if (res.ok) {
            const blob = await res.blob();
            imagesFolder.file(filename, blob);
          }
        } catch (err) {
          console.warn(`[Inspo Export] Could not download image for ${item.id}:`, err);
        }
      }
    }

    metadataList.push({
      id: item.id,
      filename,
      mediaType: item.mediaType || (isVideo ? 'video' : 'image'),
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
      sourceTitle: item.sourceTitle || '',
      note: item.note || '',
      width: item.width,
      height: item.height,
      createdAt: item.createdAt,
    });
  }

  onProgress?.('Generating metadata files...', 75);

  // 1. Add metadata.json
  zip.file('metadata.json', JSON.stringify(metadataList, null, 2));

  // 2. Add metadata.csv
  const csvHeaders = ['ID', 'Type', 'Filename', 'Source Title', 'Source URL', 'Note', 'Image/Media URL', 'Width', 'Height', 'Created At'];
  const csvRows = metadataList.map((m) => [
    escapeCsvField(m.id),
    escapeCsvField(m.mediaType),
    escapeCsvField(m.filename),
    escapeCsvField(m.sourceTitle),
    escapeCsvField(m.sourceUrl),
    escapeCsvField(m.note),
    escapeCsvField(m.imageUrl),
    escapeCsvField(m.width || ''),
    escapeCsvField(m.height || ''),
    escapeCsvField(m.createdAt),
  ].join(','));

  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
  zip.file('metadata.csv', csvContent);

  // 3. Add INDEX.md for human-friendly browsing in Markdown / Obsidian / Notion
  const modeDescription =
    mode === 'metadata_only'
      ? 'Lightweight metadata export (Notes, URLs, Titles).'
      : mode === 'full'
      ? 'Complete offline archive with all images and full video binaries.'
      : 'Standard library with full images and linked videos.';

  const markdownLines = [
    '# Inspo Visual Reference Library Export',
    '',
    `Exported on: ${new Date().toLocaleString()}`,
    `Export Mode: ${mode.toUpperCase()} (${modeDescription})`,
    `Total References: ${visuals.length}`,
    '',
    '---',
    '',
  ];

  metadataList.forEach((m, idx) => {
    markdownLines.push(`### ${idx + 1}. ${m.sourceTitle || 'Untitled Visual'}`);
    markdownLines.push(`- **Type**: \`${m.mediaType}\``);
    markdownLines.push(`- **Source Link**: [${m.sourceUrl}](${m.sourceUrl})`);
    if (m.note) {
      markdownLines.push(`- **Note**: ${m.note}`);
    }
    if (m.filename && !m.filename.includes('omitted')) {
      const folder = m.mediaType === 'video' ? 'videos' : 'images';
      markdownLines.push(`- **Local File**: \`${folder}/${m.filename}\``);
    } else {
      markdownLines.push(`- **Original Media URL**: [View Media](${m.imageUrl})`);
    }
    markdownLines.push(`- **Saved Date**: ${new Date(m.createdAt).toLocaleDateString()}`);
    markdownLines.push('');
  });

  zip.file('INDEX.md', markdownLines.join('\n'));

  onProgress?.('Compressing ZIP archive...', 88);

  // Generate and save ZIP file
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: mode === 'metadata_only' ? 9 : 6 },
    },
    (metadata) => {
      onProgress?.(`Compressing ZIP (${Math.round(metadata.percent)}%)...`, 88 + Math.round(metadata.percent * 0.1));
    }
  );

  onProgress?.('Saving file to your computer...', 99);

  const dateStr = new Date().toISOString().split('T')[0];
  const zipFilename = `inspo-library-${mode}-${dateStr}.zip`;
  saveAs(zipBlob, zipFilename);

  return { count: visuals.length, filename: zipFilename };
}

/**
 * Backward compatibility helper
 */
export async function exportLibrary(): Promise<{ count: number }> {
  return await exportLibraryWithOptions('standard');
}
