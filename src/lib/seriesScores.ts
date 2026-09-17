import { Match } from '../types';
import { isWooriming } from './stats';

/**
 * Normalizes series key for grouping matches by date and CK tournament name
 */
export function getSeriesKey(match: { date?: string; ck_name?: string }): string {
  const d = (match.date || '').trim();
  const name = (match.ck_name || '').trim();
  return `${d}__${name}`;
}

/**
 * Checks whether the match was won by Ally (Wooriming's team).
 * If Wooriming is on team_a, Red winning means Ally won.
 * If Wooriming is on team_b, Blue winning means Ally won.
 * Fallback: if neither team contains Wooriming, treats Red (team_a) as Ally.
 */
export function isAllyWonMatch(match: {
  winning_team?: string;
  team_a?: Record<string, string>;
  team_b?: Record<string, string>;
}): boolean {
  if (!match) return false;
  const inA = Object.values(match.team_a || {}).some((n) => isWooriming(n));
  const inB = Object.values(match.team_b || {}).some((n) => isWooriming(n));

  const win = (match.winning_team || '').trim();
  const isRedWin = win === 'Red' || win === 'red' || win === '레드' || win === 'team_a';

  if (inA) {
    return isRedWin;
  }
  if (inB) {
    return !isRedWin;
  }
  // Default fallback: Red = Team 1 (Ally)
  return isRedWin;
}

export interface SeriesScoreResult {
  scoreMap: Map<string, string>; // Map of match.id -> "Ally:Enemy" cumulative score (e.g. "1:0", "0:1", "1:1", "1:2", "2:2", "2:3", "3:2")
  allyEnemyScoreMap: Map<string, string>;
  updatedMatches: Match[];
}

/**
 * Accurately calculates cumulative series scores for all matches.
 * 1. Groups by date + ck_name.
 * 2. Sorts ascending by set_number (1 -> 2 -> 3 -> 4 -> 5).
 * 3. Tracks sequential win/loss progression for Ally (우리밍_ 팀) vs Enemy (상대팀):
 *    e.g., 1세트: 1:0 또는 0:1
 *          2세트: 2:0, 1:1, 또는 0:2
 *          3세트: 3:0, 2:1, 1:2, 또는 0:3
 *          4세트: 3:1, 2:2, 또는 1:3
 *          5세트: 3:2 또는 2:3
 */
export function calculateMatchSeriesScores(matches: Match[]): SeriesScoreResult {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      scoreMap: new Map(),
      allyEnemyScoreMap: new Map(),
      updatedMatches: [],
    };
  }

  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = getSeriesKey(m);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const scoreMap = new Map<string, string>();
  const updatedMatchMap = new Map<string, Match>();

  for (const [, group] of groups) {
    // Sort strictly in ascending order by set_number (1 -> 2 -> 3 -> 4 -> 5)
    const sortedAsc = [...group].sort((a, b) => {
      const setA = Math.max(1, parseInt(String(a.set_number), 10) || 1);
      const setB = Math.max(1, parseInt(String(b.set_number), 10) || 1);
      if (setA !== setB) return setA - setB;
      return (a.created_at || a.id).localeCompare(b.created_at || b.id);
    });

    let allyWins = 0;
    let enemyWins = 0;

    for (const m of sortedAsc) {
      const won = isAllyWonMatch(m);
      if (won) {
        allyWins++;
      } else {
        enemyWins++;
      }

      const cumulativeScore = `${allyWins}:${enemyWins}`;
      scoreMap.set(m.id, cumulativeScore);

      if (m.score !== cumulativeScore) {
        updatedMatchMap.set(m.id, { ...m, score: cumulativeScore });
      } else {
        updatedMatchMap.set(m.id, m);
      }
    }
  }

  const updatedMatches = matches.map((m) => updatedMatchMap.get(m.id) || m);

  return {
    scoreMap,
    allyEnemyScoreMap: scoreMap,
    updatedMatches,
  };
}

/**
 * Helper to ensure all matches have synchronized, cumulative scores without corruption.
 */
export function recalculateAllSeriesScores(matches: Match[]): Match[] {
  return calculateMatchSeriesScores(matches).updatedMatches;
}

/**
 * Gets the cumulative series score string (e.g. "1:0", "2:1") for a given match.
 */
export function getSeriesCumulativeScore(match: Match, allMatches?: Match[]): string {
  if (match.score && /^\d+:\d+$/.test(match.score)) {
    return match.score;
  }
  if (allMatches && allMatches.length > 0) {
    const res = calculateMatchSeriesScores(allMatches);
    const calculated = res.scoreMap.get(match.id);
    if (calculated) return calculated;
  }
  return match.score || '1:0';
}

export interface SetScoreCalculationParams {
  date: string;
  ck_name: string;
  set_number: number;
  winning_team: 'Red' | 'Blue';
  team_a?: Record<string, string>;
  team_b?: Record<string, string>;
  excludeMatchId?: string;
  allMatches: Match[];
}

