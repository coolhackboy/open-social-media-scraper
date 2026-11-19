/**
 * Turns an endpoint's JSON Schema into form fields, validates raw form values and builds the
 * JSON request body. Supported: string / integer / number / boolean, arrays of scalars
 * (one value per line), enums, min/max, multipleOf, length, pattern, and the top-level
 * `anyOf: [{required}]` ("provide one of") and `allOf: [{not: {required}}]` ("not together") rules.
 */
import type { Endpoint, JsonSchemaField } from './types';

export type FieldKind = 'text' | 'url' | 'number' | 'boolean' | 'select' | 'list' | 'json';

export interface Field {
  name: string;
  label: string;
  kind: FieldKind;
  schema: JsonSchemaField;
  required: boolean;
  /** Part of an "provide one of" group. */
  oneOfGroup: boolean;
  advanced: boolean;
  options?: string[];
  /** Documented values for a free-text field (offered as autocomplete). */
  suggestions?: string[];
  placeholder?: string;
  help?: string;
}

export interface FormSpec {
  fields: Field[];
  /** Alternatives: at least one group must be complete. */
  anyOf: string[][];
  /** Fields that must not be sent together. */
  exclusive: string[][];
  description?: string;
}

export type FormValues = Record<string, string>;

const ADVANCED = new Set(['callback_url']);

