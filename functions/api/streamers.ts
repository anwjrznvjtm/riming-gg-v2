/**
 * Cloudflare Pages Functions: /api/streamers
 * Direct Cloudflare D1 Database (env.DB) CRUD & Auto-Save endpoint for Streamers.
 */

interface Env {
  DB?: any; // Cloudflare D1Database binding
}

interface StreamerRow {
  id: string;
  name: string;
  soop_id: string;
  main_position: string;
  is_hidden: number | boolean;
  memo?: string;
  updated_at: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function getStreamerId(name: string): string {
  const norm = (name || '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return 's_' + Math.abs(hash).toString(16);
}

async function ensureStreamersTable(db: any) {
  if (!db || typeof db.exec !== 'function') return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS streamers (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        soop_id TEXT DEFAULT '',
        main_position TEXT NOT NULL DEFAULT 'mid',
        is_hidden INTEGER NOT NULL DEFAULT 0,
        memo TEXT DEFAULT '',
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_streamers_name ON streamers(name);
    `);
  } catch (err) {
    console.warn('[Pages Functions /api/streamers] ensureStreamersTable warning:', err);
  }
}

function rowToStreamer(row: any): StreamerRow {
  return {
    id: String(row.id || getStreamerId(row.name)),
    name: String(row.name || '').trim(),
    soop_id: String(row.soop_id || '').trim(),
    main_position: String(row.main_position || 'mid'),
    is_hidden: Boolean(row.is_hidden),
    memo: row.memo || '',
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET /api/streamers
export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const db = context.env?.DB;

  if (db) {
    try {
      await ensureStreamersTable(db);
      const queryRes = await db
        .prepare(`
          SELECT * FROM streamers 
          ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC
        `)
        .all();

      const results = queryRes?.results || [];
      const streamers = results.map((r: any) => rowToStreamer(r));

      return jsonResponse({
        success: true,
        count: streamers.length,
        streamers,
        storage: 'Cloudflare-D1',
      });
    } catch (err: any) {
      console.error('[Pages Functions] D1 query error:', err);
    }
  }

  // Fallback to proxying from local server or Worker
  return jsonResponse({
    success: true,
    count: 0,
    streamers: [],
    storage: 'fallback',
  });
};

// POST & PUT: Update or Insert Streamer(s)
async function handleUpdateStreamers(context: { request: Request; env: Env }) {
  const db = context.env?.DB;
  const nowIso = new Date().toISOString();

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const { streamers, streamer } = body || {};
  const incoming = Array.isArray(streamers) ? streamers : streamer ? [streamer] : (body?.name || body?.soop_id) ? [body] : [];

  if (incoming.length === 0) {
    return jsonResponse({ success: false, error: '수정할 스트리머 정보가 없습니다.' }, 400);
  }

  if (db) {
    await ensureStreamersTable(db);
    const statements: any[] = [];

    const upsertStmt = db.prepare(`
      INSERT INTO streamers (id, name, soop_id, main_position, is_hidden, memo, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        soop_id = excluded.soop_id,
        main_position = excluded.main_position,
        is_hidden = excluded.is_hidden,
        memo = excluded.memo,
        updated_at = excluded.updated_at
    `);

    for (const item of incoming) {
      if (!item?.name || typeof item.name !== 'string' || !item.name.trim()) continue;
      const cleanName = item.name.trim();
      const sId = item.id || getStreamerId(cleanName);
      const soopId = typeof item.soop_id === 'string' ? item.soop_id.trim() : '';
      const position = item.main_position || 'mid';
      const isHidden = item.is_hidden ? 1 : 0;
      const memo = item.memo || '';

      statements.push(
        upsertStmt.bind(sId, cleanName, soopId, position, isHidden, memo, nowIso)
      );
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }

    // Re-fetch authoritative list from D1
    const queryRes = await db
      .prepare(`
        SELECT * FROM streamers 
        ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC
      `)
      .all();

    const fresh = (queryRes?.results || []).map((r: any) => rowToStreamer(r));

    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: 'Cloudflare-D1',
      updated_at: nowIso,
    });
  }

  return jsonResponse({
    success: true,
    count: incoming.length,
    streamers: incoming.map((r: any) => rowToStreamer(r)),
    storage: 'fallback',
  });
}

export const onRequestPost = handleUpdateStreamers;
export const onRequestPut = handleUpdateStreamers;

// DELETE /api/streamers
export const onRequestDelete = async (context: { request: Request; env: Env }) => {
  const db = context.env?.DB;
  const url = new URL(context.request.url);

  let targetId = url.searchParams.get('id');
  let targetName = url.searchParams.get('name');

  try {
    const body = await context.request.json().catch(() => ({}));
    if (body?.id) targetId = body.id;
    if (body?.name) targetName = body.name;
  } catch {}

  if (!targetId && !targetName) {
    return jsonResponse({ success: false, error: '삭제할 스트리머 ID 또는 이름이 필요합니다.' }, 400);
  }

  if (db) {
    await ensureStreamersTable(db);
    if (targetName) {
      await db.prepare('DELETE FROM streamers WHERE name = ?').bind(targetName.trim()).run();
    } else if (targetId) {
      await db.prepare('DELETE FROM streamers WHERE id = ?').bind(targetId).run();
    }

    const queryRes = await db
      .prepare(`
        SELECT * FROM streamers 
        ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC
      `)
      .all();

    const fresh = (queryRes?.results || []).map((r: any) => rowToStreamer(r));
    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: 'Cloudflare-D1',
    });
  }

  return jsonResponse({ success: true, message: 'Deleted in memory/fallback' });
};
