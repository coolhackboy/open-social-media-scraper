import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Copy, Download, FileArchive, LayoutGrid, Loader2, RefreshCw, Search, Table2, Braces } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { findEndpoint } from '../../data/catalog';
import { MOCK_MODE, api, type TaskFile } from '../../lib/api';
import { fmtCredits, fmtUSD } from '../../lib/cost';
import { copyText, exportItems, type ExportFormat } from '../../lib/export';
import { duration } from '../../lib/format';
import { mediaOf } from '../../lib/normalize';
import { loadMore, resume } from '../../lib/runner';
import { toast, useRuns } from '../../lib/store';
import { isActive, type Item, type Run } from '../../lib/types';
import { Badge, Button, Dialog, IconButton, Menu, Segmented, Spinner } from '../../ui';
import { JsonView, ResultCards, ResultsTable } from './ItemViews';

type ViewMode = 'table' | 'cards' | 'json';

const STATUS: Record<Run['status'], { label: string; tone: 'neutral' | 'info' | 'ok' | 'bad' | 'warn' }> = {
  submitting: { label: 'Submitting', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'info' },
  running: { label: 'Running', tone: 'info' },
  succeeded: { label: 'Succeeded', tone: 'ok' },
  failed: { label: 'Failed', tone: 'bad' },
  error: { label: 'Error', tone: 'bad' },
};

