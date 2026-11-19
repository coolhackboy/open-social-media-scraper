import clsx from 'clsx';
import { BadgeCheck, ChevronDown, ExternalLink } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { compact, dateTime, hostOf, relTime } from '../../lib/format';
import { authorOf, extraColumns, itemKey, mediaOf, metricLabel, metricsOf, publishedOf, textOf, urlOf } from '../../lib/normalize';
import type { Item } from '../../lib/types';
import { Avatar, MediaThumb } from '../marks';

export function Metrics({ item, max = 4, className }: { item: Item; max?: number; className?: string }) {
  const m = metricsOf(item).slice(0, max);
  if (!m.length) return <span className="text-fg-subtle">—</span>;
  return (
    <span className={clsx('flex flex-wrap gap-x-2.5 gap-y-0.5', className)}>
      {m.map(([k, v]) => (
        <span key={k} className="whitespace-nowrap">
          <span className="tabular font-medium text-fg">{compact(v)}</span> <span className="text-fg-subtle">{metricLabel(k)}</span>
        </span>
      ))}
    </span>
  );
}

export function AuthorCell({ item, size = 26 }: { item: Item; size?: number }) {
  const a = authorOf(item);
  if (!a) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={a.handle ?? a.name} src={a.avatar} size={size} />
      <span className="min-w-0">
        <span className="flex items-center gap-1 truncate font-medium text-fg">
          <span className="truncate">{a.name ?? a.handle}</span>
          {a.verified && <BadgeCheck className="size-3.5 shrink-0 text-info" aria-label="Verified" />}
        </span>
        {a.handle && a.name && a.handle !== a.name && <span className="block truncate text-[11.5px] text-fg-subtle">@{a.handle.replace(/^@/, '')}</span>}
      </span>
    </span>
  );
}

function scalarText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return compact(v);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

