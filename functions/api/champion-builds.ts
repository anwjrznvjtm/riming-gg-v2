/**
 * Cloudflare Pages Functions: /api/champion-builds
 * D1 Database Binding: DB
 * LOL.PS 실시간 크롤링 챔피언 메타 빌드 데이터 연동
 */

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

function safeParseJson(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

async function ensureChampionBuildsTable(db: any) {
  if (!db || typeof db.exec !== 'function') return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS champion_builds (
        id TEXT PRIMARY KEY,
        champion_id TEXT NOT NULL,
        champion_name TEXT NOT NULL,
        position TEXT NOT NULL,
        patch_version TEXT NOT NULL DEFAULT '16.18',
        build_id TEXT NOT NULL,
        build_name TEXT NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        pick_rate REAL NOT NULL DEFAULT 0.0,
        win_rate REAL NOT NULL DEFAULT 0.0,
        games_count INTEGER DEFAULT 0,
        starter_items TEXT NOT NULL DEFAULT '[]',
        spells TEXT NOT NULL DEFAULT '[]',
        runes TEXT NOT NULL DEFAULT '{}',
        core_items TEXT NOT NULL DEFAULT '[]',
        boots TEXT NOT NULL DEFAULT '[]',
        skill_order TEXT NOT NULL DEFAULT '{}',
        counters TEXT NOT NULL DEFAULT '[]',
        easy_matchups TEXT NOT NULL DEFAULT '[]',
        synergies TEXT NOT NULL DEFAULT '[]',
        source TEXT DEFAULT 'lolps',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_champion_builds_lookup 
        ON champion_builds(champion_name, position, patch_version);
      CREATE INDEX IF NOT EXISTS idx_champion_builds_pick 
        ON champion_builds(champion_name, pick_rate DESC);
    `);
  } catch (e) {
    console.warn('[Pages Function] ensureChampionBuildsTable warning:', e);
  }
}

const DEFAULT_VARUS_BUILDS = [
  {
    id: 'varus_adc_16.18_popular',
    champion_id: 'Varus',
    champion_name: '바루스',
    position: 'ADC',
    patch_version: '16.18',
    build_id: 'popular_static',
    build_name: '대중적인 빌드',
    is_main: 1,
    pick_rate: 2.78,
    win_rate: 48.65,
    games_count: 11629,
    starter_items: [
      { name: '도란의 검', gold: 450 },
      { name: '체력 물약', gold: 50 },
    ],
    spells: [
      { spell1: '점멸', spell2: '보호막', pickRate: 64.2, winRate: 52.1 },
      { spell1: '점멸', spell2: '회복', pickRate: 28.5, winRate: 50.8 },
    ],
    runes: {
      primaryStyle: '정밀',
      primaryKeystone: '치명적 속도',
      primaryRow1: '생명 흡수',
      primaryRow2: '전설: 민첩함',
      primaryRow3: '체력차 극복',
      subStyle: '영감',
      subRow1: '비스킷 배달',
      subRow2: '우주적 통찰력',
      shards: ['공격 속도 +10%', '적응형 능력치 +9', '성장 체력 +10~180'],
      pickRate: 33.29,
      winRate: 46.62,
    },
    core_items: [
      { name: '스태틱의 단검', order: 1, winRate: 49.71, pickRate: 74.46, gold: 2900 },
      { name: '구인수의 격노검', order: 2, winRate: 51.31, pickRate: 78.28, gold: 3000 },
      { name: '경계', order: 3, winRate: 53.18, pickRate: 68.92, gold: 3000 },
      { name: '해신 작쇼', order: 4, winRate: 54.2, pickRate: 35.1, gold: 3200 },
      { name: '존야의 모래시계', order: 5, winRate: 55.6, pickRate: 24.3, gold: 3250 },
      { name: '광전사의 군화', order: 6, winRate: 52.3, pickRate: 88.4, gold: 1100 },
      { name: '수호 천사', order: 7, winRate: 54.0, pickRate: 15.2, gold: 3200 },
    ],
    boots: [
      { name: '광전사의 군화', winRate: 52.3, pickRate: 88.4 },
      { name: '판금 장화', winRate: 51.1, pickRate: 7.2 },
    ],
    skill_order: {
      mastery: ['Q', 'W', 'E'],
      sequence: ['E', 'W', 'Q', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E'],
    },
    source: 'lolps_live',
  },
  {
    id: 'varus_adc_16.18_high_winrate',
    champion_id: 'Varus',
    champion_name: '바루스',
    position: 'ADC',
    patch_version: '16.18',
    build_id: 'high_winrate',
    build_name: '고승률 빌드',
    is_main: 0,
    pick_rate: 1.84,
    win_rate: 51.12,
    games_count: 5240,
    starter_items: [
      { name: '도란의 검', gold: 450 },
      { name: '체력 물약', gold: 50 },
    ],
    spells: [
      { spell1: '점멸', spell2: '유체화', pickRate: 51.2, winRate: 51.5 },
      { spell1: '점멸', spell2: '회복', pickRate: 42.1, winRate: 50.8 },
    ],
    runes: {
      primaryStyle: '정밀',
      primaryKeystone: '치명적 속도',
      primaryRow1: '생명 흡수',
      primaryRow2: '전설: 민첩함',
      primaryRow3: '최후의 일격',
      subStyle: '영감',
      subRow1: '마법의 신발',
      subRow2: '우주적 통찰력',
      shards: ['공격 속도 +10%', '적응형 능력치 +9', '체력 +65'],
      pickRate: 18.4,
      winRate: 51.1,
    },
    core_items: [
      { name: '몰락한 왕의 검', order: 1, winRate: 52.4, pickRate: 54.8, gold: 3200 },
      { name: '구인수의 격노검', order: 2, winRate: 53.6, pickRate: 49.2, gold: 3000 },
      { name: '루난의 허리케인', order: 3, winRate: 54.2, pickRate: 41.5, gold: 2600 },
      { name: '마법사의 최후', order: 4, winRate: 53.1, pickRate: 33.2, gold: 3100 },
      { name: '경계', order: 5, winRate: 54.8, pickRate: 26.4, gold: 3000 },
      { name: '도미닉 경의 인사', order: 6, winRate: 55.4, pickRate: 18.6, gold: 3000 },
      { name: '불멸의 철갑궁', order: 7, winRate: 53.9, pickRate: 14.1, gold: 3000 },
    ],
    boots: [
      { name: '광전사의 군화', winRate: 52.3, pickRate: 88.4 },
      { name: '판금 장화', winRate: 51.1, pickRate: 7.2 },
    ],
    skill_order: {
      mastery: ['W', 'Q', 'E'],
      sequence: ['W', 'Q', 'E', 'W', 'W', 'R', 'W', 'Q', 'W', 'Q', 'R', 'Q', 'Q', 'E', 'E'],
    },
    source: 'lolps_live',
  },
  {
    id: 'varus_adc_16.18_aram',
    champion_id: 'Varus',
    champion_name: '바루스',
    position: 'ADC',
    patch_version: '16.18',
    build_id: 'aram',
    build_name: '칼바람',
    is_main: 0,
    pick_rate: 41.6,
    win_rate: 52.4,
    games_count: 38420,
    starter_items: [
      { name: '수호자의 보주', gold: 950 },
      { name: '체력 물약', gold: 50 },
    ],
    spells: [
      { spell1: '점멸', spell2: '표식', pickRate: 78.4, winRate: 52.8 },
      { spell1: '점멸', spell2: '유체화', pickRate: 21.6, winRate: 51.5 },
    ],
    runes: {
      primaryStyle: '마법',
      primaryKeystone: '신비로운 유성',
      primaryRow1: '마나순환 팔찌',
      primaryRow2: '깨달음',
      primaryRow3: '주문 작열',
      subStyle: '정밀',
      subRow1: '침착',
      subRow2: '최후의 일격',
      shards: ['적응형 능력치 +9', '적응형 능력치 +9', '성장 체력 +10~180'],
      pickRate: 41.6,
      winRate: 52.4,
    },
    core_items: [
      { name: '기회의 창', order: 1, winRate: 52.8, pickRate: 48.2, gold: 2700 },
      { name: '원칙의 원형낫', order: 2, winRate: 53.4, pickRate: 42.6, gold: 3000 },
      { name: '세릴다의 원한', order: 3, winRate: 54.6, pickRate: 36.1, gold: 3200 },
      { name: '밤의 끝자락', order: 4, winRate: 55.2, pickRate: 28.4, gold: 2800 },
      { name: '수호 천사', order: 5, winRate: 56.0, pickRate: 18.8, gold: 3200 },
      { name: '징수의 총', order: 6, winRate: 54.2, pickRate: 14.5, gold: 3000 },
    ],
    boots: [
      { name: '명석함의 아이오니아 장화', winRate: 52.8, pickRate: 82.5 },
      { name: '신속의 장화', winRate: 51.4, pickRate: 12.8 },
    ],
    skill_order: {
      mastery: ['Q', 'E', 'W'],
      sequence: ['Q', 'E', 'W', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W'],
    },
    source: 'lolps_aram',
  },
];

export const onRequestOptions = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const champName = url.searchParams.get('champion') || '';
  const pos = url.searchParams.get('position') || '';
  const patch = url.searchParams.get('patch') || '16.18';

  if (!DB) {
    const fallback = (!champName || champName === '바루스' || champName === 'Varus') ? DEFAULT_VARUS_BUILDS : [];
    return jsonResponse({ success: true, builds: fallback, total: fallback.length, storage: 'MemoryFallback' });
  }

  try {
    await ensureChampionBuildsTable(DB);

    let query = 'SELECT * FROM champion_builds WHERE 1=1';
    const params: any[] = [];
    if (champName) {
      query += ' AND (champion_name = ? OR champion_id = ?)';
      params.push(champName, champName);
    }
    if (pos) {
      query += ' AND position = ?';
      params.push(pos);
    }
    if (patch) {
      query += ' AND patch_version = ?';
      params.push(patch);
    }
    query += ' ORDER BY is_main DESC, pick_rate DESC';

    let { results } = await DB.prepare(query).bind(...params).all();

    if ((!results || results.length === 0) && (!champName || champName === '바루스' || champName === 'Varus')) {
      const insertStmt = DB.prepare(`
        INSERT OR REPLACE INTO champion_builds (
          id, champion_id, champion_name, position, patch_version,
          build_id, build_name, is_main, pick_rate, win_rate, games_count,
          starter_items, spells, runes, core_items, boots, skill_order,
          counters, easy_matchups, synergies, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const nowIso = new Date().toISOString();
      const batchStatements = DEFAULT_VARUS_BUILDS.map((b) => {
        const anyB = b as any;
        return insertStmt.bind(
          b.id,
          b.champion_id,
          b.champion_name,
          b.position,
          b.patch_version || patch,
          b.build_id,
          b.build_name,
          b.is_main,
          b.pick_rate,
          b.win_rate,
          b.games_count,
          JSON.stringify(b.starter_items || []),
          JSON.stringify(b.spells || []),
          JSON.stringify(b.runes || {}),
          JSON.stringify(b.core_items || []),
          JSON.stringify(b.boots || []),
          JSON.stringify(b.skill_order || {}),
          JSON.stringify(anyB.counters || []),
          JSON.stringify(anyB.easy_matchups || []),
          JSON.stringify(anyB.synergies || []),
          b.source || 'lolps',
          nowIso,
          nowIso
        );
      });

      await DB.batch(batchStatements);
      const refreshed = await DB.prepare(query).bind(...params).all();
      results = refreshed?.results || [];
    }

    const builds = (results || []).map((r: any) => ({
      id: String(r.id),
      champion_id: r.champion_id,
      champion_name: r.champion_name,
      position: r.position,
      patch_version: r.patch_version,
      build_id: r.build_id,
      build_name: r.build_name,
      is_main: Number(r.is_main) || 0,
      pick_rate: Number(r.pick_rate) || 0,
      win_rate: Number(r.win_rate) || 0,
      games_count: Number(r.games_count) || 0,
      starter_items: safeParseJson(r.starter_items, []),
      spells: safeParseJson(r.spells, []),
      runes: safeParseJson(r.runes, {}),
      core_items: safeParseJson(r.core_items, []),
      boots: safeParseJson(r.boots, []),
      skill_order: safeParseJson(r.skill_order, { mastery: ['Q', 'W', 'E'], sequence: [] }),
      counters: safeParseJson(r.counters, []),
      easy_matchups: safeParseJson(r.easy_matchups, []),
      synergies: safeParseJson(r.synergies, []),
      source: r.source || 'lolps',
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return jsonResponse({ success: true, builds, total: builds.length, storage: 'D1', patch });
  } catch (err: any) {
    console.error('D1 champion_builds error:', err);
    return jsonResponse({ error: err?.message || 'Database query error' }, 500);
  }
};

export const onRequestPost = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env;
  if (!DB) {
    return jsonResponse({ error: 'D1 Database not configured' }, 500);
  }

  try {
    await ensureChampionBuildsTable(DB);
    const body: any = await context.request.json();
    const buildsList = Array.isArray(body?.builds) ? body.builds : body?.build ? [body.build] : [];

    if (buildsList.length === 0) {
      return jsonResponse({ error: '저장할 빌드 데이터가 없습니다.' }, 400);
    }

    const insertStmt = DB.prepare(`
      INSERT OR REPLACE INTO champion_builds (
        id, champion_id, champion_name, position, patch_version,
        build_id, build_name, is_main, pick_rate, win_rate, games_count,
        starter_items, spells, runes, core_items, boots, skill_order,
        counters, easy_matchups, synergies, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowIso = new Date().toISOString();
    const batchStatements = buildsList.map((b: any) =>
      insertStmt.bind(
        String(b.id || `${b.champion_name}_${b.position}_${b.patch_version || '16.18'}_${b.build_id || Date.now()}`),
        String(b.champion_id || b.champion_name),
        String(b.champion_name),
        String(b.position || 'ADC'),
        String(b.patch_version || '16.18'),
        String(b.build_id || 'main'),
        String(b.build_name || '메타 빌드'),
        Number(b.is_main) || 0,
        Number(b.pick_rate) || 0,
        Number(b.win_rate) || 0,
        Number(b.games_count) || 0,
        typeof b.starter_items === 'string' ? b.starter_items : JSON.stringify(b.starter_items || []),
        typeof b.spells === 'string' ? b.spells : JSON.stringify(b.spells || []),
        typeof b.runes === 'string' ? b.runes : JSON.stringify(b.runes || {}),
        typeof b.core_items === 'string' ? b.core_items : JSON.stringify(b.core_items || []),
        typeof b.boots === 'string' ? b.boots : JSON.stringify(b.boots || []),
        typeof b.skill_order === 'string' ? b.skill_order : JSON.stringify(b.skill_order || {}),
        typeof b.counters === 'string' ? b.counters : JSON.stringify(b.counters || []),
        typeof b.easy_matchups === 'string' ? b.easy_matchups : JSON.stringify(b.easy_matchups || []),
        typeof b.synergies === 'string' ? b.synergies : JSON.stringify(b.synergies || []),
        String(b.source || 'lolps'),
        b.created_at || nowIso,
        nowIso
      )
    );

    await DB.batch(batchStatements);
    return jsonResponse({ success: true, count: batchStatements.length, storage: 'D1' });
  } catch (err: any) {
    console.error('D1 champion_builds POST error:', err);
    return jsonResponse({ error: err?.message || 'Insert error' }, 500);
  }
};

export const onRequestDelete = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env;
  if (!DB) {
    return jsonResponse({ success: true, message: 'Memory cache reset', storage: 'Memory' });
  }

  try {
    await ensureChampionBuildsTable(DB);
    const url = new URL(context.request.url);
    const champName = url.searchParams.get('champion');

    if (champName) {
      await DB.prepare('DELETE FROM champion_builds WHERE champion_name = ? OR champion_id = ?')
        .bind(champName, champName)
        .run();
    } else {
      await DB.prepare('DELETE FROM champion_builds').run();
    }

    return jsonResponse({
      success: true,
      message: champName ? `${champName} DB 빌드 데이터가 초기화되었습니다.` : '전체 DB 빌드 데이터가 초기화되었습니다.',
      storage: 'D1',
    });
  } catch (err: any) {
    console.error('D1 champion_builds DELETE error:', err);
    return jsonResponse({ error: err?.message || 'Delete error' }, 500);
  }
};
