/**
 * Cloudflare Pages Functions: /api/streamers
 * Direct Cloudflare D1 Database (env.DB) CRUD & Auto-Save endpoint for Streamers.
 */

import { DEFAULT_STREAMERS } from '../../src/data/defaultStreamers';

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

export function getD1(context: any) {
  const env = context?.env || context;
  return env?.DB || env?.RIMING_DB || env?.D1 || env?.database || null;
}

export function stripSymbols(name: string): string {
  return (name || '').replace(/[\.\_\#\^\*\♥\-\＃\☆\+\s]/g, '').toLowerCase().trim();
}

export function getStreamerId(name: string): string {
  const norm = stripSymbols(name) || (name || '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return 's_' + Math.abs(hash).toString(16);
}

export async function ensureStreamersTable(db: any) {
  if (!db || typeof db.prepare !== 'function') return;
  try {
    await db
      .prepare(`
        CREATE TABLE IF NOT EXISTS streamers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          soop_id TEXT DEFAULT '',
          main_position TEXT NOT NULL DEFAULT 'mid',
          is_hidden INTEGER NOT NULL DEFAULT 0,
          memo TEXT DEFAULT '',
          updated_at TEXT NOT NULL
        )
      `)
      .run();
  } catch (err) {
    console.warn('[Pages Functions] CREATE TABLE streamers warning:', err);
  }

  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_streamers_name ON streamers(name)').run();
  } catch {}
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

export function deduplicateStreamers(rawRows: StreamerRow[]): StreamerRow[] {
  const map = new Map<string, StreamerRow>();
  for (const r of rawRows) {
    const key = stripSymbols(r.name) || r.name.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      if (!existing.soop_id && r.soop_id) {
        map.set(key, r);
      } else if (
        r.soop_id &&
        existing.soop_id &&
        new Date(r.updated_at).getTime() > new Date(existing.updated_at).getTime()
      ) {
        map.set(key, { ...existing, ...r, soop_id: r.soop_id });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.name === '우리밍_' || a.name === '우리밍') return -1;
    if (b.name === '우리밍_' || b.name === '우리밍') return 1;
    return a.name.localeCompare(b.name, 'ko-KR');
  });
}

export async function seedDefaultStreamersToD1(db: any) {
  if (!db || typeof db.prepare !== 'function') return;
  await ensureStreamersTable(db);
  const now = new Date().toISOString();
  for (const s of DEFAULT_STREAMERS) {
    try {
      const sId = (s as any).id || getStreamerId(s.name);
      await db
        .prepare(`
          INSERT OR IGNORE INTO streamers (id, name, soop_id, main_position, is_hidden, memo, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          sId,
          s.name,
          s.soop_id || '',
          s.main_position || 'mid',
          s.is_hidden ? 1 : 0,
          s.memo || '',
          s.updated_at || now
        )
        .run();
    } catch {}
  }
}

/**
 * Executes a direct D1 UPDATE statement on env.DB:
 * UPDATE streamers SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ? WHERE id = ? OR name = ?
 */
export async function executeD1StreamerUpsert(db: any, item: any): Promise<void> {
  if (!db || typeof db.prepare !== 'function' || !item?.name) return;
  const cleanName = String(item.name).trim();
  if (!cleanName) return;

  const stripped = stripSymbols(cleanName);
  const sId = item.id ? String(item.id).trim() : getStreamerId(cleanName);
  const soopId = typeof item.soop_id === 'string' ? item.soop_id.trim() : '';
  const position = item.main_position || 'mid';
  const isHidden = item.is_hidden ? 1 : 0;
  const memo = typeof item.memo === 'string' ? item.memo : '';
  const nowIso = item.updated_at || new Date().toISOString();

  let updateRes: any = null;
  try {
    updateRes = await db
      .prepare(`
        UPDATE streamers 
        SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ?
        WHERE id = ? 
           OR name = ? 
           OR LOWER(TRIM(name)) = LOWER(TRIM(?))
           OR name = ?
           OR name = ?
           OR name = ?
      `)
      .bind(
        soopId,
        position,
        isHidden,
        memo,
        nowIso,
        sId,
        cleanName,
        cleanName,
        stripped,
        '#' + stripped,
        '＃' + stripped
      )
      .run();
  } catch (err) {
    console.warn('[Pages Functions] UPDATE query warning:', err);
  }

  const changes = updateRes?.meta?.changes ?? updateRes?.changes ?? 0;

  // If row was not present in DB, insert it
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
      try {
        await db
          .prepare(`
            UPDATE streamers 
            SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ?
            WHERE id = ? OR name = ?
          `)
          .bind(soopId, position, isHidden, memo, nowIso, sId, cleanName)
          .run();
      } catch {}
    }
  }

  // Sibling cleanup: update all symbol variations (e.g. '민찬기' vs '#민찬기' vs '＃민찬기')
  if (stripped) {
    try {
      await db
        .prepare(`
          UPDATE streamers
          SET soop_id = ?, main_position = ?, is_hidden = ?, updated_at = ?
          WHERE name = ? OR name = ? OR name = ?
        `)
        .bind(soopId, position, isHidden, nowIso, stripped, '#' + stripped, '＃' + stripped)
        .run();
    } catch {}
  }
}

export async function fetchAllStreamersFromD1(db: any): Promise<StreamerRow[]> {
  if (!db || typeof db.prepare !== 'function') {
    return DEFAULT_STREAMERS.map((s) => rowToStreamer(s));
  }

  try {
    await ensureStreamersTable(db);
    const queryRes = await db
      .prepare(`
        SELECT * FROM streamers 
        ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC
      `)
      .all();

    const rawRows = (queryRes?.results || []).map((r: any) => rowToStreamer(r));
    if (rawRows.length > 0) {
      return deduplicateStreamers(rawRows);
    }
  } catch (err) {
    console.warn('[Pages Functions] fetchAllStreamersFromD1 error, trying seed:', err);
  }

  // If table is empty (0 rows) or table didn't exist yet, auto-seed with all 91 streamers
  try {
    await seedDefaultStreamersToD1(db);
    const retryRes = await db
      .prepare(`
        SELECT * FROM streamers 
        ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC
      `)
      .all();
    const retryRows = (retryRes?.results || []).map((r: any) => rowToStreamer(r));
    if (retryRows.length > 0) {
      return deduplicateStreamers(retryRows);
    }
  } catch (seedErr) {
    console.warn('[Pages Functions] seedDefaultStreamersToD1 error:', seedErr);
  }

  return DEFAULT_STREAMERS.map((s) => rowToStreamer(s));
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET /api/streamers: Reads authoritative list directly from D1 DB with guaranteed default fallback
export const onRequestGet = async (context: any) => {
  try {
    const db = getD1(context);
    const streamers = await fetchAllStreamersFromD1(db);

    return jsonResponse({
      success: true,
      count: streamers.length,
      streamers,
      storage: db ? 'Cloudflare-D1' : 'default-bundle',
    });
  } catch (err: any) {
    console.error('[Pages Functions /api/streamers] Fatal GET error caught:', err);
    const fallback = DEFAULT_STREAMERS.map((s) => rowToStreamer(s));
    return jsonResponse({
      success: true,
      count: fallback.length,
      streamers: fallback,
      storage: 'emergency-fallback',
      error: err?.message,
    });
  }
};

// POST & PUT /api/streamers: Auto-Save & Manual Update directly to Cloudflare D1 DB
export async function handleUpdateStreamers(context: any) {
  try {
    const db = getD1(context);

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
      const currentList = await fetchAllStreamersFromD1(db);
      return jsonResponse({ success: true, count: currentList.length, streamers: currentList });
    }

    if (db) {
      await ensureStreamersTable(db);
      for (const item of incoming) {
        await executeD1StreamerUpsert(db, item);
      }
    }

    const fresh = await fetchAllStreamersFromD1(db);

    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: db ? 'Cloudflare-D1' : 'memory',
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Pages Functions] handleUpdateStreamers error:', err);
    return jsonResponse({ success: false, error: err?.message || 'Update failed' }, 500);
  }
}

export const onRequestPost = handleUpdateStreamers;
export const onRequestPut = handleUpdateStreamers;

// DELETE /api/streamers: Permanent delete directly from Cloudflare D1 DB
export const onRequestDelete = async (context: any) => {
  try {
    const db = getD1(context);
    const url = new URL(context.request.url);

    let targetId = url.searchParams.get('id');
    let targetName = url.searchParams.get('name');

    try {
      const body = await context.request.json().catch(() => ({}));
      if (body?.id) targetId = body.id;
      if (body?.name) targetName = body.name;
    } catch {}

    if (db && (targetId || targetName)) {
      await ensureStreamersTable(db);
      if (targetName) {
        const stripped = stripSymbols(targetName);
        await db
          .prepare(`
            DELETE FROM streamers 
            WHERE name = ? 
               OR LOWER(TRIM(name)) = LOWER(TRIM(?))
               OR name = ?
               OR name = ?
               OR name = ?
          `)
          .bind(targetName.trim(), targetName.trim(), stripped, '#' + stripped, '＃' + stripped)
          .run();
      }
      if (targetId) {
        await db.prepare('DELETE FROM streamers WHERE id = ?').bind(targetId).run();
      }
    }

    const fresh = await fetchAllStreamersFromD1(db);
    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: db ? 'Cloudflare-D1' : 'memory',
    });
  } catch (err: any) {
    console.error('[Pages Functions] onRequestDelete error:', err);
    return jsonResponse({ success: false, error: err?.message }, 500);
  }
};