export function ResultsTable({ items, offset = 0 }: { items: Item[]; offset?: number }) {
  const extras = useMemo(() => extraColumns(items, 4), [items]);
  // A single result opens expanded, so its raw fields are visible right away.
  const [open, setOpen] = useState<string | null>(() => (items.length === 1 ? `${itemKey(items[0])}#0` : null));
  const showAuthor = useMemo(() => items.some((i) => authorOf(i)), [items]);
  const showMetrics = useMemo(() => items.some((i) => metricsOf(i).length), [items]);
  const cols = 4 + (showAuthor ? 1 : 0) + (showMetrics ? 1 : 0) + extras.length;
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[720px] text-[12.5px]">
        <thead className="sticky top-0 z-[1] bg-surface-2 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
          <tr>
            <th className="w-10 border-b border-line px-3 py-2 text-right">#</th>
            {showAuthor && <th className="w-[190px] border-b border-line px-3 py-2">Author</th>}
            <th className="border-b border-line px-3 py-2">Text</th>
            {showMetrics && <th className="w-[200px] border-b border-line px-3 py-2">Metrics</th>}
            {extras.map((c) => (
              <th key={c} className="max-w-[160px] border-b border-line px-3 py-2 font-mono text-[10.5px] normal-case">
                {c}
              </th>
            ))}
            <th className="w-[110px] border-b border-line px-3 py-2">Published</th>
            <th className="w-[44px] border-b border-line px-2 py-2">
              <span className="sr-only">Link</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const key = `${itemKey(item)}#${i}`;
            const text = textOf(item);
            const url = urlOf(item);
            const pub = publishedOf(item);
            const expanded = open === key;
            return (
              <Fragment key={key}>
                <tr
                  onClick={() => setOpen(expanded ? null : key)}
                  className={clsx('cursor-pointer align-top transition-colors hover:bg-surface-2/70', expanded && 'bg-accent-soft/60')}
                >
                  <td className="border-b border-line px-3 py-2 text-right font-mono text-[11px] text-fg-subtle tabular">
                    <span className="inline-flex items-center gap-1">
                      <ChevronDown className={clsx('size-3 transition-transform', !expanded && '-rotate-90')} />
                      {offset + i + 1}
                    </span>
                  </td>
                  {showAuthor && (
                    <td className="max-w-[190px] border-b border-line px-3 py-2">
                      <AuthorCell item={item} />
                    </td>
                  )}
                  <td className="border-b border-line px-3 py-2">
                    <p className="line-clamp-2 max-w-[60ch] leading-snug break-words text-fg">{text ?? <span className="text-fg-subtle">—</span>}</p>
                    {mediaOf(item).length > 0 && <span className="mt-0.5 block text-[11px] text-fg-subtle">{mediaOf(item).length} media</span>}
                  </td>
                  {showMetrics && (
                    <td className="border-b border-line px-3 py-2 text-[12px]">
                      <Metrics item={item} max={3} />
                    </td>
                  )}
                  {extras.map((c) => (
                    <td key={c} className="max-w-[160px] truncate border-b border-line px-3 py-2 text-fg-muted" title={String(item[c] ?? '')}>
                      {scalarText(item[c])}
                    </td>
                  ))}
                  <td className="border-b border-line px-3 py-2 whitespace-nowrap text-fg-muted" title={dateTime(pub)}>
                    {pub ? relTime(pub) : '—'}
                  </td>
                  <td className="border-b border-line px-2 py-1.5">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(e) => e.stopPropagation()}
                        title={url}
                        aria-label={`Open on ${hostOf(url)}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={cols} className="border-b border-line bg-code px-3 py-2">
                      <pre className="scroll-thin max-h-80 overflow-auto font-mono text-[11.5px] leading-relaxed break-all whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResultCards({ items }: { items: Item[] }) {
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-auto p-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {items.map((item, i) => {
          const media = mediaOf(item)[0];
          const a = authorOf(item);
          const url = urlOf(item);
          const text = textOf(item);
          const pub = publishedOf(item);
          const key = itemKey(item);
          return (
            <article key={`${key}#${i}`} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              {media ? (
                <MediaThumb
                  className="aspect-[4/3] border-b border-line"
                  type={media.type}
                  src={media.thumb}
                  seed={key}
                  platform={String(item.platform ?? '')}
                  duration={media.duration}
                />
              ) : null}
              <div className="flex flex-1 flex-col gap-2 p-3">
                {a && <AuthorCell item={item} size={24} />}
                <p className={clsx('text-[12.5px] leading-snug break-words text-fg', media ? 'line-clamp-3' : 'line-clamp-6')}>
                  {text ?? <span className="text-fg-subtle">No text</span>}
                </p>
                <div className="mt-auto space-y-1.5 pt-1 text-[11.5px]">
                  <Metrics item={item} max={4} />
                  <div className="flex items-center justify-between gap-2 text-fg-subtle">
                    <span title={dateTime(pub)}>{pub ? relTime(pub) : String(item.type ?? '')}</span>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 truncate hover:text-fg">
                        {hostOf(url)} <ExternalLink className="size-3 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function JsonView({ value }: { value: unknown }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  return (
    <pre className="scroll-thin min-h-0 flex-1 overflow-auto bg-code p-3 font-mono text-[11.5px] leading-relaxed text-fg">
      <JsonHighlight text={text} />
    </pre>
  );
}

/** Lightweight JSON syntax colouring (keys, strings, numbers, literals). */
function JsonHighlight({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { t: string; c?: string }[] = [];
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(text)) && n++ < 40000) {
      if (m.index > last) out.push({ t: text.slice(last, m.index) });
      if (m[1]) {
        out.push({ t: m[1], c: m[2] ? 'text-info' : 'text-ok' });
        if (m[2]) out.push({ t: m[2] });
      } else if (m[3]) out.push({ t: m[3], c: 'text-accent-ink' });
      else out.push({ t: m[4], c: 'text-warn' });
      last = re.lastIndex;
    }
    out.push({ t: text.slice(last) });
    return out;
  }, [text]);
  return (
    <>
      {parts.map((p, i) =>
        p.c ? (
          <span key={i} className={p.c}>
            {p.t}
          </span>
        ) : (
          p.t
        ),
      )}
    </>
  );
}
