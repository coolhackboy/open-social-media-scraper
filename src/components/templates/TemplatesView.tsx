import clsx from 'clsx';
import { KeyRound, LayoutTemplate, Megaphone, Play, Rocket, Sparkles, UserCheck, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { findEndpoint } from '../../data/catalog';
import { MOCK_MODE } from '../../lib/api';
import { fmtCredits } from '../../lib/cost';
import { relTime } from '../../lib/format';
import { navigate, useRoute } from '../../lib/router';
import { useRuns, useSettings } from '../../lib/store';
import { TEMPLATES, runTemplate, templateCost, templateValues, type Template } from '../../lib/templates';
import { isActive } from '../../lib/types';
import { useUI } from '../../lib/ui';
import { Button } from '../../ui';
import { CostBox } from '../CostBox';
import { PlatformMark } from '../marks';
import { ResultsPanel, StatusBadge } from '../results/ResultsPanel';

const ICONS = { 'user-check': UserCheck, megaphone: Megaphone, sparkles: Sparkles, rocket: Rocket };

const drafts = new Map<string, Record<string, string>>();

function TemplatePicker({ current }: { current: Template }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TEMPLATES.map((t) => {
        const Icon = ICONS[t.icon];
        const on = t.id === current.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`templates/${t.id}`)}
            aria-current={on ? 'true' : undefined}
            className={clsx(
              'flex flex-col items-start gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
              on ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon className={clsx('size-4 shrink-0', on ? 'text-accent-ink' : 'text-fg-muted')} />
              <span className="text-[12.5px] leading-tight font-semibold">{t.title}</span>
            </span>
            <span className="flex gap-0.5">
              {[...new Set(t.steps(t.example).map((s) => s.endpointId.split('/')[0]))].map((p) => (
                <PlatformMark key={p} platform={p} size="sm" />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TemplateForm({ t, onRun }: { t: Template; onRun(values: Record<string, string>): void }) {
  const [raw, setRaw] = useState<Record<string, string>>(() => drafts.get(t.id) ?? { ...t.example });
  const [tried, setTried] = useState(false);
  const apiKey = useSettings((s) => s.apiKey);
  const openSettings = useUI((s) => s.openSettings);
  const { values, missing } = templateValues(t, raw);
  const steps = t.steps(values);
  const cost = templateCost(steps);
  const canRun = MOCK_MODE || !!apiKey;

  const set = (k: string, v: string) => {
    const next = { ...raw, [k]: v };
    drafts.set(t.id, next);
    setRaw(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight">{t.title}</h2>
        <p className="mt-1 text-[12.5px] leading-snug text-fg-muted">{t.summary}</p>
      </div>
      <div className="space-y-3">
        {t.inputs.map((i) => (
          <div key={i.name}>
            <label htmlFor={`t-${i.name}`} className="mb-1 block text-[12.5px] font-medium">
              {i.label}
            </label>
            <input
              id={`t-${i.name}`}
              className="field"
              value={raw[i.name] ?? ''}
              placeholder={i.placeholder}
              aria-invalid={tried && !values[i.name]}
              onChange={(e) => set(i.name, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && document.getElementById('template-run')?.click()}
            />
          </div>
        ))}
        <button type="button" onClick={() => setRaw({ ...t.example })} className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg">
          <Wand2 className="size-3.5" /> Fill example
        </button>
      </div>
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">Steps</h3>
        <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
          {steps.map((s, i) => {
            const ep = findEndpoint(s.endpointId);
            const e = cost.perStep[i];
            return (
              <li key={s.endpointId} className="flex items-center gap-2.5 px-3 py-2">
                <span className="font-mono text-[11px] text-fg-subtle">{i + 1}</span>
                <PlatformMark platform={s.endpointId.split('/')[0]} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{s.label}</span>
                  <span className="block truncate font-mono text-[10.5px] text-fg-subtle">
                    {ep ? `POST /v1/${ep.id}` : `${s.endpointId} (missing)`}
                  </span>
                </span>
                <span className="text-right font-mono text-[11px] text-fg-muted tabular">{e ? `${fmtCredits(e.credits)} cr` : '—'}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <CostBox est={cost.total} label="Template total" note="Each step is billed by its actual results." />
      {tried && missing.length > 0 && <p className="text-[12px] text-bad">Fill in: {missing.join(', ')}</p>}
      <Button
        id="template-run"
        variant="primary"
        className="w-full"
        icon={canRun ? <Play className="size-4" /> : <KeyRound className="size-4" />}
        onClick={() => {
          setTried(true);
          if (missing.length) return;
          if (!canRun) return openSettings('key');
          onRun(values);
        }}
      >
        {canRun ? `Run ${steps.length} steps` : 'Add API key to run'}
      </Button>
    </div>
  );
}

function TemplateResults({ groupId }: { groupId: string }) {
  const runsMap = useRuns((s) => s.runs);
  const runs = useMemo(
    () => Object.values(runsMap).filter((r) => r.origin.kind === 'template' && r.origin.ref === groupId).sort((a, b) => a.createdAt - b.createdAt),
    [runsMap, groupId],
  );
  const [tab, setTab] = useState(0);
  const current = runs[Math.min(tab, runs.length - 1)];
  if (!runs.length) return <div className="p-6 text-[13px] text-fg-subtle">This template run is no longer in history.</div>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 pt-2" role="tablist" aria-label="Template steps">
        {runs.map((r, i) => {
          const ep = findEndpoint(r.endpointId);
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={current?.id === r.id}
              onClick={() => setTab(i)}
              className={clsx(
                '-mb-px flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-[12.5px] transition-colors',
                current?.id === r.id ? 'border-line bg-surface font-semibold text-fg' : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              <PlatformMark platform={ep?.platform ?? '?'} size="sm" />
              {r.origin.label?.split(' · ')[1] ?? ep?.name}
              {isActive(r.status) ? <StatusBadge status={r.status} /> : <span className="font-mono text-[11px] text-fg-subtle">{r.status === 'succeeded' ? r.items.length : '!'}</span>}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 bg-surface">{current && <ResultsPanel key={current.id} runId={current.id} />}</div>
    </div>
  );
}

function RecentTemplateRuns({ t }: { t: Template }) {
  const runsMap = useRuns((s) => s.runs);
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; at: number; label: string; n: number }>();
    for (const r of Object.values(runsMap)) {
      if (r.origin.kind !== 'template' || !r.origin.ref || r.origin.template !== t.id) continue;
      const g = map.get(r.origin.ref) ?? { id: r.origin.ref, at: r.createdAt, label: JSON.stringify(Object.values(r.input)[0] ?? ''), n: 0 };
      g.n++;
      g.at = Math.min(g.at, r.createdAt);
      map.set(r.origin.ref, g);
    }
    return [...map.values()].sort((a, b) => b.at - a.at).slice(0, 5);
  }, [runsMap, t.id]);
  return (
    <div className="ruled flex h-full items-center justify-center p-8">
      <div className="w-full max-w-[440px] rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          <LayoutTemplate className="size-4 text-accent" /> One click, several endpoints
        </div>
        <p className="mt-1 text-[12.5px] text-fg-muted">
          A template is a preset of normal requests. Each step runs like a console request, shows up in History, and can be exported on its own.
        </p>
        {groups.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {groups.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => navigate(`templates/${t.id}/${g.id}`)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{g.label}</span>
                  <span className="text-fg-subtle">
                    {g.n} steps · {relTime(g.at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function TemplatesView() {
  const route = useRoute();
  const [tid, groupId] = route.parts;
  const t = TEMPLATES.find((x) => x.id === tid) ?? TEMPLATES[0];
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className={clsx('scroll-thin min-h-0 overflow-y-auto border-line bg-surface p-4 lg:block lg:border-r', groupId ? 'hidden' : 'block')}>
        <TemplatePicker current={t} />
        <div className="mt-5">
          <TemplateForm
            key={t.id}
            t={t}
            onRun={(values) => {
              const { groupId: g } = runTemplate(t, t.steps(values));
              navigate(`templates/${t.id}/${g}`);
            }}
          />
        </div>
      </aside>
      <section className={clsx('min-h-0 lg:block', groupId ? 'block' : 'hidden')}>
        {groupId ? (
          <div className="flex h-full min-h-0 flex-col">
            <button type="button" onClick={() => navigate(`templates/${t.id}`)} className="border-b border-line bg-surface px-4 py-2 text-left text-[12.5px] text-fg-muted lg:hidden">
              ← {t.title}
            </button>
            <div className="min-h-0 flex-1">
              <TemplateResults key={groupId} groupId={groupId} />
            </div>
          </div>
        ) : (
          <RecentTemplateRuns t={t} />
        )}
      </section>
    </div>
  );
}
