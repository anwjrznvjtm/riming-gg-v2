import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LineKey,
  LINE_KEYS,
  LINE_LABELS,
  Match,
  StreamerProfile,
  SoopLiveBroadcast,
  LiveStreamerMember,
} from '../types';
import {
  calculateOpponentsForStreamer,
  StreamerLaneOpponentRecord,
  normalizeStreamerName,
  isStreamerMatch,
  isWooriming,
} from '../lib/stats';
import { StreamerAvatar } from './StreamerAvatar';
import {
  X,
  Search,
  Users,
  Tv,
  Crown,
  Play,
  Flame,
  Swords,
  ExternalLink,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronDown,
  UserCheck,
  Check,
} from 'lucide-react';

export interface CkMembersLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  allProfiles: StreamerProfile[];
  liveBroadcasts: SoopLiveBroadcast[];
  totalLiveCount: number;
  totalProfilesCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  woorimingLive?: LiveStreamerMember;
}

const LINE_THEME: Record<
  LineKey,
  {
    name: string;
    kr: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    glow: string;
    borderColor: string;
  }
> = {
  top: {
    name: 'TOP',
    kr: '탑',
    badgeBg: 'bg-[#f97316]/15',
    badgeText: 'text-[#fb923c]',
    badgeBorder: 'border-[#f97316]/40',
    glow: 'rgba(249, 115, 22, 0.2)',
    borderColor: 'border-[#f97316]/50',
  },
  jgl: {
    name: 'JGL',
    kr: '정글',
    badgeBg: 'bg-[#10b981]/15',
    badgeText: 'text-[#34d399]',
    badgeBorder: 'border-[#10b981]/40',
    glow: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'border-[#10b981]/50',
  },
  mid: {
    name: 'MID',
    kr: '미드',
    badgeBg: 'bg-[#06b6d4]/15',
    badgeText: 'text-[#22d3ee]',
    badgeBorder: 'border-[#06b6d4]/40',
    glow: 'rgba(6, 182, 212, 0.2)',
    borderColor: 'border-[#06b6d4]/50',
  },
  adc: {
    name: 'ADC',
    kr: '원딜',
    badgeBg: 'bg-[#a855f7]/15',
    badgeText: 'text-[#c084fc]',
    badgeBorder: 'border-[#a855f7]/40',
    glow: 'rgba(168, 85, 247, 0.25)',
    borderColor: 'border-[#a855f7]/60',
  },
  sup: {
    name: 'SUP',
    kr: '서폿',
    badgeBg: 'bg-[#eab308]/15',
    badgeText: 'text-[#facc15]',
    badgeBorder: 'border-[#eab308]/40',
    glow: 'rgba(234, 179, 8, 0.2)',
    borderColor: 'border-[#eab308]/50',
  },
};

