import React, { useState, useMemo, useCallback } from 'react';
import { Match, LineKey, LINE_KEYS } from '../types';
import { ComputedStats } from '../lib/stats';
import { StreamerAvatar } from './StreamerAvatar';
import { Sparkles, RotateCcw, BarChart3, Shuffle, X, Users, Swords } from 'lucide-react';

export type TeamRoster = Record<LineKey, string>;

interface TeamSimulatorProps {
  stats?: ComputedStats;
  matches: Match[];
  allStreamers: string[];
  onToast: (msg: string) => void;
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
}

// --- 기본 유틸 함수 ---
function getPlayerPositionCounts(player: string, matches: Match[]): Record<LineKey, number> {
  const counts: Record<LineKey, number> = { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 };
  for (const m of matches) {
    for (const k of LINE_KEYS as LineKey[]) {
      if ((m.team_a?.[k] || '').trim() === player.trim()) counts[k]++;
      if ((m.team_b?.[k] || '').trim() === player.trim()) counts[k]++;
    }
  }
  return counts;
}

function getMainPosition(player: string, matches: Match[]): LineKey {
  const counts = getPlayerPositionCounts(player, matches);
  let best: LineKey = 'adc';
  let max = -1;
  for (const k of LINE_KEYS as LineKey[]) {
    if (counts[k] > max) {
      max = counts[k];
      best = k;
    }
  }
  return max === 0 ? (player === '우리밍_' ? 'adc' : 'mid') : best;
}

function getPlayerTeam(m: Match, player: string): 'Red' | 'Blue' | null {
  for (const k of LINE_KEYS as LineKey[]) {
    if ((m.team_a?.[k] || '').trim() === player.trim()) return 'Red';
    if ((m.team_b?.[k] || '').trim() === player.trim()) return 'Blue';
  }
  return null;
}

function getWinningTeam(m: any): 'Red' | 'Blue' | null {
  const wt = m.winning_team;
  if (wt === 'Red' || wt === 'Blue') return wt;
  if (wt === 'A' || wt === 'team_a') return 'Red';
  if (wt === 'B' || wt === 'team_b') return 'Blue';
  return null;
}

function getIndividualWinRate(player: string, matches: Match[]): { rate: number; wins: number; total: number } {
  let wins = 0;
  let total = 0;
  for (const m of matches) {
    const team = getPlayerTeam(m, player);
    if (!team) continue;
    const winner = getWinningTeam(m);
    if (!winner) continue;
    total++;
    if (team === winner) wins++;
  }
  return { rate: total ? (wins / total) * 100 : 50, wins, total };
}

function countLaneMatchups(p1: string, p2: string, lane: LineKey, matches: Match[]): number {
  let cnt = 0;
  for (const m of matches) {
    const a = (m.team_a?.[lane] || '').trim();
    const b = (m.team_b?.[lane] || '').trim();
    if ((a === p1.trim() && b === p2.trim()) || (a === p2.trim() && b === p1.trim())) cnt++;
  }
  return cnt;
}

function getLaneHeadToHead(
  p1: string,
  p2: string,
  lane: LineKey,
  matches: Match[]
): { p1Wins: number; p2Wins: number; total: number; p1Rate: number } {
  let p1Wins = 0;
  let p2Wins = 0;
  for (const m of matches) {
    const a = (m.team_a?.[lane] || '').trim();
    const b = (m.team_b?.[lane] || '').trim();
    const wt = getWinningTeam(m);
    if (!wt) continue;
    if (a === p1 && b === p2) {
      if (wt === 'Red') p1Wins++;
      else p2Wins++;
    } else if (a === p2 && b === p1) {
      if (wt === 'Red') p2Wins++;
      else p1Wins++;
    }
  }
  const total = p1Wins + p2Wins;
  return { p1Wins, p2Wins, total, p1Rate: total ? (p1Wins / total) * 100 : 50 };
}

