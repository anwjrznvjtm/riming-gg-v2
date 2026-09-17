import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Match,
  LineKey,
  LINE_KEYS,
  LINE_LABELS,
} from '../types';
import { ComputedStats, isMatchWonByWooriming, getWoorimingTeam, getWoorimingLineKey, parseKda, isWooriming } from '../lib/stats';
import { getSeriesCumulativeScore } from '../lib/seriesScores';
import { OpggMatchCard } from './OpggMatchCard';
import { ChampionIcon } from './ChampionIcon';
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
  ChevronDown,
  ChevronUp,
  X,
  Users,
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

  // Accordion expanded match IDs
  const [expandedMatchIds, setExpandedMatchIds] = useState<Set<string>>(new Set());

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isAllChampsModalOpen, setIsAllChampsModalOpen] = useState(false);

  // Jump to streamer effect from external triggers
  useEffect(() => {
    if (targetStreamer) {
      setSelectedStreamerFilter(targetStreamer);
      if (targetStreamerRole) {
        setStreamerRoleFilter(targetStreamerRole);
      }
    }
    if (targetMatchId) {
      setExpandedMatchIds((prev) => new Set([...prev, targetMatchId]));
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

  // --- 2. '모스트 챔피언' CK 통계 (오직 CK 데이터 기반) ---
  const mostChampions = useMemo(() => {
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
  }, [matches]);

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

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const ckMatch = (m.ck_name || '').toLowerCase().includes(q);
        const allPlayers = [
          ...Object.values(m.team_a || {}),
          ...Object.values(m.team_b || {}),
        ].join(' ').toLowerCase();
        return ckMatch || allPlayers.includes(q);
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

  const toggleExpandMatch = (id: string) => {
    setExpandedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllExpand = () => {
    if (expandedMatchIds.size === filteredMatches.length && filteredMatches.length > 0) {
      setExpandedMatchIds(new Set());
    } else {
      setExpandedMatchIds(new Set(filteredMatches.map((m) => m.id)));
    }
  };

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
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b5cf6]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <img
                  src="https://res.cloudinary.com/dfqsbvupq/image/upload/v1738734614/wooriming_avatar.png"
                  alt="우리밍_"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/548.jpg';
                  }}
                  className="w-14 h-14 rounded-full border-2 border-[#8b5cf6] object-cover shadow-md"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-1 -right-1 bg-[#8b5cf6] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full border border-black">
                  ADC
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[17px] font-black text-white tracking-tight">우리밍_</h2>
                  <span className="bg-[#8b5cf6]/20 text-[#c4b5fd] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#8b5cf6]/40">
                    CK 전적
                  </span>
                </div>
                <p className="text-[11px] text-[#8a8aa0] truncate mt-0.5">
                  롤 CK 커스텀 경기 전문 일지
                </p>
                <div className="text-[11px] text-white font-semibold mt-1">
                  총 {lifetimeStats.total}전 {lifetimeStats.wins}승 {lifetimeStats.losses}패{' '}
                  <span className="text-[#8b5cf6] font-bold">({lifetimeStats.winRate}%)</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button: 새 경기 등록 */}
            <div className="mt-3.5 pt-3 border-t border-[#1e1e2a] flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="w-full h-[36px] bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white rounded-xl text-[12px] font-bold shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Plus size={15} />
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

          {/* 2. '모스트 챔피언' CK 통계 카드 (오직 CK 데이터 기반) */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Flame size={15} className="text-[#fbbf24]" />
                <h3 className="font-black text-[13px] text-white tracking-tight">모스트 챔피언 (CK)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAllChampsModalOpen(true)}
                className="text-[10.5px] text-[#a78bfa] hover:underline"
              >
                전체보기 ({mostChampions.length})
              </button>
            </div>

            {mostChampions.length > 0 ? (
              <div className="space-y-2">
                {mostChampions.slice(0, 7).map((c) => {
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
                플레이한 CK 챔피언 데이터가 없습니다.
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
              {/* Line Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', ...LINE_KEYS] as const).map((line) => {
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

              {/* Toggle All Accordions */}
              <button
                type="button"
                onClick={handleToggleAllExpand}
                className="h-[30px] px-3 bg-white/5 hover:bg-white/10 text-[#a0a0b8] hover:text-white border border-white/10 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
              >
                {expandedMatchIds.size === filteredMatches.length && filteredMatches.length > 0 ? (
                  <>
                    <ChevronUp size={13} />
                    <span>전체 상세 접기</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} />
                    <span>전체 상세 펼치기</span>
                  </>
                )}
              </button>
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
                const isExpanded = expandedMatchIds.has(m.id);

                return (
                  <OpggMatchCard
                    key={m.id}
                    match={m}
                    scoreText={scoreText}
                    onEdit={handleOpenEditModal}
                    onDelete={(id) => setDeleteTargetId(id)}
                    onJumpToStreamer={onJumpToStreamer}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpandMatch(m.id)}
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

      {/* 3. All Champions Modal */}
      {isAllChampsModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]"
          onClick={() => setIsAllChampsModalOpen(false)}
        >
          <div
            className="relative z-[10000] w-full max-w-[600px] bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-5 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#1e1e2a]">
              <div className="flex items-center gap-2">
                <Flame size={18} className="text-[#fbbf24]" />
                <h3 className="font-bold text-[16px] text-white">전체 CK 플레이 챔피언 ({mostChampions.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAllChampsModalOpen(false)}
                className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-2 flex-1 pr-1">
              {mostChampions.map((c) => (
                <div
                  key={c.name}
                  onClick={() => {
                    setSelectedChampFilter(c.name);
                    setIsAllChampsModalOpen(false);
                    onToast(`${c.name} 전적으로 필터링되었습니다.`);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0a12] border border-white/5 hover:border-[#8b5cf6]/50 hover:bg-[#151522] cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <ChampionIcon name={c.name} size={36} shape="square" className="rounded-lg" />
                    <div>
                      <div className="text-[13px] font-bold text-white">{c.name}</div>
                      <div className="text-[11px] text-[#8e8ea8]">
                        KDA {c.avgK} / <span className="text-[#f87171]">{c.avgD}</span> /{' '}
                        <span className="text-[#60a5fa]">{c.avgA}</span> ({c.ratio}:1)
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[13px] font-black text-white">{c.winRate}%</div>
                    <div className="text-[11px] text-[#7a7a92]">
                      {c.games}전 {c.wins}승 {c.losses}패
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
