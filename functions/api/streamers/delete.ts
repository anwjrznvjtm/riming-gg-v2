/**
 * Cloudflare Pages Functions: /api/streamers/delete
 * Handles POST and DELETE /api/streamers/delete for single or batch streamer deletion.
 */

import {
  CORS_HEADERS,
  jsonResponse,
  getD1,
  executeD1StreamerDelete,
  fetchAllStreamersFromD1,
} from '../streamers';

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost = async (context: any) => {
  try {
    const db = getD1(context);
    const url = new URL(context.request.url);

    let targetId = url.searchParams.get('id') || undefined;
    let targetName = url.searchParams.get('name') || undefined;
    let targetIds: string[] | undefined;
    let targetNames: string[] | undefined;

    try {
      const body = await context.request.json().catch(() => ({}));
      if (body?.id) targetId = body.id;
      if (body?.name) targetName = body.name;
      if (Array.isArray(body?.ids)) targetIds = body.ids;
      if (Array.isArray(body?.names)) targetNames = body.names;
    } catch {}

    if (db) {
      await executeD1StreamerDelete(db, { id: targetId, name: targetName, ids: targetIds, names: targetNames });
    }

    const fresh = await fetchAllStreamersFromD1(db);

    return jsonResponse({
      success: true,
      count: fresh.length,
      streamers: fresh,
      storage: db ? 'Cloudflare-D1' : 'memory',
    });
  } catch (err: any) {
    console.error('[Pages Functions /api/streamers/delete] error:', err);
    return jsonResponse({ success: false, error: err?.message || 'Delete failed' }, 500);
  }
};

export const onRequestDelete = onRequestPost;
