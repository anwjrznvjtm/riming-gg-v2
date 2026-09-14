import Fuse from 'fuse.js';
import { CHAMPIONS_LIST } from '../data/initialMatches';
import { CHAMPION_DDRAGON_MAP } from './champions';

// Korean Hangul unicode constants
const HANGUL_BASE = 44032; // '가'
const HANGUL_LAST = 55203; // '힣'

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const JUNGSUNG_LIST = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

const JONGSUNG_LIST = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// QWERTY English keys to Korean Jamo mapping (for handling accidental English layout typing)
const QWERTY_TO_KOR: Record<string, string> = {
  q: 'ㅂ', Q: 'ㅃ', w: 'ㅈ', W: 'ㅉ', e: 'ㄷ', E: 'ㄸ', r: 'ㄱ', R: 'ㄲ', t: 'ㅅ', T: 'ㅆ',
  y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', O: 'ㅒ', p: 'ㅔ', P: 'ㅖ', a: 'ㅁ', s: 'ㄴ', d: 'ㅇ',
  f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ', z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ',
  b: 'ㅠ', n: 'ㅜ', m: 'ㅡ'
};

/**
 * Extracts initial consonants (초성) from Korean text
 * e.g. "김민교" -> "ㄱㅁㄱ", "블리츠크랭크" -> "ㅂㄹㅊㅋㄹㅋ"
 */
