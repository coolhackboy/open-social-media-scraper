#!/usr/bin/env node
/**
 * Builds src/data/catalog.json from two SocQ sources:
 *
 *   - apis.json        names, descriptions, categories, popularity and billing per endpoint
 *   - agent-api.json   the public OpenAPI file: paths, request JSON schemas, result item schemas
 *
 * and, optionally, the public docs pages (request examples and "Accepted values" tables).
 *
 * Usage:
 *   node scripts/build-catalog.mjs --apis apis.json --openapi agent-api.json --docs ../socq-docs
 *   node scripts/build-catalog.mjs --apis-git ../socq@origin/main:data/apis.json \
 *        --openapi agent-api.json --docs-git ../socq-docs@origin/main
 *
 * The mapping between apis.json (`id`, `platform`, `slug`, optional `publicId`) and OpenAPI paths
 * (`POST /v1/<platform>/<resource>`) is checked and every mismatch is printed. The generated
 * file is committed; the app never needs these sources at runtime.
 */
import { args, docsReader, readJsonSource, writeJson } from './lib/sources.mjs';

const opts = args();
const apis = readJsonSource(opts, { flag: 'apis', env: 'SOCQ_APIS_JSON', gitFlag: 'apis-git', gitEnv: 'SOCQ_APIS_GIT', label: 'apis.json' });
const openapi = readJsonSource(opts, { flag: 'openapi', env: 'SOCQ_OPENAPI_JSON', gitFlag: 'openapi-git', gitEnv: 'SOCQ_OPENAPI_GIT', label: 'agent-api.json' });
const docs = docsReader(opts);

/** Display titles of the platform keys used in API paths (same as the public /v1/catalog). */
const PLATFORM_TITLES = {
  'ai-search': 'AI Search',
  amazon: 'Amazon',
  'apple-app-store': 'Apple App Store',
  bluesky: 'Bluesky',
  'brand-monitoring': 'Brand Monitoring',
  creator: 'Creator',
  douyin: 'Douyin',
  facebook: 'Facebook',
  'facebook-ad-library': 'Facebook Ad Library',
  'facebook-marketplace': 'Facebook Marketplace',
  'google-ad-library': 'Google Ad Library',
  'google-hotels': 'Google Hotels',
  'google-maps': 'Google Maps',
  'google-play': 'Google Play',
  instagram: 'Instagram',
  kwai: 'Kwai',
  'link-in-bio': 'Link in Bio',
  linkedin: 'LinkedIn',
  'linkedin-ad-library': 'LinkedIn Ad Library',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  rednote: 'Rednote',
  seo: 'SEO',
  snapchat: 'Snapchat',
  telegram: 'Telegram',
  threads: 'Threads',
  tiktok: 'TikTok',
  'tiktok-ad-library': 'TikTok Ad Library',
  'tiktok-creative-center': 'TikTok Creative Center',
  'tiktok-shop': 'TikTok Shop',
  'truth-social': 'Truth Social',
  twitch: 'Twitch',
  x: 'X',
  youtube: 'YouTube',
};

/**
 * Endpoints that exist in the OpenAPI file but not in apis.json. Their metadata comes from the
 * public catalog (GET https://api.socq.ai/v1/catalog) so they can still be estimated and run.
 */
const OPENAPI_ONLY = {
  'douyin/product-data': {
    name: 'Douyin Live Room Products',
    description: 'Collect one page of public Douyin live room products.',
    category: 'products',
    group: 'products',
    billing: { mode: 'fixed', baseCredits: 0.1 },
    source: 'public /v1/catalog (missing from apis.json)',
  },
};

/** Known gaps between apis.json billing and how the API actually bills. Shown in the app. */
const BILLING_NOTES = {
  'x/post-transcript': 'Videos longer than 2 minutes add 4 credits per minute; the estimate assumes a short video.',
};

/**
 * Input rules the API enforces but the published schema does not state yet (found with real requests:
 * `x/search` with results_limit 5 returns 422 "expected multiple of 20 between 20 and 2000").
 * Merged into the field schema so forms and listening monitors send valid values. Remove an entry
 * once the OpenAPI file carries the rule; the build reports entries that have become redundant.
 */
const INPUT_RULES = {
  'x/search': { results_limit: { minimum: 20, maximum: 2000, multipleOf: 20 } },
  'x/user-posts': { results_limit: { minimum: 20, maximum: 2000, multipleOf: 20 } },
};

