// DeepLoL style Solo Rank Champions & Builds Database
import { CHAMPIONS_LIST } from './initialMatches';
import { getChampionEnName } from '../lib/champions';
import { DDragonChampionItem, getInitialChampionCatalog } from '../lib/ddragonService';

export type SoloRankTierLevel = 'OP' | '1' | '2' | '3' | '4' | '5';
export type SoloRankPosition = 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SUP';
export type SoloRankTierGroup = 'all_ranks' | 'emerald_plus' | 'diamond_plus' | 'master_plus';

export interface RuneTreeData {
  primaryStyle: '정밀' | '지배' | '마법' | '결의' | '영감';
  primaryKeystone: string;
  primaryRow1: string;
  primaryRow2: string;
  primaryRow3: string;
  subStyle: '정밀' | '지배' | '마법' | '결의' | '영감';
  subRow1: string;
  subRow2: string;
  shards: [string, string, string];
  pickRate: number;
  winRate: number;
}

export interface SpellPairData {
  spell1: string;
  spell2: string;
  pickRate: number;
  winRate: number;
}

export interface CoreItemData {
  name: string;
  order: number;
  winRate: number;
  pickRate: number;
  gold: number;
}

export interface ChampionBuildDetail {
  starterItems: Array<{ name: string; icon?: string }>;
  spells: SpellPairData[];
  runes: RuneTreeData;
  coreItems: CoreItemData[]; // 1코어 ~ 5코어
  boots: Array<{ name: string; winRate: number; pickRate: number }>;
  skillOrder: {
    mastery: string[]; // e.g. ['Q', 'W', 'E']
    sequence: Array<'Q' | 'W' | 'E' | 'R'>; // 1~15 lvl
  };
}

export interface SoloRankChampionData {
  id: string;
  name: string;
  enName: string;
  title: string;
  position: SoloRankPosition;
  tier: SoloRankTierLevel;
  winRate: number; // e.g. 52.3%
  pickRate: number; // e.g. 14.2%
  banRate: number; // e.g. 21.5%
  ranking: number;
  totalGames: number;
  counters: Array<{ name: string; winRate: number }>; // 상대하기 어려운 카운터 3개
  easyMatchups: Array<{ name: string; winRate: number }>; // 상대하기 쉬운 챔피언 3개
  synergies: Array<{ name: string; winRate: number; role?: string }>; // 함께하면 좋은 시너지
  build: ChampionBuildDetail;
  isApc?: boolean;
  tag?: string;
  allPositions?: SoloRankPosition[];
}

// 룬 전체 구조 정보 (DeepLoL 전체 룬 트리 렌더링용)
export interface RuneStyleDefinition {
  name: '정밀' | '지배' | '마법' | '결의' | '영감';
  icon: string;
  keystones: string[];
  row1: string[];
  row2: string[];
  row3: string[];
}

export const ALL_RUNE_STYLES: Record<'정밀' | '지배' | '마법' | '결의' | '영감', RuneStyleDefinition> = {
  정밀: {
    name: '정밀',
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
    keystones: ['집중 공격', '치명적 속도', '기민한 발놀림', '정복자'],
    row1: ['생명 흡수', '승전보', '침착'],
    row2: ['전설: 민첩함', '전설: 가속', '전설: 핏빛 길'],
    row3: ['최후의 일격', '체력차 극복', '최후의 저항'],
  },
  지배: {
    name: '지배',
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
    keystones: ['감전', '어둠의 수확', '칼날비'],
    row1: ['비열한 한 방', '피의 맛', '돌발 일격'],
    row2: ['좀비 와드', '유령 포로', '사냥의 증표'],
    row3: ['보물 사냥꾼', '영리한 사냥꾼', '궁극의 사냥꾼'],
  },
  마법: {
    name: '마법',
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
    keystones: ['콩콩이 소환', '신비로운 유성', '난입'],
    row1: ['무효화 구체', '마나순환 팔찌', '빛의 망토'],
    row2: ['깨달음', '기민함', '절대 집중'],
    row3: ['주문 작열', '물 위를 걷는 자', '폭풍의 결집'],
  },
  결의: {
    name: '결의',
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
    keystones: ['착취의 손아귀', '여진', '수호자'],
    row1: ['철거', '생명의 샘', '보호막 강타'],
    row2: ['사전 준비', '재생의 바람', '뼈 방패'],
    row3: ['과잉성장', '소생', '불굴의 의지'],
  },
  영감: {
    name: '영감',
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
    keystones: ['빙결 강화', '봉인 풀린 주문서', '선제공격'],
    row1: ['마법공학 점멸기', '마법의 신발', '환급'],
    row2: ['삼중 물약', '시간 왜곡 물약', '비스킷 배달'],
    row3: ['우주적 통찰력', '쾌속 접근', '다재다능'],
  },
};

