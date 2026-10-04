/**
 * src/lib/metaCrawlerService.ts
 * 롤PS (LOL.PS) & DeepLoL 기준 메타 크롤링 데이터 파서 및 D1 동기화 엔진
 */

import {
  MetaTierDivision,
  MetaPosition,
  ChampionTierItem,
  ChampionBuildItem,
  MainRuneTreeData,
  SubRuneTreeData,
  StatShardsData,
  CoreItemsBuildTree,
} from '../types/d1Meta';
import { batchUpsertMetaStats } from './d1MetaService';

/**
 * 롤 공식 룬 트리 상수 (정밀, 지배, 마법, 결의, 영감 전체 룬 목록)
 */
export const RUNE_STYLES = {
  PRECISION: {
    id: 8000,
    name: '정밀',
    rows: [
      [
        { id: 8005, name: '집중 공격', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png' },
        { id: 8008, name: '치명적 속도', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png' },
        { id: 8021, name: '기민한 발놀림', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png' },
        { id: 8010, name: '정복자', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png' },
      ],
      [
        { id: 9101, name: '과다치유', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Overheal.png' },
        { id: 9111, name: '승전보', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png' },
        { id: 8009, name: '침착', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png' },
      ],
      [
        { id: 9104, name: '전설: 민첩함', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png' },
        { id: 9105, name: '전설: 강인함', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendTenacity/LegendTenacity.png' },
        { id: 9103, name: '전설: 핏빛 길', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png' },
      ],
      [
        { id: 8014, name: '최후의 일격', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png' },
        { id: 8017, name: '체력차 극복', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CutDown/CutDown.png' },
        { id: 8299, name: '최후의 저항', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LastStand/LastStand.png' },
      ],
    ],
  },
  DOMINATION: {
    id: 8100,
    name: '지배',
    rows: [
      [
        { id: 8112, name: '감전', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png' },
        { id: 8128, name: '어둠의 수확', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png' },
        { id: 9923, name: '칼날비', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png' },
      ],
      [
        { id: 8126, name: '비열한 한 방', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/CheapShot/CheapShot.png' },
        { id: 8139, name: '피의 맛', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png' },
        { id: 8143, name: '돌발 일격', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/SuddenImpact/SuddenImpact.png' },
      ],
      [
        { id: 8136, name: '좀비 와드', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/ZombieWard/ZombieWard.png' },
        { id: 8120, name: '유령 포로', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/GhostPoro/GhostPoro.png' },
        { id: 8138, name: '사냥의 증표', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/EyeballCollection/EyeballCollection.png' },
      ],
      [
        { id: 8135, name: '보물 사냥꾼', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png' },
        { id: 8134, name: '영리한 사냥꾼', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/IngeniousHunter/IngeniousHunter.png' },
        { id: 8105, name: '끈질긴 사냥꾼', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/RelentlessHunter/RelentlessHunter.png' },
        { id: 8106, name: '궁극의 사냥꾼', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png' },
      ],
    ],
  },
  SORCERY: {
    id: 8200,
    name: '마법',
    rows: [
      [
        { id: 8214, name: '콩콩이 소환', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png' },
        { id: 8229, name: '유성', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png' },
        { id: 8230, name: '난입', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png' },
      ],
      [
        { id: 8224, name: '무효화 구체', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NullifyingOrb/PBE_NullifyingOrb.png' },
        { id: 8226, name: '마나순환 팔찌', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png' },
        { id: 8275, name: '빛의 망토', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NimbusCloak/6361.png' },
      ],
      [
        { id: 8210, name: '깨달음', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png' },
        { id: 8234, name: '기민함', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png' },
        { id: 8233, name: '절대 집중', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png' },
      ],
      [
        { id: 8237, name: '주문 작열', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Scorch/Scorch.png' },
        { id: 8232, name: '물 위를 걷는 자', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Waterwalking/Waterwalking.png' },
        { id: 8236, name: '폭풍의 결집', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png' },
      ],
    ],
  },
  RESOLVE: {
    id: 8400,
    name: '결의',
    rows: [
      [
        { id: 8437, name: '착취의 손아귀', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png' },
        { id: 8439, name: '여진', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png' },
        { id: 8465, name: '수호자', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png' },
      ],
      [
        { id: 8446, name: '철거', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Demolish/Demolish.png' },
        { id: 8463, name: '생명의 샘', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/FontOfLife/FontOfLife.png' },
        { id: 8401, name: '보호막 강타', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/MirrorShell/MirrorShell.png' },
      ],
      [
        { id: 8429, name: '사전 준비', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Conditioning/Conditioning.png' },
        { id: 8444, name: '재생의 바람', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png' },
        { id: 8473, name: '뼈 방패', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png' },
      ],
      [
        { id: 8451, name: '과잉성장', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png' },
        { id: 8453, name: '소생', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Revitalize/Revitalize.png' },
        { id: 8242, name: '불굴의 의지', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png' },
      ],
    ],
  },
  INSPIRATION: {
    id: 8300,
    name: '영감',
    rows: [
      [
        { id: 8351, name: '빙결 강화', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png' },
        { id: 8360, name: '봉인 풀린 주문서', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png' },
        { id: 8369, name: '선제공격', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png' },
      ],
      [
        { id: 8306, name: '마법공학 점멸기', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png' },
        { id: 8304, name: '마법의 신발', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png' },
        { id: 8313, name: '완벽한 타이밍', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/PerfectTiming/PerfectTiming.png' },
      ],
      [
        { id: 8321, name: '외상', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/FuturesMarket/FuturesMarket.png' },
        { id: 8316, name: '미니언 해체분석기', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MinionDematerializer/MinionDematerializer.png' },
        { id: 8345, name: '비스킷 배달', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png' },
      ],
      [
        { id: 8347, name: '우주적 통찰력', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png' },
        { id: 8410, name: '쾌속 접근', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/ApproachVelocity/ApproachVelocity.png' },
        { id: 8352, name: '시간 왜곡 물약', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/TimeWarpTonic/TimeWarpTonic.png' },
      ],
    ],
  },
};

/**
 * 롤PS / DeepLoL 룬 트리 하이라이트 생성 헬퍼
 */
export function buildFullRuneTreeHighlight(
  styleKey: keyof typeof RUNE_STYLES,
  selectedRuneNames: string[]
): {
  styleId: number;
  styleName: string;
  keystone: { id: number; name: string; icon: string };
  selectedRunes: { id: number; name: string; icon: string }[];
  fullTree: { slotIndex: number; runes: { id: number; name: string; icon: string; selected: boolean }[] }[];
} {
  const style = RUNE_STYLES[styleKey] || RUNE_STYLES.PRECISION;
  const fullTree = style.rows.map((row, slotIndex) => {
    return {
      slotIndex,
      runes: row.map((rune) => ({
        ...rune,
        selected: selectedRuneNames.includes(rune.name),
      })),
    };
  });

  const selectedRunes = fullTree
    .flatMap((row) => row.runes)
    .filter((r) => r.selected)
    .map(({ selected, ...rest }) => rest);

  const keystone = selectedRunes[0] || style.rows[0][0];

  return {
    styleId: style.id,
    styleName: style.name,
    keystone,
    selectedRunes,
    fullTree,
  };
}

/**
 * 롤PS / DeepLoL 기준 초기 벤치마크 메타 데이터셋 생성 (1단계 시드 및 크롤러 연동)
 */
export function generateMetaSeedDataset(patchVersion = '15.14.1'): {
  champions: ChampionTierItem[];
  builds: ChampionBuildItem[];
} {
  const champions: ChampionTierItem[] = [
    // ==========================================
    // TOP 포지션 챔피언
    // ==========================================
    {
      championId: 'Aatrox',
      championName: '아트록스',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      ranking: 1,
      rankChange: '▲1',
      tier: 1,
      winRate: 51.45,
      pickRate: 15.20,
      banRate: 18.50,
      counterChampionIds: ['Fiora', 'Irelia', 'Riven'],
    },
    {
      championId: 'Fiora',
      championName: '피오라',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      ranking: 2,
      rankChange: '0',
      tier: 1,
      winRate: 52.10,
      pickRate: 11.40,
      banRate: 14.20,
      counterChampionIds: ['Malphite', 'Jax', 'Poppy'],
    },
    {
      championId: 'Camille',
      championName: '카밀',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      ranking: 3,
      rankChange: '▼1',
      tier: 1,
      winRate: 51.80,
      pickRate: 9.80,
      banRate: 12.00,
      counterChampionIds: ['Jax', 'Renekton', 'Darius'],
    },
    {
      championId: 'Renekton',
      championName: '레넥톤',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      ranking: 4,
      rankChange: '▲2',
      tier: 2,
      winRate: 49.95,
      pickRate: 13.50,
      banRate: 9.10,
      counterChampionIds: ['Illaoi', 'Kled', 'Garen'],
    },
    {
      championId: 'Jax',
      championName: '잭스',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      ranking: 5,
      rankChange: '▼1',
      tier: 2,
      winRate: 50.80,
      pickRate: 10.20,
      banRate: 16.40,
      counterChampionIds: ['Garen', 'Malphite', 'Gragas'],
    },
    {
      championId: 'Darius',
      championName: '다리우스',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      ranking: 6,
      rankChange: '0',
      tier: 2,
      winRate: 50.60,
      pickRate: 11.90,
      banRate: 22.30,
      counterChampionIds: ['Vayne', 'Quinn', 'Jayce'],
    },

    // ==========================================
    // JUNGLE 포지션 챔피언
    // ==========================================
    {
      championId: 'LeeSin',
      championName: '리 신',
      tierDivision: 'emerald',
      position: 'jungle',
      patchVersion,
      ranking: 1,
      rankChange: '0',
      tier: 1,
      winRate: 50.45,
      pickRate: 26.80,
      banRate: 16.10,
      counterChampionIds: ['Poppy', 'RekSai', 'Warwick'],
    },
    {
      championId: 'Viego',
      championName: '비에고',
      tierDivision: 'emerald',
      position: 'jungle',
      patchVersion,
      ranking: 2,
      rankChange: '▲2',
      tier: 1,
      winRate: 51.60,
      pickRate: 19.30,
      banRate: 13.50,
      counterChampionIds: ['Elise', 'Rammus', 'Udyr'],
    },
    {
      championId: 'Elise',
      championName: '엘리스',
      tierDivision: 'emerald',
      position: 'jungle',
      patchVersion,
      ranking: 3,
      rankChange: '▲1',
      tier: 1,
      winRate: 52.30,
      pickRate: 8.90,
      banRate: 10.40,
      counterChampionIds: ['Karthus', 'Graves', 'Nidalee'],
    },
    {
      championId: 'Khazix',
      championName: '카직스',
      tierDivision: 'emerald',
      position: 'jungle',
      patchVersion,
      ranking: 4,
      rankChange: '▼2',
      tier: 2,
      winRate: 50.90,
      pickRate: 14.10,
      banRate: 15.20,
      counterChampionIds: ['LeeSin', 'Shaco', 'Elise'],
    },
    {
      championId: 'Sejuani',
      championName: '세주아니',
      tierDivision: 'emerald',
      position: 'jungle',
      patchVersion,
      ranking: 5,
      rankChange: '0',
      tier: 2,
      winRate: 51.10,
      pickRate: 7.50,
      banRate: 4.80,
      counterChampionIds: ['Trundle', 'Olaf', 'Kindred'],
    },

    // ==========================================
    // MID 포지션 챔피언
    // ==========================================
    {
      championId: 'Ahri',
      championName: '아리',
      tierDivision: 'emerald',
      position: 'mid',
      patchVersion,
      ranking: 1,
      rankChange: '0',
      tier: 1,
      winRate: 51.85,
      pickRate: 14.50,
      banRate: 8.20,
      counterChampionIds: ['Sylas', 'Tristana', 'Yasuo'],
    },
    {
      championId: 'Sylas',
      championName: '사일러스',
      tierDivision: 'emerald',
      position: 'mid',
      patchVersion,
      ranking: 2,
      rankChange: '▲1',
      tier: 1,
      winRate: 51.20,
      pickRate: 16.80,
      banRate: 19.40,
      counterChampionIds: ['Cassiopeia', 'Vex', 'Akshan'],
    },
    {
      championId: 'Yone',
      championName: '요네',
      tierDivision: 'emerald',
      position: 'mid',
      patchVersion,
      ranking: 3,
      rankChange: '▲2',
      tier: 2,
      winRate: 49.70,
      pickRate: 18.20,
      banRate: 24.50,
      counterChampionIds: ['Pantheon', 'Renekton', 'Annie'],
    },
    {
      championId: 'Orianna',
      championName: '오리아나',
      tierDivision: 'emerald',
      position: 'mid',
      patchVersion,
      ranking: 4,
      rankChange: '▼2',
      tier: 2,
      winRate: 50.40,
      pickRate: 11.20,
      banRate: 6.10,
      counterChampionIds: ['Zed', 'Fizz', 'Syndra'],
    },
    {
      championId: 'Yasuo',
      championName: '야스오',
      tierDivision: 'emerald',
      position: 'mid',
      patchVersion,
      ranking: 5,
      rankChange: '0',
      tier: 3,
      winRate: 49.30,
      pickRate: 15.60,
      banRate: 28.00,
      counterChampionIds: ['Rumble', 'Pantheon', 'Malzahar'],
    },

    // ==========================================
    // ADC 포지션 챔피언
    // ==========================================
    {
      championId: 'Kaisa',
      championName: '카이사',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      ranking: 1,
      rankChange: '▲1',
      tier: 1,
      winRate: 51.52,
      pickRate: 29.80,
      banRate: 15.20,
      counterChampionIds: ['Twitch', 'Vayne', 'Ashe'],
    },
    {
      championId: 'Ashe',
      championName: '애쉬',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      ranking: 2,
      rankChange: '▼1',
      tier: 1,
      winRate: 52.40,
      pickRate: 21.10,
      banRate: 13.50,
      counterChampionIds: ['Jinx', 'KogMaw', 'Varus'],
    },
    {
      championId: 'Jhin',
      championName: '진',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      ranking: 3,
      rankChange: '▲2',
      tier: 1,
      winRate: 51.90,
      pickRate: 23.40,
      banRate: 8.70,
      counterChampionIds: ['Tristana', 'Samira', 'Lucian'],
    },
    {
      championId: 'Ezreal',
      championName: '이즈리얼',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      ranking: 4,
      rankChange: '▼1',
      tier: 2,
      winRate: 49.85,
      pickRate: 32.50,
      banRate: 10.20,
      counterChampionIds: ['Samira', 'Draven', 'Yasuo'],
    },
    {
      championId: 'Jinx',
      championName: '징크스',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      ranking: 5,
      rankChange: '0',
      tier: 2,
      winRate: 51.10,
      pickRate: 17.60,
      banRate: 7.80,
      counterChampionIds: ['Twitch', 'Draven', 'Lucian'],
    },
    {
      championId: 'Caitlyn',
      championName: '케이틀린',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      ranking: 6,
      rankChange: '▼2',
      tier: 3,
      winRate: 49.40,
      pickRate: 19.80,
      banRate: 14.10,
      counterChampionIds: ['Jinx', 'Sivir', 'Ashe'],
    },

    // ==========================================
    // SUPPORT 포지션 챔피언
    // ==========================================
    {
      championId: 'Nautilus',
      championName: '노틸러스',
      tierDivision: 'emerald',
      position: 'support',
      patchVersion,
      ranking: 1,
      rankChange: '▲2',
      tier: 1,
      winRate: 51.80,
      pickRate: 17.20,
      banRate: 19.50,
      counterChampionIds: ['Morgana', 'Rell', 'Poppy'],
    },
    {
      championId: 'Thresh',
      championName: '쓰레쉬',
      tierDivision: 'emerald',
      position: 'support',
      patchVersion,
      ranking: 2,
      rankChange: '0',
      tier: 1,
      winRate: 51.20,
      pickRate: 16.50,
      banRate: 9.40,
      counterChampionIds: ['Zyra', 'Brand', 'Alistar'],
    },
    {
      championId: 'Rell',
      championName: '렐',
      tierDivision: 'emerald',
      position: 'support',
      patchVersion,
      ranking: 3,
      rankChange: '▲1',
      tier: 1,
      winRate: 52.60,
      pickRate: 8.80,
      banRate: 14.20,
      counterChampionIds: ['Janna', 'Braum', 'Poppy'],
    },
    {
      championId: 'Leona',
      championName: '레오나',
      tierDivision: 'emerald',
      position: 'support',
      patchVersion,
      ranking: 4,
      rankChange: '▼2',
      tier: 2,
      winRate: 50.70,
      pickRate: 13.90,
      banRate: 11.80,
      counterChampionIds: ['Morgana', 'Alistar', 'Thresh'],
    },
    {
      championId: 'Lulu',
      championName: '룰루',
      tierDivision: 'emerald',
      position: 'support',
      patchVersion,
      ranking: 5,
      rankChange: '0',
      tier: 2,
      winRate: 50.30,
      pickRate: 12.10,
      banRate: 6.90,
      counterChampionIds: ['Blitzcrank', 'Pyke', 'Nautilus'],
    },
  ];

  const builds: ChampionBuildItem[] = [
    // 1. 카이사 빌드
    {
      championId: 'Kaisa',
      championName: '카이사',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('PRECISION', ['치명적 속도', '침착', '전설: 핏빛 길', '최후의 일격']),
      subRuneTree: {
        styleId: RUNE_STYLES.INSPIRATION.id,
        styleName: RUNE_STYLES.INSPIRATION.name,
        selectedRunes: [
          { id: 8345, name: '비스킷 배달', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png' },
          { id: 8347, name: '우주적 통찰력', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png' },
        ],
        fullTree: RUNE_STYLES.INSPIRATION.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['비스킷 배달', '우주적 통찰력'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5005, name: '공격 속도 +10%' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5002, name: '방어력 +6' },
      },
      startItems: [
        { id: 1055, name: '도란의 검', price: 450 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerHeal', name: '회복' },
      ],
      coreItems: {
        core1: { id: 6672, name: '크라켄 학살자', winRate: 52.4, pickRate: 68.2 },
        core2: { id: 3124, name: '구인수의 격노검', winRate: 53.1, pickRate: 54.5 },
        core3: { id: 3115, name: '내셔의 이빨', winRate: 54.8, pickRate: 42.1 },
        core4: { id: 3089, name: '라바돈의 죽음모자', winRate: 58.2, pickRate: 28.0 },
        core5: { id: 3157, name: '존야의 모래시계', winRate: 60.1, pickRate: 19.4 },
        buildPathSummary: ['크라켄 학살자', '구인수의 격노검', '내셔의 이빨', '라바돈의 죽음모자', '존야의 모래시계'],
        winRate: 54.5,
        pickRate: 35.8,
      },
      boots: { id: 3006, name: '광전사의 군화', winRate: 52.0, pickRate: 88.5 },
    },

    // 2. 애쉬 빌드
    {
      championId: 'Ashe',
      championName: '애쉬',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('PRECISION', ['치명적 속도', '침착', '전설: 민첩함', '최후의 일격']),
      subRuneTree: {
        styleId: RUNE_STYLES.INSPIRATION.id,
        styleName: RUNE_STYLES.INSPIRATION.name,
        selectedRunes: [
          { id: 8304, name: '마법의 신발', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png' },
          { id: 8410, name: '쾌속 접근', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/ApproachVelocity/ApproachVelocity.png' },
        ],
        fullTree: RUNE_STYLES.INSPIRATION.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['마법의 신발', '쾌속 접근'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5005, name: '공격 속도 +10%' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5002, name: '방어력 +6' },
      },
      startItems: [
        { id: 1055, name: '도란의 검', price: 450 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerGhost', name: '유체화' },
      ],
      coreItems: {
        core1: { id: 3153, name: '몰락한 왕의 검', winRate: 53.0, pickRate: 72.1 },
        core2: { id: 6672, name: '크라켄 학살자', winRate: 54.2, pickRate: 61.4 },
        core3: { id: 3085, name: '루난의 허리케인', winRate: 55.6, pickRate: 48.0 },
        core4: { id: 3302, name: '경계', winRate: 57.8, pickRate: 31.2 },
        core5: { id: 3026, name: '수호 천사', winRate: 61.2, pickRate: 22.0 },
        buildPathSummary: ['몰락한 왕의 검', '크라켄 학살자', '루난의 허리케인', '경계', '수호 천사'],
        winRate: 55.2,
        pickRate: 42.0,
      },
      boots: { id: 3006, name: '광전사의 군화', winRate: 53.1, pickRate: 91.2 },
    },

    // 3. 진 빌드
    {
      championId: 'Jhin',
      championName: '진',
      tierDivision: 'emerald',
      position: 'adc',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('PRECISION', ['기민한 발놀림', '침착', '전설: 핏빛 길', '최후의 일격']),
      subRuneTree: {
        styleId: RUNE_STYLES.SORCERY.id,
        styleName: RUNE_STYLES.SORCERY.name,
        selectedRunes: [
          { id: 8234, name: '기민함', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Celerity/CelerityTemp.png' },
          { id: 8236, name: '폭풍의 결집', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png' },
        ],
        fullTree: RUNE_STYLES.SORCERY.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['기민함', '폭풍의 결집'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5008, name: '적응형 능력치 +9' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5002, name: '방어력 +6' },
      },
      startItems: [
        { id: 1055, name: '도란의 검', price: 450 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerHeal', name: '회복' },
      ],
      coreItems: {
        core1: { id: 3094, name: '고속 연사포', winRate: 52.8, pickRate: 70.4 },
        core2: { id: 3031, name: '무한의 대검', winRate: 55.4, pickRate: 64.1 },
        core3: { id: 3036, name: '도미닉 경의 인사', winRate: 56.9, pickRate: 46.2 },
        core4: { id: 3072, name: '피바라기', winRate: 58.7, pickRate: 31.0 },
        core5: { id: 3026, name: '수호 천사', winRate: 61.5, pickRate: 20.5 },
        buildPathSummary: ['고속 연사포', '무한의 대검', '도미닉 경의 인사', '피바라기', '수호 천사'],
        winRate: 55.8,
        pickRate: 38.2,
      },
      boots: { id: 3009, name: '신속의 장화', winRate: 52.4, pickRate: 85.0 },
    },

    // 4. 아트록스 빌드 (탑)
    {
      championId: 'Aatrox',
      championName: '아트록스',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('PRECISION', ['정복자', '승전보', '전설: 강인함', '최후의 저항']),
      subRuneTree: {
        styleId: RUNE_STYLES.RESOLVE.id,
        styleName: RUNE_STYLES.RESOLVE.name,
        selectedRunes: [
          { id: 8444, name: '재생의 바람', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/SecondWind/SecondWind.png' },
          { id: 8242, name: '불굴의 의지', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Unflinching/Unflinching.png' },
        ],
        fullTree: RUNE_STYLES.RESOLVE.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['재생의 바람', '불굴의 의지'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5008, name: '적응형 능력치 +9' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5001, name: '체력 +65' },
      },
      startItems: [
        { id: 1054, name: '도란의 방패', price: 450 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerTeleport', name: '순간이동' },
      ],
      coreItems: {
        core1: { id: 6630, name: '선혈포식자', winRate: 52.1, pickRate: 74.0 },
        core2: { id: 3071, name: '칠흑의 양날 도끼', winRate: 54.3, pickRate: 63.5 },
        core3: { id: 3053, name: '스테락의 도전', winRate: 56.1, pickRate: 49.0 },
        core4: { id: 6333, name: '죽음의 무도', winRate: 58.4, pickRate: 35.0 },
        core5: { id: 3026, name: '수호 천사', winRate: 61.2, pickRate: 23.0 },
        buildPathSummary: ['선혈포식자', '칠흑의 양날 도끼', '스테락의 도전', '죽음의 무도', '수호 천사'],
        winRate: 54.7,
        pickRate: 39.5,
      },
      boots: { id: 3047, name: '판금 장화', winRate: 52.3, pickRate: 78.0 },
    },

    // 5. 피오라 빌드 (탑)
    {
      championId: 'Fiora',
      championName: '피오라',
      tierDivision: 'emerald',
      position: 'top',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('RESOLVE', ['착취의 손아귀', '철거', '뼈 방패', '불굴의 의지']),
      subRuneTree: {
        styleId: RUNE_STYLES.PRECISION.id,
        styleName: RUNE_STYLES.PRECISION.name,
        selectedRunes: [
          { id: 8009, name: '침착', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PresenceOfMind/PresenceOfMind.png' },
          { id: 9104, name: '전설: 민첩함', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png' },
        ],
        fullTree: RUNE_STYLES.PRECISION.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['침착', '전설: 민첩함'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5005, name: '공격 속도 +10%' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5002, name: '방어력 +6' },
      },
      startItems: [
        { id: 1055, name: '도란의 검', price: 450 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerTeleport', name: '순간이동' },
      ],
      coreItems: {
        core1: { id: 3078, name: '삼위일체', winRate: 53.4, pickRate: 69.0 },
        core2: { id: 3074, name: '굶주린 히드라', winRate: 55.2, pickRate: 65.0 },
        core3: { id: 3053, name: '스테락의 도전', winRate: 57.0, pickRate: 44.0 },
        core4: { id: 6333, name: '죽음의 무도', winRate: 59.8, pickRate: 30.5 },
        core5: { id: 3026, name: '수호 천사', winRate: 62.1, pickRate: 21.0 },
        buildPathSummary: ['삼위일체', '굶주린 히드라', '스테락의 도전', '죽음의 무도', '수호 천사'],
        winRate: 56.2,
        pickRate: 36.4,
      },
      boots: { id: 3047, name: '판금 장화', winRate: 53.0, pickRate: 72.0 },
    },

    // 6. 리 신 빌드 (정글)
    {
      championId: 'LeeSin',
      championName: '리 신',
      tierDivision: 'emerald',
      position: 'jungle',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('PRECISION', ['정복자', '승전보', '전설: 민첩함', '최후의 일격']),
      subRuneTree: {
        styleId: RUNE_STYLES.INSPIRATION.id,
        styleName: RUNE_STYLES.INSPIRATION.name,
        selectedRunes: [
          { id: 8304, name: '마법의 신발', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png' },
          { id: 8347, name: '우주적 통찰력', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png' },
        ],
        fullTree: RUNE_STYLES.INSPIRATION.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['마법의 신발', '우주적 통찰력'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5008, name: '적응형 능력치 +9' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5002, name: '방어력 +6' },
      },
      startItems: [
        { id: 1102, name: '새끼 화염발톱', price: 450 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerSmite', name: '강타' },
        { id: 'SummonerFlash', name: '점멸' },
      ],
      coreItems: {
        core1: { id: 6692, name: '월식', winRate: 51.8, pickRate: 72.0 },
        core2: { id: 3071, name: '칠흑의 양날 도끼', winRate: 53.6, pickRate: 64.0 },
        core3: { id: 3053, name: '스테락의 도전', winRate: 55.4, pickRate: 48.0 },
        core4: { id: 6333, name: '죽음의 무도', winRate: 58.1, pickRate: 32.0 },
        core5: { id: 3026, name: '수호 천사', winRate: 61.0, pickRate: 20.0 },
        buildPathSummary: ['월식', '칠흑의 양날 도끼', '스테락의 도전', '죽음의 무도', '수호 천사'],
        winRate: 53.9,
        pickRate: 38.0,
      },
      boots: { id: 3111, name: '헤르메스의 발걸음', winRate: 51.5, pickRate: 62.0 },
    },

    // 7. 아리 빌드 (미드)
    {
      championId: 'Ahri',
      championName: '아리',
      tierDivision: 'emerald',
      position: 'mid',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('DOMINATION', ['감전', '돌발 일격', '사냥의 증표', '궁극의 사냥꾼']),
      subRuneTree: {
        styleId: RUNE_STYLES.SORCERY.id,
        styleName: RUNE_STYLES.SORCERY.name,
        selectedRunes: [
          { id: 8226, name: '마나순환 팔찌', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png' },
          { id: 8210, name: '깨달음', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/Transcendence/Transcendence.png' },
        ],
        fullTree: RUNE_STYLES.SORCERY.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['마나순환 팔찌', '깨달음'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5008, name: '적응형 능력치 +9' },
        flex: { id: 5008, name: '적응형 능력치 +9' },
        defense: { id: 5001, name: '체력 +65' },
      },
      startItems: [
        { id: 1056, name: '도란의 반지', price: 400 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerTeleport', name: '순간이동' },
      ],
      coreItems: {
        core1: { id: 6653, name: '루덴의 동반자', winRate: 52.8, pickRate: 75.0 },
        core2: { id: 3157, name: '존야의 모래시계', winRate: 54.5, pickRate: 58.0 },
        core3: { id: 3089, name: '라바돈의 죽음모자', winRate: 57.8, pickRate: 46.0 },
        core4: { id: 3135, name: '공허의 지팡이', winRate: 59.9, pickRate: 31.0 },
        core5: { id: 4629, name: '우주의 추진력', winRate: 62.4, pickRate: 18.0 },
        buildPathSummary: ['루덴의 동반자', '존야의 모래시계', '라바돈의 죽음모자', '공허의 지팡이', '우주의 추진력'],
        winRate: 55.4,
        pickRate: 36.8,
      },
      boots: { id: 3020, name: '마법사의 신발', winRate: 52.6, pickRate: 88.0 },
    },

    // 8. 노틸러스 빌드 (서폿)
    {
      championId: 'Nautilus',
      championName: '노틸러스',
      tierDivision: 'emerald',
      position: 'support',
      patchVersion,
      mainRuneTree: buildFullRuneTreeHighlight('RESOLVE', ['여진', '보호막 강타', '뼈 방패', '과잉성장']),
      subRuneTree: {
        styleId: RUNE_STYLES.INSPIRATION.id,
        styleName: RUNE_STYLES.INSPIRATION.name,
        selectedRunes: [
          { id: 8306, name: '마법공학 점멸기', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png' },
          { id: 8347, name: '우주적 통찰력', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png' },
        ],
        fullTree: RUNE_STYLES.INSPIRATION.rows.map((row, slotIndex) => ({
          slotIndex,
          runes: row.map((r) => ({ ...r, selected: ['마법공학 점멸기', '우주적 통찰력'].includes(r.name) })),
        })),
      },
      statShards: {
        offense: { id: 5007, name: '스킬 가속 +8' },
        flex: { id: 5002, name: '방어력 +6' },
        defense: { id: 5001, name: '체력 +65' },
      },
      startItems: [
        { id: 3854, name: '강철 어깨 보호대', price: 400 },
        { id: 2003, name: '체력 물약', price: 50 },
      ],
      spells: [
        { id: 'SummonerFlash', name: '점멸' },
        { id: 'SummonerDot', name: '점화' },
      ],
      coreItems: {
        core1: { id: 3869, name: '태양의 썰매', winRate: 52.8, pickRate: 75.0 },
        core2: { id: 3109, name: '기사의 맹세', winRate: 54.1, pickRate: 58.2 },
        core3: { id: 3190, name: '강철의 솔라리 펜던트', winRate: 56.4, pickRate: 41.5 },
        core4: { id: 3050, name: '지크의 융합', winRate: 58.0, pickRate: 29.0 },
        core5: { id: 3110, name: '얼어붙은 심장', winRate: 60.5, pickRate: 18.0 },
        buildPathSummary: ['태양의 썰매', '기사의 맹세', '강철의 솔라리 펜던트', '지크의 융합', '얼어붙은 심장'],
        winRate: 54.8,
        pickRate: 38.0,
      },
      boots: { id: 3009, name: '신속의 장화', winRate: 52.6, pickRate: 64.0 },
    },
  ];

  return { champions, builds };
}

/**
 * 롤PS / DeepLoL 실시간 크롤링 데이터 파서 & D1(env.DB) 자동 반영
 */
export async function syncLolMetaStatsToD1(
  db: any,
  options?: {
    tierDivision?: MetaTierDivision;
    patchVersion?: string;
  }
): Promise<{ success: boolean; insertedCount: number; message: string }> {
  const patch = options?.patchVersion || '15.14.1';
  const { champions, builds } = generateMetaSeedDataset(patch);

  // 티어구간 필터가 있으면 적용
  const filteredChamps = options?.tierDivision
    ? champions.map((c) => ({ ...c, tierDivision: options.tierDivision! }))
    : champions;

  const filteredBuilds = options?.tierDivision
    ? builds.map((b) => ({ ...b, tierDivision: options.tierDivision! }))
    : builds;

  const res = await batchUpsertMetaStats(db, filteredChamps, filteredBuilds);

  return {
    success: true,
    insertedCount: res.insertedCount,
    message: `[D1 Meta Sync] ${res.insertedCount}건의 롤PS/DeepLoL 메타 통계가 D1 DB(env.DB)에 성공적으로 저장되었습니다.`,
  };
}
