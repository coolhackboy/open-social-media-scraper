import { flatten } from './normalize';
import type { Item } from './types';

export type ExportFormat = 'csv' | 'json' | 'jsonl';

/** UTF-8 byte-order mark so Excel opens CSV exports with the right encoding. */
const BOM = String.fromCharCode(0xfeff);

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Guard against spreadsheet formula injection from scraped text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(items: Item[]): string {
  const rows = items.map((it) => flatten(it));
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (seen.has(k)) continue;
      seen.add(k);
      cols.push(k);
    }
  }
  const lines = [cols.map(csvCell).join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function serialize(items: Item[], format: ExportFormat): { text: string; mime: string } {
  if (format === 'csv') return { text: toCSV(items), mime: 'text/csv;charset=utf-8' };
  if (format === 'jsonl') return { text: `${items.map((i) => JSON.stringify(i)).join('\n')}\n`, mime: 'application/x-ndjson' };
  return { text: `${JSON.stringify(items, null, 2)}\n`, mime: 'application/json' };
}

export function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportItems(items: Item[], format: ExportFormat, basename: string) {
  const { text, mime } = serialize(items, format);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  download(`${basename.replace(/[^a-z0-9-]+/gi, '-')}-${stamp}.${format}`, text, mime);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
