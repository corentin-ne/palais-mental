/**
 * New versions: the app is installed from GitHub releases (an APK), so it asks GitHub at launch whether a
 * newer release is out and offers to download it. Releases are signed with the same key every time
 * (`signing/`), so the new APK installs over this one and the library stays.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const REPO = 'corentin-ne/palais-mental';

export interface Update {
  version: string;
  current: string;
  /** The APK itself, else the release page. */
  url: string;
  page: string;
}

/** "v1.4.2" or "1.4.2" → [1, 4, 2]; anything after "-" (pre-releases) is ignored. */
const parts = (v: string) =>
  v
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => Number(n) || 0);

/** True when `a` is a later version than `b`. */
export function isNewer(a: string, b: string) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** The latest release when it is newer than this install (Android only: that is what releases carry). */
export async function checkForUpdate(): Promise<Update | undefined> {
  if (Platform.OS !== 'android' || __DEV__) return undefined;
  const current = Constants.expoConfig?.version;
  if (!current) return undefined;
  try {
    // `latest` skips drafts and pre-releases.
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return undefined;
    const release: { tag_name?: string; html_url?: string; assets?: { name?: string; browser_download_url?: string }[] } = await r.json();
    const version = release.tag_name?.replace(/^v/i, '');
    if (!version || !isNewer(version, current)) return undefined;
    const apk = release.assets?.find((a) => a.name?.endsWith('.apk'))?.browser_download_url;
    const page = release.html_url ?? `https://github.com/${REPO}/releases/latest`;
    return { version, current, url: apk ?? page, page };
  } catch {
    // Offline: ask again next launch.
    return undefined;
  }
}
