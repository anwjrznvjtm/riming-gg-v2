/**
 * src/lib/riotPatch.ts
 * Fetches the latest patch version from Riot ddragon versions API.
 */

let cachedPatchVersion: string | null = null;

export async function fetchLatestPatchVersion(): Promise<string> {
  if (cachedPatchVersion) {
    return cachedPatchVersion;
  }

  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!res.ok) {
      throw new Error(`Failed to fetch versions: ${res.statusText}`);
    }
    const versions: string[] = await res.json();
    if (Array.isArray(versions) && versions.length > 0) {
      cachedPatchVersion = versions[0];
      return cachedPatchVersion;
    }
  } catch (error) {
    console.warn('Failed to fetch latest Riot patch version, using fallback:', error);
  }

  // Fallback to recent version if network or CORS error occurs
  return '15.14.1';
}
