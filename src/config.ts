/**
 * Brand + backend configuration. Everything a white-label fork usually changes lives here
 * (plus `.env`). Values come from Vite env vars at build time. Never put an API key here.
 */

const env = import.meta.env;

function str(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

const UTM = 'utm_source=open-social-media-scraper&utm_medium=app';

export const config = {
  brandName: str(env.VITE_BRAND_NAME, 'Open Social Media Scraper'),
  /** Optional logo URL; when empty the built-in mark is used. */
  brandLogoUrl: str(env.VITE_BRAND_LOGO_URL, ''),
  /** Optional accent override (any CSS color). */
  accent: str(env.VITE_ACCENT, ''),
  defaultApiBase: str(env.VITE_API_BASE, 'https://api.socq.ai').replace(/\/+$/, ''),
  showPoweredBy: bool(env.VITE_SHOW_POWERED_BY, true),

  repoUrl: 'https://github.com/coolhackboy/open-social-media-scraper',

  provider: {
    name: 'SocQ',
    homeUrl: `https://socq.ai/?${UTM}&utm_campaign=powered_by`,
    keyUrl: `https://socq.ai/dashboard/api-key?${UTM}&utm_campaign=api_key`,
    docsUrl: (endpointId?: string) =>
      `https://docs.socq.ai/${endpointId ? `api-manual/${endpointId}` : ''}?${UTM}&utm_campaign=docs`,
    mcpUrl: 'https://api.socq.ai/mcp',
    /** Shown as the env var name in "Copy as code" snippets. */
    keyEnvVar: 'SOCQ_API_KEY',
    /** USD value of one billing credit. */
    creditUSD: 0.005,
  },
} as const;

export type AppConfig = typeof config;
