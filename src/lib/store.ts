import { create } from 'zustand';
import { config } from '../config';
import { local } from './db';
import type { Run } from './types';

export type Theme = 'light' | 'dark';

const K = {
  key: 'osms.apiKey',
  base: 'osms.apiBase',
  theme: 'osms.theme',
  media: 'osms.remoteMedia',
};

interface SettingsState {
  apiKey: string;
  apiBase: string;
  theme: Theme;
  /** Load thumbnails and avatars from the platforms' CDNs (off by default for privacy). */
  remoteMedia: boolean;
  setApiKey(key: string): void;
  forgetKey(): void;
  setApiBase(base: string): void;
  setTheme(theme: Theme): void;
  setRemoteMedia(on: boolean): void;
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? '#16181b' : '#f7f6f3');
}

export const useSettings = create<SettingsState>((set) => ({
  apiKey: local.get(K.key) ?? '',
  apiBase: (local.get(K.base) || config.defaultApiBase).replace(/\/+$/, ''),
  theme: local.get(K.theme) === 'dark' ? 'dark' : 'light',
  remoteMedia: local.get(K.media) === '1',
  setApiKey(key) {
    const v = key.trim();
    local.set(K.key, v);
    set({ apiKey: v });
  },
  forgetKey() {
    local.remove(K.key);
    set({ apiKey: '' });
  },
  setApiBase(base) {
    const v = (base.trim() || config.defaultApiBase).replace(/\/+$/, '');
    if (v === config.defaultApiBase) local.remove(K.base);
    else local.set(K.base, v);
    set({ apiBase: v });
  },
  setTheme(theme) {
    local.set(K.theme, theme);
    applyTheme(theme);
    set({ theme });
  },
  setRemoteMedia(on) {
    local.set(K.media, on ? '1' : '0');
    set({ remoteMedia: on });
  },
}));

export function initTheme() {
  applyTheme(useSettings.getState().theme);
}

/* ---------------------------------------------------------------- runs */

interface RunsState {
  runs: Record<string, Run>;
  loaded: boolean;
  upsert(run: Run): void;
  patch(id: string, patch: Partial<Run>): Run | undefined;
  remove(id: string): void;
  replaceAll(runs: Run[]): void;
}

export const useRuns = create<RunsState>((set, get) => ({
  runs: {},
  loaded: false,
  upsert(run) {
    set((s) => ({ runs: { ...s.runs, [run.id]: run } }));
  },
  patch(id, patch) {
    const cur = get().runs[id];
    if (!cur) return undefined;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    set((s) => ({ runs: { ...s.runs, [id]: next } }));
    return next;
  },
  remove(id) {
    set((s) => {
      const runs = { ...s.runs };
      delete runs[id];
      return { runs };
    });
  },
  replaceAll(runs) {
    set({ runs: Object.fromEntries(runs.map((r) => [r.id, r])), loaded: true });
  },
}));

/* ---------------------------------------------------------------- account */

interface AccountState {
  credits: number | null;
  email: string | null;
  demo: boolean;
  status: 'idle' | 'loading' | 'ok' | 'error';
  error?: string;
  set(p: Partial<Omit<AccountState, 'set'>>): void;
}

export const useAccount = create<AccountState>((set) => ({
  credits: null,
  email: null,
  demo: false,
  status: 'idle',
  set: (p) => set(p),
}));

/* ---------------------------------------------------------------- toasts */

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'ok' | 'bad';
}

interface ToastState {
  toasts: Toast[];
  push(text: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let toastId = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(text, tone = 'info') {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().push(text, tone);
