export type CdnUploadStatus = 'queued' | 'preparing' | 'uploading' | 'cancelling' | 'completed' | 'failed' | 'cancelled';

export interface CdnUploadTask {
  id: string;
  /** Monotonic request generation used to discard late progress from earlier upload attempts. */
  attempt: number;
  filePath: string;
  fileName: string;
  status: CdnUploadStatus;
  uploaded: number;
  total: number;
  speed: number;
  url: string;
  error: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number;
}

export interface CdnUploadProgressEvent {
  taskId?: string;
  attempt: number;
  status?: string;
  fileName?: string;
  uploaded?: number;
  /** Older command builds may still use `downloaded` for byte progress. */
  downloaded?: number;
  total?: number;
  speed?: number;
  url?: string;
  error?: string;
}
