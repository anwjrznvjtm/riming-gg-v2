// Mapping LoL Official Data Dragon icon assets for Runes, Spells, and Items
// CommunityDragon & DataDragon URLs provide 100% reliable high-res official icons.

export const DD_VERSION = '14.1.1';
export const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}`;
export const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1';

// Official Keystone Runes (주요 룬) mapping
export interface RuneIconMeta {
  name: string;
  subName?: string; // 보조 룬 이름
  primaryIcon: string;
  subIcon: string;
  style: '정밀' | '지배' | '마법' | '결의' | '영감';
  subStyle: '정밀' | '지배' | '마법' | '결의' | '영감';
}

// 룬 스타일별 공식 아이콘
export const RUNE_STYLE_ICONS: Record<string, string> = {
  정밀: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
  지배: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
  마법: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
  결의: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
  영감: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
};

// 주요 룬 개별 공식 이미지 매핑
export const KEYSTONE_ICONS: Record<string, { icon: string; style: '정밀' | '지배' | '마법' | '결의' | '영감' }> = {
  '치명적 속도': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
    style: '정밀',
  },
  '집중 공격': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
    style: '정밀',
  },
  '기민한 발놀림': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
    style: '정밀',
  },
  '정복자': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
    style: '정밀',
  },
  '칼날비': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png',
    style: '지배',
  },
  '감전': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png',
    style: '지배',
  },
  '어둠의 수확': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
    style: '지배',
  },
  '난입': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png',
    style: '마법',
  },
  '신비로운 유성': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
    style: '마법',
  },
  '콩콩이 소환': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
    style: '마법',
  },
  '착취의 손아귀': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
    style: '결의',
  },
  '여진': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png',
    style: '결의',
  },
  '수호자': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png',
    style: '결의',
  },
  '선제공격': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png',
    style: '영감',
  },
  '빙결 강화': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
    style: '영감',
  },
};

// 보조 룬 개별 공식 이미지 매핑
export const SECONDARY_RUNE_ICONS: Record<string, { icon: string; style: '정밀' | '지배' | '마법' | '결의' | '영감' }> = {
  '마법의 신발': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png',
    style: '영감',
  },
  '비스킷 배달': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png',
    style: '영감',
  },
  '우주적 통찰력': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/CosmicInsight/CosmicInsight.png',
    style: '영감',
  },
  '승전보': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Triumph.png',
    style: '정밀',
  },
  '전설: 민첩함': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png',
    style: '정밀',
  },
  '전설: 핏빛 길': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LegendBloodline/LegendBloodline.png',
    style: '정밀',
  },
  '최후의 일격': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png',
    style: '정밀',
  },
  '체력차 극복': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/CutDown/CutDown.png',
    style: '정밀',
  },
  '피의 맛': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png',
    style: '지배',
  },
  '보물 사냥꾼': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/TreasureHunter/TreasureHunter.png',
    style: '지배',
  },
  '궁극의 사냥꾼': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png',
    style: '지배',
  },
  '빛의 망토': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/NimbusCloak/6361.png',
    style: '마법',
  },
  '폭풍의 결집': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/GatheringStorm/GatheringStorm.png',
    style: '마법',
  },
  '뼈 방패': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/BonePlating/BonePlating.png',
    style: '결의',
  },
  '과잉성장': {
    icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Overgrowth/Overgrowth.png',
    style: '결의',
  },
};

// Helper: 룬 문자열로부터 [주요 룬 아이콘, 보조 룬 아이콘] 세트 구하기
export function resolveRunePair(runes: string[]): {
  primaryName: string;
  subName: string;
  primaryIcon: string;
  subIcon: string;
} {
  let primaryName = '';
  let subName = '';

  for (const r of runes) {
    const clean = r.trim();
    if (!primaryName && KEYSTONE_ICONS[clean]) {
      primaryName = clean;
    } else if (!subName && (SECONDARY_RUNE_ICONS[clean] || (primaryName && KEYSTONE_ICONS[clean]))) {
      subName = clean;
    }
  }

  // Fallbacks if not detected in precise keystones
  if (!primaryName) {
    primaryName = runes[0] || '치명적 속도';
  }
  if (!subName) {
    subName = runes.length > 1 ? runes[1] : '영감';
  }

  const primaryIcon =
    KEYSTONE_ICONS[primaryName]?.icon ||
    SECONDARY_RUNE_ICONS[primaryName]?.icon ||
    RUNE_STYLE_ICONS['정밀'];

  const subIcon =
    SECONDARY_RUNE_ICONS[subName]?.icon ||
    (RUNE_STYLE_ICONS[subName] ? RUNE_STYLE_ICONS[subName] : RUNE_STYLE_ICONS['영감']);

  return { primaryName, subName, primaryIcon, subIcon };
}

// Official Summoner Spells (소환사 주문) mapping
export const SPELL_ICONS: Record<string, string> = {
  점멸: `${DD_BASE}/img/spell/SummonerFlash.png`,
  회복: `${DD_BASE}/img/spell/SummonerHeal.png`,
  정화: `${DD_BASE}/img/spell/SummonerBoost.png`,
  유체화: `${DD_BASE}/img/spell/SummonerHaste.png`,
  탈진: `${DD_BASE}/img/spell/SummonerExhaust.png`,
  점화: `${DD_BASE}/img/spell/SummonerDot.png`,
  순간이동: `${DD_BASE}/img/spell/SummonerTeleport.png`,
  강타: `${DD_BASE}/img/spell/SummonerSmite.png`,
  방어막: `${DD_BASE}/img/spell/SummonerBarrier.png`,
};

export function getSpellIcon(spellName: string): string {
  const clean = spellName.trim();
  if (SPELL_ICONS[clean]) return SPELL_ICONS[clean];
  for (const [key, url] of Object.entries(SPELL_ICONS)) {
    if (clean.includes(key)) return url;
  }
  return SPELL_ICONS['점멸'];
}

// Official LoL Items (아이템) Data Dragon ID mapping
export const ITEM_ID_MAP: Record<string, string> = {
  // ADC Core Items
  '크라켄 학살자': '6672',
  '구인수의 격노검': '3124',
  '무한의 대검': '3031',
  '도미닉 경의 인사': '3036',
  '루난의 허리케인': '3085',
  '고속 연사포': '3094',
  '유령 무희': '3046',
  '나보리 신속검': '6675',
  '나보리 명멸검': '6675',
  '징수의 총': '6676',
  '정수 약탈자': '3508',
  '피바라기': '3072',
  '몰락한 왕의 검': '3153',
  '폭풍갈퀴': '3095',
  '스태틱의 단검': '3087',
  '마법사의 최후': '3091',
  '불멸의 철갑궁': '6673',
  '필멸자의 운명': '3033',
  '경계': '3302',
  '벼락폭풍검': '3302',

  // AP / On-Hit Items
  '나샤의 이빨': '3115',
  '존야의 모래시계': '3157',
  '라바돈의 죽음모자': '3089',
  '그림자불꽃': '4645',
  '악의': '3118',
  '지평선의 초점': '4628',
  '공허의 지팡이': '3135',
  '루덴의 동반자': '3119',
  '대천사의 포옹': '3040',
  '리안드리의 고통': '3151',

  // Fighter / Assassin Items
  '삼위일체': '3078',
  '갈라진 하늘': '6610',
  '스테락의 도전': '3053',
  '칠흑의 양날 도끼': '3071',
  '죽음의 무도': '6333',
  '멜모셔스의 아귀': '3156',
  '세릴다의 원한': '6694',
  '오만': '6697',
  '기회의 단검': '6698',
  '요우무의 유령검': '3142',
  '원칙의 원형낫': '6696',
  '마나무네': '3004',
  '수호 천사': '3026',

  // Tank Items
  '강철심장': '3084',
  '해신 작쇼': '6665',
  '태양불꽃 방패': '3068',
  '가시 갑옷': '3075',
  '워모그의 갑옷': '3083',
  '란두인의 예언': '3143',
  '얼어붙은 심장': '3110',
  '얼어붙은 건틀릿': '6662',
  '케이닉 루컨': '6664',

  // Boots
  '광전사의 군화': '3006',
  '판금 장화': '3047',
  '헤르메스의 발걸음': '3111',
  '마법사의 신발': '3020',
  '명석함의 아이오니아 장화': '3158',
  '신속의 장화': '3009',

  // Component / Sub Items (재료템)
  'B.F. 대검': '1038',
  'BF 대검': '1038',
  '곡괭이': '1037',
  '롱소드': '1036',
  '민첩성의 망토': '1018',
  '단검': '1042',
  '루비 수정': '1028',
  '증폭의 고서': '1052',
  '사파이어 수정': '1027',
  '천 갑옷': '1029',
  '마법무효화의 망토': '1033',
  '정오의 화살': '6670',
  '사라진 양피지': '3802',
  '톱날 단검': '3134',
  '콜필드의 전투 망치': '3133',
  '마법공학 교류발전기': '3145',
  '쓸데없이 큰 지팡이': '1058',
  '악마의 마법서': '3108',
  '에테르 환영': '3113',
  '덤불 조끼': '3076',
  '점화석': '3067',
  '거인의 허리띠': '1011',
  '파수꾼의 갑옷': '3082',
  '쇠사슬 조끼': '1031',
  '음전자 망토': '1057',
  '망령의 두건': '3211',
  '군단의 방패': '3105',
  '탐식의 망치': '3044',
  '광휘의 검': '3057',
  '온기가 담긴 쐐기': '3057',
  '쐐기검': '3101',
  '흡혈의 낫': '1053',
  '주문포식자': '3155',
  '처형인의 대검': '3123',
  '최후의 속삭임': '3035',
  '밴들유리 거울': '4642',
  '방출의 마법봉': '1026',
  '티아맷': '3077',
  '열정의 검': '3086',
  '추적자의 팔목보호대': '2420',
  '기괴한 가면': '3136',
  '바미의 불씨': '3751',
  '비상의 월갑': '6671',

  // Starter Items (Filtered out from Core 3-item builds)
  '도란의 검': '1055',
  '도란의 방패': '1054',
  '도란의 반지': '1056',
  '충전형 물약': '2031',
  '제어 와드': '2042',
  '체력 물약': '2003',
  '새끼 화염발톱': '1103',
  '새끼 바람돌이': '1102',
  '새끼 이끼쿵쿵이': '1101',
};

// Filter out starter items, potions, and wards when determining core 1~3 items
export const NON_CORE_ITEMS = new Set([
  '도란의 검',
  '도란의 방패',
  '도란의 반지',
  '충전형 물약',
  '제어 와드',
  '체력 물약',
  '새끼 화염발톱',
  '새끼 바람돌이',
  '새끼 이끼쿵쿵이',
  '와드 토템',
  '투명 와드',
  '망원형 개조',
  '예언자의 렌즈',
]);

export function getItemIcon(itemName: string): string {
  const clean = itemName.trim();
  const id = ITEM_ID_MAP[clean];
  if (id) {
    return `${DD_BASE}/img/item/${id}.png`;
  }
  // Loose match
  for (const [key, code] of Object.entries(ITEM_ID_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return `${DD_BASE}/img/item/${code}.png`;
    }
  }
  // Default to Kraken Slayer / generic item if not found
  return `${DD_BASE}/img/item/6672.png`;
}
