/**
 * SocQ API client (browser → api.socq.ai, CORS open). This is the only module that knows the
 * wire format. In mock mode (`?mock=1`) the same interface is served by `mock.ts`, which is
 * loaded lazily, so a normal session never downloads the demo fixtures.
 *
 *   POST /v1/<platform>/<resource>   submit        → { code: 200, data: { task_id, status } }
 *   GET  /v1/tasks/{id}?cursor&limit  status + page → data.results { items, next_cursor, has_more }
 *   GET  /v1/tasks/{id}/files         raw files
 *   GET  /v1/account                  account + credits
 */
import { useSettings } from './store';
import type { Item } from './types';

export const MOCK_MODE = (() => {
  try {
    return new URLSearchParams(window.location.search).get('mock') === '1';
  } catch {
    return false;
  }
})();

export interface SubmitResult {
  taskId: string;
  status: string;
}

export interface TaskPage {
  taskId: string;
  status: string;
  resultCount: number | null;
  credits: number | null;
  error: string | null;
  results?: {
    items: Item[];
    nextCursor: string | null;
    hasMore: boolean;
    schemaId?: string;
  };
}

export interface TaskFile {
  type: string;
  url: string;
  size: number | null;
  itemCount: number | null;
  expiresAt: string | null;
}

export interface Account {
  email: string | null;
  credits: number | null;
  plan: string | null;
  demo?: boolean;
}

export interface ApiClient {
  submit(endpointId: string, body: Record<string, unknown>, idempotencyKey: string): Promise<SubmitResult>;
  task(taskId: string, opts?: { cursor?: string | null; limit?: number }): Promise<TaskPage>;
  files(taskId: string): Promise<TaskFile[]>;
  account(): Promise<Account>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly type?: string;
  readonly details?: unknown;
  constructor(message: string, status: number, type?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.details = details;
  }
  /** Worth retrying automatically (network, rate limit, transient server errors). */
  get transient(): boolean {
    return this.status === 0 || this.status === 429 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

const HINTS: Record<number, string> = {
  400: 'Invalid request',
  401: 'Invalid or missing API key. Check Settings.',
  402: 'Insufficient credits on your SocQ account.',
  403: 'Not allowed for this API key (IP allowlist or task owner).',
  404: 'Not found',
  422: 'Some input values were rejected',
  429: 'Rate or credit limit reached for this key. Wait a moment and retry.',
  500: 'SocQ could not submit the task',
  502: 'Upstream error',
  503: 'Service unavailable',
};

interface Envelope {
  code?: number;
  message?: string;
  detail?: unknown;
  error?: { message?: string; type?: string; details?: unknown } | string;
  data?: unknown;
}

function messageOf(body: Envelope | null): { message?: string; type?: string; details?: unknown } {
  if (!body) return {};
  if (body.error && typeof body.error === 'object') return { message: body.error.message, type: body.error.type, details: body.error.details };
  if (typeof body.error === 'string') return { message: body.error };
  if (typeof body.detail === 'string') return { message: body.detail };
  if (Array.isArray(body.detail)) {
    const parts = body.detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? ''}`);
    return { message: parts.join('; ') };
  }
  return { message: body.message };
}

function base(): string {
  return useSettings.getState().apiBase;
}

function headers(json = false): Record<string, string> {
  const key = useSettings.getState().apiKey.trim();
  if (!key) throw new ApiError('Add your SocQ API key in Settings first.', 401, 'no_key');
  const h: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { ...init, credentials: 'omit', cache: 'no-store' });
  } catch {
    throw new ApiError('Network error. Check your connection.', 0, 'network');
  }
  let body: Envelope | null = null;
  try {
    body = (await res.json()) as Envelope;
  } catch {
    /* non-JSON error page */
  }
  const code = body?.code ?? res.status;
  if (!res.ok || code !== 200) {
    const status = res.ok ? code : res.status;
    const m = messageOf(body);
    throw new ApiError(m.message || HINTS[status] || `Request failed (${status})`, status, m.type, m.details);
  }
  return body?.data as T;
}

interface RawTask {
  task_id: string;
  status: string;
  result_count?: number | null;
  credits_amount?: number | null;
  error_message?: string | null;
  results?: { items?: Item[]; next_cursor?: string | null; has_more?: boolean; schema_id?: string };
}

export function parseTask(d: RawTask): TaskPage {
  return {
    taskId: d.task_id,
    status: d.status,
    resultCount: d.result_count ?? null,
    credits: d.credits_amount ?? null,
    error: d.error_message ?? null,
    results: d.results
      ? {
          items: d.results.items ?? [],
          nextCursor: d.results.next_cursor ?? null,
          hasMore: !!d.results.has_more,
          schemaId: d.results.schema_id,
        }
      : undefined,
  };
}

const realClient: ApiClient = {
  async submit(endpointId, body, idempotencyKey) {
    const data = await request<{ task_id: string; status: string }>(`/v1/${endpointId}`, {
      method: 'POST',
      headers: { ...headers(true), 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    });
    return { taskId: data.task_id, status: data.status };
  },
  async task(taskId, opts = {}) {
    const q = new URLSearchParams();
    q.set('limit', String(opts.limit ?? 50));
    if (opts.cursor) q.set('cursor', opts.cursor);
    const data = await request<RawTask>(`/v1/tasks/${encodeURIComponent(taskId)}?${q}`, { headers: headers() });
    return parseTask(data);
  },
  async files(taskId) {
    const data = await request<{ items?: { file_type: string; public_url: string; file_size?: number; item_count?: number; expires_at?: string | null }[] }>(
      `/v1/tasks/${encodeURIComponent(taskId)}/files`,
      { headers: headers() },
    );
    return (data.items ?? []).map((f) => ({
      type: f.file_type,
      url: f.public_url,
      size: f.file_size ?? null,
      itemCount: f.item_count ?? null,
      expiresAt: f.expires_at ?? null,
    }));
  },
  async account() {
    const data = await request<{ email?: string; credits?: number; plan_code?: string }>('/v1/account', { headers: headers() });
    return { email: data.email ?? null, credits: data.credits ?? null, plan: data.plan_code ?? null };
  },
};

let mockClient: Promise<ApiClient> | null = null;

export function api(): Promise<ApiClient> {
  if (!MOCK_MODE) return Promise.resolve(realClient);
  mockClient ??= import('./mock').then((m) => m.mockClient);
  return mockClient;
}
