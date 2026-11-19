import clsx from 'clsx';
import { Coins, FlaskConical, History, KeyRound, LayoutTemplate, Moon, Radar, Settings, Sun, TerminalSquare } from 'lucide-react';
import { config } from '../config';
import { getCatalog } from '../data/catalog';
import { MOCK_MODE } from '../lib/api';
import { fmtCredits } from '../lib/cost';
import { navigate, useRoute, type View } from '../lib/router';
import { useAccount, useSettings } from '../lib/store';
import { useUI } from '../lib/ui';
import { IconButton, Spinner } from '../ui';
import { BrandMark } from './marks';

const NAV: { view: View; label: string; icon: typeof Radar }[] = [
  { view: 'console', label: 'Scraper', icon: TerminalSquare },
  { view: 'listening', label: 'Listening', icon: Radar },
  { view: 'templates', label: 'Templates', icon: LayoutTemplate },
  { view: 'history', label: 'History', icon: History },
];

function Credits() {
  const apiKey = useSettings((s) => s.apiKey);
  const { credits, status, demo, error } = useAccount();
  const openSettings = useUI((s) => s.openSettings);
  if (MOCK_MODE || demo) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-accent-line bg-accent-soft px-2.5 text-[12.5px] font-medium text-accent-ink">
        <FlaskConical className="size-3.5" />
        <span className="hidden sm:inline">Demo mode · no credits used</span>
        <span className="sm:hidden">Demo</span>
      </span>
    );
  }
  if (!apiKey) {
    return (
      <button
        type="button"
        onClick={() => openSettings('key')}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-strong px-2.5 text-[12.5px] font-medium text-accent-fg hover:bg-accent-hover"
      >
        <KeyRound className="size-3.5" />
        Add API key
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openSettings()}
      title={status === 'error' ? error : 'SocQ credit balance'}
      className={clsx(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium',
        status === 'error' ? 'border-bad/40 bg-bad-soft text-bad' : 'border-line bg-surface text-fg hover:bg-surface-2',
      )}
    >
      {status === 'loading' && credits === null ? <Spinner className="size-3.5" /> : <Coins className="size-3.5 text-accent" />}
      {status === 'error' ? 'Key error' : credits === null ? '…' : <span className="tabular">{fmtCredits(Number(credits.toFixed(2)))} credits</span>}
    </button>
  );
}

export function Header() {
  const route = useRoute();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const openSettings = useUI((s) => s.openSettings);
  return (
    <header className="z-20 shrink-0 border-b border-line bg-surface">
      <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
        <a href="#/console" className="mr-2 flex min-w-0 items-center gap-2" aria-label={`${config.brandName} home`}>
          <BrandMark className="size-7 shrink-0" />
          <span className="truncate text-[14.5px] font-semibold tracking-tight">{config.brandName}</span>
        </a>
        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.view} {...n} active={route.view === n.view} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Credits />
          <IconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <IconButton label="Settings" onClick={() => openSettings()}>
            <Settings className="size-4" />
          </IconButton>
        </div>
      </div>
      <nav aria-label="Main" className="scroll-thin flex gap-0.5 overflow-x-auto border-t border-line px-2 py-1 md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.view} {...n} active={route.view === n.view} />
        ))}
      </nav>
    </header>
  );
}

function NavLink({ view, label, icon: Icon, active }: { view: View; label: string; icon: typeof Radar; active: boolean }) {
  return (
    <a
      href={`#/${view}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        navigate(view);
      }}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
        active ? 'bg-accent-soft text-accent-ink' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon className="size-4" />
      {label}
    </a>
  );
}

export function StatusBar() {
  const c = getCatalog();
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-4 py-1.5 text-[11.5px] text-fg-subtle">
      <span className="tabular hidden sm:inline">
        {c.counts.endpoints} endpoints · {c.counts.platforms} platforms · catalog {c.generatedAt.slice(0, 10)}
      </span>
      <span className="flex items-center gap-4 sm:ml-auto">
        <a href={config.repoUrl} target="_blank" rel="noreferrer" className="hover:text-fg">
          Open source · MIT
        </a>
        {config.showPoweredBy && (
          <a href={config.provider.homeUrl} target="_blank" rel="noreferrer" className="hover:text-fg">
            Powered by {config.provider.name}
          </a>
        )}
      </span>
    </footer>
  );
}