function labelOf(name: string): string {
  const s = name.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kindOf(f: JsonSchemaField): FieldKind {
  if (f.enum?.length) return 'select';
  if (f.type === 'boolean') return 'boolean';
  if (f.type === 'integer' || f.type === 'number') return 'number';
  if (f.type === 'array') return f.items && f.items.type !== 'object' && f.items.type !== 'array' ? 'list' : 'json';
  if (f.type === 'object') return 'json';
  return f.format === 'uri' ? 'url' : 'text';
}

function limitsHelp(f: JsonSchemaField): string | undefined {
  const parts: string[] = [];
  const t = f.type === 'array' ? f.items : f;
  if (f.type === 'array') {
    if (f.minItems != null && f.maxItems != null) parts.push(`${f.minItems}–${f.maxItems} values`);
    else if (f.maxItems != null) parts.push(`up to ${f.maxItems} values`);
    parts.push('one per line');
  }
  if (t) {
    if (t.minimum != null && t.maximum != null) parts.push(`${t.minimum}–${t.maximum}`);
    else if (t.minimum != null) parts.push(`≥ ${t.minimum}`);
    else if (t.maximum != null) parts.push(`≤ ${t.maximum}`);
    if (t.multipleOf != null) parts.push(`step ${t.multipleOf}`);
    if (t.maxLength != null && t.type === 'string') parts.push(`max ${t.maxLength} chars`);
  }
  if (f.default !== undefined) parts.push(`default ${JSON.stringify(f.default)}`);
  return parts.length ? parts.join(' · ') : undefined;
}

export function formSpec(ep: Endpoint): FormSpec {
  const s = ep.input;
  const required = new Set(s.required ?? []);
  const anyOf = (s.anyOf ?? []).map((g) => g.required ?? []).filter((g) => g.length);
  const exclusive = (s.allOf ?? []).map((g) => g.not?.required ?? []).filter((g) => g.length > 1);
  const inGroup = new Set(anyOf.flat());

  const fields: Field[] = [];
  for (const [name, f] of Object.entries(s.properties)) {
    if (f.deprecated) continue;
    const suggestions = ep.hints?.[name];
    const kind = kindOf(f);
    fields.push({
      name,
      label: labelOf(name),
      kind,
      schema: f,
      required: required.has(name),
      oneOfGroup: inGroup.has(name) && !required.has(name),
      advanced: ADVANCED.has(name),
      options: f.enum?.map(String),
      suggestions: f.enum ? undefined : suggestions,
      placeholder: f.default !== undefined && kind !== 'list' ? String(f.default) : undefined,
      help: limitsHelp(f),
    });
  }
  const rank = (x: Field) => (x.advanced ? 3 : x.required ? 0 : x.oneOfGroup ? 1 : 2);
  const order = Object.keys(s.properties);
  fields.sort((a, b) => rank(a) - rank(b) || order.indexOf(a.name) - order.indexOf(b.name));
  return { fields, anyOf, exclusive, description: s.description };
}

function scalar(raw: string, f: JsonSchemaField | undefined, label: string): { value?: unknown; error?: string } {
  const t = f?.type ?? 'string';
  if (t === 'integer' || t === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { error: `${label} must be a number` };
    if (t === 'integer' && !Number.isInteger(n)) return { error: `${label} must be a whole number` };
    if (f?.minimum != null && n < f.minimum) return { error: `${label} must be at least ${f.minimum}` };
    if (f?.exclusiveMinimum != null && n <= f.exclusiveMinimum) return { error: `${label} must be greater than ${f.exclusiveMinimum}` };
    if (f?.maximum != null && n > f.maximum) return { error: `${label} must be at most ${f.maximum}` };
    if (f?.multipleOf != null && Math.abs(n / f.multipleOf - Math.round(n / f.multipleOf)) > 1e-9)
      return { error: `${label} must be a multiple of ${f.multipleOf}` };
    return { value: n };
  }
  if (t === 'boolean') return { value: raw === 'true' };
  if (f?.minLength != null && raw.length < f.minLength) return { error: `${label} is too short` };
  if (f?.maxLength != null && raw.length > f.maxLength) return { error: `${label} is longer than ${f.maxLength} characters` };
  if (f?.pattern) {
    try {
      if (!new RegExp(f.pattern).test(raw)) return { error: `${label} has an unexpected format` };
    } catch {
      /* unsupported pattern syntax: let the API validate */
    }
  }
  if (f?.format === 'uri' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return { error: `${label} must be a full URL` };
  if (f?.enum && !f.enum.map(String).includes(raw)) return { error: `${label} must be one of ${f.enum.join(', ')}` };
  return { value: raw };
}

export interface BuildResult {
  body: Record<string, unknown>;
  errors: Record<string, string>;
  formErrors: string[];
}

export function buildBody(spec: FormSpec, values: FormValues): BuildResult {
  const body: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const formErrors: string[] = [];

  for (const field of spec.fields) {
    const raw = (values[field.name] ?? '').trim();
    const f = field.schema;
    if (!raw) {
      if (field.required) errors[field.name] = `${field.label} is required`;
      continue;
    }
    if (field.kind === 'json') {
      try {
        body[field.name] = JSON.parse(raw);
      } catch {
        errors[field.name] = `${field.label} must be valid JSON`;
      }
      continue;
    }
    if (field.kind === 'list') {
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const out: unknown[] = [];
      for (const line of lines) {
        const r = scalar(line, f.items, `Each ${field.label.toLowerCase()} value`);
        if (r.error) {
          errors[field.name] = `${r.error}: "${line.length > 40 ? `${line.slice(0, 40)}…` : line}"`;
          break;
        }
        out.push(r.value);
      }
      if (errors[field.name]) continue;
      if (f.minItems != null && out.length < f.minItems) errors[field.name] = `Add at least ${f.minItems} value${f.minItems > 1 ? 's' : ''}`;
      else if (f.maxItems != null && out.length > f.maxItems) errors[field.name] = `At most ${f.maxItems} values`;
      else body[field.name] = out;
      continue;
    }
    if (field.kind === 'boolean') {
      if (raw === 'true' || raw === 'false') body[field.name] = raw === 'true';
      continue;
    }
    const r = scalar(raw, f, field.label);
    if (r.error) errors[field.name] = r.error;
    else body[field.name] = r.value;
  }

  const has = (k: string) => body[k] !== undefined;
  if (spec.anyOf.length && !spec.anyOf.some((g) => g.every(has))) {
    formErrors.push(`Provide ${spec.anyOf.map((g) => g.map((k) => `“${labelOf(k)}”`).join(' + ')).join(' or ')}.`);
  }
  for (const group of spec.exclusive) {
    if (group.every(has)) formErrors.push(`Use only one of ${group.map((k) => `“${labelOf(k)}”`).join(' and ')}.`);
  }
  return { body, errors, formErrors };
}

/** Converts a JSON body (e.g. a docs example or a history entry) back to raw form values. */
export function valuesFromBody(spec: FormSpec, body: Record<string, unknown> | undefined): FormValues {
  const out: FormValues = {};
  if (!body) return out;
  for (const field of spec.fields) {
    const v = body[field.name];
    if (v === undefined || v === null) continue;
    if (field.kind === 'list' && Array.isArray(v)) out[field.name] = v.map(String).join('\n');
    else if (field.kind === 'json') out[field.name] = JSON.stringify(v, null, 2);
    else out[field.name] = String(v);
  }
  return out;
}