export interface SetScoreCalculationResult {
  score: string;
  currentAllyWins: number;
  currentEnemyWins: number;
  priorAllyWins: number;
  priorEnemyWins: number;
  priorWinners: ('Red' | 'Blue')[];
  priorHistory: { set: number; won: boolean; label: string }[];
}

/**
 * Calculates the score for a specific set being created or edited in the modal.
 * Only counts matches that come BEFORE the target set_number in the same series.
 * Correctly accounts for side swaps (Red/Blue side) between sets.
 */
export function calculateScoreForSetInSeries({
  date,
  ck_name,
  set_number,
  winning_team,
  team_a,
  team_b,
  excludeMatchId,
  allMatches,
}: SetScoreCalculationParams): SetScoreCalculationResult {
  const currentSetNum = Math.max(1, Number(set_number) || 1);
  const targetKey = getSeriesKey({ date, ck_name });

  // Filter ONLY prior sets in the same series with set_number < currentSetNum
  const priorMatches = allMatches
    .filter((m) => {
      if (excludeMatchId && m.id === excludeMatchId) return false;
      const key = getSeriesKey(m);
      if (key !== targetKey) return false;
      const otherSet = Math.max(1, Number(m.set_number) || 1);
      return otherSet < currentSetNum;
    })
    .sort((a, b) => (Number(a.set_number) || 1) - (Number(b.set_number) || 1));

  // Deduplicate by set_number if any duplicate exists, keeping the newest
  const priorMap = new Map<number, Match>();
  for (const m of priorMatches) {
    const s = Math.max(1, Number(m.set_number) || 1);
    const existing = priorMap.get(s);
    if (!existing || (m.created_at || m.id) > (existing.created_at || existing.id)) {
      priorMap.set(s, m);
    }
  }

  const sortedPrior = Array.from(priorMap.values()).sort(
    (a, b) => (Number(a.set_number) || 1) - (Number(b.set_number) || 1)
  );

  let priorAllyWins = 0;
  let priorEnemyWins = 0;
  const priorWinners: ('Red' | 'Blue')[] = [];
  const priorHistory: { set: number; won: boolean; label: string }[] = [];

  for (const m of sortedPrior) {
    const won = isAllyWonMatch(m);
    if (won) {
      priorAllyWins++;
    } else {
      priorEnemyWins++;
    }
    priorWinners.push(m.winning_team === 'Red' ? 'Red' : 'Blue');
    priorHistory.push({
      set: Number(m.set_number) || 1,
      won,
      label: `${Number(m.set_number) || 1}세트(${won ? '승리' : '패배'})`,
    });
  }

  // Determine if current selection in the modal means Ally won or Enemy won
  const currentWon = isAllyWonMatch({
    winning_team,
    team_a,
    team_b,
  });

  const currentAllyWins = priorAllyWins + (currentWon ? 1 : 0);
  const currentEnemyWins = priorEnemyWins + (currentWon ? 0 : 1);

  return {
    score: `${currentAllyWins}:${currentEnemyWins}`,
    currentAllyWins,
    currentEnemyWins,
    priorAllyWins,
    priorEnemyWins,
    priorWinners,
    priorHistory,
  };
}

/**
 * Canonical sorting for matches in chronological order (Newest first, exactly as in CK 일지).
 * 1. Date DESC (latest date first)
 * 2. CK tournament name DESC
 * 3. Set number DESC (highest set number first, e.g. 5세트 -> 4세트 -> 1세트)
 * 4. Created at / ID DESC
 */
export function sortMatchesDescending(matches: Match[]): Match[] {
  if (!Array.isArray(matches)) return [];
  return [...matches].sort((a, b) => {
    const dateDiff = (b.date || '').localeCompare(a.date || '');
    if (dateDiff !== 0) return dateDiff;
    const ckDiff = (b.ck_name || '').localeCompare(a.ck_name || '');
    if (ckDiff !== 0) return ckDiff;
    const setA = Math.max(1, parseInt(String(a.set_number), 10) || 1);
    const setB = Math.max(1, parseInt(String(b.set_number), 10) || 1);
    if (setA !== setB) return setB - setA;
    return (b.created_at || b.id || '').localeCompare(a.created_at || a.id || '');
  });
}

/**
 * Canonical sorting for matches in chronological order (Oldest first: Past -> Present).
 */
export function sortMatchesAscending(matches: Match[]): Match[] {
  if (!Array.isArray(matches)) return [];
  return [...matches].sort((a, b) => {
    const dateDiff = (a.date || '').localeCompare(b.date || '');
    if (dateDiff !== 0) return dateDiff;
    const ckDiff = (a.ck_name || '').localeCompare(b.ck_name || '');
    if (ckDiff !== 0) return ckDiff;
    const setA = Math.max(1, parseInt(String(a.set_number), 10) || 1);
    const setB = Math.max(1, parseInt(String(b.set_number), 10) || 1);
    if (setA !== setB) return setA - setB;
    return (a.created_at || a.id || '').localeCompare(b.created_at || b.id || '');
  });
}
