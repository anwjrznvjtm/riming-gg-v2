/**
 * Cloudflare Pages Functions: /api/meta
 * D1 Database Binding: DB
 * Handles 롤PS/DeepLoL Meta Champions & Builds API
 */

import {
  ensureD1MetaTables,
  queryChampionTierList,
  queryChampionBuild,
  batchUpsertMetaStats,
} from '../../src/lib/d1MetaService';
import { syncLolMetaStatsToD1 } from '../../src/lib/metaCrawlerService';

interface Env {
  DB: any; // Cloudflare D1Database binding
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

// OPTIONS: CORS Preflight
export const onRequestOptions = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

// GET: 챔피언 티어 목록 또는 상세 빌드 조회
export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const type = url.searchParams.get('type') || 'champions'; // 'champions' | 'build'
  const championId = url.searchParams.get('championId') || url.searchParams.get('champ') || '';
  const tierDivision = (url.searchParams.get('tier') || 'emerald') as any;
  const position = (url.searchParams.get('pos') || url.searchParams.get('position')) as any;
  const patchVersion = url.searchParams.get('patch') || undefined;

  try {
    if (!env.DB) {
      return jsonResponse({
        success: false,
        error: 'Cloudflare D1 database (env.DB) is not configured.',
      }, 500);
    }

    await ensureD1MetaTables(env.DB);

    if (type === 'build' && championId) {
      const build = await queryChampionBuild(env.DB, championId, {
        tierDivision,
        position,
        patchVersion,
      });

      if (!build) {
        return jsonResponse({
          success: false,
          error: `Build not found for champion '${championId}'`,
        }, 404);
      }

      return jsonResponse({
        success: true,
        source: 'cloudflare-d1',
        data: build,
      });
    }

    // Default: 티어 목록 조회
    const champions = await queryChampionTierList(env.DB, {
      tierDivision,
      position,
      patchVersion,
    });

    return jsonResponse({
      success: true,
      source: 'cloudflare-d1',
      count: champions.length,
      data: champions,
    });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: err?.message || 'Failed to query D1 database',
    }, 500);
  }
};

// POST: 크롤링 데이터 동기화 (sync) 또는 챔피언/빌드 통계 업서트
export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return jsonResponse({
        success: false,
        error: 'Cloudflare D1 database (env.DB) is not configured.',
      }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action || 'sync';

    if (action === 'sync') {
      // 롤PS/DeepLoL 기준 크롤링 및 D1 DB 저장
      const result = await syncLolMetaStatsToD1(env.DB, {
        tierDivision: body?.tierDivision || 'emerald',
        patchVersion: body?.patchVersion || '15.14.1',
      });

      return jsonResponse({
        success: true,
        source: 'cloudflare-d1',
        ...result,
      });
    }

    if (action === 'batch_upsert') {
      const { champions = [], builds = [] } = body;
      const res = await batchUpsertMetaStats(env.DB, champions, builds);
      return jsonResponse({
        success: true,
        source: 'cloudflare-d1',
        insertedCount: res.insertedCount,
      });
    }

    return jsonResponse({
      success: false,
      error: `Unknown action: ${action}`,
    }, 400);
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: err?.message || 'Failed to process D1 sync operation',
    }, 500);
  }
};
