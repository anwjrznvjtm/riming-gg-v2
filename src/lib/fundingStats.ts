import { Match } from '../types';
import { isMatchWonByWooriming } from './stats';

export interface SeriesFundingRecord {
  seriesKey: string;
  date: string;
  ck_name: string;
  setCount: number;
  seriesScore: string; // e.g. "2:1", "1:0", "0:2"
  won: boolean; // allyWins > enemyWins
  isTie: boolean; // allyWins === enemyWins
  allyWins: number;
  enemyWins: number;
  totalBalloons: number;
  perPersonBalloons: number;
  splitCount: number;
  hasSubsidy: boolean;
  subsidyWon: boolean;
  fundingRatio?: string;
  sets: Match[];
}

export interface MonthlyFundingStats {
  monthKey: string; // "YYYY-MM" or "all"
  monthLabel: string; // e.g. "2월" or "2025년 2월"
  fundedSeriesCount: number;
  seriesWins: number;
  seriesLosses: number;
  seriesTies: number;
  winRate: number;
  wonBalloonsTotal: number;
  wonBalloonsPerPerson: number;
  lostBalloonsTotal: number;
  lostBalloonsPerPerson: number;
  netBalloonsTotal: number;
  netBalloonsPerPerson: number;
  subsidyWonCount: number;
  subsidyWonTotalAmount: number;
  subsidyWonPerPersonAmount: number;
  records: SeriesFundingRecord[];
}

/**
 * Groups raw matches (sets) into unified match series (date + ck_name).
 * Ensures star balloon funding and SOOP partner subsidy are applied ONCE per match series,
 * evaluated against the overall series outcome (e.g. 2:1 -> Win, 1:2 -> Loss).
 */