export interface StatShardItem {
  id: string;
  label: string;
  icon: string;
}

export const STAT_SHARDS: {
  row1: StatShardItem[];
  row2: StatShardItem[];
  row3: StatShardItem[];
} = {
  row1: [
    {
      id: 'adaptive',
      label: '적응형 능력치 +9',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png',
    },
    {
      id: 'attack_speed',
      label: '공격 속도 +10%',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png',
    },
    {
      id: 'ability_haste',
      label: '스킬 가속 +8',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png',
    },
  ],
  row2: [
    {
      id: 'adaptive',
      label: '적응형 능력치 +9',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png',
    },
    {
      id: 'move_speed',
      label: '이동 속도 +2%',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMovementSpeedIcon.png',
    },
    {
      id: 'health_scaling',
      label: '성장 체력 +10~180',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png',
    },
  ],
  row3: [
    {
      id: 'health_flat',
      label: '체력 +65',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthPlusIcon.png',
    },
    {
      id: 'tenacity',
      label: '강인함 및 둔화 저항 10%',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsTenacityIcon.png',
    },
    {
      id: 'health_scaling_def',
      label: '성장 체력 +10~180',
      icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png',
    },
  ],
};

// 개별 룬 아이콘 URL 매핑 (공식 DataDragon)
export const RUNE_ICON_MAP: Record<string, string> = {
  // 정밀
  '집중 공격': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
  '치명적 속도': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
  '기민한 발놀림': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
  '정복자': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
  '생명 흡수': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/AbsorbLife/AbsorbLife.png',
  '과다치유': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/AbsorbLife/AbsorbLife.png',
  '승전보': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png',
  '침착': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png',
  '전설: 민첩함': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png',
  '전설: 가속': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendHaste/LegendHaste.png',
  '전설: 핏빛 길': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png',
  '최후의 일격': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png',
  '체력차 극복': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CutDown/CutDown.png',
  '최후의 저항': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LastStand/LastStand.png',

  // 지배
  '감전': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png',
  '어둠의 수확': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
  '칼날비': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png',
  '비열한 한 방': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/CheapShot/CheapShot.png',
  '피의 맛': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png',
  '돌발 일격': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png',
  '좀비 와드': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/ZombieWard/ZombieWard.png',
  '유령 포로': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/GhostPoro/GhostPoro.png',
  '사냥의 증표': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png',
  '보물 사냥꾼': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png',
  '영리한 사냥꾼': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/IngeniousHunter/IngeniousHunter.png',
  '궁극의 사냥꾼': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png',

  // 마법
  '콩콩이 소환': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
  '신비로운 유성': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
  '난입': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png',
  '무효화 구체': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NullifyingOrb/PBE_NullifyingOrb_Grey.png',
  '마나순환 팔찌': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png',
  '빛의 망토': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NimbusCloak/6361.png',
  '깨달음': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png',
  '기민함': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png',
  '절대 집중': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png',
  '주문 작열': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Scorch/Scorch.png',
  '물 위를 걷는 자': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Waterwalking/Waterwalking.png',
  '폭풍의 결집': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png',

  // 결의
  '착취의 손아귀': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
  '여진': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png',
  '수호자': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png',
  '철거': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Demolish/Demolish.png',
  '생명의 샘': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/FontOfLife/FontOfLife.png',
  '보호막 강타': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/MirrorShell/MirrorShell.png',
  '사전 준비': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Conditioning/Conditioning.png',
  '재생의 바람': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png',
  '뼈 방패': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png',
  '과잉성장': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png',
  '소생': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Revitalize/Revitalize.png',
  '불굴의 의지': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png',

  // 영감
  '빙결 강화': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
  '봉인 풀린 주문서': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png',
  '선제공격': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png',
  '마법공학 점멸기': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png',
  '마법의 신발': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png',
  '환급': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CashBack/CashBack2.png',
  '캐시백': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CashBack/CashBack2.png',
  '삼중 물약': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/PerfectTiming/AlchemistsCabinet.png',
  '비스킷 배달': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png',
  '시간 왜곡 물약': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/TimeWarpTonic/TimeWarpTonic.png',
  '우주적 통찰력': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png',
  '쾌속 접근': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/ApproachVelocity/ApproachVelocity.png',
  '다재다능': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/JackOfAllTrades/JackofAllTrades2.png',
  '신호탄': 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png',
};


