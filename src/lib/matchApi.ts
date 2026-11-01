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
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return { matches: [], source: 'worker', error: `서버 응답 오류 (HTTP ${res.status})` };
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
    if (Array.isArray(rawList)) {
      const normalized = rawList.map((m: any) => normalizeMatch(m));
      try {
        localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(normalized));
      } catch {}
      return { matches: normalized, source: 'worker' };
    }
    return { matches: [], source: 'worker' };
  } catch (err: any) {
    return { matches: [], source: 'worker', error: err?.message || '네트워크 연결 오류' };
  }
}

export async function createMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
    if (!res.ok) return { success: false, error: `경기 저장 실패 (HTTP ${res.status})` };
    const data = await res.json().catch(() => ({}));
    if (data?.success === false) return { success: false, error: data?.error || '경기 저장 실패' };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message || '네트워크 오류' };
  }
}

export async function updateMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
    if (!res.ok) return { success: false, error: `경기 수정 실패 (HTTP ${res.status})` };
    const data = await res.json().catch(() => ({}));
    if (data?.success === false) return { success: false, error: data?.error || '경기 수정 실패' };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message || '네트워크 오류' };
  }
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
  try {
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(targetUrl, { method: 'DELETE' });
    if (!res.ok) return { success: false, id, error: `경기 삭제 실패 (HTTP ${res.status})` };
    const data = await res.json().catch(() => ({}));
    if (data?.success === true) return { success: true, id };
    return { success: false, id, error: data?.error || '삭제 응답 없음' };
  } catch (err: any) {
    return { success: false, id, error: err?.message || '네트워크 오류' };
  }
}

/**
 * Cascade Delete: Deletes target match along with all related BO3/BO5 sets and parent_match_id relations
 */
export async function deleteMatchCascade(
  id: string,
  allMatches?: Match[]
): Promise<{ success: boolean; id: string; deletedIds?: string[]; error?: string }> {
  const idsToDelete = findSeriesMatchIds(id, allMatches);

  // Attempt backend Cascade Delete API first (/api/matches/:id)
  try {
    const localRes = await fetchWithTimeout(`/api/matches/${encodeURIComponent(id)}`, { method: 'DELETE' }, 8000);
    if (localRes.ok) {
      const data = await localRes.json().catch(() => ({}));
      if (data?.success) {
        return { success: true, id, deletedIds: data?.deletedIds || idsToDelete };
      }
    }
  } catch (err) {
    console.warn('[MatchApi] Local /api/matches/:id DELETE warning, falling back to direct Worker cascade:', err);
  }

  // Fallback: Delete all related series match IDs concurrently on Cloudflare Worker
  try {
    const results = await Promise.all(idsToDelete.map((mid) => deleteMatchOnWorker(mid)));
    const allSuccessful = results.some((r) => r.success);
    if (allSuccessful) {
      return { success: true, id, deletedIds: idsToDelete };
    }
    return { success: false, id, error: results[0]?.error || '삭제 실패' };
  } catch (err: any) {
    return { success: false, id, error: err?.message || '네트워크 오류' };
  }
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
    const isCorrupted = !m.team_a || !m.team_b || (!m.team_a.top && !m.team_b.top);
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
export const deleteMatchOnApi = async (id: string, allMatches?: Match[]) => deleteMatchCascade(id, allMatches);
export const batchUpdateMatchesOnApi = updateMatchOnWorker;
export const batchUpdateMatchesOnWorker = updateMatchOnWorker;
