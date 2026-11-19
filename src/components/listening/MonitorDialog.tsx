import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { findEndpoint, platformTitle } from '../../data/catalog';
import { unitPrice } from '../../lib/cost';
import { LISTENING_SOURCES, planCost, saveMonitor, type Monitor } from '../../lib/listening';
import { Button, Dialog, Label } from '../../ui';
import { CostBox } from '../CostBox';
import { PlatformMark } from '../marks';

export function MonitorDialog({ monitor, onClose, onSaved }: { monitor?: Monitor; onClose(): void; onSaved(m: Monitor): void }) {
  const [name, setName] = useState(monitor?.name ?? '');
  const [keywords, setKeywords] = useState(monitor?.keywords.join('\n') ?? '');
  const [sources, setSources] = useState<string[]>(monitor?.sources ?? ['x/search', 'reddit/search']);
  const [limit, setLimit] = useState(String(monitor?.limit ?? 20));
  const [tried, setTried] = useState(false);

  const kw = useMemo(() => keywords.split('\n').map((k) => k.trim()).filter(Boolean), [keywords]);
  const n = Math.max(1, Math.min(200, Math.trunc(Number(limit)) || 20));
  const est = planCost({ keywords: kw, sources, limit: n });
  const errors = {
    keywords: kw.length ? '' : 'Add at least one keyword',
    sources: sources.length ? '' : 'Pick at least one source',
  };
  const valid = !errors.keywords && !errors.sources;

  const save = () => {
    setTried(true);
    if (!valid) return;
    const m = saveMonitor({ id: monitor?.id, name: name.trim() || kw[0], keywords: kw, sources, limit: n });
    onSaved(m);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={monitor ? 'Edit monitor' : 'New listening monitor'}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={tried && !valid}>
            {monitor ? 'Save' : 'Create monitor'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="m-name">Name</Label>
          <input id="m-name" className="field" value={name} placeholder={kw[0] ?? 'Brand mentions'} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="m-kw" hint="one per line · search syntax of each platform">
            Keywords
          </Label>
          <textarea
            id="m-kw"
            rows={3}
            className="field resize-y font-mono text-[12.5px]"
            value={keywords}
            aria-invalid={tried && !!errors.keywords}
            placeholder={'your brand\n"your product" launch'}
            onChange={(e) => setKeywords(e.target.value)}
          />
          {tried && errors.keywords && <p className="mt-1 text-[11.5px] text-bad">{errors.keywords}</p>}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium">Sources</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {LISTENING_SOURCES.map((id) => {
              const ep = findEndpoint(id);
              if (!ep) return null;
              const on = sources.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setSources((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
                  className={clsx(
                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                    on ? 'border-accent-line bg-accent-soft' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className={clsx('flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-accent-strong bg-accent-strong text-white' : 'border-line-strong')}>
                    {on && <Check className="size-3" />}
                  </span>
                  <PlatformMark platform={ep.platform} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{platformTitle(ep.platform)}</span>
                    <span className="block font-mono text-[10.5px] text-fg-subtle">
                      {unitPrice(ep.billing)}
                      {!ep.input.properties.results_limit ? ' · ~20 fixed' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {tried && errors.sources && <p className="mt-1 text-[11.5px] text-bad">{errors.sources}</p>}
        </fieldset>
        <div>
          <Label htmlFor="m-limit" hint="per keyword, per source">
            Results per search
          </Label>
          <input id="m-limit" type="number" min={1} max={200} className="field w-32 font-mono" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <CostBox est={est} label="Each run costs about" note={`${kw.length || 0} keyword${kw.length === 1 ? '' : 's'} × ${sources.length} source${sources.length === 1 ? '' : 's'}. Runs only when you press Run.`} />
      </div>
    </Dialog>
  );
}
