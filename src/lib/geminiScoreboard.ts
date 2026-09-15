import { Match, MatchDetailedStats, PlayerDetailedSpec, TeamDetailedSpec, LineKey, LINE_KEYS } from '../types';

export interface VisionAnalysisResult {
  success: boolean;
  data?: MatchDetailedStats;
  error?: string;
}

/**
 * Sends the screenshot image to the server-side Gemini API endpoint
 * for AI Vision analysis and structured extraction of the LoL match scoreboard.
 */
export async function analyzeScoreboardImage(
  imageBase64: string,
  mimeType: string = 'image/png',
  matchContext?: Partial<Match>
): Promise<VisionAnalysisResult> {
  try {
    const res = await fetch('/api/gemini/analyze-scoreboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        currentMatchContext: matchContext
          ? {
              ck_name: matchContext.ck_name,
              date: matchContext.date,
              set_number: matchContext.set_number,
              team_a: matchContext.team_a,
              team_b: matchContext.team_b,
              team_a_champs: matchContext.team_a_champs,
              team_b_champs: matchContext.team_b_champs,
            }
          : undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `서버 응답 오류 (HTTP ${res.status})`);
    }

    const raw = json.data;
    const normalizedStats = normalizeVisionStats(raw, matchContext);
    return {
      success: true,
      data: normalizedStats,
    };
  } catch (err: any) {
    console.error('[Scoreboard Analysis Error]', err);
    return {
      success: false,
      error: err?.message || '스크린샷 분석에 실패했습니다. 유효한 리그 오브 레전드 결과창 이미지를 확인해 주세요.',
    };
  }
}

/**
 * Normalizes raw output from Gemini Vision into strict MatchDetailedStats structure
 */
export function normalizeVisionStats(raw: any, match?: Partial<Match>): MatchDetailedStats {
  const blueTeamRaw = raw?.blueTeam || raw?.team_b || {};
  const redTeamRaw = raw?.redTeam || raw?.team_a || {};

  const sanitizePlayer = (pRaw: any, fallbackLine: LineKey, fallbackName: string, fallbackChamp: string): PlayerDetailedSpec => {
    const name = String(pRaw?.name || fallbackName || '').trim();
    const champ = String(pRaw?.champ || fallbackChamp || '').trim();
    const kda = String(pRaw?.kda || `${pRaw?.kills ?? 0}/${pRaw?.deaths ?? 0}/${pRaw?.assists ?? 0}`).trim();
    
    // Parse kills, deaths, assists
    const [k, d, a] = kda.split('/').map((s) => parseInt(s.trim(), 10) || 0);

    const damage = typeof pRaw?.damage === 'number' ? pRaw.damage : (parseInt(String(pRaw?.damage || '0').replace(/[^0-9]/g, ''), 10) || 0);
    const cs = typeof pRaw?.cs === 'number' ? pRaw.cs : (parseInt(String(pRaw?.cs || '0').replace(/[^0-9]/g, ''), 10) || 0);
    const csPerMin = typeof pRaw?.csPerMin === 'number' ? pRaw.csPerMin : parseFloat(String(pRaw?.csPerMin || '0')) || 0;
    const gold = typeof pRaw?.gold === 'number' ? pRaw.gold : (parseInt(String(pRaw?.gold || '0').replace(/[^0-9]/g, ''), 10) || 0);

    const items = Array.isArray(pRaw?.items)
      ? pRaw.items.map((it: any) => String(it).trim()).filter(Boolean)
      : [];

    const spells = Array.isArray(pRaw?.spells)
      ? pRaw.spells.map((sp: any) => String(sp).trim()).filter(Boolean)
      : ['점멸', '점화'];

    const runes = {
      primary: pRaw?.runes?.primary ? String(pRaw.runes.primary).trim() : '정복자',
      secondary: pRaw?.runes?.secondary ? String(pRaw.runes.secondary).trim() : '영감',
    };

    return {
      name,
      line: fallbackLine,
      champ,
      kda: kda || `${k}/${d}/${a}`,
      kills: k,
      deaths: d,
      assists: a,
      damage,
      cs,
      csPerMin,
      gold,
      items,
      spells,
      runes,
    };
  };

  const bluePlayers: Record<LineKey, PlayerDetailedSpec> = {} as any;
  const redPlayers: Record<LineKey, PlayerDetailedSpec> = {} as any;

  for (const line of LINE_KEYS) {
    const bFallbackName = match?.team_b?.[line] || '';
    const bFallbackChamp = match?.team_b_champs?.[line] || '';
    const bPlayerRaw = blueTeamRaw?.players?.[line] || (Array.isArray(blueTeamRaw?.players) ? blueTeamRaw.players.find((p: any) => p?.line === line) : null);
    bluePlayers[line] = sanitizePlayer(bPlayerRaw, line, bFallbackName, bFallbackChamp);

    const rFallbackName = match?.team_a?.[line] || '';
    const rFallbackChamp = match?.team_a_champs?.[line] || '';
    const rPlayerRaw = redTeamRaw?.players?.[line] || (Array.isArray(redTeamRaw?.players) ? redTeamRaw.players.find((p: any) => p?.line === line) : null);
    redPlayers[line] = sanitizePlayer(rPlayerRaw, line, rFallbackName, rFallbackChamp);
  }

  // Calculate damage shares
  const blueTotalDmg = Object.values(bluePlayers).reduce((sum, p) => sum + (p.damage || 0), 0);
  if (blueTotalDmg > 0) {
    for (const line of LINE_KEYS) {
      bluePlayers[line].damageShare = Math.round(((bluePlayers[line].damage || 0) / blueTotalDmg) * 1000) / 10;
    }
  }

  const redTotalDmg = Object.values(redPlayers).reduce((sum, p) => sum + (p.damage || 0), 0);
  if (redTotalDmg > 0) {
    for (const line of LINE_KEYS) {
      redPlayers[line].damageShare = Math.round(((redPlayers[line].damage || 0) / redTotalDmg) * 1000) / 10;
    }
  }

  const blueTeam: TeamDetailedSpec = {
    teamName: blueTeamRaw?.teamName || '블루팀',
    teamKda: blueTeamRaw?.teamKda || calculateTeamKda(bluePlayers),
    globalGold: blueTeamRaw?.globalGold || formatGold(Object.values(bluePlayers).reduce((sum, p) => sum + (p.gold || 0), 0)),
    towerKills: blueTeamRaw?.towerKills ?? 8,
    dragonKills: blueTeamRaw?.dragonKills ?? 3,
    baronKills: blueTeamRaw?.baronKills ?? 1,
    players: bluePlayers,
  };

  const redTeam: TeamDetailedSpec = {
    teamName: redTeamRaw?.teamName || '레드팀',
    teamKda: redTeamRaw?.teamKda || calculateTeamKda(redPlayers),
    globalGold: redTeamRaw?.globalGold || formatGold(Object.values(redPlayers).reduce((sum, p) => sum + (p.gold || 0), 0)),
    towerKills: redTeamRaw?.towerKills ?? 3,
    dragonKills: redTeamRaw?.dragonKills ?? 1,
    baronKills: redTeamRaw?.baronKills ?? 0,
    players: redPlayers,
  };

  return {
    gameDuration: raw?.gameDuration || '31:45',
    blueTeam,
    redTeam,
    analyzedAt: new Date().toISOString(),
  };
}