import {
  getCachedD1Champions,
  fetchD1ChampionMeta,
  D1_API_ENDPOINT,
  RawD1ChampionRecord,
  mapD1RecordToChampionData,
  parseD1Position,
  parseD1Tier,
} from "../lib/d1ChampionApi";

export {
  getCachedD1Champions,
  fetchD1ChampionMeta,
  D1_API_ENDPOINT,
  mapD1RecordToChampionData,
  parseD1Position,
  parseD1Tier,
};
export type { RawD1ChampionRecord };

// 기본 포지션 추정기 (160+ 챔피언 전부 자동 매핑)
export const CHAMPION_DEFAULT_POSITIONS: Record<string, SoloRankPosition> = {
  // 탑
  '가렌': 'TOP', '갱플랭크': 'TOP', '그웬': 'TOP', '나르': 'TOP', '나서스': 'TOP',
  '다리우스': 'TOP', '레넥톤': 'TOP', '리븐': 'TOP', '말파이트': 'TOP', '모데카이저': 'TOP',
  '문도 박사': 'TOP', '볼리베어': 'TOP', '사이온': 'TOP', '세트': 'TOP', '쉔': 'TOP',
  '아트록스': 'TOP', '오른': 'TOP', '올라프': 'TOP', '요릭': 'TOP', '우르곳': 'TOP',
  '일라오이': 'TOP', '잭스': 'TOP', '초가스': 'TOP', '카밀': 'TOP', '케넨': 'TOP',
  '케일': 'TOP', '크산테': 'TOP', '클레드': 'TOP', '피오라': 'TOP', '암베사': 'TOP',

  // 정글
  '그라가스': 'JGL', '그레이브즈': 'JGL', '녹턴': 'JGL', '누누와 윌럼프': 'JGL', '니달리': 'JGL',
  '다이애나': 'JGL', '람머스': 'JGL', '렉사이': 'JGL', '렝가': 'JGL', '리 신': 'JGL',
  '릴리아': 'JGL', '마스터 이': 'JGL', '바이': 'JGL', '벨베스': 'JGL', '브라이어': 'JGL',
  '비에고': 'JGL', '뽀삐': 'JGL', '샤코': 'JGL', '세주아니': 'JGL', '쉬바나': 'JGL',
  '스카너': 'JGL', '신 짜오': 'JGL', '아무무': 'JGL', '아이번': 'JGL', '에코': 'JGL',
  '엘리스': 'JGL', '오공': 'JGL', '우디르': 'JGL', '워윅': 'JGL', '이블린': 'JGL',
  '자르반 4세': 'JGL', '자크': 'JGL', '카직스': 'JGL', '케인': 'JGL', '킨드레드': 'JGL',
  '헤카림': 'JGL',

  // 미드
  '갈리오': 'MID', '나피리': 'MID', '라이즈': 'MID', '르블랑': 'MID', '리산드라': 'MID',
  '말자하': 'MID', '베이가': 'MID', '벡스': 'MID', '벨코즈': 'MID', '블라디미르': 'MID',
  '빅토르': 'MID', '사일러스': 'MID', '스웨인': 'MID', '신드라': 'MID', '아리': 'MID',
  '아우렐리온 솔': 'MID', '아지르': 'MID', '아칼리': 'MID', '아크샨': 'MID', '애니': 'MID',
  '애니비아': 'MID', '야스오': 'MID', '오리아나': 'MID', '요네': 'MID', '제드': 'MID',
  '제라스': 'MID', '제이스': 'MID', '조이': 'MID', '직스': 'MID', '카사딘': 'MID',
  '카서스': 'MID', '카시오페아': 'MID', '카타리나': 'MID', '코르키': 'MID', '키아나': 'MID',
  '탈론': 'MID', '탈리야': 'MID', '트위스티드 페이트': 'MID', '피즈': 'MID', '흐웨이': 'MID',

  // 원딜
  '드레이븐': 'ADC', '루시안': 'ADC', '미스 포츈': 'ADC', '바루스': 'ADC', '베인': 'ADC',
  '사미라': 'ADC', '세나': 'ADC', '스몰더': 'ADC', '시비르': 'ADC', '아펠리오스': 'ADC',
  '애쉬': 'ADC', '이즈리얼': 'ADC', '자야': 'ADC', '제리': 'ADC', '진': 'ADC',
  '징크스': 'ADC', '카이사': 'ADC', '칼리스타': 'ADC', '코그모': 'ADC', '트리스타나': 'ADC',
  '트위치': 'ADC', '닐라': 'ADC',

  // 서폿
  '나미': 'SUP', '노틸러스': 'SUP', '라칸': 'SUP', '럭스': 'SUP', '레나타 글라스크': 'SUP',
  '레오나': 'SUP', '렐': 'SUP', '룰루': 'SUP', '밀리오': 'SUP', '바드': 'SUP',
  '브라움': 'SUP', '브랜드': 'SUP', '블리츠크랭크': 'SUP', '소나': 'SUP', '소라카': 'SUP',
  '쓰레쉬': 'SUP', '알리스타': 'SUP', '유미': 'SUP', '자이라': 'SUP', '잔나': 'SUP',
  '질리언': 'SUP', '카르마': 'SUP', '타릭': 'SUP', '탐 켄치': 'SUP', '파이크': 'SUP',
  '하이머딩거': 'SUP',
};


