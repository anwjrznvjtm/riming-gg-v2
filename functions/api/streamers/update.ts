/**
 * Cloudflare Pages Functions: /api/streamers/update
 * Direct Cloudflare D1 Database (env.DB) Auto-Save endpoint for streamer updates.
 */

import {
  CORS_HEADERS,
  jsonResponse,
  getD1,
  ensureStreamersTable,
  executeD1StreamerUpsert,
  fetchAllStreamersFromD1,
  rowToStreamer,
} from '../streamers';

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// POST & PUT /api/streamers/update: Direct D1 UPDATE for single or batch streamers
export const onRequestPost = async (context: any) => {
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
    console.error('[Pages Functions /api/streamers/update] error:', err);
    return jsonResponse({ success: false, error: err?.message || 'Update failed' }, 500);
  }
};

export const onRequestPut = onRequestPost;
