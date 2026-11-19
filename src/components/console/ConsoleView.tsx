import clsx from 'clsx';
import { ArrowRight, FlaskConical, KeyRound, ListTree, SlidersHorizontal, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { config } from '../../config';
import { findEndpoint, getCatalog } from '../../data/catalog';
import { MOCK_MODE } from '../../lib/api';
import { relTime } from '../../lib/format';
import { navigate, useRoute } from '../../lib/router';
import { startRun } from '../../lib/runner';
import { useRuns, useSettings } from '../../lib/store';
import { useUI } from '../../lib/ui';
import { Button, Segmented } from '../../ui';
import { ResultsPanel, StatusBadge } from '../results/ResultsPanel';
import { EndpointBrowser } from './EndpointBrowser';
import { RequestPanel } from './RequestPanel';

const DEFAULT_ENDPOINT = 'x/search';

type Pane = 'browse' | 'request' | 'results';

function demoUrl(): string {
  const u = new URL(window.location.href);
  u.searchParams.set('mock', '1');
  return u.toString();
}

function Welcome() {
  const openSettings = useUI((s) => s.openSettings);
  const c = getCatalog();
  return (
    <div className="mx-auto w-full max-w-[560px] p-6 sm:p-10">
      <p className="text-[12px] font-semibold tracking-wide text-accent-ink uppercase">Bring your own key</p>
      <h2 className="mt-1 text-[22px] leading-tight font-semibold tracking-tight">Collect public social data from {c.counts.platforms} platforms</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
        Every request goes from this browser straight to the SocQ API with your own key. There are no scrapers to maintain and no backend to deploy.
        Your key and results stay on this device.
      </p>
      <ol className="mt-5 space-y-2.5 text-[13px]">
        {[
          ['Get an API key at socq.ai', 'Pay as you go; each run shows its cost first.'],
          ['Paste it in Settings', 'Stored in localStorage only. Forget it any time.'],
          ['Pick an endpoint and run', 'Results land in a table you can export as CSV, JSON or JSONL.'],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-soft font-mono text-[11.5px] font-semibold text-accent-ink">
              {i + 1}
            </span>
            <span>
              <span className="font-medium">{t}</span>
              <span className="block text-[12.5px] text-fg-subtle">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" icon={<KeyRound className="size-4" />} onClick={() => openSettings('key')}>
          Add API key
        </Button>
        <a
          href={config.provider.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2"
        >
          Get a key <ArrowRight className="size-4" />
        </a>
        <a href={demoUrl()} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg">
          <FlaskConical className="size-4" /> Try the demo
        </a>
      </div>
    </div>
  );
}

function NoRun({ endpointId }: { endpointId: string }) {
  const runs = useRuns((s) => s.runs);
  const recent = useMemo(
    () => Object.values(runs).filter((r) => r.endpointId === endpointId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    [runs, endpointId],
  );
  const apiKey = useSettings((s) => s.apiKey);
  if (!MOCK_MODE && !apiKey) return <Welcome />;
  return (
    <div className="ruled flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-[440px] rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Table2 className="size-4 text-accent" /> Results appear here
        </div>
        <p className="mt-1 text-[12.5px] text-fg-muted">
          Fill in the request, check the estimate and press <span className="font-medium text-fg">Run</span>. The task is submitted, polled until it finishes, and
          the first page of normalized results is shown as a table, cards or raw JSON.
        </p>
        {recent.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">Recent runs of this endpoint</h3>
            <ul className="divide-y divide-line rounded-md border border-line">
              {recent.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`console/${r.endpointId}/run/${r.id}`)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-2"
                  >
                    <StatusBadge status={r.status} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-muted">{JSON.stringify(r.input)}</span>
                    <span className="shrink-0 text-fg-subtle">{r.items.length} · {relTime(r.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConsoleView() {
  const route = useRoute();
  const [platform, resource, sub, runIdPart] = route.parts;
  const endpointId = platform && resource ? `${platform}/${resource}` : DEFAULT_ENDPOINT;
  const endpoint = findEndpoint(endpointId) ?? findEndpoint(DEFAULT_ENDPOINT)!;
  const runId = sub === 'run' ? runIdPart : undefined;
  const run = useRuns((s) => (runId ? s.runs[runId] : undefined));
  const [pane, setPane] = useState<Pane>(runId ? 'results' : 'request');

  const select = (id: string) => {
    navigate(`console/${id}`);
    setPane('request');
  };
  const onRun = (body: Record<string, unknown>) => {
    const id = startRun(endpoint.id, body, { kind: 'console' });
    navigate(`console/${endpoint.id}/run/${id}`);
    setPane('results');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex justify-center border-b border-line bg-surface px-3 py-2 lg:hidden">
        <Segmented
          label="Console pane"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'browse', label: <><ListTree className="size-3.5" />Endpoints</> },
            { value: 'request', label: <><SlidersHorizontal className="size-3.5" />Request</> },
            { value: 'results', label: <><Table2 className="size-3.5" />Results{run?.status === 'succeeded' ? ` ${run.items.length}` : ''}</> },
          ]}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_360px_minmax(0,1fr)] xl:grid-cols-[290px_400px_minmax(0,1fr)]">
        <aside className={clsx('min-h-0 border-line bg-surface lg:block lg:border-r', pane === 'browse' ? 'block' : 'hidden')} aria-label="Endpoint browser">
          <EndpointBrowser selected={endpoint.id} onSelect={select} />
        </aside>
        <section className={clsx('min-h-0 border-line bg-surface lg:block lg:border-r', pane === 'request' ? 'block' : 'hidden')} aria-label="Request">
          <RequestPanel key={`${endpoint.id}:${runId ?? ''}`} endpoint={endpoint} initialBody={run?.endpointId === endpoint.id ? run.input : undefined} onRun={onRun} />
        </section>
        <section className={clsx('min-h-0 bg-bg lg:block', pane === 'results' ? 'block' : 'hidden')} aria-label="Results">
          {runId && run ? (
            <div className="flex h-full min-h-0 flex-col bg-surface">
              <ResultsPanel runId={runId} />
            </div>
          ) : (
            <NoRun endpointId={endpoint.id} />
          )}
        </section>
      </div>
    </div>
  );
}

