export interface VisualItem {
  id: string;
  imageUrl: string;
  imageBlob?: Blob;
  mimeType?: string;
  mediaType?: 'image' | 'gif' | 'video';
  sourceUrl: string;
  sourceTitle?: string;
  note?: string;
  width?: number;
  height?: number;
  createdAt: string;
}

export type ExportMetadataItem = {
  id: string;
  filename: string;
  sourceUrl: string;
  sourceTitle: string;
  note: string;
  mediaType?: string;
  width?: number;
  height?: number;
  createdAt: string;
};

export type SaveVisualPayload = {
  imageUrl: string;
  sourceUrl: string;
  sourceTitle?: string;
  note?: string;
  mediaType?: 'image' | 'gif' | 'video';
  mimeType?: string;
  width?: number;
  height?: number;
  dataUrl?: string;
};

export type MessageRequest =
  | { type: 'SAVE_VISUAL'; payload: SaveVisualPayload }
  | { type: 'CHECK_DUPLICATE'; payload: { imageUrl: string; sourceUrl: string } }
  | { type: 'UPDATE_NOTE'; payload: { id: string; note: string } }
  | { type: 'OPEN_LIBRARY' };

export type MessageResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};
