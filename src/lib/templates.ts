/**
 * Research templates: presets of existing endpoints, run with the same runner as the console.
 * A template is only a list of steps built from a few inputs; nothing here is special-cased.
 */
import { findEndpoint } from '../data/catalog';
import { estimate, sumEstimates, type Estimate } from './cost';
import { startRun } from './runner';

export interface TemplateInput {
  name: string;
  label: string;
  placeholder: string;
  /** Strip a leading @ / protocol etc. */
  clean?: (v: string) => string;
}

export interface TemplateStep {
  endpointId: string;
  label: string;
  body: Record<string, unknown>;
}

export interface Template {
  id: string;
  title: string;
  summary: string;
  icon: 'user-check' | 'megaphone' | 'sparkles' | 'rocket';
  inputs: TemplateInput[];
  /** Example values (used by "Fill example"). */
  example: Record<string, string>;
  steps(v: Record<string, string>): TemplateStep[];
}

const handle = (v: string) => v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '').replace(/[/?].*$/, '');
const domain = (v: string) => v.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');

export const TEMPLATES: Template[] = [
  {
    id: 'creator-vetting',
    title: 'Creator vetting',
    summary: 'Check a TikTok creator before you reach out: profile stats plus where their audience is located.',
    icon: 'user-check',
    inputs: [{ name: 'username', label: 'TikTok username', placeholder: 'creator_handle', clean: handle }],
    example: { username: 'tiktok' },
    steps: (v) => [
      { endpointId: 'tiktok/profiles', label: 'Profile', body: { usernames: [v.username] } },
      { endpointId: 'tiktok/user-audience', label: 'Audience demographics', body: { username: v.username } },
    ],
  },
  {
    id: 'competitor-ads',
    title: 'Competitor ads',
    summary: 'See what a competitor is running across the Facebook, Google, TikTok and LinkedIn ad libraries.',
    icon: 'megaphone',
    inputs: [
      { name: 'brand', label: 'Brand or keyword', placeholder: 'Notion' },
      { name: 'domain', label: 'Website domain (for Google)', placeholder: 'notion.com', clean: domain },
    ],
    example: { brand: 'Notion', domain: 'notion.com' },
    steps: (v) => [
      { endpointId: 'facebook-ad-library/search', label: 'Facebook ads', body: { query: v.brand, results_limit: 20 } },
      { endpointId: 'google-ad-library/company-ads', label: 'Google ads', body: { domain: v.domain, results_limit: 40 } },
      { endpointId: 'tiktok-ad-library/search', label: 'TikTok ads', body: { query: v.brand, results_limit: 12 } },
      { endpointId: 'linkedin-ad-library/search', label: 'LinkedIn ads', body: { keyword: v.brand, results_limit: 24 } },
    ],
  },
  {
    id: 'ai-visibility',
    title: 'AI search visibility',
    summary: 'Is your brand cited in AI answers? Questions where AI Overviews cite your domain, plus Google AI Mode for one query.',
    icon: 'sparkles',
    inputs: [
      { name: 'domain', label: 'Your domain', placeholder: 'example.com', clean: domain },
      { name: 'query', label: 'A query your buyers ask', placeholder: 'best crm for startups' },
    ],
    example: { domain: 'hubspot.com', query: 'best crm software for small business' },
    steps: (v) => [
      { endpointId: 'ai-search/llm-mentions', label: 'LLM mentions', body: { target: v.domain, results_limit: 20 } },
      { endpointId: 'ai-search/google-ai-mode', label: 'Google AI Mode', body: { query: v.query } },
    ],
  },
  {
    id: 'launch-monitor',
    title: 'Launch monitor',
    summary: 'What are people saying about your launch? Recent posts from X and Reddit in one place.',
    icon: 'rocket',
    inputs: [{ name: 'query', label: 'Product or launch name', placeholder: 'your product' }],
    example: { query: 'open source scraper' },
    steps: (v) => [
      { endpointId: 'x/search', label: 'X posts', body: { query: v.query, results_limit: 20, sort_by: 'latest' } },
      { endpointId: 'reddit/search', label: 'Reddit posts', body: { query: v.query, results_limit: 25 } },
    ],
  },
];

export function templateValues(t: Template, raw: Record<string, string>): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const i of t.inputs) {
    const v = (i.clean ? i.clean(raw[i.name] ?? '') : (raw[i.name] ?? '').trim()).trim();
    if (!v) missing.push(i.label);
    values[i.name] = v;
  }
  return { values, missing };
}

export function templateCost(steps: TemplateStep[]): { perStep: (Estimate | null)[]; total: Estimate } {
  const perStep = steps.map((s) => estimate(findEndpoint(s.endpointId)?.billing, s.body));
  return { perStep, total: sumEstimates(perStep) };
}

export function runTemplate(t: Template, steps: TemplateStep[]): { groupId: string; runIds: string[] } {
  const groupId = `t${Date.now().toString(36)}`;
  const runIds = steps.map((s) => startRun(s.endpointId, s.body, { kind: 'template', ref: groupId, template: t.id, label: `${t.title} · ${s.label}` }));
  return { groupId, runIds };
}
