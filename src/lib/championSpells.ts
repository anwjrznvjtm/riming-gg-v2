/**
 * src/lib/championSpells.ts
 * Manages champion ability / skill icons (Q, W, E, R) from LoL Data Dragon
 */

import { DD_BASE, DD_VERSION } from './lolIcons';

export interface ChampionSpellInfo {
  id: string;
  key: 'Q' | 'W' | 'E' | 'R';
  name: string;
  image: string; // URL to ability icon
}

// In-memory cache for spell image URLs and names by champion English key
const spellCache: Record<string, Record<'Q' | 'W' | 'E' | 'R', ChampionSpellInfo>> = {};
const pendingFetches = new Set<string>();
const listeners: Array<() => void> = [];

export function subscribeToSpellUpdates(cb: () => void) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifySpellListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

/**
 * Known fallback ability file names for major champions to render instantly (0ms)
 */
const KNOWN_SPELL_FILES: Record<string, { Q: string; W: string; E: string; R: string }> = {
  Jinx: { Q: 'JinxQ', W: 'JinxW', E: 'JinxE', R: 'JinxR' },
  Ezreal: { Q: 'EzrealQ', W: 'EzrealW', E: 'EzrealE', R: 'EzrealR' },
  Caitlyn: { Q: 'CaitlynPiltoverPeacemaker', W: 'CaitlynYordleTrap', E: 'CaitlynEntrapment', R: 'CaitlynAceintheHole' },
  Kaisa: { Q: 'KaisaQ', W: 'KaisaW', E: 'KaisaE', R: 'KaisaR' },
  Vayne: { Q: 'VayneTumble', W: 'VayneSilverBolts', E: 'VayneCondemn', R: 'VayneInquisition' },
  Ashe: { Q: 'AsheQ', W: 'Volley', E: 'AsheSpiritOfTheHawk', R: 'EnchantedCrystalArrow' },
  Jhin: { Q: 'JhinQ', W: 'JhinW', E: 'JhinE', R: 'JhinR' },
  MissFortune: { Q: 'MissFortuneRicochetShot', W: 'MissFortuneViciousStrikes', E: 'MissFortuneScattershot', R: 'MissFortuneBulletTime' },
  Lucian: { Q: 'LucianQ', W: 'LucianW', E: 'LucianE', R: 'LucianR' },
  Samira: { Q: 'SamiraQ', W: 'SamiraW', E: 'SamiraE', R: 'SamiraR' },
  Draven: { Q: 'DravenSpinning', W: 'DravenFury', E: 'DravenDoubleDown', R: 'DravenRCast' },
  Varus: { Q: 'VarusQ', W: 'VarusW', E: 'VarusE', R: 'VarusR' },
  Tristana: { Q: 'TristanaQ', W: 'RocketJump', E: 'DetonatingShot', R: 'BusterShot' },
  Twitch: { Q: 'TwitchHideInShadows', W: 'TwitchVenomCask', E: 'TwitchExpunge', R: 'TwitchFullAutomatic' },
  Kalista: { Q: 'KalistaMysticShot', W: 'KalistaW', E: 'KalistaExpungeWrapper', R: 'KalistaRx' },
  Aphelios: { Q: 'ApheliosQ_ClientTooltipWrapper', W: 'ApheliosW', E: 'ApheliosE_ClientTooltipWrapper', R: 'ApheliosR' },
  Zeri: { Q: 'ZeriQ', W: 'ZeriW', E: 'ZeriE', R: 'ZeriR' },
  Smolder: { Q: 'SmolderQ', W: 'SmolderW', E: 'SmolderE', R: 'SmolderR' },
  Aatrox: { Q: 'AatroxQ', W: 'AatroxW', E: 'AatroxE', R: 'AatroxR' },
  Darius: { Q: 'DariusCleave', W: 'DariusNoxianTacticsONH', E: 'DariusAxeGrab', R: 'DariusExecute' },
  Garen: { Q: 'GarenQ', W: 'GarenW', E: 'GarenE', R: 'GarenR' },
  Jax: { Q: 'JaxLeapStrike', W: 'JaxEmpowerTwo', E: 'JaxCounterStrike', R: 'JaxR' },
  Fiora: { Q: 'FioraQ', W: 'FioraW', E: 'FioraE', R: 'FioraR' },
  LeeSin: { Q: 'BlindMonkQOne', W: 'BlindMonkWOne', E: 'BlindMonkEOne', R: 'BlindMonkRKick' },
  Ahri: { Q: 'AhriOrbofDeception', W: 'AhriFoxFire', E: 'AhriSeduce', R: 'AhriTumble' },
  Yasuo: { Q: 'YasuoQ1Wrapper', W: 'YasuoWMovingWall', E: 'YasuoDashWrapper', R: 'YasuoR' },
  Yone: { Q: 'YoneQ', W: 'YoneW', E: 'YoneE', R: 'YoneR' },
  Zed: { Q: 'ZedQ', W: 'ZedW', E: 'ZedE', R: 'ZedR' },
  Thresh: { Q: 'ThreshQ', W: 'ThreshW', E: 'ThreshE', R: 'ThreshRPenta' },
  Nautilus: { Q: 'NautilusAnchorDrag', W: 'NautilusPiercingGaze', E: 'NautilusSplashZone', R: 'NautilusGrandLine' },
  Leona: { Q: 'LeonaShieldOfDaybreak', W: 'LeonaSolarBarrier', E: 'LeonaZenithBlade', R: 'LeonaSolarFlare' },
  Lulu: { Q: 'LuluQ', W: 'LuluW', E: 'LuluE', R: 'LuluR' },
  Lux: { Q: 'LuxLightBinding', W: 'LuxPrismaticWave', E: 'LuxLightStrikeKugel', R: 'LuxMaliceCannon' },
  Blitzcrank: { Q: 'RocketGrab', W: 'Overdrive', E: 'PowerFist', R: 'StaticField' },
};

