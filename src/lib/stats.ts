import { Match, LineKey, LineName, ChampionStat, PlayerChampionStat, PartnerStat, LINE_KEYS, LINE_LABELS } from '../types';
import { STREAMER_ALIASES } from './championSearch';

export const WOORIMING = '우리밍_';

export function isWooriming(name?: string | null): boolean {
  if (!name) return false;
  const clean = String(name).trim().replace(/\s+/g, '');
  return clean === '우리밍_' || clean === '우리밍' || clean.includes('우리밍');
}

/**
 * Strips champion names in parentheses, brackets, tags, and resolves streamer nicknames/aliases.
 * e.g. "오뀨(이즈리얼)" -> "오뀨", "상윤" -> "나는상윤", "선비" -> "임선비"
 */
export function normalizeStreamerName(raw?: string | null): string {
  if (!raw) return '';
  let name = String(raw).trim();
  if (!name || name === '-' || name === '미정' || name === 'null' || name === 'undefined') {
    return '';
  }

  // 1. Remove bracket prefixes like [광동], (원딜), [ADC], etc.
  name = name.replace(/^\[[^\]]*\]\s*/g, '').trim();
  name = name.replace(/^\([^)]*\)\s*/g, '').trim();

  // 2. Remove parenthesized champion or info like "오뀨(이즈리얼)", "이상호 (쓰레쉬)"
  name = name.replace(/\s*\([^)]*\)/g, '').trim();

  // 3. Remove slash notations like "오뀨/이즈리얼" if champion is attached
  if (name.includes('/')) {
    const parts = name.split('/');
    if (parts[0] && parts[0].trim()) {
      name = parts[0].trim();
    }
  }

  // 4. Clean extra spaces
  name = name.replace(/\s+/g, ' ').trim();

  // 5. If it's Wooriming, always normalize to canonical '우리밍_'
  if (name.includes('우리밍')) {
    return '우리밍_';
  }

  // 6. Apply STREAMER_ALIASES if matched (e.g. '상윤' -> '나는상윤', '민교' -> '김민교')
  const cleanKey = name.replace(/\s+/g, '');
  if (STREAMER_ALIASES[cleanKey]) {
    return STREAMER_ALIASES[cleanKey];
  }
  if (STREAMER_ALIASES[name]) {
    return STREAMER_ALIASES[name];
  }

  return name;
}

export function parseKda(kda?: string): { k: number; d: number; a: number } {
  if (!kda || !kda.includes('/')) return { k: 0, d: 0, a: 0 };
  const parts = kda.split('/').map((x) => parseInt(x.trim(), 10) || 0);
  return { k: parts[0] || 0, d: parts[1] || 0, a: parts[2] || 0 };
}

export function formatPlayerWithChamp(player?: string, champ?: string): string {
  if (!player) return '';
  if (!champ) return player;
  return `${player}(${champ})`;
}

export function isKdaEmpty(kda?: string): boolean {
  if (!kda) return true;
  const trimmed = kda.trim();
  return trimmed === '' || trimmed === '0/0/0';
}

/**
 * Extracts a roster player for a given lane key safely handling alt naming/casing (e.g. bot/bottom/spt)
 */
export function getRosterPlayerAtRole(roster: any, role: LineKey): string {
  if (!roster) return '';
  if (typeof roster[role] === 'string' && roster[role].trim()) {
    return roster[role].trim();
  }
  const upper = role.toUpperCase();
  if (typeof roster[upper] === 'string' && roster[upper].trim()) {
    return roster[upper].trim();
  }
  if (role === 'adc') {
    for (const alt of ['bot', 'bottom', 'BOT', 'BOTTOM']) {
      if (typeof roster[alt] === 'string' && roster[alt].trim()) {
        return roster[alt].trim();
      }
    }
  }
  if (role === 'sup') {
    for (const alt of ['support', 'spt', 'SUPPORT', 'SPT']) {
      if (typeof roster[alt] === 'string' && roster[alt].trim()) {
        return roster[alt].trim();
      }
    }
  }
  return '';
}

/**
 * Accurately finds Wooriming's team and played position in a match.
 * Returns null if Wooriming was not in this match.
 */
