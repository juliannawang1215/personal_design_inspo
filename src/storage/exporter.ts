import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getAllVisuals } from './db';
import type { VisualItem, ExportMetadataItem } from './types';

function getFileExtension(url: string, mimeType?: string): string {
  if (mimeType) {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('svg')) return 'svg';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  }

  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(png|jpe?g|webp|gif|svg|avif)($|\?)/i);
    if (match && match[1]) {
      return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
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

function isVideoItem(item: VisualItem): boolean {
  return (
    item.mediaType === 'video' ||
    item.mimeType?.startsWith('video/') ||
    item.imageUrl.endsWith('.mp4') ||
    item.imageUrl.endsWith('.webm') ||
    item.imageUrl.endsWith('.mov') ||
    false
  );
}

export async function exportLibrary(): Promise<{ count: number }> {
  const visuals: VisualItem[] = await getAllVisuals();
  const zip = new JSZip();

  const metadataList: (ExportMetadataItem & { imageUrl: string })[] = [];
  const imagesFolder = zip.folder('images');

  for (let i = 0; i < visuals.length; i++) {
    const item = visuals[i];
    const indexStr = String(i + 1).padStart(3, '0');
    const isVideo = isVideoItem(item);

    let filename = '';

    if (isVideo) {
      // Videos: skip binary export to save bandwidth & size, but preserve full metadata and source
      filename = `(video omitted - original link preserved)`;
    } else {
      const ext = getFileExtension(item.imageUrl, item.imageBlob?.type);
      filename = `image-${indexStr}-${item.id.slice(0, 8)}.${ext}`;

      // Add image binary to images folder
      if (item.imageBlob && imagesFolder) {
        imagesFolder.file(filename, item.imageBlob);
      } else if (imagesFolder) {
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

  // 1. Add metadata.json (Contains all items, notes, source URLs, and original media links)
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
  const markdownLines = [
    '# Inspo Visual Reference Library Export',
    '',
    `Exported on: ${new Date().toLocaleString()}`,
    `Total References: ${visuals.length}`,
    '',
    '> **Note**: To keep export file sizes fast and lightweight, image files are included in the `images/` directory, while video media files are omitted with their source and post links preserved.',
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
      markdownLines.push(`- **Local File**: \`images/${m.filename}\``);
    } else {
      markdownLines.push(`- **Original Media URL**: [View Media](${m.imageUrl})`);
    }
    markdownLines.push(`- **Saved Date**: ${new Date(m.createdAt).toLocaleDateString()}`);
    markdownLines.push('');
  });

  zip.file('INDEX.md', markdownLines.join('\n'));

  // Generate and save ZIP file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(zipBlob, `inspo-visual-library-${dateStr}.zip`);

  return { count: visuals.length };
}
