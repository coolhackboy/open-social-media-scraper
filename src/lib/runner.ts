/**
 * Runs a request end to end: submit → poll with backoff → first page of results, then pages on
 * demand. Every run is mirrored to IndexedDB so history survives a reload, and runs that were
 * still queued/running when the page closed resume polling on the next load.
 */
import { findEndpoint } from '../data/catalog';
import { ApiError, api } from './api';
import { estimate } from './cost';
import { db } from './db';
import { toast, useAccount, useRuns } from './store';
import { isActive, type Item, type Run, type RunOrigin } from './types';

export const PAGE_SIZE = 50;
/** Hard cap on items kept per run (UI and IndexedDB). */
export const MAX_ITEMS = 5000;
/** Stop polling after this long; the task keeps running server-side and can be resumed. */
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

const polling = new Set<string>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function persist(run: Run | undefined) {
  if (run && run.status !== 'submitting') void db.runs.put(run.id, run);
}

function patch(id: string, p: Partial<Run>): Run | undefined {
  const next = useRuns.getState().patch(id, p);
  persist(next);
  return next;
}

export async function loadHistory(): Promise<void> {
  const runs = await db.runs.all();
  // A submit that never got a task id cannot be resumed.
  for (const r of runs) if (r.status === 'submitting') r.status = 'error';
  useRuns.getState().replaceAll(runs);
  for (const r of runs) if (isActive(r.status) && r.taskId) void poll(r.id);
}

export function startRun(endpointId: string, body: Record<string, unknown>, origin: RunOrigin = { kind: 'console' }): string {
  const ep = findEndpoint(endpointId);
  const now = Date.now();
  const run: Run = {
    id: uid(),
    endpointId,
    input: body,
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    idempotencyKey: uid(),
    estimate: estimate(ep?.billing, body)?.credits ?? null,
    items: [],
    nextCursor: null,
    hasMore: false,
    origin,
  };
  useRuns.getState().upsert(run);
  void submit(run.id);
  return run.id;
}

async function submit(id: string) {
  const run = useRuns.getState().runs[id];
  if (!run) return;
  const client = await api();
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await client.submit(run.endpointId, run.input, run.idempotencyKey);
      patch(id, { taskId: res.taskId, status: res.status === 'running' ? 'running' : 'queued' });
      void poll(id);
      return;
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String(e), 0);
      // The same idempotency key makes a retry safe even if the first submit got through.
      if (err.transient && attempt < 3) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      patch(id, { status: 'error', error: describe(err), finishedAt: Date.now() });
      return;
    }
  }
}

function describe(err: ApiError): string {
  if (err.status === 422 && err.details && typeof err.details === 'object') {
    const d = JSON.stringify(err.details);
    return `${err.message} (${d.length > 200 ? `${d.slice(0, 200)}…` : d})`;
  }
  return err.status ? `${err.message} [${err.status}]` : err.message;
}

export async function poll(id: string): Promise<void> {
  if (polling.has(id)) return;
  polling.add(id);
  try {
    const client = await api();
    const started = Date.now();
    let delay = 1200;
    let failures = 0;
    for (;;) {
      const run = useRuns.getState().runs[id];
      if (!run?.taskId || !isActive(run.status)) return;
      if (Date.now() - started > POLL_TIMEOUT_MS) {
        patch(id, { status: 'error', error: 'Still running after 30 minutes. Open the run later to check again.' });
        return;
      }
      await sleep(delay);
      try {
        const t = await client.task(run.taskId, { limit: PAGE_SIZE });
        failures = 0;
        if (t.status === 'succeeded') {
          patch(id, {
            status: 'succeeded',
            items: (t.results?.items ?? []).slice(0, MAX_ITEMS),
            nextCursor: t.results?.nextCursor ?? null,
            hasMore: !!t.results?.hasMore,
            schemaId: t.results?.schemaId,
            credits: t.credits,
            resultCount: t.resultCount,
            finishedAt: Date.now(),
          });
          void refreshAccount();
          return;
        }
        if (t.status === 'failed') {
          patch(id, { status: 'failed', error: t.error || 'The task failed.', credits: t.credits, finishedAt: Date.now() });
          void refreshAccount();
          return;
        }
        if (t.status !== run.status && (t.status === 'queued' || t.status === 'running')) patch(id, { status: t.status });
        delay = Math.min(10_000, Math.round(delay * 1.5));
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(String(e), 0);
        if (err.transient && ++failures < 6) {
          delay = Math.min(30_000, delay * 2);
          continue;
        }
        patch(id, { status: 'error', error: describe(err) });
        return;
      }
    }
  } finally {
    polling.delete(id);
  }
}

/** Re-checks a run that stopped polling (timeout or a network error). */
export function resume(id: string) {
  const run = useRuns.getState().runs[id];
  if (!run?.taskId) return;
  patch(id, { status: 'running', error: undefined });
  void poll(id);
}

const paging = new Set<string>();

/** Loads the next page, or every remaining page when `all` is set (up to MAX_ITEMS). */
export async function loadMore(id: string, all = false): Promise<void> {
  if (paging.has(id)) return;
  paging.add(id);
  try {
    const client = await api();
    for (;;) {
      const run = useRuns.getState().runs[id];
      if (!run?.taskId || !run.hasMore || !run.nextCursor) return;
      if (run.items.length >= MAX_ITEMS) {
        toast(`Stopped at ${MAX_ITEMS.toLocaleString()} items. Use the raw files for the full export.`);
        return;
      }
      const t = await client.task(run.taskId, { cursor: run.nextCursor, limit: PAGE_SIZE });
      const items: Item[] = [...run.items, ...(t.results?.items ?? [])].slice(0, MAX_ITEMS);
      patch(id, { items, nextCursor: t.results?.nextCursor ?? null, hasMore: !!t.results?.hasMore });
      if (!all) return;
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Could not load more results', 'bad');
  } finally {
    paging.delete(id);
  }
}

export function deleteRun(id: string) {
  useRuns.getState().remove(id);
  void db.runs.remove(id);
}

export async function clearHistory() {
  for (const r of Object.values(useRuns.getState().runs)) if (!isActive(r.status)) deleteRun(r.id);
}

/** Waits until a run reaches a terminal state. */
export function settled(id: string): Promise<Run | undefined> {
  return new Promise((resolve) => {
    const check = (runs: Record<string, Run>) => {
      const r = runs[id];
      if (!r || !isActive(r.status)) {
        unsub();
        resolve(r);
        return true;
      }
      return false;
    };
    const unsub = useRuns.subscribe((s) => check(s.runs));
    check(useRuns.getState().runs);
  });
}

export async function refreshAccount(): Promise<void> {
  const acc = useAccount.getState();
  acc.set({ status: 'loading', error: undefined });
  try {
    const a = await (await api()).account();
    useAccount.getState().set({ status: 'ok', credits: a.credits, email: a.email, demo: !!a.demo });
  } catch (e) {
    useAccount.getState().set({ status: 'error', credits: null, error: e instanceof Error ? e.message : 'Could not load account' });
  }
}