export function getChosung(str: string): string {
  if (!str) return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - HANGUL_BASE;
    if (code >= 0 && code <= 11171) {
      result += CHOSUNG_LIST[Math.floor(code / 588)];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

/**
 * Fully decomposes Korean syllables into Jamo (초성 + 중성 + 종성)
 * e.g. "김민교" -> "ㄱㅣㅁㅁㅣㄴㄱㅛ"
 * This enables ultra-accurate phonetic similarity matching with Fuse.js
 */
export function decomposeHangul(str: string): string {
  if (!str) return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - HANGUL_BASE;
    if (code >= 0 && code <= 11171) {
      const cho = Math.floor(code / 588);
      const jung = Math.floor((code % 588) / 28);
      const jong = code % 28;
      result += CHOSUNG_LIST[cho] + JUNGSUNG_LIST[jung] + (jong > 0 ? JONGSUNG_LIST[jong] : '');
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

/**
 * Converts English QWERTY keyboard keystrokes to Korean Jamo
 * e.g. "rlaalsry" -> "ㄱㅣㅁㅁㅣㄴㄱㅛ"
 */
export function convertQwertyToKoreanJamo(str: string): string {
  return str.split('').map(c => QWERTY_TO_KOR[c] || c).join('');
}

// LoL Champion Korean Nicknames, Abbreviations & Common English Names
export const CHAMPION_ALIASES: Record<string, string> = {
  // Common Korean Abbreviations
  '유나라': '유나라',
  '유나': '유나라',
  '유': '유나라',
  '자르반': '자르반 4세',
  '자르반4세': '자르반 4세',
  '자르반4': '자르반 4세',
  '누누': '누누와 윌럼프',
  '문도': '문도 박사',
  '미포': '미스 포츈',
  '마이': '마스터 이',
  '신짜오': '신 짜오',
  '짜오': '신 짜오',
  '블츠': '블리츠크랭크',
  '블리츠': '블리츠크랭크',
  '아솔': '아우렐리온 솔',
  '트페': '트위스티드 페이트',
  '레나타': '레나타 글라스크',
  '탐켄치': '탐 켄치',
  '켄치': '탐 켄치',
  '피들': '피들스틱',
  '하이머': '하이머딩거',
  '딩거': '하이머딩거',
  '트린다': '트린다미어',
  '트리': '트리스타나',
  '트타': '트리스타나',
  '세주': '세주아니',
  '블라디': '블라디미르',
  '모데': '모데카이저',
  '볼베': '볼리베어',
  '케이틀': '케이틀린',
  '케틀': '케이틀린',
  '헤카': '헤카림',
  '오리': '오리아나',
  '갱플': '갱플랭크',
  '카시': '카시오페아',
  '아펠': '아펠리오스',
  '레넥': '레넥톤',
  '말파': '말파이트',
  '모르': '모르가나',
  '몰가': '모르가나',
  '그브': '그레이브즈',
  '킨드': '킨드레드',
  '알리': '알리스타',
  '아트': '아트록스',
  '사일': '사일러스',
  '이즈': '이즈리얼',
  '이렐': '이렐리아',
  '칼리': '칼리스타',
  '카타': '카타리나',
  '초가': '초가스',

  // Common English Champion Names (case-insensitive mapping handled in lookup)
  'caitlyn': '케이틀린',
  'cait': '케이틀린',
  'ezreal': '이즈리얼',
  'ez': '이즈리얼',
  'jinx': '징크스',
  'kaisa': '카이사',
  'vayne': '베인',
  'lucian': '루시안',
  'leesin': '리 신',
  'lee sin': '리 신',
  'ashe': '애쉬',
  'ahri': '아리',
  'garen': '가렌',
  'thresh': '쓰레쉬',
  'pyke': '파이크',
  'blitz': '블리츠크랭크',
  'blitzcrank': '블리츠크랭크',
  'zed': '제드',
  'yasuo': '야스오',
  'yone': '요네',
  'sett': '세트',
  'akali': '아칼리',
  'sylas': '사일러스',
  'varus': '바루스',
  'nami': '나미',
  'lulu': '룰루',
  'yuumi': '유미',
  'jhin': '진',
  'draven': '드레이븐',
  'samira': '사미라',
  'twitch': '트위치',
  'smolder': '스몰더',
  'hwei': '흐웨이',
  'briar': '브라이어',
  'naafiri': '나피리',
  'milio': '밀리오',
  'mel': '멜',
  'ambessa': '암베사',
  'yunara': '유나라',
};

// Popular LoL CK Streamer Nicknames & Aliases
export const STREAMER_ALIASES: Record<string, string> = {
  '우리밍': '우리밍_',
  '밍': '우리밍_',
  '우리밍이': '우리밍_',
  '민교': '김민교',
  '상호': '이상호',
  '봉준': '김봉준',
  '선비': '임선비',
  '뜨뜨': '뜨뜨뜨뜨',
  '사장': '박사장',
  '수야': '안녕수야',
  '수피': '수피',
  '만식': '강만식',
  '밧드': '준밧드',
  '탱탱': '꿀탱탱',
  '상윤': '나는상윤',
  '소나': '유소나',
  '혜디': '유혜디',
  '레인': '김레인',
  '누리': '다누리',
  '혜밍': '혜밍',
  '단아': '단아냥',
  '아니': '임아니',
};

export interface SearchMatchDetail {
  name: string;
  matchType: 'exact' | 'prefix' | 'alias' | 'chosung' | 'jamo' | 'fuzzy' | 'qwerty';
  aliasLabel?: string;
  score: number;
}

/**
 * Searches champions with multi-tier fuzzy matching:
 * 1. Exact match / prefix match
 * 2. LoL nickname / alias match (e.g. 트페 -> 트위스티드 페이트, 미포 -> 미스 포츈)
 * 3. Chosung match (e.g. ㅂㄹㅊ -> 블리츠크랭크, ㅇㄴㄹ -> 유나라, ㄱㅁㄱ)
 * 4. Jamo similarity search with Fuse.js (handles typos like '블리츠크랑크' -> '블리츠크랭크')
 * 5. English QWERTY keyboard typo match
 */
export function searchChampionsDetailed(rawQuery: string, sourceList: string[] = CHAMPIONS_LIST): SearchMatchDetail[] {
  if (!rawQuery || !rawQuery.trim()) return [];
  const query = rawQuery.trim().toLowerCase();
  const cleanQuery = query.replace(/[\s_]/g, '');
  const isChosungQuery = /^[ㄱ-ㅎ]+$/.test(cleanQuery);
  const queryChosung = getChosung(cleanQuery);
  const queryJamo = decomposeHangul(cleanQuery);
  const queryQwertyJamo = convertQwertyToKoreanJamo(cleanQuery);

  // Combine full candidate list
  const allCandidates = Array.from(new Set([
    ...sourceList,
    ...Object.keys(CHAMPION_DDRAGON_MAP),
    ...Object.values(CHAMPION_ALIASES)
  ]));

  const resultsMap = new Map<string, SearchMatchDetail>();

  // 1. Direct alias check
  const directAlias = CHAMPION_ALIASES[cleanQuery] || CHAMPION_ALIASES[query];
  if (directAlias && allCandidates.includes(directAlias)) {
    resultsMap.set(directAlias, {
      name: directAlias,
      matchType: 'alias',
      aliasLabel: rawQuery.trim(),
      score: 950,
    });
  }

  // Check alias prefix / inclusion
  for (const [alias, target] of Object.entries(CHAMPION_ALIASES)) {
    if (alias.startsWith(cleanQuery) || cleanQuery.startsWith(alias)) {
      if (!resultsMap.has(target)) {
        resultsMap.set(target, {
          name: target,
          matchType: 'alias',
          aliasLabel: alias,
          score: 850,
        });
      }
    }
  }

  // 2. Exact, prefix, substring, chosung, and jamo scoring
  for (const champ of allCandidates) {
    const cleanChamp = champ.replace(/[\s_]/g, '').toLowerCase();
    const champChosung = getChosung(cleanChamp);
    const champJamo = decomposeHangul(cleanChamp);

    let score = -1;
    let matchType: SearchMatchDetail['matchType'] = 'fuzzy';

    if (champ.toLowerCase() === query) {
      score = 1000;
      matchType = 'exact';
    } else if (cleanChamp === cleanQuery) {
      score = 950;
      matchType = 'exact';
    } else if (cleanChamp.startsWith(cleanQuery)) {
      score = 800 - cleanChamp.length;
      matchType = 'prefix';
    } else if (cleanChamp.includes(cleanQuery)) {
      score = 700 - cleanChamp.indexOf(cleanQuery) * 10 - cleanChamp.length;
      matchType = 'prefix';
    } else if (isChosungQuery && queryChosung.length > 0) {
      if (champChosung.startsWith(queryChosung)) {
        score = 650 - champChosung.length;
        matchType = 'chosung';
      } else if (champChosung.includes(queryChosung)) {
        score = 550 - champChosung.indexOf(queryChosung) * 5;
        matchType = 'chosung';
      }
    } else if (champJamo.includes(queryJamo)) {
      score = 500 - champJamo.indexOf(queryJamo);
      matchType = 'jamo';
    } else if (champJamo.includes(queryQwertyJamo)) {
      score = 450 - champJamo.indexOf(queryQwertyJamo);
      matchType = 'qwerty';
    }

    if (score > 0) {
      const existing = resultsMap.get(champ);
      if (!existing || existing.score < score) {
        resultsMap.set(champ, { name: champ, matchType, score });
      }
    }
  }

  // 3. Fuse.js Fuzzy Fallback for Typos & Near-Misses
  const fuseItems = allCandidates.map((name) => {
    const clean = name.replace(/[\s_]/g, '').toLowerCase();
    const aliases = Object.entries(CHAMPION_ALIASES)
      .filter(([_, t]) => t === name)
      .map(([a]) => a);
    const ddragonKey = CHAMPION_DDRAGON_MAP[name] || '';

    return {
      name,
      clean,
      chosung: getChosung(clean),
      jamo: decomposeHangul(clean),
      aliases,
      ddragonKey,
    };
  });

  const fuse = new Fuse(fuseItems, {
    keys: [
      { name: 'clean', weight: 0.35 },
      { name: 'jamo', weight: 0.25 },
      { name: 'name', weight: 0.2 },
      { name: 'aliases', weight: 0.1 },
      { name: 'chosung', weight: 0.05 },
      { name: 'ddragonKey', weight: 0.05 },
    ],
    threshold: 0.4,
    distance: 60,
    includeScore: true,
  });

  const fuseResults = fuse.search(cleanQuery);
  for (const res of fuseResults) {
    const champ = res.item.name;
    const fuseScore = Math.max(100, Math.round((1 - (res.score || 0)) * 400));
    if (!resultsMap.has(champ)) {
      resultsMap.set(champ, {
        name: champ,
        matchType: 'fuzzy',
        score: fuseScore,
      });
    }
  }

  // Also check QWERTY jamo in Fuse if no or few results
  if (resultsMap.size < 4 && queryQwertyJamo !== cleanQuery) {
    const qwertyFuse = fuse.search(queryQwertyJamo);
    for (const res of qwertyFuse) {
      const champ = res.item.name;
      if (!resultsMap.has(champ)) {
        resultsMap.set(champ, {
          name: champ,
          matchType: 'qwerty',
          score: Math.max(80, Math.round((1 - (res.score || 0)) * 350)),
        });
      }
    }
  }

  return Array.from(resultsMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/**
 * Legacy/Simple string array interface for Champion Search
 */
export function searchChampions(rawQuery: string, sourceList: string[] = CHAMPIONS_LIST): string[] {
  return searchChampionsDetailed(rawQuery, sourceList).map((r) => r.name);
}

/**
 * Searches streamers with multi-tier fuzzy matching:
 * 1. Exact match / prefix match
 * 2. Nicknames / alias match (e.g. 밍 -> 우리밍_, 민교 -> 김민교, 상호 -> 이상호)
 * 3. Chosung match (e.g. ㅇㄹㅁ -> 우리밍_, ㄱㅁㄱ -> 김민교, ㅇㅅㅎ -> 이상호)
 * 4. Jamo similarity search with Fuse.js (handles typos like '김민규' -> '김민교', '이성호' -> '이상호')
 * 5. Accidental English QWERTY input (e.g. 'rlaalsry' -> '김민교', 'dflakd' -> '우리밍_')
 */
export function searchStreamersDetailed(rawQuery: string, sourceList: string[]): SearchMatchDetail[] {
  if (!rawQuery || !rawQuery.trim()) return [];
  const query = rawQuery.trim().toLowerCase();
  const cleanQuery = query.replace(/[\s_]/g, '');
  const isChosungQuery = /^[ㄱ-ㅎ]+$/.test(cleanQuery);
  const queryChosung = getChosung(cleanQuery);
  const queryJamo = decomposeHangul(cleanQuery);
  const queryQwertyJamo = convertQwertyToKoreanJamo(cleanQuery);

  const resultsMap = new Map<string, SearchMatchDetail>();

  // 1. Direct streamer alias check
  const directAlias = STREAMER_ALIASES[cleanQuery] || STREAMER_ALIASES[query];
  if (directAlias && sourceList.includes(directAlias)) {
    resultsMap.set(directAlias, {
      name: directAlias,
      matchType: 'alias',
      aliasLabel: rawQuery.trim(),
      score: 950,
    });
  }

  // 2. Direct string checks
  for (const streamer of sourceList) {
    const cleanStreamer = streamer.replace(/[\s_]/g, '').toLowerCase();
    const streamerChosung = getChosung(cleanStreamer);
    const streamerJamo = decomposeHangul(cleanStreamer);

    let score = -1;
    let matchType: SearchMatchDetail['matchType'] = 'fuzzy';

    if (streamer.toLowerCase() === query) {
      score = 1000;
      matchType = 'exact';
    } else if (cleanStreamer === cleanQuery) {
      score = 950;
      matchType = 'exact';
    } else if (cleanStreamer.startsWith(cleanQuery)) {
      score = 800 - cleanStreamer.length;
      matchType = 'prefix';
    } else if (cleanStreamer.includes(cleanQuery)) {
      score = 700 - cleanStreamer.indexOf(cleanQuery) * 10 - cleanStreamer.length;
      matchType = 'prefix';
    } else if (isChosungQuery && queryChosung.length > 0) {
      if (streamerChosung.startsWith(queryChosung)) {
        score = 650 - streamerChosung.length;
        matchType = 'chosung';
      } else if (streamerChosung.includes(queryChosung)) {
        score = 550 - streamerChosung.indexOf(queryChosung) * 5;
        matchType = 'chosung';
      }
    } else if (streamerJamo.includes(queryJamo)) {
      score = 500 - streamerJamo.indexOf(queryJamo);
      matchType = 'jamo';
    } else if (streamerJamo.includes(queryQwertyJamo)) {
      score = 450 - streamerJamo.indexOf(queryQwertyJamo);
      matchType = 'qwerty';
    }

    if (score > 0) {
      const existing = resultsMap.get(streamer);
      if (!existing || existing.score < score) {
        resultsMap.set(streamer, { name: streamer, matchType, score });
      }
    }
  }

  // 3. Fuse.js Fuzzy Matching
  const fuseItems = sourceList.map((name) => {
    const clean = name.replace(/[\s_]/g, '').toLowerCase();
    const aliases = Object.entries(STREAMER_ALIASES)
      .filter(([_, t]) => t === name)
      .map(([a]) => a);

    return {
      name,
      clean,
      chosung: getChosung(clean),
      jamo: decomposeHangul(clean),
      aliases,
    };
  });

  const fuse = new Fuse(fuseItems, {
    keys: [
      { name: 'clean', weight: 0.35 },
      { name: 'jamo', weight: 0.3 },
      { name: 'name', weight: 0.2 },
      { name: 'aliases', weight: 0.1 },
      { name: 'chosung', weight: 0.05 },
    ],
    threshold: 0.4,
    distance: 50,
    includeScore: true,
  });

  const fuseResults = fuse.search(cleanQuery);
  for (const res of fuseResults) {
    const name = res.item.name;
    const fuseScore = Math.max(100, Math.round((1 - (res.score || 0)) * 400));
    if (!resultsMap.has(name)) {
      resultsMap.set(name, {
        name,
        matchType: 'fuzzy',
        score: fuseScore,
      });
    }
  }

  // Also check QWERTY jamo with Fuse
  if (resultsMap.size < 4 && queryQwertyJamo !== cleanQuery) {
    const qwertyResults = fuse.search(queryQwertyJamo);
    for (const res of qwertyResults) {
      const name = res.item.name;
      if (!resultsMap.has(name)) {
        resultsMap.set(name, {
          name,
          matchType: 'qwerty',
          score: Math.max(80, Math.round((1 - (res.score || 0)) * 350)),
        });
      }
    }
  }

  return Array.from(resultsMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/**
 * Legacy/Simple string array interface for Streamer Search
 */
export function searchStreamers(rawQuery: string, sourceList: string[]): string[] {
  return searchStreamersDetailed(rawQuery, sourceList).map((r) => r.name);
}
