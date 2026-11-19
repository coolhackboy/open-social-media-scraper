#!/usr/bin/env node
/**
 * Validates src/data/catalog.json (and src/data/fixtures.json when present).
 *
 *   node scripts/check-catalog.mjs          offline structural checks (exit code 1 on errors)
 *   node scripts/check-catalog.mjs --live   also compares with the public, key-free
 *                                           GET https://api.socq.ai/v1/catalog
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, args } from './lib/sources.mjs';

const opts = args();
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));
const fixturesFile = path.join(ROOT, 'src/data/fixtures.json');
const fixtures = fs.existsSync(fixturesFile) ? JSON.parse(fs.readFileSync(fixturesFile, 'utf8')) : null;

const errors = [];
const warnings = [];
const err = (w, m) => errors.push(`${w}: ${m}`);
const warn = (w, m) => warnings.push(`${w}: ${m}`);

const MODES = new Set(['fixed', 'base_plus_result', 'input_count']);
const TYPES = new Set(['string', 'integer', 'number', 'boolean', 'array', 'object']);

if (catalog.apiBase !== 'https://api.socq.ai') err('catalog', `apiBase ${catalog.apiBase}`);
if (catalog.creditUSD !== 0.005) err('catalog', `creditUSD ${catalog.creditUSD}`);
if (Number.isNaN(Date.parse(catalog.generatedAt))) err('catalog', 'generatedAt');

const ids = new Set();
const perPlatform = {};
for (const e of catalog.endpoints) {
  const w = e.id;
  if (ids.has(e.id)) err(w, 'duplicate id');
  ids.add(e.id);
  if (e.id !== `${e.platform}/${e.resource}`) err(w, 'id is not platform/resource');
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(e.id)) err(w, 'id has unexpected characters');
  for (const k of ['name', 'description', 'category', 'tool', 'itemSchema']) if (typeof e[k] !== 'string' || !e[k]) err(w, `${k} missing`);
  if (e.tool !== `socq_${e.id.replace(/[/-]/g, '_')}`) warn(w, `tool name ${e.tool} does not follow socq_<platform>_<resource>`);
  if (!catalog.itemFields[e.itemSchema]) err(w, `item schema ${e.itemSchema} has no field list`);
  perPlatform[e.platform] = (perPlatform[e.platform] || 0) + 1;

  const b = e.billing;
  if (!b || !MODES.has(b.mode)) err(w, `billing mode ${b?.mode}`);
  else {
    if (typeof b.baseCredits !== 'number' || b.baseCredits < 0) err(w, 'baseCredits');
    if (b.mode === 'base_plus_result' && !(b.resultUnitCredits > 0)) err(w, 'resultUnitCredits');
    if (b.mode === 'input_count' && (!(b.unitCredits > 0) || !b.inputField)) err(w, 'input_count needs unitCredits + inputField');
    if (b.mode === 'fixed' && !(b.baseCredits > 0)) err(w, 'fixed price is 0');
  }

  const s = e.input;
  if (s?.type !== 'object' || typeof s.properties !== 'object') err(w, 'input is not an object schema');
  else {
    for (const r of s.required ?? []) if (!s.properties[r]) err(w, `required field ${r} not in properties`);
    for (const g of s.anyOf ?? []) for (const r of g.required ?? []) if (!s.properties[r]) err(w, `anyOf field ${r} not in properties`);
    for (const [k, f] of Object.entries(s.properties)) {
      if (!TYPES.has(f.type)) err(w, `field ${k} has type ${JSON.stringify(f.type)}`);
      if (f.type === 'array' && !TYPES.has(f.items?.type)) err(w, `field ${k} array items type ${f.items?.type}`);
    }
    if (e.example) for (const k of Object.keys(e.example)) if (!s.properties[k]) err(w, `example field ${k} is not an input field`);
  }
  if (!e.example) warn(w, 'no request example');
  if (fixtures && !fixtures.responses[e.id]) err(w, 'no mock fixture');
}

for (const p of catalog.platforms) if (perPlatform[p.id] !== p.count) err(`platform ${p.id}`, `count ${p.count} != ${perPlatform[p.id]}`);
if (catalog.platforms.length !== Object.keys(perPlatform).length) err('catalog', 'platform list incomplete');
if (catalog.counts.endpoints !== catalog.endpoints.length) err('catalog', 'counts.endpoints');

if (fixtures) {
  for (const [id, r] of Object.entries(fixtures.responses)) {
    if (!ids.has(id)) err(`fixture ${id}`, 'not in catalog');
    if (r.status !== 'succeeded' || !Array.isArray(r.results?.items)) err(`fixture ${id}`, 'not a completed task response');
  }
}

if (opts.live) {
  const live = [];
  let cursor = null;
  let platforms = [];
  for (let page = 0; page < 20; page++) {
    const url = `https://api.socq.ai/v1/catalog${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
    const body = await fetch(url).then((r) => r.json());
    if (!page) platforms = body.data.platforms;
    live.push(...body.data.endpoints.items);
    cursor = body.data.endpoints.next_cursor;
    if (!body.data.endpoints.has_more) break;
  }
  const byId = new Map(live.map((x) => [x.public_id, x]));
  console.log(`Live catalog: ${live.length} endpoints, ${platforms.length} platforms`);
  for (const p of platforms) {
    const ours = catalog.platforms.find((x) => x.id === p.platform);
    if (!ours) err(`live ${p.platform}`, 'platform missing from catalog');
    else {
      if (ours.title !== p.title) warn(`live ${p.platform}`, `title "${ours.title}" vs live "${p.title}"`);
      if (ours.count !== p.endpoint_count) warn(`live ${p.platform}`, `${ours.count} endpoints vs live ${p.endpoint_count}`);
    }
  }
  for (const e of catalog.endpoints) {
    const l = byId.get(e.id);
    if (!l) {
      warn(`live ${e.id}`, 'not in the live catalog');
      continue;
    }
    if (l.tool_name !== e.tool) warn(`live ${e.id}`, `tool ${e.tool} vs live ${l.tool_name}`);
    const lb = l.billing ?? {};
    const c = lb.config ?? {};
    const b = e.billing;
    const diff = [];
    if (lb.mode !== b.mode) diff.push(`mode ${b.mode} vs ${lb.mode}`);
    if ((lb.base_credits ?? 0) !== b.baseCredits) diff.push(`base ${b.baseCredits} vs ${lb.base_credits}`);
    if (b.mode === 'base_plus_result' && c.result_unit_credits !== b.resultUnitCredits) diff.push(`per result ${b.resultUnitCredits} vs ${c.result_unit_credits}`);
    if (b.mode === 'input_count' && lb.unit_credits !== b.unitCredits) diff.push(`per unit ${b.unitCredits} vs ${lb.unit_credits}`);
    if ((b.estimateInputField ?? '') !== (c.estimate_input_field ?? '')) diff.push(`estimateInputField ${b.estimateInputField} vs ${c.estimate_input_field}`);
    if ((b.estimateResultCountPerInputField ?? '') !== (c.estimate_result_count_per_input_field ?? ''))
      diff.push(`estimateResultCountPerInputField ${b.estimateResultCountPerInputField} vs ${c.estimate_result_count_per_input_field}`);
    if (b.maxCredits !== c.max_credits) diff.push(`maxCredits ${b.maxCredits} vs ${c.max_credits}`);
    if (b.minCredits !== c.min_credits) diff.push(`minCredits ${b.minCredits} vs ${c.min_credits}`);
    if (c.duration_pricing && !e.billingNote) diff.push(`live has duration pricing ${JSON.stringify(c.duration_pricing)}`);
    if (diff.length) warn(`live ${e.id}`, `billing: ${diff.join('; ')}`);
    const ka = Object.keys(e.input.properties).sort().join(',');
    const kb = Object.keys(l.input_schema?.properties ?? {}).sort().join(',');
    if (ka !== kb) warn(`live ${e.id}`, `input fields differ: [${ka}] vs live [${kb}]`);
  }
  for (const id of byId.keys()) if (!ids.has(id)) warn(`live ${id}`, 'missing from catalog');
}

console.log(`${catalog.endpoints.length} endpoints, ${catalog.platforms.length} platforms${fixtures ? `, ${Object.keys(fixtures.responses).length} fixtures` : ''}`);
for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
