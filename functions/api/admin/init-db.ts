/**
 * Cloudflare Pages Functions: /api/admin/init-db
 * Initializes D1 database tables and seeds the authoritative 91 streamers.
 */

import {
  CORS_HEADERS,
  jsonResponse,
  getD1,
  formatAndResetD1StreamersTable,
  fetchAllStreamersFromD1,
} from '../streamers';

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost = async (context: any) => {
  try {
    const db = getD1(context);

    if (db) {
      await formatAndResetD1StreamersTable(db);
    }

    const streamers = await fetchAllStreamersFromD1(db);

    return jsonResponse({
      success: true,
      count: streamers.length,
      streamers,
      message: 'D1 streamers 테이블이 100% 포맷(DROP & RECREATE)되고 기본 91명 명단으로 완전히 새롭게 초기화되었습니다.',
      storage: db ? 'Cloudflare-D1' : 'default-bundle',
      timestamp: new Date().toISOString(),
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