const issues = [];
const issue = (kind, msg) => issues.push({ kind, msg });

const posts = new Map();
for (const [p, ops] of Object.entries(openapi.paths)) {
  if (!ops.post) continue;
  const m = /^\/v1\/([^/]+)\/([^/]+)$/.exec(p);
  if (!m) {
    issue('openapi', `unexpected POST path ${p}`);
    continue;
  }
  posts.set(`${m[1]}/${m[2]}`, ops.post);
}

const refName = (ref) => (ref ? ref.split('/').pop() : null);
const schemas = openapi.components?.schemas ?? {};

function cleanSchema(s) {
  const out = { ...s };
  delete out.$schema;
  delete out.additionalProperties;
  return out;
}

/** "Accepted values" tables in the docs list values for free-text fields; turn them into suggestions. */
function acceptedValues(mdx) {
  const out = {};
  const i = mdx.indexOf('| Field | Accepted values |');
  if (i < 0) return out;
  for (const line of mdx.slice(i).split('\n').slice(2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').map((c) => c.trim());
    const field = /^`([^`]+)`$/.exec(cells[1] ?? '')?.[1];
    const values = [...(cells[2] ?? '').matchAll(/`([^`]+)`/g)].map((v) => v[1]);
    if (field && values.length) out[field] = values;
  }
  return out;
}

/** The request example is the first JSON block before the MCP / result sections. */
function requestExample(mdx) {
  const stop = ['{/* mcp-usage:start */}', '## Use with MCP', '## Completed Task Response', '## Result Fields']
    .map((s) => mdx.indexOf(s))
    .filter((n) => n >= 0);
  const head = stop.length ? mdx.slice(0, Math.min(...stop)) : mdx;
  const m = /```json\s*\n([\s\S]*?)```/.exec(head);
  if (!m) return undefined;
  try {
    return JSON.parse(m[1]);
  } catch {
    return undefined;
  }
}

function billingOf(b) {
  const keep = [
    'mode', 'baseCredits', 'resultUnitSize', 'resultUnitCredits', 'estimateResultCount', 'estimateInputField',
    'estimateResultCountPerInputField', 'emptyResultPolicy', 'inputField', 'unitSize', 'unitCredits', 'minCredits', 'maxCredits',
  ];
  const out = {};
  for (const k of keep) if (b[k] !== undefined) out[k] = b[k];
  return out;
}

const endpoints = [];
const seen = new Set();
const slugMismatches = [];

for (const a of apis) {
  const naive = `${a.platform}/${a.slug}`;
  const id = a.publicId || naive;
  if (a.id !== `${a.platform}-${a.slug}`) issue('apis.json', `${a.id}: id is not <platform>-<slug> (${a.platform}, ${a.slug})`);
  if (a.publicId && a.publicId !== naive) {
    slugMismatches.push(`${a.id}: site slug "${naive}" -> API path /v1/${a.publicId}${posts.has(naive) ? ' (naive path ALSO exists!)' : ''}`);
  }
  const op = posts.get(id);
  if (!op) {
    issue('missing-path', `${a.id}: no OpenAPI path POST /v1/${id}`);
    continue;
  }
  if (seen.has(id)) issue('duplicate', `${id} is claimed by two apis.json entries`);
  seen.add(id);
  if (op.tags?.[0] !== a.platform) issue('platform', `${id}: OpenAPI tag ${op.tags?.[0]} != apis.json platform ${a.platform}`);
  endpoints.push(makeEndpoint(id, op, {
    name: a.name,
    description: a.description,
    category: a.category,
    group: a.crossPlatformGroup,
    popular: !!a.popular,
    hotRank: a.hotRank,
    launchedAt: a.launchedAt,
    billing: billingOf(a.billing),
  }));
}

for (const [id, op] of posts) {
  if (seen.has(id)) continue;
  const extra = OPENAPI_ONLY[id];
  if (!extra) {
    issue('missing-apis', `POST /v1/${id} has no apis.json entry and no fallback metadata; skipped`);
    continue;
  }
  issue('missing-apis', `POST /v1/${id} has no apis.json entry; metadata from ${extra.source}`);
  endpoints.push(makeEndpoint(id, op, { ...extra, popular: false, hotRank: 999, launchedAt: null }));
}

