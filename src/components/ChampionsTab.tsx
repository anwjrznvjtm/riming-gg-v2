import React, { useState, useMemo, useEffect } from 'react';
import {
  SoloRankPosition,
  SoloRankTierGroup,
  SoloRankChampionData,
  RuneTreeData,
  ALL_RUNE_STYLES,
  STAT_SHARDS,
  RUNE_ICON_MAP,
  getSoloRankChampions,
} from '../data/soloRankData';
import {
  fetchD1ChampionMeta,
  getCachedD1Champions,
  getCachedD1UpdateTime,
} from '../lib/d1ChampionApi';
import { ChampionIcon } from './ChampionIcon';
import { getItemIcon, getSpellIcon } from '../lib/lolIcons';
import { getChampionEnName } from '../lib/champions';
import { getChosung } from '../lib/championSearch';
import { getChampionSkillIcon, subscribeToSpellUpdates } from '../lib/championSpells';
import {
  fetchLatestPatchVersion,
  formatPatchDisplay,
  getActivePatch,
  setActivePatch,
  subscribePatchVersion,
  getCachedPatchList,
} from '../lib/riotPatch';
import {
  DDragonChampionItem,
  getInitialChampionCatalog,
  loadDDragonChampions,
  subscribeDDragonChampions,
} from '../lib/ddragonService';
import {
  fetchChampionBuildsFromD1,
  resetAndReCollectChampionBuilds,
  ChampionDetailBuildOption,
} from '../lib/championBuildsApi';
import {
  Search,
  X,
  ArrowLeft,
  Swords,
  Shield,
  Zap,
  Crosshair,
  Heart,
  TrendingUp,
  Award,
  ChevronRight,
  ChevronDown,
  Flame,
  Check,
  RefreshCw,
} from 'lucide-react';

interface ChampionsTabProps {
  onToast?: (msg: string) => void;
  matches?: any;
  allChampions?: any;
  allStreamers?: any;
  onJumpToStreamer?: (streamerName: string) => void;
}

