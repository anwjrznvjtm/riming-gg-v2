import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LineKey,
  LINE_KEYS,
  LINE_LABELS,
  StreamerProfile,
  SoopLiveBroadcast,
  LiveStreamerMember,
  Match,
} from '../types';
import { matchStreamersWithLiveBroadcasts, saveStreamerProfilesBatchAsync, syncStreamersFromBackend } from '../lib/streamerApi';
import {
  normalizeStreamerName,
  isStreamerMatch,
  getRosterPlayerAtRole,
} from '../lib/stats';
import { StreamerAvatar } from './StreamerAvatar';
import {
  X,
  Search,
  ExternalLink,
  Users,
  Clock,
  Play,
  RefreshCw,
  Crown,
  Flame,
  Swords,
  ChevronDown,
  Edit3,
  Copy,
  RotateCcw,
  Save,
  Lock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

export interface CkMemberFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  allProfiles: StreamerProfile[];
  liveBroadcasts: SoopLiveBroadcast[];
  onRefresh?: () => void;
  isLoading?: boolean;
  isAdmin?: boolean;
  onToast?: (msg: string) => void;
  onProfilesUpdated?: (updated: StreamerProfile[]) => void;
}

const LINE_CONFIG: Record<
  LineKey,
  {
    name: string;
    kr: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  top: {
    name: 'TOP',
    kr: '탑',
    badgeBg: 'bg-[#f97316]/15',
    badgeText: 'text-[#fb923c]',
    badgeBorder: 'border-[#f97316]/40',
  },
  jgl: {
    name: 'JGL',
    kr: '정글',
    badgeBg: 'bg-[#10b981]/15',
    badgeText: 'text-[#34d399]',
    badgeBorder: 'border-[#10b981]/40',
  },
  mid: {
    name: 'MID',
    kr: '미드',
    badgeBg: 'bg-[#06b6d4]/15',
    badgeText: 'text-[#22d3ee]',
    badgeBorder: 'border-[#06b6d4]/40',
  },
  adc: {
    name: 'ADC',
    kr: '원딜',
    badgeBg: 'bg-[#a855f7]/15',
    badgeText: 'text-[#c084fc]',
    badgeBorder: 'border-[#a855f7]/40',
  },
  sup: {
    name: 'SUP',
    kr: '서폿',
    badgeBg: 'bg-[#eab308]/15',
    badgeText: 'text-[#facc15]',
    badgeBorder: 'border-[#eab308]/40',
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

function getMatchWinningTeam(m: Match): 'Red' | 'Blue' | null {
  const win = (m.winning_team || '').trim().toLowerCase();
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
    return 'Red';
  }
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
    return 'Blue';
  }
  if (m.score) {
    const parts = m.score.split(':').map((s) => parseInt(s.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > parts[1]) return 'Red';
      if (parts[1] > parts[0]) return 'Blue';
    }
  }
  return null;
}

interface HeadToHeadStat {
  games: number;
  redWins: number;
  blueWins: number;
  redWinRate: number;
}

interface SlotSelection {
  playerName: string;
  isCustomText?: boolean;
}

interface LiveOpponentCandidate {
  name: string;
  games: number;
  redWins: number;
  blueWins: number;
  liveMember: LiveStreamerMember;
}

const createEmptyRoster = (): Record<LineKey, SlotSelection> => ({
  top: { playerName: '' },
  jgl: { playerName: '' },
  mid: { playerName: '' },
  adc: { playerName: '' },
  sup: { playerName: '' },
});

