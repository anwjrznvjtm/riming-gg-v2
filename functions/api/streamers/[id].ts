/**
 * Cloudflare Pages Functions: /api/streamers/:id
 * Direct Cloudflare D1 Database (env.DB) CRUD & Auto-Save endpoint for single streamer by ID/Name.
 */

import {
  CORS_HEADERS,
  jsonResponse,
  ensureStreamersTable,
  executeD1StreamerUpsert,
  fetchAllStreamersFromD1,
  rowToStreamer,
} from '../streamers';

interface Env {
  DB?: any;
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// PUT /api/streamers/:id: Direct D1 UPDATE for single streamer
export const onRequestPut = async (context: {
  request: Request;
  env: Env;
  params: { id: string };
}) => {
  const db = context.env?.DB;
  const rawId = context.params?.id ? decodeURIComponent(context.params.id).trim() : '';

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const incomingItem = {
    ...body,
    id: body.id || (rawId.startsWith('s_') ? rawId : undefined),
    name: body.name || (!rawId.startsWith('s_') ? rawId : undefined),
  };

  if (!incomingItem.name && !incomingItem.id && rawId) {
    incomingItem.id = rawId;
  }

  if (db) {
    await ensureStreamersTable(db);
    await executeD1StreamerUpsert(db, incomingItem);
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
    streamer: rowToStreamer(incomingItem),
    storage: 'fallback',
  });
};

export const onRequestPost = onRequestPut;

// DELETE /api/streamers/:id: Direct D1 delete by ID or Name
export const onRequestDelete = async (context: {
  request: Request;
  env: Env;
  params: { id: string };
}) => {
  const db = context.env?.DB;
  const rawId = context.params?.id ? decodeURIComponent(context.params.id).trim() : '';

  if (db) {
    await ensureStreamersTable(db);
    if (rawId) {
      await db
        .prepare('DELETE FROM streamers WHERE id = ? OR name = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))')
        .bind(rawId, rawId, rawId)
        .run();
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

// GET /api/streamers/:id: Query single streamer by ID or Name
export const onRequestGet = async (context: {
  request: Request;
  env: Env;
  params: { id: string };
}) => {
  const db = context.env?.DB;
  const rawId = context.params?.id ? decodeURIComponent(context.params.id).trim() : '';

  if (db) {
    await ensureStreamersTable(db);
    const res = await db
      .prepare('SELECT * FROM streamers WHERE id = ? OR name = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1')
      .bind(rawId, rawId, rawId)
      .first();

    if (res) {
      return jsonResponse({ success: true, streamer: rowToStreamer(res), storage: 'Cloudflare-D1' });
    }
  }

  return jsonResponse({ success: false, error: 'Streamer not found' }, 404);
};
