/**
 * Tiny hash router (`#/console/x/search`, `#/listening/<id>`, `#/templates`, `#/history`).
 * Hash routes work on any static host, including GitHub Pages, with no rewrite rules, and keep
 * the `?mock=1` query intact.
 */
import { useSyncExternalStore } from 'react';

export type View = 'console' | 'listening' | 'templates' | 'history';

export interface Route {
  view: View;
  /** Remaining path segments, e.g. ['x', 'search'] for the console. */
  parts: string[];
}

const VIEWS: View[] = ['console', 'listening', 'templates', 'history'];

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const view = VIEWS.includes(parts[0] as View) ? (parts.shift() as View) : 'console';
  return { view, parts };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

let cachedHash = '';
let cachedRoute: Route = parseHash('');

function snapshot(): Route {
  const h = window.location.hash;
  if (h !== cachedHash) {
    cachedHash = h;
    cachedRoute = parseHash(h);
  }
  return cachedRoute;
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function navigate(path: string, replace = false) {
  const hash = `#/${path.replace(/^\/+/, '')}`;
  if (replace) window.history.replaceState(null, '', hash);
  else if (window.location.hash !== hash) window.location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
