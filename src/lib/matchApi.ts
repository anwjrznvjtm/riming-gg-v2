import { Match } from '../types';
import { normalizeMatch } from './matchSchema';

/**
 * Cloudflare Worker Backend API endpoint (Absolute URL only)
 */
export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';
export const WORKER_API_ENDPOINT = WORKER_BASE_URL;

export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchAllMatchesFromWorker(): Promise<{ matches: Match[]; source?: string; error?: string }> {
  const filterAndNormalize = (rawList: any[]) => {
    // Defensive filter: Only keep legitimate matches with valid rosters or match metadata, never streamer records
    const realMatchesOnly = rawList.filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      if (m.type === 'streamer') return false;
      if (typeof m.id === 'string' && m.id.startsWith('s_')) return false;
      const hasTeamA = Boolean(m.team_a && (m.team_a.top || m.team_a.jgl || m.team_a.mid || m.team_a.adc || m.team_a.sup));
      const hasTeamB = Boolean(m.team_b && (m.team_b.top || m.team_b.jgl || m.team_b.mid || m.team_b.adc || m.team_b.sup));
      const hasMeta = Boolean(m.ck_name && String(m.ck_name).trim() && m.date);
      return hasTeamA || hasTeamB || hasMeta;
    });
    return realMatchesOnly.map((m: any) => normalizeMatch(m));
  };

  const t = Date.now();
  try {
    const res = await fetchWithTimeout(`${WORKER_BASE_URL}?t=${t}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
      if (Array.isArray(rawList)) {
        const normalized = filterAndNormalize(rawList);
        try {
          localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
          localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(normalized));
        } catch {}
        return { matches: normalized, source: 'worker' };
      }
    }
  } catch (err: any) {
    console.warn('[MatchApi] Direct Worker GET failed, trying /api/matches:', err?.message || err);
  }

  // Fallback to /api/matches (Pages Functions D1 / Express proxy)
  try {
    const res = await fetchWithTimeout(`/api/matches?t=${t}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return { matches: [], source: 'api', error: `서버 응답 오류 (HTTP ${res.status})` };
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
    if (Array.isArray(rawList)) {
      const normalized = filterAndNormalize(rawList);
      try {
        localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(normalized));
      } catch {}
      return { matches: normalized, source: 'api' };
    }
    return { matches: [], source: 'api' };
  } catch (err: any) {
    return { matches: [], source: 'worker', error: err?.message || '네트워크 연결 오류' };
  }
}

export async function createMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  const t = Date.now();
  const payload = JSON.stringify(normalized);
  let lastError = '';

  // Tier 1: Direct Cloudflare Worker D1 endpoint
  try {
    const res = await fetchWithTimeout(`${WORKER_BASE_URL}?t=${t}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return { success: true, match: data?.match ? normalizeMatch(data.match) : normalized };
    }
    lastError = data?.error || data?.message || `Worker 저장 실패 (HTTP ${res.status})`;
  } catch (err: any) {
    lastError = `Worker 네트워크 오류: ${err?.message || err}`;
  }

  // Tier 2: Local / Pages Functions (/api/matches) fallback
  try {
    const res = await fetchWithTimeout(`/api/matches?t=${t}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return { success: true, match: data?.match ? normalizeMatch(data.match) : normalized };
    }
    lastError = data?.error || data?.message || `/api/matches 저장 실패 (HTTP ${res.status})`;
  } catch (err: any) {
    lastError = lastError || `네트워크 오류: ${err?.message || err}`;
  }

  return { success: false, error: lastError || '경기 저장에 실패했습니다.' };
}

