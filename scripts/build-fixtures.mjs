#!/usr/bin/env node
/**
 * Builds src/data/fixtures.json for mock mode (`?mock=1`) from the "Completed Task Response"
 * example on every SocQ docs page (api-manual/<platform>/<resource>.mdx). Nothing is invented:
 * each fixture is the documented example response for that endpoint. The only change: string
 * values longer than MAX_TEXT characters (long video descriptions, AI answers) are shortened
 * with "…" to keep the demo bundle small.
 *
 *   node scripts/build-fixtures.mjs --docs ../socq-docs
 *   node scripts/build-fixtures.mjs --docs-git ../socq-docs@origin/main
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, args, docsReader, jsonBlockAfter, writeJson } from './lib/sources.mjs';

const MAX_TEXT = 300;

function shorten(v) {
  if (typeof v === 'string') return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT).trimEnd()}…` : v;
  if (Array.isArray(v)) return v.map(shorten);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x)]));
  return v;
}

const opts = args();
const docs = docsReader(opts);
if (!docs) {
  console.error('Pass --docs <dir> or --docs-git <repo>@<ref>');
  process.exit(1);
}
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));

const responses = {};
const problems = [];
for (const e of catalog.endpoints) {
  const mdx = docs.read(e.id);
  if (!mdx) {
    problems.push(`${e.id}: no docs page`);
    continue;
  }
  let body;
  try {
    body = jsonBlockAfter(mdx, '## Completed Task Response');
  } catch (err) {
    problems.push(`${e.id}: example is not valid JSON (${err.message})`);
    continue;
  }
  const data = body?.data;
  if (!data || data.status !== 'succeeded' || !Array.isArray(data.results?.items)) {
    problems.push(`${e.id}: no completed task response`);
    continue;
  }
  if (data.public_id && data.public_id !== e.id) problems.push(`${e.id}: example public_id is ${data.public_id}`);
  responses[e.id] = shorten(data);
}

const file = writeJson('src/data/fixtures.json', {
  source: `SocQ docs "Completed Task Response" examples (${docs.label})`,
  generatedAt: new Date().toISOString(),
  responses,
});
const items = Object.values(responses).reduce((n, r) => n + r.results.items.length, 0);
console.log(`Wrote ${file}: ${Object.keys(responses).length}/${catalog.endpoints.length} endpoints, ${items} example items`);
for (const p of problems) console.log(`  - ${p}`);
if (problems.length) process.exitCode = 1;
