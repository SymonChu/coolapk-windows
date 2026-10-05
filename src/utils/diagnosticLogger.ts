import { invoke } from '@tauri-apps/api/core';
import { debug as writeDebug, error as writeError, info as writeInfo, warn as writeWarn } from '@tauri-apps/plugin-log';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
let installed = false;
let writing = false;
let verbose = false;
const recentEvents = new Map<string, number>();
const CONSOLE_DEDUPLICATION_MS = 5_000;
const CLICK_DEDUPLICATION_MS = 1_000;
const MAX_RECENT_EVENTS = 500;

function loggingAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
}

export async function setVerboseDiagnosticLogging(enabled: boolean): Promise<void> {
  await invoke('set_diagnostic_verbose', { enabled });
  verbose = enabled;
}

export async function getVerboseDiagnosticLogging(): Promise<boolean> {
  verbose = await invoke<boolean>('get_diagnostic_verbose');
  return verbose;
}

/** Only short, redacted summaries are persisted. Never serialize arbitrary objects. */
export function redactDiagnosticText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[url]';
      }
    })
    .replace(/"(?:SESSID|cookie|token|access[_-]?token|password|passwd|device[_-]?id|deviceCode|oaid|ck|code)"\s*:\s*"[^"]*"/gi, '"[credential]"')
    .replace(/\b(?:SESSID|cookie|token|access[_-]?token|password|passwd|device[_-]?id|deviceCode|oaid|ck|code)\s*[:=]\s*[^\s;,&]+/gi, '[credential]')
    .replace(/\b(?:Authorization\s*:\s*Bearer|Bearer)\s+[^\s]+/gi, '[credential]')
    .replace(/(?:[?&](?:code|ck|token|access_token|device_id|password)=)[^&#\s]+/gi, '[credential]')
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '[user-dir]')
    .replace(/\/(?:Users|home)\/[^/\s]+/g, '[user-dir]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 2000);
}

function summarize(value: unknown): string {
  if (typeof value === 'string') return redactDiagnosticText(value);
  if (value instanceof Error) return redactDiagnosticText(`${value.name}: ${value.message}`);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '[object]';
}

function summarizeConsoleArguments(values: unknown[]): string {
  return values
    .map((value) => summarizeDiagnosticError(value))
    .filter((value) => value && value !== 'unknown')
    .join(' | ')
    .slice(0, 800) || 'unknown';
}

function consoleDedupeKey(level: 'warn' | 'error', summary: string): string {
  const stableSummary = summary
    .replace(/\b\d{3,}\b/g, '#')
    .replace(/\b[0-9a-f]{8,}\b/gi, '#');
  return `console:${level}:${stableSummary}`;
}

/** Keep one source frame and a short, redacted message; never serialize rejection objects. */
export function summarizeDiagnosticError(value: unknown): string {
  if (typeof value === 'string') return redactDiagnosticText(value).slice(0, 800);
  if (!(value instanceof Error)) return 'unknown';
  const frame = value.stack?.split('\n').slice(1).find(line => line.trim().startsWith('at '))?.trim() || '';
  return redactDiagnosticText(`${value.name}: ${value.message}${frame ? ` frame=${frame}` : ''}`).slice(0, 800);
}

export function logDiagnostic(level: LogLevel, module: string, event: string, detail?: unknown): void {
  if (!loggingAvailable() || writing || (level === 'debug' && !verbose)) return;
  const message = `[frontend][${redactDiagnosticText(module)}] ${redactDiagnosticText(event)}${detail === undefined ? '' : ` ${summarize(detail)}`}`;
  writing = true;
  try {
    const send = level === 'error' ? writeError : level === 'warn' ? writeWarn : level === 'debug' ? writeDebug : writeInfo;
    void send(message).catch(() => undefined);
  } finally {
    writing = false;
  }
}

/** Persist repeated events at most once per interval so background retries cannot flood the log. */
export function logDiagnosticLimited(
  level: LogLevel,
  module: string,
  event: string,
  detail?: unknown,
  intervalMs = CONSOLE_DEDUPLICATION_MS,
  dedupeKey = `${module}:${event}:${detail === undefined ? '' : summarize(detail)}`,
): void {
  const now = Date.now();
  const previous = recentEvents.get(dedupeKey) || 0;
  if (now - previous < intervalMs) return;
  recentEvents.set(dedupeKey, now);
  if (recentEvents.size > MAX_RECENT_EVENTS) {
    const oldest = recentEvents.keys().next().value;
    if (oldest) recentEvents.delete(oldest);
  }
  logDiagnostic(level, module, event, detail);
}

function installConsoleDiagnosticBridge(): void {
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...values: unknown[]) => {
      try {
        const summary = summarizeConsoleArguments(values);
        logDiagnosticLimited(level, 'console', level, summary, CONSOLE_DEDUPLICATION_MS, consoleDedupeKey(level, summary));
      } catch {
        // Diagnostics must never interfere with the original console call.
      }
      original(...values);
    };
  }
}

function safeElementToken(value: string | null | undefined): string {
  const token = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{1,64}$/.test(token) ? token : '';
}

function describeClickTarget(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = safeElementToken(element.id);
  const action = safeElementToken(element.dataset.diagnosticAction);
  const role = safeElementToken(element.getAttribute('role'));
  const type = element instanceof HTMLInputElement || element instanceof HTMLButtonElement
    ? safeElementToken(element.type)
    : '';
  const classes = Array.from(element.classList)
    .map((name) => safeElementToken(name))
    .filter(Boolean)
    .slice(0, 3)
    .join('.');
  let destination = '';
  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute('href') || '';
    destination = href.startsWith('#') ? 'hash' : href.startsWith('/') ? 'internal' : /^https?:\/\//i.test(href) ? 'external' : 'other';
  }
  return [
    `element=${tag}`,
    action ? `action=${action}` : '',
    id ? `id=${id}` : '',
    classes ? `class=${classes}` : '',
    role ? `role=${role}` : '',
    type ? `type=${type}` : '',
    destination ? `destination=${destination}` : '',
  ].filter(Boolean).join(' ');
}

function installClickDiagnosticBridge(): void {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('button, a, input, select, [role="button"], [data-diagnostic-action]')
      : null;
    if (!target) return;
    const detail = describeClickTarget(target);
    logDiagnosticLimited('info', 'interaction', 'click', detail, CLICK_DEDUPLICATION_MS, `interaction:click:${detail}`);
  }, { capture: true });
}

/** Initialize logging once. Only named events are persisted; console objects may contain private data. */
export function installDiagnosticLogging(): void {
  if (installed || !loggingAvailable()) return;
  installed = true;
  installConsoleDiagnosticBridge();
  installClickDiagnosticBridge();
  logDiagnostic('info', 'app', 'startup');
}
