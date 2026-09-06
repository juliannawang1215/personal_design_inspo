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

export interface InspoSettings {
  disabledDomains: string[];
  isGloballyPaused: boolean;
}

export type MessageRequest =
  | { type: 'SAVE_VISUAL'; payload: SaveVisualPayload }
  | { type: 'CHECK_DUPLICATE'; payload: { imageUrl: string; sourceUrl: string } }
  | { type: 'UPDATE_NOTE'; payload: { id: string; note: string } }
  | { type: 'OPEN_LIBRARY' }
  | { type: 'GET_SETTINGS' }
  | { type: 'DISABLE_SITE'; payload: { domain: string } }
  | { type: 'ENABLE_SITE'; payload: { domain: string } }
  | { type: 'TOGGLE_GLOBAL_PAUSE'; payload: { paused: boolean } }
  | { type: 'SETTINGS_UPDATED'; payload?: InspoSettings }
  | { type: 'CHECK_DOMAIN_DISABLED'; payload: { domain: string } };

export type MessageResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};
