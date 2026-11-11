import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

// GitHub repo that hosts releases (latest release must contain an .apk asset)
const REPO = 'Aqeel201/skardu-ride';

const parseVer = (v) =>
  String(v || '0')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);

const isNewer = (remote, local) => {
  const a = parseVer(remote);
  const b = parseVer(local);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
};

export const currentVersion = () => Application.nativeApplicationVersion || '0.0.0';

export async function checkForUpdate() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error('Update check failed');
  const rel = await res.json();
  const asset = (rel.assets || []).find((a) => /\.apk$/i.test(a.name));
  const version = rel.tag_name;
  return {
    available: !!asset && isNewer(version, currentVersion()),
    version,
    notes: rel.body || '',
    url: asset?.browser_download_url,
    size: asset?.size,
  };
}

export async function downloadAndInstall(url, onProgress) {
  if (Platform.OS !== 'android') throw new Error('Android only');
  const dest = FileSystem.cacheDirectory + 'SkarduRide-update.apk';
  await FileSystem.deleteAsync(dest, { idempotent: true });
  const dl = FileSystem.createDownloadResumable(url, dest, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const result = await dl.downloadAsync();
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1 | 268435456, // GRANT_READ_URI_PERMISSION | NEW_TASK
    type: 'application/vnd.android.package-archive',
  });
}