function makeEndpoint(id, op, meta) {
  const [platform, resource] = id.split('/');
  const body = op.requestBody?.content?.['application/json']?.schema;
  if (!body || body.type !== 'object') issue('schema', `${id}: request body is not an object schema`);
  const itemSchema = refName(op['x-standard-result-item-schema']?.$ref);
  if (!itemSchema) issue('schema', `${id}: no x-standard-result-item-schema`);
  else if (!schemas[itemSchema]) issue('schema', `${id}: unknown item schema ${itemSchema}`);
  const ep = {
    id,
    platform,
    resource,
    name: String(meta.name).replace(/\s+API$/, ''),
    description: meta.description,
    category: meta.category,
    group: meta.group,
    popular: meta.popular,
    hotRank: meta.hotRank,
    launchedAt: meta.launchedAt,
    tool: op.operationId,
    itemSchema,
    billing: meta.billing,
    input: cleanSchema(body ?? { type: 'object', properties: {} }),
  };
  for (const [field, rule] of Object.entries(INPUT_RULES[id] ?? {})) {
    const f = ep.input.properties?.[field];
    if (!f) {
      issue('input-rules', `${id}: rule for unknown field ${field}`);
      continue;
    }
    if (Object.entries(rule).every(([k, v]) => f[k] === v)) issue('input-rules', `${id}.${field}: schema already has this rule; remove the override`);
    ep.input.properties[field] = { ...f, ...rule };
  }
  if (BILLING_NOTES[id]) ep.billingNote = BILLING_NOTES[id];
  if (meta.source) ep.metaSource = meta.source;
  for (const field of [ep.billing.inputField, ep.billing.estimateInputField, ep.billing.estimateResultCountPerInputField]) {
    if (field && !ep.input.properties?.[field]) issue('billing', `${id}: billing field "${field}" is not an input field`);
  }
  if (docs) {
    const mdx = docs.read(id);
    if (!mdx) issue('docs', `${id}: no docs page api-manual/${id}.mdx`);
    else {
      const example = requestExample(mdx);
      if (example) {
        const unknown = Object.keys(example).filter((k) => !ep.input.properties?.[k]);
        if (unknown.length) issue('docs', `${id}: docs example uses unknown fields ${unknown.join(', ')}`);
        ep.example = example;
      } else issue('docs', `${id}: docs page has no request example`);
      const hints = acceptedValues(mdx);
      if (Object.keys(hints).length) ep.hints = hints;
    }
  }
  return ep;
}

endpoints.sort((a, b) => a.platform.localeCompare(b.platform) || a.hotRank - b.hotRank || a.id.localeCompare(b.id));

const platformCounts = {};
for (const e of endpoints) platformCounts[e.platform] = (platformCounts[e.platform] || 0) + 1;
const platforms = Object.entries(platformCounts)
  .map(([id, count]) => {
    if (!PLATFORM_TITLES[id]) issue('platform', `no display title for platform ${id}`);
    return { id, title: PLATFORM_TITLES[id] || id, count };
  })
  .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

const usedSchemas = new Set(endpoints.map((e) => e.itemSchema).filter(Boolean));
const itemFields = {};
for (const name of [...usedSchemas].sort()) itemFields[name] = Object.keys(schemas[name]?.properties ?? {});

const catalog = {
  generatedAt: new Date().toISOString(),
  schemaVersion: openapi.info?.version ?? null,
  apiBase: openapi.servers?.[0]?.url ?? 'https://api.socq.ai',
  creditUSD: 0.005,
  counts: { endpoints: endpoints.length, platforms: platforms.length },
  platforms,
  itemFields,
  endpoints,
};

const file = writeJson('src/data/catalog.json', catalog);
console.log(`Wrote ${file}`);
console.log(`  ${endpoints.length} endpoints across ${platforms.length} platforms (apis.json: ${apis.length}, OpenAPI POST paths: ${posts.size})`);
if (docs) console.log(`  docs: ${docs.label} (${endpoints.filter((e) => e.example).length} request examples)`);
if (slugMismatches.length) {
  console.log(`\nSite slug differs from the API path for ${slugMismatches.length} endpoints (mapped via publicId):`);
  for (const s of slugMismatches) console.log(`  - ${s}`);
}
if (issues.length) {
  console.log(`\n${issues.length} mapping issue(s):`);
  for (const i of issues) console.log(`  [${i.kind}] ${i.msg}`);
}