function formatViewerCount(count: string | number | undefined): string {
  const n = parseInt(String(count || 0), 10);
  if (isNaN(n) || n === 0) return '0';
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}만`;
  }
  return n.toLocaleString();
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const start = new Date(dateStr.replace(' ', 'T')).getTime();
    const now = Date.now();
    const diffMin = Math.max(0, Math.floor((now - start) / (1000 * 60)));
    if (diffMin < 60) return `${diffMin}분 전 시작`;
    const hours = Math.floor(diffMin / 60);
    const remainMin = diffMin % 60;
    return `${hours}시간 ${remainMin}분 전 시작`;
  } catch {
    return '';
  }
}

interface MatchedLiveOpponent {
  streamerName: string;
  opponentRecord: StreamerLaneOpponentRecord;
  profile?: StreamerProfile;
  live: SoopLiveBroadcast;
}

export const CkMembersLineupModal: React.FC<CkMembersLineupModalProps> = ({
  isOpen,
  onClose,
  matches,
  allProfiles,
  liveBroadcasts,
  isLoading,
  onRefresh,
}) => {
  // 5 Line Slot selections (Default: ADC is '우리밍_')
  const [slotStreamers, setSlotStreamers] = useState<Record<LineKey, string>>({
    top: '',
    jgl: '',
    mid: '',
    adc: '우리밍_',
    sup: '',
  });

  // Current active line tab in view
  const [activeLine, setActiveLine] = useState<LineKey | 'ALL'>('adc');

  // Dropdown selector state: which slot is currently picking a streamer
  const [pickerOpenLine, setPickerOpenLine] = useState<LineKey | null>(null);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const pickerInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerOpenLine) {
          setPickerOpenLine(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, pickerOpenLine, onClose]);

  // Focus picker input when opened
  useEffect(() => {
    if (pickerOpenLine) {
      setPickerSearch('');
      setTimeout(() => pickerInputRef.current?.focus(), 50);
    }
  }, [pickerOpenLine]);

  // Build lookup maps for live broadcasts by user_id and nick
  const liveMapById = useMemo(() => {
    const map = new Map<string, SoopLiveBroadcast>();
    for (const b of liveBroadcasts) {
      if (b.user_id) {
        map.set(b.user_id.toLowerCase().trim(), b);
      }
    }
    return map;
  }, [liveBroadcasts]);

  // Build profiles map
  const profileMap = useMemo(() => {
    const map = new Map<string, StreamerProfile>();
    for (const p of allProfiles) {
      map.set(p.name.toLowerCase().trim(), p);
      const norm = normalizeStreamerName(p.name).toLowerCase();
      if (norm) map.set(norm, p);
    }
    return map;
  }, [allProfiles]);

  // Extract candidate streamers for each line from matches & profiles
  const lineCandidates = useMemo(() => {
    const candidates: Record<LineKey, { name: string; games: number; profile?: StreamerProfile }[]> = {
      top: [],
      jgl: [],
      mid: [],
      adc: [],
      sup: [],
    };

    const lineCounts: Record<LineKey, Map<string, number>> = {
      top: new Map(),
      jgl: new Map(),
      mid: new Map(),
      adc: new Map(),
      sup: new Map(),
    };

    // 1. Tally from matches
    for (const m of matches) {
      for (const line of LINE_KEYS) {
        const rawA = m.team_a?.[line];
        const normA = normalizeStreamerName(rawA);
        if (normA) {
          lineCounts[line].set(normA, (lineCounts[line].get(normA) || 0) + 1);
        }

        const rawB = m.team_b?.[line];
        const normB = normalizeStreamerName(rawB);
        if (normB) {
          lineCounts[line].set(normB, (lineCounts[line].get(normB) || 0) + 1);
        }
      }
    }

    // 2. Add profiles that have this main_position
    for (const p of allProfiles) {
      const line = p.main_position || 'mid';
      if (!lineCounts[line].has(p.name)) {
        lineCounts[line].set(p.name, 0);
      }
    }

    // 3. Convert to sorted array
    for (const line of LINE_KEYS) {
      const list = Array.from(lineCounts[line].entries()).map(([name, games]) => {
        const prof = profileMap.get(name.toLowerCase()) || allProfiles.find((p) => isStreamerMatch(p.name, name));
        return { name, games, profile: prof };
      });

      list.sort((a, b) => {
        // Wooriming always top in adc
        if (line === 'adc') {
          if (isWooriming(a.name)) return -1;
          if (isWooriming(b.name)) return 1;
        }
        return b.games - a.games || a.name.localeCompare(b.name);
      });

      candidates[line] = list;
    }

    return candidates;
  }, [matches, allProfiles, profileMap]);

  // Helper to find live broadcast for a streamer name
  const findLiveForStreamer = (streamerName: string): { profile?: StreamerProfile; live?: SoopLiveBroadcast } => {
    const prof =
      profileMap.get(streamerName.toLowerCase().trim()) ||
      allProfiles.find((p) => isStreamerMatch(p.name, streamerName));

    if (prof?.is_hidden) {
      return { profile: prof, live: undefined };
    }

    // Check by profile soop_id first
    if (prof?.soop_id) {
      const live = liveMapById.get(prof.soop_id.toLowerCase().trim());
      if (live) return { profile: prof, live };
    }

    // Fallback: search by nickname / broad_title
    const cleanTarget = normalizeStreamerName(streamerName).toLowerCase();
    for (const b of liveBroadcasts) {
      const nick = (b.user_nick || '').toLowerCase();
      const title = (b.broad_title || '').toLowerCase();
      if (nick === cleanTarget || nick.includes(cleanTarget) || title.includes(cleanTarget)) {
        return { profile: prof, live: b };
      }
    }

    return { profile: prof, live: undefined };
  };

  // Compute matched LIVE opponents for each line slot
  const matchedLiveOpponentsByLine = useMemo(() => {
    const result: Record<LineKey, MatchedLiveOpponent[]> = {
      top: [],
      jgl: [],
      mid: [],
      adc: [],
      sup: [],
    };

    for (const line of LINE_KEYS) {
      const targetStreamer = slotStreamers[line];
      if (!targetStreamer) continue;

      // Calculate opponent records in matches for this streamer on this line
      const oppRecords = calculateOpponentsForStreamer(matches, targetStreamer, line);

      for (const rec of oppRecords) {
        const { profile, live } = findLiveForStreamer(rec.opponentName);
        // Strict filter: ONLY LIVE opponents!
        if (live) {
          result[line].push({
            streamerName: rec.opponentName,
            opponentRecord: rec,
            profile,
            live,
          });
        }
      }
    }

    return result;
  }, [slotStreamers, matches, liveBroadcasts, profileMap, allProfiles, liveMapById]);

  // Total count of matched live opponents across all configured slots
  const totalMatchedLiveCount = useMemo(() => {
    let sum = 0;
    for (const line of LINE_KEYS) {
      sum += matchedLiveOpponentsByLine[line].length;
    }
    return sum;
  }, [matchedLiveOpponentsByLine]);

  if (!isOpen) return null;

  // Lines to display based on activeLine tab
  const displayLines: LineKey[] = activeLine === 'ALL' ? LINE_KEYS : [activeLine];

  const handleSelectStreamer = (line: LineKey, name: string) => {
    setSlotStreamers((prev) => ({ ...prev, [line]: name }));
    setPickerOpenLine(null);
    setActiveLine(line);
  };

  const handleClearSlot = (line: LineKey, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSlotStreamers((prev) => ({ ...prev, [line]: '' }));
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] bg-[#0c0c14] border border-[#2a2444] rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(139,92,246,0.15)] flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* 1. Modal Header                                           */}
        {/* ======================================================== */}
        <div className="relative px-6 py-5 border-b border-[#1f1b32] bg-gradient-to-r from-[#141224] via-[#16142a] to-[#141224] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8b5cf6]/30 to-[#a855f7]/10 border border-[#8b5cf6]/40 flex items-center justify-center text-[#c4b5fd] shadow-inner">
              <Swords size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[18px] sm:text-[21px] font-black text-white tracking-tight">
                  실시간 밸런스 멤버 라인업 섭외판
                </h2>
                <span className="bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#fca5a5] text-[10.5px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping" />
                  실시간 맞라인 LIVE 매칭
                </span>
              </div>
              <p className="text-[12px] sm:text-[12.5px] text-[#9a9ab0] mt-0.5">
                포지션별 기준 스트리머를 선택하면, CK 일지 맞라인 상대 중 <strong>현재 SOOP 라이브 방송 중인 멤버만</strong> 실시간으로 추출합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="SOOP 실시간 라이브 새로고침"
              className="h-[36px] px-3 bg-[#181826] hover:bg-[#24243a] border border-[#2a2a40] text-[#c4b5fd] hover:text-white rounded-xl text-[11.5px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#a78bfa]' : ''} />
              <span className="hidden sm:inline">새로고침</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#181826] hover:bg-[#252538] border border-[#2a2a40] text-[#8a8aa0] hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. Top 5 Line Streamer Selection Slots Bar                */}
        {/* ======================================================== */}
        <div className="p-4 sm:p-5 bg-[#100f1a] border-b border-[#1e1b30] shrink-0">
          <div className="flex items-center justify-between mb-3 text-[12px]">
            <span className="text-[#a0a0b8] font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#a78bfa]" />
              5개 라인 기준 스트리머 선택 슬롯
            </span>
            <div className="text-[11.5px] text-[#7a7a90] flex items-center gap-2">
              <span>매칭된 맞라인 LIVE:</span>
              <strong className="text-[#ef4444] font-black">{totalMatchedLiveCount}명</strong>
              <button
                type="button"
                onClick={() =>
                  setSlotStreamers({
                    top: '',
                    jgl: '',
                    mid: '',
                    adc: '우리밍_',
                    sup: '',
                  })
                }
                className="text-[10.5px] text-[#8a8aa0] hover:text-[#c4b5fd] underline ml-2 cursor-pointer"
              >
                기본값(우리밍_) 초기화
              </button>
            </div>
          </div>

          {/* 5 Slots Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {LINE_KEYS.map((k) => {
              const theme = LINE_THEME[k];
              const selectedName = slotStreamers[k];
              const isSlotActive = activeLine === k;
              const matchedCount = matchedLiveOpponentsByLine[k].length;
              const isW = isWooriming(selectedName);

              return (
                <div
                  key={k}
                  onClick={() => setActiveLine(k)}
                  className={`relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[92px] ${
                    isSlotActive
                      ? `${theme.borderColor} ring-2 ring-white/20 bg-[#161426] shadow-lg`
                      : 'border-[#221f38] hover:border-[#383358] bg-[#121120]'
                  }`}
                >
                  {/* Slot Top: Line Tag & Matched Live Badge */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                    >
                      {theme.name} • {theme.kr}
                    </span>

                    {selectedName && (
                      <span
                        className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md ${
                          matchedCount > 0
                            ? 'bg-[#ef4444] text-white shadow-sm'
                            : 'bg-[#1e1c2e] text-[#6e6c86]'
                        }`}
                      >
                        {matchedCount > 0 ? `LIVE ${matchedCount}` : 'LIVE 0'}
                      </span>
                    )}
                  </div>

                  {/* Slot Body: Selected Streamer or Empty Prompt */}
                  {selectedName ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <StreamerAvatar name={selectedName} size={30} shape="circle" />
                          {isW && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#8b5cf6] text-white rounded-full flex items-center justify-center">
                              <Crown size={8} className="fill-white" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-black text-white truncate flex items-center gap-1">
                            {selectedName}
                          </div>
                          <div className="text-[9.5px] text-[#8a8aa0] truncate">
                            {isW ? '기본 기준' : '기준 스트리머'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickerOpenLine(k);
                          }}
                          title="스트리머 변경"
                          className="w-6 h-6 rounded-lg bg-[#1f1d32] hover:bg-[#2c2946] text-[#c4b5fd] flex items-center justify-center text-[10px] cursor-pointer"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleClearSlot(k, e)}
                          title="선택 취소"
                          className="w-6 h-6 rounded-lg bg-[#1f1d32] hover:bg-[#ef4444]/20 hover:text-[#ef4444] text-[#8a8aa0] flex items-center justify-center text-[10px] cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPickerOpenLine(k);
                        setActiveLine(k);
                      }}
                      className="w-full py-2 border border-dashed border-[#343054] hover:border-[#8b5cf6] hover:bg-[#1a1730] rounded-xl text-[11px] font-bold text-[#8a8aa0] hover:text-[#c4b5fd] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>+ 스트리머 선택</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Line View Filter Tabs */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#1a182c] overflow-x-auto scrollbar-hide">
            <span className="text-[11px] text-[#6e6c86] mr-1 hidden sm:inline">섭외판 조회:</span>
            <button
              type="button"
              onClick={() => setActiveLine('ALL')}
              className={`h-[30px] px-3.5 rounded-xl text-[11.5px] font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                activeLine === 'ALL'
                  ? 'bg-white text-black border-white shadow-md font-black'
                  : 'bg-[#121120] text-[#8a8aa0] hover:text-white border-[#221f36]'
              }`}
            >
              <span>전체 라인업</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#ef4444] text-white font-black">
                {totalMatchedLiveCount}
              </span>
            </button>

            {LINE_KEYS.map((k) => {
              const theme = LINE_THEME[k];
              const isSelected = activeLine === k;
              const count = matchedLiveOpponentsByLine[k].length;
              const slotTarget = slotStreamers[k];

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveLine(k)}
                  className={`h-[30px] px-3 rounded-xl text-[11.5px] font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? `${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder} ring-1 ring-white/20 font-black shadow-sm`
                      : 'bg-[#121120] text-[#8a8aa0] hover:text-white border-[#221f36]'
                  }`}
                >
                  <span>{theme.name}</span>
                  {slotTarget && <span className="text-[10.5px] text-white/90">({slotTarget})</span>}
                  <span
                    className={`text-[9.5px] px-1.5 py-0.2 rounded-full ${
                      count > 0 ? 'bg-[#ef4444] text-white font-black' : 'bg-[#1e1c2e] text-[#6e6c86]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. Modal Body: Matched Live Opponents Content             */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {displayLines.map((lineKey) => {
            const theme = LINE_THEME[lineKey];
            const targetStreamer = slotStreamers[lineKey];
            const liveOpponents = matchedLiveOpponentsByLine[lineKey];
            const isAdc = lineKey === 'adc';

            return (
              <div
                key={lineKey}
                className="bg-[#11101d] border border-[#201c36] rounded-[24px] p-4 sm:p-5 shadow-lg"
              >
                {/* Line Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b border-[#201c36] gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`h-[26px] px-2.5 rounded-lg font-black text-[11px] flex items-center justify-center border shadow-sm ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                    >
                      {theme.name} ({theme.kr})
                    </span>
                    <h3 className="text-[15px] font-black text-white tracking-tight flex items-center gap-2">
                      {targetStreamer ? (
                        <>
                          <span>기준: <strong className="text-[#c4b5fd]">{targetStreamer}</strong></span>
                          <span className="text-[#7a7a90] text-[12px] font-normal">맞라인 실시간 LIVE 멤버</span>
                        </>
                      ) : (
                        <span className="text-[#8a8aa0]">{theme.kr} 라인 (기준 미선택)</span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {targetStreamer ? (
                      <span className="text-[11px] font-bold text-[#8a8aa0] bg-[#171528] px-2.5 py-1 rounded-full border border-[#262242]">
                        매칭된 LIVE: <strong className="text-[#ef4444] font-black">{liveOpponents.length}명</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPickerOpenLine(lineKey);
                          setActiveLine(lineKey);
                        }}
                        className="text-[11px] text-[#c4b5fd] hover:text-white bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 px-2.5 py-1 rounded-full font-bold transition cursor-pointer"
                      >
                        + {theme.kr} 기준 스트리머 선택하기
                      </button>
                    )}
                  </div>
                </div>

                {/* If no streamer selected in slot */}
                {!targetStreamer ? (
                  <div className="p-8 text-center bg-[#0d0c18] rounded-[20px] border border-[#1d1a32] space-y-3">
                    <Tv size={30} className="mx-auto text-[#443e68]" />
                    <div className="max-w-md mx-auto space-y-1">
                      <p className="text-[13.5px] font-bold text-[#a09cb8]">
                        상단 슬롯에서 {theme.kr}({theme.name}) 기준 스트리머를 지정해 주세요.
                      </p>
                      <p className="text-[11.5px] text-[#6a6686]">
                        선택된 스트리머와 CK 일지에서 상대한 맞라인 라이브 멤버를 즉시 찾아드립니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpenLine(lineKey);
                        setActiveLine(lineKey);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] hover:from-[#7c3aed] hover:to-[#9333ea] text-white rounded-xl text-[12px] font-bold transition shadow-md cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <UserCheck size={14} />
                      <span>{theme.kr} 스트리머 선택하기</span>
                    </button>
                  </div>
                ) : liveOpponents.length > 0 ? (
                  /* Matched Live Opponent Cards Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {liveOpponents.map(({ streamerName, opponentRecord, profile, live }) => {
                      const cleanId = profile?.soop_id || live.user_id;
                      const stationUrl = `https://play.sooplive.co.kr/${cleanId}`;
                      const thumbUrl = live.broad_thumb
                        ? live.broad_thumb.startsWith('//')
                          ? `https:${live.broad_thumb}`
                          : live.broad_thumb
                        : null;
                      const isTargetW = isWooriming(targetStreamer);

                      return (
                        <a
                          key={streamerName}
                          href={stationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${streamerName} SOOP 라이브 방송 바로가기 (새 창)`}
                          className="group relative rounded-[20px] overflow-hidden border border-[#221f3a] hover:border-[#8b5cf6]/60 bg-[#141224] hover:bg-[#18162e] transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-[0_12px_30px_rgba(0,0,0,0.7)]"
                        >
                          {/* Live Thumbnail Preview */}
                          <div className="relative aspect-video w-full bg-[#090812] overflow-hidden">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={live.broad_title || streamerName}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#100f1c]">
                                <Tv className="text-[#322d50]" size={38} />
                              </div>
                            )}

                            {/* Overlays: LIVE badge & Viewers */}
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                              <span className="flex items-center gap-1.5 bg-[#ef4444] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                LIVE
                              </span>
                            </div>

                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/75 backdrop-blur-md text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full z-10">
                              <Users size={11} className="text-[#a09cb8]" />
                              <span>{formatViewerCount(live.total_view_cnt)}</span>
                            </div>

                            {/* Play hover button */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 z-10">
                              <div className="w-11 h-11 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                                <Play size={18} className="fill-white translate-x-0.5" />
                              </div>
                            </div>
                          </div>

                          {/* Card Content */}
                          <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
                            {/* Profile & VS Record */}
                            <div>
                              <div className="flex items-center gap-2.5">
                                <div className="relative shrink-0">
                                  <StreamerAvatar name={streamerName} size={38} shape="circle" />
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ef4444] border-2 border-[#141224] rounded-full" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[13.5px] font-black text-white truncate group-hover:text-[#c4b5fd] transition-colors">
                                      {streamerName}
                                    </span>
                                    <span
                                      className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                                    >
                                      {theme.name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#7a7896] truncate">
                                    {live.user_nick || `@${cleanId}`}
                                  </div>
                                </div>
                              </div>

                              {/* Relative VS Match Record Tag */}
                              <div className="mt-2.5 p-2 rounded-xl bg-[#0e0d1a] border border-[#1f1c34] flex items-center justify-between text-[11px]">
                                <span className="text-[#8a88a6] flex items-center gap-1 font-medium truncate">
                                  <Swords size={12} className="text-[#a78bfa] shrink-0" />
                                  <span>vs {targetStreamer}</span>
                                </span>
                                <span className="font-extrabold text-white shrink-0">
                                  {opponentRecord.games}전{' '}
                                  <span className="text-[#34d399]">{opponentRecord.opponentWins}승</span>{' '}
                                  <span className="text-[#f87171]">{opponentRecord.opponentLosses}패</span>{' '}
                                  <span className="text-[#c4b5fd]">({opponentRecord.opponentWinRate}%)</span>
                                </span>
                              </div>
                            </div>

                            {/* Broadcast Title */}
                            <p
                              className="text-[12px] text-[#dedcf0] font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors"
                              title={live.broad_title}
                            >
                              {live.broad_title || 'SOOP 라이브 방송 중'}
                            </p>

                            {/* Card Footer: Uptime & Direct Link */}
                            <div className="pt-2 border-t border-[#1e1b32] flex items-center justify-between text-[10.5px] text-[#787594]">
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {formatRelativeTime(live.broad_start) || '방송 중'}
                              </span>
                              <span className="text-[#a78bfa] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                섭외/방송국 <ExternalLink size={11} />
                              </span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  /* Streamer selected, but 0 live opponents currently */
                  <div className="p-8 text-center bg-[#0d0c18] rounded-[20px] border border-[#1d1a32] space-y-2">
                    <Tv size={26} className="mx-auto text-[#4a466a]" />
                    <p className="text-[13px] font-bold text-[#a09cb8]">
                      '{targetStreamer}'님과 맞라인 전적이 있는 멤버 중 현재 방송 중인 스트리머가 없습니다.
                    </p>
                    <p className="text-[11px] text-[#6a6686]">
                      상대 멤버들이 라이브를 시작하면 실시간으로 감지되어 이 목록에 바로 나타납니다.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* 4. Streamer Selector Popover / Dropdown Modal             */}
        {/* ======================================================== */}
        {pickerOpenLine && (
          <div
            className="fixed inset-0 z-[100010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.1s]"
            onClick={() => setPickerOpenLine(null)}
          >
            <div
              className="relative w-full max-w-md bg-[#121020] border border-[#302a50] rounded-[24px] shadow-2xl p-5 overflow-hidden text-white space-y-3.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#221e3a]">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${LINE_THEME[pickerOpenLine].badgeBg} ${LINE_THEME[pickerOpenLine].badgeText} ${LINE_THEME[pickerOpenLine].badgeBorder}`}
                  >
                    {LINE_THEME[pickerOpenLine].name}
                  </span>
                  <h4 className="text-[15px] font-black text-white">
                    {LINE_THEME[pickerOpenLine].kr} 기준 스트리머 선택
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpenLine(null)}
                  className="w-7 h-7 rounded-lg bg-[#1a172e] hover:bg-[#282346] text-[#8a8aa0] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7896]" />
                <input
                  ref={pickerInputRef}
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="스트리머 닉네임 검색..."
                  className="w-full h-[38px] bg-[#0a0914] border border-[#2a2446] rounded-xl pl-9 pr-3 text-[12.5px] text-white focus:outline-none focus:border-[#8b5cf6] placeholder-[#5c5878]"
                />
              </div>

              {/* Candidate Streamers List */}
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {lineCandidates[pickerOpenLine]
                  .filter((c) => {
                    if (!pickerSearch.trim()) return true;
                    return c.name.toLowerCase().includes(pickerSearch.trim().toLowerCase());
                  })
                  .map((cand) => {
                    const isSelected = slotStreamers[pickerOpenLine] === cand.name;
                    const isW = isWooriming(cand.name);

                    return (
                      <button
                        key={cand.name}
                        type="button"
                        onClick={() => handleSelectStreamer(pickerOpenLine, cand.name)}
                        className={`w-full p-2.5 rounded-xl border transition flex items-center justify-between text-left cursor-pointer ${
                          isSelected
                            ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-white font-black'
                            : 'bg-[#151326] hover:bg-[#1f1c38] border-[#221f3a] text-[#dedcf0]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StreamerAvatar name={cand.name} size={32} shape="circle" />
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-white flex items-center gap-1.5 truncate">
                              <span>{cand.name}</span>
                              {isW && (
                                <span className="text-[9.5px] bg-[#8b5cf6] text-white px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                  <Crown size={9} className="fill-white" />
                                  우리밍_
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#7a7896]">
                              {cand.games > 0 ? `CK ${cand.games}경기 출전` : '등록 멤버'}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center shrink-0">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* Clear Option */}
              <div className="pt-2 border-t border-[#201c36] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    handleClearSlot(pickerOpenLine);
                    setPickerOpenLine(null);
                  }}
                  className="text-[11.5px] text-[#f87171] hover:underline cursor-pointer"
                >
                  선택 취소(비우기)
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpenLine(null)}
                  className="px-3.5 py-1.5 bg-[#201c36] hover:bg-[#2c264a] text-white rounded-lg text-[11.5px] font-bold cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
