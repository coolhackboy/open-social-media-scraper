import clsx from 'clsx';
import { ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';
import type { Field, FormSpec, FormValues } from '../../lib/schema';

function FieldInput({ field, value, error, onChange }: { field: Field; value: string; error?: string; onChange(v: string): void }) {
  const id = `f-${field.name}`;
  const common = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': `${id}-help`,
  } as const;
  const f = field.schema;

  if (field.kind === 'select') {
    return (
      <select {...common} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{f.default !== undefined ? `Default (${String(f.default)})` : '—'}</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === 'boolean') {
    return (
      <select {...common} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{f.default !== undefined ? `Default (${String(f.default)})` : 'Not set'}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (field.kind === 'list' || field.kind === 'json') {
    const lines = field.kind === 'list' ? value.split('\n').filter((l) => l.trim()).length : 0;
    return (
      <div className="relative">
        <textarea
          {...common}
          rows={field.kind === 'json' ? 4 : Math.min(6, Math.max(2, lines + 1))}
          spellCheck={false}
          className="field scroll-thin resize-y font-mono text-[12.5px] leading-relaxed"
          placeholder={field.kind === 'list' ? (f.items?.format === 'uri' || /url/.test(field.name) ? 'https://…\nhttps://…' : 'one value per line') : '{ }'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.kind === 'list' && lines > 0 && (
          <span className="pointer-events-none absolute right-2 bottom-2 rounded bg-surface-2 px-1 font-mono text-[10.5px] text-fg-subtle">{lines}</span>
        )}
      </div>
    );
  }
  const numeric = field.kind === 'number';
  return (
    <>
      <input
        {...common}
        type={numeric ? 'number' : field.kind === 'url' ? 'url' : 'text'}
        inputMode={numeric ? (f.type === 'integer' ? 'numeric' : 'decimal') : undefined}
        min={numeric ? f.minimum : undefined}
        max={numeric ? f.maximum : undefined}
        step={numeric ? (f.multipleOf ?? (f.type === 'integer' ? 1 : 'any')) : undefined}
        maxLength={!numeric ? f.maxLength : undefined}
        list={field.suggestions ? `${id}-list` : undefined}
        spellCheck={false}
        className={clsx('field', (numeric || field.kind === 'url') && 'font-mono text-[12.5px]')}
        placeholder={field.placeholder ?? (field.suggestions ? field.suggestions.join(' / ') : undefined)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.suggestions && (
        <datalist id={`${id}-list`}>
          {field.suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}

function FieldRow({ field, value, error, onChange }: { field: Field; value: string; error?: string; onChange(v: string): void }) {
  const desc = field.schema.description;
  return (
    <div>
      <label htmlFor={`f-${field.name}`} className="mb-1 flex items-baseline gap-1.5 text-[12.5px] font-medium">
        <span>{field.label}</span>
        <code className="font-mono text-[10.5px] font-normal text-fg-subtle">{field.name}</code>
        {field.required && <span className="text-[11px] font-semibold text-accent-ink">required</span>}
        {field.oneOfGroup && <span className="text-[11px] font-medium text-info">one of</span>}
      </label>
      <FieldInput field={field} value={value} error={error} onChange={onChange} />
      <div id={`f-${field.name}-help`} className="mt-1 space-y-0.5">
        {error ? (
          <p className="text-[11.5px] text-bad">{error}</p>
        ) : (
          (desc || field.help) && (
            <p className="text-[11.5px] leading-snug text-fg-subtle">
              {desc}
              {desc && field.help ? ' · ' : ''}
              {field.help && <span className="font-mono text-[10.5px]">{field.help}</span>}
            </p>
          )
        )}
      </div>
    </div>
  );
}

export function SchemaForm({
  spec,
  values,
  errors,
  onChange,
}: {
  spec: FormSpec;
  values: FormValues;
  errors: Record<string, string>;
  onChange(name: string, value: string): void;
}) {
  const main = spec.fields.filter((f) => !f.advanced);
  const advanced = spec.fields.filter((f) => f.advanced);
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="space-y-3.5">
      {spec.description && (
        <p className="flex gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[12px] leading-snug text-fg-muted">
          <Info className="mt-px size-3.5 shrink-0 text-info" />
          {spec.description}
        </p>
      )}
      {main.map((f) => (
        <FieldRow key={f.name} field={f} value={values[f.name] ?? ''} error={errors[f.name]} onChange={(v) => onChange(f.name, v)} />
      ))}
      {!main.length && <p className="text-[12.5px] text-fg-subtle">This endpoint takes no input.</p>}
      {advanced.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex items-center gap-1 text-[12px] font-medium text-fg-muted hover:text-fg"
          >
            <ChevronRight className={clsx('size-3.5 transition-transform', showAdvanced && 'rotate-90')} />
            Advanced ({advanced.map((f) => f.name).join(', ')})
          </button>
          {showAdvanced && (
            <div className="mt-2.5 space-y-3.5">
              {advanced.map((f) => (
                <FieldRow key={f.name} field={f} value={values[f.name] ?? ''} error={errors[f.name]} onChange={(v) => onChange(f.name, v)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
