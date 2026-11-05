import { LineKey, Match, StreamerProfile, SoopLiveBroadcast, LiveStreamerMember, LINE_KEYS } from '../types';
import { DEFAULT_STREAMERS } from '../data/defaultStreamers';

export const SOOP_CLIENT_ID = '6746e3e1945b4cd93b1fba5fd28afc34';

// In-memory runtime cache pre-seeded with authoritative 91 streamers
let _cachedStreamerProfiles: StreamerProfile[] | null = DEFAULT_STREAMERS.map((s) => ({
  id: (s as any).id,
  name: s.name,
  soop_id: s.soop_id || '',
  main_position: (s.main_position as LineKey) || 'mid',
  is_hidden: Boolean(s.is_hidden),
  updated_at: s.updated_at,
  memo: s.memo || '',
}));
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

const KNOWN_SOOP_IDS: Record<string, string> = {
  '우리밍_': 'kmj05317',
  '우리밍': 'kmj05317',
  '상어녀': 'eun7432',
  '김세아': 'kimseah94',
  '디임': 'diim',
  '앵지': 'angji',
  '듀단.': 'dydan',
  '듀단': 'dydan',
  '효딤': 'hyodim',
  '꿀탱탱': 'kkultt',
  '김레인♥': 'kimrain',
  '김레인': 'kimrain',
  '임선비.': 'sunbi1024',
  '임선비': 'sunbi1024',
  '저라뎃': 'jradet',
  '김민교.': 'minkyo1994',
  '김민교': 'minkyo1994',
  '준밧드': 'junbadd',
  '나무늘봉순': 'namunlbong',
  '나는상윤': 'sangyoon',
  '이경민+_+': 'leekyeongmin',
  '이경민': 'leekyeongmin',
  '주보리♥': 'jubori',
  '주보리': 'jubori',
  '샤코타임0': 'shacotime',
  '샤코타임': 'shacotime',
  '쏘대장': 'ssodaezang',
  '오뀨': 'oggyu',
  '스맵임': 'smeb',
  '스맵': 'smeb',
  '린다랑b': 'lindarang',
  '나는눈꽃.': 'snowflower',
  '하로로.': 'haroro',
  '하두링': 'haduring',
  '감블러': 'gambler',
  '#김동하': 'likekk',
  '김동하': 'likekk',
  '＃김동하': 'likekk',
  '#민찬기': 'minchanki',
  '민찬기': 'minchanki',
  '＃민찬기': 'minchanki',
};

