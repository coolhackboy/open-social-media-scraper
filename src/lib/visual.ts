import { MOCK_MODE } from './api';
import { useSettings } from './store';

/** Hue per platform family; ad libraries / shops share their parent's hue. */
const HUE: Record<string, number> = {
  tiktok: 186,
  x: 220,
  instagram: 322,
  youtube: 2,
  reddit: 18,
  linkedin: 206,
  facebook: 222,
  threads: 260,
  pinterest: 350,
  bluesky: 205,
  snapchat: 52,
  twitch: 268,
  telegram: 199,
  douyin: 300,
  rednote: 356,
  kwai: 30,
  amazon: 36,
  seo: 150,
  creator: 280,
  'ai-search': 168,
  google: 140,
  'truth-social': 230,
  'link-in-bio': 96,
  apple: 210,
  brand: 40,
};

export function platformHue(id: string): number {
  if (HUE[id] !== undefined) return HUE[id];
  const family = Object.keys(HUE).find((k) => id.startsWith(`${k}-`));
  if (family) return HUE[family];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function useRemoteMedia(): boolean {
  const on = useSettings((s) => s.remoteMedia);
  return on && !MOCK_MODE;
}

