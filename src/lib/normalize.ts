/**
 * Helpers that read SocQ's normalized result items (PostItem, CommentItem, AccountItem, AdItem…)
 * into the few columns every table shows: author, text, metrics, published_at, url.
 */
import type { Item } from './types';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null);

export interface Author {
  name: string | null;
  handle: string | null;
  url: string | null;
  avatar: string | null;
  verified: boolean;
}

const ACTOR_KEYS = ['author', 'advertiser', 'seller', 'channel', 'owner', 'user', 'creator', 'company', 'host', 'page'];

export function authorOf(item: Item): Author | null {
  for (const k of ACTOR_KEYS) {
    const a = item[k];
    if (isObj(a)) {
      const name = str(a.name) ?? str(a.title);
      const handle = str(a.username) ?? str(a.handle);
      if (name || handle) {
        return { name, handle, url: str(a.url), avatar: str(a.avatar_url) ?? str(a.logo_url), verified: a.is_verified === true };
      }
    }
  }
  // Account-like items describe themselves.
  const handle = str(item.username);
  const name = str(item.name);
  if (handle || (name && ('avatar_url' in item || 'is_verified' in item))) {
    return { name, handle, url: str(item.url), avatar: str(item.avatar_url), verified: item.is_verified === true };
  }
  return null;
}

export function textOf(item: Item): string | null {
  const title = str(item.title);
  const text = str(item.text) ?? str(item.description) ?? str(item.answer) ?? str(item.content) ?? str(item.keyword) ?? str(item.query);
  if (title && text && title !== text) return `${title} — ${text}`;
  return title ?? text ?? (authorOf(item) ? null : str(item.name));
}

export function publishedOf(item: Item): string | null {
  return str(item.published_at) ?? str(item.start_date) ?? str(item.created_at) ?? null;
}

export function urlOf(item: Item): string | null {
  const u = str(item.url) ?? str(item.landing_page_url);
  return u && /^https?:\/\//i.test(u) ? u : null;
}

const METRIC_LABELS: Record<string, string> = {
  likes_count: 'likes',
  comments_count: 'comments',
  shares_count: 'shares',
  views_count: 'views',
  followers_count: 'followers',
  following_count: 'following',
  posts_count: 'posts',
  replies_count: 'replies',
  reposts_count: 'reposts',
  quotes_count: 'quotes',
  bookmarks_count: 'saves',
  saves_count: 'saves',
  subscribers_count: 'subscribers',
  videos_count: 'videos',
  members_count: 'members',
  plays_count: 'plays',
};

export function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_count$/, '').replace(/_/g, ' ');
}

/** Non-null numeric metrics, plus a few top-level numbers (rating, reviews, rank, volume). */
export function metricsOf(item: Item): [string, number][] {
  const out: [string, number][] = [];
  if (isObj(item.metrics)) {
    for (const [k, v] of Object.entries(item.metrics)) if (typeof v === 'number') out.push([k, v]);
  }
  for (const k of ['rating', 'reviews_count', 'sold_count', 'rank', 'search_volume', 'impressions']) {
    const v = item[k];
    if (typeof v === 'number') out.push([k, v]);
  }
  return out;
}

export function metric(item: Item, key: string): number {
  const m = isObj(item.metrics) ? item.metrics[key] : undefined;
  return typeof m === 'number' ? m : 0;
}

/** Simple engagement score used for sorting: likes + comments + shares (+ 1% of views). */
export function engagementOf(item: Item): number {
  return metric(item, 'likes_count') + metric(item, 'comments_count') + metric(item, 'shares_count') + metric(item, 'views_count') / 100;
}

export interface MediaRef {
  type: string;
  url: string | null;
  thumb: string | null;
  duration: number | null;
}

export function mediaOf(item: Item): MediaRef[] {
  const out: MediaRef[] = [];
  if (Array.isArray(item.media)) {
    for (const m of item.media) {
      if (!isObj(m)) continue;
      out.push({
        type: str(m.type) ?? 'media',
        url: str(m.url),
        thumb: str(m.thumbnail_url) ?? (str(m.type) === 'image' ? str(m.url) : null),
        duration: typeof m.duration_seconds === 'number' ? m.duration_seconds : null,
      });
    }
  }
  const cover = str(item.cover_url) ?? str(item.thumbnail_url) ?? str(item.image_url);
  if (!out.length && cover) out.push({ type: 'image', url: cover, thumb: cover, duration: null });
  return out;
}

/** Items worth showing as cards: they carry media, a cover or an avatar. */
export function hasVisual(item: Item): boolean {
  return mediaOf(item).length > 0 || !!str(item.avatar_url) || !!authorOf(item)?.avatar;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Stable identity used to dedupe across runs: platform + id (falls back to url, then content). */
export function itemKey(item: Item): string {
  const platform = str(item.platform) ?? '?';
  const id = str(item.id) ?? urlOf(item) ?? hash(JSON.stringify(item.text ?? item));
  return `${platform}:${id}`;
}

/** Flattens an item to dot-path scalar columns for CSV. Arrays become JSON strings. */
export function flatten(item: Item, prefix = '', out: Record<string, string | number | boolean | null> = {}) {
  for (const [k, v] of Object.entries(item)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) flatten(v, key, out);
    else if (Array.isArray(v)) out[key] = v.length ? JSON.stringify(v) : '';
    else out[key] = v as string | number | boolean | null;
  }
  return out;
}

/** Top-level scalar fields not covered by the standard columns (for extra table columns). */
const STANDARD = new Set([
  'id', 'platform', 'resource', 'type', 'url', 'published_at', 'collected_at', 'text', 'title', 'author', 'metrics', 'media',
  'hashtags', 'mentions', 'username', 'name', 'avatar_url', 'cover_url', 'is_verified', 'is_private', 'description',
]);

export function extraColumns(items: Item[], max = 5): string[] {
  const counts = new Map<string, number>();
  for (const it of items.slice(0, 50)) {
    for (const [k, v] of Object.entries(it)) {
      if (STANDARD.has(k) || v === null || v === undefined || typeof v === 'object') continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}