export function groupMatchesIntoSeries(matches: Match[]): SeriesFundingRecord[] {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  const groups = new Map<string, Match[]>();

  for (const m of matches) {
    const date = (m.date || '').trim();
    const name = (m.ck_name || '').trim() || 'CK 경기';
    const key = `${date}__${name}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(m);
  }

  const seriesRecords: SeriesFundingRecord[] = [];

  for (const [key, sets] of groups) {
    // Sort ascending by set_number (1 -> 2 -> 3)
    const sortedSets = [...sets].sort((a, b) => {
      const setA = parseInt(String(a.set_number), 10) || 1;
      const setB = parseInt(String(b.set_number), 10) || 1;
      if (setA !== setB) return setA - setB;
      return (a.created_at || a.id).localeCompare(b.created_at || b.id);
    });

    // Score & Win progression for Wooriming's team
    let allyWins = 0;
    let enemyWins = 0;
    for (const s of sortedSets) {
      if (isMatchWonByWooriming(s)) {
        allyWins++;
      } else {
        enemyWins++;
      }
    }

    const won = allyWins > enemyWins;
    const isTie = allyWins === enemyWins;
    const seriesScore = `${allyWins}:${enemyWins}`;

    // Extract representative funding and split count across sets of this match
    const splitCount =
      sortedSets.find((s) => s.funding_split_count)?.funding_split_count || 5;

    let maxTotalBalloons = 0;
    let maxPerPerson = 0;

    for (const s of sortedSets) {
      const total =
        s.funding ??
        s.star_balloons ??
        ((s.funding_per_person || 0) * splitCount) ??
        0;
      const perPerson =
        s.funding_per_person ??
        (total ? Math.round(total / splitCount) : 0);

      if (total > maxTotalBalloons) maxTotalBalloons = total;
      if (perPerson > maxPerPerson) maxPerPerson = perPerson;
    }

    if (maxPerPerson > 0 && maxTotalBalloons === 0) {
      maxTotalBalloons = maxPerPerson * splitCount;
    } else if (maxTotalBalloons > 0 && maxPerPerson === 0) {
      maxPerPerson = Math.round(maxTotalBalloons / splitCount);
    }

    // Subsidy: If any set had partner subsidy enabled
    const hasSubsidy = sortedSets.some(
      (s) => Boolean(s.has_partner_subsidy || s.partner_subsidy)
    );
    const subsidyWon = hasSubsidy && won;
    const fundingRatio = sortedSets.find((s) => s.funding_ratio)?.funding_ratio;

    seriesRecords.push({
      seriesKey: key,
      date: sortedSets[0].date,
      ck_name: sortedSets[0].ck_name || 'CK 경기',
      setCount: sortedSets.length,
      seriesScore,
      won,
      isTie,
      allyWins,
      enemyWins,
      totalBalloons: maxTotalBalloons,
      perPersonBalloons: maxPerPerson,
      splitCount,
      hasSubsidy,
      subsidyWon,
      fundingRatio,
      sets: sortedSets,
    });
  }

  // Sort descending by date, then latest set
  return seriesRecords.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Computes monthly aggregated funding statistics from match series.
 */
export function calculateMonthlyFundingStats(
  matches: Match[],
  targetMonthKey: string = 'all' // 'all' or 'YYYY-MM'
): MonthlyFundingStats {
  const allSeries = groupMatchesIntoSeries(matches);

  const filteredSeries = allSeries.filter((s) => {
    if (targetMonthKey === 'all') return true;
    return s.date && s.date.startsWith(targetMonthKey);
  });

  let fundedSeriesCount = 0;
  let seriesWins = 0;
  let seriesLosses = 0;
  let seriesTies = 0;

  let wonBalloonsTotal = 0;
  let wonBalloonsPerPerson = 0;
  let lostBalloonsTotal = 0;
  let lostBalloonsPerPerson = 0;

  let subsidyWonCount = 0;

  const validFundingRecords: SeriesFundingRecord[] = [];

  for (const s of filteredSeries) {
    const hasFunding = s.totalBalloons > 0 || s.hasSubsidy;
    if (hasFunding) {
      fundedSeriesCount++;
      validFundingRecords.push(s);

      if (s.isTie) {
        seriesTies++;
      } else if (s.won) {
        seriesWins++;
        wonBalloonsTotal += s.totalBalloons;
        wonBalloonsPerPerson += s.perPersonBalloons;
      } else {
        seriesLosses++;
        lostBalloonsTotal += s.totalBalloons;
        lostBalloonsPerPerson += s.perPersonBalloons;
      }

      if (s.subsidyWon) {
        subsidyWonCount++;
      }
    }
  }

  const netBalloonsTotal = wonBalloonsTotal - lostBalloonsTotal;
  const netBalloonsPerPerson = wonBalloonsPerPerson - lostBalloonsPerPerson;

  const subsidyWonTotalAmount = subsidyWonCount * 1000000;
  const subsidyWonPerPersonAmount = subsidyWonCount * 200000;

  const winRate =
    fundedSeriesCount > 0 ? Math.round((seriesWins / fundedSeriesCount) * 100) : 0;

  let monthLabel = '전체 기간';
  if (targetMonthKey !== 'all') {
    const parts = targetMonthKey.split('-');
    if (parts.length === 2) {
      monthLabel = `${parseInt(parts[1], 10)}월`;
    }
  }

  return {
    monthKey: targetMonthKey,
    monthLabel,
    fundedSeriesCount,
    seriesWins,
    seriesLosses,
    seriesTies,
    winRate,
    wonBalloonsTotal,
    wonBalloonsPerPerson,
    lostBalloonsTotal,
    lostBalloonsPerPerson,
    netBalloonsTotal,
    netBalloonsPerPerson,
    subsidyWonCount,
    subsidyWonTotalAmount,
    subsidyWonPerPersonAmount,
    records: validFundingRecords,
  };
}

/**
 * Extracts representative funding and subsidy info for a match within its series.
 * Only the first set of the match (1세트) is considered eligible to display the badge,
 * preventing duplicate badges on subsequent sets (2세트, 3세트...).
 */
export function getSeriesRepresentativeFunding(
  match: Match,
  allMatches?: Match[]
): {
  isFirstSet: boolean;
  perPersonBalloons: number;
  totalBalloons: number;
  hasSubsidy: boolean;
  fundingRatio?: string;
} {
  const currentSetNum = parseInt(String(match.set_number), 10) || 1;

  if (!allMatches || allMatches.length === 0) {
    const isFirstSet = currentSetNum === 1;
    const splitCount = match.funding_split_count || 5;
    const total =
      match.funding ??
      match.star_balloons ??
      ((match.funding_per_person || 0) * splitCount) ??
      0;
    const perPerson =
      match.funding_per_person ?? (total ? Math.round(total / splitCount) : 0);
    const hasSubsidy = Boolean(match.has_partner_subsidy || match.partner_subsidy);

    return {
      isFirstSet,
      perPersonBalloons: perPerson,
      totalBalloons: total,
      hasSubsidy,
      fundingRatio: match.funding_ratio,
    };
  }

  // Find all sets for the same date and ck_name
  const matchDate = (match.date || '').trim();
  const matchName = (match.ck_name || '').trim() || 'CK 경기';

  const seriesSets = allMatches.filter(
    (m) =>
      (m.date || '').trim() === matchDate &&
      ((m.ck_name || '').trim() || 'CK 경기') === matchName
  );

  if (seriesSets.length === 0) {
    return {
      isFirstSet: currentSetNum === 1,
      perPersonBalloons: match.funding_per_person || 0,
      totalBalloons: match.funding || match.star_balloons || 0,
      hasSubsidy: Boolean(match.has_partner_subsidy || match.partner_subsidy),
    };
  }

  // Sort ascending by set_number, then created_at / id
  const sortedSets = [...seriesSets].sort((a, b) => {
    const setA = parseInt(String(a.set_number), 10) || 1;
    const setB = parseInt(String(b.set_number), 10) || 1;
    if (setA !== setB) return setA - setB;
    return (a.created_at || a.id || '').localeCompare(b.created_at || b.id || '');
  });

  const firstSet = sortedSets[0];
  // Strictly only the first set of the match series displays the badge
  const isFirstSet = match.id === firstSet.id;

  const splitCount =
    sortedSets.find((s) => s.funding_split_count)?.funding_split_count || 5;

  let maxTotalBalloons = 0;
  let maxPerPerson = 0;

  for (const s of sortedSets) {
    const total =
      s.funding ??
      s.star_balloons ??
      ((s.funding_per_person || 0) * splitCount) ??
      0;
    const perPerson =
      s.funding_per_person ??
      (total ? Math.round(total / splitCount) : 0);

    if (total > maxTotalBalloons) maxTotalBalloons = total;
    if (perPerson > maxPerPerson) maxPerPerson = perPerson;
  }

  if (maxPerPerson > 0 && maxTotalBalloons === 0) {
    maxTotalBalloons = maxPerPerson * splitCount;
  } else if (maxTotalBalloons > 0 && maxPerPerson === 0) {
    maxPerPerson = Math.round(maxTotalBalloons / splitCount);
  }

  const hasSubsidy = sortedSets.some(
    (s) => Boolean(s.has_partner_subsidy || s.partner_subsidy)
  );

  const fundingRatio = sortedSets.find((s) => s.funding_ratio)?.funding_ratio;

  return {
    isFirstSet,
    perPersonBalloons: maxPerPerson,
    totalBalloons: maxTotalBalloons,
    hasSubsidy,
    fundingRatio,
  };
}
