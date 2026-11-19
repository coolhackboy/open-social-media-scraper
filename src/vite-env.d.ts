/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_BRAND_LOGO_URL?: string;
  readonly VITE_ACCENT?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_SHOW_POWERED_BY?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
