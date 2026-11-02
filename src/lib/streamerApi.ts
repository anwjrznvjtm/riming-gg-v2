import { LineKey, Match, StreamerProfile, SoopLiveBroadcast, LiveStreamerMember, LINE_KEYS } from '../types';

export const SOOP_CLIENT_ID = '6746e3e1945b4cd93b1fba5fd28afc34';

// In-memory runtime cache for server-synchronized streamers (Single Source of Truth: server/streamers.json)
let _cachedStreamerProfiles: StreamerProfile[] | null = null;
let _activeFetchPromise: Promise<StreamerProfile[]> | null = null;

/**
 * Helper to sort streamer list with 우리밍_ first, then Korean alphabetical
 */
export function sortStreamerProfiles(list: StreamerProfile[]): StreamerProfile[] {
  return [...list].sort((a, b) => {
    if (a.name === '우리밍_' || a.name === '우리밍') return -1;
    if (b.name === '우리밍_' || b.name === '우리밍') return 1;
    return a.name.localeCompare(b.name, 'ko-KR');
  });
}

/**
 * Pure server fetch directly from backend DB API (GET /api/streamers)
 * Single Source of Truth: server/streamers.json (104 streamers)
 */
export async function fetchStreamersFromServer(forceRefresh = false): Promise<StreamerProfile[]> {
  if (!forceRefresh && _cachedStreamerProfiles && _cachedStreamerProfiles.length > 0) {
    return _cachedStreamerProfiles;
  }
  if (!forceRefresh && _activeFetchPromise) {
    return _activeFetchPromise;
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`/api/streamers?_t=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.streamers)) {
          const list: StreamerProfile[] = data.streamers
            .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
            .map((s: any) => ({
              name: s.name.trim(),
              soop_id: typeof s.soop_id === 'string' ? s.soop_id.trim() : '',
              main_position: s.main_position || 'mid',
              is_hidden: Boolean(s.is_hidden),
              updated_at: s.updated_at,
              memo: s.memo,
            }));

          const sorted = sortStreamerProfiles(list);
          _cachedStreamerProfiles = sorted;
          return sorted;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn('[StreamerApi] GET /api/streamers timed out after 8000ms');
      } else {
        console.warn('[StreamerApi] GET /api/streamers fetch warning:', err);
      }
    } finally {
      clearTimeout(timeoutId);
      if (_activeFetchPromise === fetchPromise) {
        _activeFetchPromise = null;
      }
    }

    return _cachedStreamerProfiles || [];
  })();

  _activeFetchPromise = fetchPromise;
  return fetchPromise;
}

/**
 * Synchronize streamer profiles from backend server storage (GET /api/streamers)
 */
export async function syncStreamersFromBackend(forceRefresh = false): Promise<StreamerProfile[]> {
  return fetchStreamersFromServer(forceRefresh);
}

/**
 * Synchronous getter: returns in-memory cached profiles directly from server sync.
 * Returns empty array if server DB response has not loaded yet (Never uses mock data).
 */
export function getStoredStreamerProfiles(): StreamerProfile[] {
  if (_cachedStreamerProfiles && _cachedStreamerProfiles.length > 0) {
    return _cachedStreamerProfiles;
  }
  fetchStreamersFromServer().catch(() => {});
  return _cachedStreamerProfiles || [];
}

/**
 * Save / Upsert a single streamer profile directly to backend server DB
 */
export function saveStreamerProfile(profile: StreamerProfile): StreamerProfile[] {
  return saveStreamerProfilesBatch([profile]);
}

/**
 * Batch Upsert multiple streamer profiles (updates in-memory cache + background server DB sync)
 */
export function saveStreamerProfilesBatch(newProfiles: StreamerProfile[]): StreamerProfile[] {
  const current = getStoredStreamerProfiles();
  const map = new Map<string, StreamerProfile>();
  for (const p of current) {
    map.set(p.name.toLowerCase().trim(), p);
  }

  const nowIso = new Date().toISOString();
  for (const np of newProfiles) {
    if (!np?.name?.trim()) continue;
    const key = np.name.toLowerCase().trim();
    const existing = map.get(key);
    map.set(key, {
      ...existing,
      ...np,
      name: np.name.trim(),
      soop_id: typeof np.soop_id === 'string' ? np.soop_id.trim() : (existing?.soop_id || '').trim(),
      main_position: np.main_position || existing?.main_position || 'mid',
      is_hidden: np.is_hidden !== undefined ? Boolean(np.is_hidden) : Boolean(existing?.is_hidden),
      updated_at: nowIso,
    });
  }

  const updatedList = sortStreamerProfiles(Array.from(map.values()));
  _cachedStreamerProfiles = updatedList;

  // Safe background append/update directly to DB server API
  fetch('/api/streamers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replace: false, streamers: newProfiles }),
  }).catch((err) => {
    console.warn('[StreamerApi] POST /api/streamers background sync warning:', err);
  });

  fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});

  return updatedList;
}

/**
 * Async Batch Upsert multiple streamer profiles with guaranteed server DB persistence & cache invalidation
 */
export async function saveStreamerProfilesBatchAsync(
  newProfiles: StreamerProfile[],
  options?: { replace?: boolean }
): Promise<StreamerProfile[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/streamers', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replace: Boolean(options?.replace),
        streamers: newProfiles,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streamers)) {
        const serverList = sortStreamerProfiles(data.streamers);
        _cachedStreamerProfiles = serverList;
        await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});
        return serverList;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[StreamerApi] POST /api/streamers timed out after 8000ms');
    } else {
      console.warn('[StreamerApi] saveStreamerProfilesBatchAsync server save failed:', err);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return saveStreamerProfilesBatch(newProfiles);
}

/**
 * Delete a streamer profile permanently from server DB
 */
export function deleteStreamerProfile(name: string): StreamerProfile[] {
  const cleanName = (name || '').trim();
  if (!cleanName) return getStoredStreamerProfiles();
  const key = cleanName.toLowerCase();

  const current = getStoredStreamerProfiles();
  const updatedList = current.filter((p) => p.name.toLowerCase().trim() !== key);
  _cachedStreamerProfiles = updatedList;

  // Dispatch delete directly to DB server API
  fetch('/api/streamers/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cleanName }),
  }).catch(() => {});

  fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});

  return updatedList;
}

export async function deleteStreamerProfileAsync(name: string): Promise<StreamerProfile[]> {
  const cleanName = (name || '').trim();
  if (!cleanName) return getStoredStreamerProfiles();
  const key = cleanName.toLowerCase();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/streamers/delete', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streamers)) {
        const serverList = sortStreamerProfiles(data.streamers);
        _cachedStreamerProfiles = serverList;
        await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});
        return serverList;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[StreamerApi] POST /api/streamers/delete timed out after 8000ms');
    } else {
      console.warn('[StreamerApi] deleteStreamerProfileAsync error:', err);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return deleteStreamerProfile(cleanName);
}

/**
 * Batch delete multiple streamer profiles permanently from server DB
 */
export async function deleteStreamersBatchAsync(names: string[]): Promise<StreamerProfile[]> {
  const cleanNames = names.map((n) => (n || '').trim()).filter(Boolean);
  if (cleanNames.length === 0) return getStoredStreamerProfiles();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/streamers/delete', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: cleanNames }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streamers)) {
        const serverList = sortStreamerProfiles(data.streamers);
        _cachedStreamerProfiles = serverList;
        await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});
        return serverList;
      }
    }
  } catch (err: any) {
    console.warn('[StreamerApi] deleteStreamersBatchAsync error:', err);
  } finally {
    clearTimeout(timeoutId);
  }

  const deleteSet = new Set(cleanNames.map((n) => n.toLowerCase()));
  const current = getStoredStreamerProfiles();
  const updated = current.filter((p) => !deleteSet.has(p.name.toLowerCase().trim()));
  _cachedStreamerProfiles = updated;
  return updated;
}

/**
 * Automatically inspect all matches and infer/upsert streamers into the profile database
 */
export function autoCollectStreamersFromMatches(
  matches: Match[],
  currentProfiles: StreamerProfile[]
): { updatedList: StreamerProfile[]; addedCount: number } {
  if (!Array.isArray(currentProfiles) || currentProfiles.length === 0) {
    return { updatedList: currentProfiles, addedCount: 0 };
  }

  const profileMap = new Map<string, StreamerProfile>();
  for (const p of currentProfiles) {
    profileMap.set(p.name.toLowerCase().trim(), p);
  }

  // Count position frequency for each streamer in matches
  const positionCounts = new Map<string, Record<LineKey, number>>();
  for (const m of matches) {
    for (const line of LINE_KEYS) {
      for (const roster of [m.team_a, m.team_b]) {
        const rawName = roster?.[line]?.trim();
        if (!rawName) continue;
        const normKey = rawName.toLowerCase();
        if (!positionCounts.has(normKey)) {
          positionCounts.set(normKey, { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 });
        }
        positionCounts.get(normKey)![line]++;
      }
    }
  }

  const newlyAdded: StreamerProfile[] = [];
  const nowIso = new Date().toISOString();

  for (const [normKey, counts] of positionCounts.entries()) {
    // Find most played position
    let bestLine: LineKey = 'mid';
    let maxPlayed = -1;
    for (const line of LINE_KEYS) {
      if (counts[line] > maxPlayed) {
        maxPlayed = counts[line];
        bestLine = line;
      }
    }

    // Find original display casing
    let displayName = normKey;
    for (const m of matches) {
      for (const line of LINE_KEYS) {
        if (m.team_a?.[line]?.toLowerCase().trim() === normKey) {
          displayName = m.team_a[line].trim();
          break;
        }
        if (m.team_b?.[line]?.toLowerCase().trim() === normKey) {
          displayName = m.team_b[line].trim();
          break;
        }
      }
    }

    const existing = profileMap.get(normKey);
    if (!existing) {
      const newEntry: StreamerProfile = {
        name: displayName,
        soop_id: '',
        main_position: bestLine,
        is_hidden: false,
        updated_at: nowIso,
      };
      profileMap.set(normKey, newEntry);
      newlyAdded.push(newEntry);
    }
  }

  if (newlyAdded.length > 0) {
    const updatedList = sortStreamerProfiles(Array.from(profileMap.values()));
    _cachedStreamerProfiles = updatedList;

    // Send only new streamers to DB server without overwriting existing
    fetch('/api/streamers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replace: false, streamers: newlyAdded }),
    }).catch(() => {});

    return { updatedList, addedCount: newlyAdded.length };
  }

  return { updatedList: currentProfiles, addedCount: 0 };
}

/**
 * Tidy and synchronize streamer profiles strictly based on CK Match database (Single Source of Truth).
 * - Extracts all valid streamer nicknames who have played in CK matches.
 * - Auto-infers their most frequent position.
 * - Retains streamers who have a configured SOOP ID (e.g. manual additions).
 * - Purges unreferenced ghost records (0 matches AND 0 SOOP ID).
 * - Persists directly to the backend DB with replace: true.
 */
export async function tidyStreamersFromMatches(
  matches: Match[],
  currentProfiles: StreamerProfile[]
): Promise<{
  updatedList: StreamerProfile[];
  addedCount: number;
  ghostCount: number;
}> {
  const profileMap = new Map<string, StreamerProfile>();
  for (const p of currentProfiles || []) {
    if (p?.name?.trim()) {
      profileMap.set(p.name.toLowerCase().trim(), p);
    }
  }

  // Count matches & positions for all streamers in CK database
  const matchPositionCounts = new Map<string, Record<LineKey, number>>();
  const matchDisplayNames = new Map<string, string>();

  for (const m of matches) {
    for (const line of LINE_KEYS) {
      for (const roster of [m.team_a, m.team_b]) {
        const rawName = roster?.[line]?.trim();
        if (!rawName) continue;
        const normKey = rawName.toLowerCase();
        if (!matchPositionCounts.has(normKey)) {
          matchPositionCounts.set(normKey, { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 });
          matchDisplayNames.set(normKey, rawName);
        }
        matchPositionCounts.get(normKey)![line]++;
      }
    }
  }

  let addedCount = 0;
  const nowIso = new Date().toISOString();

  // 1. Ensure all streamers with match history exist in the map
  for (const [normKey, counts] of matchPositionCounts.entries()) {
    let bestLine: LineKey = 'mid';
    let maxPlayed = -1;
    for (const line of LINE_KEYS) {
      if (counts[line] > maxPlayed) {
        maxPlayed = counts[line];
        bestLine = line;
      }
    }

    const displayName = matchDisplayNames.get(normKey) || normKey;
    const existing = profileMap.get(normKey);

    if (!existing) {
      profileMap.set(normKey, {
        name: displayName,
        soop_id: '',
        main_position: bestLine,
        is_hidden: false,
        updated_at: nowIso,
      });
      addedCount++;
    } else {
      profileMap.set(normKey, {
        ...existing,
        name: existing.name || displayName,
        soop_id: (existing.soop_id || '').trim(),
        main_position: existing.main_position || bestLine,
      });
    }
  }

  // 2. Identify & prune empty ghost entries: streamers with 0 matches AND no SOOP ID
  const cleaned: StreamerProfile[] = [];
  let ghostCount = 0;

  for (const [key, p] of profileMap.entries()) {
    const hasMatches = matchPositionCounts.has(key);
    const hasSoopId = Boolean(p.soop_id && p.soop_id.trim());
    const isWooriming = p.name === '우리밍_' || p.name === '우리밍';

    // Keep if: has matches OR has valid SOOP ID (manually added streamer) OR is benchmark streamer
    if (hasMatches || hasSoopId || isWooriming) {
      cleaned.push(p);
    } else {
      ghostCount++;
    }
  }

  const sorted = sortStreamerProfiles(cleaned);
  _cachedStreamerProfiles = sorted;

  // Persist directly to backend DB
  await saveStreamerProfilesBatchAsync(sorted, { replace: true });
  await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});

  return {
    updatedList: sorted,
    addedCount,
    ghostCount,
  };
}

/**
 * Fetch all live broadcasts from SOOP (숲TV)
 * Uses backend proxy /api/soop/live first, falls back to direct client-side openapi fetch
 */
export async function fetchSoopLiveBroadcasts(forceRefresh = false): Promise<{
  success: boolean;
  total_cnt: number;
  broad: SoopLiveBroadcast[];
  fetchedAt: Date;
  error?: string;
}> {
  // 1. Try Express backend proxy endpoint (/api/soop/live)
  try {
    const url = forceRefresh ? `/api/soop/live?force=true&_t=${Date.now()}` : '/api/soop/live';
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(forceRefresh ? { 'x-cache-bypass': 'true' } : {}),
      },
      cache: forceRefresh ? 'no-store' : 'default',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.broad)) {
        return {
          success: true,
          total_cnt: Number(data.total_cnt) || data.broad.length,
          broad: data.broad,
          fetchedAt: new Date(),
        };
      }
    }
  } catch (err) {
    console.warn('[StreamerApi] Backend /api/soop/live failed, trying direct SOOP API:', err);
  }

  // 2. Direct client-side fetch from SOOP OpenAPI
  try {
    const page1Url = `https://openapi.sooplive.co.kr/broad/list?client_id=${SOOP_CLIENT_ID}&page_no=1`;
    const res1 = await fetch(page1Url, { headers: { Accept: 'application/json' } });
    if (!res1.ok) {
      return {
        success: false,
        total_cnt: 0,
        broad: [],
        fetchedAt: new Date(),
        error: `SOOP API 응답 에러 (HTTP ${res1.status})`,
      };
    }
    const page1Data = await res1.json();
    const totalCount = Number(page1Data.total_cnt) || 0;
    const broadsPage1: SoopLiveBroadcast[] = page1Data.broad || [];

    const totalPages = Math.min(Math.ceil(totalCount / 60), 25);
    const promises: Promise<SoopLiveBroadcast[]>[] = [];

    for (let p = 2; p <= totalPages; p++) {
      promises.push(
        fetch(`https://openapi.sooplive.co.kr/broad/list?client_id=${SOOP_CLIENT_ID}&page_no=${p}`)
          .then((r) => r.json())
          .then((d) => (d.broad || []) as SoopLiveBroadcast[])
          .catch(() => [] as SoopLiveBroadcast[])
      );
    }

    const restPages = await Promise.all(promises);
    const allBroads = broadsPage1.concat(...restPages);

    return {
      success: true,
      total_cnt: totalCount,
      broad: allBroads,
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    return {
      success: false,
      total_cnt: 0,
      broad: [],
      fetchedAt: new Date(),
      error: err?.message || 'SOOP 라이브 목록을 불러오지 못했습니다.',
    };
  }
}

/**
 * Match registered CK streamer profiles with live broadcasts
 */
export function matchStreamersWithLiveBroadcasts(
  profiles: StreamerProfile[],
  liveBroadcasts: SoopLiveBroadcast[]
): {
  liveMembers: LiveStreamerMember[];
  offlineMembers: LiveStreamerMember[];
} {
  // Map live broadcasts by lowercase user_id
  const liveMapById = new Map<string, SoopLiveBroadcast>();
  const liveMapByNick = new Map<string, SoopLiveBroadcast>();

  for (const b of liveBroadcasts) {
    if (b.user_id) {
      liveMapById.set(b.user_id.toLowerCase().trim(), b);
    }
    if (b.user_nick) {
      liveMapByNick.set(b.user_nick.toLowerCase().replace(/\s+/g, ''), b);
    }
  }

  const liveMembers: LiveStreamerMember[] = [];
  const offlineMembers: LiveStreamerMember[] = [];

  for (const p of profiles) {
    const cleanId = (p.soop_id || '').toLowerCase().trim();
    const cleanName = p.name.toLowerCase().replace(/\s+/g, '').replace(/_$/, '');

    let matchedLive: SoopLiveBroadcast | undefined;
    if (cleanId && liveMapById.has(cleanId)) {
      matchedLive = liveMapById.get(cleanId);
    } else if (cleanName && liveMapByNick.has(cleanName)) {
      matchedLive = liveMapByNick.get(cleanName);
    }

    // If streamer is marked as hidden, completely exclude them from LIVE listings
    if (p.is_hidden) {
      offlineMembers.push({
        profile: p,
        isLive: false,
      });
      continue;
    }

    if (matchedLive) {
      liveMembers.push({
        profile: p,
        live: matchedLive,
        isLive: true,
      });
    } else {
      offlineMembers.push({
        profile: p,
        isLive: false,
      });
    }
  }

  // Sort live members: 우리밍_ first, then by viewer count descending
  liveMembers.sort((a, b) => {
    if (a.profile.name === '우리밍_' || a.profile.name === '우리밍') return -1;
    if (b.profile.name === '우리밍_' || b.profile.name === '우리밍') return 1;
    const viewA = parseInt(String(a.live?.total_view_cnt || 0), 10) || 0;
    const viewB = parseInt(String(b.live?.total_view_cnt || 0), 10) || 0;
    return viewB - viewA;
  });

  return { liveMembers, offlineMembers };
}

// Automatically initiate first sync in browser environment
if (typeof window !== 'undefined') {
  fetchStreamersFromServer().catch(() => {});
}
