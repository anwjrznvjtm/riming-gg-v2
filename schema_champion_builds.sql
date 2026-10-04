-- ====================================================================
-- Cloudflare D1 Database Schema: champion_builds
-- LOL.PS 실시간 크롤링 챔피언 메타 빌드 데이터 저장 테이블
-- ====================================================================

CREATE TABLE IF NOT EXISTS champion_builds (
  id TEXT PRIMARY KEY,                       -- e.g. "varus_adc_16.18_build_1"
  champion_id TEXT NOT NULL,                 -- e.g. "Varus"
  champion_name TEXT NOT NULL,               -- e.g. "바루스"
  position TEXT NOT NULL,                    -- "TOP" | "JGL" | "MID" | "ADC" | "SUP"
  patch_version TEXT NOT NULL DEFAULT '16.18', -- 패치 버전 e.g. "16.18"
  build_id TEXT NOT NULL,                    -- 빌드 식별자 e.g. "ad_onhit", "ad_lethality"
  build_name TEXT NOT NULL,                  -- 빌드 명칭 e.g. "AD 온힛 딜러", "방관 포킹"
  is_main INTEGER NOT NULL DEFAULT 0,        -- 1: 1순위 최신 메타 빌드, 0: 서브 빌드
  pick_rate REAL NOT NULL DEFAULT 0.0,       -- 픽률 (%)
  win_rate REAL NOT NULL DEFAULT 0.0,        -- 승률 (%)
  games_count INTEGER DEFAULT 0,             -- 표본 게임 수
  starter_items TEXT NOT NULL DEFAULT '[]',  -- JSON: 시작 아이템 [{name, gold}]
  spells TEXT NOT NULL DEFAULT '[]',         -- JSON: 소환사 주문 [{spell1, spell2, pickRate, winRate}]
  runes TEXT NOT NULL DEFAULT '{}',          -- JSON: 룬 트리 (primaryStyle, primaryKeystone, rows, subStyle, subRows, shards)
  core_items TEXT NOT NULL DEFAULT '[]',     -- JSON: 1~7 코어 아이템 목록 [{name, order, winRate, pickRate, gold}]
  boots TEXT NOT NULL DEFAULT '[]',          -- JSON: 신발 목록 [{name, winRate, pickRate}]
  skill_order TEXT NOT NULL DEFAULT '{}',    -- JSON: 스킬 순서 {mastery: ['Q','W','E'], sequence: ['Q','W','E',...]}
  counters TEXT NOT NULL DEFAULT '[]',       -- JSON: 카운터 챔피언
  easy_matchups TEXT NOT NULL DEFAULT '[]',  -- JSON: 상대하기 쉬운 챔피언
  synergies TEXT NOT NULL DEFAULT '[]',      -- JSON: 시너지 챔피언
  source TEXT DEFAULT 'lolps',               -- 데이터 출처 e.g. "lolps"
  created_at TEXT NOT NULL,                  -- 생성 일시 (ISO String)
  updated_at TEXT NOT NULL                   -- 수정 일시 (ISO String)
);

-- 빠른 조회를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_champion_builds_lookup 
  ON champion_builds(champion_name, position, patch_version);

CREATE INDEX IF NOT EXISTS idx_champion_builds_pick 
  ON champion_builds(champion_name, pick_rate DESC);

CREATE INDEX IF NOT EXISTS idx_champion_builds_patch 
  ON champion_builds(patch_version);