export function StatusBadge({ status }: { status: Run['status'] }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone}>
      {isActive(status) ? <Loader2 className="size-3 animate-spin-slow" /> : status === 'succeeded' ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
      {s.label}
    </Badge>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function ExportMenu({ items, basename, disabled }: { items: Item[]; basename: string; disabled?: boolean }) {
  const fmts: ExportFormat[] = ['csv', 'json', 'jsonl'];
  return (
    <Menu
      trigger={({ toggle, open }) => (
        <Button size="sm" icon={<Download className="size-3.5" />} onClick={toggle} disabled={disabled || !items.length} aria-expanded={open} aria-haspopup="menu">
          Export
        </Button>
      )}
      items={fmts.map((f) => ({
        label: f.toUpperCase(),
        hint: `${items.length} item${items.length === 1 ? '' : 's'}`,
        onSelect: () => exportItems(items, f, basename),
      }))}
    />
  );
}

function FilesDialog({ run, onClose }: { run: Run; onClose(): void }) {
  const [files, setFiles] = useState<TaskFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api()
      .then((c) => c.files(run.taskId!))
      .then((f) => alive && setFiles(f))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not list files'));
    return () => {
      alive = false;
    };
  }, [run.taskId]);
  return (
    <Dialog open onClose={onClose} title="Raw result files">
      <p className="mb-3 text-[12.5px] text-fg-muted">
        <code className="font-mono">GET /v1/tasks/{run.taskId}/files</code> lists the raw JSONL export of the task. Downloads come from SocQ&apos;s file storage.
      </p>
      {error && <p className="text-[12.5px] text-bad">{error}</p>}
      {!files && !error && <Spinner className="size-5 text-fg-subtle" />}
      {files && !files.length && <p className="text-[12.5px] text-fg-subtle">{MOCK_MODE ? 'Demo mode has no raw files.' : 'No files for this task yet.'}</p>}
      <ul className="space-y-2">
        {files?.map((f) => (
          <li key={f.url} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
            <FileArchive className="size-4 text-fg-subtle" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[12px]">{f.type}</div>
              <div className="text-[11.5px] text-fg-subtle">
                {f.itemCount ?? '?'} items · {f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'size unknown'}
                {f.expiresAt ? ` · expires ${new Date(f.expiresAt).toLocaleString()}` : ''}
              </div>
            </div>
            <a href={f.url} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium text-accent-ink hover:underline">
              Download
            </a>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function ResultsPanel({ runId, compact }: { runId: string; compact?: boolean }) {
  const run = useRuns((s) => s.runs[runId]);
  const ep = findEndpoint(run?.endpointId);
  const [mode, setMode] = useState<ViewMode | null>(null);
  const [filter, setFilter] = useState('');
  const [filesOpen, setFilesOpen] = useState(false);
  const active = !!run && isActive(run.status);
  const now = useNow(active);

  const items = useMemo(() => {
    if (!run) return [];
    const q = filter.trim().toLowerCase();
    return q ? run.items.filter((i) => JSON.stringify(i).toLowerCase().includes(q)) : run.items;
  }, [run, filter]);

  // Media-heavy results (videos, reels, pins) open as cards; everything else as a table.
  const mediaHeavy = useMemo(() => {
    const sample = (run?.items ?? []).slice(0, 20);
    return sample.length > 0 && sample.filter((i) => mediaOf(i).length > 0).length >= sample.length / 2;
  }, [run?.items]);
  const view: ViewMode = mode ?? (mediaHeavy ? 'cards' : 'table');

  if (!run || !ep) return <div className="p-6 text-[13px] text-fg-subtle">Run not found.</div>;

  const elapsed = (run.finishedAt ?? now) - run.createdAt;
  const basename = `${ep.id.replace('/', '-')}-${run.taskId ?? run.id}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line', compact ? 'px-3 py-2' : 'px-4 py-2.5')}>
        <StatusBadge status={run.status} />
        {run.taskId && (
          <button
            type="button"
            onClick={async () => toast((await copyText(run.taskId!)) ? 'Task id copied' : 'Copy failed')}
            className="inline-flex items-center gap-1 font-mono text-[11.5px] text-fg-muted hover:text-fg"
            title="Copy task id"
          >
            {run.taskId}
            <Copy className="size-3" />
          </button>
        )}
        <span className="text-[12px] text-fg-subtle tabular">{duration(elapsed)}</span>
        <span className="ml-auto flex items-center gap-3 text-[12px]">
          {run.status === 'succeeded' && (
            <span className="tabular text-fg-muted">
              <span className="font-semibold text-fg">{run.items.length.toLocaleString()}</span>
              {run.resultCount != null && run.resultCount !== run.items.length ? ` of ${run.resultCount.toLocaleString()}` : ''}{' '}
              {(run.resultCount ?? run.items.length) === 1 ? 'result' : 'results'}
            </span>
          )}
          <span className="tabular text-fg-muted" title="Estimated before the run → charged by SocQ">
            {run.credits != null ? (
              <>
                {MOCK_MODE ? 'example charge' : 'charged'} <span className="font-semibold text-fg">{fmtCredits(run.credits)} cr</span> ({fmtUSD(run.credits * 0.005)})
              </>
            ) : run.estimate != null ? (
              <>est. {fmtCredits(run.estimate)} cr</>
            ) : null}
            {run.credits != null && run.estimate != null && <span className="text-fg-subtle"> · est. {fmtCredits(run.estimate)}</span>}
          </span>
        </span>
      </div>

      {active && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="relative flex size-12 items-center justify-center">
            <span className="animate-pulse-soft absolute inset-0 rounded-full bg-accent-soft" />
            <Spinner className="size-6 text-accent" />
          </div>
          <div>
            <p className="text-[14px] font-medium">{run.status === 'submitting' ? 'Submitting request…' : run.status === 'queued' ? 'Queued at SocQ…' : 'Collecting public data…'}</p>
            <p className="mt-1 text-[12.5px] text-fg-subtle">Polling with backoff. You can switch tabs; the run keeps going and is saved to History.</p>
          </div>
        </div>
      )}

      {(run.status === 'failed' || run.status === 'error') && (
        <div className="m-4 rounded-lg border border-bad/30 bg-bad-soft p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-bad">
            <AlertTriangle className="size-4" /> {run.status === 'failed' ? 'The task failed' : 'Request error'}
          </p>
          <p className="mt-1 text-[12.5px] break-words text-fg">{run.error}</p>
          {run.status === 'error' && run.taskId && (
            <Button size="sm" className="mt-3" icon={<RefreshCw className="size-3.5" />} onClick={() => resume(run.id)}>
              Check again
            </Button>
          )}
        </div>
      )}

      {run.status === 'succeeded' && (
        <>
          <div className={clsx('flex flex-wrap items-center gap-2 border-b border-line bg-surface', compact ? 'px-3 py-1.5' : 'px-4 py-2')}>
            <Segmented
              label="Result view"
              size="sm"
              value={view}
              onChange={setMode}
              options={[
                { value: 'table', label: <><Table2 className="size-3.5" />Table</> },
                { value: 'cards', label: <><LayoutGrid className="size-3.5" />Cards</> },
                { value: 'json', label: <><Braces className="size-3.5" />JSON</> },
              ]}
            />
            <div className="relative min-w-[120px] flex-1 sm:max-w-[240px]">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter loaded results"
                aria-label="Filter results"
                className="field h-7 min-h-0 py-0 pl-7 text-[12.5px]"
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {run.taskId && (
                <IconButton size="sm" label="Raw files" onClick={() => setFilesOpen(true)}>
                  <FileArchive className="size-4" />
                </IconButton>
              )}
              <ExportMenu items={items} basename={basename} />
            </div>
          </div>
          {MOCK_MODE && (
            <p className="border-b border-line bg-accent-soft px-4 py-1.5 text-[11.5px] text-accent-ink">
              Demo data: the documented example response for <code className="font-mono">{ep.id}</code>, served locally.
            </p>
          )}
          {!run.items.length ? (
            <div className="ruled flex flex-1 items-center justify-center p-8 text-center text-[13px] text-fg-muted">
              The task succeeded with no results. Private, unavailable or empty sources return no records.
            </div>
          ) : !items.length ? (
            <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-fg-subtle">Nothing matches “{filter}”.</div>
          ) : view === 'table' ? (
            <ResultsTable items={items} />
          ) : view === 'cards' ? (
            <ResultCards items={items} />
          ) : (
            <JsonView value={items.slice(0, 200)} />
          )}
          {(run.hasMore || (view === 'json' && items.length > 200)) && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line px-4 py-2 text-[12px] text-fg-muted">
              {view === 'json' && items.length > 200 && <span>JSON view shows the first 200 items; export for all.</span>}
              {run.hasMore && (
                <>
                  <span className="tabular">{run.items.length.toLocaleString()} loaded</span>
                  <Button size="sm" onClick={() => void loadMore(run.id)}>
                    Load next 50
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void loadMore(run.id, true)}>
                    Load all
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}
      {filesOpen && <FilesDialog run={run} onClose={() => setFilesOpen(false)} />}
    </div>
  );
}
