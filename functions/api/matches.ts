/**
 * Cloudflare Pages Functions: /api/matches
 * Standalone Pages Function - Works with or without Cloudflare D1 database binding.
 * When D1 is not configured, proxies seamlessly to the Cloudflare Worker or returns graceful fallback.
 */

const WORKER_FALLBACK_URL = 'https://riming-gg.janghyck2.workers.dev';

interface Env {
  DB?: any; // Optional Cloudflare D1Database binding
}

interface MatchRow {
  id: string;
  date: string;
  ck_name: string;
  match_format: string;
  set_number: number;
  score: string;
  winning_team: string;
  team_a: string; // JSON string
  team_b: string; // JSON string
  team_a_champs: string; // JSON string
  team_b_champs: string; // JSON string
  team_a_kda: string; // JSON string
  team_b_kda: string; // JSON string
  ban_a: string; // JSON string
  ban_b: string; // JSON string
  created_at: string;
  updated_at: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * D1 Table Auto-init helper (used only when DB is provided)
 */
async function ensureTable(db: any) {
  if (!db) return;
  try {
    if (typeof db.prepare === 'function') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS ck_matches (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          ck_name TEXT NOT NULL,
          match_format TEXT NOT NULL DEFAULT '단판',
          set_number INTEGER NOT NULL DEFAULT 1,
          score TEXT NOT NULL DEFAULT '1:0',
          winning_team TEXT NOT NULL,
          team_a TEXT NOT NULL,
          team_b TEXT NOT NULL,
          team_a_champs TEXT NOT NULL,
          team_b_champs TEXT NOT NULL,
          team_a_kda TEXT NOT NULL,
          team_b_kda TEXT NOT NULL,
          ban_a TEXT NOT NULL,
          ban_b TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `).run();
      try {
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_ck_matches_date ON ck_matches(date DESC)').run();
      } catch {}
    } else if (typeof db.exec === 'function') {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS ck_matches (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          ck_name TEXT NOT NULL,
          match_format TEXT NOT NULL DEFAULT '단판',
          set_number INTEGER NOT NULL DEFAULT 1,
          score TEXT NOT NULL DEFAULT '1:0',
          winning_team TEXT NOT NULL,
          team_a TEXT NOT NULL,
          team_b TEXT NOT NULL,
          team_a_champs TEXT NOT NULL,
          team_b_champs TEXT NOT NULL,
          team_a_kda TEXT NOT NULL,
          team_b_kda TEXT NOT NULL,
          ban_a TEXT NOT NULL,
          ban_b TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ck_matches_date ON ck_matches(date DESC);
      `);
    }
  } catch (e) {
    console.warn('ensureTable warning:', e);
  }
}

/**
 * Convert D1 Row to Client Match object
 */