export function findWoorimingInMatch(match: Match): { team: 'Red' | 'Blue'; line: LineKey } | null {
  if (!match) return null;

  // Check Team A (Red)
  if (match.team_a) {
    for (const key of LINE_KEYS) {
      if (isWooriming(match.team_a[key])) {
        return { team: 'Red', line: key };
      }
    }
    const a = match.team_a as any;
    if (isWooriming(a.bot || a.bottom || a.BOT || a.BOTTOM || a.ADC)) return { team: 'Red', line: 'adc' };
    if (isWooriming(a.support || a.spt || a.SUPPORT || a.SPT || a.SUP)) return { team: 'Red', line: 'sup' };
    if (isWooriming(a.TOP || a.top)) return { team: 'Red', line: 'top' };
    if (isWooriming(a.JGL || a.jug || a.jungle)) return { team: 'Red', line: 'jgl' };
    if (isWooriming(a.MID || a.mid)) return { team: 'Red', line: 'mid' };
  }

  // Check Team B (Blue)
  if (match.team_b) {
    for (const key of LINE_KEYS) {
      if (isWooriming(match.team_b[key])) {
        return { team: 'Blue', line: key };
      }
    }
    const b = match.team_b as any;
    if (isWooriming(b.bot || b.bottom || b.BOT || b.BOTTOM || b.ADC)) return { team: 'Blue', line: 'adc' };
    if (isWooriming(b.support || b.spt || b.SUPPORT || b.SPT || b.SUP)) return { team: 'Blue', line: 'sup' };
    if (isWooriming(b.TOP || b.top)) return { team: 'Blue', line: 'top' };
    if (isWooriming(b.JGL || b.jug || b.jungle)) return { team: 'Blue', line: 'jgl' };
    if (isWooriming(b.MID || b.mid)) return { team: 'Blue', line: 'mid' };
  }

  return null;
}

export function getWoorimingTeam(match: Match): 'Red' | 'Blue' {
  const found = findWoorimingInMatch(match);
  if (found) return found.team;
  return 'Red';
}

// Strictly check whether Wooriming won the match (regardless of casing, Korean '레드'/'블루', score, etc.)
export function isMatchWonByWooriming(match: Match): boolean {
  if (!match) return false;
  const wTeam = getWoorimingTeam(match); // 'Red' | 'Blue'
  const win = (match.winning_team || '').trim().toLowerCase();

  if (wTeam === 'Red') {
    if (
      win === 'red' ||
      win === '레드' ||
      win === 'team_a' ||
      win === 'a' ||
      win === '1' ||
      win.startsWith('red') ||
      win.startsWith('레드') ||
      win.includes('red') ||
      win.includes('레드')
    ) {
      return true;
    }
    if (!win && match.score) {
      const parts = match.score.split(':').map((s) => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] > parts[1];
      }
    }
    return false;
  } else if (wTeam === 'Blue') {
    if (
      win === 'blue' ||
      win === '블루' ||
      win === 'team_b' ||
      win === 'b' ||
      win === '2' ||
      win.startsWith('blue') ||
      win.startsWith('블루') ||
      win.includes('blue') ||
      win.includes('블루')
    ) {
      return true;
    }
    if (!win && match.score) {
      const parts = match.score.split(':').map((s) => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[1] > parts[0];
      }
    }
    return false;
  }
  return false;
}

export function getWoorimingLine(match: Match): LineName | null {
  const found = findWoorimingInMatch(match);
  if (found) return LINE_LABELS[found.line];
  return 'ADC';
}

export function getWoorimingLineKey(match: Match): LineKey {
  const found = findWoorimingInMatch(match);
  if (found) return found.line;
  return 'adc';
}

