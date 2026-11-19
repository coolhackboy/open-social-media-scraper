import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const REPO_URL = 'https://github.com/coolhackboy/open-social-media-scraper'
/** Until a site URL is configured, the OG image is served from the repository itself. */
const REPO_OG_IMAGE = 'https://raw.githubusercontent.com/coolhackboy/open-social-media-scraper/main/public/og.png'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Fills the brand name and absolute og:url / og:image placeholders in index.html. */
function htmlMeta(opts: { brandName: string; siteUrl: string }): Plugin {
  const site = opts.siteUrl.replace(/\/+$/, '')
  const ogImage = site ? `${site}/og.png` : REPO_OG_IMAGE
  return {
    name: 'html-meta',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replaceAll('__BRAND_NAME__', escapeHtml(opts.brandName))
          .replaceAll('__SITE_URL__', escapeHtml(site || REPO_URL))
          .replaceAll('__OG_IMAGE__', escapeHtml(ogImage)),
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  return {
    plugins: [
      react(),
      tailwindcss(),
      htmlMeta({
        brandName: env.VITE_BRAND_NAME?.trim() || 'Open Social Media Scraper',
        siteUrl: env.VITE_SITE_URL?.trim() || '',
      }),
    ],
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // A long-lived vendor chunk keeps the app chunk small and cache-friendly.
          manualChunks: { react: ['react', 'react-dom', 'react-dom/client', 'scheduler'] },
        },
      },
    },
  }
})
