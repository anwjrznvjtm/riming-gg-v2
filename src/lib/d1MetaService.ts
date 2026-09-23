/**
 * src/lib/d1MetaService.ts
 * Cloudflare D1 Database (env.DB) Query & LolPS/DeepLoL Meta Processing Engine
 */

import {
  MetaTierDivision,
  MetaPosition,
  D1ChampionTierRow,
  D1ChampionBuildRow,
  ChampionTierItem,
  ChampionBuildItem,
  MainRuneTreeData,
  SubRuneTreeData,
  StatShardsData,
  CoreItemsBuildTree,
} from '../types/d1Meta';

/**
 * 1. Cloudflare D1 테이블 및 인덱스 자동 생성 (Ensure Schema)
 */
export async function ensureD1MetaTables(db: any): Promise<void> {
  if (!db || typeof db.exec !== 'function') {
    console.warn('[D1 Meta] env.DB is not bound or invalid.');
    return;
  }

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS champions (
      champion_id TEXT NOT NULL,
      champion_name TEXT NOT NULL,
      tier_division TEXT NOT NULL,
      position TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      ranking INTEGER NOT NULL,
      rank_change TEXT NOT NULL DEFAULT '-',
      tier INTEGER NOT NULL,
      win_rate REAL NOT NULL,
      pick_rate REAL NOT NULL,
      ban_rate REAL NOT NULL,
      counter_champion_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (champion_id, tier_division, position, patch_version)
    );

    CREATE INDEX IF NOT EXISTS idx_champions_tier_pos ON champions (tier_division, position, ranking ASC);
    CREATE INDEX IF NOT EXISTS idx_champions_patch ON champions (patch_version);

    CREATE TABLE IF NOT EXISTS builds (
      champion_id TEXT NOT NULL,
      champion_name TEXT NOT NULL,
      tier_division TEXT NOT NULL,
      position TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      main_rune_tree TEXT NOT NULL,
      sub_rune_tree TEXT NOT NULL,
      stat_shards TEXT NOT NULL,
      start_items TEXT NOT NULL,
      spells TEXT NOT NULL,
      core_items TEXT NOT NULL,
      boots TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (champion_id, tier_division, position, patch_version)
    );

    CREATE INDEX IF NOT EXISTS idx_builds_lookup ON builds (champion_id, tier_division, position, patch_version);
  `;

  try {
    await db.exec(schemaSql);
  } catch (err) {
    console.error('[D1 Meta] Failed to ensure tables:', err);
    throw err;
  }
}

/**
 * 2. 챔피언 티어 정보 단건 Upsert
 */
export async function upsertChampionTier(db: any, item: ChampionTierItem): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return;

  const now = new Date().toISOString();
  const sql = `
    INSERT INTO champions (
      champion_id, champion_name, tier_division, position, patch_version,
      ranking, rank_change, tier, win_rate, pick_rate, ban_rate, counter_champion_ids,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(champion_id, tier_division, position, patch_version) DO UPDATE SET
      champion_name = excluded.champion_name,
      ranking = excluded.ranking,
      rank_change = excluded.rank_change,
      tier = excluded.tier,
      win_rate = excluded.win_rate,
      pick_rate = excluded.pick_rate,
      ban_rate = excluded.ban_rate,
      counter_champion_ids = excluded.counter_champion_ids,
      updated_at = excluded.updated_at
  `;

  await db.prepare(sql).bind(
    item.championId,
    item.championName,
    item.tierDivision,
    item.position,
    item.patchVersion,
    item.ranking,
    item.rankChange || '-',
    item.tier,
    item.winRate,
    item.pickRate,
    item.banRate,
    JSON.stringify(item.counterChampionIds || []),
    now,
    now
  ).run();
}

/**
 * 3. 챔피언 빌드 정보 단건 Upsert
 */
export async function upsertChampionBuild(db: any, item: ChampionBuildItem): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return;

  const now = new Date().toISOString();
  const sql = `
    INSERT INTO builds (
      champion_id, champion_name, tier_division, position, patch_version,
      main_rune_tree, sub_rune_tree, stat_shards, start_items, spells, core_items, boots,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(champion_id, tier_division, position, patch_version) DO UPDATE SET
      champion_name = excluded.champion_name,
      main_rune_tree = excluded.main_rune_tree,
      sub_rune_tree = excluded.sub_rune_tree,
      stat_shards = excluded.stat_shards,
      start_items = excluded.start_items,
      spells = excluded.spells,
      core_items = excluded.core_items,
      boots = excluded.boots,
      updated_at = excluded.updated_at
  `;

  await db.prepare(sql).bind(
    item.championId,
    item.championName,
    item.tierDivision,
    item.position,
    item.patchVersion,
    JSON.stringify(item.mainRuneTree),
    JSON.stringify(item.subRuneTree),
    JSON.stringify(item.statShards),
    JSON.stringify(item.startItems || []),
    JSON.stringify(item.spells || []),
    JSON.stringify(item.coreItems),
    JSON.stringify(item.boots),
    now,
    now
  ).run();
}

/**
 * 4. D1 배치(Batch) 트랜잭션 대량 삽입 및 업데이트
 */
export async function batchUpsertMetaStats(
  db: any,
  champions: ChampionTierItem[],
  builds: ChampionBuildItem[]
): Promise<{ success: boolean; insertedCount: number }> {
  if (!db || typeof db.batch !== 'function') {
    throw new Error('D1 database binding does not support batch operations.');
  }

  await ensureD1MetaTables(db);
  const statements: any[] = [];
  const now = new Date().toISOString();

  // Champions insert statements
  const champSql = `
    INSERT INTO champions (
      champion_id, champion_name, tier_division, position, patch_version,
      ranking, rank_change, tier, win_rate, pick_rate, ban_rate, counter_champion_ids,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(champion_id, tier_division, position, patch_version) DO UPDATE SET
      champion_name = excluded.champion_name,
      ranking = excluded.ranking,
      rank_change = excluded.rank_change,
      tier = excluded.tier,
      win_rate = excluded.win_rate,
      pick_rate = excluded.pick_rate,
      ban_rate = excluded.ban_rate,
      counter_champion_ids = excluded.counter_champion_ids,
      updated_at = excluded.updated_at
  `;

  for (const c of champions) {
    statements.push(
      db.prepare(champSql).bind(
        c.championId,
        c.championName,
        c.tierDivision,
        c.position,
        c.patchVersion,
        c.ranking,
        c.rankChange || '-',
        c.tier,
        c.winRate,
        c.pickRate,
        c.banRate,
        JSON.stringify(c.counterChampionIds || []),
        now,
        now
      )
    );
  }

  // Builds insert statements
  const buildSql = `
    INSERT INTO builds (
      champion_id, champion_name, tier_division, position, patch_version,
      main_rune_tree, sub_rune_tree, stat_shards, start_items, spells, core_items, boots,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(champion_id, tier_division, position, patch_version) DO UPDATE SET
      champion_name = excluded.champion_name,
      main_rune_tree = excluded.main_rune_tree,
      sub_rune_tree = excluded.sub_rune_tree,
      stat_shards = excluded.stat_shards,
      start_items = excluded.start_items,
      spells = excluded.spells,
      core_items = excluded.core_items,
      boots = excluded.boots,
      updated_at = excluded.updated_at
  `;

  for (const b of builds) {
    statements.push(
      db.prepare(buildSql).bind(
        b.championId,
        b.championName,
        b.tierDivision,
        b.position,
        b.patchVersion,
        JSON.stringify(b.mainRuneTree),
        JSON.stringify(b.subRuneTree),
        JSON.stringify(b.statShards),
        JSON.stringify(b.startItems || []),
        JSON.stringify(b.spells || []),
        JSON.stringify(b.coreItems),
        JSON.stringify(b.boots),
        now,
        now
      )
    );
  }

  if (statements.length === 0) {
    return { success: true, insertedCount: 0 };
  }

  // D1 executes statements in batches (max 128 per batch recommended for D1)
  const chunkSize = 100;
  let totalProcessed = 0;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await db.batch(chunk);
    totalProcessed += chunk.length;
  }

  return { success: true, insertedCount: totalProcessed };
}

/**
 * 5. D1에서 포지션 및 티어구간별 챔피언 티어리스트 조회
 */
export async function queryChampionTierList(
  db: any,
  options?: {
    tierDivision?: MetaTierDivision;
    position?: MetaPosition;
    patchVersion?: string;
  }
): Promise<ChampionTierItem[]> {
  if (!db || typeof db.prepare !== 'function') return [];
  await ensureD1MetaTables(db);

  let sql = 'SELECT * FROM champions WHERE 1=1';
  const bindings: any[] = [];

  if (options?.tierDivision) {
    sql += ' AND tier_division = ?';
    bindings.push(options.tierDivision);
  }
  if (options?.position) {
    sql += ' AND position = ?';
    bindings.push(options.position);
  }
  if (options?.patchVersion) {
    sql += ' AND patch_version = ?';
    bindings.push(options.patchVersion);
  }

  sql += ' ORDER BY ranking ASC, win_rate DESC';

  const { results } = await db.prepare(sql).bind(...bindings).all();
  if (!results || !Array.isArray(results)) return [];

  return (results as D1ChampionTierRow[]).map((row) => ({
    championId: row.champion_id,
    championName: row.champion_name,
    tierDivision: row.tier_division,
    position: row.position,
    patchVersion: row.patch_version,
    ranking: row.ranking,
    rankChange: row.rank_change,
    tier: row.tier,
    winRate: row.win_rate,
    pickRate: row.pick_rate,
    banRate: row.ban_rate,
    counterChampionIds: safeJsonParse<string[]>(row.counter_champion_ids, []),
  }));
}

/**
 * 6. D1에서 특정 챔피언의 빌드(룬 트리 + 5코어 아이템 + 스펠 + 신발) 조회
 */
export async function queryChampionBuild(
  db: any,
  championId: string,
  options?: {
    tierDivision?: MetaTierDivision;
    position?: MetaPosition;
    patchVersion?: string;
  }
): Promise<ChampionBuildItem | null> {
  if (!db || typeof db.prepare !== 'function') return null;
  await ensureD1MetaTables(db);

  let sql = 'SELECT * FROM builds WHERE champion_id = ?';
  const bindings: any[] = [championId];

  if (options?.tierDivision) {
    sql += ' AND tier_division = ?';
    bindings.push(options.tierDivision);
  }
  if (options?.position) {
    sql += ' AND position = ?';
    bindings.push(options.position);
  }
  if (options?.patchVersion) {
    sql += ' AND patch_version = ?';
    bindings.push(options.patchVersion);
  }

  sql += ' ORDER BY updated_at DESC LIMIT 1';

  const row = (await db.prepare(sql).bind(...bindings).first()) as D1ChampionBuildRow | null;
  if (!row) return null;

  return {
    championId: row.champion_id,
    championName: row.champion_name,
    tierDivision: row.tier_division,
    position: row.position,
    patchVersion: row.patch_version,
    mainRuneTree: safeJsonParse<MainRuneTreeData>(row.main_rune_tree, {} as any),
    subRuneTree: safeJsonParse<SubRuneTreeData>(row.sub_rune_tree, {} as any),
    statShards: safeJsonParse<StatShardsData>(row.stat_shards, {} as any),
    startItems: safeJsonParse<any[]>(row.start_items, []),
    spells: safeJsonParse<any[]>(row.spells, []),
    coreItems: safeJsonParse<CoreItemsBuildTree>(row.core_items, {} as any),
    boots: safeJsonParse<any>(row.boots, {} as any),
  };
}

function safeJsonParse<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