// D1 API에서 실시간/캐시된 챔피언 메타 데이터를 솔로랭크 형식으로 반환
export function getSoloRankChampions(
  tierGroup: SoloRankTierGroup = "emerald_plus",
  customCatalog?: DDragonChampionItem[]
): SoloRankChampionData[] {
  const cached = getCachedD1Champions();
  if (cached && cached.length > 0) {
    return cached;
  }

  // 아직 D1 캐시가 메모리에 로드되지 않은 첫 렌더 시 백그라운드 자동 로드 트리거
  fetchD1ChampionMeta().catch(() => {});

  // 초기 카탈로그 기반 기본 데이터 반환 (DataDragon)
  const catalog = customCatalog && customCatalog.length > 0 ? customCatalog : getInitialChampionCatalog();
  return catalog.map((champ, idx) => {
    const pos = (champ.positions && champ.positions[0]) || CHAMPION_DEFAULT_POSITIONS[champ.name] || "MID";
    return {
      id: `${champ.id.toLowerCase()}-${pos.toLowerCase()}`,
      name: champ.name,
      enName: champ.enName || champ.id,
      title: champ.title || "챔피언",
      position: pos as SoloRankPosition,
      tier: "2",
      winRate: 50.0,
      pickRate: 5.0,
      banRate: 2.0,
      ranking: idx + 1,
      totalGames: 25000,
      counters: [{ name: "이즈리얼", winRate: 46.5 }, { name: "사미라", winRate: 47.0 }],
      easyMatchups: [{ name: "징크스", winRate: 53.5 }, { name: "오리아나", winRate: 54.0 }],
      synergies: [{ name: "노틸러스", winRate: 53.5, role: "SUP" }],
      build: {
        starterItems: [{ name: "도란의 검" }, { name: "체력 물약" }],
        spells: [{ spell1: "점멸", spell2: "순간이동", pickRate: 70, winRate: 50 }],
        runes: {
          primaryStyle: "정밀",
          primaryKeystone: "정복자",
          primaryRow1: "생명 흡수",
          primaryRow2: "전설: 민첩함",
          primaryRow3: "최후의 일격",
          subStyle: "영감",
          subRow1: "비스킷 배달",
          subRow2: "우주적 통찰력",
          shards: ["공격 속도 +10%", "적응형 능력치 +9", "성장 체력 +10~180"],
          pickRate: 50,
          winRate: 50,
        },
        coreItems: [
          { name: "삼위일체", order: 1, winRate: 50.5, pickRate: 60, gold: 3333 },
          { name: "스테락의 도전", order: 2, winRate: 51.5, pickRate: 50, gold: 3200 },
          { name: "죽음의 무도", order: 3, winRate: 52.5, pickRate: 40, gold: 3300 },
        ],
        boots: [{ name: "판금 장화", winRate: 50, pickRate: 70 }],
        skillOrder: {
          mastery: ["Q", "W", "E"],
          sequence: ["Q", "W", "E", "Q", "Q", "R", "Q", "W", "Q", "W", "R", "W", "W", "E", "E"],
        },
      },
    };
  });
}
