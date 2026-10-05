import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../api/coolapk';
import { APP_VERSION } from '../constants/version';
import { getFeedbackTemplate } from './feedback';
import { redactDiagnosticText } from './diagnosticLogger';
import { MAX_DIAGNOSTIC_IMAGE_BYTES, MAX_DIAGNOSTIC_LOG_BYTES, packDiagnosticImage, unpackDiagnosticImage, formatDiagnosticTime } from './diagnosticImage';

export const DIAGNOSTIC_LINK_LABEL = '诊断日志图片：';

export function sanitizeFeedbackLogs(content: string): string {
  const lines = content.split(/\r?\n/).filter(line => !/heartbeat uptime_s=/.test(line)).slice(-3000);
  const safe = lines.map(line => {
    // A Cookie header may contain multiple secrets; remove the complete line rather than only its first value.
    if (/\b(?:cookie|authorization|set-cookie|SESSID|ddid|(?:_v2_)?post_token|access_token|access_key_id|access_key_secret|security_token|client_secret|device_id|deviceCode|oaid|imei|imsi|idfa)["']?\s*[=:]/i.test(line)) return '[已移除凭据所在日志行]';
    return redactDiagnosticText(line)
      .replace(/\b(?:message|content|body|text|response|request_body|response_body)["']?\s*[=:].*/gi, '[已移除正文]')
      .replace(/\/data\/(?:user\/\d+|data)\/[^/\s]+/g, '[app-dir]');
  }).join('\n').trim();
  // Keep the recent end without splitting UTF-8 characters.
  const bytes = new TextEncoder().encode(safe);
  if (bytes.length <= MAX_DIAGNOSTIC_LOG_BYTES) return safe;
  let start = bytes.length - MAX_DIAGNOSTIC_LOG_BYTES;
  while ((bytes[start]! & 0xc0) === 0x80) start++;
  return new TextDecoder().decode(bytes.subarray(start));
}

export function normalizeDiagnosticImageUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'image.coolapk.com'
    || url.username || url.password || !/^\/feed\/.*\.png$/i.test(url.pathname) || url.search || url.hash) {
    throw new Error('请填写酷安诊断日志的 PNG 原图地址');
  }
  url.protocol = 'https:';
  return url.href;
}

export function getDiagnosticLink(text: string): string {
  const value = text.replace(/<[^>]*>/g, '').match(/诊断日志图片：\s*(https?:\/\/[^\s<>"']+)/)?.[1];
  if (!value) return '';
  try { return normalizeDiagnosticImageUrl(value); } catch { return ''; }
}

async function createCover(createdAt: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  // A small carrier avoids the watermark/re-encoding observed on larger feed images.
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法生成日志图片，请取消附带日志后发送，或导出日志');
  context.fillStyle = '#f1f8f5';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#087c4b';
  context.textAlign = 'center';
  context.font = 'bold 20px sans-serif';
  context.fillText('日志', 32, 24);
  context.font = '10px sans-serif';
  context.fillText(formatDiagnosticTime(createdAt).slice(11, 16), 32, 41);
  context.font = '9px sans-serif';
  context.fillText('北京时间', 32, 55);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('生成日志图片失败')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function createFeedbackDiagnosticImage(): Promise<Uint8Array> {
  const snapshot = await invoke<{ content: string }>('get_diagnostic_logs');
  const log = sanitizeFeedbackLogs(snapshot.content || '');
  if (!log) throw new Error('暂无可附带的日志，请取消附带日志后发送');
  const createdAt = new Date().toISOString();
  const report = {
    version: APP_VERSION,
    platform: getFeedbackTemplate().match(/操作系统：([^\n]+)/)?.[1] || '未知',
    createdAt,
    log,
  };
  return packDiagnosticImage(await createCover(createdAt), report);
}

export async function uploadFeedbackDiagnosticImage(): Promise<string> {
  const bytes = await createFeedbackDiagnosticImage();
  // Upload the original bytes. No canvas decoding, thumbnail conversion or image message sending here.
  const response = await CoolapkTauriAPI.uploadImage(bytes, `coolapk-diagnostics-${Date.now()}.png`, 'image/png', 'feed');
  const data = response?.data ?? response;
  const url = typeof data === 'string' ? data : data?.url;
  if (!url) throw new Error('日志已上传，但未取得原图地址');
  const originalUrl = normalizeDiagnosticImageUrl(url);
  const original = await downloadDiagnosticImage(originalUrl);
  if (original.length !== bytes.length || !original.every((byte, index) => byte === bytes[index])) {
    throw new Error('酷安改写了日志图片，暂未发送反馈，请重试；仍失败可取消附带日志，改用导出日志');
  }
  try { unpackDiagnosticImage(original); }
  catch { throw new Error('酷安处理后的图片未能保留完整日志，请重新发送；仍失败可取消附带日志，改用导出日志'); }
  return originalUrl;
}

async function downloadDiagnosticImage(value: string): Promise<Uint8Array> {
  const url = normalizeDiagnosticImageUrl(value);
  const dataUrl = await CoolapkTauriAPI.getImageDataUrl(url);
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1]!.length > Math.ceil(MAX_DIAGNOSTIC_IMAGE_BYTES / 3) * 4) throw new Error('下载内容不是有效日志原图，或超过 2 MB');
  return Uint8Array.from(atob(match[1]!), character => character.charCodeAt(0));
}

export async function readDiagnosticImageUrl(value: string) {
  return unpackDiagnosticImage(await downloadDiagnosticImage(value));
}