/**
 * Returns the best spell icon URL for a given champion and key (Q, W, E, R).
 * Automatically triggers background asynchronous fetch from Data Dragon if not loaded.
 */
export function getChampionSkillIcon(champEnName: string, key: 'Q' | 'W' | 'E' | 'R', patchVersion: string = DD_VERSION): string {
  if (!champEnName) {
    return `${DD_BASE}/img/spell/${key}.png`;
  }

  const cleanEn = champEnName.replace(/[^a-zA-Z0-9]/g, '');

  // 1. In-memory cache check
  if (spellCache[cleanEn] && spellCache[cleanEn][key]) {
    return spellCache[cleanEn][key].image;
  }

  // 2. Pre-calculated known mapping
  if (KNOWN_SPELL_FILES[cleanEn] && KNOWN_SPELL_FILES[cleanEn][key]) {
    const filename = KNOWN_SPELL_FILES[cleanEn][key];
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${filename}.png`;
  }

  // 3. Trigger background fetch for full champion spell data
  fetchChampionSpellsAsync(cleanEn, patchVersion);

  // 4. Default standard fallback URL
  return `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${cleanEn}${key}.png`;
}

/**
 * Asynchronously fetch champion detail spells from Riot Data Dragon
 */
async function fetchChampionSpellsAsync(champEnName: string, patchVersion: string) {
  if (pendingFetches.has(champEnName) || spellCache[champEnName]) {
    return;
  }

  pendingFetches.add(champEnName);

  try {
    const url = `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/data/ko_KR/champion/${champEnName}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Spell fetch error ${res.status}`);
    }

    const data = await res.json();
    const champData = data.data?.[champEnName];

    if (champData && Array.isArray(champData.spells) && champData.spells.length >= 4) {
      const keys: Array<'Q' | 'W' | 'E' | 'R'> = ['Q', 'W', 'E', 'R'];
      const spellsMap: Record<'Q' | 'W' | 'E' | 'R', ChampionSpellInfo> = {} as any;

      champData.spells.forEach((sp: any, idx: number) => {
        if (idx < 4) {
          const k = keys[idx];
          const imgName = sp.image?.full || `${sp.id}.png`;
          spellsMap[k] = {
            id: sp.id,
            key: k,
            name: sp.name || k,
            image: `https://ddragon.leagueoflegends.com/cdn/${patchVersion}/img/spell/${imgName}`,
          };
        }
      });

      spellCache[champEnName] = spellsMap;
      notifySpellListeners();
    }
  } catch (e) {
    // console.warn(`Could not load spell JSON for ${champEnName}`, e);
  } finally {
    pendingFetches.delete(champEnName);
  }
}
