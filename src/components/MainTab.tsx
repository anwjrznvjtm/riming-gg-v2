import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Match,
  LineKey,
  LINE_KEYS,
  LINE_LABELS,
} from '../types';
import { ComputedStats, isMatchWonByWooriming, getWoorimingTeam, getWoorimingLineKey, parseKda, isWooriming, calculateLaneOpponentStats, normalizeStreamerName } from '../lib/stats';
import { getSeriesCumulativeScore } from '../lib/seriesScores';
import { OpggMatchCard } from './OpggMatchCard';
import { ChampionIcon } from './ChampionIcon';
import { StreamerAvatar } from './StreamerAvatar';
import { MatchEditModal } from './MatchEditModal';
import { DeleteMatchModal } from './DeleteMatchModal';
import {
  Search,
  Calendar,
  Filter,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  BarChart3,
  TrendingUp,
  Flame,
  Swords,
  X,
  Users,
  ExternalLink,
} from 'lucide-react';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
  allChampions: string[];
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
  onAddMatch: (m: Match) => void;
  onUpdateMatch: (m: Match) => void;
  onDeleteMatch: (id: string) => void;
  isAdmin: boolean;
  onAdminLoginSuccess: () => void;
  targetStreamer?: string;
  targetMatchId?: string;
  targetStreamerRole?: 'all' | 'ally' | 'enemy';
  jumpTimestamp?: number;
}