export async function updateMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  const t = Date.now();
  const payload = JSON.stringify(normalized);
  let lastError = '';

  // Tier 1: Direct Cloudflare Worker D1 endpoint
  try {
    const res = await fetchWithTimeout(`${WORKER_BASE_URL}?t=${t}`, {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return { success: true, match: data?.match ? normalizeMatch(data.match) : normalized };
    }
    lastError = data?.error || data?.message || `Worker 수정 실패 (HTTP ${res.status})`;
  } catch (err: any) {
    lastError = `Worker 네트워크 오류: ${err?.message || err}`;
  }

  // Tier 2: Local / Pages Functions (/api/matches) fallback
  try {
    const res = await fetchWithTimeout(`/api/matches?t=${t}`, {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return { success: true, match: data?.match ? normalizeMatch(data.match) : normalized };
    }
    lastError = data?.error || data?.message || `/api/matches 수정 실패 (HTTP ${res.status})`;
  } catch (err: any) {
    lastError = lastError || `네트워크 오류: ${err?.message || err}`;
  }

  return { success: false, error: lastError || '경기 수정에 실패했습니다.' };
}

export function findSeriesMatchIds(targetId: string, allMatches?: Match[]): string[] {
  if (!allMatches || allMatches.length === 0) return [targetId];

  const target = allMatches.find((m) => String(m.id) === String(targetId));
  if (!target) return [targetId];

  const set = new Set<string>();
  set.add(String(target.id));

  const rootParentId = target.parent_match_id ? String(target.parent_match_id) : '';
  const isSeries = target.match_format === '3판2선승' || target.match_format === '5판3선승';

  for (const m of allMatches) {
    const mId = String(m.id);
    const mParent = m.parent_match_id ? String(m.parent_match_id) : '';

    // If target is child and m is parent
    if (rootParentId && mId === rootParentId) {
      set.add(mId);
    }
    // If m is child of target
    else if (mParent && mParent === String(target.id)) {
      set.add(mId);
    }
    // If m shares the same parent as target
    else if (rootParentId && mParent && mParent === rootParentId) {
      set.add(mId);
    }
    // Or if they belong to the same series (date + ck_name)
    else if (isSeries && m.date === target.date && (m.ck_name || '').trim() === (target.ck_name || '').trim()) {
      set.add(mId);
    }
  }

  return Array.from(set);
}

export async function deleteMatchOnWorker(id: string): Promise<{ success: boolean; id: string; error?: string }> {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    return { success: false, id: '', error: '삭제할 경기 고유 ID가 필요합니다.' };
  }

  const t = Date.now();
  let lastError = '';

  // Tier 1: Direct Cloudflare Worker D1 DELETE strictly by unique ID
  try {
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(cleanId)}&t=${t}`;
    const res = await fetchWithTimeout(targetUrl, {
      method: 'DELETE',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return { success: true, id: cleanId };
    }
    lastError = data?.error || data?.message || `Worker 삭제 실패 (HTTP ${res.status})`;
  } catch (err: any) {
    lastError = `Worker 네트워크 오류: ${err?.message || err}`;
  }

  // Tier 2: /api/matches DELETE strictly by unique ID (Pages Functions D1 / Express proxy)
  try {
    const localUrl = `/api/matches?id=${encodeURIComponent(cleanId)}&t=${t}`;
    const res = await fetchWithTimeout(localUrl, {
      method: 'DELETE',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return { success: true, id: cleanId };
    }
    lastError = data?.error || data?.message || `/api/matches 삭제 실패 (HTTP ${res.status})`;
  } catch (err: any) {
    lastError = lastError || `네트워크 오류: ${err?.message || err}`;
  }

  return { success: false, id: cleanId, error: lastError || '경기 삭제에 실패했습니다.' };
}

/**
 * Single-ID Delete: Strictly deletes ONLY the single match matching the unique ID (never deletes other matches by date/name/series)
 */
export async function deleteMatchCascade(
  id: string,
  _allMatches?: Match[]
): Promise<{ success: boolean; id: string; deletedIds?: string[]; error?: string }> {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    return { success: false, id: '', error: '삭제할 경기 고유 ID가 필요합니다.' };
  }

  const res = await deleteMatchOnWorker(cleanId);
  if (res.success) {
    return { success: true, id: cleanId, deletedIds: [cleanId] };
  }
  return { success: false, id: cleanId, error: res.error || '경기 삭제 실패' };
}

/**
 * Cleanup orphan / corrupted match records (e.g., broken 10-25 matches)
 */
export async function cleanupOrphanMatches(
  existingMatches?: Match[]
): Promise<{ success: boolean; deletedCount: number; deletedIds: string[] }> {
  const targetMatches = existingMatches || (await fetchAllMatchesFromWorker()).matches;
  const orphanIds: string[] = [];

  for (const m of targetMatches) {
    // 10월 25일 ghost matches or corrupted matches with missing teams
    const isOct25 = (m.date || '').includes('10-25') || (m.date || '').includes('2026-10-25');
    const hasAnyA = Boolean(m.team_a && Object.values(m.team_a).some(Boolean));
    const hasAnyB = Boolean(m.team_b && Object.values(m.team_b).some(Boolean));
    const isCorrupted = !hasAnyA && !hasAnyB;
    if (isOct25 || isCorrupted) {
      orphanIds.push(String(m.id));
    }
  }

  if (orphanIds.length > 0) {
    await Promise.all(orphanIds.map((oid) => deleteMatchOnWorker(oid)));
    try {
      await fetch('/api/matches/cleanup-orphans', { method: 'POST' }).catch(() => {});
    } catch {}
  }

  return { success: true, deletedCount: orphanIds.length, deletedIds: orphanIds };
}

// === App.tsx 호환용 별칭 (빌드 에러 해결) ===
export const fetchAllMatchesFromApi = fetchAllMatchesFromWorker;
export const createMatchOnApi = createMatchOnWorker;
export const updateMatchOnApi = async (match: Match, _all?: Match[]) => updateMatchOnWorker(match);
export const deleteMatchOnApi = async (id: string, _allMatches?: Match[]) => deleteMatchCascade(id);
export const batchUpdateMatchesOnApi = updateMatchOnWorker;
export const batchUpdateMatchesOnWorker = updateMatchOnWorker;