function getSameTeamWinRate(p1: string, p2: string, matches: Match[]): number {
  let wins = 0;
  let total = 0;
  for (const m of matches) {
    const t1 = getPlayerTeam(m, p1);
    const t2 = getPlayerTeam(m, p2);
    if (!t1 || !t2 || t1 !== t2) continue;
    const winner = getWinningTeam(m);
    if (!winner) continue;
    total++;
    if (t1 === winner) wins++;
  }
  return total ? (wins / total) * 100 : 50;
}

// 맞라인 전적 기반 라인업 생성
function buildLaneCandidates(allStreamers: string[], matches: Match[], lane: LineKey) {
  const cands: { p1: string; p2: string; games: number }[] = [];
  const laneMains = allStreamers.filter((p) => getMainPosition(p, matches) === lane);
  const pool = laneMains.length >= 4 ? laneMains : allStreamers;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const games = countLaneMatchups(pool[i], pool[j], lane, matches);
      if (games > 0) cands.push({ p1: pool[i], p2: pool[j], games });
    }
  }
  cands.sort((a, b) => b.games - a.games);
  const top = cands.slice(0, 8);
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  return [...top, ...cands.slice(8)].slice(0, 20);
}

function findBalancedLineup(allStreamers: string[], matches: Match[]) {
  const byLane: Record<LineKey, { p1: string; p2: string; games: number }[]> = {
    top: buildLaneCandidates(allStreamers, matches, 'top'),
    jgl: buildLaneCandidates(allStreamers, matches, 'jgl'),
    mid: buildLaneCandidates(allStreamers, matches, 'mid'),
    adc: buildLaneCandidates(allStreamers, matches, 'adc'),
    sup: buildLaneCandidates(allStreamers, matches, 'sup'),
  };
  let best: { pairs: { lane: LineKey; p1: string; p2: string; games: number }[]; total: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const attemptBest = { pairs: [] as any[], total: -1 };
    function dfs(idx: number, used: Set<string>, cur: any[], total: number) {
      if (idx === LINE_KEYS.length) {
        if (total > attemptBest.total) {
          attemptBest.total = total;
          attemptBest.pairs = [...cur];
        }
        return;
      }
      const lane = LINE_KEYS[idx] as LineKey;
      const list = byLane[lane];
      if (list.length === 0) {
        dfs(idx + 1, used, cur, total);
        return;
      }
      const shuffled = [...list.slice(0, 6)].sort(() => Math.random() - 0.5);
      for (const c of shuffled) {
        if (used.has(c.p1) || used.has(c.p2)) continue;
        used.add(c.p1);
        used.add(c.p2);
        cur.push({ lane, p1: c.p1, p2: c.p2, games: c.games });
        dfs(idx + 1, used, cur, total + c.games + Math.random() * 2);
        cur.pop();
        used.delete(c.p1);
        used.delete(c.p2);
      }
    }
    dfs(0, new Set(), [], 0);
    if (!best || attemptBest.total > best.total) {
      best = { pairs: attemptBest.pairs, total: attemptBest.total };
    }
  }

  if (!best || best.pairs.length === 0) {
    const red: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
    const blue: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
    const used = new Set<string>();
    let pool = [...allStreamers].sort(() => Math.random() - 0.5);
    for (const lane of LINE_KEYS as LineKey[]) {
      const mains = pool.filter((p) => !used.has(p) && getMainPosition(p, matches) === lane);
      const picks = mains.length >= 2 ? mains.slice(0, 2) : pool.filter((p) => !used.has(p)).slice(0, 2);
      if (picks[0]) {
        red[lane] = picks[0];
        used.add(picks[0]);
        pool = pool.filter((p) => p !== picks[0]);
      }
      if (picks[1]) {
        blue[lane] = picks[1];
        used.add(picks[1]);
        pool = pool.filter((p) => p !== picks[1]);
      }
    }
    return { red, blue, totalGames: 0, pairs: [] as any[] };
  }

  const red: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
  const blue: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
  for (const { lane, p1, p2 } of best.pairs) {
    red[lane] = p1;
    blue[lane] = p2;
  }
  const used = new Set([...Object.values(red), ...Object.values(blue)].filter(Boolean));
  let remaining = allStreamers.filter((p) => !used.has(p)).sort(() => Math.random() - 0.5);
  for (const lane of LINE_KEYS as LineKey[]) {
    if (!red[lane]) {
      const idx = remaining.findIndex((p) => getMainPosition(p, matches) === lane);
      const pick = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift();
      if (pick) {
        red[lane] = pick;
        used.add(pick);
      }
    }
    if (!blue[lane]) {
      const idx = remaining.findIndex((p) => getMainPosition(p, matches) === lane);
      const pick = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift();
      if (pick) {
        blue[lane] = pick;
        used.add(pick);
      }
    }
  }
  return { red, blue, totalGames: best.total, pairs: best.pairs };
}

