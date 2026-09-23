// Riot Data Dragon API (14.1.1) Champion Loader & Position Mapping Service
import { SoloRankPosition } from '../data/soloRankData';
import { CHAMPION_KR_TO_EN } from './champions';

export const DDRAGON_CHAMPION_API = 'https://ddragon.leagueoflegends.com/cdn/14.1.1/data/ko_KR/champion.json';

export interface DDragonChampionRaw {
  version: string;
  id: string; // e.g. "Viktor", "Syndra", "Aatrox"
  key: string;
  name: string; // e.g. "빅토르", "신드라", "아트록스"
  title: string;
  blurb?: string;
  tags: string[]; // ["Mage"], ["Marksman"], ["Fighter"], etc.
  partype?: string;
}

export interface DDragonChampionItem {
  id: string;
  name: string;
  enName: string;
  title: string;
  tags: string[];
  positions: SoloRankPosition[];
  isApc?: boolean; // 바텀 비원딜 여부
}

// 신규/특별 챔피언 (14.1.1 Data Dragon 이후 출시되었거나 특수 챔피언)
export const SPECIAL_NEW_CHAMPIONS: DDragonChampionItem[] = [
  {
    id: 'Mel',
    name: '멜',
    enName: 'Mel',
    title: '아르카나의 설계자',
    tags: ['Mage', 'Support'],
    positions: ['MID', 'ADC', 'SUP'],
    isApc: true,
  },
  {
    id: 'Yunara',
    name: '유나라',
    enName: 'Yunara',
    title: '환영의 사수',
    tags: ['Marksman'],
    positions: ['ADC', 'MID'],
    isApc: false,
  },
  {
    id: 'Ambessa',
    name: '암베사',
    enName: 'Ambessa',
    title: '전쟁의 여제',
    tags: ['Fighter', 'Assassin'],
    positions: ['TOP', 'MID'],
  },
  {
    id: 'Zahen',
    name: '자헨',
    enName: 'Zahen',
    title: '그림자 칼날',
    tags: ['Assassin'],
    positions: ['MID', 'JGL'],
  },
  {
    id: 'Locke',
    name: '로크',
    enName: 'Locke',
    title: '빛의 수호자',
    tags: ['Fighter'],
    positions: ['TOP', 'JGL'],
  },
];

