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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
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
 * Ensure D1 ck_matches & streamers tables exist
 */
// Pre-seeded authoritative 91 streamers list
const DEFAULT_STREAMERS_DATA = [{"name":"우리밍_","soop_id":"kmj05317","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:17:47.282Z","memo":""},{"name":"#김동하","soop_id":"likekk","main_position":"top","is_hidden":false,"memo":"","updated_at":"2026-11-04T08:04:50.476Z"},{"name":"＃김동하","soop_id":"likekk","main_position":"mid","is_hidden":false,"updated_at":"2026-11-03T09:30:04.296Z"},{"name":"#민찬기","soop_id":"minchanki","main_position":"mid","is_hidden":false,"updated_at":"2026-11-04T08:25:11.230Z","memo":""},{"name":"˚서건우","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"1vsAll","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"감블러","soop_id":"gambler","main_position":"adc","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"광폿","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"구스범스","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"김구거구거","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"김군","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"김레인♥","soop_id":"kimrain","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"김민교.","soop_id":"minkyo1994","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"김세아","soop_id":"kimseah94","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"김야미♥","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"깐숙","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"깽깽이.","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"꿀탱탱","soop_id":"kkultt","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"꿀템은죽었다","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"뀨삐","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"나는눈꽃.","soop_id":"snowflower","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"나는상윤","soop_id":"sangyoon","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"나무늘봉순","soop_id":"namunlbong","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"나연아.","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"나옹이빵","soop_id":"","main_position":"adc","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"나탈리-","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"냥꼬밍","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"냥츠","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-03T10:34:43.665Z"},{"name":"뇽이♥","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"눈길.","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.134Z","memo":""},{"name":"다나짱♥","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"듀단.","soop_id":"dydan","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"디나이05","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"디임","soop_id":"diim","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"란쵸","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"로코볼","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"로키05","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"린다랑b","soop_id":"lindarang","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"마우낭","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"문또농","soop_id":"","main_position":"adc","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"미쓰리","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"미키.","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"백지라구","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"뱃뉴BDNS","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"병헌.","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"빵지니♥","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"뿌리.","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"상어녀","soop_id":"eun7432","main_position":"adc","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"샤코타임0","soop_id":"shacotime","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"서도일","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"성훈-","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"수주-","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"스맵임","soop_id":"smeb","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"쏘대장","soop_id":"ssodaezang","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"아뚱.","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"아뜨_","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.134Z","memo":""},{"name":"아이보리__","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"앵지","soop_id":"angji","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"야옹민지","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"엊우진","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"여올","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"영재애애","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"오뀨","soop_id":"oggyu","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"옥맨","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"우치!","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"유복실","soop_id":"","main_position":"adc","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"윤코#","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.134Z","memo":""},{"name":"으냉이","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"이경민+_+","soop_id":"leekyeongmin","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"이하름","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"임선비.","soop_id":"sunbi1024","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"장하니","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"저라뎃","soop_id":"jradet","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"전략적죽음","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"졈니","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"주보리♥","soop_id":"jubori","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"준밧드","soop_id":"junbadd","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"짐묵","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-03T08:05:07.123Z","memo":""},{"name":"찌미♥","soop_id":"","main_position":"adc","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"채니☆","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"최강이연지","soop_id":"","main_position":"adc","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"킹냥이","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"태영♥","soop_id":"","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"하두링","soop_id":"haduring","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"하로로.","soop_id":"haroro","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"하루98","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"한둬얼","soop_id":"","main_position":"jgl","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"헤니♥","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"효딤","soop_id":"hyodim","main_position":"mid","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"히댕","soop_id":"","main_position":"sup","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""},{"name":"히엉^^7","soop_id":"","main_position":"top","is_hidden":false,"updated_at":"2026-11-02T09:07:26.428Z","memo":""}];

async function ensureTable(db) {
  if (!db) return;
  try {
    if (typeof db.prepare === 'function') {
      await db.prepare(`
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
        )
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS streamers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          soop_id TEXT DEFAULT '',
          main_position TEXT NOT NULL DEFAULT 'mid',
          is_hidden INTEGER NOT NULL DEFAULT 0,
          memo TEXT DEFAULT '',
          updated_at TEXT NOT NULL
        )
      `).run();
      try {
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_streamers_name ON streamers(name)').run();
      } catch {}
    } else if (typeof db.exec === 'function') {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS streamers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          soop_id TEXT DEFAULT '',
          main_position TEXT NOT NULL DEFAULT 'mid',
          is_hidden INTEGER NOT NULL DEFAULT 0,
          memo TEXT DEFAULT '',
          updated_at TEXT NOT NULL
        );
      `);
    }
  } catch (err) {
    console.warn('[Worker] ensureTable warning:', err);
  }
}

async function seedDefaultStreamers(db) {
  if (!db || typeof db.prepare !== 'function') return;
  await ensureTable(db);
  const now = new Date().toISOString();
  for (const s of DEFAULT_STREAMERS_DATA) {
    try {
      const sId = s.id || ('s_' + (s.name || '').replace(/[._#^*♥-＃☆+s]/g, '').toLowerCase().trim());
      await db.prepare(`
        INSERT OR IGNORE INTO streamers (id, name, soop_id, main_position, is_hidden, memo, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sId,
        s.name,
        s.soop_id || '',
        s.main_position || 'mid',
        s.is_hidden ? 1 : 0,
        s.memo || '',
        s.updated_at || now
      ).run();
    } catch {}
  }
}

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
      if (url.pathname.startsWith('/api/admin/init-db')) {
        if (db) {
          await ensureTable(db);
          await seedDefaultStreamers(db);
          const res = await db
            .prepare("SELECT * FROM streamers ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC")
            .all();
          const list = (res?.results || []).map((r) => ({
            id: r.id,
            name: r.name,
            soop_id: r.soop_id || '',
            main_position: r.main_position || 'mid',
            is_hidden: Boolean(r.is_hidden),
            memo: r.memo || '',
            updated_at: r.updated_at,
          }));
          return jsonResponse({
            success: true,
            count: list.length,
            streamers: list,
            message: 'D1 데이터베이스 초기화 및 스트리머 명단 정돈 완료 (총 ' + list.length + '명)',
            storage: 'D1',
          });
        }
        return jsonResponse({
          success: true,
          count: DEFAULT_STREAMERS_DATA.length,
          streamers: DEFAULT_STREAMERS_DATA,
          message: '기본 스트리머 명단 복원 완료',
          storage: 'default',
        });
      }

      const isStreamersRoute = url.pathname.startsWith('/api/streamers') || url.searchParams.get('type') === 'streamer';
      if (isStreamersRoute) {
        if (db) await ensureTable(db);
        if (request.method === 'GET') {
          if (db) {
            try {
              let res = await db
                .prepare("SELECT * FROM streamers ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC")
                .all();
              let list = (res?.results || []).map((r) => ({
                id: r.id,
                name: r.name,
                soop_id: r.soop_id || '',
                main_position: r.main_position || 'mid',
                is_hidden: Boolean(r.is_hidden),
                memo: r.memo || '',
                updated_at: r.updated_at,
              }));

              if (list.length === 0) {
                await seedDefaultStreamers(db);
                res = await db
                  .prepare("SELECT * FROM streamers ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC")
                  .all();
                list = (res?.results || []).map((r) => ({
                  id: r.id,
                  name: r.name,
                  soop_id: r.soop_id || '',
                  main_position: r.main_position || 'mid',
                  is_hidden: Boolean(r.is_hidden),
                  memo: r.memo || '',
                  updated_at: r.updated_at,
                }));
              }

              if (list.length > 0) {
                return jsonResponse({ success: true, count: list.length, streamers: list, storage: 'D1' });
              }
            } catch (err) {
              console.warn('[Worker] D1 query error:', err);
            }
          }
          return jsonResponse({ success: true, count: DEFAULT_STREAMERS_DATA.length, streamers: DEFAULT_STREAMERS_DATA, storage: 'default' });
        }

        const isDeleteRoute = url.pathname.endsWith('/delete') || request.method === 'DELETE';
        if (isDeleteRoute) {
          let targetId = url.searchParams.get('id');
          let targetName = url.searchParams.get('name');
          let targetIds = [];
          let targetNames = [];

          const pathIdMatch = url.pathname.match(/^\/api\/streamers\/([^\/]+)$/);
          if (pathIdMatch && pathIdMatch[1] !== 'delete' && pathIdMatch[1] !== 'update') {
            const raw = decodeURIComponent(pathIdMatch[1]).trim();
            if (raw.startsWith('s_')) targetId = raw;
            else targetName = raw;
          }

          try {
            const body = await request.json().catch(() => ({}));
            if (body?.id) targetId = body.id;
            if (body?.name) targetName = body.name;
            if (Array.isArray(body?.ids)) targetIds = body.ids;
            if (Array.isArray(body?.names)) targetNames = body.names;
          } catch {}

          if (db) {
            await ensureTable(db);
            const idsToDelete = new Set();
            if (targetId && String(targetId).trim()) idsToDelete.add(String(targetId).trim());
            for (const id of targetIds) {
              if (id && typeof id === 'string' && id.trim()) idsToDelete.add(id.trim());
            }

            // 1. PRIMARY RULE: If primary key IDs are specified, delete ONLY matching primary key rows!
            if (idsToDelete.size > 0) {
              for (const id of idsToDelete) {
                try {
                  await db.prepare('DELETE FROM streamers WHERE id = ?').bind(id).run();
                } catch (err) {
                  console.warn(`[Worker] Failed to delete by id="${id}":`, err);
                }
              }
            } else {
              // 2. FALLBACK ONLY: If no ID was provided, delete by exact name
              const namesToDelete = new Set();
              if (targetName && String(targetName).trim()) namesToDelete.add(String(targetName).trim());
              for (const n of targetNames) {
                if (n && typeof n === 'string' && n.trim()) namesToDelete.add(n.trim());
              }
              for (const name of namesToDelete) {
                try {
                  await db.prepare('DELETE FROM streamers WHERE name = ?').bind(name).run();
                } catch (err) {
                  console.warn(`[Worker] Failed to delete by name="${name}":`, err);
                }
              }
            }

            const res = await db
              .prepare("SELECT * FROM streamers ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC")
              .all();
            const list = (res?.results || []).map((r) => ({
              id: r.id,
              name: r.name,
              soop_id: r.soop_id || '',
              main_position: r.main_position || 'mid',
              is_hidden: Boolean(r.is_hidden),
              memo: r.memo || '',
              updated_at: r.updated_at,
            }));
            return jsonResponse({ success: true, count: list.length, streamers: list, storage: 'D1' });
          }
          return jsonResponse({ success: true, message: 'Deleted' });
        }

        if (request.method === 'POST' || request.method === 'PUT') {
          const body = await request.json().catch(() => ({}));
          const nowIso = new Date().toISOString();

          // Extract optional :id from pathname: /api/streamers/:id
          const pathIdMatch = url.pathname.match(/^\/api\/streamers\/([^\/]+)$/);
          const pathId = pathIdMatch && pathIdMatch[1] !== 'update' && pathIdMatch[1] !== 'delete'
            ? decodeURIComponent(pathIdMatch[1]).trim()
            : null;

          const incoming = Array.isArray(body?.streamers)
            ? body.streamers
            : body?.streamer
            ? [body.streamer]
            : (body?.name || body?.soop_id || body?.id || pathId)
            ? [body]
            : [];

          if (incoming.length === 0) {
            return jsonResponse({ error: '수정할 스트리머 데이터가 없습니다.' }, 400);
          }

          if (db) {
            for (const item of incoming) {
              const cleanName = (item?.name || (pathId && !pathId.startsWith('s_') ? pathId : '')).trim();
              const stripped = cleanName.replace(/[\.\_\#\^\*\♥\-\＃\☆\+\s]/g, '').toLowerCase().trim();
              const sId = (item?.id || (pathId && pathId.startsWith('s_') ? pathId : '') || (stripped ? `s_${stripped}` : (cleanName ? `s_${cleanName}` : ''))).trim();
              const soopId = typeof item?.soop_id === 'string' ? item.soop_id.trim() : '';
              const position = item?.main_position || 'mid';
              const isHidden = item?.is_hidden ? 1 : 0;
              const memo = item?.memo || '';
              const updatedIso = item?.updated_at || nowIso;

              // 1. Direct D1 UPDATE targeting strictly by primary key ID first
              let changes = 0;
              if (sId) {
                try {
                  const updateById = await db
                    .prepare(`
                      UPDATE streamers 
                      SET name = CASE WHEN ? != '' THEN ? ELSE name END,
                          soop_id = ?, 
                          main_position = ?, 
                          is_hidden = ?, 
                          memo = ?, 
                          updated_at = ?
                      WHERE id = ?
                    `)
                    .bind(cleanName, cleanName, soopId, position, isHidden, memo, updatedIso, sId)
                    .run();
                  changes = updateById?.meta?.changes ?? updateById?.changes ?? 0;
                } catch (err) {
                  console.warn(`[Worker] UPDATE query for id="${sId}" warning:`, err);
                }
              }

              // Fallback to exact name only if no ID matched
              if (changes === 0 && cleanName) {
                try {
                  const updateByName = await db
                    .prepare(`
                      UPDATE streamers 
                      SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ?
                      WHERE name = ?
                    `)
                    .bind(soopId, position, isHidden, memo, updatedIso, cleanName)
                    .run();
                  changes = updateByName?.meta?.changes ?? updateByName?.changes ?? 0;
                } catch {}
              }

              // 2. If row not found in DB, insert it
              if (changes === 0 && (cleanName || sId)) {
                try {
                  await db
                    .prepare(`
                      INSERT INTO streamers (id, name, soop_id, main_position, is_hidden, memo, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?)
                    `)
                    .bind(sId, cleanName || sId, soopId, position, isHidden, memo, updatedIso)
                    .run();
                } catch {
                  await db
                    .prepare(`
                      UPDATE streamers 
                      SET soop_id = ?, main_position = ?, is_hidden = ?, memo = ?, updated_at = ?
                      WHERE id = ? OR name = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))
                    `)
                    .bind(soopId, position, isHidden, memo, updatedIso, sId, cleanName, cleanName)
                    .run();
                }
              }

              // 3. Sibling cleanup: update all symbol variations (e.g. '민찬기' vs '#민찬기' vs '＃민찬기')
              if (stripped) {
                try {
                  await db
                    .prepare(`
                      UPDATE streamers
                      SET soop_id = ?, main_position = ?, is_hidden = ?, updated_at = ?
                      WHERE name = ? OR name = ? OR name = ?
                    `)
                    .bind(soopId, position, isHidden, updatedIso, stripped, '#' + stripped, '＃' + stripped)
                    .run();
                } catch {}
              }
            }

            const res = await db
              .prepare("SELECT * FROM streamers ORDER BY CASE WHEN name = '우리밍_' OR name = '우리밍' THEN 0 ELSE 1 END, name ASC")
              .all();
            const rawList = (res?.results || []).map((r) => ({
              id: r.id,
              name: r.name,
              soop_id: r.soop_id || '',
              main_position: r.main_position || 'mid',
              is_hidden: Boolean(r.is_hidden),
              memo: r.memo || '',
              updated_at: r.updated_at,
            }));

            // Deduplicate variations of the same name (e.g. #민찬기 and 민찬기)
            const map = new Map();
            for (const r of rawList) {
              const key = (r.name || '').replace(/[\.\_\#\^\*\♥\-\＃\☆\+\s]/g, '').toLowerCase().trim() || r.name.toLowerCase().trim();
              const existing = map.get(key);
              if (!existing) {
                map.set(key, r);
              } else {
                if (!existing.soop_id && r.soop_id) {
                  map.set(key, r);
                } else if (r.soop_id && existing.soop_id && new Date(r.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
                  map.set(key, { ...existing, ...r, soop_id: r.soop_id });
                }
              }
            }

            const list = Array.from(map.values()).sort((a, b) => {
              if (a.name === '우리밍_' || a.name === '우리밍') return -1;
              if (b.name === '우리밍_' || b.name === '우리밍') return 1;
              return a.name.localeCompare(b.name, 'ko-KR');
            });

            return jsonResponse({ success: true, count: list.length, streamers: list, storage: 'D1' });
          }
          return jsonResponse({ success: true, count: incoming.length, streamers: incoming, storage: 'fallback' });
        }
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