// 승률 계산: 개인 승률 + 맞라인 전적 + 같은팀 시너지
function calcTeamScores(red: TeamRoster, blue: TeamRoster, matches: Match[], stats?: any) {
  let redLaneScore = 0,
    blueLaneScore = 0,
    redIndiv = 0,
    blueIndiv = 0,
    redSynergy = 0,
    blueSynergy = 0;
  let laneGames = 0;

  for (const lane of LINE_KEYS as LineKey[]) {
    const r = red[lane],
      b = blue[lane];
    if (!r || !b) continue;
    const h2h = getLaneHeadToHead(r, b, lane, matches);
    if (h2h.total > 0) {
      redLaneScore += h2h.p1Rate;
      blueLaneScore += 100 - h2h.p1Rate;
      laneGames++;
    } else {
      const rRate = getIndividualWinRate(r, matches).rate;
      const bRate = getIndividualWinRate(b, matches).rate;
      redLaneScore += rRate > bRate ? 55 : 45;
      blueLaneScore += bRate > rRate ? 55 : 45;
      laneGames++;
    }
  }

  const redPlayers = Object.values(red).filter(Boolean);
  const bluePlayers = Object.values(blue).filter(Boolean);
  for (const p of redPlayers) {
    redIndiv += getIndividualWinRate(p, matches).rate;
  }
  for (const p of bluePlayers) {
    blueIndiv += getIndividualWinRate(p, matches).rate;
  }
  redIndiv = redPlayers.length ? redIndiv / redPlayers.length : 50;
  blueIndiv = bluePlayers.length ? blueIndiv / bluePlayers.length : 50;

  let rSyn = 0,
    rCnt = 0,
    bSyn = 0,
    bCnt = 0;
  for (let i = 0; i < redPlayers.length; i++) {
    for (let j = i + 1; j < redPlayers.length; j++) {
      rSyn += getSameTeamWinRate(redPlayers[i], redPlayers[j], matches);
      rCnt++;
    }
  }
  for (let i = 0; i < bluePlayers.length; i++) {
    for (let j = i + 1; j < bluePlayers.length; j++) {
      bSyn += getSameTeamWinRate(bluePlayers[i], bluePlayers[j], matches);
      bCnt++;
    }
  }
  redSynergy = rCnt ? rSyn / rCnt : 50;
  blueSynergy = bCnt ? bSyn / bCnt : 50;

  const rLaneAvg = laneGames ? redLaneScore / laneGames : 50;
  const bLaneAvg = laneGames ? blueLaneScore / laneGames : 50;

  // 최종 점수: 맞라인 50% + 개인 30% + 시너지 20%
  const redFinal = rLaneAvg * 0.5 + redIndiv * 0.3 + redSynergy * 0.2;
  const blueFinal = bLaneAvg * 0.5 + blueIndiv * 0.3 + blueSynergy * 0.2;

  const total = redFinal + blueFinal;
  const redWinRate = total ? (redFinal / total) * 100 : 50;
  const blueWinRate = total ? (blueFinal / total) * 100 : 50;

  return {
    red: redWinRate,
    blue: blueWinRate,
    detail: { redLane: rLaneAvg, blueLane: bLaneAvg, redIndiv, blueIndiv, redSynergy, blueSynergy, laneGames },
    redPlayers,
    bluePlayers,
  };
}