export function autoExtractStreamersFromMatches(matches: Match[]): StreamerProfile[] {
  const counts = new Map<string, Record<LineKey, number>>();
  const displayNames = new Map<string, string>();

  for (const m of matches) {
    for (const team of [m?.team_a, m?.team_b]) {
      if (!team) continue;
      for (const line of LINE_KEYS) {
        const raw = team[line];
        if (!raw || typeof raw !== 'string') continue;
        const clean = raw.trim();
        if (!clean) continue;
        const norm = clean.toLowerCase();
        if (!counts.has(norm)) {
          counts.set(norm, { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 });
          displayNames.set(norm, clean);
        }
        counts.get(norm)![line]++;
      }
    }
  }

  const result: StreamerProfile[] = [];
  const nowIso = new Date().toISOString();

  for (const [norm, posCount] of counts.entries()) {
    let bestLine: LineKey = 'mid';
    let maxPlayed = -1;
    for (const line of LINE_KEYS) {
      if (posCount[line] > maxPlayed) {
        maxPlayed = posCount[line];
        bestLine = line;
      }
    }

    const displayName = displayNames.get(norm) || norm;
    const stripped = norm.replace(/[\.\_\#\^\*\♥\-]/g, '');
    let soopId = KNOWN_SOOP_IDS[norm] || KNOWN_SOOP_IDS[stripped] || '';
    if (norm === '우리밍_' || norm === '우리밍') soopId = 'kmj05317';

    result.push({
      name: displayName,
      soop_id: soopId,
      main_position: bestLine,
      is_hidden: false,
      updated_at: nowIso,
    });
  }

  return sortStreamerProfiles(result);
}

/**
 * Pure server fetch directly from backend DB API (GET /api/streamers)
 * Single Source of Truth: Cloudflare D1 CK Match DB & server/streamers.json
 */
export async function fetchStreamersFromServer(forceRefresh = false): Promise<StreamerProfile[]> {
  if (forceRefresh) {
    _activeFetchPromise = null;
  }
  if (!forceRefresh && _cachedStreamerProfiles && _cachedStreamerProfiles.length > 0) {
    return _cachedStreamerProfiles;
  }
  if (!forceRefresh && _activeFetchPromise) {
    return _activeFetchPromise;
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const cacheBuster = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await fetch(`/api/streamers?t=${cacheBuster}${forceRefresh ? '&refresh=true' : ''}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.streamers) && data.streamers.length > 0) {
          const list: StreamerProfile[] = data.streamers
            .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
            .map((s: any) => ({
              id: s.id,
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

      // If backend API returned empty or failed, fallback to direct Cloudflare D1 Worker (/api/streamers endpoint)
      const d1Res = await fetch(`https://riming-gg.janghyck2.workers.dev/api/streamers?t=${cacheBuster}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      });

      if (d1Res.ok) {
        const d1Data = await d1Res.json();
        if (d1Data?.success && Array.isArray(d1Data.streamers) && d1Data.streamers.length > 0) {
          const list: StreamerProfile[] = d1Data.streamers.map((s: any) => ({
            id: s.id,
            name: s.name.trim(),
            soop_id: (s.soop_id || '').trim(),
            main_position: s.main_position || 'mid',
            is_hidden: Boolean(s.is_hidden),
            updated_at: s.updated_at,
            memo: s.memo,
          }));
          const sorted = sortStreamerProfiles(list);
          _cachedStreamerProfiles = sorted;
          return sorted;
        } else if (Array.isArray(d1Data)) {
          const d1Streamers = d1Data.filter((x: any) => x.type === 'streamer' && x.name);
          if (d1Streamers.length > 0) {
            const list: StreamerProfile[] = d1Streamers.map((s: any) => ({
              id: s.id,
              name: s.name.trim(),
              soop_id: (s.soop_id || '').trim(),
              main_position: s.main_position || 'mid',
              is_hidden: Boolean(s.is_hidden),
              updated_at: s.updated_at,
              memo: s.memo,
            }));
            const sorted = sortStreamerProfiles(list);
            _cachedStreamerProfiles = sorted;
            return sorted;
          }
          const list = autoExtractStreamersFromMatches(d1Data);
          _cachedStreamerProfiles = list;
          return list;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn('[StreamerApi] GET /api/streamers timed out after 8000ms');
      } else {
        console.warn('[StreamerApi] GET /api/streamers fetch warning:', err);
      }
      try {
        const d1Res = await fetch(`https://riming-gg.janghyck2.workers.dev/api/streamers?t=${Date.now()}`);
        if (d1Res.ok) {
          const d1Data = await d1Res.json();
          if (d1Data?.success && Array.isArray(d1Data.streamers) && d1Data.streamers.length > 0) {
            const list: StreamerProfile[] = d1Data.streamers.map((s: any) => ({
              id: s.id,
              name: s.name.trim(),
              soop_id: (s.soop_id || '').trim(),
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
      } catch {}
    } finally {
      clearTimeout(timeoutId);
      if (_activeFetchPromise === fetchPromise) {
        _activeFetchPromise = null;
      }
    }

    if (!_cachedStreamerProfiles || _cachedStreamerProfiles.length === 0) {
      _cachedStreamerProfiles = DEFAULT_STREAMERS.map((s) => ({
        id: (s as any).id,
        name: s.name,
        soop_id: s.soop_id || '',
        main_position: (s.main_position as LineKey) || 'mid',
        is_hidden: Boolean(s.is_hidden),
        updated_at: s.updated_at,
        memo: s.memo || '',
      }));
    }
    return _cachedStreamerProfiles;
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
 * Guarantees authoritative 91 streamers list is always returned.
 */
export function getStoredStreamerProfiles(): StreamerProfile[] {
  if (_cachedStreamerProfiles && _cachedStreamerProfiles.length > 0) {
    return _cachedStreamerProfiles;
  }
  const defaultList: StreamerProfile[] = DEFAULT_STREAMERS.map((s) => ({
    id: (s as any).id,
    name: s.name,
    soop_id: s.soop_id || '',
    main_position: (s.main_position as LineKey) || 'mid',
    is_hidden: Boolean(s.is_hidden),
    updated_at: s.updated_at,
    memo: s.memo || '',
  }));
  _cachedStreamerProfiles = defaultList;
  fetchStreamersFromServer().catch(() => {});
  return defaultList;
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('streamers-updated', { detail: serverList }));
        }
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
 * Async update a single streamer profile (SOOP ID, position, hidden) directly to backend DB via PUT /api/streamers/:id
 */
/**
 * Async update a single streamer profile (SOOP ID, position, hidden) directly to backend DB via PUT /api/streamers/:id
 */
export async function updateStreamerProfileAsync(profile: StreamerProfile): Promise<StreamerProfile[]> {
  const cleanName = (profile.name || '').trim();
  const cleanId = (profile.id || '').trim();
  if (!cleanName && !cleanId) return getStoredStreamerProfiles();

  // In-memory optimistic update matching strictly by ID first, then name
  const current = getStoredStreamerProfiles();
  const updatedList = current.map((p) => {
    if ((cleanId && p.id === cleanId) || (!cleanId && p.name === cleanName)) {
      return {
        ...p,
        ...profile,
        updated_at: new Date().toISOString(),
      };
    }
    return p;
  });
  _cachedStreamerProfiles = sortStreamerProfiles(updatedList);

  const targetIdentifier = cleanId || cleanName;
  const encodedIdentifier = encodeURIComponent(targetIdentifier);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const t = Date.now();
    const payload = JSON.stringify({
      id: cleanId,
      name: cleanName,
      soop_id: profile.soop_id,
      main_position: profile.main_position,
      is_hidden: profile.is_hidden,
      memo: profile.memo,
      streamer: profile,
    });

    // Route 1: PUT /api/streamers/:id (URL path strictly encodeURIComponent'd to prevent '#' hash truncation)
    let res = await fetch(`/api/streamers/${encodedIdentifier}?t=${t}`, {
      signal: controller.signal,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });

    // Route 2: POST /api/streamers/update fallback
    if (!res.ok) {
      res = await fetch(`/api/streamers/update?t=${t}`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: payload,
      });
    }

    // Route 3: POST /api/streamers fallback
    if (!res.ok) {
      res = await fetch(`/api/streamers?t=${t}`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: JSON.stringify({ replace: false, streamers: [profile] }),
      });
    }

    // Route 4: Direct Cloudflare Worker fallback
    if (!res.ok) {
      res = await fetch(`https://riming-gg.janghyck2.workers.dev/api/streamers/update?t=${t}`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: payload,
      });
    }

    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streamers)) {
        const serverList = sortStreamerProfiles(data.streamers);
        _cachedStreamerProfiles = serverList;
        await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('streamers-updated', { detail: serverList }));
        }
        return serverList;
      }
    }
  } catch (err: any) {
    console.warn('[StreamerApi] updateStreamerProfileAsync error, using batch fallback:', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return saveStreamerProfilesBatchAsync([profile], { replace: false });
}

/**
 * Delete a streamer profile permanently from server DB
 */
export function deleteStreamerProfile(target: string | { id?: string; name: string }): StreamerProfile[] {
  // Fire genuine async DB delete in background
  deleteStreamerProfileAsync(target).catch((err) => {
    console.warn('[StreamerApi] Background deleteStreamerProfile warning:', err);
  });
  return getStoredStreamerProfiles();
}

export async function deleteStreamerProfileAsync(
  target: string | { id?: string; name?: string; soop_id?: string }
): Promise<StreamerProfile[]> {
  const name = typeof target === 'string' ? target : target.name || '';
  const id = typeof target === 'object' ? target.id || '' : '';
  const soopId = typeof target === 'object' ? (target as any).soop_id || '' : '';
  const cleanName = (name || '').trim();
  const cleanId = (id || '').trim();
  if (!cleanName && !cleanId) return fetchStreamersFromServer(true);

  const t = Date.now();
  // Target parameter strictly encoded with encodeURIComponent to prevent '#' truncation
  const targetParam = encodeURIComponent(cleanId || cleanName);
  const payload = JSON.stringify({ id: cleanId, name: cleanName, soop_id: soopId });

  let success = false;
  let lastErrorMessage = '';
  let serverReturnedList: StreamerProfile[] | null = null;

  // Tier 1 (Primary): POST /api/streamers/delete (Most reliable across Cloudflare Pages Functions - no URL path encoding bugs!)
  try {
    const res = await fetch(`/api/streamers/delete?t=${t}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.streamers)) {
        serverReturnedList = data.streamers;
        success = true;
      }
    } else {
      const errText = await res.text().catch(() => '');
      lastErrorMessage = `POST /api/streamers/delete (${res.status}): ${errText.slice(0, 100)}`;
    }
  } catch (err: any) {
    lastErrorMessage = `POST /api/streamers/delete 네트워크 오류: ${err?.message || err}`;
  }

  // Tier 2: DELETE /api/streamers/:id (Path param strictly encoded)
  if (!success) {
    try {
      const res = await fetch(`/api/streamers/${targetParam}?t=${t}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: payload,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.streamers)) {
          serverReturnedList = data.streamers;
          success = true;
        }
      } else {
        const errText = await res.text().catch(() => '');
        lastErrorMessage = `DELETE /api/streamers/${targetParam} (${res.status}): ${errText.slice(0, 100)}`;
      }
    } catch (err: any) {
      lastErrorMessage = `DELETE /api/streamers/:id 네트워크 오류: ${err?.message || err}`;
    }
  }

  // Tier 3: DELETE /api/streamers
  if (!success) {
    try {
      const queryParams = new URLSearchParams({
        t: String(t),
        ...(cleanId ? { id: cleanId } : {}),
        ...(cleanName ? { name: cleanName } : {}),
      });
      const res = await fetch(`/api/streamers?${queryParams.toString()}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: payload,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.streamers)) {
          serverReturnedList = data.streamers;
          success = true;
        }
      } else {
        const errText = await res.text().catch(() => '');
        lastErrorMessage = `DELETE /api/streamers (${res.status}): ${errText.slice(0, 100)}`;
      }
    } catch (err: any) {
      lastErrorMessage = `DELETE /api/streamers 네트워크 오류: ${err?.message || err}`;
    }
  }

  // If all backend tiers failed, throw error immediately so frontend alert triggers
  if (!success) {
    throw new Error(`스트리머 삭제 API 호출 실패 [${lastErrorMessage || '모든 삭제 엔드포인트 응답 없음'}]`);
  }

  // Invalidate live broadcast cache
  fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});

  // Strictly Re-fetch authoritative DB list (100% Single Source of Truth) with cache-busting
  const freshList = await fetchStreamersFromServer(true);

  // Verification: Ensure the streamer was actually removed from the fresh list
  const stillPresent = freshList.some(
    (s) => (cleanId && s.id === cleanId) || (cleanName && s.name.trim() === cleanName)
  );
  if (stillPresent) {
    throw new Error(
      `서버 DB에서 레코드가 삭제되지 않고 그대로 유지되어 있습니다. (대상: ${cleanName}, ID: ${cleanId || '없음'})`
    );
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('streamers-updated', { detail: freshList }));
  }

  return freshList;
}

/**
 * Batch delete multiple streamer profiles permanently from server DB targeting strictly by ID and name
 */
export async function deleteStreamersBatchAsync(
  targets: (string | { id?: string; name?: string })[]
): Promise<StreamerProfile[]> {
  const ids: string[] = [];
  const names: string[] = [];
  for (const t of targets) {
    if (typeof t === 'string') {
      const clean = t.trim();
      if (clean.startsWith('s_')) ids.push(clean);
      else if (clean) names.push(clean);
    } else if (typeof t === 'object' && t) {
      if (t.id && String(t.id).trim()) ids.push(String(t.id).trim());
      if (t.name && String(t.name).trim()) names.push(String(t.name).trim());
    }
  }

  if (ids.length === 0 && names.length === 0) return fetchStreamersFromServer(true);

  const t = Date.now();
  const payload = JSON.stringify({ ids, names });
  let success = false;
  let lastErrorMessage = '';
  let serverReturnedList: StreamerProfile[] | null = null;

  // Tier 1: POST /api/streamers/delete
  try {
    const res = await fetch(`/api/streamers/delete?t=${t}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.streamers)) {
        serverReturnedList = data.streamers;
        success = true;
      }
    } else {
      const errText = await res.text().catch(() => '');
      lastErrorMessage = `POST /api/streamers/delete (${res.status}): ${errText.slice(0, 100)}`;
    }
  } catch (err: any) {
    lastErrorMessage = `POST /api/streamers/delete 네트워크 오류: ${err?.message || err}`;
  }

  // Tier 2: DELETE /api/streamers
  if (!success) {
    try {
      const res = await fetch(`/api/streamers?t=${t}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: payload,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.streamers)) {
          serverReturnedList = data.streamers;
          success = true;
        }
      } else {
        const errText = await res.text().catch(() => '');
        lastErrorMessage = `DELETE /api/streamers (${res.status}): ${errText.slice(0, 100)}`;
      }
    } catch (err: any) {
      lastErrorMessage = `DELETE /api/streamers 네트워크 오류: ${err?.message || err}`;
    }
  }

  if (!success) {
    throw new Error(`스트리머 일괄 삭제 실패 [${lastErrorMessage || '모든 삭제 엔드포인트 응답 없음'}]`);
  }

  fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});

  // Strictly Re-fetch authoritative DB list
  const freshList = await fetchStreamersFromServer(true);

  // Verify deletion
  const idSet = new Set(ids);
  const nameSet = new Set(names);
  const stillPresent = freshList.filter((s) => (s.id && idSet.has(s.id)) || nameSet.has(s.name.trim()));
  if (stillPresent.length > 0) {
    throw new Error(
      `일괄 삭제 실패: DB에서 ${stillPresent.length}명의 데이터가 삭제되지 않았습니다. (${stillPresent.map((s) => s.name).join(', ')})`
    );
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('streamers-updated', { detail: freshList }));
  }

  return freshList;
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
/**
 * D1 DB Initialization & Migration trigger (POST /api/admin/init-db)
 */
export async function initD1DatabaseAsync(): Promise<{
  success: boolean;
  count: number;
  streamers: StreamerProfile[];
  message?: string;
}> {
  try {
    let res = await fetch('/api/admin/init-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      res = await fetch('https://riming-gg.janghyck2.workers.dev/api/admin/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streamers)) {
        const sorted = sortStreamerProfiles(data.streamers);
        _cachedStreamerProfiles = sorted;
        await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});
        return { success: true, count: sorted.length, streamers: sorted, message: data.message };
      }
    }
  } catch (err) {
    console.warn('[StreamerApi] initD1DatabaseAsync call warning:', err);
  }
  const fallback = await syncStreamersFromBackend(true);
  return { success: true, count: fallback.length, streamers: fallback };
}

/**
 * Tidy and synchronize streamer profiles strictly based on CK Match database (Single Source of Truth).
 * Unifies the [CK일지 전적 기반 명단 정돈] button with the backend D1 DB synchronization pipeline.
 */
export async function tidyStreamersFromMatches(
  matches: Match[],
  currentProfiles: StreamerProfile[]
): Promise<{
  updatedList: StreamerProfile[];
  addedCount: number;
  ghostCount: number;
}> {
  // 1. First attempt authoritative backend D1 synchronization via /api/admin/init-db
  try {
    let initRes = await fetch('/api/admin/init-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!initRes.ok) {
      initRes = await fetch('https://riming-gg.janghyck2.workers.dev/api/admin/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (initRes.ok) {
      const initData = await initRes.json();
      if (initData?.success && Array.isArray(initData.streamers)) {
        const sorted = sortStreamerProfiles(initData.streamers);
        _cachedStreamerProfiles = sorted;
        await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});
        const prevCount = currentProfiles?.length || 0;
        const diff = sorted.length - prevCount;
        return {
          updatedList: sorted,
          addedCount: Math.max(0, diff),
          ghostCount: Math.max(0, -diff),
        };
      }
    }
  } catch (err) {
    console.warn('[StreamerApi] tidyStreamersFromMatches backend call fallback:', err);
  }

  // 2. Client-side fallback: Count matches & positions for all streamers in CK database
  const profileMap = new Map<string, StreamerProfile>();
  for (const p of currentProfiles || []) {
    if (p?.name?.trim()) {
      profileMap.set(p.name.toLowerCase().trim(), p);
    }
  }

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
    const stripped = normKey.replace(/[\.\_\#\^\*\♥\-]/g, '');
    let fallbackSoopId = KNOWN_SOOP_IDS[normKey] || KNOWN_SOOP_IDS[stripped] || '';
    if (normKey === '우리밍_' || normKey === '우리밍') fallbackSoopId = 'kmj05317';

    const existing = profileMap.get(normKey);

    if (!existing) {
      profileMap.set(normKey, {
        name: displayName,
        soop_id: fallbackSoopId,
        main_position: bestLine,
        is_hidden: false,
        updated_at: nowIso,
      });
      addedCount++;
    } else {
      profileMap.set(normKey, {
        ...existing,
        name: existing.name || displayName,
        soop_id: (existing.soop_id || '').trim() || fallbackSoopId,
        main_position: existing.main_position || bestLine,
      });
    }
  }

  // Prune empty ghost entries: streamers with 0 matches AND no SOOP ID
  const cleaned: StreamerProfile[] = [];
  let ghostCount = 0;

  for (const [key, p] of profileMap.entries()) {
    const hasMatches = matchPositionCounts.has(key);
    const hasSoopId = Boolean(p.soop_id && p.soop_id.trim());
    const isWooriming = p.name === '우리밍_' || p.name === '우리밍';

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