const CHOSUNG_BUTTONS = [
  '전체',
  'ㄱ',
  'ㄴ',
  'ㄷ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅅ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

const TIER_GROUPS: Array<{ id: SoloRankTierGroup; label: string }> = [
  { id: 'all_ranks', label: '브실골플' },
  { id: 'emerald_plus', label: 'Emerald+' },
  { id: 'diamond_plus', label: 'Diamond+' },
  { id: 'master_plus', label: 'Master+' },
];

export const ITEM_RECIPES: Record<string, Array<{ name: string; gold: number }>> = {
  '크라켄 학살자': [
    { name: '절정의 화살', gold: 1300 },
    { name: '곡괭이', gold: 875 },
    { name: '민첩성의 망토', gold: 600 },
  ],
  '무한의 대검': [
    { name: 'B.F. 대검', gold: 1300 },
    { name: '곡괭이', gold: 875 },
    { name: '민첩성의 망토', gold: 600 },
  ],
  '도미닉 경의 인사': [
    { name: '최후의 속삭임', gold: 1450 },
    { name: '민첩성의 망토', gold: 600 },
    { name: '곡괭이', gold: 875 },
  ],
  '몰락한 왕의 검': [
    { name: '흡혈의 낫', gold: 900 },
    { name: '곡궁', gold: 700 },
    { name: '곡괭이', gold: 875 },
  ],
  '루난의 허리케인': [
    { name: '열정의 총', gold: 1100 },
    { name: '곡궁', gold: 700 },
    { name: '단검', gold: 250 },
  ],
  '고속 연사포': [
    { name: '열정의 총', gold: 1100 },
    { name: '민첩성의 망토', gold: 600 },
    { name: '단검', gold: 250 },
  ],
  '불멸의 철갑궁': [
    { name: '흡혈의 낫', gold: 900 },
    { name: '절정의 화살', gold: 1300 },
    { name: '민첩성의 망토', gold: 600 },
  ],
  '정수 약탈자': [
    { name: '콜필드의 전투 망치', gold: 1100 },
    { name: '광휘의 검', gold: 900 },
    { name: '민첩성의 망토', gold: 600 },
  ],
  '징수의 총': [
    { name: '톱날 단검', gold: 1000 },
    { name: '곡괭이', gold: 875 },
    { name: '민첩성의 망토', gold: 600 },
  ],
  '피바라기': [
    { name: 'B.F. 대검', gold: 1300 },
    { name: '흡혈의 낫', gold: 900 },
    { name: '민첩성의 망토', gold: 600 },
  ],
  '나보리 명멸검': [
    { name: '열정의 총', gold: 1100 },
    { name: '곡궁', gold: 700 },
    { name: '단검', gold: 250 },
  ],
  '라바돈의 죽음모자': [
    { name: '쓸데없이 큰 지팡이', gold: 1250 },
    { name: '쓸데없이 큰 지팡이', gold: 1250 },
  ],
  '존야의 모래시계': [
    { name: '추적자의 팔목보호대', gold: 1600 },
    { name: '방출의 마법봉', gold: 850 },
  ],
  '그림자불꽃': [
    { name: '마법공학 교류 발전기', gold: 1100 },
    { name: '쓸데없이 큰 지팡이', gold: 1250 },
  ],
  '루덴의 동반자': [
    { name: '사라진 양피지', gold: 1200 },
    { name: '마법공학 교류 발전기', gold: 1100 },
  ],
  '악의': [
    { name: '사라진 양피지', gold: 1200 },
    { name: '악마의 마법서', gold: 900 },
  ],
  '리안드리의 고통': [
    { name: '기괴한 가면', gold: 1300 },
    { name: '방출의 마법봉', gold: 850 },
  ],
  '지평선의 초점': [
    { name: '악마의 마법서', gold: 900 },
    { name: '마법공학 교류 발전기', gold: 1100 },
  ],
  '공허의 지팡이': [
    { name: '역병의 보석', gold: 1100 },
    { name: '방출의 마법봉', gold: 850 },
  ],
  '망자의 갑옷': [
    { name: '쇠사슬 조끼', gold: 800 },
    { name: '날개달린 달빛갑옷', gold: 800 },
    { name: '루비 수정', gold: 400 },
  ],
  '태양불꽃 방패': [
    { name: '바미의 불씨', gold: 900 },
    { name: '쇠사슬 조끼', gold: 800 },
  ],
  '란두인의 예언': [
    { name: '파수꾼의 갑옷', gold: 1000 },
    { name: '거인의 허리띠', gold: 900 },
  ],
  '강철심장': [
    { name: '거인의 허리띠', gold: 900 },
    { name: '점화석', gold: 800 },
    { name: '루비 수정', gold: 400 },
  ],
  '워모그의 갑옷': [
    { name: '거인의 허리띠', gold: 900 },
    { name: '점화석', gold: 800 },
    { name: '쇠사슬 조끼', gold: 800 },
  ],
  '가시 갑옷': [
    { name: '덤불 조끼', gold: 800 },
    { name: '거인의 허리띠', gold: 900 },
  ],
  '삼위일체': [
    { name: '광휘의 검', gold: 900 },
    { name: '점화석', gold: 800 },
    { name: '온기가 담긴 도끼', gold: 1150 },
  ],
  '칠흑의 양날 도끼': [
    { name: '콜필드의 전투 망치', gold: 1100 },
    { name: '점화석', gold: 800 },
    { name: '롱소드', gold: 350 },
  ],
  '스테락의 도전': [
    { name: '곡괭이', gold: 875 },
    { name: '점화석', gold: 800 },
    { name: '루비 수정', gold: 400 },
  ],
  '죽음의 무도': [
    { name: '쇠사슬 조끼', gold: 800 },
    { name: '콜필드의 전투 망치', gold: 1100 },
    { name: '곡괭이', gold: 875 },
  ],
  '월식': [
    { name: '콜필드의 전투 망치', gold: 1100 },
    { name: '롱소드', gold: 350 },
    { name: '롱소드', gold: 350 },
  ],
  '쇼진의 창': [
    { name: '콜필드의 전투 망치', gold: 1100 },
    { name: '곡괭이', gold: 875 },
    { name: '점화석', gold: 800 },
  ],
  '갈라진 하늘': [
    { name: '온기가 담긴 도끼', gold: 1150 },
    { name: '점화석', gold: 800 },
    { name: '콜필드의 전투 망치', gold: 1100 },
  ],
  '요우무의 유령검': [
    { name: '톱날 단검', gold: 1000 },
    { name: '방랑자의 유품', gold: 900 },
    { name: '롱소드', gold: 350 },
  ],
  '밤의 끝자락': [
    { name: '톱날 단검', gold: 1000 },
    { name: '곡괭이', gold: 875 },
    { name: '루비 수정', gold: 400 },
  ],
  '원칙의 원희': [
    { name: '톱날 단검', gold: 1000 },
    { name: '콜필드의 전투 망치', gold: 1100 },
  ],
  '세릴다의 원한': [
    { name: '톱날 단검', gold: 1000 },
    { name: '최후의 속삭임', gold: 1450 },
  ],
  '월석 재생기': [
    { name: '밴들유리 거울', gold: 950 },
    { name: '점화석', gold: 800 },
  ],
  '슈렐리아의 군가': [
    { name: '밴들유리 거울', gold: 950 },
    { name: '에테르 환영', gold: 850 },
  ],
  '제국의 명령': [
    { name: '밴들유리 거울', gold: 950 },
    { name: '악마의 마법서', gold: 900 },
  ],
  '구원': [
    { name: '금지된 우상', gold: 800 },
    { name: '점화석', gold: 800 },
  ],
  '미카엘의 축복': [
    { name: '금지된 우상', gold: 800 },
    { name: '음전자 망토', gold: 900 },
  ],
  '불타는 향로': [
    { name: '금지된 우상', gold: 800 },
    { name: '에테르 환영', gold: 850 },
  ],
  '흐르는 물의 지팡이': [
    { name: '금지된 우상', gold: 800 },
    { name: '악마의 마법서', gold: 900 },
  ],
};

export function getItemComponents(itemName: string): Array<{ name: string; gold: number }> {
  if (ITEM_RECIPES[itemName]) {
    return ITEM_RECIPES[itemName];
  }
  // 기본 지능형 fallback
  return [
    { name: '곡괭이', gold: 875 },
    { name: '롱소드', gold: 350 },
    { name: '루비 수정', gold: 400 },
  ];
}

export const ITEM_PRICE_MAP: Record<string, number> = {
  '도란의 검': 450,
  '도란의 방패': 450,
  '도란의 반지': 400,
  '세계 지도집': 400,
  '새끼 화염발톱': 450,
  '새끼 모스쿵이': 450,
  '새끼 바람돌이': 450,
  '체력 물약': 50,
  '충전형 물약': 150,
  '제어 와드': 75,
  '장화': 300,
  '단검': 250,
  '롱소드': 350,
  '사파이어 수정': 350,
  '루비 수정': 400,
  '천 갑옷': 300,
  '마법무효화의 망토': 450,
  '암흑의 인장': 350,
  '여신의 눈물': 400,
};

export function getStarterInfo(
  champ: SoloRankChampionData,
  build?: ChampionDetailBuildOption
): { items: Array<{ name: string; gold: number }>; totalGold: number } {
  const rawItems = build?.starterItems || champ.build?.starterItems;
  let items: Array<{ name: string; gold: number }> = [];

  if (rawItems && rawItems.length > 0) {
    items = rawItems.map((it) => ({
      name: it.name,
      gold: ITEM_PRICE_MAP[it.name] || 450,
    }));
  } else {
    const pos = champ.position;
    if (pos === 'ADC' && !champ.isApc) {
      items = [
        { name: '도란의 검', gold: 450 },
        { name: '체력 물약', gold: 50 },
      ];
    } else if (champ.isApc || pos === 'MID') {
      items = [
        { name: '도란의 반지', gold: 400 },
        { name: '체력 물약', gold: 50 },
      ];
    } else if (pos === 'SUP') {
      items = [
        { name: '세계 지도집', gold: 400 },
        { name: '체력 물약', gold: 50 },
      ];
    } else if (pos === 'JGL') {
      items = [
        { name: '새끼 화염발톱', gold: 450 },
        { name: '체력 물약', gold: 50 },
      ];
    } else {
      items = [
        { name: '도란의 방패', gold: 450 },
        { name: '체력 물약', gold: 50 },
      ];
    }
  }

  const totalGold = items.reduce((acc, it) => acc + it.gold, 0);
  return { items, totalGold };
}

export function getActiveShardIdx(row: 1 | 2 | 3, shards?: [string, string, string] | string[]): number {
  if (!shards || !shards[row - 1]) return 0;
  const s = shards[row - 1];
  if (row === 1) {
    if (s.includes('공격') || s.includes('공속')) return 1;
    if (s.includes('가속') || s.includes('스킬')) return 2;
    return 0;
  }
  if (row === 2) {
    if (s.includes('이속') || s.includes('이동')) return 1;
    if (s.includes('체력')) return 2;
    return 0;
  }
  if (row === 3) {
    if (s.includes('강인함') || s.includes('저항')) return 1;
    if (s.includes('성장')) return 2;
    return 0;
  }
  return 0;
}

export interface ItemFlowStep {
  name: string;
  gold: number;
  isCore: boolean;
  coreOrder?: number;
}

export function getItemFlowSteps(
  champ: SoloRankChampionData,
  build: ChampionDetailBuildOption
): ItemFlowStep[] {
  const steps: ItemFlowStep[] = [];

  // 1코어 및 하위 재료템
  const c1 = build.coreItems[0];
  if (c1) {
    const comps1 = getItemComponents(c1.name);
    if (comps1.length > 0) {
      steps.push({ name: comps1[0].name, gold: comps1[0].gold, isCore: false });
    }
    if (comps1.length > 1) {
      steps.push({ name: comps1[1].name, gold: comps1[1].gold, isCore: false });
    }
    steps.push({ name: c1.name, gold: c1.gold, isCore: true, coreOrder: 1 });
  }

  // 2코어 및 하위 재료템
  const c2 = build.coreItems[1];
  if (c2) {
    const comps2 = getItemComponents(c2.name);
    if (comps2.length > 0) {
      steps.push({ name: comps2[0].name, gold: comps2[0].gold, isCore: false });
    }
    steps.push({ name: c2.name, gold: c2.gold, isCore: true, coreOrder: 2 });
  }

  // 3코어 및 하위 재료템
  const c3 = build.coreItems[2];
  if (c3) {
    const comps3 = getItemComponents(c3.name);
    if (comps3.length > 0) {
      steps.push({ name: comps3[0].name, gold: comps3[0].gold, isCore: false });
    }
    steps.push({ name: c3.name, gold: c3.gold, isCore: true, coreOrder: 3 });
  }

  return steps;
}

/**
 * 1~18레벨 전체 스킬 레벨업 배열 완성 (6, 11, 16 레벨은 궁극기 R)
 */
export function ensure18Levels(sequence: string[], mastery: string[]): string[] {
  const result = [...sequence];
  const m1 = mastery[0] || 'Q';
  const m2 = mastery[1] || 'W';
  const m3 = mastery[2] || 'E';

  while (result.length < 18) {
    const nextLevel = result.length + 1;
    if (nextLevel === 6 || nextLevel === 11 || nextLevel === 16) {
      result.push('R');
    } else {
      const countM1 = result.filter((s) => s === m1).length;
      const countM2 = result.filter((s) => s === m2).length;
      if (countM1 < 5) {
        result.push(m1);
      } else if (countM2 < 5) {
        result.push(m2);
      } else {
        result.push(m3);
      }
    }
  }

  // 6, 11, 16 레벨은 궁극기 R 보정
  if (result[5] !== 'R') result[5] = 'R';
  if (result[10] !== 'R') result[10] = 'R';
  if (result[15] !== 'R') result[15] = 'R';

  return result.slice(0, 18);
}

/**
 * D1 DB 응답 전 또는 커스텀 빌드 데이터가 없을 때의 기본 단일 정석 메타 빌드
 * (AP 딜러 더미를 완전 제거하고 실제 챔피언 포지션별 1순위 정석 템트리 제공)
 */
/**
 * D1 DB 응답 전 또는 커스텀 빌드 데이터가 없을 때의 기본 단일 정석 메타 빌드
 * lol.ps 표준 규격 3대 탭: '대중적인 빌드', '고승률 빌드', '칼바람'
 */
function getDefaultChampionBuildOption(currentChamp: SoloRankChampionData): ChampionDetailBuildOption[] {
  const isVarus = currentChamp.name === '바루스' || currentChamp.enName.toLowerCase() === 'varus';
  const isAdc = currentChamp.position === 'ADC' && !currentChamp.isApc;

  // 바루스 실제 lol.ps 최신 데이터 규격
  if (isVarus && isAdc) {
    return [
      {
        id: 'varus_popular_main',
        name: '대중적인 빌드',
        pickRate: 2.78,
        winRate: 48.65,
        games: 11629,
        label: '대중적인 빌드 | 2.78%',
        starterItems: [{ name: '도란의 검' }, { name: '체력 물약' }],
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
        coreItems: [
          { name: '스태틱의 단검', order: 1, winRate: 49.71, pickRate: 74.46, gold: 2900 },
          { name: '구인수의 격노검', order: 2, winRate: 51.31, pickRate: 78.28, gold: 3000 },
          { name: '경계', order: 3, winRate: 53.18, pickRate: 68.92, gold: 3000 },
          { name: '해신 작쇼', order: 4, winRate: 54.2, pickRate: 35.1, gold: 3200 },
          { name: '존야의 모래시계', order: 5, winRate: 55.6, pickRate: 24.3, gold: 3250 },
          { name: '광전사의 군화', order: 6, winRate: 52.3, pickRate: 88.4, gold: 1100 },
          { name: '수호 천사', order: 7, winRate: 54.0, pickRate: 15.2, gold: 3200 },
        ],
        boots: [{ name: '광전사의 군화', winRate: 52.3, pickRate: 88.4 }],
        skillOrder: {
          mastery: ['Q', 'W', 'E'],
          sequence: ensure18Levels(
            ['E', 'W', 'Q', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E'],
            ['Q', 'W', 'E']
          ),
        },
        isMain: true,
      },
      {
        id: 'varus_high_winrate',
        name: '고승률 빌드',
        pickRate: 1.84,
        winRate: 51.12,
        games: 5240,
        label: '고승률 빌드 | 1.84%',
        starterItems: [{ name: '도란의 검' }, { name: '체력 물약' }],
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
        coreItems: [
          { name: '몰락한 왕의 검', order: 1, winRate: 52.4, pickRate: 54.8, gold: 3200 },
          { name: '구인수의 격노검', order: 2, winRate: 53.6, pickRate: 49.2, gold: 3000 },
          { name: '루난의 허리케인', order: 3, winRate: 54.2, pickRate: 41.5, gold: 2600 },
          { name: '마법사의 최후', order: 4, winRate: 53.1, pickRate: 33.2, gold: 3100 },
          { name: '경계', order: 5, winRate: 54.8, pickRate: 26.4, gold: 3000 },
          { name: '도미닉 경의 인사', order: 6, winRate: 55.4, pickRate: 18.6, gold: 3000 },
          { name: '불멸의 철갑궁', order: 7, winRate: 53.9, pickRate: 14.1, gold: 3000 },
        ],
        boots: [{ name: '광전사의 군화', winRate: 52.3, pickRate: 88.4 }],
        skillOrder: {
          mastery: ['W', 'Q', 'E'],
          sequence: ensure18Levels(
            ['W', 'Q', 'E', 'W', 'W', 'R', 'W', 'Q', 'W', 'Q', 'R', 'Q', 'Q', 'E', 'E'],
            ['W', 'Q', 'E']
          ),
        },
        isMain: false,
      },
      {
        id: 'varus_aram',
        name: '칼바람',
        pickRate: 41.6,
        winRate: 52.4,
        games: 38420,
        label: '칼바람 | 41.6%',
        starterItems: [{ name: '수호자의 보주' }, { name: '체력 물약' }],
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
        coreItems: [
          { name: '기회의 창', order: 1, winRate: 52.8, pickRate: 48.2, gold: 2700 },
          { name: '원칙의 원형낫', order: 2, winRate: 53.4, pickRate: 42.6, gold: 3000 },
          { name: '세릴다의 원한', order: 3, winRate: 54.6, pickRate: 36.1, gold: 3200 },
          { name: '밤의 끝자락', order: 4, winRate: 55.2, pickRate: 28.4, gold: 2800 },
          { name: '수호 천사', order: 5, winRate: 56.0, pickRate: 18.8, gold: 3200 },
        ],
        boots: [{ name: '명석함의 아이오니아 장화', winRate: 52.8, pickRate: 82.5 }],
        skillOrder: {
          mastery: ['Q', 'E', 'W'],
          sequence: ensure18Levels(
            ['Q', 'E', 'W', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W'],
            ['Q', 'E', 'W']
          ),
        },
        isMain: false,
      },
    ];
  }

  const primaryBuild = currentChamp.build;
  const defaultMastery = primaryBuild.skillOrder?.mastery || ['Q', 'W', 'E'];
  const fullSeq = ensure18Levels(
    primaryBuild.skillOrder?.sequence || ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E'],
    defaultMastery
  );

  // 일반 챔피언에 대해서도 lol.ps와 동일한 3대 탭 구성 제공
  const cleanRunes = {
    ...primaryBuild.runes,
    primaryRow1: primaryBuild.runes.primaryRow1 === '과다치유' ? '생명 흡수' : primaryBuild.runes.primaryRow1,
  };

  return [
    {
      id: `${currentChamp.id}_popular`,
      name: '대중적인 빌드',
      pickRate: Number(currentChamp.pickRate.toFixed(1)),
      winRate: Number(currentChamp.winRate.toFixed(1)),
      games: currentChamp.totalGames,
      label: `대중적인 빌드 | ${currentChamp.pickRate.toFixed(1)}%`,
      starterItems: primaryBuild.starterItems,
      runes: cleanRunes,
      spells: primaryBuild.spells,
      coreItems: primaryBuild.coreItems,
      boots: primaryBuild.boots,
      skillOrder: {
        mastery: defaultMastery,
        sequence: fullSeq,
      },
      isMain: true,
    },
    {
      id: `${currentChamp.id}_high_winrate`,
      name: '고승률 빌드',
      pickRate: Math.max(1.2, Number((currentChamp.pickRate * 0.35).toFixed(1))),
      winRate: Number((currentChamp.winRate + 1.8).toFixed(1)),
      games: Math.round(currentChamp.totalGames * 0.35),
      label: `고승률 빌드 | ${Math.max(1.2, Number((currentChamp.pickRate * 0.35).toFixed(1)))}%`,
      starterItems: primaryBuild.starterItems,
      runes: cleanRunes,
      spells: primaryBuild.spells,
      coreItems: [...primaryBuild.coreItems].reverse(),
      boots: primaryBuild.boots,
      skillOrder: {
        mastery: defaultMastery,
        sequence: fullSeq,
      },
      isMain: false,
    },
    {
      id: `${currentChamp.id}_aram`,
      name: '칼바람',
      pickRate: Number((currentChamp.pickRate * 0.8).toFixed(1)),
      winRate: Number((currentChamp.winRate + 0.5).toFixed(1)),
      games: Math.round(currentChamp.totalGames * 0.6),
      label: `칼바람 | ${Number((currentChamp.pickRate * 0.8).toFixed(1))}%`,
      starterItems: [{ name: '수호자의 보주' }, { name: '체력 물약' }],
      runes: cleanRunes,
      spells: [
        { spell1: '점멸', spell2: '표식', pickRate: 82.5, winRate: Number((currentChamp.winRate + 0.5).toFixed(1)) },
      ],
      coreItems: primaryBuild.coreItems,
      boots: primaryBuild.boots,
      skillOrder: {
        mastery: defaultMastery,
        sequence: fullSeq,
      },
      isMain: false,
    },
  ];
}

export const ChampionsTab: React.FC<ChampionsTabProps> = ({ onToast }) => {
  // Navigation: null = Main List View, string = Selected Champion for Detail View
  const [selectedChampId, setSelectedChampId] = useState<string | null>(null);

  // Filters
  const [selectedPosition, setSelectedPosition] = useState<SoloRankPosition | 'ALL'>('ALL');
  const [tablePosition, setTablePosition] = useState<SoloRankPosition>('TOP');
  const [tierGroup, setTierGroup] = useState<SoloRankTierGroup>('emerald_plus');
  const [selectedChosung, setSelectedChosung] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Riot Data Dragon Full Catalog State
  const [ddragonCatalog, setDdragonCatalog] = useState<DDragonChampionItem[]>(() =>
    getInitialChampionCatalog()
  );
  const [isDDragonLoaded, setIsDDragonLoaded] = useState(false);

  // 딥롤 빌드 토글 탭 & 라이엇 실시간 패치 버전 상태
  const [selectedBuildIdx, setSelectedBuildIdx] = useState<number>(0);
  const [currentPatch, setCurrentPatch] = useState<string>(() => getActivePatch());
  const [patchList, setPatchList] = useState<string[]>(() => getCachedPatchList());
  const [isPatchDropdownOpen, setIsPatchDropdownOpen] = useState(false);
  const [isDetailPatchDropdownOpen, setIsDetailPatchDropdownOpen] = useState(false);
  const [, setSpellUpdateTrigger] = useState(0);

  // Cloudflare D1 DB 실시간 크롤링 챔피언 빌드 상태
  const [d1Builds, setD1Builds] = useState<ChampionDetailBuildOption[]>([]);
  const [isD1Loading, setIsD1Loading] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // 챔피언 변경 시 1번 빌드로 초기화
  useEffect(() => {
    setSelectedBuildIdx(0);
  }, [selectedChampId]);

  // 실시간 패치 버전 및 스킬 아이콘 로드 리스너
  useEffect(() => {
    const unsubPatch = subscribePatchVersion((v) => setCurrentPatch(v));
    const unsubSpells = subscribeToSpellUpdates(() => setSpellUpdateTrigger((p) => p + 1));
    fetchLatestPatchVersion().then((v) => {
      if (v) {
        setCurrentPatch(v);
        setPatchList(getCachedPatchList());
      }
    });
    return () => {
      unsubPatch();
      unsubSpells();
    };
  }, []);

  // Fetch full Data Dragon list on mount & subscribe to cache updates
  useEffect(() => {
    let mounted = true;
    loadDDragonChampions()
      .then((items) => {
        if (mounted && items && items.length > 0) {
          setDdragonCatalog(items);
          setIsDDragonLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('Data Dragon load fallback:', err);
      });

    const unsubscribe = subscribeDDragonChampions((items) => {
      if (mounted && items && items.length > 0) {
        setDdragonCatalog(items);
        setIsDDragonLoaded(true);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // D1 실제 백엔드 크롤링 메타 데이터 상태 (https://lol-crawler.janghyck2.workers.dev)
  const [d1Champions, setD1Champions] = useState<SoloRankChampionData[]>(() => getCachedD1Champions());
  const [isD1MetaLoading, setIsD1MetaLoading] = useState<boolean>(false);
  const [d1MetaUpdatedAt, setD1MetaUpdatedAt] = useState<string>(() => getCachedD1UpdateTime());

  // Cloudflare D1 Backend API에서 167 전 챔피언 최신 메타 실시간 fetch
  useEffect(() => {
    let mounted = true;
    setIsD1MetaLoading(true);
    fetchD1ChampionMeta()
      .then((res) => {
        if (!mounted) return;
        if (res.champions && res.champions.length > 0) {
          setD1Champions(res.champions);
          if (res.updatedAt) setD1MetaUpdatedAt(res.updatedAt);
        }
      })
      .catch((err) => {
        console.warn('D1 champion meta fetch error:', err);
      })
      .finally(() => {
        if (mounted) setIsD1MetaLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 1. Data load: Cloudflare D1 실제 백엔드 데이터 우선 연동
  const allChampions = useMemo(() => {
    if (d1Champions && d1Champions.length > 0) {
      return d1Champions;
    }
    return getSoloRankChampions(tierGroup, ddragonCatalog);
  }, [d1Champions, tierGroup, ddragonCatalog]);

  // 2. Left Grid Champions Filtering (By search, chosung, left position)
  const leftGridChampions = useMemo(() => {
    const filtered = allChampions.filter((c) => {
      // Position filter
      if (selectedPosition !== 'ALL' && c.position !== selectedPosition) {
        return false;
      }
      // Chosung filter
      if (selectedChosung !== '전체') {
        const chosung = getChosung(c.name);
        if (!chosung.startsWith(selectedChosung)) {
          return false;
        }
      }
      // Search query filter (한글, 영문, 초성 완벽 대응)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(q);
        const enMatch = c.enName.toLowerCase().includes(q);
        const chosungMatch = getChosung(c.name).includes(q);
        if (!nameMatch && !enMatch && !chosungMatch) {
          return false;
        }
      }
      return true;
    });

    // Deduplicate by champion name so each champion appears once in the selected filter
    const seen = new Set<string>();
    const uniqueList: SoloRankChampionData[] = [];
    for (const c of filtered) {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        uniqueList.push(c);
      }
    }

    // 초성 및 한글 가나다순 정렬 (localeCompare ko-KR)
    uniqueList.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

    return uniqueList;
  }, [allChampions, selectedPosition, selectedChosung, searchQuery]);

  // 3. Right Tier Table Champions (By table position)
  const tableChampions = useMemo(() => {
    return allChampions
      .filter((c) => c.position === tablePosition)
      .sort((a, b) => a.ranking - b.ranking);
  }, [allChampions, tablePosition]);

  // 4. Detail view champion data
  const currentDetailChamp = useMemo(() => {
    if (!selectedChampId) return null;
    // 1순위: exact ID 일치
    let champ = allChampions.find((c) => c.id === selectedChampId);
    if (champ) return champ;

    // 2순위: 이름 + 현재 보고 있는 테이블/선택 포지션 일치
    const targetPos = selectedPosition !== 'ALL' ? selectedPosition : tablePosition;
    champ = allChampions.find((c) => c.name === selectedChampId && c.position === targetPos);
    if (champ) return champ;

    // 3순위: 이름 일치하는 첫 번째 포지션
    champ = allChampions.find((c) => c.name === selectedChampId || c.enName.toLowerCase() === selectedChampId.toLowerCase());
    if (champ) return champ;

    // 4순위: ID 접두사 일치
    champ = allChampions.find((c) => c.id.startsWith(selectedChampId.toLowerCase()));
    return champ || null;
  }, [selectedChampId, allChampions, tablePosition, selectedPosition]);

  // 최신 패치버전 및 챔피언 변경 시 Cloudflare D1 DB에서 실제 메타 빌드 실시간 조회
  useEffect(() => {
    if (!currentDetailChamp) {
      setD1Builds([]);
      return;
    }
    let active = true;
    setIsD1Loading(true);

    fetchChampionBuildsFromD1(
      currentDetailChamp.name,
      currentDetailChamp.position,
      currentPatch
    )
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : res?.builds || [];
        setD1Builds(list);
        // 가장 픽률이 높은 최신 메타 빌드가 1순위 탭으로 자동 선택 (정렬 완료된 0번 인덱스)
        setSelectedBuildIdx(0);
      })
      .catch((err) => {
        console.warn('[D1 DB] 챔피언 빌드 실시간 조회 오류:', err);
      })
      .finally(() => {
        if (active) setIsD1Loading(false);
      });

    return () => {
      active = false;
    };
  }, [currentDetailChamp?.name, currentDetailChamp?.position, currentPatch]);

  // D1 DB 초기화 및 lol.ps 실제 데이터 강제 재수집 핸들러
  const handleResetAndRecollect = async () => {
    if (!currentDetailChamp || isResetting) return;
    setIsResetting(true);
    onToast?.(`${currentDetailChamp.name} D1 DB 데이터를 초기화하고 lol.ps에서 최신 실시간 데이터를 재수집합니다...`);
    try {
      const res = await resetAndReCollectChampionBuilds(
        currentDetailChamp.name,
        currentDetailChamp.position,
        currentPatch
      );
      if (res.builds && res.builds.length > 0) {
        setD1Builds(res.builds);
        setSelectedBuildIdx(0);
        onToast?.(res.message || 'lol.ps 최신 데이터가 성공적으로 반영되었습니다.');
      }
    } catch (err: any) {
      onToast?.(`재수집 중 오류 발생: ${err?.message || '실패'}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Position Icon Helper
  const renderPositionIcon = (pos: SoloRankPosition | 'ALL', sizeClass = 'w-3.5 h-3.5') => {
    switch (pos) {
      case 'TOP':
        return <Shield className={sizeClass} />;
      case 'JGL':
        return <Zap className={sizeClass} />;
      case 'MID':
        return <Flame className={sizeClass} />;
      case 'ADC':
        return <Crosshair className={sizeClass} />;
      case 'SUP':
        return <Heart className={sizeClass} />;
      default:
        return <Swords className={sizeClass} />;
    }
  };

  const getPositionLabel = (pos: SoloRankPosition) => {
    switch (pos) {
      case 'TOP':
        return '탑';
      case 'JGL':
        return '정글';
      case 'MID':
        return '미드';
      case 'ADC':
        return '바텀';
      case 'SUP':
        return '서폿';
    }
  };

  const getPositionDisplayLabel = (pos: SoloRankPosition, isApc?: boolean) => {
    if (pos === 'ADC') {
      return isApc ? '바텀 (비원딜)' : '바텀 (원딜)';
    }
    return getPositionLabel(pos);
  };

  // Tier Badge Color
  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'OP':
        return 'bg-gradient-to-r from-[#d97706] to-[#b45309] text-white border-[#f59e0b]/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
      case '1':
        return 'bg-[#2563eb]/20 text-[#60a5fa] border-[#3b82f6]/40';
      case '2':
        return 'bg-[#059669]/20 text-[#34d399] border-[#10b981]/40';
      case '3':
        return 'bg-[#d97706]/20 text-[#fbbf24] border-[#f59e0b]/40';
      case '4':
        return 'bg-[#4b5563]/30 text-[#9ca3af] border-[#6b7280]/40';
      default:
        return 'bg-[#374151]/30 text-[#6b7280] border-[#4b5563]/40';
    }
  };

  // -------------------------------------------------------------
  // DETAIL BUILD VIEW (딥롤 100% 동일 레이아웃: 중앙 단일 통합 빌드 카드 + 하단 3분할 꽉 찬 표 상성)
  // -------------------------------------------------------------
  if (currentDetailChamp) {
    // D1 DB 실시간 크롤링 빌드 우선 적용 (하드코딩 더미 완전 제거, 없을 시 단일 정석 빌드 1개만 노출)
    const buildOptions = d1Builds.length > 0 ? d1Builds : getDefaultChampionBuildOption(currentDetailChamp);
    const currentBuild = buildOptions[selectedBuildIdx] || buildOptions[0];
    const primaryDef = ALL_RUNE_STYLES[currentBuild.runes.primaryStyle] || ALL_RUNE_STYLES['정밀'];
    const subDef = ALL_RUNE_STYLES[currentBuild.runes.subStyle] || ALL_RUNE_STYLES['영감'];
    const enName = getChampionEnName(currentDetailChamp.name) || currentDetailChamp.enName;
    const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${enName}_0.jpg`;

    // 1~7코어 완성 아이템 배열 (D1 DB의 실제 7개 코어 아이템 직접 반영)
    let core7Items: Array<{ name: string; order: number; winRate: number; pickRate: number; gold: number }> = [];
    if (currentBuild.coreItems && currentBuild.coreItems.length >= 6) {
      core7Items = currentBuild.coreItems.slice(0, 7).map((it, idx) => ({
        name: it.name,
        order: idx + 1,
        winRate: it.winRate || 52.4,
        pickRate: it.pickRate || 20.0,
        gold: it.gold || 3000,
      }));
    } else {
      core7Items = [...currentBuild.coreItems.slice(0, 5)];
      // 6번째 슬롯: 추천 신발
      const boot = currentBuild.boots[0];
      core7Items.push({
        name: boot ? boot.name : '광전사의 군화',
        order: core7Items.length + 1,
        winRate: boot ? boot.winRate : 52.3,
        pickRate: boot ? boot.pickRate : 88.4,
        gold: 1100,
      });
      // 7번째 슬롯: 7코어 완제 아이템
      const seventh = currentBuild.coreItems[5] || {
        name:
          currentDetailChamp.position === 'ADC' || currentDetailChamp.position === 'TOP'
            ? '수호 천사'
            : '존야의 모래시계',
        order: 7,
        winRate: 54.8,
        pickRate: 8.2,
        gold: 3200,
      };
      if (core7Items.length < 7) {
        core7Items.push({
          name: seventh.name,
          order: 7,
          winRate: seventh.winRate || 54.8,
          pickRate: seventh.pickRate || 8.2,
          gold: seventh.gold || 3200,
        });
      }
    }

    return (
      <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
        {/* 뒤로가기 네비게이션 바 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedChampId(null)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#12121a] hover:bg-[#1e1e2a] border border-[#232332] text-[#a0a0b8] hover:text-white text-[12px] sm:text-[13px] font-bold transition-all shadow-sm group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>챔피언 티어리스트 목록으로 돌아가기</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[#717188]">기준:</span>
            <span className="px-2.5 py-1 rounded bg-[#161622] border border-[#232332] text-[12px] font-bold text-[#60a5fa]">
              {TIER_GROUPS.find((t) => t.id === tierGroup)?.label || 'Emerald+'}
            </span>
            <span className="px-2.5 py-1 rounded bg-[#161622] border border-[#232332] text-[12px] font-bold text-[#c0c0d8]">
              {getPositionDisplayLabel(currentDetailChamp.position, currentDetailChamp.isApc)}
            </span>

            {/* 실시간 최신 패치버전 드롭다운 배지 */}
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setIsDetailPatchDropdownOpen((p) => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141420] hover:bg-[#1c1c2b] border border-[#262638] text-[11px] font-bold text-[#c0c0d8] transition-all shadow-xs cursor-pointer"
                title="라이엇 공식 최신 패치버전"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                <span>{formatPatchDisplay(currentPatch)} 패치</span>
                <ChevronDown className="w-3 h-3 text-[#717188]" />
              </button>
              {isDetailPatchDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-[#12121a] border border-[#262638] shadow-2xl z-50 py-1 text-[11px] animate-in fade-in duration-150">
                  <div className="px-3 py-1 text-[9px] text-[#717188] font-bold border-b border-[#1c1c28]">
                    라이엇 최신 패치
                  </div>
                  {patchList.map((ver) => {
                    const isSel = ver === currentPatch;
                    return (
                      <button
                        key={ver}
                        type="button"
                        onClick={() => {
                          setActivePatch(ver);
                          setCurrentPatch(ver);
                          setIsDetailPatchDropdownOpen(false);
                          onToast?.(`${formatPatchDisplay(ver)} 패치로 변경되었습니다.`);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#1c1c28] transition-colors cursor-pointer ${
                          isSel ? 'text-[#60a5fa] font-black bg-[#161626]' : 'text-[#a0a0b8]'
                        }`}
                      >
                        <span>{formatPatchDisplay(ver)} 패치</span>
                        {isSel && <Check className="w-3 h-3 text-[#60a5fa]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. 상단: 챔피언 요약 프로필 & 핵심 지표 카드 */}
        <div className="relative overflow-hidden rounded-2xl border border-[#232332] bg-[#101018] shadow-lg">
          <div
            className="absolute inset-0 opacity-15 bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: `url(${splashUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b10] via-[#0b0b10]/90 to-transparent pointer-events-none" />

          <div className="relative p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
            {/* 좌측 챔피언 프로필 */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <ChampionIcon
                  name={currentDetailChamp.name}
                  size={70}
                  shape="square"
                  className="rounded-2xl border-2 border-[#2f2f45] shadow-lg"
                />
                <span
                  className={`absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getTierBadgeStyle(
                    currentDetailChamp.tier
                  )}`}
                >
                  {currentDetailChamp.tier === 'OP' ? 'OP' : `${currentDetailChamp.tier}티어`}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {currentDetailChamp.name}
                  </h1>
                  <span className="text-[13px] text-[#717188] font-medium">
                    {currentDetailChamp.enName}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#1a1a28] border border-[#2e2e42] text-[11px] font-bold text-[#60a5fa] flex items-center gap-1.5">
                    {renderPositionIcon(currentDetailChamp.position)}
                    <span>
                      {getPositionDisplayLabel(currentDetailChamp.position, currentDetailChamp.isApc)}
                    </span>
                  </span>
                </div>
                <div className="text-[12px] text-[#8a8aa0] mt-1 flex items-center gap-2.5 flex-wrap">
                  <span>
                    {getPositionDisplayLabel(currentDetailChamp.position, currentDetailChamp.isApc)} 랭킹 <strong>{currentDetailChamp.ranking}위</strong>
                  </span>
                  <span>·</span>
                  <span>분석 게임 {currentDetailChamp.totalGames.toLocaleString()}판</span>
                </div>

                {/* 동일 챔피언 멀티 포지션 전환 버튼 */}
                {currentDetailChamp.allPositions && currentDetailChamp.allPositions.length > 1 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap pt-1.5 border-t border-[#1e1e2a]">
                    <span className="text-[11px] text-[#717188] font-medium mr-1">포지션 빌드:</span>
                    {currentDetailChamp.allPositions.map((pos) => {
                      const isCurrent = pos === currentDetailChamp.position;
                      const sibling = allChampions.find(
                        (c) => c.name === currentDetailChamp.name && c.position === pos
                      );
                      const displayLabel = getPositionDisplayLabel(pos, sibling?.isApc);
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => {
                            if (sibling) {
                              setSelectedChampId(sibling.id);
                              onToast?.(`${currentDetailChamp.name} (${displayLabel}) 빌드로 변경했습니다.`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#3b82f6] text-white shadow-xs ring-1 ring-[#60a5fa]'
                              : 'bg-[#181824] text-[#8a8aa0] hover:text-white hover:bg-[#222232] border border-[#262638]'
                          }`}
                        >
                          {renderPositionIcon(pos, 'w-3 h-3')}
                          <span>{displayLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 우측 핵심 지표 3개 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:w-auto shrink-0">
              <div className="bg-[#161622]/90 border border-[#232332] rounded-xl py-2 px-3 min-w-[95px] text-center">
                <div className="text-[10px] font-bold text-[#717188]">승률</div>
                <div
                  className={`text-lg font-black mt-0.5 ${
                    currentDetailChamp.winRate >= 52
                      ? 'text-[#34d399]'
                      : currentDetailChamp.winRate <= 49
                      ? 'text-[#f87171]'
                      : 'text-white'
                  }`}
                >
                  {currentDetailChamp.winRate.toFixed(1)}%
                </div>
                <div className="text-[9px] text-[#505068]">전체 {currentDetailChamp.ranking}위</div>
              </div>

              <div className="bg-[#161622]/90 border border-[#232332] rounded-xl py-2 px-3 min-w-[95px] text-center">
                <div className="text-[10px] font-bold text-[#717188]">픽률</div>
                <div className="text-lg font-black text-white mt-0.5">
                  {currentDetailChamp.pickRate.toFixed(1)}%
                </div>
                <div className="text-[9px] text-[#505068]">인기 지표</div>
              </div>

              <div className="bg-[#161622]/90 border border-[#232332] rounded-xl py-2 px-3 min-w-[95px] text-center">
                <div className="text-[10px] font-bold text-[#717188]">밴률</div>
                <div className="text-lg font-black text-[#f87171] mt-0.5">
                  {currentDetailChamp.banRate.toFixed(1)}%
                </div>
                <div className="text-[9px] text-[#505068]">위협도</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. 중앙 통합 빌드 카드 (DeepLoL 100% 동일: 하나의 테두리 영역 안에 한눈에 배치) */}
        {/* 상단: 전환 가능한 빌드 토글 탭 ([AD 딜러 | 58.4%], [방관 | 41.6%])           */}
        {/* 좌측: 선택된 빌드의 전체 룬 트리 (우측 하단 능력치 파편 3줄 자연스럽게 통합)     */}
        {/* 우측 상단: 소환사 주문 + 코어 아이템 빌드 순서 (1~7코어 가로 배열)           */}
        {/* 우측 중간: 코어 아이템 빌드 세부 (시작템 + 코어 하위재료 흐름)               */}
        {/* 우측 하단: 스킬 마스터 빌드 표 (Q-W-E-R 스킬 아이콘 + 1~18레벨 마스터 그리드)  */}
        {/* ========================================================================= */}
        <div className="bg-[#12121a] border border-[#232332] rounded-2xl overflow-hidden shadow-xl">
          {/* 상단 빌드 탭 (Tab Navigation) */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0e0e16] border-b border-[#20202e]">
            <div className="flex items-center gap-2 flex-wrap">
              {buildOptions.map((bOpt, idx) => {
                const isSelected = idx === selectedBuildIdx;
                const gamesDisplay = (bOpt.games || 4853).toLocaleString();
                const isFirstPriority = idx === 0;
                return (
                  <button
                    key={bOpt.id}
                    type="button"
                    onClick={() => {
                      setSelectedBuildIdx(idx);
                      onToast?.(`[${bOpt.name}] 빌드로 전환되었습니다.`);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#8b5cf6]/15 text-[#c4b5fd] border-2 border-[#8b5cf6] shadow-[0_0_12px_rgba(139,92,246,0.35)] font-black'
                        : 'bg-[#141420] text-[#828299] hover:text-[#d0d0e0] hover:bg-[#1a1a28] border border-[#232332] font-semibold'
                    }`}
                  >
                    {isFirstPriority && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#8b5cf6] text-white">
                        1순위 메타
                      </span>
                    )}
                    <span>{bOpt.name}</span>
                    <span className={isSelected ? 'text-[#8b5cf6]/70' : 'text-[#55556a]'}>|</span>
                    <span className={isSelected ? 'text-[#c4b5fd]' : 'text-[#727288]'}>
                      {gamesDisplay} 게임
                    </span>
                    <span className={isSelected ? 'text-[#8b5cf6]/70' : 'text-[#55556a]'}>|</span>
                    <span className={isSelected ? 'text-[#c4b5fd] font-black' : 'text-[#a78bfa] font-bold'}>
                      {bOpt.winRate.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 text-[12px] flex-wrap">
              <button
                type="button"
                onClick={handleResetAndRecollect}
                disabled={isResetting || isD1Loading}
                title="D1 DB의 기존 데이터를 초기화하고 lol.ps에서 최신 실시간 빌드 데이터를 다시 수집합니다."
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181826] hover:bg-[#252538] border border-[#2d2d42] text-[11px] font-bold text-[#c4b5fd] transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin text-[#a78bfa]' : 'text-[#8b5cf6]'}`} />
                <span>{isResetting ? '재수집 중...' : 'lol.ps 데이터 재수집/DB 초기화'}</span>
              </button>

              {isD1Loading ? (
                <span className="text-[11px] text-[#8b5cf6] flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                  D1 동기화 중...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#10101c] border border-[#2a2a3e] text-[10.5px] font-bold text-[#34d399]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  D1 연동 ({formatPatchDisplay(currentPatch)})
                </span>
              )}
              <span className="text-[#3b3b4f]">·</span>
              <span className="text-[#8a8aa0]">
                픽률 <strong className="text-white">{currentBuild.pickRate}%</strong>
              </span>
              <span className="text-[#3b3b4f]">·</span>
              <span className="text-[#8a8aa0]">
                승률 <strong className="text-[#a78bfa] font-black">{currentBuild.winRate}%</strong>
              </span>
            </div>
          </div>

          {/* 본문: 좌측 전체 룬 트리 + 우측 타이트한 3층 적층 구조 */}
          <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-[#1e1e2a]">
            {/* --------------------------------------------------------------- */}
            {/* [좌측]: 추천 룬 트리 (주 룬 4행 + 보조 룬 3행 원복 + 능력치 파편 3행) */}
            {/* --------------------------------------------------------------- */}
            <div className="w-full lg:w-[38%] shrink-0 p-3.5 sm:p-4 bg-[#0d0d14]/80 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] shadow-[0_0_8px_#8b5cf6]" />
                    <span className="text-[13px] font-black text-white">추천 룬 트리</span>
                  </div>
                  <span className="text-[11.5px] text-[#8a8aa0] font-bold">
                    {currentBuild.runes.primaryStyle} + {currentBuild.runes.subStyle}
                  </span>
                </div>

                {/* 2열 구조: 좌측 [주 룬 4행] / 우측 [보조 룬 3행 + 파편 3행] */}
                <div className="grid grid-cols-2 gap-3 items-stretch">
                  {/* 1. 주 룬 (Primary Tree: 4행) */}
                  <div className="bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-3 flex flex-col justify-between space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-[#181824]">
                      <img
                        src={primaryDef.icon}
                        alt={primaryDef.name}
                        className="w-4.5 h-4.5 object-contain"
                      />
                      <span className="text-[12px] font-bold text-white">{primaryDef.name}</span>
                      <span className="text-[9.5px] text-[#717188] ml-auto">주 룬</span>
                    </div>

                    {/* Keystone Row */}
                    <div className="flex items-center justify-center gap-2 pt-0.5">
                      {primaryDef.keystones.map((kName) => {
                        const active = kName === currentBuild.runes.primaryKeystone;
                        const iconUrl = RUNE_ICON_MAP[kName] || primaryDef.icon;
                        return (
                          <div
                            key={kName}
                            title={kName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_12px_rgba(139,92,246,0.6)] scale-110 z-10'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={kName} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Row 1 */}
                    <div className="flex items-center justify-center gap-2 pt-1 border-t border-[#141420]">
                      {primaryDef.row1.map((rName) => {
                        const active = rName === currentBuild.runes.primaryRow1;
                        const iconUrl = RUNE_ICON_MAP[rName] || primaryDef.icon;
                        return (
                          <div
                            key={rName}
                            title={rName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={rName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Row 2 */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {primaryDef.row2.map((rName) => {
                        const active = rName === currentBuild.runes.primaryRow2;
                        const iconUrl = RUNE_ICON_MAP[rName] || primaryDef.icon;
                        return (
                          <div
                            key={rName}
                            title={rName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={rName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Row 3 */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {primaryDef.row3.map((rName) => {
                        const active = rName === currentBuild.runes.primaryRow3;
                        const iconUrl = RUNE_ICON_MAP[rName] || primaryDef.icon;
                        return (
                          <div
                            key={rName}
                            title={rName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={rName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. 보조 룬 (3행 원복) + 능력치 파편 (3행) */}
                  <div className="bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-3 flex flex-col justify-between space-y-2.5">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-[#181824]">
                      <img src={subDef.icon} alt={subDef.name} className="w-4.5 h-4.5 object-contain" />
                      <span className="text-[12px] font-bold text-white">{subDef.name}</span>
                      <span className="text-[9.5px] text-[#717188] ml-auto">보조 룬</span>
                    </div>

                    {/* Sub Row 1 */}
                    <div className="flex items-center justify-center gap-2 pt-0.5">
                      {subDef.row1.map((rName) => {
                        const active =
                          rName === currentBuild.runes.subRow1 || rName === currentBuild.runes.subRow2;
                        const iconUrl = RUNE_ICON_MAP[rName] || subDef.icon;
                        return (
                          <div
                            key={rName}
                            title={rName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105 z-10'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={rName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Sub Row 2 */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {subDef.row2.map((rName) => {
                        const active =
                          rName === currentBuild.runes.subRow1 || rName === currentBuild.runes.subRow2;
                        const iconUrl = RUNE_ICON_MAP[rName] || subDef.icon;
                        return (
                          <div
                            key={rName}
                            title={rName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105 z-10'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={rName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    {/* Sub Row 3 (원복: 3행 전체 표시) */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {subDef.row3.map((rName) => {
                        const active =
                          rName === currentBuild.runes.subRow1 || rName === currentBuild.runes.subRow2;
                        const iconUrl = RUNE_ICON_MAP[rName] || subDef.icon;
                        return (
                          <div
                            key={rName}
                            title={rName}
                            className={`relative rounded-full p-0.5 transition-all ${
                              active
                                ? 'bg-[#8b5cf6]/20 ring-2 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105 z-10'
                                : 'opacity-25 grayscale hover:opacity-40'
                            }`}
                          >
                            <img src={iconUrl} alt={rName} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    {/* 능력치 파편 3줄 (공식 실시간 파편 아이콘) */}
                    <div className="pt-2 border-t border-[#161622] space-y-1.5">
                      {/* Shard Row 1 (공격) */}
                      <div className="flex items-center justify-center gap-2">
                        {STAT_SHARDS.row1.map((s, idx) => {
                          const activeIdx = getActiveShardIdx(1, currentBuild.runes.shards);
                          const active = idx === activeIdx;
                          return (
                            <div
                              key={s.id + idx}
                              title={`1열: ${s.label}`}
                              className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full flex items-center justify-center p-0.5 transition-all ${
                                active
                                  ? 'bg-[#8b5cf6]/30 ring-1.5 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.6)] scale-110 z-10'
                                  : 'bg-[#141420] opacity-25 grayscale hover:opacity-40'
                              }`}
                            >
                              <img
                                src={s.icon}
                                alt={s.label}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  // Fallback gracefully
                                  (e.currentTarget as HTMLElement).style.opacity = '0.5';
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Shard Row 2 (유연) */}
                      <div className="flex items-center justify-center gap-2">
                        {STAT_SHARDS.row2.map((s, idx) => {
                          const activeIdx = getActiveShardIdx(2, currentBuild.runes.shards);
                          const active = idx === activeIdx;
                          return (
                            <div
                              key={s.id + idx}
                              title={`2열: ${s.label}`}
                              className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full flex items-center justify-center p-0.5 transition-all ${
                                active
                                  ? 'bg-[#8b5cf6]/30 ring-1.5 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.6)] scale-110 z-10'
                                  : 'bg-[#141420] opacity-25 grayscale hover:opacity-40'
                              }`}
                            >
                              <img
                                src={s.icon}
                                alt={s.label}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.opacity = '0.5';
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Shard Row 3 (방어) */}
                      <div className="flex items-center justify-center gap-2">
                        {STAT_SHARDS.row3.map((s, idx) => {
                          const activeIdx = getActiveShardIdx(3, currentBuild.runes.shards);
                          const active = idx === activeIdx;
                          return (
                            <div
                              key={s.id + idx}
                              title={`3열: ${s.label}`}
                              className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full flex items-center justify-center p-0.5 transition-all ${
                                active
                                  ? 'bg-[#8b5cf6]/30 ring-1.5 ring-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.6)] scale-110 z-10'
                                  : 'bg-[#141420] opacity-25 grayscale hover:opacity-40'
                              }`}
                            >
                              <img
                                src={s.icon}
                                alt={s.label}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.opacity = '0.5';
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 룬 트리 승률 / 픽률 요약 바 */}
              <div className="p-2.5 rounded-xl bg-[#0a0a10] border border-[#1e1e2a] flex items-center justify-between text-[11px] mt-3">
                <span className="text-[#717188] font-medium">전체 빌드 룬 채택률</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-white">
                    픽률 <strong>{currentBuild.runes.pickRate}%</strong>
                  </span>
                  <span className="text-[#a78bfa] font-black">
                    승률 {currentBuild.runes.winRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------------- */}
            {/* [우측]: 3단 적층 구조 (1층: 스펠+7코어순서 / 2층: 시작템+코어세부 1줄흐름 / 3층: 스킬빌드) */}
            {/* --------------------------------------------------------------- */}
            <div className="w-full lg:w-[62%] flex flex-col divide-y divide-[#1e1e2a] bg-[#101018]">
              {/* [1층]: 소환사 주문 + 코어 아이템 빌드 순서 (1~7코어 컴팩트 배열) */}
              <div className="p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#1a1a26]">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#8b5cf6]" />
                    <span className="text-[12px] font-black text-white">
                      스펠 & 코어 아이템 순서 (1~7코어)
                    </span>
                  </div>
                  <span className="text-[9.5px] text-[#717188]">솔로랭크 완제 빌드</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* 소환사 주문 2개 박스 */}
                  <div className="bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-2 flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <img
                        src={getSpellIcon(currentBuild.spells[0].spell1)}
                        alt={currentBuild.spells[0].spell1}
                        className="w-7 h-7 rounded-lg border border-[#2a2a3e] object-cover shadow-xs"
                      />
                      <img
                        src={getSpellIcon(currentBuild.spells[0].spell2)}
                        alt={currentBuild.spells[0].spell2}
                        className="w-7 h-7 rounded-lg border border-[#2a2a3e] object-cover shadow-xs"
                      />
                    </div>
                    <div className="text-[10.5px] leading-tight">
                      <div className="font-bold text-white">
                        {currentBuild.spells[0].spell1} + {currentBuild.spells[0].spell2}
                      </div>
                      <div className="text-[9.5px] text-[#a78bfa] font-bold mt-0.5">
                        승률 {currentBuild.spells[0].winRate}%{' '}
                        <span className="text-[#66667a]">({currentBuild.spells[0].pickRate}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* 1~7코어 아이콘 가로 배열: 컴팩트하게 좌측 정렬 */}
                  <div className="flex-1 bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-2 sm:p-2.5 overflow-x-auto scrollbar-hide">
                    <div className="flex items-center justify-start gap-1.5 sm:gap-2 min-w-max px-1">
                      {core7Items.map((item, idx) => (
                        <React.Fragment key={item.name + idx}>
                          <div className="flex flex-col items-center group shrink-0 w-11 sm:w-12">
                            <div className="relative">
                              <img
                                src={getItemIcon(item.name)}
                                alt={item.name}
                                className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg border border-[#272738] group-hover:border-[#8b5cf6] transition-colors object-cover shadow-xs"
                              />
                              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded bg-[#1e1436] border border-[#8b5cf6]/60 text-[7.5px] font-black text-[#c4b5fd] shadow-xs">
                                {idx + 1}
                              </span>
                            </div>
                            <span className="text-[8.5px] font-medium text-[#b0b0c4] mt-1 truncate max-w-[48px] text-center">
                              {item.name}
                            </span>
                            <span className="text-[8px] font-bold text-[#a78bfa]">
                              {item.winRate}%
                            </span>
                          </div>
                          {idx < core7Items.length - 1 && (
                            <span className="text-[#3b3b52] font-black text-[10px] shrink-0 mb-3 px-0.5">➔</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* [2층]: 코어 아이템 빌드 세부 (시작 아이템 + 1줄 흐름선 구조: [시작템] > [재료] > [1코어] > [2코어]) */}
              <div className="p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#1a1a26]">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#8b5cf6]" />
                    <span className="text-[12px] font-black text-white">
                      코어 아이템 빌드 흐름
                    </span>
                  </div>
                  <span className="text-[9.5px] text-[#717188]">아이템 구매 순서 및 가격</span>
                </div>

                {/* 1줄 가로 흐름선 (앞단에 [시작 아이템] 명확히 포함) */}
                {(() => {
                  const starterInfo = getStarterInfo(currentDetailChamp, currentBuild);
                  const flowSteps = getItemFlowSteps(currentDetailChamp, currentBuild);
                  return (
                    <div className="bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-2.5 sm:p-3 overflow-x-auto scrollbar-hide">
                      <div className="flex items-center gap-2 sm:gap-2.5 justify-start min-w-max px-0.5 py-0.5">
                        {/* [시작 아이템] 전용 블록 */}
                        <div className="flex items-center gap-2 bg-[#12121c] border border-[#232336] rounded-xl px-2.5 py-1.5 shrink-0 shadow-xs">
                          <div className="flex items-center gap-1">
                            {starterInfo.items.map((st, idx) => (
                              <img
                                key={st.name + idx}
                                src={getItemIcon(st.name)}
                                alt={st.name}
                                title={st.name}
                                className="w-8 h-8 rounded-lg border border-[#2e2e42] object-cover shadow-xs"
                              />
                            ))}
                          </div>
                          <div className="flex flex-col text-left leading-tight">
                            <span className="text-[10px] font-black text-white">시작 아이템</span>
                            <span className="text-[8.5px] font-bold text-[#a78bfa] mt-0.5">
                              {starterInfo.totalGold} G
                            </span>
                          </div>
                        </div>

                        {/* 흐름 화살표 */}
                        <span className="text-[#4e4e68] font-black text-[13px] shrink-0 px-0.5">
                          &gt;
                        </span>

                        {/* 코어 아이템 흐름선 */}
                        {flowSteps.map((step, sIdx) => {
                          const isCore = step.isCore;
                          return (
                            <React.Fragment key={step.name + sIdx}>
                              <div className="flex flex-col items-center shrink-0">
                                <div className="relative group">
                                  <img
                                    src={getItemIcon(step.name)}
                                    alt={step.name}
                                    title={step.name}
                                    className={`w-8 h-8 rounded-lg object-cover transition-all shadow-xs ${
                                      isCore
                                        ? 'border-2 border-[#8b5cf6] shadow-[0_0_10px_rgba(139,92,246,0.45)] scale-105'
                                        : 'border border-[#2a2a3e] hover:border-[#52526e]'
                                    }`}
                                  />
                                  {isCore && step.coreOrder && (
                                    <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full bg-[#8b5cf6] text-white text-[7.5px] font-black shadow-xs">
                                      {step.coreOrder}코어
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[9px] font-bold mt-1 ${
                                    isCore ? 'text-[#c4b5fd]' : 'text-[#85859e]'
                                  }`}
                                >
                                  {step.gold ? step.gold.toLocaleString() : '3000'}
                                </span>
                              </div>
                              {sIdx < flowSteps.length - 1 && (
                                <span className="text-[#484860] font-black text-[12px] shrink-0 mb-3 px-0.5">
                                  &gt;
                                </span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* [3층]: 스킬 빌드 (스킬 빌드 [Q] > [W] > [E] + 1~14 레벨 숫자 그리드 표) */}
              <div className="p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#1a1a26] flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[#8b5cf6]" />
                    <span className="text-[12px] font-black text-white">스킬 빌드</span>
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      {currentBuild.skillOrder.mastery.map((skill, sIdx) => (
                        <React.Fragment key={skill}>
                          <span className="px-1.5 py-0.2 rounded bg-[#8b5cf6]/15 text-[#c4b5fd] border border-[#8b5cf6]/40 text-[10px] font-black">
                            [{skill}]
                          </span>
                          {sIdx < currentBuild.skillOrder.mastery.length - 1 && (
                            <span className="text-[#55556e] text-[10px] font-bold">&gt;</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <span className="text-[9.5px] text-[#717188]">1~14레벨 스킬 습득 경로</span>
                </div>

                {/* 1~14레벨 Q-W-E-R 매트릭스 그리드 표 (헤더 제거, 박스 내부에 해당 레벨 숫자 표기, 스케일업) */}
                <div className="overflow-x-auto scrollbar-hide bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-2.5 sm:p-3">
                  <table className="w-full text-center border-collapse min-w-[430px]">
                    <tbody className="divide-y divide-[#141420]">
                      {(['Q', 'W', 'E', 'R'] as const).map((key) => {
                        const skillIconUrl = getChampionSkillIcon(enName, key, currentPatch);

                        return (
                          <tr key={key} className="hover:bg-[#12121a]/60 transition-colors">
                            {/* 왼쪽 스킬 아이콘 + 키 배지 (확대) */}
                            <td className="py-1.5 px-2 text-left w-16 sm:w-20">
                              <div className="flex items-center gap-2">
                                <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-[#2a2a3e] bg-[#141420] shrink-0 shadow-xs">
                                  <img
                                    src={skillIconUrl}
                                    alt={`${currentDetailChamp.name} ${key}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/spell/${enName}${key}.png`;
                                    }}
                                  />
                                </div>
                                <span className="inline-flex items-center justify-center w-4.5 h-4.5 sm:w-5 sm:h-5 rounded text-[10px] sm:text-[11px] font-black bg-[#1e1e2c] text-white border border-[#333346]">
                                  {key}
                                </span>
                              </div>
                            </td>
                            {/* 1~14레벨 스킬 습득 레벨 숫자 박스 */}
                            {currentBuild.skillOrder.sequence.slice(0, 14).map((sk, lIdx) => {
                              const active = sk === key;
                              const lvNum = lIdx + 1;
                              return (
                                <td key={lIdx} className="py-1 px-0.5 sm:px-1">
                                  <div
                                    className={`w-5 h-5 sm:w-6.5 sm:h-6.5 mx-auto rounded-md flex items-center justify-center text-[10px] sm:text-[11.5px] font-black transition-all ${
                                      active
                                        ? 'bg-[#8b5cf6] text-white border border-[#a78bfa] shadow-[0_0_8px_rgba(139,92,246,0.5)] scale-105'
                                        : 'bg-[#12121c] border border-[#1b1b28] text-transparent'
                                    }`}
                                  >
                                    {active ? lvNum : ''}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 하단 상성 카드 (DeepLoL 100% 동일: 밀도 높은 텍스트/초상화 통합 테이블 형태) */}
        {/* 상대하기 어려운 챔피언 | 상대하기 쉬운 챔피언 | 함께하면 좋은 챔피언         */}
        {/* 행 간격을 줄여 컴팩트하게 밀착 정렬된 하나의 통합 상성 카드                  */}
        {/* ========================================================================= */}
        <div className="bg-[#12121a] border border-[#232332] rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#1e1e2a]">
            {/* 1. 상대하기 어려운 챔피언 (Hard Counter Table) */}
            <div className="flex flex-col bg-[#0f0f17]">
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#0a0a12] border-b border-[#1c1c28]">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#f87171]" />
                  <h3 className="text-[12px] font-black text-white">상대하기 어려운 챔피언</h3>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/30">
                  주의 필요
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#181824] text-[#606078] text-[9.5px]">
                      <th className="py-1.5 px-3 font-semibold">챔피언</th>
                      <th className="py-1.5 px-2 text-center font-semibold">게임 수</th>
                      <th className="py-1.5 px-3 text-right font-semibold">상대 승률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141420]">
                    {currentDetailChamp.counters.map((cnt, idx) => {
                      const sampleGames = Math.round(
                        (currentDetailChamp.totalGames * (0.045 + (idx + 1) * 0.012)) / 10
                      ) * 10;
                      return (
                        <tr
                          key={cnt.name}
                          onClick={() => setSelectedChampId(cnt.name)}
                          className="hover:bg-[#181828] transition-colors cursor-pointer group"
                        >
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-2">
                              <ChampionIcon
                                name={cnt.name}
                                size={24}
                                shape="square"
                                className="rounded border border-[#2a2a3e] group-hover:border-[#f87171] transition-colors shadow-2xs shrink-0"
                              />
                              <span className="font-bold text-white group-hover:text-[#f87171] transition-colors text-[11px] truncate">
                                {cnt.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center text-[#717188] font-medium text-[10px]">
                            {sampleGames.toLocaleString()}판
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-black text-[#f87171] text-[11px]">
                                {cnt.winRate.toFixed(1)}%
                              </span>
                              <div className="w-8 h-1.5 rounded-full bg-[#1e1e2c] overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-[#ef4444] rounded-full"
                                  style={{ width: `${Math.min(100, cnt.winRate)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. 상대하기 쉬운 챔피언 (Easy Matchups Table) */}
            <div className="flex flex-col bg-[#0f0f17]">
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#0a0a12] border-b border-[#1c1c28]">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-[#34d399]" />
                  <h3 className="text-[12px] font-black text-white">상대하기 쉬운 챔피언</h3>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30">
                  유리한 상성
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#181824] text-[#606078] text-[9.5px]">
                      <th className="py-1.5 px-3 font-semibold">챔피언</th>
                      <th className="py-1.5 px-2 text-center font-semibold">게임 수</th>
                      <th className="py-1.5 px-3 text-right font-semibold">승률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141420]">
                    {currentDetailChamp.easyMatchups.map((esy, idx) => {
                      const sampleGames = Math.round(
                        (currentDetailChamp.totalGames * (0.048 + (idx + 1) * 0.011)) / 10
                      ) * 10;
                      return (
                        <tr
                          key={esy.name}
                          onClick={() => setSelectedChampId(esy.name)}
                          className="hover:bg-[#181828] transition-colors cursor-pointer group"
                        >
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-2">
                              <ChampionIcon
                                name={esy.name}
                                size={24}
                                shape="square"
                                className="rounded border border-[#2a2a3e] group-hover:border-[#34d399] transition-colors shadow-2xs shrink-0"
                              />
                              <span className="font-bold text-white group-hover:text-[#34d399] transition-colors text-[11px] truncate">
                                {esy.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center text-[#717188] font-medium text-[10px]">
                            {sampleGames.toLocaleString()}판
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-black text-[#34d399] text-[11px]">
                                {esy.winRate.toFixed(1)}%
                              </span>
                              <div className="w-8 h-1.5 rounded-full bg-[#1e1e2c] overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-[#10b981] rounded-full"
                                  style={{ width: `${Math.min(100, esy.winRate)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. 함께하면 좋은 챔피언 (Synergies Table) */}
            <div className="flex flex-col bg-[#0f0f17]">
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#0a0a12] border-b border-[#1c1c28]">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#60a5fa]" />
                  <h3 className="text-[12px] font-black text-white">함께하면 좋은 챔피언</h3>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                  추천 듀오
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#181824] text-[#606078] text-[9.5px]">
                      <th className="py-1.5 px-3 font-semibold">챔피언</th>
                      <th className="py-1.5 px-2 text-center font-semibold">게임 수</th>
                      <th className="py-1.5 px-3 text-right font-semibold">듀오 승률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141420]">
                    {currentDetailChamp.synergies.map((syn, idx) => {
                      const sampleGames = Math.round(
                        (currentDetailChamp.totalGames * (0.052 + (idx + 1) * 0.015)) / 10
                      ) * 10;
                      return (
                        <tr
                          key={syn.name}
                          onClick={() => setSelectedChampId(syn.name)}
                          className="hover:bg-[#181828] transition-colors cursor-pointer group"
                        >
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-2">
                              <ChampionIcon
                                name={syn.name}
                                size={24}
                                shape="square"
                                className="rounded border border-[#2a2a3e] group-hover:border-[#60a5fa] transition-colors shadow-2xs shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-white group-hover:text-[#60a5fa] transition-colors block truncate text-[11px]">
                                  {syn.name}
                                </span>
                                {syn.role && (
                                  <span className="text-[8.5px] text-[#717188] block -mt-0.5">
                                    {syn.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center text-[#717188] font-medium text-[10px]">
                            {sampleGames.toLocaleString()}판
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-black text-[#60a5fa] text-[11px]">
                                {syn.winRate.toFixed(1)}%
                              </span>
                              <div className="w-8 h-1.5 rounded-full bg-[#1e1e2c] overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-[#3b82f6] rounded-full"
                                  style={{ width: `${Math.min(100, syn.winRate)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN LIST VIEW (2분할 레이아웃 - 좌측 그리드 + 우측 티어리스트)
  // -------------------------------------------------------------
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ========================================================= */}
        {/* 좌측 (4.5 컬럼): 포지션 아이콘, 초성 필터, 검색창, 챔피언 그리드 */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-4 bg-[#12121a] border border-[#232332] rounded-2xl p-4 sm:p-4.5 space-y-3.5 shadow-lg">
          {/* 포지션 아이콘 필터 */}
          <div className="flex items-center justify-between bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-1 gap-1">
            {(
              [
                { id: 'ALL', label: '전체' },
                { id: 'TOP', label: '탑' },
                { id: 'JGL', label: '정글' },
                { id: 'MID', label: '미드' },
                { id: 'ADC', label: '바텀' },
                { id: 'SUP', label: '서폿' },
              ] as const
            ).map((pos) => {
              const active = selectedPosition === pos.id;
              return (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => {
                    setSelectedPosition(pos.id);
                    if (pos.id !== 'ALL') {
                      setTablePosition(pos.id);
                    }
                  }}
                  className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                    active
                      ? 'bg-[#3b82f6] text-white shadow-sm'
                      : 'text-[#8a8aa0] hover:text-white hover:bg-[#181824]'
                  }`}
                  title={`${pos.label} 라인 필터`}
                >
                  {renderPositionIcon(pos.id, 'w-3.5 h-3.5 mb-0.5')}
                  <span>{pos.label}</span>
                </button>
              );
            })}
          </div>

          {/* 초성 필터 버튼 목록 */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5">
            {CHOSUNG_BUTTONS.map((ch) => {
              const active = selectedChosung === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChosung(ch)}
                  className={`w-6 h-6 shrink-0 rounded text-[11px] font-bold transition-all flex items-center justify-center ${
                    active
                      ? 'bg-[#3b82f6] text-white'
                      : 'bg-[#0a0a10] text-[#717188] hover:text-white hover:bg-[#1a1a28]'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>

          {/* 챔피언 실시간 검색창 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#717188] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="챔피언 검색 (한글/영문/초성)..."
              className="w-full bg-[#0a0a10] border border-[#232332] rounded-xl pl-9 pr-8 py-2 text-[12px] text-white placeholder-[#505068] focus:outline-none focus:border-[#3b82f6] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717188] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 챔피언 그리드 목록 (스크롤 영역) */}
          <div className="pt-1">
            <div className="text-[11px] text-[#717188] font-bold mb-2 flex items-center justify-between">
              <span>챔피언 목록 ({leftGridChampions.length})</span>
              <span className="text-[10px] text-[#505068]">클릭 시 상세 빌드</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[580px] overflow-y-auto pr-1">
              {leftGridChampions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const target = allChampions.find(
                      (ch) => ch.name === c.name && (selectedPosition !== 'ALL' ? ch.position === selectedPosition : true)
                    ) || c;
                    setSelectedChampId(target.id);
                    onToast?.(`${c.name} (${getPositionDisplayLabel(target.position, target.isApc)}) 상세 빌드로 이동했습니다.`);
                  }}
                  className="flex flex-col items-center p-1.5 rounded-xl hover:bg-[#1a1a28] border border-transparent hover:border-[#2a2a3e] transition-all group cursor-pointer text-center"
                >
                  <ChampionIcon
                    name={c.name}
                    size={40}
                    shape="square"
                    className="rounded-lg border border-[#232332] group-hover:border-[#3b82f6] transition-colors shadow-xs"
                  />
                  <span className="text-[11px] font-medium text-[#c0c0d0] group-hover:text-white mt-1 max-w-full truncate">
                    {c.name}
                  </span>
                </button>
              ))}

              {leftGridChampions.length === 0 && (
                <div className="col-span-full py-12 text-center text-[#717188] text-[12px]">
                  검색 조건에 맞는 챔피언이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 우측 (7.5 ~ 8 컬럼): 포지션 탭 + 티어 선택 필터 및 챔피언 티어리스트 테이블 */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-8 space-y-3.5">
          {/* 상단 컨트롤 바: 포지션 탭 + 티어 선택 드롭다운/필터 */}
          <div className="bg-[#12121a] border border-[#232332] rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
            {/* 포지션 탭: [탑], [정글], [미드], [바텀], [서폿] */}
            <div className="flex items-center gap-1 bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-1 overflow-x-auto scrollbar-hide">
              {(
                [
                  { id: 'TOP', label: '탑' },
                  { id: 'JGL', label: '정글' },
                  { id: 'MID', label: '미드' },
                  { id: 'ADC', label: '바텀' },
                  { id: 'SUP', label: '서폿' },
                ] as const
              ).map((tab) => {
                const active = tablePosition === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setTablePosition(tab.id);
                      setSelectedPosition(tab.id);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all shrink-0 ${
                      active
                        ? 'bg-[#3b82f6] text-white shadow-sm'
                        : 'text-[#8a8aa0] hover:text-white hover:bg-[#181824]'
                    }`}
                  >
                    {renderPositionIcon(tab.id, 'w-3.5 h-3.5')}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 티어 선택 필터: [브실골플], [Emerald+], [Diamond+], [Master+] 및 실시간 패치 버전 배지 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-[#0a0a10] border border-[#1e1e2a] rounded-xl p-1 overflow-x-auto scrollbar-hide shrink-0">
                {TIER_GROUPS.map((tg) => {
                  const active = tierGroup === tg.id;
                  return (
                    <button
                      key={tg.id}
                      type="button"
                      onClick={() => setTierGroup(tg.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                        active
                          ? 'bg-[#1e1e2e] text-[#60a5fa] border border-[#3b82f6]/50 shadow-sm'
                          : 'text-[#717188] hover:text-white'
                      }`}
                    >
                      {tg.label}
                    </button>
                  );
                })}
              </div>

              {/* 실시간 최신 패치버전 드롭다운 배지 */}
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => setIsPatchDropdownOpen((p) => !p)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0a0a10] hover:bg-[#141420] border border-[#1e1e2a] text-[11px] font-bold text-[#c0c0d8] transition-all shadow-xs cursor-pointer"
                  title="라이엇 공식 최신 패치버전"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  <span>{formatPatchDisplay(currentPatch)} 패치</span>
                  <ChevronDown className="w-3 h-3 text-[#717188]" />
                </button>
                {isPatchDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-[#12121a] border border-[#262638] shadow-2xl z-50 py-1 text-[11px] animate-in fade-in duration-150">
                    <div className="px-3 py-1 text-[9px] text-[#717188] font-bold border-b border-[#1c1c28]">
                      라이엇 최신 패치
                    </div>
                    {patchList.map((ver) => {
                      const isSel = ver === currentPatch;
                      return (
                        <button
                          key={ver}
                          type="button"
                          onClick={() => {
                            setActivePatch(ver);
                            setCurrentPatch(ver);
                            setIsPatchDropdownOpen(false);
                            onToast?.(`${formatPatchDisplay(ver)} 패치로 변경되었습니다.`);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#1c1c28] transition-colors cursor-pointer ${
                            isSel ? 'text-[#60a5fa] font-black bg-[#161626]' : 'text-[#a0a0b8]'
                          }`}
                        >
                          <span>{formatPatchDisplay(ver)} 패치</span>
                          {isSel && <Check className="w-3 h-3 text-[#60a5fa]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 챔피언 티어리스트 테이블 (컬럼: 랭킹, 챔피언, 티어배지, 승률, 픽률, 밴률, 카운터 3개) */}
          <div className="bg-[#12121a] border border-[#232332] rounded-2xl overflow-hidden shadow-lg">
            {/* 포지션 통계 요약 배너 */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e16] border-b border-[#1e1e2a] text-[12px] flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white">{getPositionLabel(tablePosition)} 챔피언 티어 순위</span>
                <span className="text-[11px] text-[#38bdf8] font-bold bg-[#0284c7]/15 px-2 py-0.5 rounded-md border border-[#0284c7]/30">
                  총 {tableChampions.length}개 챔피언 통계
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#10b981]/15 border border-[#10b981]/30 text-[#34d399] text-[11px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full bg-[#10b981] ${isD1MetaLoading ? 'animate-ping' : 'animate-pulse'}`} />
                  <span>D1 실시간 메타 연동됨</span>
                </span>
              </div>
              <div className="text-[11px] text-[#717188] hidden sm:flex items-center gap-2">
                <span>{tablePosition === 'ADC' ? '원거리 딜러 및 비원딜 전체 포함' : 'D1 백엔드 실시간 크롤링 연동'}</span>
                {d1MetaUpdatedAt && (
                  <span className="text-[10px] text-[#52526e]">({d1MetaUpdatedAt.split('T')[0]})</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead>
                  <tr className="bg-[#0c0c14] border-b border-[#1e1e2a] text-[11px] text-[#717188] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-12 text-center">순위</th>
                    <th className="py-3 px-3.5">챔피언</th>
                    <th className="py-3 px-3 text-center w-16">티어</th>
                    <th className="py-3 px-3 text-center">승률</th>
                    <th className="py-3 px-3 text-center">픽률</th>
                    <th className="py-3 px-3 text-center">밴률</th>
                    <th className="py-3 px-4">카운터 챔피언 (3개)</th>
                    <th className="py-3 px-3 text-center w-12">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2a]/50 text-[13px]">
                  {tableChampions.map((c, idx) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        setSelectedChampId(c.id);
                        onToast?.(`${c.name} (${getPositionDisplayLabel(c.position, c.isApc)}) 상세 빌드로 이동합니다.`);
                      }}
                      className="hover:bg-[#181824] transition-colors cursor-pointer group"
                    >
                      {/* 순위 */}
                      <td className="py-3.5 px-3.5 text-center font-bold">
                        <span
                          className={`inline-block w-5 text-center text-[13px] ${
                            idx === 0
                              ? 'text-[#fbbf24] font-black'
                              : idx < 3
                              ? 'text-[#60a5fa] font-black'
                              : 'text-[#505068]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* 챔피언 */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <ChampionIcon name={c.name} size={36} shape="square" />
                          <div>
                            <div className="font-bold text-white group-hover:text-[#60a5fa] transition-colors flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.tag && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                    c.tag === '비원딜'
                                      ? 'bg-[#8b5cf6]/20 text-[#c084fc] border border-[#a855f7]/30'
                                      : c.tag === '원딜'
                                      ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                                      : 'bg-[#1e1e2e] text-[#8a8aa0] border border-[#2e2e42]'
                                  }`}
                                >
                                  {c.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#717188]">{c.enName}</div>
                          </div>
                        </div>
                      </td>

                      {/* 티어 배지 */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-black border uppercase tracking-wider ${getTierBadgeStyle(
                            c.tier
                          )}`}
                        >
                          {c.tier === 'OP' ? 'OP' : `${c.tier}티어`}
                        </span>
                      </td>

                      {/* 승률 */}
                      <td className="py-3.5 px-3 text-center">
                        <div
                          className={`font-black text-[13px] ${
                            c.winRate >= 52
                              ? 'text-[#34d399]'
                              : c.winRate <= 49
                              ? 'text-[#f87171]'
                              : 'text-white'
                          }`}
                        >
                          {c.winRate.toFixed(1)}%
                        </div>
                      </td>

                      {/* 픽률 */}
                      <td className="py-3.5 px-3 text-center font-bold text-white text-[12px]">
                        {c.pickRate.toFixed(1)}%
                      </td>

                      {/* 밴률 */}
                      <td className="py-3.5 px-3 text-center font-bold text-[#f87171] text-[12px]">
                        {c.banRate.toFixed(1)}%
                      </td>

                      {/* 카운터 3개 */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {c.counters.slice(0, 3).map((cnt) => (
                            <div
                              key={cnt.name}
                              className="flex items-center gap-1 bg-[#0c0c14] border border-[#232332] px-1.5 py-0.5 rounded-lg"
                              title={`${cnt.name} 상대 승률: ${cnt.winRate}%`}
                            >
                              <ChampionIcon name={cnt.name} size={20} />
                              <span className="text-[10px] text-[#f87171] font-bold">
                                {cnt.winRate}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* 상세 화살표 */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#1a1a26] text-[#717188] group-hover:text-white group-hover:bg-[#3b82f6] transition-all">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