export const MainTab: React.FC<MainTabProps> = ({
  stats,
  matches,
  onOpenSummaryModal,
  onToast,
  allStreamers,
  allChampions,
  onJumpToStreamer,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  isAdmin,
  onAdminLoginSuccess,
  targetStreamer,
  targetMatchId,
  targetStreamerRole,
  jumpTimestamp,
}) => {
  // --- Filter states for Right Main Area ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<'ALL' | LineKey>('ALL');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [selectedChampFilter, setSelectedChampFilter] = useState<string>('');
  const [selectedStreamerFilter, setSelectedStreamerFilter] = useState<string>('');
  const [streamerRoleFilter, setStreamerRoleFilter] = useState<'all' | 'ally' | 'enemy'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isAllChampsModalOpen, setIsAllChampsModalOpen] = useState(false);
  const [allChampsModalRole, setAllChampsModalRole] = useState<'adc' | 'sup' | 'all'>('adc');
  const [laneOpponentRole, setLaneOpponentRole] = useState<'adc' | 'sup'>('adc');

  // Jump to streamer effect from external triggers
  useEffect(() => {
    if (targetStreamer) {
      setSelectedStreamerFilter(targetStreamer);
      if (targetStreamerRole) {
        setStreamerRoleFilter(targetStreamerRole);
      }
    }
    if (targetMatchId) {
      setTimeout(() => {
        const el = document.getElementById(`match-${targetMatchId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  }, [targetStreamer, targetMatchId, targetStreamerRole, jumpTimestamp]);

  // --- 1. '최근 30일' CK 통계 (오직 CK 데이터 기반) ---
  const recent30Stats = useMemo(() => {
    if (!matches || matches.length === 0) {
      return {
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgKills: '0.0',
        avgDeaths: '0.0',
        avgAssists: '0.0',
        kdaRatio: '0.00',
        kpPct: 0,
        lineDistribution: { adc: 0, sup: 0, mid: 0, top: 0, jgl: 0 },
      };
    }

    // Determine the reference date: latest match date in the CK dataset
    let latestTimestamp = 0;
    for (const m of matches) {
      const ts = new Date(m.date).getTime();
      if (!isNaN(ts) && ts > latestTimestamp) {
        latestTimestamp = ts;
      }
    }
    const referenceDate = latestTimestamp > 0 ? new Date(latestTimestamp) : new Date();
    const thirtyDaysPrior = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentMatches = matches.filter((m) => {
      const mDate = new Date(m.date);
      return !isNaN(mDate.getTime()) && mDate >= thirtyDaysPrior;
    });

    const activeList = recentMatches.length > 0 ? recentMatches : matches;

    let wins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalTeamKills = 0;
    const lineDistribution: Record<LineKey, number> = { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 };

    for (const m of activeList) {
      const won = isMatchWonByWooriming(m);
      if (won) wins++;

      const isWRed = getWoorimingTeam(m) === 'Red';
      const wLineKey = getWoorimingLineKey(m);
      lineDistribution[wLineKey]++;

      const myKdas = isWRed ? m.team_a_kda : m.team_b_kda;
      const kdaStr = myKdas?.[wLineKey] || '0/0/0';
      const { k, d, a } = parseKda(kdaStr);

      totalKills += k;
      totalDeaths += d;
      totalAssists += a;

      // Team kills
      LINE_KEYS.forEach((lk) => {
        const pk = (myKdas?.[lk] || '').split('/');
        if (pk.length >= 1) totalTeamKills += parseInt(pk[0], 10) || 0;
      });
    }

    const total = activeList.length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const avgKills = total > 0 ? (totalKills / total).toFixed(1) : '0.0';
    const avgDeaths = total > 0 ? (totalDeaths / total).toFixed(1) : '0.0';
    const avgAssists = total > 0 ? (totalAssists / total).toFixed(1) : '0.0';
    const kdaRatio =
      totalDeaths === 0
        ? 'Perfect'
        : ((totalKills + totalAssists) / Math.max(1, totalDeaths)).toFixed(2);
    const kpPct =
      totalTeamKills > 0
        ? Math.min(100, Math.round(((totalKills + totalAssists) / totalTeamKills) * 100))
        : 0;

    return {
      total,
      wins,
      losses,
      winRate,
      avgKills,
      avgDeaths,
      avgAssists,
      kdaRatio,
      kpPct,
      lineDistribution,
    };
  }, [matches]);

  // --- 2. '모스트 챔피언' CK 통계 (포지션별 집계: 원딜 / 서포터 / 전체) ---
  const getChampionStatsForLine = (targetLine?: 'adc' | 'sup' | 'all') => {
    const champMap = new Map<
      string,
      {
        name: string;
        games: number;
        wins: number;
        losses: number;
        kills: number;
        deaths: number;
        assists: number;
      }
    >();

    for (const m of matches) {
      const isWRed = getWoorimingTeam(m) === 'Red';
      const wLineKey = getWoorimingLineKey(m);

      if (targetLine && targetLine !== 'all' && wLineKey !== targetLine) {
        continue;
      }

      const myChamps = isWRed ? m.team_a_champs : m.team_b_champs;
      const myKdas = isWRed ? m.team_a_kda : m.team_b_kda;

      const champName = (myChamps?.[wLineKey] || '').trim();
      if (!champName) continue;

      const won = isMatchWonByWooriming(m);
      const { k, d, a } = parseKda(myKdas?.[wLineKey] || '0/0/0');

      if (!champMap.has(champName)) {
        champMap.set(champName, {
          name: champName,
          games: 0,
          wins: 0,
          losses: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
        });
      }

      const entry = champMap.get(champName)!;
      entry.games++;
      if (won) entry.wins++;
      else entry.losses++;
      entry.kills += k;
      entry.deaths += d;
      entry.assists += a;
    }

    return Array.from(champMap.values())
      .map((c) => {
        const winRate = c.games > 0 ? Math.round((c.wins / c.games) * 100) : 0;
        const avgK = (c.kills / c.games).toFixed(1);
        const avgD = (c.deaths / c.games).toFixed(1);
        const avgA = (c.assists / c.games).toFixed(1);
        const ratio =
          c.deaths === 0
            ? 'Perfect'
            : ((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(2);

        return {
          ...c,
          winRate,
          avgK,
          avgD,
          avgA,
          ratio,
        };
      })
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });
  };

  const adcChampions = useMemo(() => getChampionStatsForLine('adc'), [matches]);
  const supChampions = useMemo(() => getChampionStatsForLine('sup'), [matches]);
  const allChampionsList = useMemo(() => getChampionStatsForLine('all'), [matches]);

  const modalChampionsList = useMemo(() => {
    if (allChampsModalRole === 'adc') return adcChampions;
    if (allChampsModalRole === 'sup') return supChampions;
    return allChampionsList;
  }, [allChampsModalRole, adcChampions, supChampions, allChampionsList]);

  // --- 2-2. '맞라인 상대 승률' 통계 (CK 경기 데이터 기반 포지션별 100% 정밀 집계) ---
  const adcOpponents = useMemo(() => calculateLaneOpponentStats(matches, 'adc'), [matches]);
  const supOpponents = useMemo(() => calculateLaneOpponentStats(matches, 'sup'), [matches]);
  const currentOpponents = laneOpponentRole === 'adc' ? adcOpponents : supOpponents;

  // Overall CK Lifetime Statistics for Top Profile Card
  const lifetimeStats = useMemo(() => {
    let wins = 0;
    for (const m of matches) {
      if (isMatchWonByWooriming(m)) wins++;
    }
    const total = matches.length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, wins, losses, winRate };
  }, [matches]);

  // --- 3. Filtered Matches (Right Main OP.GG Match History) ---
  const filteredMatches = useMemo(() => {
    let list = [...matches];

    // Search query with streamer normalization support
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qNorm = normalizeStreamerName(q).toLowerCase();

      list = list.filter((m) => {
        const ckMatch = (m.ck_name || '').toLowerCase().includes(q);
        const rawPlayers = [
          ...Object.values(m.team_a || {}),
          ...Object.values(m.team_b || {}),
        ];
        const playerMatch = rawPlayers.some((p) => {
          if (!p) return false;
          const pLower = String(p).toLowerCase();
          if (pLower.includes(q)) return true;
          const pNorm = normalizeStreamerName(String(p)).toLowerCase();
          return pNorm.includes(q) || (qNorm && pNorm.includes(qNorm));
        });
        return ckMatch || playerMatch;
      });
    }

    // Line filter
    if (selectedLine !== 'ALL') {
      list = list.filter((m) => getWoorimingLineKey(m) === selectedLine);
    }

    // Result filter
    if (resultFilter === 'WIN') {
      list = list.filter((m) => isMatchWonByWooriming(m));
    } else if (resultFilter === 'LOSS') {
      list = list.filter((m) => !isMatchWonByWooriming(m));
    }

    // Champion filter
    if (selectedChampFilter) {
      list = list.filter((m) => {
        const isWRed = getWoorimingTeam(m) === 'Red';
        const wLine = getWoorimingLineKey(m);
        const champ = (isWRed ? m.team_a_champs : m.team_b_champs)?.[wLine] || '';
        return champ === selectedChampFilter;
      });
    }

    // Date filter
    if (dateFilter) {
      list = list.filter((m) => m.date === dateFilter);
    }

    // Streamer filter
    if (selectedStreamerFilter) {
      const st = selectedStreamerFilter.trim();
      list = list.filter((m) => {
        const isWRed = getWoorimingTeam(m) === 'Red';
        const allyRoster = isWRed ? Object.values(m.team_a || {}) : Object.values(m.team_b || {});
        const enemyRoster = isWRed ? Object.values(m.team_b || {}) : Object.values(m.team_a || {});

        if (streamerRoleFilter === 'ally') {
          return allyRoster.includes(st) && !isWooriming(st);
        }
        if (streamerRoleFilter === 'enemy') {
          return enemyRoster.includes(st);
        }
        return allyRoster.includes(st) || enemyRoster.includes(st);
      });
    }

    // Sort descending by date, then set_number
    list.sort((a, b) => {
      const dDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dDiff !== 0) return dDiff;
      const setA = Number(a.set_number) || 1;
      const setB = Number(b.set_number) || 1;
      return setB - setA;
    });

    return list;
  }, [
    matches,
    searchQuery,
    selectedLine,
    resultFilter,
    selectedChampFilter,
    dateFilter,
    selectedStreamerFilter,
    streamerRoleFilter,
  ]);

  // Filtered Summary Stats
  const filteredSummary = useMemo(() => {
    let wins = 0;
    for (const m of filteredMatches) {
      if (isMatchWonByWooriming(m)) wins++;
    }
    const total = filteredMatches.length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, wins, losses, winRate };
  }, [filteredMatches]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedLine('ALL');
    setResultFilter('ALL');
    setSelectedChampFilter('');
    setSelectedStreamerFilter('');
    setStreamerRoleFilter('all');
    setDateFilter('');
    onToast('모든 검색 필터가 초기화되었습니다.');
  };

  const handleOpenAddModal = () => {
    setEditingMatch(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (m: Match) => {
    setEditingMatch(m);
    setIsEditModalOpen(true);
  };

  return (
    <div className="w-full space-y-5 animate-[fadeIn_0.2s]">
      {/* 2-Column Responsive Layout: Left 310px (Sticky) + Right Flex-1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: '최근 30일' & '모스트 챔피언' (오직 CK 전용) */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          
          {/* 우리밍_ 프로필 카드 */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#8b5cf6]/15 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <a
                href="https://www.sooplive.com/station/kmj05317"
                target="_blank"
                rel="noopener noreferrer"
                title="SOOP 우리밍 방송국 바로가기 (새 창)"
                className="relative block group shrink-0 cursor-pointer"
              >
                <img
                  src="https://profile.img.sooplive.co.kr/LOGO/km/kmj05317/kmj05317.jpg"
                  alt="우리밍_ SOOP 방송국"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (!target.dataset.triedStimg) {
                      target.dataset.triedStimg = 'true';
                      target.src = 'https://stimg.sooplive.co.kr/LOGO/km/kmj05317/kmj05317.jpg';
                    } else {
                      target.src =
                        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/548.jpg';
                    }
                  }}
                  className="w-[88px] h-[88px] rounded-full border-[2.5px] border-[#8b5cf6] object-cover shadow-lg ring-4 ring-[#8b5cf6]/20 group-hover:scale-105 group-hover:border-[#a78bfa] group-hover:ring-[#8b5cf6]/40 transition-all duration-200"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white text-[11.5px] font-black px-2.5 py-0.5 rounded-full border-2 border-[#12121a] shadow-md group-hover:from-[#7c3aed] group-hover:to-[#6d28d9] transition">
                  원딜
                </span>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 pointer-events-none">
                  <ExternalLink size={20} className="text-white drop-shadow" />
                </div>
              </a>

              <div className="min-w-0 flex-1">
                <div>
                  <h2 className="text-[24px] font-black text-white tracking-tight leading-none">우리밍_</h2>
                </div>
                
                <div className="text-[14px] text-white font-semibold mt-2 leading-snug">
                  총 {lifetimeStats.total}전 {lifetimeStats.wins}승 {lifetimeStats.losses}패{' '}
                  <span className="text-[#a78bfa] font-black text-[15.5px]">({lifetimeStats.winRate}%)</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button: 새 경기 등록 */}
            <div className="mt-4 pt-3.5 border-t border-[#1e1e2a] flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="w-full h-[40px] bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white rounded-xl text-[13px] font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>+ 새 CK 경기 등록</span>
              </button>
            </div>
          </div>

          {/* 1. '최근 30일' CK 통계 카드 (오직 CK 데이터 기반 / 큐타입 드롭다운 없음) */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Calendar size={15} className="text-[#8b5cf6]" />
                <h3 className="font-black text-[13px] text-white tracking-tight">최근 30일 CK 통계</h3>
              </div>
              <span className="text-[10px] text-[#8e8ea0] font-medium bg-[#1e1e2a] px-2 py-0.5 rounded-full">
                {recent30Stats.total}게임 기준
              </span>
            </div>

            {recent30Stats.total > 0 ? (
              <div className="space-y-3.5">
                {/* Winrate Donut & Summary Row */}
                <div className="flex items-center gap-4 bg-[#0a0a12] p-3 rounded-xl border border-white/5">
                  {/* SVG Circle Gauge */}
                  <div className="relative w-16 h-16 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#222230" strokeWidth="10" />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 * (1 - recent30Stats.winRate / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[13px] font-black text-white">{recent30Stats.winRate}%</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#8e8ea8]">
                      {recent30Stats.total}전 {recent30Stats.wins}승 {recent30Stats.losses}패
                    </div>
                    <div className="text-[14px] font-black text-white mt-0.5">
                      {recent30Stats.avgKills} / <span className="text-[#f87171]">{recent30Stats.avgDeaths}</span> /{' '}
                      <span className="text-[#60a5fa]">{recent30Stats.avgAssists}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] mt-0.5">
                      <span className="text-[#a78bfa] font-extrabold">
                        {recent30Stats.kdaRatio === 'Perfect' ? 'Perfect' : `${recent30Stats.kdaRatio}:1`}
                      </span>
                      {recent30Stats.kpPct > 0 && (
                        <span className="text-[#f43f5e] font-semibold text-[10px]">
                          킬관여 {recent30Stats.kpPct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preferred Positions (Simplified to ADC & SUP only) */}
                <div>
                  <div className="text-[10.5px] font-semibold text-[#8a8aa0] mb-2 flex items-center justify-between">
                    <span>선호 포지션 (CK)</span>
                    <span className="text-[10px] text-[#c4b5fd] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 px-1.5 py-0.5 rounded font-bold">
                      주: 원딜 · 부: 서폿
                    </span>
                  </div>

                  {(() => {
                    const adcCount = recent30Stats.lineDistribution.adc || 0;
                    const supCount = recent30Stats.lineDistribution.sup || 0;
                    const totalG = recent30Stats.total || 0;
                    const adcPct = totalG > 0 ? Math.round((adcCount / totalG) * 100) : 0;
                    const supPct = totalG > 0 ? Math.round((supCount / totalG) * 100) : 0;

                    return (
                      <div className="space-y-2">
                        {/* Dual Cards */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* ADC Card (Primary) */}
                          <div className="p-2.5 rounded-xl border bg-[#8b5cf6]/10 border-[#8b5cf6]/40 text-[#c4b5fd] flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-black tracking-tight text-white flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                                원딜 (ADC)
                              </span>
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#8b5cf6] text-white">
                                주 포지션
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="text-[16px] font-black text-white">{adcPct}%</span>
                              <span className="text-[10.5px] text-[#a0a0ba] font-medium">{adcCount}게임</span>
                            </div>
                          </div>

                          {/* SUP Card (Sub) */}
                          <div className="p-2.5 rounded-xl border bg-[#06b6d4]/10 border-[#06b6d4]/30 text-[#67e8f9] flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-black tracking-tight text-white flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" />
                                서폿 (SUP)
                              </span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#06b6d4]/20 text-[#67e8f9] border border-[#06b6d4]/30">
                                서브
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="text-[16px] font-black text-white">{supPct}%</span>
                              <span className="text-[10.5px] text-[#a0a0ba] font-medium">{supCount}게임</span>
                            </div>
                          </div>
                        </div>

                        {/* Ratio Progress Bar */}
                        <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden flex p-0.5 border border-white/5">
                          <div
                            style={{ width: `${adcPct}%` }}
                            className="bg-[#8b5cf6] h-full rounded-full transition-all duration-300"
                            title={`원딜: ${adcPct}%`}
                          />
                          <div
                            style={{ width: `${supPct}%` }}
                            className="bg-[#06b6d4] h-full rounded-full transition-all duration-300 ml-0.5"
                            title={`서폿: ${supPct}%`}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-[12px] text-[#6b6b80]">
                최근 30일 내 진행된 CK 경기가 없습니다.
              </div>
            )}
          </div>

          {/* 2. '모스트 챔피언' CK 통계 카드 (오직 CK 데이터 기반 - 원딜 포지션 상위 5개) */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Flame size={15} className="text-[#fbbf24]" />
                <h3 className="font-black text-[13px] text-white tracking-tight">모스트 챔피언 (CK)</h3>
                <span className="text-[10px] font-bold text-[#a78bfa] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 px-1.5 py-0.5 rounded">
                  원딜
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAllChampsModalRole('adc');
                  setIsAllChampsModalOpen(true);
                }}
                className="text-[10.5px] text-[#a78bfa] hover:underline font-semibold"
              >
                전체보기 ({adcChampions.length})
              </button>
            </div>

            {adcChampions.length > 0 ? (
              <div className="space-y-2">
                {adcChampions.slice(0, 5).map((c) => {
                  const isFiltered = selectedChampFilter === c.name;

                  return (
                    <div
                      key={c.name}
                      onClick={() => setSelectedChampFilter((prev) => (prev === c.name ? '' : c.name))}
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                        isFiltered
                          ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] shadow-sm'
                          : 'bg-[#0a0a12] border-white/5 hover:border-white/15 hover:bg-[#151522]'
                      }`}
                      title={`${c.name} 전적으로 필터링`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChampionIcon
                          name={c.name}
                          size={32}
                          shape="square"
                          className="rounded-lg shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-white truncate flex items-center gap-1">
                            <span>{c.name}</span>
                            {isFiltered && (
                              <span className="text-[9px] bg-[#8b5cf6] text-white px-1 rounded">필터중</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#7a7a92]">
                            {c.avgK} / <span className="text-[#f87171]">{c.avgD}</span> /{' '}
                            <span className="text-[#60a5fa]">{c.avgA}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-[12px] font-black ${
                            c.winRate >= 60
                              ? 'text-[#f87171]'
                              : c.winRate >= 50
                              ? 'text-[#60a5fa]'
                              : 'text-[#9090a8]'
                          }`}
                        >
                          {c.winRate}%
                        </div>
                        <div className="text-[10px] text-[#787890]">
                          {c.games}게임 ({c.wins}승 {c.losses}패)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-[12px] text-[#6b6b80]">
                플레이한 원딜 CK 챔피언 데이터가 없습니다.
              </div>
            )}
          </div>

          {/* 3. '맞라인 상대 승률' 카드 */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Swords size={15} className="text-[#a78bfa] shrink-0" />
                <h3 className="font-black text-[13px] text-white tracking-tight truncate">맞라인 상대 승률</h3>
              </div>

              {/* 포지션 전환 토글: [원딜 (ADC)] / [서폿 (SUP)] */}
              <div className="flex items-center bg-[#0a0a12] p-0.5 rounded-lg border border-white/5 shrink-0">
                <button
                  type="button"
                  onClick={() => setLaneOpponentRole('adc')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition ${
                    laneOpponentRole === 'adc'
                      ? 'bg-[#8b5cf6] text-white shadow-sm'
                      : 'text-[#8e8ea8] hover:text-white'
                  }`}
                >
                  원딜 (ADC)
                </button>
                <button
                  type="button"
                  onClick={() => setLaneOpponentRole('sup')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition ${
                    laneOpponentRole === 'sup'
                      ? 'bg-[#06b6d4] text-white shadow-sm'
                      : 'text-[#8e8ea8] hover:text-white'
                  }`}
                >
                  서폿 (SUP)
                </button>
              </div>
            </div>

            {currentOpponents.length > 0 ? (
              <div className="space-y-2">
                {currentOpponents.slice(0, 5).map((item, idx) => {
                  const isFiltered =
                    (searchQuery.trim() === item.name || selectedStreamerFilter === item.name) &&
                    (selectedLine === 'ALL' || selectedLine === laneOpponentRole);

                  return (
                    <div
                      key={item.name}
                      onClick={() => {
                        if (searchQuery.trim() === item.name && selectedLine === laneOpponentRole) {
                          setSearchQuery('');
                          setSelectedLine('ALL');
                          onToast(`맞라인 상대 필터가 해제되었습니다.`);
                        } else {
                          setSearchQuery(item.name);
                          setSelectedLine(laneOpponentRole);
                          onToast(
                            `'${item.name}' 선수와의 ${
                              laneOpponentRole === 'adc' ? '원딜(ADC)' : '서폿(SUP)'
                            } 맞라인 전적으로 필터링되었습니다.`
                          );
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                        isFiltered
                          ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] shadow-sm ring-1 ring-[#8b5cf6]/50'
                          : 'bg-[#0a0a12] border-white/5 hover:border-white/15 hover:bg-[#151522]'
                      }`}
                      title={`클릭 시 '${item.name}' 선수와의 ${
                        laneOpponentRole === 'adc' ? '원딜' : '서폿'
                      } 맞라인 경기만 필터링 (다시 클릭하면 해제)`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 순위 (1~5) */}
                        <span
                          className={`text-[11px] font-black w-4 text-center shrink-0 ${
                            idx === 0
                              ? 'text-[#fbbf24]'
                              : idx === 1
                              ? 'text-[#e2e8f0]'
                              : idx === 2
                              ? 'text-[#cd7f32]'
                              : 'text-[#6b6b80]'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <StreamerAvatar name={item.name} size={28} shape="circle" className="shrink-0" />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold text-white truncate">{item.name}</span>
                            {/* 포지션 태그 */}
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                laneOpponentRole === 'adc'
                                  ? 'text-[#a78bfa] bg-[#8b5cf6]/15 border-[#8b5cf6]/30'
                                  : 'text-[#22d3ee] bg-[#06b6d4]/15 border-[#06b6d4]/30'
                              }`}
                            >
                              {laneOpponentRole === 'adc' ? '원딜' : '서폿'}
                            </span>
                          </div>
                          {/* 판수 (전/승/패) */}
                          <div className="text-[10px] text-[#787890]">
                            {item.games}전 {item.wins}승 {item.losses}패
                          </div>
                        </div>
                      </div>

                      {/* 승률 (%) 배지 */}
                      <div className="text-right shrink-0">
                        <span
                          className={`text-[11.5px] font-black px-2 py-0.5 rounded-md inline-block border ${
                            item.winRate >= 60
                              ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/30'
                              : item.winRate >= 50
                              ? 'bg-[#8b5cf6]/20 text-[#c4b5fd] border-[#8b5cf6]/30'
                              : 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/30'
                          }`}
                        >
                          {item.winRate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-[12px] text-[#6b6b80]">
                기록된 {laneOpponentRole === 'adc' ? '원딜' : '서폿'} 맞라인 상대 데이터가 없습니다.
              </div>
            )}
          </div>

        </div>

        {/* ======================================================== */}
        {/* RIGHT MAIN COLUMN: OP.GG Match History (CK Matches Only) */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-3.5">
          
          {/* OP.GG Top Filter & Search Bar */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-3.5 shadow-lg space-y-3">
            
            {/* Row 1: Line Chips & Search & Add Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Line Filter Chips: Only 전체, ADC, SUP */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'adc', 'sup'] as const).map((line) => {
                  const isActive = selectedLine === line;
                  const label = line === 'ALL' ? '전체' : LINE_LABELS[line];

                  return (
                    <button
                      key={line}
                      type="button"
                      onClick={() => setSelectedLine(line)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                        isActive
                          ? 'bg-[#8b5cf6] text-white shadow-sm'
                          : 'bg-[#181824] text-[#8e8ea8] hover:text-white hover:bg-[#222234]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative flex-1 max-w-xs sm:ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b80]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="CK명 또는 플레이어 검색"
                  className="w-full h-[34px] bg-[#0a0a12] border border-[#222232] rounded-xl pl-9 pr-3 text-[11px] text-white placeholder:text-[#5a5a6e] focus:outline-none focus:border-[#8b5cf6]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b6b80] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Result Filter, Streamer Filter, Date Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a1a26]">
              <div className="flex flex-wrap items-center gap-2">
                {/* Result Filter Tabs: ALL, WIN, LOSS */}
                <div className="inline-flex rounded-lg bg-[#0a0a12] p-0.5 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setResultFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      resultFilter === 'ALL' ? 'bg-[#222232] text-white' : 'text-[#8a8aa0] hover:text-white'
                    }`}
                  >
                    전체 결과
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultFilter('WIN')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      resultFilter === 'WIN' ? 'bg-[#1e3455] text-[#60a5fa]' : 'text-[#8a8aa0] hover:text-white'
                    }`}
                  >
                    승리만
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultFilter('LOSS')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      resultFilter === 'LOSS' ? 'bg-[#3b1920] text-[#f87171]' : 'text-[#8a8aa0] hover:text-white'
                    }`}
                  >
                    패배만
                  </button>
                </div>

                {/* Streamer Dropdown Filter */}
                <div className="flex items-center gap-1">
                  <select
                    value={selectedStreamerFilter}
                    onChange={(e) => setSelectedStreamerFilter(e.target.value)}
                    className="h-[30px] bg-[#0a0a12] border border-[#222232] rounded-lg px-2 text-[11px] text-[#c0c0d0] focus:outline-none focus:border-[#8b5cf6]"
                  >
                    <option value="">모든 스트리머</option>
                    {allStreamers
                      .filter((s) => !isWooriming(s))
                      .map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                  </select>

                  {selectedStreamerFilter && (
                    <div className="inline-flex rounded-lg bg-[#0a0a12] p-0.5 border border-white/5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setStreamerRoleFilter('all')}
                        className={`px-1.5 py-0.5 rounded ${
                          streamerRoleFilter === 'all' ? 'bg-[#222232] text-white font-bold' : 'text-[#8a8aa0]'
                        }`}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        onClick={() => setStreamerRoleFilter('ally')}
                        className={`px-1.5 py-0.5 rounded ${
                          streamerRoleFilter === 'ally' ? 'bg-[#3b82f6]/20 text-[#60a5fa] font-bold' : 'text-[#8a8aa0]'
                        }`}
                      >
                        아군
                      </button>
                      <button
                        type="button"
                        onClick={() => setStreamerRoleFilter('enemy')}
                        className={`px-1.5 py-0.5 rounded ${
                          streamerRoleFilter === 'enemy' ? 'bg-[#ef4444]/20 text-[#f87171] font-bold' : 'text-[#8a8aa0]'
                        }`}
                      >
                        적팀
                      </button>
                    </div>
                  )}
                </div>

                {/* Champion Tag if active */}
                {selectedChampFilter && (
                  <div className="inline-flex items-center gap-1.5 bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c4b5fd] px-2.5 py-0.5 rounded-lg text-[11px]">
                    <span>챔피언: <b>{selectedChampFilter}</b></span>
                    <button
                      type="button"
                      onClick={() => setSelectedChampFilter('')}
                      className="hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Reset Filters button */}
                {(searchQuery ||
                  selectedLine !== 'ALL' ||
                  resultFilter !== 'ALL' ||
                  selectedChampFilter ||
                  selectedStreamerFilter ||
                  dateFilter) && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="h-[30px] px-2.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#a0a0ba] hover:text-white rounded-lg text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <RotateCcw size={11} />
                    <span>초기화</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Result Status Bar */}
            <div className="flex items-center justify-between text-[11px] text-[#8e8ea8] pt-1">
              <div>
                검색된 경기: <b className="text-white">{filteredSummary.total}</b>경기 (
                <span className="text-[#60a5fa] font-bold">{filteredSummary.wins}승</span>{' '}
                <span className="text-[#f87171] font-bold">{filteredSummary.losses}패</span> · 승률{' '}
                <span className="text-[#8b5cf6] font-extrabold">{filteredSummary.winRate}%</span>)
              </div>
            </div>
          </div>

          {/* OP.GG Match Cards List */}
          {filteredMatches.length > 0 ? (
            <div className="space-y-2.5">
              {filteredMatches.map((m) => {
                const scoreText = getSeriesCumulativeScore(m, matches);

                return (
                  <OpggMatchCard
                    key={m.id}
                    match={m}
                    scoreText={scoreText}
                    onEdit={handleOpenEditModal}
                    onDelete={(id) => setDeleteTargetId(id)}
                    onJumpToStreamer={onJumpToStreamer}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-12 text-center shadow-lg">
              <div className="w-12 h-12 rounded-full bg-[#1e1e2a] flex items-center justify-center mx-auto mb-3 text-[#8a8aa0]">
                <Filter size={20} />
              </div>
              <h4 className="text-[15px] font-bold text-white mb-1">일치하는 CK 경기가 없습니다.</h4>
              <p className="text-[12px] text-[#7a7a90] mb-4">
                선택하신 조건에 해당하는 경기 기록이 없습니다. 검색 필터를 재설정해보세요.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl text-[12px] font-bold transition"
              >
                필터 전체 초기화
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}
      {/* 1. Add / Edit Match Modal */}
      {isEditModalOpen && (
        <MatchEditModal
          isOpen={isEditModalOpen}
          editingMatch={editingMatch}
          allMatches={matches}
          isAdmin={isAdmin}
          onClose={() => setIsEditModalOpen(false)}
          onAddMatch={onAddMatch}
          onUpdateMatch={onUpdateMatch}
          onAdminLoginSuccess={onAdminLoginSuccess}
          onToast={onToast}
          allStreamers={allStreamers}
          allChampions={allChampions}
        />
      )}

      {/* 2. Delete Match Modal */}
      {!!deleteTargetId && (
        <DeleteMatchModal
          isOpen={!!deleteTargetId}
          matchId={deleteTargetId}
          isAdmin={isAdmin}
          onClose={() => setDeleteTargetId(null)}
          onConfirmDelete={(id) => {
            onDeleteMatch(id);
            setDeleteTargetId(null);
          }}
          onToast={onToast}
        />
      )}

      {/* 3. All Champions Modal with Role Toggle (원딜 / 서포터 / 전체) */}
      {isAllChampsModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]"
          onClick={() => setIsAllChampsModalOpen(false)}
        >
          <div
            className="relative z-[10000] w-full max-w-[620px] bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-5 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-[#1e1e2a]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Flame size={18} className="text-[#fbbf24]" />
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-white flex items-center gap-2">
                    <span>전체 CK 챔피언 전적</span>
                    <span className="text-[12px] text-[#a78bfa] font-semibold">
                      ({modalChampionsList.length}개)
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#717188]">
                    포지션별 챔피언 승률, 판수 및 상세 KDA 전적
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllChampsModalOpen(false)}
                className="w-8 h-8 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* Position Toggle Buttons: [원딜] / [서포터] / [전체] */}
            <div className="flex items-center gap-1.5 pt-3 pb-2">
              <button
                type="button"
                onClick={() => setAllChampsModalRole('adc')}
                className={`flex-1 py-2 px-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition ${
                  allChampsModalRole === 'adc'
                    ? 'bg-[#8b5cf6] text-white shadow-md shadow-[#8b5cf6]/20'
                    : 'bg-[#181824] text-[#8e8ea8] hover:text-white hover:bg-[#222234] border border-white/5'
                }`}
              >
                <span>🏹 원딜 (ADC)</span>
                <span className="text-[10.5px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
                  {adcChampions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAllChampsModalRole('sup')}
                className={`flex-1 py-2 px-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition ${
                  allChampsModalRole === 'sup'
                    ? 'bg-[#06b6d4] text-white shadow-md shadow-[#06b6d4]/20'
                    : 'bg-[#181824] text-[#8e8ea8] hover:text-white hover:bg-[#222234] border border-white/5'
                }`}
              >
                <span>🛡️ 서포터 (SUP)</span>
                <span className="text-[10.5px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
                  {supChampions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAllChampsModalRole('all')}
                className={`py-2 px-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition ${
                  allChampsModalRole === 'all'
                    ? 'bg-[#3b82f6] text-white shadow-md shadow-[#3b82f6]/20'
                    : 'bg-[#181824] text-[#8e8ea8] hover:text-white hover:bg-[#222234] border border-white/5'
                }`}
              >
                <span>전체 ({allChampionsList.length})</span>
              </button>
            </div>

            {/* Champions List */}
            <div className="overflow-y-auto py-2 space-y-2 flex-1 pr-1">
              {modalChampionsList.length > 0 ? (
                modalChampionsList.map((c) => {
                  const isFiltered = selectedChampFilter === c.name;
                  return (
                    <div
                      key={c.name}
                      onClick={() => {
                        setSelectedChampFilter(c.name);
                        setIsAllChampsModalOpen(false);
                        onToast(`'${c.name}' 전적으로 메인 경기 목록이 필터링되었습니다.`);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                        isFiltered
                          ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] shadow-sm'
                          : 'bg-[#0a0a12] border-white/5 hover:border-[#8b5cf6]/40 hover:bg-[#151522]'
                      }`}
                      title={`클릭 시 '${c.name}' 경기로 메인 목록 필터링`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ChampionIcon
                          name={c.name}
                          size={38}
                          shape="square"
                          className="rounded-xl shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-white flex items-center gap-1.5">
                            <span className="truncate">{c.name}</span>
                            {isFiltered && (
                              <span className="text-[9px] bg-[#8b5cf6] text-white px-1.5 py-0.2 rounded font-semibold">
                                필터중
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#8e8ea8] mt-0.5">
                            KDA {c.avgK} / <span className="text-[#f87171]">{c.avgD}</span> /{' '}
                            <span className="text-[#60a5fa]">{c.avgA}</span>
                            <span className="text-[#a78bfa] font-bold ml-1.5">({c.ratio}:1)</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-[14px] font-black ${
                            c.winRate >= 60
                              ? 'text-[#f87171]'
                              : c.winRate >= 50
                              ? 'text-[#60a5fa]'
                              : 'text-[#9090a8]'
                          }`}
                        >
                          {c.winRate}%
                        </div>
                        <div className="text-[11px] text-[#7a7a92]">
                          {c.games}전 {c.wins}승 {c.losses}패
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-[#6b6b80] text-[13px]">
                  해당 포지션으로 플레이한 챔피언 데이터가 없습니다.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#1e1e2a] flex items-center justify-between text-[11px] text-[#6b6b80]">
              <span>💡 챔피언 클릭 시 해당 챔피언 전적으로 메인 경기 일지가 필터링됩니다.</span>
              <button
                type="button"
                onClick={() => setIsAllChampsModalOpen(false)}
                className="px-3 py-1 bg-[#181824] hover:bg-[#222234] text-[#a0a0b8] hover:text-white rounded-lg transition font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
