/**
 * Cloudflare Pages Functions: /api/streamers/update
 * Direct Cloudflare D1 Database (env.DB) Auto-Save endpoint for streamer updates.
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

// POST & PUT /api/streamers/update: Direct D1 UPDATE for single or batch streamers
export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
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
};

export const onRequestPut = onRequestPost;
