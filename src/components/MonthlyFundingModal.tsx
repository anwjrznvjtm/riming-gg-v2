import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Match, LINE_KEYS } from '../types';
import {
  calculateMonthlyFundingStats,
  groupMatchesIntoSeries,
} from '../lib/fundingStats';
import {
  isStreamerMatch,
  isWooriming,
  normalizeStreamerName,
} from '../lib/stats';
import { getChosung } from '../lib/championSearch';
import { StreamerAvatar } from './StreamerAvatar';
import {
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Search,
  RotateCcw,
  User,
} from 'lucide-react';

interface MonthlyFundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  allStreamers?: string[];
}

export function isStreamerInMatch(match: Match, streamerName: string): boolean {
  if (!streamerName || !match) return false;
  const target = streamerName.trim();
  const a = match.team_a;
  const b = match.team_b;
  for (const k of LINE_KEYS) {
    if (a && isStreamerMatch(a[k], target)) return true;
    if (b && isStreamerMatch(b[k], target)) return true;
  }
  return false;
}

export const MonthlyFundingModal: React.FC<MonthlyFundingModalProps> = ({
  isOpen,
  onClose,
  matches,
  allStreamers,
}) => {
  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initial month state: default to 'all' (전체 기간)
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  // View mode: 'perPerson' (인당 기준) vs 'total' (팀 총액 기준)
  const [calcMode, setCalcMode] = useState<'perPerson' | 'total'>('perPerson');

  // Streamer filter states
  const [selectedStreamer, setSelectedStreamer] = useState<string>('');
  const [streamerSearchInput, setStreamerSearchInput] = useState<string>('');
  const [isStreamerDropdownOpen, setIsStreamerDropdownOpen] = useState<boolean>(false);
  const streamerDropdownRef = useRef<HTMLDivElement>(null);

  // Reset selectedMonth & streamer filter whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMonth('all');
      setSelectedStreamer('');
      setStreamerSearchInput('');
      setIsStreamerDropdownOpen(false);
    }
  }, [isOpen]);

  // Close streamer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        streamerDropdownRef.current &&
        !streamerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsStreamerDropdownOpen(false);
      }
    };
    if (isStreamerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStreamerDropdownOpen]);

  // Extract all distinct streamers from matches & allStreamers
  const streamerList = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      const a = m.team_a;
      const b = m.team_b;
      for (const k of LINE_KEYS) {
        if (a && a[k]) {
          const norm = normalizeStreamerName(a[k]) || a[k].trim();
          if (norm && !isWooriming(norm)) {
            map.set(norm, (map.get(norm) || 0) + 1);
          }
        }
        if (b && b[k]) {
          const norm = normalizeStreamerName(b[k]) || b[k].trim();
          if (norm && !isWooriming(norm)) {
            map.set(norm, (map.get(norm) || 0) + 1);
          }
        }
      }
    }
    if (allStreamers && allStreamers.length > 0) {
      for (const s of allStreamers) {
        const norm = normalizeStreamerName(s) || s.trim();
        if (norm && !isWooriming(norm) && !map.has(norm)) {
          map.set(norm, 0);
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  }, [matches, allStreamers]);

  // Autocomplete candidate list filtered by query or chosung
  const filteredStreamerCandidates = useMemo(() => {
    const q = streamerSearchInput.trim().toLowerCase();
    if (!q) return streamerList;
    const cleanQ = q.replace(/[\s_]/g, '');
    return streamerList.filter((s) => {
      const cleanName = s.name.replace(/[\s_]/g, '').toLowerCase();
      if (cleanName.includes(cleanQ)) return true;
      const chosung = getChosung(cleanName);
      if (chosung.includes(cleanQ)) return true;
      return false;
    });
  }, [streamerList, streamerSearchInput]);

  // Streamer filtered matches: When a streamer is selected, extract only matches that include them (ally or enemy)
  const activeMatches = useMemo(() => {
    const clean = selectedStreamer.trim();
    if (!clean) return matches;
    return matches.filter((m) => isStreamerInMatch(m, clean));
  }, [matches, selectedStreamer]);

  // Extract all distinct months (YYYY-MM) from activeMatches
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const m of activeMatches) {
      if (m.date) {
        const monthKey = m.date.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(monthKey)) {
          set.add(monthKey);
        }
      }
    }
    return Array.from(set).sort().reverse();
  }, [activeMatches]);

  // Calculate monthly stats grouped by match series for activeMatches
  const stats = useMemo(() => {
    return calculateMonthlyFundingStats(activeMatches, selectedMonth);
  }, [activeMatches, selectedMonth]);

  // Monthly summary bar chart data for All-Time view or quick monthly comparison (grouped by match series)
  const monthlyBreakdown = useMemo(() => {
    const allSeries = groupMatchesIntoSeries(activeMatches);
    const map: Record<
      string,
      {
        month: string;
        label: string;
        wonPerPerson: number;
        lostPerPerson: number;
        netPerPerson: number;
        wonTotal: number;
        lostTotal: number;
        netTotal: number;
        subsidyCount: number;
      }
    > = {};

    for (const s of allSeries) {
      if (!s.date) continue;
      const monthKey = s.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;

      if (!map[monthKey]) {
        const [y, mo] = monthKey.split('-');
        map[monthKey] = {
          month: monthKey,
          label: `${parseInt(mo, 10)}월`,
          wonPerPerson: 0,
          lostPerPerson: 0,
          netPerPerson: 0,
          wonTotal: 0,
          lostTotal: 0,
          netTotal: 0,
          subsidyCount: 0,
        };
      }

      if (s.totalBalloons > 0 || s.hasSubsidy) {
        if (s.won) {
          map[monthKey].wonPerPerson += s.perPersonBalloons;
          map[monthKey].wonTotal += s.totalBalloons;
          if (s.subsidyWon) {
            map[monthKey].subsidyCount++;
          }
        } else if (!s.isTie) {
          map[monthKey].lostPerPerson += s.perPersonBalloons;
          map[monthKey].lostTotal += s.totalBalloons;
        }
      }
    }

    return Object.values(map)
      .map((item) => ({
        ...item,
        netPerPerson: item.wonPerPerson - item.lostPerPerson,
        netTotal: item.wonTotal - item.lostTotal,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [activeMatches]);

  if (!isOpen) return null;

  const displayedWonBalloons =
    calcMode === 'perPerson' ? stats.wonBalloonsPerPerson : stats.wonBalloonsTotal;
  const displayedLostBalloons =
    calcMode === 'perPerson' ? stats.lostBalloonsPerPerson : stats.lostBalloonsTotal;
  const displayedNetBalloons =
    calcMode === 'perPerson' ? stats.netBalloonsPerPerson : stats.netBalloonsTotal;

  // Ratio for the visual profit/loss bar
  const totalVolume = displayedWonBalloons + displayedLostBalloons;
  const wonPct = totalVolume > 0 ? Math.round((displayedWonBalloons / totalVolume) * 100) : 50;
  const lostPct = totalVolume > 0 ? 100 - wonPct : 50;

  const formatMonthTitle = (mKey: string) => {
    if (mKey === 'all') return '전체 기간';
    const [y, mo] = mKey.split('-');
    return `${y}년 ${parseInt(mo, 10)}월`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0f0f18] border border-[#232338] rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-[scaleUp_0.15s]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1e1e2e] flex items-center justify-between bg-[#131320] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#fbbf24]/20 to-[#fbbf24]/5 border border-[#fbbf24]/30 flex items-center justify-center text-[18px]">
              💰
            </div>
            <div>
              <h2 className="text-[17px] font-black text-white tracking-tight flex items-center gap-2">
                <span>월별 펀딩 & 지원금 통계</span>
                {selectedStreamer && (
                  <span className="text-[11px] font-bold text-[#c4b5fd] bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 px-2 py-0.5 rounded-full">
                    {selectedStreamer} 필터링
                  </span>
                )}
              </h2>
              <p className="text-[11.5px] text-[#8e8ea8]">
                {selectedStreamer
                  ? `'${selectedStreamer}' 선수가 참여한 경기(${activeMatches.length}세트 / ${stats.records.length}매치) 실시간 펀딩 집계`
                  : 'CK 매치별(세트 중복 없이 경기 단위 집계) 별풍선 손익 및 숲 지원금 현황'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e1e2e] hover:bg-[#2b2b40] text-[#a0a0b8] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters Toolbar: Month Dropdown, Streamer Search & Calculation Mode Toggle */}
        <div className="px-4 sm:px-5 py-3 bg-[#0c0c14] border-b border-[#1a1a28] flex flex-col gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left Controls: Month & Streamer Filter */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Month Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-[#161624] px-2.5 py-1.5 rounded-xl border border-[#2a2a3e]">
                <Calendar size={13} className="text-[#8b5cf6]" />
                <span className="text-[11px] text-[#8e8ea8] font-bold">월:</span>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none bg-transparent text-white text-[11.5px] font-bold pr-5 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#161624] text-white">전체 기간</option>
                    {availableMonths.map((mKey) => (
                      <option key={mKey} value={mKey} className="bg-[#161624] text-white">
                        {formatMonthTitle(mKey)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={11}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8e8ea8] pointer-events-none"
                  />
                </div>
              </div>

              {/* 2. Streamer Search / Dropdown Filter */}
              <div className="relative flex items-center">
                <div className="flex items-center gap-1.5 bg-[#161624] px-2.5 py-1 rounded-xl border border-[#2a2a3e] focus-within:border-[#8b5cf6] transition">
                  <Search size={13} className="text-[#a78bfa] shrink-0" />
                  <input
                    type="text"
                    value={streamerSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStreamerSearchInput(val);
                      setIsStreamerDropdownOpen(true);
                      if (!val.trim()) {
                        setSelectedStreamer('');
                      }
                    }}
                    onFocus={() => setIsStreamerDropdownOpen(true)}
                    placeholder="스트리머 검색"
                    className="bg-transparent text-[11.5px] text-white placeholder-[#686882] focus:outline-none w-[110px] sm:w-[130px] font-medium"
                  />

                  {/* Direct Dropdown Selection */}
                  <div className="relative border-l border-white/10 pl-1.5 ml-0.5">
                    <select
                      value={selectedStreamer}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedStreamer(val);
                        setStreamerSearchInput(val);
                        setIsStreamerDropdownOpen(false);
                      }}
                      className="appearance-none bg-transparent text-[11px] text-[#a0a0c0] font-bold pr-4 focus:outline-none cursor-pointer"
                      title="스트리머 목록에서 바로 선택"
                    >
                      <option value="" className="bg-[#161624] text-white">스트리머 선택</option>
                      {streamerList.map((st) => (
                        <option key={st.name} value={st.name} className="bg-[#161624] text-white">
                          {st.name} ({st.count}경기)
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={10}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8e8ea8] pointer-events-none"
                    />
                  </div>

                  {/* Clear / Reset button inside search box */}
                  {(selectedStreamer || streamerSearchInput) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStreamer('');
                        setStreamerSearchInput('');
                        setIsStreamerDropdownOpen(false);
                      }}
                      className="p-0.5 rounded-full hover:bg-white/10 text-[#8e8ea8] hover:text-white transition cursor-pointer ml-0.5"
                      title="스트리머 검색 초기화"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown List */}
                {isStreamerDropdownOpen && filteredStreamerCandidates.length > 0 && (
                  <div
                    ref={streamerDropdownRef}
                    className="absolute left-0 top-full mt-1.5 w-[220px] max-h-[220px] overflow-y-auto bg-[#141424] border border-[#2a2a44] rounded-xl shadow-2xl z-30 p-1 space-y-0.5 animate-[fadeIn_0.1s]"
                  >
                    <div className="px-2 py-1 text-[10px] text-[#717188] font-bold border-b border-white/5 flex items-center justify-between">
                      <span>스트리머 선택 ({filteredStreamerCandidates.length})</span>
                      <button
                        type="button"
                        onClick={() => setIsStreamerDropdownOpen(false)}
                        className="hover:text-white cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                    {filteredStreamerCandidates.map((st) => (
                      <div
                        key={st.name}
                        onClick={() => {
                          setSelectedStreamer(st.name);
                          setStreamerSearchInput(st.name);
                          setIsStreamerDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-[11.5px] transition ${
                          selectedStreamer === st.name
                            ? 'bg-[#8b5cf6]/30 text-white font-bold border border-[#8b5cf6]/40'
                            : 'hover:bg-white/5 text-[#d0d0e6]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <StreamerAvatar name={st.name} size={18} shape="circle" />
                          <span className="truncate">{st.name}</span>
                        </div>
                        <span className="text-[10px] text-[#8e8ea8] shrink-0 font-medium">
                          {st.count}경기
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* View Mode Toggle: Per Person vs Total */}
            <div className="flex items-center bg-[#141422] p-0.5 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setCalcMode('perPerson')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  calcMode === 'perPerson'
                    ? 'bg-[#fbbf24] text-[#12121a] shadow-sm'
                    : 'text-[#8e8ea8] hover:text-white'
                }`}
              >
                👤 인당 기준
              </button>
              <button
                type="button"
                onClick={() => setCalcMode('total')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  calcMode === 'total'
                    ? 'bg-[#8b5cf6] text-white shadow-sm'
                    : 'text-[#8e8ea8] hover:text-white'
                }`}
              >
                👥 팀 총액 기준
              </button>
            </div>
          </div>

          {/* Active Streamer Filter Pill Banner */}
          {selectedStreamer && (
            <div className="flex items-center justify-between bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 px-3 py-1.5 rounded-xl text-[11px] animate-[fadeIn_0.15s]">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="text-[#a78bfa] font-bold flex items-center gap-1">
                  <User size={12} />
                  <span>필터링 중인 스트리머:</span>
                </span>
                <span className="font-extrabold text-white px-2 py-0.2 rounded-md bg-[#8b5cf6]/20 border border-[#8b5cf6]/40">
                  {selectedStreamer}
                </span>
                <span className="text-[#b4b4cb]">
                  참여 경기 <b>{activeMatches.length}세트</b> (<b>{stats.records.length}매치</b>) 실시간 집계 반영
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedStreamer('');
                  setStreamerSearchInput('');
                  setIsStreamerDropdownOpen(false);
                }}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[#c4b5fd] hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 transition shrink-0 ml-2 cursor-pointer"
                title="필터를 해제하고 전체 통계로 돌아갑니다"
              >
                <RotateCcw size={10} />
                <span>검색 초기화</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* ======================================================== */}
          {/* SECTION 1: 숲 파트너 지원금 영역 (손익 마이너스 없음, 달성 횟수 + 획득 금액) */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-r from-[#00c73c]/10 via-[#00c73c]/5 to-transparent border border-[#00c73c]/30 rounded-2xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">🌱</span>
                <div>
                  <h3 className="text-[13.5px] font-black text-white tracking-tight flex items-center gap-2">
                    <span>숲 파트너 공식 지원금</span>
                    <span className="text-[10px] font-extrabold text-[#4ade80] bg-[#00c73c]/20 border border-[#00c73c]/40 px-2 py-0.5 rounded-full">
                      매치당 100만 원 지원
                    </span>
                  </h3>
                </div>
              </div>

              <span className="text-[10.5px] text-[#4ade80]/90 bg-[#00c73c]/15 px-2.5 py-1 rounded-lg font-semibold border border-[#00c73c]/30">
                ※ 손익 차감 없이 매치 최종 승리 시 100% 획득
              </span>
            </div>

            {/* Badges Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
              {/* Badge 1: 획득 횟수 */}
              <div className="p-3 rounded-xl bg-[#0a1810] border border-[#00c73c]/30 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#86efac]">지원금 달성 / 획득</span>
                <div className="text-[20px] font-black text-white mt-1">
                  {stats.subsidyWonCount}
                  <span className="text-[12px] font-bold text-[#86efac] ml-1">회 달성</span>
                </div>
              </div>

              {/* Badge 2: 총 획득 지원금 (팀 기준) */}
              <div className="p-3 rounded-xl bg-[#0a1810] border border-[#00c73c]/30 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#86efac]">총 획득 지원금 (팀)</span>
                <div className="text-[20px] font-black text-[#4ade80] mt-1">
                  {(stats.subsidyWonTotalAmount / 10000).toLocaleString()}
                  <span className="text-[12px] font-bold text-[#86efac] ml-1">만 원</span>
                </div>
              </div>

              {/* Badge 3: 인당 획득 지원금 (스트리머 개인 5인 분배) */}
              <div className="p-3 rounded-xl bg-[#0a1810] border border-[#00c73c]/30 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#86efac]">인당 획득 지원금 (개인)</span>
                <div className="text-[20px] font-black text-[#86efac] mt-1">
                  {(stats.subsidyWonPerPersonAmount / 10000).toLocaleString()}
                  <span className="text-[12px] font-bold text-[#86efac] ml-1">만 원</span>
                </div>
              </div>
            </div>

            {/* Subsidy note */}
            {stats.subsidyWonCount === 0 && (
              <div className="text-center py-2 mt-2 text-[11px] text-[#6a8070]">
                선택한 기간에는 지원금을 획득한 승리 매치가 없습니다.
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: 순수 별풍선 펀딩 영역 (직관적인 손익 요약 그래프 & 뱃지) */}
          {/* ======================================================== */}
          <div className="bg-[#12121e] border border-[#1e1e30] rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">🎈</span>
                <div>
                  <h3 className="text-[13.5px] font-black text-white tracking-tight flex items-center gap-1.5">
                    <span>순수 별풍선 펀딩 손익 요약</span>
                    <span className="text-[10px] text-[#fbbf24] bg-[#fbbf24]/15 border border-[#fbbf24]/30 px-2 py-0.5 rounded-full font-bold">
                      {calcMode === 'perPerson' ? '1인 분배 기준' : '팀 총액 기준'}
                    </span>
                  </h3>
                </div>
              </div>

              <div className="text-[11px] text-[#8e8ea8]">
                펀딩 매치 총 <span className="text-white font-bold">{stats.fundedSeriesCount}</span>전{' '}
                <span className="text-[#60a5fa] font-bold">{stats.seriesWins}승</span>{' '}
                <span className="text-[#f87171] font-bold">{stats.seriesLosses}패</span>{' '}
                {stats.seriesTies > 0 && (
                  <span className="text-gray-400 font-bold">{stats.seriesTies}무 </span>
                )}
                <span className="text-[#a78bfa] font-black">({stats.winRate}%)</span>
              </div>
            </div>

            {/* Profit & Loss Badges: 획득 vs 손실 vs 순손익 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 획득 (승리 시) */}
              <div className="p-3 rounded-xl bg-[#0a1424] border border-[#3b82f6]/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#93c5fd] flex items-center gap-1">
                    <TrendingUp size={12} className="text-[#60a5fa]" />
                    <span>펀딩 획득 (이득)</span>
                  </span>
                  <span className="text-[9.5px] font-bold text-[#60a5fa] bg-[#3b82f6]/20 px-1.5 py-0.2 rounded">
                    {stats.seriesWins}승
                  </span>
                </div>
                <div className="text-[18px] font-black text-[#60a5fa] mt-1.5">
                  +{displayedWonBalloons.toLocaleString()}
                  <span className="text-[11px] font-bold text-[#93c5fd] ml-1">개</span>
                </div>
              </div>

              {/* 손실 (패배 시) */}
              <div className="p-3 rounded-xl bg-[#240e14] border border-[#ef4444]/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#fca5a5] flex items-center gap-1">
                    <TrendingDown size={12} className="text-[#f87171]" />
                    <span>펀딩 손실 (손해)</span>
                  </span>
                  <span className="text-[9.5px] font-bold text-[#f87171] bg-[#ef4444]/20 px-1.5 py-0.2 rounded">
                    {stats.seriesLosses}패
                  </span>
                </div>
                <div className="text-[18px] font-black text-[#f87171] mt-1.5">
                  -{displayedLostBalloons.toLocaleString()}
                  <span className="text-[11px] font-bold text-[#fca5a5] ml-1">개</span>
                </div>
              </div>

              {/* 순손익 (Net Profit) */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  displayedNetBalloons > 0
                    ? 'bg-gradient-to-br from-[#052e16] to-[#0f172a] border-[#22c55e]/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                    : displayedNetBalloons < 0
                    ? 'bg-gradient-to-br from-[#2a0e14] to-[#120a0e] border-[#ef4444]/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                    : 'bg-[#181824] border-[#2a2a3e]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-white flex items-center gap-1">
                    <span>⚖️</span>
                    <span>최종 순손익 (NET)</span>
                  </span>
                  <span
                    className={`text-[9.5px] font-black px-1.5 py-0.2 rounded ${
                      displayedNetBalloons > 0
                        ? 'bg-[#22c55e]/20 text-[#4ade80]'
                        : displayedNetBalloons < 0
                        ? 'bg-[#ef4444]/20 text-[#f87171]'
                        : 'bg-white/10 text-[#a0a0b8]'
                    }`}
                  >
                    {displayedNetBalloons > 0
                      ? '순이득 🚀'
                      : displayedNetBalloons < 0
                      ? '순손해 🔻'
                      : '동률'}
                  </span>
                </div>
                <div
                  className={`text-[20px] font-black mt-1.5 ${
                    displayedNetBalloons > 0
                      ? 'text-[#4ade80]'
                      : displayedNetBalloons < 0
                      ? 'text-[#f87171]'
                      : 'text-[#d1d5db]'
                  }`}
                >
                  {displayedNetBalloons > 0 ? '+' : ''}
                  {displayedNetBalloons.toLocaleString()}
                  <span className="text-[11px] font-bold text-white/70 ml-1">개</span>
                </div>
              </div>
            </div>

            {/* Visual Profit vs Loss Ratio Graph Bar */}
            <div className="p-3 bg-[#0a0a14] rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-[#60a5fa] flex items-center gap-1">
                  <span>획득: {wonPct}%</span>
                  <span className="text-[10px] text-[#7a9ab8] font-normal">
                    (+{displayedWonBalloons.toLocaleString()}개)
                  </span>
                </span>
                <span className="text-[#f87171] flex items-center gap-1">
                  <span className="text-[10px] text-[#b87a8a] font-normal">
                    (-{displayedLostBalloons.toLocaleString()}개)
                  </span>
                  <span>손실: {lostPct}%</span>
                </span>
              </div>

              {/* Progress split bar */}
              <div className="h-3.5 w-full bg-[#181824] rounded-full overflow-hidden flex p-0.5 border border-white/10 shadow-inner">
                {totalVolume > 0 ? (
                  <>
                    <div
                      style={{ width: `${wonPct}%` }}
                      className="h-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] rounded-l-full transition-all duration-500 shadow-sm"
                      title={`획득 비율: ${wonPct}%`}
                    />
                    <div
                      style={{ width: `${lostPct}%` }}
                      className="h-full bg-gradient-to-r from-[#f87171] to-[#ef4444] rounded-r-full transition-all duration-500 shadow-sm"
                      title={`손실 비율: ${lostPct}%`}
                    />
                  </>
                ) : (
                  <div className="h-full w-full bg-[#2a2a3e] rounded-full text-[9px] text-[#7a7a8e] flex items-center justify-center">
                    펀딩 기록 없음
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Trend Mini-Bars (When available) */}
            {monthlyBreakdown.length > 1 && (
              <div className="p-3 bg-[#0a0a14] rounded-xl border border-white/5">
                <div className="text-[11px] font-bold text-[#8e8ea8] mb-2.5 flex items-center justify-between">
                  <span>월별 순손익 추이 ({calcMode === 'perPerson' ? '인당 기준' : '팀 총액'})</span>
                  <span className="text-[9.5px] text-[#6b6b80]">매치 단위 집계</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {monthlyBreakdown.map((mb) => {
                    const net = calcMode === 'perPerson' ? mb.netPerPerson : mb.netTotal;
                    const isPositive = net > 0;
                    const isZero = net === 0;

                    return (
                      <div
                        key={mb.month}
                        onClick={() => setSelectedMonth(mb.month)}
                        className={`p-2 rounded-lg border text-center cursor-pointer transition ${
                          selectedMonth === mb.month
                            ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] shadow-sm'
                            : 'bg-[#141420] border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-[#a0a0ba]">{mb.label}</div>
                        <div
                          className={`text-[11.5px] font-black mt-0.5 ${
                            isPositive
                              ? 'text-[#4ade80]'
                              : isZero
                              ? 'text-[#8e8ea8]'
                              : 'text-[#f87171]'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {net.toLocaleString()}개
                        </div>
                        {mb.subsidyCount > 0 && (
                          <div className="text-[9px] text-[#86efac] font-bold mt-0.5">
                            🌱 {mb.subsidyCount}회
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: 경기별 펀딩 & 지원금 상세 리스트 (매치 단위 1회 표기) */}
          {/* ======================================================== */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[12.5px] font-black text-white flex items-center gap-1.5">
                <span>📋 매치별 펀딩 상세 내역 (세트 중복 없이 경기 단위 집계)</span>
                <span className="text-[11px] text-[#8e8ea8] font-normal">
                  ({stats.records.length}경기)
                </span>
              </h4>
            </div>

            {stats.records.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {stats.records.map((rec) => {
                  const netValue =
                    calcMode === 'perPerson' ? rec.perPersonBalloons : rec.totalBalloons;

                  return (
                    <div
                      key={rec.seriesKey}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-[12px] transition ${
                        rec.won
                          ? 'bg-[#0b1526]/80 border-[#3b82f6]/25 hover:border-[#3b82f6]/40'
                          : rec.isTie
                          ? 'bg-[#181824]/80 border-gray-600/30 hover:border-gray-500/40'
                          : 'bg-[#1f0d14]/80 border-[#ef4444]/25 hover:border-[#ef4444]/40'
                      }`}
                    >
                      {/* Left: Date, CK Name & Series Score */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                              rec.won
                                ? 'bg-[#3b82f6] text-white'
                                : rec.isTie
                                ? 'bg-gray-600 text-white'
                                : 'bg-[#ef4444] text-white'
                            }`}
                          >
                            {rec.won ? '승리' : rec.isTie ? '무승부' : '패배'} ({rec.seriesScore})
                          </span>
                          <span className="text-[11px] text-[#8e8ea8] font-medium">
                            {rec.date}
                          </span>
                          <span className="text-[10px] text-[#a0a0ba] font-semibold bg-white/5 px-1.5 py-0.2 rounded">
                            {rec.setCount > 1 ? `총 ${rec.setCount}세트 경기` : '단판 CK'}
                          </span>
                        </div>

                        <div className="font-bold text-white text-[12.5px] truncate mt-0.5">
                          {rec.ck_name}
                        </div>
                      </div>

                      {/* Right: Funding & Subsidy Breakdown */}
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        {/* Subsidy Tag */}
                        {rec.hasSubsidy && (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              rec.subsidyWon
                                ? 'bg-[#00c73c]/20 text-[#4ade80] border-[#00c73c]/40'
                                : 'bg-gray-800/40 text-gray-400 border-gray-700/40 line-through'
                            }`}
                            title={
                              rec.subsidyWon
                                ? '숲 지원금 100만 원 (인당 20만 원) 획득 성공'
                                : '경기 패배로 지원금 미획득'
                            }
                          >
                            <span>🌱</span>
                            <span>{rec.subsidyWon ? '지원금 획득' : '지원금 미획득'}</span>
                          </span>
                        )}

                        {/* Balloons Profit / Loss */}
                        {rec.totalBalloons > 0 && (
                          <div
                            className={`font-black text-[13px] px-2.5 py-1 rounded-lg border ${
                              rec.won
                                ? 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30'
                                : rec.isTie
                                ? 'bg-gray-800/20 text-gray-300 border-gray-700/30'
                                : 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30'
                            }`}
                          >
                            <span>{rec.won ? '+' : rec.isTie ? '±' : '-'}</span>
                            <span>{netValue.toLocaleString()}개</span>
                            <span className="text-[10px] text-white/60 ml-1 font-medium">
                              ({calcMode === 'perPerson' ? '인당' : '총액'})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-[#0a0a14] rounded-xl border border-white/5 text-[12px] text-[#6b6b80] space-y-2">
                <div>
                  선택한 조건{selectedStreamer ? ` (스트리머: ${selectedStreamer})` : ''}의 {formatMonthTitle(selectedMonth)}에 펀딩 또는 지원금이 걸린 경기가 없습니다.
                </div>
                {selectedStreamer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStreamer('');
                      setStreamerSearchInput('');
                      setIsStreamerDropdownOpen(false);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c4b5fd] hover:text-white px-3 py-1 rounded-lg bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 transition cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>스트리머 필터 해제</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#1e1e2e] bg-[#131320] flex items-center justify-between text-[11px] text-[#8e8ea8] shrink-0">
          <span>* 숲 파트너 지원금(100만 원)은 5인 분배 시 인당 20만 원으로 계산됩니다.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252538] hover:bg-[#32324c] text-white rounded-xl font-bold transition cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
