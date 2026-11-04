/**
 * Cloudflare Pages Functions: /api/streamers
 * Direct Cloudflare D1 Database (env.DB) CRUD & Auto-Save endpoint for Streamers.
 */

interface Env {
  DB?: any; // Cloudflare D1Database binding
}

export interface StreamerRow {
  id: string;
  name: string;
  soop_id: string;
  main_position: string;
  is_hidden: number | boolean;
  memo?: string;
  updated_at: string;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

export function getStreamerId(name: string): string {
  const norm = (name || '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return 's_' + Math.abs(hash).toString(16);
}

export async function ensureStreamersTable(db: any) {
  if (!db || typeof db.exec !== 'function') return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS streamers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        soop_id TEXT DEFAULT '',
        main_position TEXT NOT NULL DEFAULT 'mid',
        is_hidden INTEGER NOT NULL DEFAULT 0,
        memo TEXT DEFAULT '',
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_streamers_name ON streamers(name);
      CREATE INDEX IF NOT EXISTS idx_streamers_id ON streamers(id);
    `);
  } catch (err) {
    console.warn('[Pages Functions /api/streamers] ensureStreamersTable warning:', err);
  }
}

export function rowToStreamer(row: any): StreamerRow {
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

/**
 * Executes a direct D1 UPDATE statement on env.DB as required:
 * UPDATE streamers SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ? WHERE id = ? OR name = ?
 * If the record did not exist yet (changes === 0), it performs an INSERT.
 */
export async function executeD1StreamerUpsert(db: any, item: any): Promise<void> {
  if (!db || !item?.name) return;
  const cleanName = String(item.name).trim();
  if (!cleanName) return;

  const sId = item.id ? String(item.id).trim() : getStreamerId(cleanName);
  const soopId = typeof item.soop_id === 'string' ? item.soop_id.trim() : '';
  const position = item.main_position || 'mid';
  const isHidden = item.is_hidden ? 1 : 0;
  const memo = typeof item.memo === 'string' ? item.memo : '';
  const nowIso = item.updated_at || new Date().toISOString();

  // 1. Core UPDATE Query directly executed on Cloudflare D1
  const updateRes = await db
    .prepare(`
      UPDATE streamers 
      SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ?
      WHERE id = ? OR name = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))
    `)
    .bind(soopId, position, isHidden, memo, nowIso, sId, cleanName, cleanName)
    .run();

  const changes = updateRes?.meta?.changes ?? updateRes?.changes ?? 0;

  // 2. If row was not present in DB, insert it
  if (changes === 0) {
    try {
      await db
        .prepare(`
          INSERT INTO streamers (id, name, soop_id, main_position, is_hidden, memo, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(sId, cleanName, soopId, position, isHidden, memo, nowIso)
        .run();
    } catch {
      await db
        .prepare(`
          UPDATE streamers 
          SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ?
          WHERE name = ? OR id = ?
        `)
        .bind(soopId, position, isHidden, memo, nowIso, cleanName, sId)
        .run();
    }
  }
}

export async function fetchAllStreamersFromD1(db: any): Promise<StreamerRow[]> {
  const queryRes = await db
    .prepare(`
      SELECT * FROM streamers 
      ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC
    `)
    .all();

  return (queryRes?.results || []).map((r: any) => rowToStreamer(r));
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET /api/streamers: Reads authoritative list directly from D1 DB
export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const db = context.env?.DB;

  if (db) {
    try {
      await ensureStreamersTable(db);
      const streamers = await fetchAllStreamersFromD1(db);

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

  // Graceful fallback
  return jsonResponse({
    success: true,
    count: 0,
    streamers: [],
    storage: 'fallback',
  });
};

// POST & PUT /api/streamers: Auto-Save & Manual Update directly to Cloudflare D1 DB
export async function handleUpdateStreamers(context: { request: Request; env: Env }) {
  const db = context.env?.DB;

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const { streamers, streamer } = body || {};
  const incoming = Array.isArray(streamers)
    ? streamers
    : streamer
    ? [streamer]
    : (body?.name || body?.soop_id || body?.id)
    ? [body]
    : [];

  if (incoming.length === 0) {
    return jsonResponse({ success: false, error: '수정할 스트리머 정보가 없습니다.' }, 400);
  }

  if (db) {
    await ensureStreamersTable(db);

    for (const item of incoming) {
      await executeD1StreamerUpsert(db, item);
    }

    const fresh = await fetchAllStreamersFromD1(db);

    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: 'Cloudflare-D1',
      updated_at: new Date().toISOString(),
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

// DELETE /api/streamers: Permanent delete directly from Cloudflare D1 DB
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
      await db.prepare('DELETE FROM streamers WHERE name = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))').bind(targetName.trim(), targetName.trim()).run();
    }
    if (targetId) {
      await db.prepare('DELETE FROM streamers WHERE id = ?').bind(targetId).run();
    }

    const fresh = await fetchAllStreamersFromD1(db);
    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: 'Cloudflare-D1',
    });
  }

  return jsonResponse({ success: true, message: 'Deleted in memory/fallback' });
};
