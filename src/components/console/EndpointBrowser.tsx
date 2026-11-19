import clsx from 'clsx';
import { Flame, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS, getCatalog } from '../../data/catalog';
import { unitPrice } from '../../lib/cost';
import type { Endpoint } from '../../lib/types';
import { PlatformMark } from '../marks';

/** Platforms listed first (the rest follow by endpoint count). */
const FEATURED = ['tiktok', 'x', 'instagram', 'youtube', 'reddit', 'linkedin', 'facebook', 'threads'];

function matches(e: Endpoint, title: string, q: string): boolean {
  if (!q) return true;
  const hay = `${e.id} ${e.name} ${title} ${e.description} ${e.category}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

export function EndpointBrowser({ selected, onSelect }: { selected?: string; onSelect(id: string): void }) {
  const catalog = getCatalog();
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('all');
  const [category, setCategory] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const platforms = useMemo(() => {
    const rank = (id: string) => (FEATURED.includes(id) ? FEATURED.indexOf(id) : 100);
    return [...catalog.platforms].sort((a, b) => rank(a.id) - rank(b.id) || b.count - a.count || a.title.localeCompare(b.title));
  }, [catalog]);

  const groups = useMemo(() => {
    const out: { id: string; title: string; items: Endpoint[] }[] = [];
    for (const p of platforms) {
      if (platform !== 'all' && p.id !== platform) continue;
      const items = catalog.endpoints
        .filter((e) => e.platform === p.id && (category === 'all' || e.category === category) && matches(e, p.title, q))
        .sort((a, b) => a.hotRank - b.hotRank);
      if (items.length) out.push({ id: p.id, title: p.title, items });
    }
    return out;
  }, [catalog, platforms, platform, category, q]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of catalog.endpoints) if (platform === 'all' || e.platform === platform) counts[e.category] = (counts[e.category] ?? 0) + 1;
    return Object.keys(CATEGORY_LABELS).filter((c) => counts[c]);
  }, [catalog, platform]);

  useEffect(() => {
    if (!selected) return;
    const el = listRef.current?.querySelector(`[data-endpoint="${CSS.escape(selected)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${catalog.counts.endpoints} endpoints`}
            aria-label="Search endpoints"
            className="field pr-8 pl-8"
          />
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-subtle hover:text-fg">
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1 font-mono text-[10.5px] text-fg-subtle">/</kbd>
          )}
        </div>
        <select
          className="field text-[13px]"
          value={platform}
          aria-label="Platform"
          onChange={(e) => {
            setPlatform(e.target.value);
            setCategory('all');
          }}
        >
          <option value="all">All platforms ({catalog.counts.platforms})</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.count})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Category">
          {['all', ...categories].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={clsx(
                'h-6 rounded-full border px-2 text-[11.5px] font-medium transition-colors',
                category === c ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      <div ref={listRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-3" aria-label="Endpoints">
        {groups.map((g) => (
          <section key={g.id} aria-label={g.title}>
            <h3 className="sticky top-0 z-[1] flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-1.5 text-[11.5px] font-semibold tracking-wide text-fg-muted uppercase backdrop-blur-sm">
              <PlatformMark platform={g.id} size="sm" />
              {g.title}
              <span className="ml-auto font-normal text-fg-subtle tabular">{g.items.length}</span>
            </h3>
            <ul>
              {g.items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    data-endpoint={e.id}
                    onClick={() => onSelect(e.id)}
                    aria-current={selected === e.id ? 'true' : undefined}
                    className={clsx(
                      'group flex w-full items-start gap-2 border-l-2 py-1.5 pr-3 pl-[10px] text-left transition-colors',
                      selected === e.id ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-surface-2',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={clsx('flex items-center gap-1 truncate text-[13px]', selected === e.id ? 'font-semibold text-fg' : 'text-fg')}>
                        <span className="truncate">{e.name.replace(new RegExp(`^${g.title}\\s+`, 'i'), '')}</span>
                        {e.popular && <Flame className="size-3 shrink-0 text-accent" aria-label="Popular" />}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-fg-subtle">{e.id}</span>
                    </span>
                    <span className="mt-0.5 shrink-0 font-mono text-[10.5px] text-fg-subtle tabular">{unitPrice(e.billing).replace(' / ', '/')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!total && <p className="px-4 py-8 text-center text-[13px] text-fg-subtle">No endpoints match “{q}”.</p>}
      </div>
    </div>
  );
}
