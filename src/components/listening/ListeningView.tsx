import clsx from 'clsx';
import { CheckCheck, EyeOff, ExternalLink, Pencil, Play, Plus, Radar, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { findEndpoint } from '../../data/catalog';
import { MOCK_MODE } from '../../lib/api';
import { fmtCredits } from '../../lib/cost';
import { dateTime, hostOf, relTime } from '../../lib/format';
import { deleteMonitor, planCost, runMonitor, saveMonitor, setTriage, useListening, type InboxItem, type Monitor, type TriageState } from '../../lib/listening';
import { engagementOf, publishedOf, textOf, urlOf } from '../../lib/normalize';
import { navigate, useRoute } from '../../lib/router';
import { useSettings } from '../../lib/store';
import { useUI } from '../../lib/ui';
import { Badge, Button, IconButton, Segmented } from '../../ui';
import { CostBox } from '../CostBox';
import { PlatformMark } from '../marks';
import { ExportMenu } from '../results/ResultsPanel';
import { AuthorCell, Metrics } from '../results/ItemViews';
import { MonitorDialog } from './MonitorDialog';

type Filter = 'open' | 'new' | 'replied' | 'ignored' | 'all';
type Sort = 'engagement' | 'recent';

function isNew(x: InboxItem, m: Monitor) {
  return !!m.lastRunAt && x.firstSeen === m.lastRunAt && x.state === 'open';
}

function MonitorList({ selected, onNew }: { selected?: string; onNew(): void }) {
  const { monitors, inbox, progress } = useListening();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <h2 className="text-[11.5px] font-semibold tracking-wide text-fg-muted uppercase">Monitors</h2>
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={onNew}>
          New
        </Button>
      </div>
      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {monitors.map((m) => {
          const items = inbox[m.id] ?? [];
          const fresh = items.filter((x) => isNew(x, m)).length;
          const open = items.filter((x) => x.state === 'open').length;
          const p = progress[m.id];
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => navigate(`listening/${m.id}`)}
                aria-current={selected === m.id ? 'true' : undefined}
                className={clsx(
                  'w-full border-b border-l-2 border-b-line px-3 py-2.5 text-left transition-colors',
                  selected === m.id ? 'border-l-accent bg-accent-soft' : 'border-l-transparent hover:bg-surface-2',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{m.name}</span>
                  {fresh > 0 && <Badge tone="accent">{fresh} new</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {m.sources.map((s) => (
                    <PlatformMark key={s} platform={s.split('/')[0]} size="sm" />
                  ))}
                  <span className="ml-auto text-[11px] text-fg-subtle">{p ? `running ${p.done}/${p.total}` : m.lastRunAt ? relTime(m.lastRunAt) : 'never run'}</span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-fg-subtle">
                  {m.keywords.join(' · ')} {items.length ? `· ${open} open` : ''}
                </div>
              </button>
            </li>
          );
        })}
        {!monitors.length && <li className="px-4 py-6 text-center text-[12.5px] text-fg-subtle">No monitors yet.</li>}
      </ul>
    </div>
  );
}

function InboxRow({ x, m }: { x: InboxItem; m: Monitor }) {
  const item = x.item;
  const url = urlOf(item);
  const pub = publishedOf(item);
  const fresh = isNew(x, m);
  return (
    <li className={clsx('group relative flex gap-3 border-b border-line px-4 py-3 transition-colors', x.state !== 'open' && 'opacity-60', fresh && 'bg-accent-soft/40')}>
      {fresh && <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-accent" aria-hidden="true" />}
      <PlatformMark platform={String(item.platform ?? x.endpointId.split('/')[0])} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className="max-w-[220px] min-w-0">
            <AuthorCell item={item} size={20} />
          </span>
          <span className="text-fg-subtle" title={dateTime(pub)}>
            {pub ? relTime(pub) : 'date unknown'}
          </span>
          {x.keywords.map((k) => (
            <span key={k} className="rounded bg-surface-2 px-1.5 font-mono text-[10.5px] text-fg-muted">
              {k}
            </span>
          ))}
          {fresh && <Badge tone="accent">New</Badge>}
          {x.state === 'replied' && <Badge tone="ok">Replied</Badge>}
          {x.state === 'ignored' && <Badge>Ignored</Badge>}
        </div>
        <p className="mt-1 line-clamp-3 text-[13px] leading-snug break-words">{textOf(item) ?? <span className="text-fg-subtle">No text</span>}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          <Metrics item={item} />
          {url && (
            <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-fg-subtle hover:text-fg">
              {hostOf(url)} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
        {x.state === 'open' ? (
          <>
            <IconButton size="sm" label="Mark replied" onClick={() => setTriage(m.id, [x.key], 'replied')}>
              <CheckCheck className="size-4" />
            </IconButton>
            <IconButton size="sm" label="Ignore" onClick={() => setTriage(m.id, [x.key], 'ignored')}>
              <EyeOff className="size-4" />
            </IconButton>
          </>
        ) : (
          <IconButton size="sm" label="Move back to open" onClick={() => setTriage(m.id, [x.key], 'open')}>
            <RotateCcw className="size-4" />
          </IconButton>
        )}
      </div>
    </li>
  );
}

function MonitorDetail({ m, onEdit }: { m: Monitor; onEdit(): void }) {
  const items = useListening((s) => s.inbox[m.id]);
  const progress = useListening((s) => s.progress[m.id]);
  const apiKey = useSettings((s) => s.apiKey);
  const openSettings = useUI((s) => s.openSettings);
  const [filter, setFilter] = useState<Filter>('open');
  const [sort, setSort] = useState<Sort>('engagement');
  const [q, setQ] = useState('');
  const est = planCost(m);
  const canRun = MOCK_MODE || !!apiKey;

  const all = useMemo(() => items ?? [], [items]);
  const counts = useMemo(
    () => ({
      open: all.filter((x) => x.state === 'open').length,
      new: all.filter((x) => isNew(x, m)).length,
      replied: all.filter((x) => x.state === 'replied').length,
      ignored: all.filter((x) => x.state === 'ignored').length,
      all: all.length,
    }),
    [all, m],
  );
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = all.filter((x) => {
      if (filter === 'new' ? !isNew(x, m) : filter !== 'all' && x.state !== (filter as TriageState)) return false;
      return !ql || JSON.stringify(x.item).toLowerCase().includes(ql);
    });
    const time = (x: InboxItem) => Date.parse(publishedOf(x.item) ?? '') || x.firstSeen;
    return list.sort((a, b) => (sort === 'engagement' ? engagementOf(b.item) - engagementOf(a.item) : time(b) - time(a)));
  }, [all, filter, sort, q, m]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold tracking-tight">{m.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-muted">
              {m.keywords.map((k) => (
                <span key={k} className="rounded border border-line bg-surface-2 px-1.5 py-px font-mono text-[11.5px]">
                  {k}
                </span>
              ))}
              <span className="text-fg-subtle">on</span>
              {m.sources.map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <PlatformMark platform={s.split('/')[0]} size="sm" />
                </span>
              ))}
              <span className="text-fg-subtle">· {m.limit} per search</span>
            </div>
            <p className="mt-1 text-[11.5px] text-fg-subtle">
              {m.lastRunAt ? `Last run ${relTime(m.lastRunAt)}${m.lastRunCredits != null ? ` · ${MOCK_MODE ? 'example charge' : 'charged'} ${fmtCredits(m.lastRunCredits)} credits` : ''}` : 'Not run yet'}
            </p>
            {!!m.lastRunErrors?.length && (
              <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-bad" aria-label="Failed sources">
                {m.lastRunErrors.map((e) => (
                  <li key={`${e.endpointId}|${e.keyword}`} className="break-words">
                    <span className="font-medium">{findEndpoint(e.endpointId)?.name ?? e.endpointId}</span> · {e.keyword}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="Edit monitor" onClick={onEdit}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton
              label="Delete monitor"
              onClick={() => {
                if (window.confirm(`Delete “${m.name}” and its inbox?`)) {
                  deleteMonitor(m.id);
                  navigate('listening');
                }
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <CostBox est={est} compact label="Each run" className="min-w-[230px] flex-1" />
          <Button
            variant="primary"
            className="h-auto min-h-9 px-5"
            loading={!!progress}
            icon={<Play className="size-4" />}
            onClick={() => (canRun ? void runMonitor(m.id) : openSettings('key'))}
          >
            {progress ? `Running ${progress.done}/${progress.total}` : canRun ? 'Run now' : 'Add API key'}
          </Button>
        </div>
        {progress && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(6, (progress.done / progress.total) * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <Segmented
          label="Inbox filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'new', label: 'New', count: counts.new },
            { value: 'replied', label: 'Replied', count: counts.replied },
            { value: 'ignored', label: 'Ignored', count: counts.ignored },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <select className="field h-7 min-h-0 w-auto py-0 text-[12.5px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="engagement">Top engagement</option>
          <option value="recent">Most recent</option>
        </select>
        <div className="relative min-w-[120px] flex-1 sm:max-w-[220px]">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter inbox" className="field h-7 min-h-0 py-0 pl-7 text-[12.5px]" />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {filter === 'open' && shown.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTriage(m.id, shown.map((x) => x.key), 'ignored')}>
              Ignore all shown
            </Button>
          )}
          <ExportMenu items={shown.map((x) => ({ ...x.item, _listening: { keywords: x.keywords, state: x.state, first_seen: new Date(x.firstSeen).toISOString() } }))} basename={`listening-${m.name}`} />
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-surface">
        {shown.length ? (
          <ul>
            {shown.map((x) => (
              <InboxRow key={x.key} x={x} m={m} />
            ))}
          </ul>
        ) : (
          <div className="ruled flex h-full min-h-[200px] items-center justify-center p-8 text-center text-[13px] text-fg-muted">
            {all.length ? 'Nothing in this view.' : 'Press Run now to search every source for your keywords. Results are merged and deduped here.'}
          </div>
        )}
      </div>
    </div>
  );
}

const EXAMPLE = { name: 'Open-source launch', keywords: ['open source scraper', 'social listening'], sources: ['x/search', 'reddit/search', 'tiktok/search', 'youtube/search', 'threads/search'], limit: 20 };

export function ListeningView() {
  const route = useRoute();
  const monitors = useListening((s) => s.monitors);
  const [editing, setEditing] = useState<Monitor | 'new' | null>(null);
  const selectedId = route.parts[0] ?? monitors[0]?.id;
  const selected = monitors.find((m) => m.id === selectedId);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className={clsx('min-h-0 border-line bg-surface md:block md:border-r', selected || !monitors.length ? 'hidden' : 'block')} aria-label="Monitors">
        <MonitorList selected={selected?.id} onNew={() => setEditing('new')} />
      </aside>
      <section className={clsx('min-h-0 md:block', selected || !monitors.length ? 'block' : 'hidden')} aria-label="Inbox">
        {selected ? (
          <div className="flex h-full min-h-0 flex-col">
            <button type="button" onClick={() => navigate('listening/_')} className="border-b border-line bg-surface px-4 py-2 text-left text-[12.5px] text-fg-muted md:hidden">
              ← All monitors
            </button>
            <div className="min-h-0 flex-1">
              <MonitorDetail key={selected.id} m={selected} onEdit={() => setEditing(selected)} />
            </div>
          </div>
        ) : (
          <div className="ruled flex h-full items-center justify-center p-8">
            <div className="max-w-[460px] rounded-xl border border-line bg-surface p-6 shadow-card">
              <Radar className="size-6 text-accent" />
              <h2 className="mt-2 text-[17px] font-semibold tracking-tight">Social listening, on demand</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                Save keywords once, then run them across X, Reddit, TikTok, YouTube and Threads search whenever you like. New posts since the last run are
                highlighted, duplicates are merged, and you can mark each one replied or ignored.
              </p>
              <p className="mt-2 text-[12px] text-fg-subtle">There is no background schedule: this app runs only in your browser, and every run shows its cost first.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                  New monitor
                </Button>
                <Button
                  onClick={() => {
                    const m = saveMonitor(EXAMPLE);
                    navigate(`listening/${m.id}`);
                  }}
                >
                  Add an example
                </Button>
              </div>
              {findEndpoint('threads/search') ? null : <p className="mt-2 text-[11.5px] text-warn">Some search endpoints are missing from the catalog.</p>}
            </div>
          </div>
        )}
      </section>
      {editing && (
        <MonitorDialog
          monitor={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            navigate(`listening/${m.id}`);
          }}
        />
      )}
    </div>
  );
}
