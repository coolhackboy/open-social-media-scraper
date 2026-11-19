/**
 * Local persistence. Runs, monitors and the listening inbox live in IndexedDB (idb-keyval);
 * small settings live in localStorage. Mock mode uses separate databases so demo data never
 * mixes with real data.
 */
import { clear, createStore, del, entries, get, set, type UseStore } from 'idb-keyval';

const MOCK = (() => {
  try {
    return new URLSearchParams(window.location.search).get('mock') === '1';
  } catch {
    return false;
  }
})();

function store(name: string): UseStore {
  return createStore(`osms${MOCK ? '-mock' : ''}-${name}`, name);
}

function table<T>(name: string) {
  let s: UseStore | null = null;
  const st = () => (s ??= store(name));
  return {
    async all(): Promise<T[]> {
      try {
        return (await entries<string, T>(st())).map(([, v]) => v);
      } catch {
        return [];
      }
    },
    get(id: string): Promise<T | undefined> {
      return get<T>(id, st()).catch(() => undefined);
    },
    put(id: string, value: T): Promise<void> {
      return set(id, value, st()).catch(() => undefined);
    },
    remove(id: string): Promise<void> {
      return del(id, st()).catch(() => undefined);
    },
    clear(): Promise<void> {
      return clear(st()).catch(() => undefined);
    },
  };
}

export const db = {
  runs: table<import('./types').Run>('runs'),
  monitors: table<import('./listening').Monitor>('monitors'),
  inbox: table<import('./listening').InboxItem[]>('inbox'),
};

/** localStorage helpers that never throw (private mode, quota, blocked storage). */
export const local = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
