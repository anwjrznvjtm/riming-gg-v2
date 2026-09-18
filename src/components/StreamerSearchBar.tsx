import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS } from '../types';
import { searchStreamersDetailed } from '../lib/championSearch';
import { StreamerAvatar } from './StreamerAvatar';
import { ChampionIcon } from './ChampionIcon';
import { getWoorimingTeam, isWooriming } from '../lib/stats';
import { sortMatchesDescending } from '../lib/seriesScores';
import { Search, X, Zap, Swords, Users, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface StreamerSearchBarProps {
  allStreamers: string[];
  matches: Match[];
  onSelectStreamer: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
  className?: string;
  placeholder?: string;
}

export interface StreamerQuickStat {
  name: string;
  totalGames: number;
  mainLane: LineKey;
  vsGames: number;
  vsWins: number;
  vsLosses: number;
  vsWinrate: number;
  withGames: number;
  withWins: number;
  withLosses: number;
  withWinrate: number;
}

interface StreamerMatchDetail {
  id: string;
  date: string;
  ckName: string;
  setNumber: number;
  format: string;
  isAlly: boolean;
  won: boolean; // 우리밍_ 팀 승리 여부
  streamerTeam: 'Red' | 'Blue';
  streamerLine: LineKey;
  streamerChamp: string;
  streamerKda: string;
  woorimingLine: LineKey;
  woorimingChamp: string;
  woorimingKda: string;
}

export const StreamerSearchBar: React.FC<StreamerSearchBarProps> = ({
  allStreamers,
  matches,
  onSelectStreamer,
  className = '',
  placeholder = '스트리머 검색 (예: 린다랑, 서리, 김민교)',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [expandedStreamer, setExpandedStreamer] = useState<{
    name: string;
    role: 'ally' | 'enemy';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 스트리머별 아군/적팀 전적 및 승률 사전 계산
  const streamerStatsMap = useMemo(() => {
    const map = new Map<string, StreamerQuickStat>();

    for (const name of allStreamers) {
      const cleanName = name.trim();
      const laneCounts: Record<LineKey, number> = { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 };
      let totalGames = 0;
      let vsGames = 0;
      let vsWins = 0;
      let vsLosses = 0;
      let withGames = 0;
      let withWins = 0;
      let withLosses = 0;

      for (const m of matches) {
        const wTeam = getWoorimingTeam(m);
        const redRoster = m.team_a || {};
        const blueRoster = m.team_b || {};
        const winningTeam = m.winning_team;

        let playerTeam: 'Red' | 'Blue' | null = null;
        let playerLane: LineKey | null = null;

        for (const k of LINE_KEYS) {
          if ((redRoster[k] || '').trim() === cleanName) {
            playerTeam = 'Red';
            playerLane = k;
            break;
          }
          if ((blueRoster[k] || '').trim() === cleanName) {
            playerTeam = 'Blue';
            playerLane = k;
            break;
          }
        }

        if (playerTeam && playerLane) {
          totalGames++;
          laneCounts[playerLane]++;

          const allyWon = winningTeam === wTeam;
          if (wTeam) {
            if (playerTeam === wTeam) {
              // 우리밍_과 같은 팀 (아군)
              withGames++;
              if (allyWon) withWins++;
              else withLosses++;
            } else {
              // 우리밍_과 상대 팀 (적팀)
              vsGames++;
              if (!allyWon) vsWins++; // 상대팀 승리
              else vsLosses++; // 상대팀 패배
            }
          }
        }
      }

      let bestLane: LineKey = 'mid';
      let maxLaneCount = -1;
      for (const k of LINE_KEYS) {
        if (laneCounts[k] > maxLaneCount) {
          maxLaneCount = laneCounts[k];
          bestLane = k;
        }
      }

      map.set(cleanName, {
        name: cleanName,
        totalGames,
        mainLane: bestLane,
        vsGames,
        vsWins,
        vsLosses,
        vsWinrate: vsGames ? Math.round((vsWins / vsGames) * 100) : 0,
        withGames,
        withWins,
        withLosses,
        withWinrate: withGames ? Math.round((withWins / withGames) * 100) : 0,
      });
    }

    return map;
  }, [allStreamers, matches]);

  // 검색 자동완성 리스트
  const suggestions = useMemo(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      // 검색어 없을 때는 경기 참여 수 기준 상위 스트리머 노출
      return allStreamers
        .filter((s) => s !== '우리밍_')
        .map((name) => ({
          name,
          stat: streamerStatsMap.get(name) || {
            name,
            totalGames: 0,
            mainLane: 'mid' as LineKey,
            vsGames: 0,
            vsWins: 0,
            vsLosses: 0,
            vsWinrate: 0,
            withGames: 0,
            withWins: 0,
            withLosses: 0,
            withWinrate: 0,
          },
        }))
        .sort((a, b) => b.stat.totalGames - a.stat.totalGames)
        .slice(0, 10);
    }

    const detailed = searchStreamersDetailed(cleanQuery, allStreamers);
    return detailed.map((d) => ({
      name: d.name,
      stat: streamerStatsMap.get(d.name) || {
        name: d.name,
        totalGames: 0,
        mainLane: 'mid' as LineKey,
        vsGames: 0,
        vsWins: 0,
        vsLosses: 0,
        vsWinrate: 0,
        withGames: 0,
        withWins: 0,
        withLosses: 0,
        withWinrate: 0,
      },
      matchType: d.matchType,
      aliasLabel: d.aliasLabel,
    }));
  }, [query, allStreamers, streamerStatsMap]);

  // 특정 스트리머의 아군/적팀 경기 목록을 최신순으로 추출
  const getStreamerMatches = (streamerName: string, role: 'ally' | 'enemy'): StreamerMatchDetail[] => {
    const cleanName = streamerName.trim();
    const sorted = sortMatchesDescending(matches);
    const results: StreamerMatchDetail[] = [];

    for (const m of sorted) {
      const wTeam = getWoorimingTeam(m);
      if (!wTeam) continue;

      let sTeam: 'Red' | 'Blue' | null = null;
      let sLine: LineKey | null = null;

      for (const k of LINE_KEYS) {
        if ((m.team_a?.[k] || '').trim() === cleanName) {
          sTeam = 'Red';
          sLine = k;
          break;
        }
        if ((m.team_b?.[k] || '').trim() === cleanName) {
          sTeam = 'Blue';
          sLine = k;
          break;
        }
      }

      if (!sTeam || !sLine) continue;

      const isAlly = sTeam === wTeam;
      if (role === 'ally' && !isAlly) continue;
      if (role === 'enemy' && isAlly) continue;

      const won = m.winning_team === wTeam;

      let wLine: LineKey = 'adc';
      const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
      for (const k of LINE_KEYS) {
        if (isWooriming(wRoster?.[k])) {
          wLine = k;
          break;
        }
      }

      const sChamps = sTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
      const sKdas = sTeam === 'Red' ? m.team_a_kda : m.team_b_kda;
      const wChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
      const wKdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;

      results.push({
        id: m.id,
        date: m.date || '',
        ckName: m.ck_name || 'CK 경기',
        setNumber: Math.max(1, parseInt(String(m.set_number), 10) || 1),
        format: m.match_format || '3판2선승',
        isAlly,
        won,
        streamerTeam: sTeam,
        streamerLine: sLine,
        streamerChamp: sChamps?.[sLine] || '',
        streamerKda: sKdas?.[sLine] || '',
        woorimingLine: wLine,
        woorimingChamp: wChamps?.[wLine] || '',
        woorimingKda: wKdas?.[wLine] || '',
      });
    }

    return results;
  };

  // 인라인 매치 리스트 토글 (아군 또는 적팀)
  const handleToggleMatches = (streamerName: string, role: 'ally' | 'enemy') => {
    if (expandedStreamer?.name === streamerName && expandedStreamer.role === role) {
      setExpandedStreamer(null);
    } else {
      setExpandedStreamer({ name: streamerName, role });
    }
  };

  // 인라인 목록에서 특정 경기 클릭 시 CK 일지로 이동 및 해당 경기 하이라이트
  const handleMatchClick = (streamerName: string, matchId: string, role: 'ally' | 'enemy') => {
    onSelectStreamer(streamerName, matchId, role);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (suggestions.length > 0) {
        const top = suggestions[0];
        const defaultRole: 'ally' | 'enemy' = top.stat.withGames > 0 ? 'ally' : 'enemy';
        handleToggleMatches(top.name, defaultRole);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 상단 검색 인풋창 */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-[34px] pl-8 pr-7 bg-[#12121a] hover:bg-[#161622] border border-[#2a2a3e] focus:border-[#8b5cf6] rounded-full text-[12px] text-white placeholder:text-[#6a6a82] focus:outline-none transition-all shadow-inner"
        />
        <Search
          size={14}
          className="absolute left-2.5 text-[#7a7a92] pointer-events-none transition-colors group-focus-within:text-[#8b5cf6]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 w-4 h-4 rounded-full bg-[#2a2a3e] hover:bg-[#3e3e56] text-[#c0c0d0] flex items-center justify-center text-[10px] transition"
            title="검색어 지우기"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* 검색 결과 드롭다운 팝업창 */}
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 sm:left-auto sm:right-0 w-[calc(100vw-24px)] sm:w-[410px] md:w-[460px] max-w-[500px] bg-[#101018] border border-[#2c2c42] rounded-2xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.15s]">
          {/* 드롭다운 상단 헤더 */}
          <div className="px-4 py-2.5 bg-[#161624] border-b border-[#222234] flex items-center justify-between text-[11px]">
            <span className="font-bold text-[#c2c2d6] flex items-center gap-1.5">
              <Zap size={13} className="text-[#8b5cf6]" />
              <span>스트리머 전적 &amp; 경기 리스트</span>
            </span>
            <span className="text-[10px] text-[#82829c]">
              {query ? `${suggestions.length}명 검색됨` : '주요 스트리머 목록'}
            </span>
          </div>

          {/* 스트리머 목록 리스트 (여유 있는 높이와 패딩) */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-[#1e1e2c]">
            {suggestions.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[#727288]">
                검색된 스트리머가 없습니다.
              </div>
            ) : (
              suggestions.map((item) => {
                const stat = item.stat;
                const isExpanded = expandedStreamer?.name === item.name;
                const currentRole = isExpanded ? expandedStreamer.role : null;
                const expandedMatches = isExpanded ? getStreamerMatches(item.name, expandedStreamer.role) : [];

                return (
                  <div
                    key={item.name}
                    className="p-3 hover:bg-[#141422] transition-colors flex flex-col gap-2.5 group"
                  >
                    {/* 스트리머 정보 상단 행 */}
                    <div
                      onClick={() => {
                        // 행 클릭 시 기본 아군/적팀 경기 토글
                        const targetRole: 'ally' | 'enemy' = stat.withGames > 0 ? 'ally' : 'enemy';
                        handleToggleMatches(item.name, targetRole);
                      }}
                      className="flex items-center justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StreamerAvatar name={item.name} size={36} />
                        <div className="min-w-0">
                          {/* 상단 영역: '상어녀 (ADC) · 통산 43전' 형태로 한 줄로 심플하게 요약 */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[13.5px] text-white group-hover:text-[#c4b5fd] transition-colors">
                              {item.name}
                            </span>
                            <span className="text-[12px] text-[#9ca3af] font-medium">
                              ({LINE_LABELS[stat.mainLane] || 'MID'}) · 통산 {stat.totalGames}전
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 펼침/접힘 화살표 아이콘 */}
                      <div className="shrink-0 text-[#7a7a92] group-hover:text-[#c4b5fd] transition-colors p-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* 하단 클릭 버튼: 승률 정보를 포함한 [ 🤝 아군 X전 Y승 (Z%) ], [ ⚔️ 적팀 X전 Y승 (Z%) ] 기능성 버튼 */}
                    <div className="flex items-center gap-2 pl-0.5 flex-wrap">
                      {stat.withGames > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMatches(item.name, 'ally');
                          }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition shadow-sm ${
                            isExpanded && currentRole === 'ally'
                              ? 'bg-[#3b82f6] text-white ring-2 ring-[#3b82f6]/50 shadow-md'
                              : 'bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 text-[#60a5fa] border border-[#3b82f6]/35'
                          }`}
                          title={`클릭하여 ${item.name} 선수와 아군 경기 목록 확인 및 CK 일지 이동`}
                        >
                          <span>🤝</span>
                          <span>아군 {stat.withGames}전 {stat.withWins}승 ({stat.withWinrate}%)</span>
                          {isExpanded && currentRole === 'ally' ? (
                            <ChevronUp size={12} className="ml-0.5" />
                          ) : (
                            <ChevronDown size={12} className="ml-0.5 opacity-70" />
                          )}
                        </button>
                      )}

                      {stat.vsGames > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMatches(item.name, 'enemy');
                          }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition shadow-sm ${
                            isExpanded && currentRole === 'enemy'
                              ? 'bg-[#ef4444] text-white ring-2 ring-[#ef4444]/50 shadow-md'
                              : 'bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#f87171] border border-[#ef4444]/35'
                          }`}
                          title={`클릭하여 ${item.name} 선수와 적팀 경기 목록 확인 및 CK 일지 이동`}
                        >
                          <span>⚔️</span>
                          <span>적팀 {stat.vsGames}전 {stat.vsWins}승 ({stat.vsWinrate}%)</span>
                          {isExpanded && currentRole === 'enemy' ? (
                            <ChevronUp size={12} className="ml-0.5" />
                          ) : (
                            <ChevronDown size={12} className="ml-0.5 opacity-70" />
                          )}
                        </button>
                      )}

                      {stat.withGames === 0 && stat.vsGames === 0 && (
                        <span className="text-[11px] text-[#7a7a92] px-1">참여 기록 보유</span>
                      )}
                    </div>

                    {/* 인라인 매치 리스트업 팝업 영역 (그 자리에서 펼쳐지며 경기 클릭 시 일지 해당 위치로 스크롤 점프) */}
                    {isExpanded && (
                      <div className="mt-1 bg-[#0b0b14] border border-[#26263a] rounded-xl p-2.5 flex flex-col gap-2 animate-[fadeIn_0.15s] shadow-inner">
                        {/* 인라인 헤더: 역할 전환 탭 및 일지 전체 이동 */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#c4b5fd]">
                              {item.name} 선수와 {currentRole === 'ally' ? '아군' : '적팀'} 경기 목록
                            </span>
                            <span className="text-[10px] text-[#82829c] font-medium">
                              ({expandedMatches.length}경기)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* CK 일지로 필터링하며 전체 이동 버튼 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStreamer(item.name, undefined, currentRole || 'all');
                                setIsOpen(false);
                              }}
                              className="px-2 py-0.5 rounded-md bg-[#8b5cf6]/20 hover:bg-[#8b5cf6] text-[#c4b5fd] hover:text-white border border-[#8b5cf6]/40 text-[10px] font-bold flex items-center gap-1 transition shadow-xs"
                              title={`CK 일지로 이동하여 ${item.name} 선수의 모든 경기를 필터링합니다`}
                            >
                              <Zap size={10} />
                              <span>일지 이동</span>
                            </button>

                            {/* 아군/적팀 즉시 전환 탭 */}
                            <div className="flex items-center gap-1 bg-[#161624] p-0.5 rounded-lg border border-white/5">
                              {stat.withGames > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMatches(item.name, 'ally')}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                    currentRole === 'ally'
                                      ? 'bg-[#3b82f6] text-white shadow-sm'
                                      : 'text-[#8a8aa0] hover:text-white'
                                  }`}
                                >
                                  아군 ({stat.withGames})
                                </button>
                              )}
                              {stat.vsGames > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMatches(item.name, 'enemy')}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                    currentRole === 'enemy'
                                      ? 'bg-[#ef4444] text-white shadow-sm'
                                      : 'text-[#8a8aa0] hover:text-white'
                                  }`}
                                >
                                  적팀 ({stat.vsGames})
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 경기 목록 리스트 */}
                        <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
                          {expandedMatches.length === 0 ? (
                            <div className="py-4 text-center text-[11px] text-[#7a7a92]">
                              해당 조건의 경기 기록이 없습니다.
                            </div>
                          ) : (
                            expandedMatches.map((m) => (
                              <div
                                key={m.id}
                                onClick={() => handleMatchClick(item.name, m.id, expandedStreamer.role)}
                                className="p-2 rounded-lg bg-[#141424] hover:bg-[#1f1f38] border border-[#2a2a40] hover:border-[#8b5cf6]/70 cursor-pointer transition-all flex flex-col gap-1.5 group/card shadow-sm"
                                title="클릭 시 CK 일지의 해당 경기 위치로 부드럽게 스크롤 이동합니다"
                              >
                                {/* 경기 요약 헤더: 승패, 날짜, 세트, 대회명, 점프 안내 */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                    <span
                                      className={`text-[10px] font-black px-1.5 py-0.2 rounded shadow-xs shrink-0 ${
                                        m.won
                                          ? 'bg-[#3b82f6]/25 text-[#60a5fa] border border-[#3b82f6]/40'
                                          : 'bg-[#ef4444]/25 text-[#f87171] border border-[#ef4444]/40'
                                      }`}
                                    >
                                      {m.won ? '승리' : '패배'}
                                    </span>
                                    <span className="text-[11px] font-bold text-[#a0a0b8] shrink-0">
                                      {m.date}
                                    </span>
                                    <span className="text-[10px] text-[#7a7a92] font-semibold shrink-0">
                                      {m.format !== '단판' ? `${m.setNumber}세트` : '단판'}
                                    </span>
                                    <span className="text-[11px] text-white font-medium truncate group-hover/card:text-[#c4b5fd] transition-colors">
                                      {m.ckName}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[10px] text-[#8b5cf6] group-hover/card:text-[#a78bfa] font-bold shrink-0 transition-transform group-hover/card:translate-x-0.5">
                                    <span>일지 이동</span>
                                    <ArrowRight size={11} />
                                  </div>
                                </div>

                                {/* 당시 선수 및 우리밍_ 챔피언 정보 */}
                                <div className="flex items-center justify-between gap-2 bg-[#090910] px-2 py-1.5 rounded border border-white/5 text-[11px]">
                                  {/* 스트리머 당시 챔피언 및 포지션 */}
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ChampionIcon name={m.streamerChamp} size={22} shape="square" />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-[#d0d0e6] truncate">
                                          {item.name}
                                        </span>
                                        <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-white/10 text-[#a0a0b8]">
                                          {LINE_LABELS[m.streamerLine]}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-[#7a7a92] block truncate">
                                        {m.streamerChamp || '챔프 미지정'}
                                        {m.streamerKda && !m.streamerKda.includes('-') ? ` (${m.streamerKda})` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 역할 구분 배지 */}
                                  <div className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black text-[#9090b0] bg-white/5 border border-white/10">
                                    {m.isAlly ? '🤝 아군' : '⚔ 적팀'}
                                  </div>

                                  {/* 우리밍_ 당시 챔피언 */}
                                  <div className="flex items-center gap-1.5 justify-end min-w-0">
                                    <div className="text-right min-w-0">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-[#8b5cf6]/25 text-[#f5d0fe]">
                                          {LINE_LABELS[m.woorimingLine]}
                                        </span>
                                        <span className="font-bold text-[#f5d0fe] truncate">
                                          우리밍_
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-[#7a7a92] block truncate">
                                        {m.woorimingChamp || '원딜'}
                                        {m.woorimingKda && !m.woorimingKda.includes('-') ? ` (${m.woorimingKda})` : ''}
                                      </span>
                                    </div>
                                    <ChampionIcon name={m.woorimingChamp} size={22} shape="square" />
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