export interface LaneOpponentStat {
  name: string;
  role: 'adc' | 'sup';
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

/**
 * Aggregates exact head-to-head lane opponent stats for Wooriming at a specific position (ADC or SUP).
 * Matches are tracked where Wooriming played the given position, paired with the enemy player at the exact same position.
 */
export function calculateLaneOpponentStats(matches: Match[], role: 'adc' | 'sup'): LaneOpponentStat[] {
  const map = new Map<
    string,
    {
      name: string;
      games: number;
      wins: number;
      losses: number;
    }
  >();

  for (const m of matches) {
    if (!m) continue;

    // 1. 우리밍_의 출전 여부 및 포지션 확인
    const wInfo = findWoorimingInMatch(m);
    if (!wInfo) continue;

    // 2. 우리밍_이 플레이한 포지션이 요청된 포지션(원딜 또는 서폿)과 정확히 일치하는지 확인
    if (wInfo.line !== role) continue;

    // 3. 적팀의 동일 포지션(맞라인) 상대 플레이어 추출
    const oppRoster = wInfo.team === 'Red' ? m.team_b : m.team_a;
    const rawOppName = getRosterPlayerAtRole(oppRoster, role);
    const oppName = normalizeStreamerName(rawOppName);

    // 상대 플레이어 이름이 없거나, 우리밍_ 본인인 경우 제외
    if (!oppName || isWooriming(oppName)) continue;

    // 4. 승패 판정 (우리밍_ 승리 여부)
    const won = isMatchWonByWooriming(m);

    if (!map.has(oppName)) {
      map.set(oppName, {
        name: oppName,
        games: 0,
        wins: 0,
        losses: 0,
      });
    }

    const stat = map.get(oppName)!;
    stat.games += 1;
    if (won) {
      stat.wins += 1;
    } else {
      stat.losses += 1;
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      role,
      winRate: item.games > 0 ? Math.round((item.wins / item.games) * 100) : 0,
    }))
    .sort((a, b) => {
      // 1순위: 판수(games) 많은 순 DESC
      if (b.games !== a.games) return b.games - a.games;
      // 2순위: 승률(winRate) 높은 순 DESC
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      // 3순위: 승리 수(wins) 많은 순 DESC
      return b.wins - a.wins;
    });
}

export function getCombinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return results;
}

export interface OpponentMatchDetail {
  matchId: string | number;
  date: string;
  ckName: string;
  setNumber: number;
  myLine: LineName;
  myChamp: string;
  myKda: string;
  opponentChamp: string;
  opponentKda: string;
  won: boolean;
  score: string;
  winningTeam: string;
}

export interface OpponentStat {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  primaryLine: LineName;
  matches: OpponentMatchDetail[];
}

export function calculateOpponentStats(matches: Match[]): OpponentStat[] {
  const map = new Map<string, OpponentStat>();

  for (const m of matches) {
    const wTeam = getWoorimingTeam(m);
    const lineKey = getWoorimingLineKey(m);
    const lineLabel = LINE_LABELS[lineKey];

    const oppTeamRoster = wTeam === 'Red' ? m.team_b : m.team_a;
    const oppTeamChamps = wTeam === 'Red' ? m.team_b_champs : m.team_a_champs;
    const oppTeamKda = wTeam === 'Red' ? m.team_b_kda : m.team_a_kda;

    const myTeamChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
    const myTeamKda = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;

    const oppName = (oppTeamRoster?.[lineKey] || '').trim();
    if (!oppName || isWooriming(oppName)) continue;

    const won = isMatchWonByWooriming(m);

    if (!map.has(oppName)) {
      map.set(oppName, {
        name: oppName,
        games: 0,
        wins: 0,
        losses: 0,
        winrate: 0,
        primaryLine: lineLabel,
        matches: [],
      });
    }

    const stat = map.get(oppName)!;
    stat.games += 1;
    if (won) {
      stat.wins += 1;
    } else {
      stat.losses += 1;
    }
    stat.winrate = (stat.wins / stat.games) * 100;
    stat.matches.push({
      matchId: m.id,
      date: m.date,
      ckName: m.ck_name,
      setNumber: m.set_number || 1,
      myLine: lineLabel,
      myChamp: myTeamChamps?.[lineKey] || '',
      myKda: myTeamKda?.[lineKey] || '',
      opponentChamp: oppTeamChamps?.[lineKey] || '',
      opponentKda: oppTeamKda?.[lineKey] || '',
      won,
      score: m.score,
      winningTeam: m.winning_team,
    });
  }

  // Sort by matches played DESC, then winrate DESC
  return Array.from(map.values()).sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    return b.winrate - a.winrate;
  });
}