export const CkMemberFinderModal: React.FC<CkMemberFinderModalProps> = ({
  isOpen,
  onClose,
  matches,
  allProfiles,
  liveBroadcasts,
  onRefresh,
  isLoading = false,
  isAdmin = false,
  onToast = (_msg: string) => {},
  onProfilesUpdated = (_updated: StreamerProfile[]) => {},
}) => {
  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // =========================================================================
  // 1. Strict LIVE Filtering (Excludes OFFLINE and is_hidden: true)
  // =========================================================================
  const strictlyLiveMembers = useMemo(() => {
    const { liveMembers } = matchStreamersWithLiveBroadcasts(allProfiles, liveBroadcasts);
    return liveMembers.filter((m) => {
      if (!m.isLive || !m.live) return false;
      if (m.profile.is_hidden) return false;
      return true;
    });
  }, [allProfiles, liveBroadcasts]);

  // Map live streamers by lowercase / normalized identifiers
  const liveByName = useMemo(() => {
    const map = new Map<string, LiveStreamerMember>();
    for (const m of strictlyLiveMembers) {
      const norm = normalizeStreamerName(m.profile.name).toLowerCase();
      map.set(norm, m);
      map.set(m.profile.name.toLowerCase().trim(), m);
      if (m.profile.soop_id) {
        map.set(m.profile.soop_id.toLowerCase().trim(), m);
      }
      if (m.live?.user_id) {
        map.set(m.live.user_id.toLowerCase().trim(), m);
      }
    }
    return map;
  }, [strictlyLiveMembers]);

  // Group strictly live members by position
  const liveByPosition = useMemo(() => {
    const groups: Record<LineKey, LiveStreamerMember[]> = {
      top: [],
      jgl: [],
      mid: [],
      adc: [],
      sup: [],
    };
    for (const m of strictlyLiveMembers) {
      const pos = m.profile.main_position || 'mid';
      groups[pos].push(m);
    }
    for (const k of LINE_KEYS) {
      groups[k].sort((a, b) => {
        const va = parseInt(String(a.live?.total_view_cnt || 0), 10);
        const vb = parseInt(String(b.live?.total_view_cnt || 0), 10);
        return vb - va;
      });
    }
    return groups;
  }, [strictlyLiveMembers]);

  // =========================================================================
  // 2. Initial State: COMPLETELY EMPTY (No auto-fill on mount)
  // =========================================================================
  const [redTeam, setRedTeam] = useState<Record<LineKey, SlotSelection>>(createEmptyRoster);
  const [blueTeam, setBlueTeam] = useState<Record<LineKey, SlotSelection>>(createEmptyRoster);

  // When modal is reopened, reset to empty roster
  useEffect(() => {
    if (isOpen) {
      setRedTeam(createEmptyRoster());
      setBlueTeam(createEmptyRoster());
      setOpenDropdown(null);
      setEditingCustomSlot(null);
    }
  }, [isOpen]);

  // Active dropdown and custom edit state
  const [openDropdown, setOpenDropdown] = useState<{ team: 'Red' | 'Blue'; line: LineKey } | null>(null);
  const [editingCustomSlot, setEditingCustomSlot] = useState<{ team: 'Red' | 'Blue'; line: LineKey } | null>(null);
  const [customInputText, setCustomInputText] = useState<string>('');
  const [candidateSearchText, setCandidateSearchText] = useState<string>('');
  const [customSoopIdInput, setCustomSoopIdInput] = useState<string>('');

  // =========================================================================
  // 3. Strict CK Match History Head-to-Head & Opponent Extraction
  // =========================================================================
  const calculateHeadToHead = (pRed: string, pBlue: string, line: LineKey): HeadToHeadStat => {
    let games = 0;
    let redWins = 0;
    let blueWins = 0;

    for (const m of matches) {
      const pA = getRosterPlayerAtRole(m.team_a, line);
      const pB = getRosterPlayerAtRole(m.team_b, line);
      if (!pA || !pB) continue;

      const isRedA = isStreamerMatch(pA, pRed);
      const isRedB = isStreamerMatch(pB, pRed);
      const isBlueA = isStreamerMatch(pA, pBlue);
      const isBlueB = isStreamerMatch(pB, pBlue);

      const wt = getMatchWinningTeam(m);

      // Case 1: pRed on Team A (Red) and pBlue on Team B (Blue)
      if (isRedA && isBlueB) {
        games++;
        if (wt === 'Red') redWins++;
        else if (wt === 'Blue') blueWins++;
      }
      // Case 2: pRed on Team B (Blue) and pBlue on Team A (Red)
      else if (isRedB && isBlueA) {
        games++;
        if (wt === 'Blue') redWins++;
        else if (wt === 'Red') blueWins++;
      }
    }

    return {
      games,
      redWins,
      blueWins,
      redWinRate: games > 0 ? Math.round((redWins / games) * 100) : 50,
    };
  };

  // Extract strictly verified lane opponents who actually played against pRed in matches
  const getLiveOpponentsForRed = (pRed: string, line: LineKey): LiveOpponentCandidate[] => {
    if (!pRed.trim()) return [];

    const oppStats = new Map<
      string,
      {
        canonicalName: string;
        games: number;
        redWins: number;
        blueWins: number;
      }
    >();

    for (const m of matches) {
      const pA = getRosterPlayerAtRole(m.team_a, line);
      const pB = getRosterPlayerAtRole(m.team_b, line);
      if (!pA || !pB) continue;

      const isRedA = isStreamerMatch(pA, pRed);
      const isRedB = isStreamerMatch(pB, pRed);

      // Must be on exactly one team in this lane
      if ((isRedA && isRedB) || (!isRedA && !isRedB)) continue;

      const oppRaw = isRedA ? pB : pA;
      const oppNorm = normalizeStreamerName(oppRaw);
      if (!oppNorm || isStreamerMatch(oppNorm, pRed)) continue;

      const oppKey = oppNorm.toLowerCase();
      if (!oppStats.has(oppKey)) {
        oppStats.set(oppKey, {
          canonicalName: oppNorm,
          games: 0,
          redWins: 0,
          blueWins: 0,
        });
      }

      const stat = oppStats.get(oppKey)!;
      stat.games += 1;

      const wt = getMatchWinningTeam(m);
      if (isRedA) {
        if (wt === 'Red') stat.redWins += 1;
        else if (wt === 'Blue') stat.blueWins += 1;
      } else {
        if (wt === 'Blue') stat.redWins += 1;
        else if (wt === 'Red') stat.blueWins += 1;
      }
    }

    // Filter ONLY opponents who are currently LIVE and NOT hidden
    const candidates: LiveOpponentCandidate[] = [];
    for (const [key, stat] of oppStats.entries()) {
      const liveMember =
        liveByName.get(key) || liveByName.get(stat.canonicalName.toLowerCase());
      if (
        liveMember &&
        liveMember.isLive &&
        liveMember.live &&
        !liveMember.profile.is_hidden
      ) {
        candidates.push({
          name: liveMember.profile.name,
          games: stat.games,
          redWins: stat.redWins,
          blueWins: stat.blueWins,
          liveMember,
        });
      }
    }

    // Sort by games played against DESC, then viewers DESC
    candidates.sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      const va = parseInt(String(a.liveMember.live?.total_view_cnt || 0), 10);
      const vb = parseInt(String(b.liveMember.live?.total_view_cnt || 0), 10);
      return vb - va;
    });

    return candidates;
  };

  // =========================================================================
  // 4. Handle Red Team Selection & Strictly Matched Blue Auto-update
  // =========================================================================
  const handleSelectRedPlayer = (line: LineKey, selected: SlotSelection) => {
    setRedTeam((prev) => ({ ...prev, [line]: selected }));

    // Find verified historical live opponents
    if (selected.playerName) {
      const opps = getLiveOpponentsForRed(selected.playerName, line);
      if (opps.length > 0) {
        // Auto-match ONLY if there is a verified historical live opponent
        setBlueTeam((prev) => ({ ...prev, [line]: { playerName: opps[0].name } }));
      } else {
        // DEFENSE RULE: Do NOT auto-match anyone without match history!
        setBlueTeam((prev) => ({ ...prev, [line]: { playerName: '' } }));
      }
    } else {
      setBlueTeam((prev) => ({ ...prev, [line]: { playerName: '' } }));
    }

    setOpenDropdown(null);
  };

  const handleSelectBluePlayer = (line: LineKey, selected: SlotSelection) => {
    setBlueTeam((prev) => ({ ...prev, [line]: selected }));
    setOpenDropdown(null);
  };

  // Reset all slots to completely empty
  const handleResetLineup = () => {
    setRedTeam(createEmptyRoster());
    setBlueTeam(createEmptyRoster());
    setOpenDropdown(null);
    setEditingCustomSlot(null);
    onToast('섭외판 라인업이 모두 초기화되었습니다 (빈 칸 상태).');
  };

  // Copy lineup to clipboard
  const handleCopyLineup = () => {
    const text =
      `[CK 밸런스 멤버 섭외 라인업]\n` +
      `🔴 Red팀 vs 🔵 Blue팀\n` +
      LINE_KEYS.map((k) => {
        const label = LINE_LABELS[k];
        const r = redTeam[k].playerName || '미정';
        const b = blueTeam[k].playerName || '미정';
        return `[${label}] ${r} vs ${b}`;
      }).join('\n');

    navigator.clipboard.writeText(text);
    onToast('5:5 라인업이 클립보드에 복사되었습니다!');
  };

  // Close dropdown on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Admin DB saving
  const handleAdminSaveStreamer = async (playerName: string, line: LineKey) => {
    if (!isAdmin) {
      onToast('스트리머 DB 저장은 관리자 권한이 필요합니다.');
      return;
    }
    const cleanName = playerName.trim();
    if (!cleanName) return;

    try {
      await saveStreamerProfilesBatchAsync([
        {
          name: cleanName,
          soop_id: customSoopIdInput.trim() || '',
          main_position: line,
          is_hidden: false,
        },
      ]);
      const fresh = await syncStreamersFromBackend(true);
      onProfilesUpdated(fresh);
      onToast(`[${cleanName}] 스트리머가 DB에 성공적으로 등록되었습니다.`);
      setEditingCustomSlot(null);
      setCustomSoopIdInput('');
    } catch {
      onToast('스트리머 저장 중 오류가 발생했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s]">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-6xl max-h-[94vh] bg-[#0c0c14] border border-[#2a2444] rounded-[28px] shadow-[0_20px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(139,92,246,0.18)] flex flex-col overflow-hidden">
        
        {/* ================================================================= */}
        {/* Header Bar                                                        */}
        {/* ================================================================= */}
        <div className="p-4 sm:p-5 border-b border-[#1e1e2e] bg-gradient-to-r from-[#161226] via-[#100f1c] to-[#161226] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ef4444] via-[#8b5cf6] to-[#3b82f6] flex items-center justify-center text-white shadow-lg">
                <Swords size={18} className="stroke-[2.5]" />
              </div>
              <h2 className="text-[18px] sm:text-[21px] font-black text-white tracking-tight flex items-center gap-2">
                CK 밸런스 멤버 1:1 맞라인 라이브 섭외판
              </h2>
              <span className="inline-flex items-center gap-1.5 bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#fca5a5] text-[11px] font-black px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-ping" />
                CK일지 맞라인 대결 기록 기반 LIVE 연동
              </span>
            </div>
            <p className="text-[12px] sm:text-[12.5px] text-[#9a9ab0] mt-1 leading-relaxed">
              Red팀(기준) 선수를 클릭하여 선택하면, CK일지에서 맞라인 대결 기록이 있는 <strong className="text-[#a78bfa]">실시간 LIVE 방송 중인 상대만</strong> Blue팀 후보로 엄격하게 추천됩니다.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                title="실시간 방송 새로고침"
                className="h-[36px] px-3 bg-[#1e1e2e] hover:bg-[#2a2a40] border border-[#2e2e42] text-white rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#a78bfa]' : ''} />
                <span className="hidden sm:inline">새로고침</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLineup}
              title="라인업 복사"
              className="h-[36px] px-3 bg-[#1e1e2e] hover:bg-[#2a2a40] border border-[#2e2e42] text-[#c4b5fd] hover:text-white rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Copy size={13} />
              <span>라인업 복사</span>
            </button>

            <button
              type="button"
              onClick={handleResetLineup}
              title="초기화 (빈 칸으로 리셋)"
              className="h-[36px] px-3 bg-[#1e1e2e] hover:bg-[#2a2a40] border border-[#2e2e42] text-[#8a8aa0] hover:text-white rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>초기화</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="닫기 (ESC)"
              className="w-9 h-9 rounded-xl bg-[#1e1e2e] hover:bg-[#ef4444]/20 border border-[#2e2e42] hover:border-[#ef4444]/40 text-[#a0a0b8] hover:text-[#fca5a5] flex items-center justify-center transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Main Content: 1:1 Matching Board                                   */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-[#08080f] space-y-4">
          
          {/* Column Headers: Red Team vs Blue Team */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Red Team Header */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#281116] via-[#1a0e14] to-[#120a10] border border-[#ef4444]/40 shadow-lg shadow-[#ef4444]/10">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-[#ef4444] animate-pulse shadow-[0_0_10px_#ef4444]" />
                <h3 className="text-[15px] font-black text-[#fca5a5] tracking-tight">
                  🔴 Red팀 (기준 선수 선택)
                </h3>
              </div>
              <span className="text-[11px] text-[#f87171] font-bold bg-[#ef4444]/15 px-2.5 py-0.5 rounded-full border border-[#ef4444]/30">
                원하는 라인을 클릭하여 선택
              </span>
            </div>

            {/* Blue Team Header */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#0c1a30] via-[#0b1526] to-[#080f1c] border border-[#3b82f6]/40 shadow-lg shadow-[#3b82f6]/10">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-[#3b82f6] animate-pulse shadow-[0_0_10px_#3b82f6]" />
                <h3 className="text-[15px] font-black text-[#93c5fd] tracking-tight">
                  🔵 Blue팀 (맞라인 라이브 상대)
                </h3>
              </div>
              <span className="text-[11px] text-[#60a5fa] font-bold bg-[#3b82f6]/15 px-2.5 py-0.5 rounded-full border border-[#3b82f6]/30">
                대결 기록 있는 LIVE 상대만 후보 노출
              </span>
            </div>
          </div>

          {/* 5 Rows: TOP / JGL / MID / ADC / SUP 1:1 Matching */}
          <div className="space-y-3.5">
            {LINE_KEYS.map((line) => {
              const cfg = LINE_CONFIG[line];
              const redSlot = redTeam[line];
              const blueSlot = blueTeam[line];

              // Head to head stats if both have player names
              const h2h =
                redSlot.playerName && blueSlot.playerName
                  ? calculateHeadToHead(redSlot.playerName, blueSlot.playerName, line)
                  : null;

              // Available live opponents for this red player
              const liveOpps = redSlot.playerName
                ? getLiveOpponentsForRed(redSlot.playerName, line)
                : [];

              return (
                <div
                  key={line}
                  className="rounded-[22px] bg-[#0e0e17] border border-[#1e1e2d] hover:border-[#2f2f48] transition-colors p-3 sm:p-4 shadow-md relative"
                >
                  {/* Position Center Badge */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#181826]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11.5px] font-black border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                      >
                        {cfg.name} ({cfg.kr})
                      </span>
                      <span className="text-[11px] text-[#7a7a90]">
                        현재 해당 라인 LIVE: <strong className="text-white font-bold">{liveByPosition[line].length}명</strong>
                      </span>
                      {redSlot.playerName && (
                        <span className="text-[10.5px] text-[#a78bfa] font-bold bg-[#8b5cf6]/10 px-2 py-0.2 rounded-md border border-[#8b5cf6]/20">
                          맞라인 LIVE 상대: {liveOpps.length}명
                        </span>
                      )}
                    </div>

                    {/* Head-to-Head Record Badge if available */}
                    {h2h && h2h.games > 0 && (
                      <div className="flex items-center gap-2 text-[11px] font-bold bg-[#141422] border border-[#26263a] px-2.5 py-1 rounded-xl">
                        <Swords size={12} className="text-[#a78bfa]" />
                        <span className="text-[#a0a0b8]">맞라인 전적:</span>
                        <span className="text-[#fca5a5] font-black">{h2h.redWins}승</span>
                        <span className="text-[#5a5a70]">-</span>
                        <span className="text-[#93c5fd] font-black">{h2h.blueWins}승</span>
                        <span className="text-[#7a7a90]">
                          ({h2h.games}전, 승률 {h2h.redWinRate}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 1:1 Pair Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                    
                    {/* ======================================================= */}
                    {/* RED SLOT                                                */}
                    {/* ======================================================= */}
                    <div className="relative">
                      {renderRedSlotCard(line, redSlot)}
                    </div>

                    {/* ======================================================= */}
                    {/* BLUE SLOT                                               */}
                    {/* ======================================================= */}
                    <div className="relative">
                      {renderBlueSlotCard(line, blueSlot, redSlot.playerName, liveOpps)}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* ================================================================= */}
        {/* Footer Info & Note                                                */}
        {/* ================================================================= */}
        <div className="p-3.5 sm:p-4 border-t border-[#1e1e2e] bg-[#0a0a12] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11.5px] text-[#7a7a90] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>오프라인 및 숨김 스트리머는 제외되며, 대결 기록이 없는 선수는 자동 매칭되지 않습니다.</span>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-2 py-0.5 rounded-md">
                <Lock size={10} />
                선수 직접 입력은 임의 표기만 가능하며, DB 저장은 관리자 전용입니다.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1a1a28] hover:bg-[#252538] text-white rounded-xl font-bold transition cursor-pointer border border-[#2a2a3e] self-end sm:self-auto"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );

  // =========================================================================
  // Render RED Team Slot Card
  // =========================================================================
  function renderRedSlotCard(line: LineKey, slot: SlotSelection) {
    const isDropdownOpen = openDropdown?.team === 'Red' && openDropdown?.line === line;
    const isEditingCustom = editingCustomSlot?.team === 'Red' && editingCustomSlot?.line === line;
    const isSelected = Boolean(slot.playerName);

    const liveMember = isSelected
      ? liveByName.get(normalizeStreamerName(slot.playerName).toLowerCase())
      : undefined;
    const isLive = Boolean(liveMember?.isLive && liveMember?.live);
    const live = liveMember?.live;
    const cleanId = liveMember?.profile?.soop_id || live?.user_id || '';
    const stationUrl = cleanId ? `https://play.sooplive.co.kr/${cleanId}` : null;
    const isW = slot.playerName === '우리밍_' || slot.playerName === '우리밍';

    // Inline custom edit mode
    if (isEditingCustom) {
      return renderInlineCustomEdit('Red', line, (val) => handleSelectRedPlayer(line, val));
    }

    return (
      <div
        className={`rounded-2xl p-3 border transition-all duration-200 flex flex-col justify-between min-h-[96px] ${
          isSelected
            ? 'bg-gradient-to-r from-[#170e12] to-[#110e14] border-[#ef4444]/40 hover:border-[#ef4444]/70'
            : 'bg-[#100e14]/50 border-dashed border-[#ef4444]/25 hover:border-[#ef4444]/50'
        } ${isW ? 'ring-2 ring-[#a855f7]/50' : ''}`}
      >
        {/* Top: Avatar + Player Info or Empty Placeholder */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <StreamerAvatar name={slot.playerName || '?'} size={38} shape="circle" />
              {isLive && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ef4444] border-2 border-[#110e14] rounded-full animate-pulse" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0">
              {isSelected ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13.5px] font-black text-white truncate">
                      {slot.playerName}
                    </span>
                    {isW && (
                      <span className="text-[9px] bg-[#8b5cf6] text-white font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                        <Crown size={9} className="fill-white" />
                        우리밍_
                      </span>
                    )}
                    {slot.isCustomText && (
                      <span className="text-[9px] bg-[#222232] text-[#f59e0b] border border-[#f59e0b]/30 font-bold px-1.5 py-0.2 rounded-full">
                        임의 입력
                      </span>
                    )}
                    {isLive && (
                      <span className="bg-[#ef4444] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  {isLive && live ? (
                    <div className="flex items-center gap-2 text-[10.5px] text-[#a0a0b8] mt-0.5">
                      <span className="flex items-center gap-0.5 text-[#fbbf24] font-bold">
                        <Flame size={11} className="fill-[#fbbf24]" />
                        {formatViewerCount(live.total_view_cnt)}명
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-[#7a7a90]">
                        <Clock size={10} />
                        {formatRelativeTime(live.broad_start)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-[#7a7a90]">
                      {slot.isCustomText ? '비방송/임의 선수' : '방송 정보 없음'}
                    </span>
                  )}
                </>
              ) : (
                <div
                  onClick={() => {
                    setOpenDropdown({ team: 'Red', line });
                    setCandidateSearchText('');
                  }}
                  className="cursor-pointer"
                >
                  <div className="text-[13px] font-bold text-[#8a8aa0] hover:text-white transition-colors">
                    선수 미선택 (클릭하여 선택)
                  </div>
                  <div className="text-[10.5px] text-[#ef4444]/80 mt-0.5">
                    현재 방송 중인 {LINE_LABELS[line]} 스트리머 {liveByPosition[line].length}명 선택 가능
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Dropdown Toggle & Direct Text Edit */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isDropdownOpen) {
                  setOpenDropdown(null);
                } else {
                  setOpenDropdown({ team: 'Red', line });
                  setCandidateSearchText('');
                }
              }}
              className="h-[28px] px-2.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border bg-[#ef4444]/15 hover:bg-[#ef4444]/30 text-[#fca5a5] border-[#ef4444]/30"
            >
              <span>{isSelected ? '변경' : '선택'}</span>
              <ChevronDown size={12} className={isDropdownOpen ? 'rotate-180 transition-transform' : ''} />
            </button>

            {isSelected && (
              <button
                type="button"
                onClick={() => handleSelectRedPlayer(line, { playerName: '' })}
                title="선택 해제"
                className="w-[28px] h-[28px] rounded-xl bg-[#1a1a28] hover:bg-[#ef4444]/20 text-[#8a8aa0] hover:text-[#fca5a5] flex items-center justify-center transition border border-[#2a2a3e] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingCustomSlot({ team: 'Red', line });
                setCustomInputText(slot.playerName || '');
                setCustomSoopIdInput('');
              }}
              title="선수 이름 직접 입력"
              className="w-[28px] h-[28px] rounded-xl bg-[#1a1a28] hover:bg-[#282840] text-[#8a8aa0] hover:text-white flex items-center justify-center transition border border-[#2a2a3e] cursor-pointer"
            >
              <Edit3 size={12} />
            </button>
          </div>
        </div>

        {/* Bottom: Broadcast Title & Station Link */}
        <div className="mt-2 pt-2 border-t border-[#1a1a28] flex items-center justify-between text-[11px] gap-2">
          <div className="min-w-0 flex-1 truncate">
            {isSelected ? (
              isLive && live?.broad_title ? (
                <span className="text-[#c4b5fd] truncate block hover:text-white transition-colors" title={live.broad_title}>
                  {live.broad_title}
                </span>
              ) : (
                <span className="text-[#5a5a70]">
                  {slot.isCustomText ? '텍스트 수기 입력' : 'SOOP 라이브 대기 중'}
                </span>
              )
            ) : (
              <span className="text-[#5a5a70]">Red팀 선수를 지정하면 맞라인 상대를 추출합니다.</span>
            )}
          </div>

          {stationUrl && (
            <a
              href={stationUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`${slot.playerName} SOOP 방송 바로가기 (새 창)`}
              className="text-[#a78bfa] hover:text-white font-bold flex items-center gap-1 shrink-0 transition-colors"
            >
              <Play size={10} className="fill-current" />
              <span>방송보기</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        {/* Red Team Dropdown: Lists ALL Live Streamers for this line */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#10101c] border border-[#2a2444] rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] p-2.5 space-y-2 max-h-[300px] flex flex-col"
          >
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a7a90]" />
              <input
                type="text"
                value={candidateSearchText}
                onChange={(e) => setCandidateSearchText(e.target.value)}
                placeholder="해당 라인 LIVE 스트리머 검색..."
                className="w-full h-[30px] bg-[#080810] border border-[#222234] rounded-xl pl-7 pr-3 text-[11px] text-white placeholder-[#5a5a70] focus:outline-none focus:border-[#8b5cf6]"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto space-y-1 max-h-[220px] scrollbar-thin">
              {renderRedCandidates(line, candidateSearchText, (val) => handleSelectRedPlayer(line, val))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // Render BLUE Team Slot Card (Strictly Matching Lane Opponents)
  // =========================================================================
  function renderBlueSlotCard(
    line: LineKey,
    slot: SlotSelection,
    redPlayerName: string | undefined,
    liveOpps: LiveOpponentCandidate[]
  ) {
    const isDropdownOpen = openDropdown?.team === 'Blue' && openDropdown?.line === line;
    const isEditingCustom = editingCustomSlot?.team === 'Blue' && editingCustomSlot?.line === line;
    const isSelected = Boolean(slot.playerName);
    const hasRedPlayer = Boolean(redPlayerName?.trim());

    const liveMember = isSelected
      ? liveByName.get(normalizeStreamerName(slot.playerName).toLowerCase())
      : undefined;
    const isLive = Boolean(liveMember?.isLive && liveMember?.live);
    const live = liveMember?.live;
    const cleanId = liveMember?.profile?.soop_id || live?.user_id || '';
    const stationUrl = cleanId ? `https://play.sooplive.co.kr/${cleanId}` : null;

    // Head to head vs Red
    let h2hVsRed: HeadToHeadStat | null = null;
    if (hasRedPlayer && isSelected) {
      h2hVsRed = calculateHeadToHead(redPlayerName!, slot.playerName, line);
    }

    // Inline custom edit mode
    if (isEditingCustom) {
      return renderInlineCustomEdit('Blue', line, (val) => handleSelectBluePlayer(line, val));
    }

    return (
      <div
        className={`rounded-2xl p-3 border transition-all duration-200 flex flex-col justify-between min-h-[96px] ${
          isSelected
            ? 'bg-gradient-to-r from-[#0c1322] to-[#0a101c] border-[#3b82f6]/40 hover:border-[#3b82f6]/70'
            : 'bg-[#0c1322]/40 border-dashed border-[#3b82f6]/25 hover:border-[#3b82f6]/50'
        }`}
      >
        {/* Top: Avatar + Player Info or Empty State */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <StreamerAvatar name={slot.playerName || '?'} size={38} shape="circle" />
              {isLive && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#3b82f6] border-2 border-[#0a101c] rounded-full animate-pulse" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0">
              {isSelected ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13.5px] font-black text-white truncate">
                      {slot.playerName}
                    </span>
                    {slot.isCustomText && (
                      <span className="text-[9px] bg-[#222232] text-[#f59e0b] border border-[#f59e0b]/30 font-bold px-1.5 py-0.2 rounded-full">
                        임의 입력
                      </span>
                    )}
                    {isLive && (
                      <span className="bg-[#ef4444] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  {isLive && live ? (
                    <div className="flex items-center gap-2 text-[10.5px] text-[#a0a0b8] mt-0.5">
                      <span className="flex items-center gap-0.5 text-[#fbbf24] font-bold">
                        <Flame size={11} className="fill-[#fbbf24]" />
                        {formatViewerCount(live.total_view_cnt)}명
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-[#7a7a90]">
                        <Clock size={10} />
                        {formatRelativeTime(live.broad_start)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10.5px] text-[#7a7a90]">
                      {slot.isCustomText ? '비방송/임의 선수' : '방송 정보 없음'}
                    </span>
                  )}
                </>
              ) : (
                <div
                  onClick={() => {
                    if (!hasRedPlayer) {
                      onToast('먼저 Red팀 선수를 선택해 주세요.');
                      return;
                    }
                    setOpenDropdown({ team: 'Blue', line });
                    setCandidateSearchText('');
                  }}
                  className="cursor-pointer"
                >
                  <div className="text-[13px] font-bold text-[#8a8aa0] hover:text-white transition-colors">
                    {hasRedPlayer
                      ? liveOpps.length > 0
                        ? `맞라인 라이브 상대 선택 (${liveOpps.length}명 대기)`
                        : '맞라인 라이브 상대 없음 (0명)'
                      : 'Red팀 먼저 선택 필요'}
                  </div>
                  <div className="text-[10.5px] text-[#3b82f6]/80 mt-0.5">
                    {hasRedPlayer
                      ? liveOpps.length > 0
                        ? '클릭하여 CK일지 맞라인 대결 상대를 선택하세요'
                        : 'CK일지에 대결 기록이 있는 라이브 멤버가 없습니다'
                      : 'Red팀 선수를 지정해야 맞라인 상대를 추출합니다'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Dropdown Toggle & Direct Text Edit */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!hasRedPlayer}
              onClick={() => {
                if (!hasRedPlayer) {
                  onToast('먼저 Red팀 선수를 선택해 주세요.');
                  return;
                }
                if (isDropdownOpen) {
                  setOpenDropdown(null);
                } else {
                  setOpenDropdown({ team: 'Blue', line });
                  setCandidateSearchText('');
                }
              }}
              className="h-[28px] px-2.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border bg-[#3b82f6]/15 hover:bg-[#3b82f6]/30 text-[#93c5fd] border-[#3b82f6]/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{isSelected ? '변경' : '후보 선택'}</span>
              <ChevronDown size={12} className={isDropdownOpen ? 'rotate-180 transition-transform' : ''} />
            </button>

            {isSelected && (
              <button
                type="button"
                onClick={() => handleSelectBluePlayer(line, { playerName: '' })}
                title="선택 해제"
                className="w-[28px] h-[28px] rounded-xl bg-[#1a1a28] hover:bg-[#ef4444]/20 text-[#8a8aa0] hover:text-[#fca5a5] flex items-center justify-center transition border border-[#2a2a3e] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingCustomSlot({ team: 'Blue', line });
                setCustomInputText(slot.playerName || '');
                setCustomSoopIdInput('');
              }}
              title="선수 이름 직접 입력"
              className="w-[28px] h-[28px] rounded-xl bg-[#1a1a28] hover:bg-[#282840] text-[#8a8aa0] hover:text-white flex items-center justify-center transition border border-[#2a2a3e] cursor-pointer"
            >
              <Edit3 size={12} />
            </button>
          </div>
        </div>

        {/* Bottom: Broadcast Title & Station Link & H2H Badge */}
        <div className="mt-2 pt-2 border-t border-[#1a1a28] flex items-center justify-between text-[11px] gap-2">
          <div className="min-w-0 flex-1 truncate">
            {isSelected ? (
              h2hVsRed && h2hVsRed.games > 0 ? (
                <span className="text-[#93c5fd] font-bold flex items-center gap-1">
                  <Swords size={11} className="text-[#a78bfa]" />
                  <span>
                    맞라인 전적: {h2hVsRed.blueWins}승 {h2hVsRed.redWins}패 ({h2hVsRed.games}전, 승률 {100 - h2hVsRed.redWinRate}%)
                  </span>
                </span>
              ) : isLive && live?.broad_title ? (
                <span className="text-[#c4b5fd] truncate block hover:text-white transition-colors" title={live.broad_title}>
                  {live.broad_title}
                </span>
              ) : (
                <span className="text-[#5a5a70]">
                  {slot.isCustomText ? '텍스트 수기 입력' : 'SOOP 라이브 대기 중'}
                </span>
              )
            ) : (
              <span className="text-[#5a5a70]">
                {hasRedPlayer
                  ? liveOpps.length > 0
                    ? `맞라인 라이브 후보 ${liveOpps.length}명 대기 중`
                    : '맞라인 대결 기록이 있는 라이브 상대가 없습니다'
                  : 'Red팀 선수를 먼저 선택해 주세요'}
              </span>
            )}
          </div>

          {stationUrl && (
            <a
              href={stationUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`${slot.playerName} SOOP 방송 바로가기 (새 창)`}
              className="text-[#a78bfa] hover:text-white font-bold flex items-center gap-1 shrink-0 transition-colors"
            >
              <Play size={10} className="fill-current" />
              <span>방송보기</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        {/* Blue Team Dropdown: Lists ONLY Strictly Matched Live Opponents */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#10101c] border border-[#2a2444] rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] p-2.5 space-y-2 max-h-[300px] flex flex-col"
          >
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a7a90]" />
              <input
                type="text"
                value={candidateSearchText}
                onChange={(e) => setCandidateSearchText(e.target.value)}
                placeholder="맞라인 LIVE 상대 검색..."
                className="w-full h-[30px] bg-[#080810] border border-[#222234] rounded-xl pl-7 pr-3 text-[11px] text-white placeholder-[#5a5a70] focus:outline-none focus:border-[#8b5cf6]"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto space-y-1 max-h-[220px] scrollbar-thin">
              {renderBlueCandidates(
                line,
                redPlayerName || '',
                liveOpps,
                candidateSearchText,
                (val) => handleSelectBluePlayer(line, val)
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // Candidates List for Red Team (All Live Streamers for that line)
  // =========================================================================
  function renderRedCandidates(
    line: LineKey,
    query: string,
    onSelect: (val: SlotSelection) => void
  ) {
    const list = liveByPosition[line];
    const q = query.trim().toLowerCase();
    const filtered = list.filter((m) => {
      if (!q) return true;
      const name = m.profile.name.toLowerCase();
      const id = (m.profile.soop_id || m.live?.user_id || '').toLowerCase();
      const title = (m.live?.broad_title || '').toLowerCase();
      return name.includes(q) || id.includes(q) || title.includes(q);
    });

    if (filtered.length === 0) {
      return (
        <div className="py-6 text-center text-[11px] text-[#6a6a80]">
          {q ? `'${q}' 조건에 맞는 방송 중인 스트리머가 없습니다.` : '현재 해당 라인에 방송 중인 스트리머가 없습니다.'}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filtered.map((m) => {
          const isW = m.profile.name === '우리밍_' || m.profile.name === '우리밍';
          return (
            <button
              key={m.profile.name}
              type="button"
              onClick={() => onSelect({ playerName: m.profile.name })}
              className="w-full p-2 rounded-xl text-left transition flex items-center justify-between gap-2 cursor-pointer bg-[#12121e] hover:bg-[#1a1a2a] border border-[#1e1e2c]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <StreamerAvatar name={m.profile.name} size={28} shape="circle" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-black text-white truncate">
                      {m.profile.name}
                    </span>
                    {isW && (
                      <span className="text-[8.5px] bg-[#8b5cf6] text-white px-1 py-0.2 rounded font-black">
                        우리밍_
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#7a7a90] truncate max-w-[200px]">
                    {m.live?.broad_title || 'SOOP 라이브 방송 중'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10.5px] text-[#fbbf24] font-black flex items-center gap-0.5 justify-end">
                  <Flame size={10} className="fill-[#fbbf24]" />
                  {formatViewerCount(m.live?.total_view_cnt)}
                </span>
                <span className="text-[9.5px] text-[#ef4444] font-bold">LIVE</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // =========================================================================
  // Candidates List for Blue Team (STRICTLY Verified Historical Live Opponents)
  // =========================================================================
  function renderBlueCandidates(
    line: LineKey,
    redPlayerName: string,
    liveOpps: LiveOpponentCandidate[],
    query: string,
    onSelect: (val: SlotSelection) => void
  ) {
    const q = query.trim().toLowerCase();
    const filtered = liveOpps.filter((o) => {
      if (!q) return true;
      const name = o.name.toLowerCase();
      const id = (o.liveMember.profile.soop_id || o.liveMember.live?.user_id || '').toLowerCase();
      const title = (o.liveMember.live?.broad_title || '').toLowerCase();
      return name.includes(q) || id.includes(q) || title.includes(q);
    });

    if (liveOpps.length === 0) {
      return (
        <div className="p-4 text-center space-y-2 bg-[#0a0a12] rounded-xl border border-[#222234]">
          <AlertCircle size={22} className="mx-auto text-[#f59e0b]" />
          <p className="text-[12px] font-bold text-white">
            맞라인 대결 기록이 있는 라이브 멤버 없음
          </p>
          <p className="text-[10.5px] text-[#8a8aa0] leading-relaxed">
            CK일지(매치 기록)에서 <strong className="text-[#a78bfa]">{redPlayerName}</strong> 선수와 맞라인으로 대결했던 상대 중, 현재 SOOP에서 라이브 방송 중인 멤버가 없습니다.
          </p>
          <p className="text-[10px] text-[#5a5a70]">
            * 대결 기록이 없는 선수는 자동으로 매칭되지 않도록 방어되어 있습니다.
          </p>
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="py-6 text-center text-[11px] text-[#6a6a80]">
          '{q}' 조건에 맞는 맞라인 상대가 없습니다.
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <div className="px-2 py-1 text-[10px] font-black text-[#60a5fa] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Swords size={11} />
            <span>맞라인 대결 기록 보유 LIVE 상대 ({filtered.length}명)</span>
          </span>
          <span className="text-[#7a7a90]">클릭하여 지정</span>
        </div>

        {filtered.map((opp) => {
          const m = opp.liveMember;
          return (
            <button
              key={opp.name}
              type="button"
              onClick={() => onSelect({ playerName: opp.name })}
              className="w-full p-2.5 rounded-xl text-left transition flex items-center justify-between gap-2 cursor-pointer bg-[#0e1628] hover:bg-[#16233e] border border-[#3b82f6]/40 shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <StreamerAvatar name={opp.name} size={30} shape="circle" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-black text-white truncate">
                      {opp.name}
                    </span>
                    <span className="text-[9px] bg-[#3b82f6]/20 text-[#93c5fd] border border-[#3b82f6]/40 px-1.5 py-0.2 rounded font-bold">
                      맞라인 {opp.games}전 ({opp.blueWins}승 {opp.redWins}패)
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9a9ab0] truncate max-w-[210px] mt-0.5">
                    {m.live?.broad_title || 'SOOP 라이브 방송 중'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10.5px] text-[#fbbf24] font-black flex items-center gap-0.5 justify-end">
                  <Flame size={10} className="fill-[#fbbf24]" />
                  {formatViewerCount(m.live?.total_view_cnt)}
                </span>
                <span className="text-[9.5px] text-[#3b82f6] font-bold">LIVE ON</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // =========================================================================
  // Render Inline Custom Text Edit Mode
  // =========================================================================
  function renderInlineCustomEdit(
    team: 'Red' | 'Blue',
    line: LineKey,
    onSave: (val: SlotSelection) => void
  ) {
    return (
      <div className="p-3 rounded-2xl bg-[#141422] border-2 border-[#8b5cf6] space-y-2.5 animate-[fadeIn_0.1s]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
            <Edit3 size={13} className="text-[#a78bfa]" />
            선수 이름 직접 입력 ({team}팀 {LINE_LABELS[line]})
          </span>
          <button
            type="button"
            onClick={() => setEditingCustomSlot(null)}
            className="text-[#7a7a90] hover:text-white text-[11px]"
          >
            ✕ 취소
          </button>
        </div>

        <input
          type="text"
          value={customInputText}
          onChange={(e) => setCustomInputText(e.target.value)}
          placeholder="선수 닉네임 입력 (예: 페이커, 지인A)"
          className="w-full h-[36px] bg-[#0a0a10] border border-[#2a2a3e] rounded-xl px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]"
          autoFocus
        />

        {isAdmin ? (
          <div className="space-y-2 pt-1 border-t border-[#222234]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customSoopIdInput}
                onChange={(e) => setCustomSoopIdInput(e.target.value)}
                placeholder="SOOP 방송국 ID (선택 사항)"
                className="flex-1 h-[32px] bg-[#0a0a10] border border-[#2a2a3e] rounded-xl px-2.5 text-[11.5px] text-white focus:outline-none focus:border-[#8b5cf6]"
              />
              <button
                type="button"
                onClick={() => handleAdminSaveStreamer(customInputText, line)}
                className="h-[32px] px-3 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-[11px] font-black transition flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Save size={12} />
                <span>DB에 저장</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[10.5px] text-[#f59e0b] leading-tight">
            * 임의 표기 모드: 라인업 카드에만 반영되며, DB 저장은 관리자 전용입니다.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              if (customInputText.trim()) {
                onSave({ playerName: customInputText.trim(), isCustomText: true });
              }
              setEditingCustomSlot(null);
            }}
            className="px-3 py-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg text-[11.5px] font-bold cursor-pointer"
          >
            임의 반영
          </button>
        </div>
      </div>
    );
  }
};