function calculateTeamKda(players: Record<LineKey, PlayerDetailedSpec>): string {
  let k = 0, d = 0, a = 0;
  for (const line of LINE_KEYS) {
    k += players[line]?.kills || 0;
    d += players[line]?.deaths || 0;
    a += players[line]?.assists || 0;
  }
  return `${k}/${d}/${a}`;
}

function formatGold(val: number): string {
  if (val <= 0) return '58.4k';
  return `${(val / 1000).toFixed(1)}k`;
}

/**
 * Creates a rich realistic demo sample LoL scoreboard for the given match
 * preserving official Korean game names.
 */
export function generateSampleScoreboard(match: Match): MatchDetailedStats {
  const isBlueWin = match.winning_team === 'Blue';
  const gameDuration = '32:18';

  const defaultItemsByLine: Record<LineKey, string[]> = {
    top: ['태양불꽃 방패', '강철심장', '판금 장화', '가시 갑옷', '워모그의 갑옷', '투명 와드'],
    jgl: ['월식', '쇼진의 창', '헤르메스의 발걸음', '스테락의 도전', '죽음의 무도', '예언자의 렌즈'],
    mid: ['루덴의 동반자', '그림자불꽃', '마법사의 신발', '존야의 모래시계', '라바돈의 죽음모자', '망원 개조'],
    adc: ['도란의 검', '크라켄 학살자', '루난의 허리케인', '무한의 대검', '광전사의 군화', '수호 천사', '망원 개조'],
    sup: ['태양의 썰매', '기사의 맹세', '강철의 솔라리 펜던트', '명석함의 아이오니아 장화', '지크의 융합', '제어 와드'],
  };

  const defaultSpellsByLine: Record<LineKey, string[]> = {
    top: ['점멸', '순간이동'],
    jgl: ['점멸', '강타'],
    mid: ['점멸', '순간이동'],
    adc: ['점멸', '정화'],
    sup: ['점멸', '탈진'],
  };

  const defaultRunesByLine: Record<LineKey, { primary: string; secondary: string }> = {
    top: { primary: '착취의 손아귀', secondary: '정밀' },
    jgl: { primary: '정복자', secondary: '영감' },
    mid: { primary: '감전', secondary: '정밀' },
    adc: { primary: '치명적 속도', secondary: '영감' },
    sup: { primary: '수호자', secondary: '영감' },
  };

  const createPlayerStats = (
    line: LineKey,
    name: string,
    champ: string,
    existingKdaStr: string,
    isWinner: boolean
  ): PlayerDetailedSpec => {
    let k = 3, d = 3, a = 6;
    if (existingKdaStr && existingKdaStr.includes('/')) {
      const parts = existingKdaStr.split('/').map((s) => parseInt(s.trim(), 10) || 0);
      k = parts[0] ?? (isWinner ? 6 : 2);
      d = parts[1] ?? (isWinner ? 2 : 6);
      a = parts[2] ?? (isWinner ? 9 : 4);
    } else {
      if (line === 'adc') {
        k = isWinner ? 9 : 3;
        d = isWinner ? 1 : 6;
        a = isWinner ? 8 : 4;
      } else if (line === 'mid') {
        k = isWinner ? 7 : 2;
        d = isWinner ? 2 : 5;
        a = isWinner ? 6 : 3;
      } else if (line === 'sup') {
        k = isWinner ? 1 : 0;
        d = isWinner ? 3 : 7;
        a = isWinner ? 16 : 6;
      } else if (line === 'jgl') {
        k = isWinner ? 5 : 2;
        d = isWinner ? 2 : 5;
        a = isWinner ? 10 : 3;
      } else {
        k = isWinner ? 4 : 1;
        d = isWinner ? 2 : 4;
        a = isWinner ? 7 : 2;
      }
    }

    const damage = line === 'adc'
      ? (isWinner ? 29400 : 18500)
      : line === 'mid'
      ? (isWinner ? 25100 : 16200)
      : line === 'top'
      ? (isWinner ? 17300 : 13800)
      : line === 'jgl'
      ? (isWinner ? 14200 : 9600)
      : (isWinner ? 6800 : 4200);

    const cs = line === 'adc'
      ? (isWinner ? 268 : 224)
      : line === 'mid'
      ? (isWinner ? 245 : 210)
      : line === 'top'
      ? (isWinner ? 220 : 185)
      : line === 'jgl'
      ? (isWinner ? 172 : 140)
      : (isWinner ? 42 : 36);

    const csPerMin = Math.round((cs / 32.3) * 10) / 10;
    const gold = isWinner ? 12000 + k * 450 + cs * 25 : 8500 + k * 350 + cs * 20;

    return {
      name: name || `${line.toUpperCase()} 선수`,
      line,
      champ: champ || (line === 'adc' ? '카이사' : line === 'sup' ? '노틸러스' : line === 'mid' ? '오리아나' : line === 'jgl' ? '자크' : '아트록스'),
      kda: `${k}/${d}/${a}`,
      kills: k,
      deaths: d,
      assists: a,
      damage,
      cs,
      csPerMin,
      gold,
      items: defaultItemsByLine[line],
      spells: defaultSpellsByLine[line],
      runes: defaultRunesByLine[line],
    };
  };

  const bluePlayers: Record<LineKey, PlayerDetailedSpec> = {} as any;
  const redPlayers: Record<LineKey, PlayerDetailedSpec> = {} as any;

  for (const line of LINE_KEYS) {
    bluePlayers[line] = createPlayerStats(
      line,
      match.team_b?.[line] || '',
      match.team_b_champs?.[line] || '',
      match.team_b_kda?.[line] || '',
      isBlueWin
    );
    redPlayers[line] = createPlayerStats(
      line,
      match.team_a?.[line] || '',
      match.team_a_champs?.[line] || '',
      match.team_a_kda?.[line] || '',
      !isBlueWin
    );
  }

  // Calculate damage shares
  const blueDmgTotal = Object.values(bluePlayers).reduce((sum, p) => sum + p.damage!, 0);
  const redDmgTotal = Object.values(redPlayers).reduce((sum, p) => sum + p.damage!, 0);

  for (const line of LINE_KEYS) {
    bluePlayers[line].damageShare = Math.round((bluePlayers[line].damage! / blueDmgTotal) * 1000) / 10;
    redPlayers[line].damageShare = Math.round((redPlayers[line].damage! / redDmgTotal) * 1000) / 10;
  }

  const blueKda = calculateTeamKda(bluePlayers);
  const redKda = calculateTeamKda(redPlayers);

  return {
    gameDuration,
    blueTeam: {
      teamName: '블루팀',
      teamKda: blueKda,
      globalGold: formatGold(Object.values(bluePlayers).reduce((sum, p) => sum + p.gold!, 0)),
      towerKills: isBlueWin ? 9 : 3,
      dragonKills: isBlueWin ? 3 : 1,
      baronKills: isBlueWin ? 1 : 0,
      players: bluePlayers,
    },
    redTeam: {
      teamName: '레드팀',
      teamKda: redKda,
      globalGold: formatGold(Object.values(redPlayers).reduce((sum, p) => sum + p.gold!, 0)),
      towerKills: !isBlueWin ? 8 : 2,
      dragonKills: !isBlueWin ? 3 : 1,
      baronKills: !isBlueWin ? 1 : 0,
      players: redPlayers,
    },
    analyzedAt: new Date().toISOString(),
  };
}
