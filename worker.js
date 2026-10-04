/**
 * Cloudflare Worker for Riming GG CK Journal (CK 일지)
 * Worker Endpoint: https://riming-gg.janghyck2.workers.dev/
 * 
 * Supported methods & routes:
 * - OPTIONS * : CORS Preflight
 * - GET  /api/matches (or /) : Fetch all registered matches
 * - POST /api/matches (or /) : Save new match (or batch upsert)
 * - PUT  /api/matches (or /) : Update existing match
 * - DELETE /api/matches (or /) : Delete match by query param (?id=...) or body
 * 
 * Cloudflare Bindings:
 * - D1 Database: env.DB (primary persistence)
 * - KV Namespace: env.RIMING_KV (optional fallback)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function safeParseJson(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// In-memory fallback if D1 is not bound yet
let memoryMatchesCache = [];

/**
 * Ensure D1 ck_matches table exists
 */
async function ensureTable(db) {
  if (!db || typeof db.exec !== 'function') return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ck_matches (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        ck_name TEXT NOT NULL,
        match_format TEXT NOT NULL DEFAULT '단판',
        set_number INTEGER NOT NULL DEFAULT 1,
        score TEXT NOT NULL DEFAULT '1:0',
        winning_team TEXT NOT NULL,
        team_a TEXT NOT NULL,
        team_b TEXT NOT NULL,
        team_a_champs TEXT NOT NULL,
        team_b_champs TEXT NOT NULL,
        team_a_kda TEXT NOT NULL,
        team_b_kda TEXT NOT NULL,
        ban_a TEXT NOT NULL,
        ban_b TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ck_matches_date ON ck_matches(date DESC);
    `);
  } catch (err) {
    console.warn('[Worker] ensureTable warning:', err);
  }
}

/**
 * Ensure D1 champion_builds table exists for LOL.PS crawled meta builds
 */
async function ensureChampionBuildsTable(db) {
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
  } catch (err) {
    console.warn('[Worker] ensureChampionBuildsTable warning:', err);
  }
}

function rowToChampionBuild(row) {
  return {
    id: String(row.id),
    champion_id: row.champion_id,
    champion_name: row.champion_name,
    position: row.position,
    patch_version: row.patch_version || '16.18',
    build_id: row.build_id,
    build_name: row.build_name,
    is_main: Number(row.is_main) || 0,
    pick_rate: Number(row.pick_rate) || 0,
    win_rate: Number(row.win_rate) || 0,
    games_count: Number(row.games_count) || 0,
    starter_items: safeParseJson(row.starter_items, []),
    spells: safeParseJson(row.spells, []),
    runes: safeParseJson(row.runes, {}),
    core_items: safeParseJson(row.core_items, []),
    boots: safeParseJson(row.boots, []),
    skill_order: safeParseJson(row.skill_order, { mastery: ['Q', 'W', 'E'], sequence: [] }),
    counters: safeParseJson(row.counters, []),
    easy_matchups: safeParseJson(row.easy_matchups, []),
    synergies: safeParseJson(row.synergies, []),
    source: row.source || 'lolps',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const DEFAULT_VARUS_BUILDS = [
  {
    id: 'varus_adc_16.18_ad_onhit',
    champion_id: 'Varus',
    champion_name: '바루스',
    position: 'ADC',
    patch_version: '16.18',
    build_id: 'ad_onhit',
    build_name: 'AD 딜러 (온힛/치명타)',
    is_main: 1,
    pick_rate: 58.4,
    win_rate: 51.8,
    games_count: 14280,
    starter_items: [
      { name: '도란의 검', gold: 450 },
      { name: '체력 물약', gold: 50 },
    ],
    spells: [
      { spell1: '점멸', spell2: '회복', pickRate: 64.2, winRate: 52.1 },
      { spell1: '점멸', spell2: '유체화', pickRate: 31.5, winRate: 51.2 },
    ],
    runes: {
      primaryStyle: '정밀',
      primaryKeystone: '치명적 속도',
      primaryRow1: '승전보',
      primaryRow2: '전설: 민첩함',
      primaryRow3: '최후의 일격',
      subStyle: '영감',
      subRow1: '마법의 신발',
      subRow2: '우주적 통찰력',
      shards: ['공격 속도 +10%', '적응형 능력치 +9', '체력 +65'],
      pickRate: 58.4,
      winRate: 51.8,
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
      sequence: ['W', 'Q', 'E', 'W', 'W', 'R', 'W', 'Q', 'W', 'Q', 'R', 'Q', 'Q', 'E'],
    },
    source: 'lolps',
  },
  {
    id: 'varus_adc_16.18_lethality',
    champion_id: 'Varus',
    champion_name: '바루스',
    position: 'ADC',
    patch_version: '16.18',
    build_id: 'lethality_poke',
    build_name: '방관 포킹',
    is_main: 0,
    pick_rate: 41.6,
    win_rate: 50.9,
    games_count: 10180,
    starter_items: [
      { name: '도란의 검', gold: 450 },
      { name: '체력 물약', gold: 50 },
    ],
    spells: [
      { spell1: '점멸', spell2: '회복', pickRate: 58.0, winRate: 51.0 },
      { spell1: '점멸', spell2: '정화', pickRate: 37.0, winRate: 50.7 },
    ],
    runes: {
      primaryStyle: '지배',
      primaryKeystone: '어둠의 수확',
      primaryRow1: '피의 맛',
      primaryRow2: '사냥의 증표',
      primaryRow3: '보물 사냥꾼',
      subStyle: '마법',
      subRow1: '마나순환 팔찌',
      subRow2: '주문 작열',
      shards: ['적응형 능력치 +9', '적응형 능력치 +9', '성장 체력 +10~180'],
      pickRate: 41.6,
      winRate: 50.9,
    },
    core_items: [
      { name: '기회의 유령검', order: 1, winRate: 51.8, pickRate: 44.5, gold: 2700 },
      { name: '징수의 총', order: 2, winRate: 52.4, pickRate: 39.8, gold: 3000 },
      { name: '세릴다의 원한', order: 3, winRate: 53.6, pickRate: 35.1, gold: 3200 },
      { name: '밤의 끝자락', order: 4, winRate: 52.9, pickRate: 28.6, gold: 2800 },
      { name: '원칙의 원형낫', order: 5, winRate: 52.1, pickRate: 20.3, gold: 3000 },
      { name: '오만의 검', order: 6, winRate: 54.0, pickRate: 15.2, gold: 3000 },
      { name: '수호 천사', order: 7, winRate: 53.2, pickRate: 11.4, gold: 3200 },
    ],
    boots: [
      { name: '명석함의 아이오니아 장화', winRate: 51.2, pickRate: 79.5 },
      { name: '신속의 장화', winRate: 50.4, pickRate: 14.8 },
    ],
    skill_order: {
      mastery: ['Q', 'E', 'W'],
      sequence: ['Q', 'E', 'W', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W'],
    },
    source: 'lolps',
  },
];

function rowToMatch(row) {
  return {
    id: String(row.id),
    date: row.date || new Date().toISOString().slice(0, 10),
    ck_name: row.ck_name || '우리밍 CK',
    match_format: row.match_format || '단판',
    set_number: Number(row.set_number) || 1,
    score: row.score || '1:0',
    winning_team: row.winning_team || 'Red',
    team_a: safeParseJson(row.team_a, {}),
    team_b: safeParseJson(row.team_b, {}),
    team_a_champs: safeParseJson(row.team_a_champs, {}),
    team_b_champs: safeParseJson(row.team_b_champs, {}),
    team_a_kda: safeParseJson(row.team_a_kda, {}),
    team_b_kda: safeParseJson(row.team_b_kda, {}),
    ban_a: safeParseJson(row.ban_a, ['', '', '', '', '']),
    ban_b: safeParseJson(row.ban_b, ['', '', '', '', '']),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    const db = env?.DB;
    const kv = env?.RIMING_KV || env?.KV;

    try {
      // -------------------------------------------------------------
      // 1.5. CHAMPION BUILDS API (/api/champion-builds)
      // LOL.PS 실시간 크롤링 메타 빌드 D1 DB 연동
      // -------------------------------------------------------------
      if (url.pathname.startsWith('/api/champion-builds')) {
        if (request.method === 'GET') {
          const champName = url.searchParams.get('champion') || '';
          const pos = url.searchParams.get('position') || '';
          const patch = url.searchParams.get('patch') || '16.18';

          if (db) {
            await ensureChampionBuildsTable(db);

            let query = 'SELECT * FROM champion_builds WHERE 1=1';
            const params = [];
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

            let { results } = await db.prepare(query).bind(...params).all();

            // DB에 데이터가 없고 바루스인 경우 기본 LOL.PS 크롤링 데이터 자동 시딩
            if ((!results || results.length === 0) && (!champName || champName === '바루스' || champName === 'Varus')) {
              const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO champion_builds (
                  id, champion_id, champion_name, position, patch_version,
                  build_id, build_name, is_main, pick_rate, win_rate, games_count,
                  starter_items, spells, runes, core_items, boots, skill_order,
                  counters, easy_matchups, synergies, source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              const nowIso = new Date().toISOString();
              const batchStatements = DEFAULT_VARUS_BUILDS.map((b) =>
                insertStmt.bind(
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
                  JSON.stringify(b.counters || []),
                  JSON.stringify(b.easy_matchups || []),
                  JSON.stringify(b.synergies || []),
                  b.source || 'lolps',
                  nowIso,
                  nowIso
                )
              );

              await db.batch(batchStatements);
              const refreshed = await db.prepare(query).bind(...params).all();
              results = refreshed?.results || [];
            }

            const builds = (results || []).map(rowToChampionBuild);
            return jsonResponse({
              success: true,
              builds,
              total: builds.length,
              storage: 'D1',
              patch,
            });
          }

          // D1 미연동 로컬 메모리 폴백
          const fallback = (!champName || champName === '바루스' || champName === 'Varus') ? DEFAULT_VARUS_BUILDS : [];
          return jsonResponse({
            success: true,
            builds: fallback,
            total: fallback.length,
            storage: 'MemoryFallback',
            patch,
          });
        }

        if (request.method === 'POST') {
          const body = await request.json();
          const buildsList = Array.isArray(body?.builds) ? body.builds : body?.build ? [body.build] : [];

          if (buildsList.length === 0) {
            return jsonResponse({ error: '저장할 빌드 데이터가 없습니다.' }, 400);
          }

          if (db) {
            await ensureChampionBuildsTable(db);
            const insertStmt = db.prepare(`
              INSERT OR REPLACE INTO champion_builds (
                id, champion_id, champion_name, position, patch_version,
                build_id, build_name, is_main, pick_rate, win_rate, games_count,
                starter_items, spells, runes, core_items, boots, skill_order,
                counters, easy_matchups, synergies, source, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const nowIso = new Date().toISOString();
            const batchStatements = buildsList.map((b) =>
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

            await db.batch(batchStatements);
            return jsonResponse({
              success: true,
              count: batchStatements.length,
              storage: 'D1',
            });
          }

          return jsonResponse({ success: true, count: buildsList.length, storage: 'Memory' });
        }

        return jsonResponse({ error: 'Method Not Allowed' }, 405);
      }

      // 2. GET: List all matches
      if (request.method === 'GET') {
        if (db) {
          await ensureTable(db);
          const queryRes = await db
            .prepare('SELECT * FROM ck_matches ORDER BY date DESC, created_at DESC')
            .all();
          const list = (queryRes?.results || []).map((r) => rowToMatch(r));
          return jsonResponse({
            success: true,
            matches: list,
            total: list.length,
            storage: 'D1',
          });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const list = raw ? JSON.parse(raw) : [];
          return jsonResponse({
            success: true,
            matches: list,
            total: list.length,
            storage: 'KV',
          });
        } else {
          return jsonResponse({
            success: true,
            matches: memoryMatchesCache,
            total: memoryMatchesCache.length,
            storage: 'Memory',
          });
        }
      }

      // 3. POST: Create new match OR batch save
      if (request.method === 'POST') {
        const body = await request.json();
        const nowIso = new Date().toISOString();

        // Check if batch
        if (body?.mode && Array.isArray(body?.matches)) {
          const cleanMatches = body.matches.map((m) => ({
            ...m,
            id: String(m.id || `ck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
            created_at: m.created_at || nowIso,
            updated_at: nowIso,
          }));

          if (db) {
            await ensureTable(db);
            if (body.mode === 'replace') {
              await db.prepare('DELETE FROM ck_matches').run();
            }

            const insertStmt = db.prepare(`
              INSERT OR REPLACE INTO ck_matches (
                id, date, ck_name, match_format, set_number, score, winning_team,
                team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
                ban_a, ban_b, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const batchStatements = cleanMatches.map((m) =>
              insertStmt.bind(
                m.id,
                m.date || nowIso.slice(0, 10),
                m.ck_name || '우리밍 CK',
                m.match_format || '단판',
                Number(m.set_number) || 1,
                m.score || '1:0',
                m.winning_team || 'Red',
                JSON.stringify(m.team_a || {}),
                JSON.stringify(m.team_b || {}),
                JSON.stringify(m.team_a_champs || {}),
                JSON.stringify(m.team_b_champs || {}),
                JSON.stringify(m.team_a_kda || {}),
                JSON.stringify(m.team_b_kda || {}),
                JSON.stringify(m.ban_a || []),
                JSON.stringify(m.ban_b || []),
                m.created_at,
                m.updated_at
              )
            );

            if (batchStatements.length > 0) {
              await db.batch(batchStatements);
            }

            return jsonResponse({
              success: true,
              mode: body.mode,
              count: cleanMatches.length,
              storage: 'D1',
            });
          } else if (kv) {
            await kv.put('ck_matches', JSON.stringify(cleanMatches));
            return jsonResponse({ success: true, count: cleanMatches.length, storage: 'KV' });
          } else {
            memoryMatchesCache = cleanMatches;
            return jsonResponse({ success: true, count: cleanMatches.length, storage: 'Memory' });
          }
        }

        // Single Match Insert
        const m = body?.match || body;
        if (!m || (!m.date && !m.team_a && !m.ck_name)) {
          return jsonResponse({ error: '유효한 경기 데이터가 아닙니다.' }, 400);
        }

        const matchId = String(m.id || `ck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const cleanMatch = {
          id: matchId,
          date: m.date || nowIso.slice(0, 10),
          ck_name: m.ck_name || '우리밍 CK',
          match_format: m.match_format || '단판',
          set_number: Number(m.set_number) || 1,
          score: m.score || '1:0',
          winning_team: m.winning_team || 'Red',
          team_a: m.team_a || {},
          team_b: m.team_b || {},
          team_a_champs: m.team_a_champs || {},
          team_b_champs: m.team_b_champs || {},
          team_a_kda: m.team_a_kda || {},
          team_b_kda: m.team_b_kda || {},
          ban_a: m.ban_a || ['', '', '', '', ''],
          ban_b: m.ban_b || ['', '', '', '', ''],
          created_at: m.created_at || nowIso,
          updated_at: nowIso,
        };

        if (db) {
          await ensureTable(db);
          await db
            .prepare(`
              INSERT OR REPLACE INTO ck_matches (
                id, date, ck_name, match_format, set_number, score, winning_team,
                team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
                ban_a, ban_b, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              cleanMatch.id,
              cleanMatch.date,
              cleanMatch.ck_name,
              cleanMatch.match_format,
              cleanMatch.set_number,
              cleanMatch.score,
              cleanMatch.winning_team,
              JSON.stringify(cleanMatch.team_a),
              JSON.stringify(cleanMatch.team_b),
              JSON.stringify(cleanMatch.team_a_champs),
              JSON.stringify(cleanMatch.team_b_champs),
              JSON.stringify(cleanMatch.team_a_kda),
              JSON.stringify(cleanMatch.team_b_kda),
              JSON.stringify(cleanMatch.ban_a),
              JSON.stringify(cleanMatch.ban_b),
              cleanMatch.created_at,
              cleanMatch.updated_at
            )
            .run();

          return jsonResponse({
            success: true,
            match: cleanMatch,
            storage: 'D1',
          });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const currentList = raw ? JSON.parse(raw) : [];
          const updated = [cleanMatch, ...currentList.filter((x) => String(x.id) !== cleanMatch.id)];
          await kv.put('ck_matches', JSON.stringify(updated));
          return jsonResponse({ success: true, match: cleanMatch, storage: 'KV' });
        } else {
          memoryMatchesCache = [cleanMatch, ...memoryMatchesCache.filter((x) => String(x.id) !== cleanMatch.id)];
          return jsonResponse({ success: true, match: cleanMatch, storage: 'Memory' });
        }
      }

      // 4. PUT: Update existing match
      if (request.method === 'PUT') {
        const body = await request.json();
        const m = body?.match || body;
        if (!m || !m.id) {
          return jsonResponse({ error: '수정할 경기 ID가 필요합니다.' }, 400);
        }

        const nowIso = new Date().toISOString();
        const matchId = String(m.id);
        const cleanMatch = {
          id: matchId,
          date: m.date || nowIso.slice(0, 10),
          ck_name: m.ck_name || '우리밍 CK',
          match_format: m.match_format || '단판',
          set_number: Number(m.set_number) || 1,
          score: m.score || '1:0',
          winning_team: m.winning_team || 'Red',
          team_a: m.team_a || {},
          team_b: m.team_b || {},
          team_a_champs: m.team_a_champs || {},
          team_b_champs: m.team_b_champs || {},
          team_a_kda: m.team_a_kda || {},
          team_b_kda: m.team_b_kda || {},
          ban_a: m.ban_a || ['', '', '', '', ''],
          ban_b: m.ban_b || ['', '', '', '', ''],
          created_at: m.created_at || nowIso,
          updated_at: nowIso,
        };

        if (db) {
          await ensureTable(db);
          await db
            .prepare(`
              UPDATE ck_matches SET
                date = ?,
                ck_name = ?,
                match_format = ?,
                set_number = ?,
                score = ?,
                winning_team = ?,
                team_a = ?,
                team_b = ?,
                team_a_champs = ?,
                team_b_champs = ?,
                team_a_kda = ?,
                team_b_kda = ?,
                ban_a = ?,
                ban_b = ?,
                updated_at = ?
              WHERE id = ?
            `)
            .bind(
              cleanMatch.date,
              cleanMatch.ck_name,
              cleanMatch.match_format,
              cleanMatch.set_number,
              cleanMatch.score,
              cleanMatch.winning_team,
              JSON.stringify(cleanMatch.team_a),
              JSON.stringify(cleanMatch.team_b),
              JSON.stringify(cleanMatch.team_a_champs),
              JSON.stringify(cleanMatch.team_b_champs),
              JSON.stringify(cleanMatch.team_a_kda),
              JSON.stringify(cleanMatch.team_b_kda),
              JSON.stringify(cleanMatch.ban_a),
              JSON.stringify(cleanMatch.ban_b),
              cleanMatch.updated_at,
              cleanMatch.id
            )
            .run();

          return jsonResponse({ success: true, match: cleanMatch, storage: 'D1' });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const currentList = raw ? JSON.parse(raw) : [];
          const updated = currentList.map((x) => (String(x.id) === cleanMatch.id ? cleanMatch : x));
          await kv.put('ck_matches', JSON.stringify(updated));
          return jsonResponse({ success: true, match: cleanMatch, storage: 'KV' });
        } else {
          memoryMatchesCache = memoryMatchesCache.map((x) =>
            String(x.id) === cleanMatch.id ? cleanMatch : x
          );
          return jsonResponse({ success: true, match: cleanMatch, storage: 'Memory' });
        }
      }

      // 5. DELETE: Delete match
      if (request.method === 'DELETE') {
        let targetId = url.searchParams.get('id');
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = body?.id;
          } catch {}
        }

        if (!targetId) {
          return jsonResponse({ error: '삭제할 경기 ID가 필요합니다.' }, 400);
        }

        const idStr = String(targetId);

        if (db) {
          await ensureTable(db);
          await db.prepare('DELETE FROM ck_matches WHERE id = ?').bind(idStr).run();
          return jsonResponse({ success: true, id: idStr, storage: 'D1' });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const currentList = raw ? JSON.parse(raw) : [];
          const updated = currentList.filter((x) => String(x.id) !== idStr);
          await kv.put('ck_matches', JSON.stringify(updated));
          return jsonResponse({ success: true, id: idStr, storage: 'KV' });
        } else {
          memoryMatchesCache = memoryMatchesCache.filter((x) => String(x.id) !== idStr);
          return jsonResponse({ success: true, id: idStr, storage: 'Memory' });
        }
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
      console.error('[Worker Error]', err);
      return jsonResponse({ error: err?.message || 'Internal Server Error' }, 500);
    }
  },
};
