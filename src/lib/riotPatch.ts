/**
 * src/lib/riotPatch.ts
 * Fetches the latest patch versions from Riot Data Dragon API:
 * https://ddragon.leagueoflegends.com/api/versions.json
 */

let cachedPatchVersion: string = '15.1.1';
let cachedVersionList: string[] = ['15.1.1', '14.24.1', '14.23.1', '14.22.1'];
const patchListeners: Array<(v: string) => void> = [];

export function subscribePatchVersion(cb: (v: string) => void) {
  patchListeners.push(cb);
  return () => {
    const idx = patchListeners.indexOf(cb);
    if (idx !== -1) patchListeners.splice(idx, 1);
  };
}

export function setActivePatch(version: string) {
  cachedPatchVersion = version;
  try {
    localStorage.setItem('riming_selected_patch', version);
  } catch {
    // ignore
  }
  patchListeners.forEach((fn) => fn(version));
}

export function getActivePatch(): string {
  try {
    const saved = localStorage.getItem('riming_selected_patch');
    if (saved) return saved;
  } catch {
    // ignore
  }
  return cachedPatchVersion;
}

export function getCachedPatchList(): string[] {
  return cachedVersionList;
}

export function formatPatchDisplay(versionStr: string): string {
  if (!versionStr) return '15.1';
  const parts = versionStr.split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return versionStr;
}

export async function fetchLatestPatchVersion(): Promise<string> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!res.ok) {
      throw new Error(`Failed to fetch versions: ${res.statusText}`);
    }
    const versions: string[] = await res.json();
    if (Array.isArray(versions) && versions.length > 0) {
      cachedVersionList = versions.slice(0, 6);
      cachedPatchVersion = versions[0];
      return cachedPatchVersion;
    }
  } catch (error) {
    console.warn('Failed to fetch latest Riot patch version, using fallback:', error);
  }

  return cachedPatchVersion;
}
