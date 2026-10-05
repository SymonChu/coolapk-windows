export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'canceled';

export interface DownloadTask {
  id: string;
  kind: 'apk' | 'xapk' | 'apks';
  title: string;
  packageName: string;
  versionName: string;
  versionCode: string;
  apkId: string;
  logoUrl: string;
  fileName: string;
  extraAnalysisData: string;
  downloadDir: string;
  targetPath: string;
  publicPath?: string;
  partialPath: string;
  status: DownloadStatus;
  downloaded: number;
  total: number;
  speed: number;
  retryCount: number;
  error: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number;
}