// 챔피언별 포지션 매핑 (솔로랭크 및 DeepLoL 기준 멀티 포지션 & 바텀 비원딜 APC 완벽 지원)
export const KNOWN_CHAMPION_POSITIONS: Record<string, SoloRankPosition[]> = {
  // [바텀 메타 비원딜 / APC 및 원딜 - 실제 솔로랭크 D1+ 통계 및 픽률 지표 기준]
  빅토르: ['MID', 'ADC'],
  신드라: ['MID', 'ADC'],
  제라스: ['SUP', 'MID', 'ADC'],
  직스: ['ADC', 'MID'],
  스웨인: ['SUP', 'ADC', 'MID'],
  카서스: ['JGL', 'ADC'],
  세라핀: ['SUP', 'ADC'],
  베이가: ['MID', 'ADC'],
  벨코즈: ['SUP', 'MID', 'ADC'],
  브랜드: ['SUP', 'JGL', 'ADC'],
  하이머딩거: ['SUP', 'ADC', 'TOP'],
  흐웨이: ['MID', 'ADC', 'SUP'],
  카시오페아: ['MID', 'ADC', 'TOP'],
  야스오: ['MID', 'TOP', 'ADC'],
  멜: ['MID', 'ADC', 'SUP'],
  유나라: ['ADC', 'MID'],
  닐라: ['ADC'],
  애쉬: ['ADC', 'SUP'],
  이즈리얼: ['ADC', 'MID'],
  카이사: ['ADC', 'MID'],
  진: ['ADC'],
  징크스: ['ADC'],
  바루스: ['ADC', 'MID'],
  케이틀린: ['ADC'],
  사미라: ['ADC'],
  자야: ['ADC'],
  트리스타나: ['ADC', 'MID'],
  루시안: ['ADC', 'MID'],
  드레이븐: ['ADC'],
  베인: ['ADC', 'TOP'],
  트위치: ['ADC', 'SUP'],
  시비르: ['ADC'],
  코그모: ['ADC'],
  칼리스타: ['ADC', 'TOP'],
  아펠리오스: ['ADC'],
  제리: ['ADC', 'MID'],
  '미스 포츈': ['ADC', 'SUP'],
  스몰더: ['ADC', 'MID', 'TOP'],
  퀸: ['TOP', 'ADC'],
  코르키: ['MID', 'ADC'],

  // [탑]
  아트록스: ['TOP'],
  다리우스: ['TOP'],
  가렌: ['TOP', 'MID'],
  잭스: ['TOP', 'JGL'],
  피오라: ['TOP'],
  카밀: ['TOP', 'SUP'],
  레넥톤: ['TOP', 'MID'],
  이렐리아: ['TOP', 'MID'],
  럼블: ['TOP', 'MID'],
  제이스: ['TOP', 'MID'],
  사이온: ['TOP', 'MID'],
  말파이트: ['TOP', 'MID', 'SUP'],
  크산테: ['TOP', 'MID'],
  그웬: ['TOP', 'JGL'],
  쉔: ['TOP', 'SUP'],
  세트: ['TOP', 'MID', 'SUP'],
  모데카이저: ['TOP', 'JGL'],
  볼리베어: ['TOP', 'JGL'],
  우르곳: ['TOP'],
  나르: ['TOP'],
  나서스: ['TOP', 'MID'],
  일라오이: ['TOP'],
  케일: ['TOP', 'MID'],
  갱플랭크: ['TOP', 'MID'],
  오른: ['TOP'],
  요릭: ['TOP'],
  초가스: ['TOP', 'MID'],
  신지드: ['TOP', 'MID'],
  클레드: ['TOP', 'MID'],
  암베사: ['TOP', 'MID'],
  그라가스: ['TOP', 'JGL', 'MID'],
  워윅: ['JGL', 'TOP'],
  티모: ['TOP', 'SUP'],
  케넨: ['TOP', 'MID'],
  자크: ['JGL', 'TOP', 'SUP'],
  뽀삐: ['JGL', 'SUP', 'TOP'],
  트런들: ['TOP', 'JGL'],
  트린다미어: ['TOP', 'MID'],
  판테온: ['SUP', 'MID', 'TOP'],
  올라프: ['TOP', 'JGL'],
  '문도 박사': ['TOP', 'JGL'],
  리븐: ['TOP', 'MID'],
  로크: ['TOP', 'JGL'],
  '탐 켄치': ['TOP', 'SUP'],

  // [정글]
  '리 신': ['JGL'],
  비에고: ['JGL', 'MID'],
  카직스: ['JGL'],
  엘리스: ['JGL', 'SUP'],
  니달리: ['JGL'],
  녹턴: ['JGL', 'MID'],
  릴리아: ['JGL', 'TOP'],
  세주아니: ['JGL', 'TOP'],
  '자르반 4세': ['JGL'],
  바이: ['JGL'],
  아무무: ['JGL', 'SUP'],
  그레이브즈: ['JGL'],
  '마스터 이': ['JGL'],
  벨베스: ['JGL'],
  브라이어: ['JGL', 'TOP'],
  렉사이: ['JGL', 'TOP'],
  렝가: ['JGL', 'TOP'],
  샤코: ['JGL', 'SUP'],
  쉬바나: ['JGL', 'TOP'],
  스카너: ['JGL', 'TOP'],
  '신 짜오': ['JGL'],
  에코: ['JGL', 'MID'],
  오공: ['JGL', 'TOP'],
  우디르: ['JGL', 'TOP'],
  이블린: ['JGL'],
  케인: ['JGL'],
  킨드레드: ['JGL'],
  헤카림: ['JGL'],
  '누누와 윌럼프': ['JGL'],
  다이애나: ['JGL', 'MID'],
  람머스: ['JGL'],
  아이번: ['JGL'],
  피들스틱: ['JGL', 'SUP'],
  탈리야: ['JGL', 'MID'],
  자헨: ['MID', 'JGL'],

  // [미드]
  아리: ['MID'],
  제드: ['MID', 'JGL'],
  르블랑: ['MID'],
  사일러스: ['MID', 'JGL', 'TOP'],
  카타리나: ['MID'],
  카사딘: ['MID'],
  아칼리: ['MID', 'TOP'],
  벡스: ['MID'],
  아지르: ['MID'],
  말자하: ['MID'],
  탈론: ['MID', 'JGL'],
  키아나: ['MID', 'JGL'],
  '트위스티드 페이트': ['MID', 'ADC'],
  갈리오: ['MID', 'SUP'],
  나피리: ['MID'],
  라이즈: ['MID', 'TOP'],
  리산드라: ['MID'],
  애니: ['MID', 'SUP'],
  피즈: ['MID'],
  '아우렐리온 솔': ['MID', 'ADC'],
  아크샨: ['MID', 'TOP'],
  애니비아: ['MID'],
  오리아나: ['MID'],
  조이: ['MID', 'SUP'],
  오로라: ['MID', 'TOP'],
  니코: ['MID', 'SUP'],
  요네: ['MID', 'TOP'],

  // [서폿]
  쓰레쉬: ['SUP'],
  노틸러스: ['SUP'],
  블리츠크랭크: ['SUP'],
  레오나: ['SUP'],
  파이크: ['SUP', 'MID'],
  라칸: ['SUP'],
  룰루: ['SUP', 'MID'],
  나미: ['SUP'],
  바드: ['SUP'],
  브라움: ['SUP'],
  럭스: ['SUP', 'MID'],
  카르마: ['SUP', 'MID', 'TOP'],
  잔나: ['SUP'],
  유미: ['SUP'],
  세나: ['SUP', 'ADC'],
  소라카: ['SUP'],
  소나: ['SUP'],
  알리스타: ['SUP'],
  렐: ['SUP', 'JGL'],
  마오카이: ['SUP', 'JGL', 'TOP'],
  타릭: ['SUP'],
  질리언: ['SUP', 'MID'],
  자이라: ['SUP', 'MID'],
  '레나타 글라스크': ['SUP'],
  밀리오: ['SUP'],
  모르가나: ['SUP', 'MID', 'JGL'],
};

