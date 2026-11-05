/**
 * Cloudflare Pages Functions: /api/streamers/:id
 * Direct Cloudflare D1 Database (env.DB) CRUD & Auto-Save endpoint for single streamer by ID/Name.
 */

import {
  CORS_HEADERS,
  jsonResponse,
  getD1,
  ensureStreamersTable,
  executeD1StreamerUpsert,
  executeD1StreamerDelete,
  fetchAllStreamersFromD1,
  rowToStreamer,
} from '../streamers';

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// PUT & POST /api/streamers/:id
export const onRequestPut = async (context: any) => {
  try {
    const db = getD1(context);
    const rawId = context.params?.id ? decodeURIComponent(context.params.id).trim() : '';

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }

    // Safety guard: If accidentally hit with :id = 'delete', route to delete handler
    if (rawId === 'delete') {
      const targetId = body?.id;
      const targetName = body?.name;
      const targetNames = body?.names;
      if (db) {
        await executeD1StreamerDelete(db, { id: targetId, name: targetName, names: targetNames });
      }
      const fresh = await fetchAllStreamersFromD1(db);
      return jsonResponse({
        success: true,
        count: fresh.length,
        streamers: fresh,
        storage: db ? 'Cloudflare-D1' : 'memory',
      });
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
    console.error('[Pages Functions /api/streamers/:id] PUT error:', err);
    return jsonResponse({ success: false, error: err?.message || 'Update failed' }, 500);
  }
};

export const onRequestPost = onRequestPut;

// DELETE /api/streamers/:id: Direct D1 delete by ID or Name
export const onRequestDelete = async (context: any) => {
  try {
    const db = getD1(context);
    let rawId = context.params?.id ? String(context.params.id).trim() : '';
    try {
      rawId = decodeURIComponent(rawId).trim();
    } catch {}

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }

    const targetId = body.id || (rawId.startsWith('s_') ? rawId : undefined);
    const targetName = body.name || (!rawId.startsWith('s_') && rawId !== 'delete' ? rawId : undefined);
    const targetIds = Array.isArray(body.ids) ? body.ids : undefined;
    const targetNames = Array.isArray(body.names) ? body.names : undefined;

    let deletedCount = 0;
    if (db) {
      deletedCount = await executeD1StreamerDelete(db, { id: targetId, name: targetName, ids: targetIds, names: targetNames });
    }

    const fresh = await fetchAllStreamersFromD1(db);
    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      deletedCount,
      storage: db ? 'Cloudflare-D1' : 'memory',
    });
  } catch (err: any) {
    console.error('[Pages Functions /api/streamers/:id] DELETE error:', err);
    return jsonResponse({ success: false, error: err?.message || 'Delete failed' }, 500);
  }
};
