/**
 * src/types/d1Meta.ts
 * Cloudflare D1 LoL Meta & Builds Data Models
 */

export type MetaTierDivision = 'brsilgolplat' | 'emerald' | 'diamond' | 'master';
export type MetaPosition = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export interface RuneItem {
  id: number;
  name: string;
  icon: string;
  selected?: boolean;
}

export interface RuneTreeRow {
  slotIndex: number; // 0: Keystone, 1: Slot 1, 2: Slot 2, 3: Slot 3
  runes: RuneItem[];
}

export interface MainRuneTreeData {
  styleId: number;
  styleName: string; // e.g. '정밀' (Precision), '지배' (Domination), '마법' (Sorcery), '결의' (Resolve), '영감' (Inspiration)
  keystone: RuneItem;
  selectedRunes: RuneItem[];
  fullTree: RuneTreeRow[]; // 전체 트리 하이라이트 정보 (각 슬롯별 모든 룬 목록 및 선택 여부)
}

export interface SubRuneTreeData {
  styleId: number;
  styleName: string;
  selectedRunes: RuneItem[]; // 보조 룬 2개
  fullTree: RuneTreeRow[]; // 전체 트리 하이라이트 정보 (선택 슬롯 표시)
}

export interface StatShardItem {
  id: number;
  name: string; // e.g. '공격 속도 +10%', '적응형 능력치 +9', '스킬 가속 +8'
  icon?: string;
}

export interface StatShardsData {
  offense: StatShardItem; // 공격 파편
  flex: StatShardItem;    // 유연 파편
  defense: StatShardItem; // 방어 파편
}

export interface MetaItemInfo {
  id: number | string;
  name: string;
  icon?: string;
  price?: number;
  winRate?: number;
  pickRate?: number;
}

export interface MetaSpellInfo {
  id: string;
  name: string;
  icon?: string;
}

export interface CoreItemsBuildTree {
  core1: MetaItemInfo;
  core2: MetaItemInfo;
  core3: MetaItemInfo;
  core4: MetaItemInfo;
  core5: MetaItemInfo;
  buildPathSummary?: string[]; // e.g. ["몰락한 왕의 검", "구인수의 격노검", "루난의 허리케인", "불멸의 철갑궁", "도미닉 경의 인사"]
  winRate?: number;
  pickRate?: number;
  games?: number;
}

/**
 * D1 champions 테이블 행 구조
 */
export interface D1ChampionTierRow {
  champion_id: string;
  champion_name: string;
  tier_division: MetaTierDivision;
  position: MetaPosition;
  patch_version: string;
  ranking: number;
  rank_change: string; // e.g. '▲2', '▼1', '0', '-'
  tier: number; // 1~5
  win_rate: number; // % (e.g. 52.34)
  pick_rate: number; // % (e.g. 11.20)
  ban_rate: number; // % (e.g. 18.50)
  counter_champion_ids: string; // JSON string: string[] (3개 카운터 ID)
  created_at?: string;
  updated_at?: string;
}

/**
 * D1 builds 테이블 행 구조
 */
export interface D1ChampionBuildRow {
  champion_id: string;
  champion_name: string;
  tier_division: MetaTierDivision;
  position: MetaPosition;
  patch_version: string;
  main_rune_tree: string; // JSON: MainRuneTreeData
  sub_rune_tree: string;  // JSON: SubRuneTreeData
  stat_shards: string;    // JSON: StatShardsData
  start_items: string;    // JSON: MetaItemInfo[]
  spells: string;         // JSON: MetaSpellInfo[]
  core_items: string;     // JSON: CoreItemsBuildTree
  boots: string;          // JSON: MetaItemInfo
  created_at?: string;
  updated_at?: string;
}

/**
 * 애플리케이션 파싱 완료 모델 (JSON 파싱 후)
 */
export interface ChampionTierItem {
  championId: string;
  championName: string;
  tierDivision: MetaTierDivision;
  position: MetaPosition;
  patchVersion: string;
  ranking: number;
  rankChange: string;
  tier: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  counterChampionIds: string[]; // 카운터 챔피언 3개
}

export interface ChampionBuildItem {
  championId: string;
  championName: string;
  tierDivision: MetaTierDivision;
  position: MetaPosition;
  patchVersion: string;
  mainRuneTree: MainRuneTreeData;
  subRuneTree: SubRuneTreeData;
  statShards: StatShardsData;
  startItems: MetaItemInfo[];
  spells: MetaSpellInfo[];
  coreItems: CoreItemsBuildTree;
  boots: MetaItemInfo;
}
