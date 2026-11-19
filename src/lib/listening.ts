/**
 * Social listening: saved keyword monitors that run on demand across several search endpoints.
 * Results are merged into a per-monitor inbox, deduped by platform + id, with a triage state
 * (open / replied / ignored). There is no scheduler: the app is browser-only.
 */
import { create } from 'zustand';
import { findEndpoint } from '../data/catalog';
import { estimate, sumEstimates, type Estimate } from './cost';
import { db } from './db';
import { itemKey } from './normalize';
import { settled, startRun } from './runner';
import { toast } from './store';
import type { Endpoint, Item } from './types';

/** Search endpoints a monitor can use (verified against the catalog at build time). */
export const LISTENING_SOURCES = ['x/search', 'reddit/search', 'tiktok/search', 'youtube/search', 'threads/search'] as const;

export interface Monitor {
  id: string;
  name: string;
  keywords: string[];
  sources: string[];
  /** Results per keyword per source (ignored by sources without results_limit). */
  limit: number;
  createdAt: number;
  lastRunAt?: number;
  /** Run ids of the most recent run. */
  lastRunIds?: string[];
  lastRunCredits?: number;
}

export type TriageState = 'open' | 'replied' | 'ignored';

export interface InboxItem {
  key: string;
  item: Item;
  endpointId: string;
  keywords: string[];
  firstSeen: number;
  lastSeen: number;
  state: TriageState;
}

interface ListeningState {
  monitors: Monitor[];
  inbox: Record<string, InboxItem[]>;
  progress: Record<string, { done: number; total: number } | undefined>;
  loaded: boolean;
}

export const useListening = create<ListeningState>(() => ({ monitors: [], inbox: {}, progress: {}, loaded: false }));

export async function loadListening() {
  const monitors = (await db.monitors.all()).sort((a, b) => a.createdAt - b.createdAt);
  const inbox: Record<string, InboxItem[]> = {};
  for (const m of monitors) inbox[m.id] = (await db.inbox.get(m.id)) ?? [];
  useListening.setState({ monitors, inbox, loaded: true });
}

function setMonitor(m: Monitor) {
  useListening.setState((s) => {
    const i = s.monitors.findIndex((x) => x.id === m.id);
    const monitors = [...s.monitors];
    if (i >= 0) monitors[i] = m;
    else monitors.push(m);
    return { monitors };
  });
  void db.monitors.put(m.id, m);
}

export function saveMonitor(input: Omit<Monitor, 'id' | 'createdAt'> & { id?: string }): Monitor {
  const existing = input.id ? useListening.getState().monitors.find((m) => m.id === input.id) : undefined;
  const m: Monitor = {
    ...existing,
    ...input,
    id: existing?.id ?? `m${Date.now().toString(36)}`,
    createdAt: existing?.createdAt ?? Date.now(),
    keywords: [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))],
  };
  setMonitor(m);
  return m;
}

export function deleteMonitor(id: string) {
  useListening.setState((s) => {
    const inbox = { ...s.inbox };
    delete inbox[id];
    return { monitors: s.monitors.filter((m) => m.id !== id), inbox };
  });
  void db.monitors.remove(id);
  void db.inbox.remove(id);
}

function clampLimit(ep: Endpoint, limit: number): number | undefined {
  const f = ep.input.properties.results_limit;
  if (!f) return undefined;
  let n = Math.max(f.minimum ?? 1, Math.min(f.maximum ?? limit, limit));
  if (f.multipleOf) n = Math.max(f.multipleOf, Math.round(n / f.multipleOf) * f.multipleOf);
  return n;
}

export interface PlannedRequest {
  endpointId: string;
  keyword: string;
  body: Record<string, unknown>;
  estimate: Estimate | null;
}

export function plan(m: Pick<Monitor, 'keywords' | 'sources' | 'limit'>): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  for (const src of m.sources) {
    const ep = findEndpoint(src);
    if (!ep) continue;
    for (const keyword of m.keywords) {
      const body: Record<string, unknown> = { query: keyword };
      const limit = clampLimit(ep, m.limit);
      if (limit !== undefined) body.results_limit = limit;
      out.push({ endpointId: src, keyword, body, estimate: estimate(ep.billing, body) });
    }
  }
  return out;
}

export function planCost(m: Pick<Monitor, 'keywords' | 'sources' | 'limit'>): Estimate {
  return sumEstimates(plan(m).map((p) => p.estimate));
}

function merge(monitorId: string, endpointId: string, keyword: string, items: Item[], seenAt: number): number {
  const list = [...(useListening.getState().inbox[monitorId] ?? [])];
  const index = new Map(list.map((x, i) => [x.key, i]));
  let added = 0;
  for (const item of items) {
    const key = itemKey(item);
    const i = index.get(key);
    if (i === undefined) {
      index.set(key, list.length);
      list.push({ key, item, endpointId, keywords: [keyword], firstSeen: seenAt, lastSeen: seenAt, state: 'open' });
      added++;
    } else {
      const cur = list[i];
      list[i] = {
        ...cur,
        item,
        lastSeen: seenAt,
        keywords: cur.keywords.includes(keyword) ? cur.keywords : [...cur.keywords, keyword],
      };
    }
  }
  useListening.setState((s) => ({ inbox: { ...s.inbox, [monitorId]: list } }));
  void db.inbox.put(monitorId, list);
  return added;
}

export async function runMonitor(id: string): Promise<void> {
  const m = useListening.getState().monitors.find((x) => x.id === id);
  if (!m || useListening.getState().progress[id]) return;
  const requests = plan(m);
  if (!requests.length) return;
  const runAt = Date.now();
  const setProgress = (done: number) =>
    useListening.setState((s) => ({ progress: { ...s.progress, [id]: done >= requests.length ? undefined : { done, total: requests.length } } }));
  setProgress(0);

  let done = 0;
  let added = 0;
  let credits = 0;
  let failed = 0;
  const runIds: string[] = [];
  await Promise.all(
    requests.map(async (r) => {
      const runId = startRun(r.endpointId, r.body, { kind: 'listening', ref: id, label: `${m.name} · ${r.keyword}` });
      runIds.push(runId);
      const run = await settled(runId);
      if (run?.status === 'succeeded') added += merge(id, r.endpointId, r.keyword, run.items, runAt);
      else failed++;
      credits += run?.credits ?? 0;
      setProgress(++done);
    }),
  );
  setMonitor({ ...m, lastRunAt: runAt, lastRunIds: runIds, lastRunCredits: Number(credits.toFixed(4)) });
  toast(
    `${m.name}: ${added} new item${added === 1 ? '' : 's'}${failed ? `, ${failed} request${failed === 1 ? '' : 's'} failed` : ''}`,
    failed ? 'bad' : 'ok',
  );
}

export function setTriage(monitorId: string, keys: string[], state: TriageState) {
  const set = new Set(keys);
  const list = (useListening.getState().inbox[monitorId] ?? []).map((x) => (set.has(x.key) ? { ...x, state } : x));
  useListening.setState((s) => ({ inbox: { ...s.inbox, [monitorId]: list } }));
  void db.inbox.put(monitorId, list);
}

export function clearInbox(monitorId: string) {
  useListening.setState((s) => ({ inbox: { ...s.inbox, [monitorId]: [] } }));
  void db.inbox.put(monitorId, []);
}
