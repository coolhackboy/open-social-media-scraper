import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './index.css';
import App from './App';
import { config } from './config';
import { loadCatalog } from './data/catalog';
import { MOCK_MODE } from './lib/api';
import { loadListening } from './lib/listening';
import { loadHistory, refreshAccount } from './lib/runner';
import { initTheme, useSettings } from './lib/store';

/** VITE_ACCENT: derive the related accent tokens from a single color. */
function applyAccent(color: string) {
  if (!color) return;
  const root = document.documentElement.style;
  root.setProperty('--accent', color);
  root.setProperty('--accent-strong', `color-mix(in oklab, ${color} 82%, black)`);
  root.setProperty('--accent-hover', `color-mix(in oklab, ${color} 70%, black)`);
  root.setProperty('--accent-ink', `color-mix(in oklab, ${color} 72%, black)`);
  root.setProperty('--accent-soft', `color-mix(in oklab, ${color} 11%, transparent)`);
  root.setProperty('--accent-line', `color-mix(in oklab, ${color} 38%, transparent)`);
}

initTheme();
applyAccent(config.accent);
document.title = `${config.brandName} — open-source social media scraper`;

const root = createRoot(document.getElementById('root')!);

loadCatalog()
  .then(async () => {
    await Promise.all([loadHistory(), loadListening()]);
    if (MOCK_MODE || useSettings.getState().apiKey) void refreshAccount();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    console.error(err);
    root.render(<div style={{ padding: 32, fontFamily: 'system-ui' }}>Failed to load the endpoint catalog. Please reload the page.</div>);
  });