// 챔피언 태그 기반 포지션 추론 (신규/미등록 챔피언 자동 지원)
export function inferPositionsFromTags(tags: string[] = []): SoloRankPosition[] {
  const set = new Set<SoloRankPosition>();
  if (tags.includes('Marksman')) set.add('ADC');
  if (tags.includes('Mage')) {
    set.add('MID');
  }
  if (tags.includes('Assassin')) {
    set.add('MID');
    set.add('JGL');
  }
  if (tags.includes('Tank')) {
    set.add('TOP');
    set.add('SUP');
  }
  if (tags.includes('Support')) set.add('SUP');
  if (tags.includes('Fighter')) {
    set.add('TOP');
    set.add('JGL');
  }
  if (set.size === 0) set.add('MID');
  return Array.from(set);
}

// 챔피언 포지션 획득
export function getChampionPositions(name: string, tags: string[] = []): SoloRankPosition[] {
  if (KNOWN_CHAMPION_POSITIONS[name]) {
    return KNOWN_CHAMPION_POSITIONS[name];
  }
  return inferPositionsFromTags(tags);
}

// 인메모리 캐시
let cachedChampions: DDragonChampionItem[] | null = null;
let isFetching = false;
const listeners: Array<(champs: DDragonChampionItem[]) => void> = [];

