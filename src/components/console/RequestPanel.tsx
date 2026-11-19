import { Code2, Copy, ExternalLink, KeyRound, Play, RotateCcw, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { config } from '../../config';
import { platformTitle } from '../../data/catalog';
import { MOCK_MODE } from '../../lib/api';
import { estimate, unitPrice } from '../../lib/cost';
import { copyText } from '../../lib/export';
import { buildBody, formSpec, valuesFromBody, type FormValues } from '../../lib/schema';
import { SNIPPET_LABELS, snippet, type SnippetLang } from '../../lib/snippets';
import { toast, useSettings } from '../../lib/store';
import type { Endpoint } from '../../lib/types';
import { useUI } from '../../lib/ui';
import { Badge, Button, Menu } from '../../ui';
import { CostBox } from '../CostBox';
import { PlatformMark } from '../marks';
import { SchemaForm } from './SchemaForm';

/** Unsaved form values per endpoint, kept while the tab is open. */
const drafts = new Map<string, FormValues>();

export function RequestPanel({
  endpoint,
  initialBody,
  onRun,
}: {
  endpoint: Endpoint;
  /** Body of the run being viewed (restores its inputs). */
  initialBody?: Record<string, unknown>;
  onRun(body: Record<string, unknown>): void;
}) {
  const spec = useMemo(() => formSpec(endpoint), [endpoint]);
  const apiKey = useSettings((s) => s.apiKey);
  const apiBase = useSettings((s) => s.apiBase);
  const openSettings = useUI((s) => s.openSettings);
  const [values, setValues] = useState<FormValues>(
    () => (initialBody ? valuesFromBody(spec, initialBody) : (drafts.get(endpoint.id) ?? valuesFromBody(spec, endpoint.example))),
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    drafts.set(endpoint.id, values);
  }, [endpoint.id, values]);

  const built = useMemo(() => buildBody(spec, values), [spec, values]);
  const est = useMemo(() => estimate(endpoint.billing, built.body), [endpoint, built.body]);
  const invalid = Object.keys(built.errors).length > 0 || built.formErrors.length > 0;
  const canRun = MOCK_MODE || !!apiKey;

  const run = () => {
    setTouched(true);
    if (invalid) return;
    if (!canRun) {
      openSettings('key');
      return;
    }
    onRun(built.body);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('run-button')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copy = async (lang: SnippetLang) => {
    const ok = await copyText(snippet(lang, endpoint, built.body, apiBase));
    toast(ok ? `${SNIPPET_LABELS[lang]} copied` : 'Copy failed', ok ? 'ok' : 'bad');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-2.5">
          <PlatformMark platform={endpoint.platform} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] leading-tight font-semibold">{endpoint.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-subtle">
              <span>{platformTitle(endpoint.platform)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{unitPrice(endpoint.billing)}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-fg-muted">{endpoint.description}</p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <code className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-line bg-code px-2 py-1 font-mono text-[11.5px]">
            <Badge tone="accent" className="h-4 px-1 text-[10px]">
              POST
            </Badge>
            <span className="truncate">/v1/{endpoint.id}</span>
          </code>
          <a
            href={config.provider.docsUrl(endpoint.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            Docs <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11.5px] font-semibold tracking-wide text-fg-muted uppercase">Request body</h3>
          <div className="flex gap-1">
            {endpoint.example && (
              <Button size="sm" variant="ghost" icon={<Wand2 className="size-3.5" />} onClick={() => setValues(valuesFromBody(spec, endpoint.example))}>
                Example
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setValues({})}>
              Clear
            </Button>
          </div>
        </div>
        <SchemaForm
          spec={spec}
          values={values}
          errors={touched ? built.errors : {}}
          onChange={(name, v) => setValues((cur) => ({ ...cur, [name]: v }))}
        />
        {touched && built.formErrors.map((e) => (
          <p key={e} className="mt-3 rounded-md bg-bad-soft px-2.5 py-1.5 text-[12px] text-bad">
            {e}
          </p>
        ))}
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] font-medium text-fg-muted hover:text-fg">
            <Code2 className="size-3.5" /> JSON body
          </summary>
          <pre className="scroll-thin mt-2 max-h-48 overflow-auto rounded-md border border-line bg-code p-2.5 font-mono text-[11.5px] leading-relaxed">
            {JSON.stringify(built.body, null, 2)}
          </pre>
        </details>
      </div>

      <div className="space-y-2.5 border-t border-line bg-surface px-4 py-3">
        <CostBox
          est={est}
          note={
            <>
              {endpoint.billingNote && <span className="block text-warn">{endpoint.billingNote}</span>}
              Final charge is settled from the actual results.{MOCK_MODE ? ' Demo mode: nothing is charged.' : ''}
            </>
          }
        />
        <div className="flex gap-2">
          <Button
            id="run-button"
            variant="primary"
            className="flex-1"
            icon={canRun ? <Play className="size-4" /> : <KeyRound className="size-4" />}
            onClick={run}
            disabled={touched && invalid}
          >
            {canRun ? 'Run' : 'Add API key to run'}
            {canRun && <span className="ml-1 hidden font-mono text-[11px] font-normal opacity-70 sm:inline">Ctrl+↵</span>}
          </Button>
          <Menu
            trigger={({ toggle, open }) => (
              <Button icon={<Copy className="size-4" />} onClick={toggle} aria-expanded={open} aria-haspopup="menu">
                Copy as
              </Button>
            )}
            items={(Object.keys(SNIPPET_LABELS) as SnippetLang[]).map((l) => ({
              label: SNIPPET_LABELS[l],
              hint: l === 'mcp' ? 'for AI agents' : undefined,
              onSelect: () => void copy(l),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
