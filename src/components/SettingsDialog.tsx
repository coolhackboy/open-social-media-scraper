import { Check, Eye, EyeOff, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { MOCK_MODE } from '../lib/api';
import { refreshAccount } from '../lib/runner';
import { normalizeApiBase, toast, useAccount, useSettings } from '../lib/store';
import { useUI } from '../lib/ui';
import { Badge, Button, Dialog, Label, Segmented, Toggle } from '../ui';

export function SettingsDialog() {
  const { settingsOpen, settingsFocus, closeSettings } = useUI();
  return (
    <Dialog open={settingsOpen} onClose={closeSettings} title="Settings" width={560}>
      {settingsOpen && <SettingsBody focusKey={settingsFocus === 'key'} onDone={closeSettings} />}
    </Dialog>
  );
}

function SettingsBody({ focusKey, onDone }: { focusKey: boolean; onDone(): void }) {
  const s = useSettings();
  const account = useAccount();
  const [key, setKey] = useState(s.apiKey);
  const [show, setShow] = useState(false);
  const [base, setBase] = useState(s.apiBase);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusKey) keyRef.current?.focus();
  }, [focusKey]);

  const baseInvalid = normalizeApiBase(base) === null;

  const saveKey = () => {
    if (baseInvalid) return;
    s.setApiKey(key);
    if (base.trim() !== s.apiBase) s.setApiBase(base);
    if (key.trim()) {
      void refreshAccount();
      toast('API key saved in this browser', 'ok');
      onDone();
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-[13px] font-semibold">SocQ API key</h3>
        {MOCK_MODE && (
          <p className="mb-3 rounded-md border border-dashed border-accent-line bg-accent-soft px-3 py-2 text-[12.5px] text-accent-ink">
            Demo mode is on (<code>?mock=1</code>). Requests return the documented example responses and never reach the API.
          </p>
        )}
        <Label htmlFor="api-key" hint={s.apiKey ? <Badge tone="ok"><Check className="size-3" /> saved</Badge> : undefined}>
          Key
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={keyRef}
              id="api-key"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              className="field pr-9 font-mono text-[12.5px]"
              placeholder="Paste your SocQ API key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            />
            <button
              type="button"
              aria-label={show ? 'Hide key' : 'Show key'}
              onClick={() => setShow((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-subtle hover:text-fg"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button variant="primary" onClick={saveKey} disabled={baseInvalid || !key.trim() || (key.trim() === s.apiKey && base.trim() === s.apiBase)}>
            Save
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <a href={config.provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
            Get a key at socq.ai <ExternalLink className="size-3" />
          </a>
          {s.apiKey && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => {
                s.forgetKey();
                setKey('');
                useAccount.getState().set({ credits: null, email: null, status: 'idle' });
                toast('Key removed from this browser');
              }}
            >
              Forget key
            </Button>
          )}
        </div>
        {s.apiKey && account.status === 'ok' && account.credits !== null && (
          <p className="mt-2 text-[12.5px] text-fg-muted">
            Balance: <span className="tabular font-medium text-fg">{account.credits.toLocaleString(undefined, { maximumFractionDigits: 3 })} credits</span>
            {account.email ? ` · ${account.email}` : ''}
          </p>
        )}
        {s.apiKey && account.status === 'error' && <p className="mt-2 text-[12.5px] text-bad">{account.error}</p>}
        <p className="mt-3 flex gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
          The key is stored only in this browser&apos;s localStorage and sent only to {s.apiBase} over HTTPS. It is never part of the build
          and never appears in &ldquo;Copy as&rdquo; snippets. Use &ldquo;Forget key&rdquo; on shared computers.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">Appearance</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-fg-muted">Theme</span>
          <Segmented
            label="Theme"
            value={s.theme}
            onChange={s.setTheme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px]">Load media previews</div>
            <p className="text-[12px] text-fg-subtle">
              Show avatars and thumbnails from the platforms&apos; image servers. Off by default: the page then makes no requests except to the API.
              {MOCK_MODE ? ' Always off in demo mode.' : ''}
            </p>
          </div>
          <Toggle label="Load media previews" checked={s.remoteMedia && !MOCK_MODE} onChange={(v) => !MOCK_MODE && s.setRemoteMedia(v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">API base URL</h3>
        <input
          className="field font-mono text-[12.5px]"
          value={base}
          spellCheck={false}
          onChange={(e) => setBase(e.target.value)}
          onBlur={() => !baseInvalid && base.trim() !== s.apiBase && s.setApiBase(base)}
          aria-label="API base URL"
          aria-invalid={baseInvalid}
        />
        {baseInvalid ? (
          <p className="mt-1 text-[12px] text-bad">Use an https:// URL (plain http is allowed only for localhost). Your key is sent to this address.</p>
        ) : (
          <p className="mt-1 text-[12px] text-fg-subtle">
            Default {config.defaultApiBase}. Point it at any gateway that speaks the same API. Your key is sent to this address.
          </p>
        )}
      </section>
    </div>
  );
}
