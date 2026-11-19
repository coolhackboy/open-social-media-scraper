// Cost estimate tests. Run with `npm test` (Node 22.6+ for --experimental-strip-types).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { estimate, fmtUSD, unitPrice } from '../src/lib/cost.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));
const ep = (id) => catalog.endpoints.find((e) => e.id === id);

test('fixed: base credits per request', () => {
  const e = estimate(ep('tiktok/user-audience').billing, { username: 'x' });
  assert.equal(e.credits, 20);
  assert.equal(e.usd, 0.1);
});

test('base_plus_result: results_limit drives the count', () => {
  assert.equal(estimate(ep('x/search').billing, { query: 'a', results_limit: 100 }).credits, 70);
  const d = estimate(ep('x/search').billing, { query: 'a' });
  assert.equal(d.credits, 14); // catalog default of 20 results
  assert.equal(d.assumed, true);
});

test('base_plus_result: estimateInputField counts inputs', () => {
  assert.equal(estimate(ep('tiktok/profiles').billing, { usernames: ['a', 'b', 'c'] }).credits, 1.8);
});

test('base_plus_result: per-input multiplier', () => {
  const b = ep('tiktok/comments').billing;
  assert.equal(b.estimateResultCountPerInputField, 'urls');
  assert.equal(estimate(b, { urls: ['u1', 'u2'] }).credits, 50); // 100 per url × 2 × 0.25
});

test('base_plus_result: base fee and max cap', () => {
  assert.equal(estimate(ep('ai-search/llm-mentions').billing, { target: 'a.com', results_limit: 20 }).credits, 50);
  assert.equal(estimate(ep('youtube/channel-email').billing, { url: 'x' }).credits, 15);
});

test('input_count: per keyword', () => {
  assert.equal(estimate(ep('seo/keyword-overview').billing, { keywords: ['a', 'b'] }).credits, 0.3);
  assert.equal(estimate(ep('seo/traffic-estimate').billing, { targets: ['a.com'] }).credits, 3.1);
});

test('labels', () => {
  assert.equal(unitPrice(ep('x/search').billing), '0.7 cr / result');
  assert.equal(unitPrice(ep('ai-search/google-ai-mode').billing), '2 cr / request');
  assert.equal(fmtUSD(0.0025), '$0.0025');
  assert.equal(fmtUSD(0.35), '$0.35');
});

test('every endpoint used by listening and templates exists in the catalog', () => {
  const ids = new Set(catalog.endpoints.map((e) => e.id));
  for (const file of ['src/lib/listening.ts', 'src/lib/templates.ts']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const used = [...src.matchAll(/'([a-z0-9-]+\/[a-z0-9-]+)'/g)].map((m) => m[1]);
    assert.ok(used.length >= 5, `${file} references endpoints`);
    for (const id of used) assert.ok(ids.has(id), `${file}: ${id} missing from catalog`);
  }
});

test('every endpoint has an estimate for its docs example', () => {
  for (const e of catalog.endpoints) {
    const est = estimate(e.billing, e.example ?? {});
    assert.ok(est && Number.isFinite(est.credits) && est.credits >= 0, e.id);
  }
});
