-- ==============================================================================
-- Cloudflare D1 Database Schema: LoL Meta Champions & Builds
-- Generated for Riming.GG D1 Binding (env.DB)
-- ==============================================================================

-- 1. champions 테이블
-- 챔피언 ID, 티어구간(brsilgolplat, emerald, diamond, master), 포지션(top, jungle, mid, adc, support),
-- 패치버전, 랭킹 순위, 순위 변동값(▲/▼), 챔피언 티어(1~5티어), 승률, 픽률, 밴률, 카운터 챔피언 ID 3개
CREATE TABLE IF NOT EXISTS champions (
  champion_id TEXT NOT NULL,
  champion_name TEXT NOT NULL,
  tier_division TEXT NOT NULL CHECK(tier_division IN ('brsilgolplat', 'emerald', 'diamond', 'master')),
  position TEXT NOT NULL CHECK(position IN ('top', 'jungle', 'mid', 'adc', 'support')),
  patch_version TEXT NOT NULL,
  ranking INTEGER NOT NULL,
  rank_change TEXT NOT NULL DEFAULT '-', -- e.g. '▲2', '▼1', '0', '-'
  tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 5), -- 1티어 ~ 5티어
  win_rate REAL NOT NULL, -- e.g. 52.34 (%)
  pick_rate REAL NOT NULL, -- e.g. 11.20 (%)
  ban_rate REAL NOT NULL, -- e.g. 18.50 (%)
  counter_champion_ids TEXT NOT NULL DEFAULT '[]', -- JSON Array: 카운터 챔피언 ID 3개 e.g. ["Camille", "Jax", "Fiora"]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (champion_id, tier_division, position, patch_version)
);

CREATE INDEX IF NOT EXISTS idx_champions_tier_pos ON champions (tier_division, position, ranking ASC);
CREATE INDEX IF NOT EXISTS idx_champions_patch ON champions (patch_version);
CREATE INDEX IF NOT EXISTS idx_champions_win_rate ON champions (win_rate DESC);

-- 2. builds 테이블
-- 챔피언 ID, 티어구간, 포지션, 메인 룬 트리(선택된 룬 목록 및 전체 트리 하이라이트 정보),
-- 보조 룬 트리, 능력치 파편, 시작 아이템, 추천 스펠, 1~5코어 아이템 빌드 트리, 추천 신발
CREATE TABLE IF NOT EXISTS builds (
  champion_id TEXT NOT NULL,
  champion_name TEXT NOT NULL,
  tier_division TEXT NOT NULL CHECK(tier_division IN ('brsilgolplat', 'emerald', 'diamond', 'master')),
  position TEXT NOT NULL CHECK(position IN ('top', 'jungle', 'mid', 'adc', 'support')),
  patch_version TEXT NOT NULL,
  main_rune_tree TEXT NOT NULL, -- JSON: { styleId, styleName, keystone, selectedRunes: [], fullTree: [[{id, name, icon, selected}], ...] }
  sub_rune_tree TEXT NOT NULL,  -- JSON: { styleId, styleName, selectedRunes: [], fullTree: [[{id, name, icon, selected}], ...] }
  stat_shards TEXT NOT NULL,    -- JSON: { offense: { id, name }, flex: { id, name }, defense: { id, name } }
  start_items TEXT NOT NULL,    -- JSON: [{ id, name, icon, winRate, pickRate }]
  spells TEXT NOT NULL,         -- JSON: [{ id, name, icon }, { id, name, icon }]
  core_items TEXT NOT NULL,     -- JSON: { core1: Item, core2: Item, core3: Item, core4: Item, core5: Item, paths: [...] }
  boots TEXT NOT NULL,          -- JSON: { id, name, icon, winRate, pickRate }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (champion_id, tier_division, position, patch_version)
);

CREATE INDEX IF NOT EXISTS idx_builds_lookup ON builds (champion_id, tier_division, position, patch_version);
