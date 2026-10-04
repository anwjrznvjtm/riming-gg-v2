/**
 * src/lib/riotPatch.ts
 * Fetches the latest patch versions from Riot Data Dragon API:
 * https://ddragon.leagueoflegends.com/api/versions.json
 */

let cachedPatchVersion: string = '16.18.1';
let cachedVersionList: string[] = ['16.18.1', '16.17.1', '16.16.1', '16.15.1', '16.14.1', '15.1.1'];
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
    if (saved) {
      cachedPatchVersion = saved;
      return saved;
    }
  } catch {
    // ignore
  }
  return cachedPatchVersion;
}

export function getCachedPatchList(): string[] {
  return cachedVersionList;
}

export function formatPatchDisplay(versionStr: string): string {
  if (!versionStr) return '16.18';
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
      cachedVersionList = versions.slice(0, 8);
      const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem('riming_selected_patch') : null;
      if (!saved) {
        cachedPatchVersion = versions[0];
      } else {
        cachedPatchVersion = saved;
      }
      patchListeners.forEach((fn) => fn(cachedPatchVersion));
      return cachedPatchVersion;
    }
  } catch (error) {
    console.warn('Failed to fetch latest Riot patch version, using fallback:', error);
  }

  return cachedPatchVersion;
}