export const TeamSimulator: React.FC<TeamSimulatorProps> = ({
  stats,
  matches,
  allStreamers,
  onToast,
  onJumpToStreamer,
}) => {
  const [redTeam, setRedTeam] = useState<TeamRoster>({ top: '', jgl: '', mid: '', adc: '', sup: '' });
  const [blueTeam, setBlueTeam] = useState<TeamRoster>({ top: '', jgl: '', mid: '', adc: '', sup: '' });
  const [winRate, setWinRate] = useState<ReturnType<typeof calcTeamScores> | null>(null);
  const [showSynergyModal, setShowSynergyModal] = useState(false);
  const [synergyDetail, setSynergyDetail] = useState<any>(null);

  const playerMainPos = useMemo(() => {
    const m = new Map<string, LineKey>();
    for (const p of allStreamers) m.set(p, getMainPosition(p, matches));
    return m;
  }, [allStreamers, matches]);

  const isFull = useMemo(
    () => LINE_KEYS.every((k) => redTeam[k as LineKey] && blueTeam[k as LineKey]),
    [redTeam, blueTeam]
  );

  const handleFill = useCallback(() => {
    const result = findBalancedLineup(allStreamers, matches);
    setRedTeam(result.red);
    setBlueTeam(result.blue);
    setWinRate(null);
    onToast(
      `10인 자동 등록 완료! ${
        result.totalGames > 0 ? `맞라인 ${Math.round(result.totalGames)}판 전적` : '주포지션 기반'
      } - 최적 밸런스로 배치되었습니다.`
    );
  }, [allStreamers, matches, onToast]);

  const handleClear = useCallback(() => {
    setRedTeam({ top: '', jgl: '', mid: '', adc: '', sup: '' });
    setBlueTeam({ top: '', jgl: '', mid: '', adc: '', sup: '' });
    setWinRate(null);
    setSynergyDetail(null);
    setShowSynergyModal(false);
    onToast('팀 명단이 초기화되었습니다.');
  }, [onToast]);

  const handleAnalyze = useCallback(() => {
    if (!isFull) {
      onToast('10명의 라인별 선수가 모두 채워져야 분석이 가능합니다.');
      return;
    }
    const result = calcTeamScores(redTeam, blueTeam, matches, stats);
    setWinRate(result);
    setSynergyDetail(result);
    setShowSynergyModal(true);
    onToast(`시너지 분석 완료: Red ${result.red.toFixed(1)}% vs Blue ${result.blue.toFixed(1)}%`);
  }, [isFull, redTeam, blueTeam, matches, stats, onToast]);

  const handleOptimal = useCallback(() => {
    if (!isFull) {
      onToast('10명이 모두 채워져야 최적 재배치가 가능합니다.');
      return;
    }
    let best: any = null;
    let bestWoorimingWin = -1;
    let bestAvgSynergy = -1;
    const targetPlayer = '우리밍_';

    for (let mask = 0; mask < 1 << LINE_KEYS.length; mask++) {
      const red: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
      const blue: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
      for (let i = 0; i < LINE_KEYS.length; i++) {
        const p = LINE_KEYS[i] as LineKey;
        const a = redTeam[p],
          b = blueTeam[p];
        if ((mask & (1 << i)) === 0) {
          red[p] = a;
          blue[p] = b;
        } else {
          red[p] = b;
          blue[p] = a;
        }
      }
      const score = calcTeamScores(red, blue, matches, stats);

      const woorimingInRed = Object.values(red).some((v) => v.trim() === targetPlayer);
      const woorimingInBlue = Object.values(blue).some((v) => v.trim() === targetPlayer);
      if (!woorimingInRed && !woorimingInBlue) continue;

      const woorimingWin = woorimingInRed ? score.red : score.blue;
      const avgSynergy = (score.detail.redSynergy + score.detail.blueSynergy) / 2;

      if (
        woorimingWin > bestWoorimingWin ||
        (Math.abs(woorimingWin - bestWoorimingWin) < 0.01 && avgSynergy > bestAvgSynergy)
      ) {
        bestWoorimingWin = woorimingWin;
        bestAvgSynergy = avgSynergy;
        best = { red, blue, score, woorimingInRed, woorimingWin };
      }
    }
    if (best) {
      setRedTeam(best.red);
      setBlueTeam(best.blue);
      setWinRate(best.score);
      setSynergyDetail(best.score);
      setShowSynergyModal(true);
      const teamName = best.woorimingInRed ? 'Red' : 'Blue';
      onToast(`최적 재배치 완료! ${teamName}팀(우리밍_) ${best.woorimingWin.toFixed(1)}% - 최고 승률 조합`);
    } else {
      // 우리밍_이 명단에 없는 경우 전체 시너지 기준 재배치
      let bestGeneral: any = null;
      let minDiff = 999;
      for (let mask = 0; mask < 1 << LINE_KEYS.length; mask++) {
        const red: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
        const blue: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
        for (let i = 0; i < LINE_KEYS.length; i++) {
          const p = LINE_KEYS[i] as LineKey;
          const a = redTeam[p],
            b = blueTeam[p];
          if ((mask & (1 << i)) === 0) {
            red[p] = a;
            blue[p] = b;
          } else {
            red[p] = b;
            blue[p] = a;
          }
        }
        const score = calcTeamScores(red, blue, matches, stats);
        const diff = Math.abs(score.red - 50);
        if (diff < minDiff) {
          minDiff = diff;
          bestGeneral = { red, blue, score };
        }
      }
      if (bestGeneral) {
        setRedTeam(bestGeneral.red);
        setBlueTeam(bestGeneral.blue);
        setWinRate(bestGeneral.score);
        setSynergyDetail(bestGeneral.score);
        setShowSynergyModal(true);
        onToast(`밸런스 재배치 완료! Red ${bestGeneral.score.red.toFixed(1)}% vs Blue ${bestGeneral.score.blue.toFixed(1)}%`);
      }
    }
  }, [isFull, redTeam, blueTeam, matches, stats, onToast]);

  return (
    <div className="space-y-5">
      {/* 승률 기반 시너지팀 배너 */}
      <div className="bg-[#1e1b2e] border border-[#7c3aed]/40 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_24px_rgba(124,58,237,0.15)]">
        <div className="flex items-center gap-3 text-[13px] font-bold text-white">
          <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/20 border border-[#7c3aed]/40 flex items-center justify-center shrink-0 text-[#c4b5fd]">
            <Swords size={18} />
          </div>
          <div>
            <div className="text-[14px] font-black text-white flex items-center gap-2">
              <span>팀 시너지 시뮬레이터</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7c3aed]/30 text-[#c4b5fd] border border-[#7c3aed]/40">
                Red / Blue 10인 매치업
              </span>
            </div>
            <p className="text-[11px] text-[#a78bfa] font-medium mt-0.5">
              CK 10인 명단을 등록하면 맞라인 전적·개인 승률·팀 케미를 종합 계산하여 5:5 승률을 예측합니다.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="h-[32px] px-3.5 bg-[#12121a] hover:bg-[#1e1e2a] rounded-full text-[11px] font-bold text-[#c2c6d6] border border-[#2a2a3a] transition flex items-center gap-1.5"
          >
            <RotateCcw size={12} />
            <span>비우기</span>
          </button>
          <button
            type="button"
            onClick={handleFill}
            className="h-[32px] px-4 bg-[#7c3aed] hover:bg-[#6d28e0] border border-[#7c3aed] rounded-full text-[11px] font-bold text-white flex items-center gap-1.5 shadow-[0_0_12px_rgba(124,58,237,0.4)] transition active:scale-95"
          >
            <Sparkles size={13} />
            <span>선수 자동 채우기</span>
          </button>
        </div>
      </div>

      {/* 라인별 팀 입력 카드 */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 md:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#8b5cf6]" />
            <h3 className="text-[15px] font-black text-white">
              라인별 팀 명단 입력 <span className="text-[#8a8aa0] font-normal text-[12px]">(포지션별 1:1 매칭)</span>
            </h3>
          </div>
          <div className="text-[11px] text-[#8a8aa0]">
            채워진 선수:{' '}
            <b className="text-white">
              {Object.values(redTeam).filter(Boolean).length + Object.values(blueTeam).filter(Boolean).length}
            </b>
            /10명
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Red Team */}
          <div className="bg-[#1a1010]/60 border border-[#3a1e1e] rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#3a1e1e]/60">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-[0_0_10px_#ef4444]" />
                <span className="text-[13px] font-black text-[#f87171]">Red팀</span>
                <span className="text-[10px] text-[#9aa0b8]">(1픽 선공)</span>
              </div>
              {winRate && (
                <span className="text-[15px] font-black text-[#f87171]">{winRate.red.toFixed(1)}%</span>
              )}
            </div>

            <div className="space-y-2.5">
              {(LINE_KEYS as LineKey[]).map((pos) => (
                <div key={`red-${pos}`} className="flex items-center gap-2.5">
                  <div className="w-[42px] h-[36px] rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/30 text-[11px] font-black text-[#f87171] uppercase flex items-center justify-center shrink-0">
                    {pos}
                  </div>
                  <StreamerAvatar
                    name={redTeam[pos]}
                    size={32}
                    shape="circle"
                    className="border border-[#ef4444]/40 shrink-0"
                  />
                  <div className="flex-1 relative">
                    <input
                      list="team-sim-players"
                      value={redTeam[pos]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRedTeam((p) => ({ ...p, [pos]: val }));
                        setWinRate(null);
                      }}
                      placeholder="스트리머 이름 입력"
                      className="w-full h-[38px] bg-[#08080c] border border-[#2a1e1e] rounded-full px-4 text-[12px] text-white placeholder:text-[#6a6a80] focus:outline-none focus:border-[#ef4444]/80 transition-colors"
                    />
                    {redTeam[pos] && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] px-2 py-0.5 rounded-full bg-[#2a1e1e] text-[#c2c6d6] border border-[#3a2020] font-semibold">
                        주:{playerMainPos.get(redTeam[pos])?.toUpperCase() || '-'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blue Team */}
          <div className="bg-[#101a2a]/60 border border-[#1e2a4a] rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#1e2a4a]/60">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
                <span className="text-[13px] font-black text-[#60a5fa]">Blue팀</span>
                <span className="text-[10px] text-[#9aa0b8]">(2픽 후공)</span>
              </div>
              {winRate && (
                <span className="text-[15px] font-black text-[#60a5fa]">{winRate.blue.toFixed(1)}%</span>
              )}
            </div>

            <div className="space-y-2.5">
              {(LINE_KEYS as LineKey[]).map((pos) => (
                <div key={`blue-${pos}`} className="flex items-center gap-2.5">
                  <div className="w-[42px] h-[36px] rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[11px] font-black text-[#60a5fa] uppercase flex items-center justify-center shrink-0">
                    {pos}
                  </div>
                  <StreamerAvatar
                    name={blueTeam[pos]}
                    size={32}
                    shape="circle"
                    className="border border-[#3b82f6]/40 shrink-0"
                  />
                  <div className="flex-1 relative">
                    <input
                      list="team-sim-players"
                      value={blueTeam[pos]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBlueTeam((p) => ({ ...p, [pos]: val }));
                        setWinRate(null);
                      }}
                      placeholder="스트리머 이름 입력"
                      className="w-full h-[38px] bg-[#08080c] border border-[#1e2a4a] rounded-full px-4 text-[12px] text-white placeholder:text-[#6a6a80] focus:outline-none focus:border-[#3b82f6]/80 transition-colors"
                    />
                    {blueTeam[pos] && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] px-2 py-0.5 rounded-full bg-[#1e2a4a] text-[#c2c6d6] border border-[#203050] font-semibold">
                        주:{playerMainPos.get(blueTeam[pos])?.toUpperCase() || '-'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Win Rate Calculation Results */}
        {winRate ? (
          <div className="mt-5 bg-[#08080c] border border-[#1e1e2a] rounded-2xl p-4">
            <div className="flex items-center justify-between text-[13px] mb-2 font-bold">
              <div className="text-[#c2c6d6]">
                예측 승률: Red <b className="text-[#f87171]">{winRate.red.toFixed(1)}%</b> vs Blue{' '}
                <b className="text-[#60a5fa]">{winRate.blue.toFixed(1)}%</b>
              </div>
              <div className="text-[11px] text-[#9aa0b8] font-normal">
                맞라인 {winRate.detail.laneGames}라인 반영 • 개인 {winRate.detail.redIndiv.toFixed(0)}% vs{' '}
                {winRate.detail.blueIndiv.toFixed(0)}%
              </div>
            </div>
            <div className="w-full bg-[#1e1e2a] rounded-full h-3 overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#dc2626] to-[#ef4444] transition-all duration-300"
                style={{ width: `${winRate.red}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] transition-all duration-300"
                style={{ width: `${winRate.blue}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#8a8aa0] mt-2 font-medium">
              <span>
                Red: 맞라인 {winRate.detail.redLane.toFixed(0)}% • 개인 {winRate.detail.redIndiv.toFixed(0)}% • 시너지{' '}
                {winRate.detail.redSynergy.toFixed(0)}%
              </span>
              <span>
                Blue: 맞라인 {winRate.detail.blueLane.toFixed(0)}% • 개인 {winRate.detail.blueIndiv.toFixed(0)}% • 시너지{' '}
                {winRate.detail.blueSynergy.toFixed(0)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-[11px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-xl px-4 py-2.5 text-center font-medium">
            💡 10명의 라인별 선수를 모두 입력하면 1:1 맞라인 전적, 개인 승률, 같은 팀 시너지가 자동 계산됩니다.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!isFull}
            className={`flex-1 h-[44px] rounded-xl text-[12px] font-bold border transition flex items-center justify-center gap-2 ${
              isFull
                ? 'bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white border-[#2a2a3a] shadow-sm cursor-pointer'
                : 'bg-[#12121a] text-[#6a6a80] border-[#1e1e2a] cursor-not-allowed'
            }`}
          >
            <BarChart3 size={15} />
            <span>현재 팀 시너지 분석</span>
          </button>
          <button
            type="button"
            onClick={handleOptimal}
            disabled={!isFull}
            className={`flex-1 h-[44px] rounded-xl text-[12px] font-bold border transition flex items-center justify-center gap-2 ${
              isFull
                ? 'bg-[#7c3aed] hover:bg-[#6d28e0] text-white border-[#7c3aed] shadow-[0_0_15px_rgba(124,58,237,0.35)] cursor-pointer'
                : 'bg-[#12121a] text-[#6a6a80] border-[#1e1e2a] cursor-not-allowed'
            }`}
          >
            <Shuffle size={15} />
            <span>승률 기반 최적 팀으로 재배치</span>
          </button>
        </div>
      </div>

      {/* 시너지 분석 상세 모달 */}
      {showSynergyModal && synergyDetail && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.15s]"
          onClick={() => setShowSynergyModal(false)}
        >
          <div
            className="bg-[#12121a] border border-[#2a2a3a] rounded-[24px] max-w-[540px] w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1e1e2a] pb-3">
              <div className="flex items-center gap-2">
                <Swords size={18} className="text-[#8b5cf6]" />
                <h3 className="text-[16px] font-black text-white">팀 시너지 분석 상세 결과</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSynergyModal(false)}
                className="w-8 h-8 rounded-full bg-[#1e1e2a] hover:bg-[#2a2a3a] grid place-items-center text-[#c2c6d6] transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-[#1a1010] border border-[#3a1e1e] rounded-xl p-3.5 text-center">
                <div className="text-[11px] text-[#c2c6d6] font-medium">Red팀 예상 승률</div>
                <div className="text-[28px] font-black text-[#f87171] leading-tight my-1">
                  {synergyDetail.red.toFixed(1)}%
                </div>
                <div className="text-[10px] text-[#9aa0b8] leading-tight">
                  맞라인 {synergyDetail.detail.redLane.toFixed(0)}% • 개인 {synergyDetail.detail.redIndiv.toFixed(0)}%
                  <br />
                  시너지 {synergyDetail.detail.redSynergy.toFixed(0)}%
                </div>
              </div>
              <div className="bg-[#101a2a] border border-[#1e2a4a] rounded-xl p-3.5 text-center">
                <div className="text-[11px] text-[#c2c6d6] font-medium">Blue팀 예상 승률</div>
                <div className="text-[28px] font-black text-[#60a5fa] leading-tight my-1">
                  {synergyDetail.blue.toFixed(1)}%
                </div>
                <div className="text-[10px] text-[#9aa0b8] leading-tight">
                  맞라인 {synergyDetail.detail.blueLane.toFixed(0)}% • 개인 {synergyDetail.detail.blueIndiv.toFixed(0)}%
                  <br />
                  시너지 {synergyDetail.detail.blueSynergy.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 라인별 1:1 맞상대 분석 */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              <div className="text-[11px] font-bold text-[#8a8aa0] px-1">라인별 맞대결 전적</div>
              {LINE_KEYS.map((lane) => {
                const r = redTeam[lane as LineKey];
                const b = blueTeam[lane as LineKey];
                if (!r || !b) return null;
                const h2h = getLaneHeadToHead(r, b, lane as LineKey, matches);
                return (
                  <div
                    key={lane}
                    className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded-xl px-3.5 py-2.5 text-[11px]"
                  >
                    <span className="font-black text-[#8b5cf6] w-[35px] text-[10px] uppercase">{lane}</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <StreamerAvatar name={r} size={20} shape="circle" />
                      <span className="text-white font-bold truncate max-w-[80px]">{r}</span>
                    </div>
                    <div className="text-[10px] text-center px-2 shrink-0">
                      {h2h.total > 0 ? (
                        <span className="text-[#a78bfa] font-bold">
                          {h2h.p1Wins}승 {h2h.p2Wins}패 ({h2h.p1Rate.toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="text-[#64748b]">
                          {getIndividualWinRate(r, matches).rate.toFixed(0)}% vs{' '}
                          {getIndividualWinRate(b, matches).rate.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className="text-white font-bold truncate max-w-[80px] text-right">{b}</span>
                      <StreamerAvatar name={b} size={20} shape="circle" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSynergyModal(false)}
                className="flex-1 h-[42px] bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-xl text-[12px] font-bold text-white transition"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSynergyModal(false);
                  handleOptimal();
                }}
                className="flex-1 h-[42px] bg-[#7c3aed] hover:bg-[#6d28e0] rounded-xl text-[12px] font-bold text-white transition shadow-md"
              >
                최적 팀으로 재배치
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="team-sim-players">
        {allStreamers.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
};