function rowToMatch(row: MatchRow): any {
  return {
    id: row.id,
    date: row.date,
    ck_name: row.ck_name,
    match_format: row.match_format || '단판',
    set_number: Number(row.set_number) || 1,
    score: row.score || '1:0',
    winning_team: row.winning_team,
    team_a: safeParseJson(row.team_a, {}),
    team_b: safeParseJson(row.team_b, {}),
    team_a_champs: safeParseJson(row.team_a_champs, {}),
    team_b_champs: safeParseJson(row.team_b_champs, {}),
    team_a_kda: safeParseJson(row.team_a_kda, {}),
    team_b_kda: safeParseJson(row.team_b_kda, {}),
    ban_a: safeParseJson(row.ban_a, []),
    ban_b: safeParseJson(row.ban_b, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function safeParseJson(val: string, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// OPTIONS: Handle CORS preflight
export const onRequestOptions = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

// GET: Fetch all matches (from D1 if available, otherwise from Worker backend)
export const onRequestGet = async (context: { env: Env }) => {
  const { DB } = context.env || {};

  if (DB && typeof DB.prepare === 'function') {
    try {
      await ensureTable(DB);
      const { results } = await DB.prepare(
        'SELECT * FROM ck_matches ORDER BY date DESC, created_at DESC'
      ).all();

      const matches = (results || []).map((r: any) => rowToMatch(r));
      return jsonResponse({ matches, total: matches.length, source: 'd1' });
    } catch (err: any) {
      console.warn('D1 query error, falling back to worker:', err);
    }
  }

  // Fallback: Proxy to Worker backend
  let workerErr = '';
  try {
    const res = await fetch(`${WORKER_FALLBACK_URL}?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    if (res.ok) {
      const data = await res.json();
      return jsonResponse(data);
    }
    workerErr = `Worker HTTP ${res.status}`;
  } catch (err: any) {
    workerErr = err?.message || 'Worker proxy error';
    console.warn('Worker proxy error:', err);
  }

  return jsonResponse({ success: false, matches: [], total: 0, error: workerErr || '경기 목록을 불러오지 못했습니다.' }, 500);
};

// POST: Create a new match OR batch import
export const onRequestPost = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env || {};
  const body: any = await context.request.json().catch(() => ({}));

  if (DB && typeof DB.prepare === 'function') {
    try {
      await ensureTable(DB);

      // Batch Import mode: { mode: 'replace' | 'merge', matches: Match[] }
      if (body.mode && Array.isArray(body.matches)) {
        if (body.mode === 'replace') {
          await DB.prepare('DELETE FROM ck_matches').run();
        }

        const stmt = DB.prepare(`
          INSERT OR REPLACE INTO ck_matches (
            id, date, ck_name, match_format, set_number, score, winning_team,
            team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
            ban_a, ban_b, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        const statements = body.matches.map((m: any) =>
          stmt.bind(
            String(m.id || `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
            String(m.date || now.slice(0, 10)),
            String(m.ck_name || 'CK 경기'),
            String(m.match_format || '단판'),
            Number(m.set_number) || 1,
            String(m.score || '1:0'),
            String(m.winning_team || 'Red'),
            JSON.stringify(m.team_a || {}),
            JSON.stringify(m.team_b || {}),
            JSON.stringify(m.team_a_champs || {}),
            JSON.stringify(m.team_b_champs || {}),
            JSON.stringify(m.team_a_kda || {}),
            JSON.stringify(m.team_b_kda || {}),
            JSON.stringify(m.ban_a || []),
            JSON.stringify(m.ban_b || []),
            String(m.created_at || now),
            now
          )
        );

        if (statements.length > 0) {
          await DB.batch(statements);
        }

        return jsonResponse({ success: true, count: statements.length, source: 'd1' });
      }

      // Single Match Insert
      const match = body.match || body;
      if (!match || (!match.date && !match.team_a && !match.ck_name)) {
        return jsonResponse({ success: false, error: '유효한 경기 데이터가 아닙니다.' }, 400);
      }
      const now = new Date().toISOString();
      const id = String(match.id || `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

      await DB.prepare(`
        INSERT OR REPLACE INTO ck_matches (
          id, date, ck_name, match_format, set_number, score, winning_team,
          team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
          ban_a, ban_b, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        String(match.date || now.slice(0, 10)),
        String(match.ck_name || 'CK 경기'),
        String(match.match_format || '단판'),
        Number(match.set_number) || 1,
        String(match.score || '1:0'),
        String(match.winning_team || 'Red'),
        JSON.stringify(match.team_a || {}),
        JSON.stringify(match.team_b || {}),
        JSON.stringify(match.team_a_champs || {}),
        JSON.stringify(match.team_b_champs || {}),
        JSON.stringify(match.team_a_kda || {}),
        JSON.stringify(match.team_b_kda || {}),
        JSON.stringify(match.ban_a || []),
        JSON.stringify(match.ban_b || []),
        String(match.created_at || now),
        now
      ).run();

      return jsonResponse({ success: true, match: { ...match, id }, source: 'd1' }, 201);
    } catch (err: any) {
      console.warn('D1 insert error, falling back to worker:', err);
      var d1PostError = err?.message || String(err);
    }
  }

  // Fallback: Proxy to Worker backend
  let workerPostError = '';
  try {
    const res = await fetch(WORKER_FALLBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return jsonResponse(data, 201);
    }
    workerPostError = data?.error || data?.message || `Worker POST HTTP ${res.status}`;
  } catch (err: any) {
    workerPostError = err?.message || 'Worker proxy POST error';
    console.warn('Worker proxy POST error:', err);
  }

  return jsonResponse(
    {
      success: false,
      error: [typeof d1PostError !== 'undefined' ? `D1 오류: ${d1PostError}` : '', workerPostError]
        .filter(Boolean)
        .join(' / ') || '경기 DB 저장에 실패했습니다.',
    },
    500
  );
};

// PUT: Update an existing match
export const onRequestPut = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env || {};
  const body: any = await context.request.json().catch(() => ({}));
  const match = body.match || body;
  if (!match || !match.id) {
    return jsonResponse({ success: false, error: '수정할 경기 ID가 필요합니다.' }, 400);
  }

  let d1PutError = '';
  if (DB && typeof DB.prepare === 'function') {
    try {
      await ensureTable(DB);
      const now = new Date().toISOString();
      await DB.prepare(`
        UPDATE ck_matches SET
          date = ?,
          ck_name = ?,
          match_format = ?,
          set_number = ?,
          score = ?,
          winning_team = ?,
          team_a = ?,
          team_b = ?,
          team_a_champs = ?,
          team_b_champs = ?,
          team_a_kda = ?,
          team_b_kda = ?,
          ban_a = ?,
          ban_b = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        String(match.date),
        String(match.ck_name),
        String(match.match_format || '단판'),
        Number(match.set_number) || 1,
        String(match.score || '1:0'),
        String(match.winning_team),
        JSON.stringify(match.team_a || {}),
        JSON.stringify(match.team_b || {}),
        JSON.stringify(match.team_a_champs || {}),
        JSON.stringify(match.team_b_champs || {}),
        JSON.stringify(match.team_a_kda || {}),
        JSON.stringify(match.team_b_kda || {}),
        JSON.stringify(match.ban_a || []),
        JSON.stringify(match.ban_b || []),
        now,
        String(match.id)
      ).run();

      return jsonResponse({ success: true, match, source: 'd1' });
    } catch (err: any) {
      d1PutError = err?.message || String(err);
      console.warn('D1 update error, falling back to worker:', err);
    }
  }

  // Fallback: Proxy to Worker backend
  let workerPutError = '';
  try {
    const res = await fetch(WORKER_FALLBACK_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return jsonResponse(data);
    }
    workerPutError = data?.error || data?.message || `Worker PUT HTTP ${res.status}`;
  } catch (err: any) {
    workerPutError = err?.message || 'Worker proxy PUT error';
    console.warn('Worker proxy PUT error:', err);
  }

  return jsonResponse(
    {
      success: false,
      error: [d1PutError ? `D1 오류: ${d1PutError}` : '', workerPutError]
        .filter(Boolean)
        .join(' / ') || '경기 수정 저장에 실패했습니다.',
    },
    500
  );
};

// DELETE: Delete a match by ID
export const onRequestDelete = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env || {};
  const url = new URL(context.request.url);
  let id = url.searchParams.get('id');

  if (!id) {
    try {
      const body: any = await context.request.json();
      id = body?.id;
    } catch {}
  }

  const cleanId = String(id || '').trim();
  if (!cleanId) {
    return jsonResponse({ success: false, error: '삭제할 경기 ID가 필요합니다.' }, 400);
  }

  let d1DeleteError = '';
  if (DB && typeof DB.prepare === 'function') {
    try {
      await ensureTable(DB);
      await DB.prepare('DELETE FROM ck_matches WHERE id = ?').bind(cleanId).run();
      return jsonResponse({ success: true, deletedId: cleanId, source: 'd1' });
    } catch (err: any) {
      d1DeleteError = err?.message || String(err);
      console.warn('D1 delete error, falling back to worker:', err);
    }
  }

  // Fallback: Proxy to Worker backend
  let workerDeleteError = '';
  try {
    const targetUrl = `${WORKER_FALLBACK_URL}?id=${encodeURIComponent(cleanId)}&t=${Date.now()}`;
    const res = await fetch(targetUrl, { method: 'DELETE' });
    const data: any = await res.json().catch(() => null);
    if (res.ok && data?.success !== false) {
      return jsonResponse(data);
    }
    workerDeleteError = data?.error || data?.message || `Worker DELETE HTTP ${res.status}`;
  } catch (err: any) {
    workerDeleteError = err?.message || 'Worker proxy DELETE error';
    console.warn('Worker proxy DELETE error:', err);
  }

  return jsonResponse(
    {
      success: false,
      error: [d1DeleteError ? `D1 오류: ${d1DeleteError}` : '', workerDeleteError]
        .filter(Boolean)
        .join(' / ') || '경기 삭제에 실패했습니다.',
    },
    500
  );
};