export interface ComputedStats {
  latestMonth: string;
  overallWinrate: { total: number; wins: number; losses: number; winrate: number };
  thisMonthWinrate: { total: number; wins: number; losses: number; winrate: number };
  roleStats: {
    adc: { games: number; wins: number; winrate: number };
    sup: { games: number; wins: number; winrate: number };
  };
  monthlyStats: { month: string; games: number; wins: number; losses: number; winrate: number }[];
  recentTenMatches: { match: Match; won: boolean }[];
  opponentStats: OpponentStat[];
  mostBannedChamps: { champ: string; cnt: number; rate: number }[];
  mostPickedChamps: ChampionStat[];
  partnerStats: {
    overall: { ADC: Record<string, PartnerStat>; SUP: Record<string, PartnerStat> };
    thisMonth: { ADC: Record<string, PartnerStat>; SUP: Record<string, PartnerStat> };
  };
  pairWinrates: Map<string, { games: number; wins: number }>;
  playerPrimaryLines: Record<string, LineName>;
  dominantMonthRole: 'ADC' | 'SUP';
}

export function calculateStats(matches: Match[]): ComputedStats {
  const latestMonth = matches.length
    ? matches.map((m) => m.date.slice(0, 7)).sort().reverse()[0]
    : '2026-09';

  const thisMonthMatches = matches.filter((m) => m.date.startsWith(latestMonth));

  function calcWl(list: Match[]) {
    let wins = 0;
    for (const m of list) {
      if (isMatchWonByWooriming(m)) wins++;
    }
    const total = list.length;
    return { total, wins, losses: total - wins, winrate: total ? (wins / total) * 100 : 0 };
  }

  const overallWinrate = calcWl(matches);
  const thisMonthWinrate = calcWl(thisMonthMatches);

  let adcGames = 0, adcWins = 0;
  let supGames = 0, supWins = 0;

  for (const m of matches) {
    const line = getWoorimingLine(m);
    const won = isMatchWonByWooriming(m);
    if (line === 'ADC') {
      adcGames++;
      if (won) adcWins++;
    } else if (line === 'SUP') {
      supGames++;
      if (won) supWins++;
    }
  }

  const roleStats = {
    adc: { games: adcGames, wins: adcWins, winrate: adcGames ? (adcWins / adcGames) * 100 : 0 },
    sup: { games: supGames, wins: supWins, winrate: supGames ? (supWins / supGames) * 100 : 0 },
  };

  // Monthly stats
  const monthlyMap: Record<string, { games: number; wins: number }> = {};
  for (const m of matches) {
    const month = m.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { games: 0, wins: 0 };
    monthlyMap[month].games++;
    if (isMatchWonByWooriming(m)) monthlyMap[month].wins++;
  }

  const monthlyStats = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => ({
      month,
      games: data.games,
      wins: data.wins,
      losses: data.games - data.wins,
      winrate: data.games ? (data.wins / data.games) * 100 : 0,
    }));

  // Recent 10 matches (ordered from oldest to newest for timeline display)
  const sortedByDateAsc = [...matches].sort((a, b) => {
    const dDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dDiff !== 0) return dDiff;
    const setA = Number(a.set_number) || 1;
    const setB = Number(b.set_number) || 1;
    return setA - setB;
  });
  const recentTenMatches = sortedByDateAsc.slice(-10).map((m) => ({
    match: m,
    won: isMatchWonByWooriming(m),
  }));

  // Opponent Top Stats
  const opponentStats = calculateOpponentStats(matches);

  // Most banned
  const banCounts: Record<string, number> = {};
  for (const m of matches) {
    for (const b of [...m.ban_a, ...m.ban_b]) {
      if (!b) continue;
      banCounts[b] = (banCounts[b] || 0) + 1;
    }
  }
  const mostBannedChamps = Object.entries(banCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([champ, cnt]) => ({
      champ,
      cnt,
      rate: matches.length ? (cnt / matches.length) * 100 : 0,
    }));

  // Most picked by 우리밍_
  const pickMap: Record<string, { picks: number; wins: number; losses: number; kSum: number; dSum: number; aSum: number; kdaCount: number }> = {};
  for (const m of matches) {
    const wTeam = getWoorimingTeam(m);
    const roster = wTeam === 'Red' ? m.team_a : m.team_b;
    const champs = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
    const kdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;
    let wKey: LineKey | null = null;
    for (const k of LINE_KEYS) {
      if (isWooriming(roster[k])) {
        wKey = k;
        break;
      }
    }
    if (!wKey) continue;
    const champ = champs[wKey];
    const kda = kdas[wKey];
    if (!champ) continue;

    if (!pickMap[champ]) {
      pickMap[champ] = { picks: 0, wins: 0, losses: 0, kSum: 0, dSum: 0, aSum: 0, kdaCount: 0 };
    }
    pickMap[champ].picks++;
    if (isMatchWonByWooriming(m)) pickMap[champ].wins++;
    else pickMap[champ].losses++;

    if (!isKdaEmpty(kda)) {
      const parsed = parseKda(kda);
      pickMap[champ].kSum += parsed.k;
      pickMap[champ].dSum += parsed.d;
      pickMap[champ].aSum += parsed.a;
      pickMap[champ].kdaCount++;
    }
  }

  const mostPickedChamps: ChampionStat[] = Object.entries(pickMap)
    .map(([champ, data]) => ({
      champ,
      picks: data.picks,
      wins: data.wins,
      losses: data.losses,
      winrate: data.picks ? (data.wins / data.picks) * 100 : 0,
      kSum: data.kSum,
      dSum: data.dSum,
      aSum: data.aSum,
      kdaCount: data.kdaCount,
      avgKDA: data.kdaCount
        ? `${(data.kSum / data.kdaCount).toFixed(1)}/${(data.dSum / data.kdaCount).toFixed(1)}/${(data.aSum / data.kdaCount).toFixed(1)}`
        : '',
    }))
    .sort((a, b) => b.picks - a.picks);

  // Partner stats (Line synergy)
  function computePartners(list: Match[]) {
    const adcPartners: Record<string, PartnerStat> = {};
    const supPartners: Record<string, PartnerStat> = {};

    for (const m of list) {
      const wTeam = getWoorimingTeam(m);
      const roster = wTeam === 'Red' ? m.team_a : m.team_b;
      let wKey: LineKey | null = null;
      for (const k of LINE_KEYS) {
        if (isWooriming(roster[k])) {
          wKey = k;
          break;
        }
      }
      if (!wKey) continue;
      const wLine = LINE_LABELS[wKey];
      if (wLine !== 'ADC' && wLine !== 'SUP') continue;
      const won = isMatchWonByWooriming(m);

      for (const k of LINE_KEYS) {
        if (k === wKey) continue;
        const pRaw = roster[k];
        if (!pRaw || isWooriming(pRaw)) continue;
        const pName = pRaw.trim();
        const pLine = LINE_LABELS[k];
        const compositeKey = `${pName}|${pLine}`;
        const targetMap = wLine === 'ADC' ? adcPartners : supPartners;

        if (!targetMap[compositeKey]) {
          targetMap[compositeKey] = { name: pName, line: pLine, games: 0, wins: 0 };
        }
        targetMap[compositeKey].games++;
        if (won) targetMap[compositeKey].wins++;
      }
    }
    return { ADC: adcPartners, SUP: supPartners };
  }

  const partnerStats = {
    overall: computePartners(matches),
    thisMonth: computePartners(thisMonthMatches),
  };

  // Pair winrates (synergy among any two players on the same team)
  const pairWinrates = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    const teams = [
      { players: Object.values(m.team_a), won: m.winning_team === 'Red' },
      { players: Object.values(m.team_b), won: m.winning_team === 'Blue' },
    ];
    for (const t of teams) {
      const validPlayers = t.players.filter(Boolean);
      for (let i = 0; i < validPlayers.length; i++) {
        for (let j = i + 1; j < validPlayers.length; j++) {
          const p1 = isWooriming(validPlayers[i]) ? WOORIMING : validPlayers[i].trim();
          const p2 = isWooriming(validPlayers[j]) ? WOORIMING : validPlayers[j].trim();
          const key = [p1, p2].sort().join('|');
          const stat = pairWinrates.get(key) || { games: 0, wins: 0 };
          stat.games++;
          if (t.won) stat.wins++;
          pairWinrates.set(key, stat);
        }
      }
    }
  }

  // Player primary lines
  const playerLineCounts: Record<string, Record<LineName, number>> = {};
  for (const m of matches) {
    const rosters = [m.team_a, m.team_b];
    for (const r of rosters) {
      for (const k of LINE_KEYS) {
        const rawName = r[k];
        if (!rawName) continue;
        const name = isWooriming(rawName) ? WOORIMING : rawName.trim();
        if (!playerLineCounts[name]) {
          playerLineCounts[name] = { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 };
        }
        playerLineCounts[name][LINE_LABELS[k]]++;
      }
    }
  }

  const playerPrimaryLines: Record<string, LineName> = {};
  for (const name in playerLineCounts) {
    let topL: LineName = 'TOP';
    let maxC = -1;
    for (const l of ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as LineName[]) {
      if (playerLineCounts[name][l] > maxC) {
        maxC = playerLineCounts[name][l];
        topL = l;
      }
    }
    playerPrimaryLines[name] = topL;
  }
  playerPrimaryLines[WOORIMING] = 'ADC';
  playerPrimaryLines['우리밍'] = 'ADC';

  // Dominant month role
  let curMonthAdc = 0, curMonthSup = 0;
  for (const m of thisMonthMatches) {
    const l = getWoorimingLine(m);
    if (l === 'ADC') curMonthAdc++;
    else if (l === 'SUP') curMonthSup++;
  }
  const dominantMonthRole: 'ADC' | 'SUP' = curMonthAdc >= curMonthSup ? 'ADC' : 'SUP';

  return {
    latestMonth,
    overallWinrate,
    thisMonthWinrate,
    roleStats,
    monthlyStats,
    recentTenMatches,
    opponentStats,
    mostBannedChamps,
    mostPickedChamps,
    partnerStats,
    pairWinrates,
    playerPrimaryLines,
    dominantMonthRole,
  };
}