export function subscribeDDragonChampions(cb: (champs: DDragonChampionItem[]) => void): () => void {
  listeners.push(cb);
  if (cachedChampions) {
    cb(cachedChampions);
  }
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

// 기본 오프라인/즉시 로드용 챔피언 카탈로그 (0ms 렌더링 보장)
export function getInitialChampionCatalog(): DDragonChampionItem[] {
  if (cachedChampions && cachedChampions.length > 0) {
    return cachedChampions;
  }

  // localStorage 캐시 확인
  try {
    const saved = localStorage.getItem('riming_ddragon_champs_v14_2');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 160) {
        cachedChampions = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // 즉시 카탈로그 구축 (스페셜 챔피언 + 주요 챔피언들)
  const map = new Map<string, DDragonChampionItem>();

  // 특별 챔피언 먼저 등록
  for (const sc of SPECIAL_NEW_CHAMPIONS) {
    map.set(sc.name, sc);
    CHAMPION_KR_TO_EN[sc.name] = sc.enName;
  }

  // 기본 포지션 등록된 챔피언들
  for (const [name, positions] of Object.entries(KNOWN_CHAMPION_POSITIONS)) {
    if (!map.has(name)) {
      const en = CHAMPION_KR_TO_EN[name] || name;
      const isApc =
        positions.includes('ADC') &&
        ['빅토르', '신드라', '제라스', '직스', '스웨인', '카서스', '세라핀', '베이가', '벨코즈', '브랜드', '하이머딩거', '흐웨이', '멜', '카시오페아'].includes(name);
      map.set(name, {
        id: en,
        name,
        enName: en,
        title: '리그 오브 레전드 챔피언',
        tags: positions.includes('ADC') ? (isApc ? ['Mage'] : ['Marksman']) : ['Fighter'],
        positions,
        isApc,
      });
    }
  }

  cachedChampions = Array.from(map.values());
  return cachedChampions;
}

// 라이엇 Data Dragon API 실시간 비동기 페칭 및 병합
export async function loadDDragonChampions(): Promise<DDragonChampionItem[]> {
  if (isFetching && cachedChampions) {
    return cachedChampions;
  }
  isFetching = true;

  try {
    const res = await fetch(DDRAGON_CHAMPION_API, { cache: 'force-cache' });
    if (!res.ok) {
      throw new Error(`DataDragon fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    const rawData = data.data as Record<string, DDragonChampionRaw>;

    const mergedMap = new Map<string, DDragonChampionItem>();

    // 1. Data Dragon 166개 챔피언 파싱
    for (const [champKey, raw] of Object.entries(rawData)) {
      const krName = raw.name.trim();
      const enName = champKey;
      const positions = getChampionPositions(krName, raw.tags);

      // 글로벌 매핑 등록
      CHAMPION_KR_TO_EN[krName] = enName;

      const isApc =
        positions.includes('ADC') &&
        !raw.tags.includes('Marksman') &&
        (raw.tags.includes('Mage') ||
          ['빅토르', '신드라', '제라스', '직스', '스웨인', '카서스', '세라핀', '베이가', '벨코즈', '브랜드', '하이머딩거', '흐웨이', '멜', '카시오페아', '블라디미르'].includes(
            krName
          ));

      mergedMap.set(krName, {
        id: enName,
        name: krName,
        enName,
        title: raw.title || '챔피언',
        tags: raw.tags || [],
        positions,
        isApc,
      });
    }

    // 2. 신규/특별 챔피언 병합 (멜, 유나라, 암베사, 자헨, 로크 등 누락 방지)
    for (const sc of SPECIAL_NEW_CHAMPIONS) {
      CHAMPION_KR_TO_EN[sc.name] = sc.enName;
      if (!mergedMap.has(sc.name)) {
        mergedMap.set(sc.name, sc);
      } else {
        // 이미 존재해도 포지션 보강
        const existing = mergedMap.get(sc.name)!;
        existing.positions = Array.from(new Set([...existing.positions, ...sc.positions]));
        existing.isApc = sc.isApc ?? existing.isApc;
      }
    }

    const result = Array.from(mergedMap.values());
    cachedChampions = result;

    // localStorage에 캐시 보관
    try {
      localStorage.setItem('riming_ddragon_champs_v14_2', JSON.stringify(result));
    } catch {
      // ignore quota
    }

    // 구독자들에게 알림
    listeners.forEach((cb) => cb(result));

    isFetching = false;
    return result;
  } catch (err) {
    console.warn('[DDragonService] Failed to fetch live Data Dragon, using catalog:', err);
    isFetching = false;
    return getInitialChampionCatalog();
  }
}
