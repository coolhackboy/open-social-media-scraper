/**
 * Credit estimates for a request body, following the billing modes in the catalog:
 *
 *   fixed             baseCredits per call
 *   base_plus_result  baseCredits + resultUnitCredits per (resultUnitSize) results
 *   input_count       baseCredits + unitCredits per (unitSize) input items
 *
 * The final charge is settled by SocQ from the actual result count (`credits_amount`).
 * Pure module with no runtime imports so `npm test` can load it directly.
 */
import type { Billing } from './types';

export const CREDIT_USD = 0.005;
const MIN_CHARGE = 0.001;

export interface Estimate {
  credits: number;
  usd: number;
  /** How the number was derived, for the UI. */
  basis: string;
  /** Result count the estimate assumes (base_plus_result only). */
  results?: number;
  /** True when the result count is the catalog default, not derived from the request. */
  assumed?: boolean;
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function charge(v: number): number {
  if (v <= 0) return 0;
  return Math.max(MIN_CHARGE, Number(v.toFixed(6)));
}

/** Number of non-empty items an input field holds (arrays count entries, scalars count as 1). */
export function countItems(value: unknown): number {
  if (Array.isArray(value)) return value.filter((x) => x !== null && x !== undefined && x !== '').length;
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return 0;
  return 1;
}

function limits(v: number, b: Billing): number {
  let out = charge(v);
  if (b.minCredits != null) out = Math.max(out, charge(b.minCredits));
  if (b.maxCredits != null) out = Math.min(out, charge(b.maxCredits));
  return charge(out);
}

function resultEstimate(body: Record<string, unknown>, b: Billing): { n: number; assumed: boolean; why: string } {
  const perField = b.estimateResultCountPerInputField;
  const perCount = perField ? countItems(body[perField]) : 0;
  const limit = Math.trunc(num(body.results_limit));
  if (limit > 0) {
    if (perField) return { n: limit * perCount, assumed: false, why: `${limit} × ${perCount} ${perField}` };
    return { n: limit, assumed: false, why: `results_limit ${limit}` };
  }
  if (b.estimateInputField) {
    const n = countItems(body[b.estimateInputField]);
    if (n > 0) return { n, assumed: false, why: `${n} ${b.estimateInputField}` };
  }
  const def = Math.max(0, Math.trunc(num(b.estimateResultCount)));
  if (perCount > 0) return { n: def * perCount, assumed: true, why: `~${def} per ${perField?.replace(/s$/, '')}` };
  return { n: def, assumed: true, why: `typical ${def}` };
}

export function estimate(b: Billing | undefined, body: Record<string, unknown> = {}): Estimate | null {
  if (!b) return null;
  const out = (credits: number, basis: string, extra: Partial<Estimate> = {}): Estimate => ({
    credits,
    usd: Number((credits * CREDIT_USD).toFixed(6)),
    basis,
    ...extra,
  });

  if (b.mode === 'fixed') return out(limits(b.baseCredits, b), 'per request');

  if (b.mode === 'input_count') {
    const n = b.inputField ? countItems(body[b.inputField]) : 0;
    const size = Math.max(1, Math.trunc(num(b.unitSize) || 1));
    const unit = charge(num(b.unitCredits));
    const inputCredits = n > 0 ? charge(Math.ceil(n / size) * unit) : 0;
    const base = charge(num(b.baseCredits));
    return out(limits(base + inputCredits, b), `${n} ${b.inputField ?? 'items'} × ${fmtCredits(unit)}${base ? ` + ${fmtCredits(base)} base` : ''}`);
  }

  const r = resultEstimate(body, b);
  const size = Math.max(1, Math.trunc(num(b.resultUnitSize) || 1));
  const unit = charge(num(b.resultUnitCredits));
  const resultCredits = r.n > 0 ? charge(Math.ceil(r.n / size) * unit) : 0;
  const base = charge(num(b.baseCredits));
  return out(limits(base + resultCredits, b), `${r.why} × ${fmtCredits(unit)}${base ? ` + ${fmtCredits(base)} base` : ''}`, {
    results: r.n,
    assumed: r.assumed,
  });
}

/** Unit price label, e.g. "0.6 cr / result" or "2 cr / request". */
export function unitPrice(b: Billing): string {
  if (b.mode === 'fixed') return `${fmtCredits(b.baseCredits)} cr / request`;
  const unit = b.mode === 'input_count' ? (b.inputField === 'targets' ? 'domain' : 'keyword') : 'result';
  const credits = b.mode === 'input_count' ? num(b.unitCredits) : num(b.resultUnitCredits);
  const base = num(b.baseCredits);
  return `${base > 0 ? `${fmtCredits(base)} + ` : ''}${fmtCredits(credits)} cr / ${unit}`;
}

export function fmtCredits(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/\.?0+$/, '');
}

export function fmtUSD(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4).replace(/0+$/, '')}`;
  return `$${usd.toFixed(usd < 1 ? 3 : 2).replace(/(\.\d\d)0$/, '$1')}`;
}

export function sumEstimates(list: (Estimate | null)[]): Estimate {
  const credits = Number(list.reduce((n, e) => n + (e?.credits ?? 0), 0).toFixed(6));
  return { credits, usd: Number((credits * CREDIT_USD).toFixed(6)), basis: `${list.length} requests` };
}