export function getPlayerSynergyRate(
  p1: string,
  p2: string,
  pairMap: Map<string, { games: number; wins: number }>
): number {
  if (p1 === p2) return 1.0;
  const key = [p1, p2].sort().join('|');
  const stat = pairMap.get(key);
  if (!stat || stat.games === 0) return 0.5;
  return stat.wins / stat.games;
}

export function getPlayerLineChampionStats(
  playerName: string,
  line: LineName,
  matches: Match[]
): PlayerChampionStat[] {
  if (!playerName || !line || !matches || !matches.length) return [];
  const cleanTarget = playerName.trim().replace(/\s+/g, '');
  const isTargetW = isWooriming(playerName);

  const matchPlayer = (p?: string) => {
    if (!p) return false;
    if (isTargetW) return isWooriming(p);
    return p.trim().replace(/\s+/g, '') === cleanTarget;
  };

  const lineKey = (Object.keys(LINE_LABELS) as LineKey[]).find(
    (k) => LINE_LABELS[k] === line
  );
  if (!lineKey) return [];

  const champMap: Record<string, { games: number; wins: number; losses: number }> = {};

  for (const m of matches) {
    // Check Team A (Red)
    if (matchPlayer(m.team_a?.[lineKey])) {
      const champ = m.team_a_champs?.[lineKey]?.trim();
      if (champ) {
        if (!champMap[champ]) {
          champMap[champ] = { games: 0, wins: 0, losses: 0 };
        }
        champMap[champ].games++;
        if (m.winning_team === 'Red') {
          champMap[champ].wins++;
        } else {
          champMap[champ].losses++;
        }
      }
    }

    // Check Team B (Blue)
    if (matchPlayer(m.team_b?.[lineKey])) {
      const champ = m.team_b_champs?.[lineKey]?.trim();
      if (champ) {
        if (!champMap[champ]) {
          champMap[champ] = { games: 0, wins: 0, losses: 0 };
        }
        champMap[champ].games++;
        if (m.winning_team === 'Blue') {
          champMap[champ].wins++;
        } else {
          champMap[champ].losses++;
        }
      }
    }
  }

  return Object.entries(champMap)
    .map(([champ, data]) => ({
      champ,
      games: data.games,
      wins: data.wins,
      losses: data.losses,
      winrate: data.games ? (data.wins / data.games) * 100 : 0,
    }))
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate || b.wins - a.wins);
}

