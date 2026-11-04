/**
 * Cloudflare Pages Functions: /api/admin/init-db
 * Initializes D1 database tables and seeds the authoritative 91 streamers.
 */

import {
  CORS_HEADERS,
  jsonResponse,
  getD1,
  ensureStreamersTable,
  seedDefaultStreamersToD1,
  fetchAllStreamersFromD1,
} from '../streamers';

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost = async (context: any) => {
  try {
    const db = getD1(context);

    if (db) {
      await ensureStreamersTable(db);
      await seedDefaultStreamersToD1(db);
    }

    const streamers = await fetchAllStreamersFromD1(db);

    return jsonResponse({
      success: true,
      count: streamers.length,
      streamers,
      message: 'D1 데이터베이스 초기화 및 스트리머 명단 정돈 완료 (총 ' + streamers.length + '명)',
      storage: db ? 'Cloudflare-D1' : 'default-bundle',
    });
  } catch (err: any) {
    console.error('[Pages Functions /api/admin/init-db] error:', err);
    return jsonResponse({
      success: false,
      error: err?.message || 'Database initialization failed',
    }, 500);
  }
};

export const onRequestGet = onRequestPost;
