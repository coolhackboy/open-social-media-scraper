/**
 * Visual marks: the app logo, platform monograms (no third-party logos), avatars and media
 * thumbnails. Remote images load only when the user enables "Load media previews"; otherwise
 * a local placeholder is drawn, so the page makes no requests to platform CDNs.
 */
import clsx from 'clsx';
import { Image as ImageIcon, Play, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { config } from '../config';
import { platformTitle } from '../data/catalog';
import { platformHue, useRemoteMedia } from '../lib/visual';

export function BrandMark({ className }: { className?: string }) {
  if (config.brandLogoUrl) return <img src={config.brandLogoUrl} alt="" className={clsx('rounded-md object-contain', className)} />;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 22.5h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
      <path d="M9 17.5h9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
      <path d="M9 12.5h5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="21.5" cy="11.5" r="3.6" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="m24.2 14.2 2.3 2.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const MONO: Record<string, string> = {
  tiktok: 'TT',
  x: 'X',
  instagram: 'IG',
  youtube: 'YT',
  reddit: 'RD',
  linkedin: 'IN',
  facebook: 'FB',
  threads: 'TH',
  pinterest: 'PI',
  bluesky: 'BS',
  snapchat: 'SC',
  twitch: 'TW',
  telegram: 'TG',
  douyin: 'DY',
  rednote: 'RN',
  kwai: 'KW',
  amazon: 'AZ',
  seo: 'SEO',
  creator: 'CR',
  'ai-search': 'AI',
  'truth-social': 'TS',
  'link-in-bio': 'LB',
  'apple-app-store': 'AS',
  'google-play': 'GP',
  'google-maps': 'GM',
  'google-hotels': 'GH',
  'google-ad-library': 'GA',
  'facebook-ad-library': 'FA',
  'facebook-marketplace': 'FM',
  'linkedin-ad-library': 'LA',
  'tiktok-ad-library': 'TA',
  'tiktok-shop': 'TS',
  'tiktok-creative-center': 'TC',
  'brand-monitoring': 'BM',
};

export function PlatformMark({ platform, size = 'md', className }: { platform: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const hue = platformHue(platform);
  const mono = MONO[platform] ?? platform.slice(0, 2).toUpperCase();
  return (
    <span
      title={platformTitle(platform)}
      aria-hidden="true"
      style={{
        background: `hsl(${hue} 70% 50% / 0.13)`,
        color: `hsl(${hue} 65% var(--mark-l, 34%))`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 60% 50% / 0.25)`,
      }}
      className={clsx(
        'mark inline-flex shrink-0 items-center justify-center rounded-[5px] font-mono font-semibold tracking-tight',
        size === 'sm' && 'h-[18px] min-w-[22px] px-0.5 text-[9.5px]',
        size === 'md' && 'h-[22px] min-w-[26px] px-1 text-[10.5px]',
        size === 'lg' && 'h-8 min-w-9 px-1.5 text-[12.5px]',
        className,
      )}
    >
      {mono}
    </span>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 33 + c.charCodeAt(0)) % 360;
  return h;
}

function RemoteImg({ src, className, fallback }: { src: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={className} />;
}

export function Avatar({ name, src, size = 28 }: { name: string | null; src?: string | null; size?: number }) {
  const remote = useRemoteMedia();
  const label = (name ?? '?').replace(/^@/, '');
  const initials = label.slice(0, 2).toUpperCase();
  const hue = hashHue(label);
  const fallback = (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: `hsl(${hue} 45% 55% / 0.18)`, color: `hsl(${hue} 50% var(--mark-l, 34%))`, fontSize: size * 0.38 }}
      className="mark inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {name ? initials : <UserRound className="size-[55%]" />}
    </span>
  );
  if (!remote || !src) return fallback;
  return (
    <span style={{ width: size, height: size }} className="inline-flex shrink-0 overflow-hidden rounded-full bg-surface-2">
      <RemoteImg src={src} className="size-full object-cover" fallback={fallback} />
    </span>
  );
}

export function MediaThumb({
  type,
  src,
  seed,
  platform,
  duration,
  className,
}: {
  type: string;
  src: string | null;
  seed: string;
  platform: string;
  duration?: number | null;
  className?: string;
}) {
  const remote = useRemoteMedia();
  const hue = platformHue(platform);
  const shift = hashHue(seed) % 40;
  const video = /video|reel|short|live/i.test(type);
  const placeholder = (
    <div
      className="flex size-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue + shift} 55% 62% / 0.22), hsl(${hue - shift} 50% 50% / 0.1)), repeating-linear-gradient(45deg, transparent 0 9px, hsl(${hue} 40% 50% / 0.06) 9px 10px)`,
      }}
    >
      <span className="mark inline-flex size-9 items-center justify-center rounded-full bg-surface/80" style={{ color: `hsl(${hue} 60% var(--mark-l, 34%))` }}>
        {video ? <Play className="size-4 translate-x-px" /> : <ImageIcon className="size-4" />}
      </span>
    </div>
  );
  return (
    <div className={clsx('relative overflow-hidden bg-surface-2', className)}>
      {remote && src ? <RemoteImg src={src} className="size-full object-cover" fallback={placeholder} /> : placeholder}
      {duration ? (
        <span className="absolute right-1.5 bottom-1.5 rounded bg-[rgb(20_18_16/0.72)] px-1 font-mono text-[10.5px] text-white">
          {Math.floor(duration / 60)}:{String(Math.round(duration % 60)).padStart(2, '0')}
        </span>
      ) : null}
    </div>
  );
}
