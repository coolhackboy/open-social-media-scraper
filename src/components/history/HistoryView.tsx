import { History, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { findEndpoint } from '../../data/catalog';
import { MOCK_MODE } from '../../lib/api';
import { fmtCredits, fmtUSD } from '../../lib/cost';
import { dateTime, relTime } from '../../lib/format';
import { navigate } from '../../lib/router';
import { clearHistory, deleteRun } from '../../lib/runner';
import { useRuns } from '../../lib/store';
import type { Run } from '../../lib/types';
import { Button, IconButton, Segmented } from '../../ui';
import { PlatformMark } from '../marks';
import { StatusBadge } from '../results/ResultsPanel';

type Kind = 'all' | Run['origin']['kind'];

function openRun(r: Run) {
  if (r.origin.kind === 'template' && r.origin.ref && r.origin.template) return navigate(`templates/${r.origin.template}/${r.origin.ref}`);
  navigate(`console/${r.endpointId}/run/${r.id}`);
}

export function HistoryView() {
  const runsMap = useRuns((s) => s.runs);
  const [kind, setKind] = useState<Kind>('all');
  const runs = useMemo(() => Object.values(runsMap).sort((a, b) => b.createdAt - a.createdAt), [runsMap]);
  const shown = kind === 'all' ? runs : runs.filter((r) => r.origin.kind === kind);
  const spent = runs.reduce((n, r) => n + (r.credits ?? 0), 0);
  const count = (k: Kind) => (k === 'all' ? runs.length : runs.filter((r) => r.origin.kind === k).length);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">History</h2>
          <p className="text-[12px] text-fg-subtle tabular">
            {runs.length} runs stored in this browser · {fmtCredits(Number(spent.toFixed(4)))} {MOCK_MODE ? 'credits in the example responses (nothing charged)' : `credits charged (${fmtUSD(spent * 0.005)})`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            label="Run type"
            size="sm"
            value={kind}
            onChange={setKind}
            options={(['all', 'console', 'listening', 'template'] as Kind[]).map((k) => ({
              value: k,
              label: k === 'all' ? 'All' : k === 'console' ? 'Scraper' : k === 'listening' ? 'Listening' : 'Templates',
              count: count(k),
            }))}
          />
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
            disabled={!runs.length}
            onClick={() => window.confirm('Delete all finished runs from this browser?') && void clearHistory()}
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {shown.length ? (
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead className="sticky top-0 bg-surface-2 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <tr>
                <th className="border-b border-line px-4 py-2">Endpoint</th>
                <th className="border-b border-line px-3 py-2">Input</th>
                <th className="border-b border-line px-3 py-2">Status</th>
                <th className="border-b border-line px-3 py-2 text-right">Results</th>
                <th className="border-b border-line px-3 py-2 text-right">Credits</th>
                <th className="border-b border-line px-3 py-2">When</th>
                <th className="w-10 border-b border-line px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const ep = findEndpoint(r.endpointId);
                return (
                  <tr key={r.id} onClick={() => openRun(r)} className="cursor-pointer align-top hover:bg-surface-2/70">
                    <td className="border-b border-line px-4 py-2">
                      <div className="flex items-center gap-2">
                        <PlatformMark platform={r.endpointId.split('/')[0]} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{ep?.name ?? r.endpointId}</div>
                          <div className="truncate text-[11px] text-fg-subtle">{r.origin.label ?? 'Scraper'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[320px] border-b border-line px-3 py-2">
                      <code className="line-clamp-2 font-mono text-[11px] break-all text-fg-muted">{JSON.stringify(r.input)}</code>
                    </td>
                    <td className="border-b border-line px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="border-b border-line px-3 py-2 text-right tabular">{r.status === 'succeeded' ? r.items.length.toLocaleString() : '—'}</td>
                    <td className="border-b border-line px-3 py-2 text-right whitespace-nowrap tabular">
                      {r.credits != null ? fmtCredits(r.credits) : <span className="text-fg-subtle">est. {r.estimate != null ? fmtCredits(r.estimate) : '—'}</span>}
                    </td>
                    <td className="border-b border-line px-3 py-2 whitespace-nowrap text-fg-muted" title={dateTime(r.createdAt)}>
                      {relTime(r.createdAt)}
                    </td>
                    <td className="border-b border-line px-2 py-1.5">
                      <IconButton
                        size="sm"
                        label="Delete run"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRun(r.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="ruled flex h-full items-center justify-center p-8 text-center">
            <div>
              <History className="mx-auto size-6 text-fg-subtle" />
              <p className="mt-2 text-[13px] text-fg-muted">No runs yet. Every request you run is kept here, in IndexedDB on this device.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
