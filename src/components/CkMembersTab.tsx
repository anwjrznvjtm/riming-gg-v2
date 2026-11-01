import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  fetchSoopLiveBroadcasts,
  matchStreamersWithLiveBroadcasts,
  getStoredStreamerProfiles,
  autoCollectStreamersFromMatches,
  syncStreamersFromBackend,
} from '../lib/streamerApi';
import { StreamerAvatar } from './StreamerAvatar';
import { StreamerManageModal } from './StreamerManageModal';
import { CkMemberFinderModal } from './CkMemberFinderModal';
import {
  Radio,
  RefreshCw,
  ExternalLink,
  Users,
  Clock,
  Settings,
  Tv,
  Crown,
  Play,
  Flame,
  Search,
  X,
} from 'lucide-react';

interface CkMembersTabProps {
  matches: Match[];
  onToast: (msg: string) => void;
  isAdmin?: boolean;
}

const LINE_CONFIG: Record<
  LineKey,
  {
    name: string;
    kr: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    glow: string;
  }
> = {
  top: {
    name: 'TOP',
    kr: '탑',
    badgeBg: 'bg-[#f97316]/15',
    badgeText: 'text-[#fb923c]',
    badgeBorder: 'border-[#f97316]/40',
    glow: 'rgba(249, 115, 22, 0.15)',
  },
  jgl: {
    name: 'JGL',
    kr: '정글',
    badgeBg: 'bg-[#10b981]/15',
    badgeText: 'text-[#34d399]',
    badgeBorder: 'border-[#10b981]/40',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  mid: {
    name: 'MID',
    kr: '미드',
    badgeBg: 'bg-[#06b6d4]/15',
    badgeText: 'text-[#22d3ee]',
    badgeBorder: 'border-[#06b6d4]/40',
    glow: 'rgba(6, 182, 212, 0.15)',
  },
  adc: {
    name: 'ADC',
    kr: '원딜',
    badgeBg: 'bg-[#a855f7]/15',
    badgeText: 'text-[#c084fc]',
    badgeBorder: 'border-[#a855f7]/40',
    glow: 'rgba(168, 85, 247, 0.2)',
  },
  sup: {
    name: 'SUP',
    kr: '서폿',
    badgeBg: 'bg-[#eab308]/15',
    badgeText: 'text-[#facc15]',
    badgeBorder: 'border-[#eab308]/40',
    glow: 'rgba(234, 179, 8, 0.15)',
  },
};

const AUTO_REFRESH_SECONDS = 180; // 3 minutes

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

export const CkMembersTab: React.FC<CkMembersTabProps> = ({
  matches,
  onToast,
  isAdmin = false,
}) => {
  // Profiles state
  const [profiles, setProfiles] = useState<StreamerProfile[]>(() => getStoredStreamerProfiles());
  const [liveBroadcasts, setLiveBroadcasts] = useState<SoopLiveBroadcast[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(AUTO_REFRESH_SECONDS);

  // Initial state is null (inactive): only activates when user clicks a line button
  const [selectedLineFilter, setSelectedLineFilter] = useState<'ALL' | LineKey | null>(null);

  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isFinderModalOpen, setIsFinderModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Main fetch function with optional cache-bypassing forceRefresh
  const handleFetchLive = useCallback(async (showToastOnManual = false, forceRefresh = false) => {
    setIsLoading(true);
    try {
      const result = await fetchSoopLiveBroadcasts(forceRefresh);
      if (result.success) {
        setLiveBroadcasts(result.broad);
        setLastUpdated(result.fetchedAt);
        setSecondsRemaining(AUTO_REFRESH_SECONDS);
        if (showToastOnManual) {
          onToast('SOOP 라이브 방송 정보를 최신으로 갱신했습니다.');
        }
      } else {
        if (showToastOnManual) {
          onToast(result.error || '라이브 목록을 갱신하지 못했습니다.');
        }
      }
    } catch {
      if (showToastOnManual) {
        onToast('라이브 정보 조회 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [onToast]);

  const handleProfilesUpdated = useCallback((updated: StreamerProfile[]) => {
    setProfiles(updated);
  }, []);

  const handleSaveComplete = useCallback(
    async (updated: StreamerProfile[]) => {
      setProfiles(updated);
      await handleFetchLive(false, true);
    },
    [handleFetchLive]
  );

  // Initial load: sync latest streamers directly from authoritative server DB (server/streamers.json)
  useEffect(() => {
    syncStreamersFromBackend(true).then((serverList) => {
      if (serverList && serverList.length > 0) {
        setProfiles(serverList);
      }
      handleFetchLive(false, false);
    });
  }, []);

  // 3-minute auto refresh timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          handleFetchLive(false);
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Match profiles with live streams
  const { liveMembers } = useMemo(() => {
    return matchStreamersWithLiveBroadcasts(profiles, liveBroadcasts);
  }, [profiles, liveBroadcasts]);

  // Set of live user IDs for quick lookup in modal
  const liveUserIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of liveBroadcasts) {
      if (b.user_id) set.add(b.user_id.toLowerCase().trim());
    }
    return set;
  }, [liveBroadcasts]);

  // Specific check for Wooriming
  const woorimingLive = useMemo(() => {
    return liveMembers.find(
      (m) => m.profile.name === '우리밍_' || m.profile.name === '우리밍'
    );
  }, [liveMembers]);

  // Group live streamers by line (exclusively LIVE)
  const lineGroups = useMemo(() => {
    const groups: Record<LineKey, LiveStreamerMember[]> = {
      top: [],
      jgl: [],
      mid: [],
      adc: [],
      sup: [],
    };

    for (const member of liveMembers) {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = member.profile.name.toLowerCase().includes(q);
        const titleMatch = (member.live?.broad_title || '').toLowerCase().includes(q);
        const idMatch = (member.profile.soop_id || '').toLowerCase().includes(q);
        if (!nameMatch && !titleMatch && !idMatch) continue;
      }

      const line = member.profile.main_position || 'mid';
      groups[line].push(member);
    }

    return groups;
  }, [liveMembers, searchQuery]);

  const totalLiveCount = liveMembers.length;
  const totalProfilesCount = profiles.length;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Handle line filter click with toggle deactivation
  const handleLineFilterClick = (target: 'ALL' | LineKey) => {
    setSelectedLineFilter((prev) => (prev === target ? null : target));
  };

  const renderLiveCard = (member: LiveStreamerMember, isHero = false) => {
    const { profile, live } = member;
    if (!live) return null;
    const isW = profile.name === '우리밍_' || profile.name === '우리밍';
    const cleanId = profile.soop_id || live.user_id;
    const stationUrl = `https://play.sooplive.co.kr/${cleanId}`;
    const thumbUrl = live.broad_thumb
      ? live.broad_thumb.startsWith('//')
        ? `https:${live.broad_thumb}`
        : live.broad_thumb
      : null;

    return (
      <a
        key={profile.name}
        href={stationUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${profile.name} SOOP 라이브 방송 바로가기 (새 창)`}
        className={`group relative rounded-[20px] overflow-hidden border transition-all duration-300 flex flex-col bg-[#12121a] hover:bg-[#161624] cursor-pointer shadow-lg hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] ${
          isHero || isW
            ? 'border-[#a855f7] ring-2 ring-[#a855f7]/30 hover:ring-[#a855f7]/60'
            : 'border-[#1e1e2a] hover:border-[#8b5cf6]/50'
        }`}
      >
        {/* Thumbnail Preview with Live Badge & Viewers */}
        <div className="relative aspect-video w-full bg-[#0a0a10] overflow-hidden">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={live.broad_title || profile.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#12121e] to-[#1e1e2e]">
              <Tv className="text-[#3a3a50]" size={42} />
            </div>
          )}

          {/* Top Overlays: LIVE Badge & Viewer Count */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
            <span className="flex items-center gap-1.5 bg-[#ef4444] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          </div>

          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/75 backdrop-blur-md text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full z-10">
            <Users size={12} className="text-[#a0a0b8]" />
            <span>{formatViewerCount(live.total_view_cnt)}</span>
          </div>

          {/* Hover Play Icon Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 z-10">
            <div className="w-12 h-12 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <Play size={20} className="fill-white translate-x-0.5" />
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
          {/* Broadcaster Profile Row */}
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <StreamerAvatar name={profile.name} size={38} shape="circle" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ef4444] border-2 border-[#12121a] rounded-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13.5px] font-black text-white truncate group-hover:text-[#c4b5fd] transition-colors">
                  {profile.name}
                </span>
                {isW && (
                  <span className="text-[9.5px] bg-[#8b5cf6] text-white font-extrabold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                    <Crown size={10} className="fill-white" />
                    우리밍_
                  </span>
                )}
                <span
                  className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${
                    LINE_CONFIG[profile.main_position || 'mid'].badgeBg
                  } ${LINE_CONFIG[profile.main_position || 'mid'].badgeText} ${
                    LINE_CONFIG[profile.main_position || 'mid'].badgeBorder
                  }`}
                >
                  {LINE_LABELS[profile.main_position || 'mid']}
                </span>
              </div>
              <div className="text-[10.5px] text-[#8a8aa0] truncate">
                {live.user_nick || `@${cleanId}`}
              </div>
            </div>
          </div>

          {/* Broadcast Title */}
          <p
            className="text-[12.5px] text-[#e0e0ec] font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors"
            title={live.broad_title}
          >
            {live.broad_title || 'SOOP 라이브 방송 중'}
          </p>

          {/* Card Footer: Uptime & Click Prompt */}
          <div className="pt-2 border-t border-[#1e1e2a] flex items-center justify-between text-[10.5px] text-[#7a7a90]">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatRelativeTime(live.broad_start) || '라이브 진행 중'}
            </span>
            <span className="text-[#a78bfa] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              방송국 시청 <ExternalLink size={11} />
            </span>
          </div>
        </div>
      </a>
    );
  };

  const linesToRender: LineKey[] =
    selectedLineFilter === 'ALL'
      ? LINE_KEYS
      : selectedLineFilter
      ? [selectedLineFilter]
      : [];

  return (
    <div className="w-full space-y-6 animate-[fadeIn_0.2s]">
      {/* ======================================================== */}
      {/* 1. Header Banner & Line Selection Bar                     */}
      {/* ======================================================== */}
      <div className="relative rounded-[24px] bg-gradient-to-r from-[#12121c] via-[#161426] to-[#12121c] border border-[#2a2444] p-5 sm:p-6 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#8b5cf6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#c4b5fd]">
                <Radio size={20} className="animate-pulse" />
              </div>
              <h1 className="text-[20px] sm:text-[23px] font-black text-white tracking-tight flex items-center gap-2">
                CK 밸런스 멤버 실시간 라이브 연동
              </h1>
              <span className="inline-flex items-center gap-1.5 bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#fca5a5] text-[11px] font-extrabold px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-ping" />
                실시간 방송 중인 밸런스 멤버만 표시
              </span>
            </div>

            <p className="text-[12.5px] sm:text-[13px] text-[#9a9ab0] mt-1.5 leading-relaxed max-w-2xl">
              CK 일지에 등록된 밸런스 멤버 중, 현재 SOOP(숲TV)에서 라이브 방송 중인 멤버를 포지션별로 필터링하여 방송국으로 즉시 이동할 수 있습니다.
            </p>
          </div>

          {/* Quick Info & Actions (2단 정렬 구조) */}
          <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0">
            {/* 상단 (1열): 시스템 컨트롤 툴바 (배너 + 새로고침 + 관리자 버튼) */}
            <div className="flex items-center gap-2 justify-end flex-wrap">
              {/* 자동 새로고침 및 라이브 카운트 배너 */}
              <div className="bg-[#0a0a10]/85 border border-[#222232] rounded-xl px-3 py-1.5 flex items-center gap-2.5 text-right shadow-sm">
                <div className="flex items-center gap-1.5 text-[10.5px] text-[#7a7a90]">
                  <span>자동 새로고침:</span>
                  <strong className="text-[#a78bfa] font-mono text-[11px]">{timeFormatted}</strong>
                </div>
                <div className="h-3 w-[1px] bg-[#222234]" />
                <div className="flex items-center gap-1.5 text-[11.5px] text-white font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                  <span>
                    라이브 <strong className="text-[#ef4444] font-black">{totalLiveCount}</strong>명
                  </span>
                  <span className="text-[#6a6a80] text-[10px] hidden sm:inline">/ 전체 {totalProfilesCount}명</span>
                </div>
              </div>

              {/* 새로고침 버튼 */}
              <button
                type="button"
                onClick={() => handleFetchLive(true, true)}
                disabled={isLoading}
                title="SOOP 실시간 방송 정보 새로고침"
                className="h-[34px] px-3 bg-[#1e1e2e] hover:bg-[#2a2a40] border border-[#2e2e42] text-white rounded-xl text-[11.5px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#a78bfa]' : ''} />
                <span>새로고침</span>
              </button>

              {/* SOOP ID 관리 버튼: 관리자(isAdmin) 로그인 시에만 노출 */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsManageModalOpen(true)}
                  className="h-[34px] px-3 bg-[#1e1e2e] hover:bg-[#2a2a40] border border-[#2e2e42] text-[#c4b5fd] hover:text-white rounded-xl text-[11.5px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Settings size={13} />
                  <span>SOOP ID 관리</span>
                </button>
              )}
            </div>

            {/* 하단 (2열): 핵심 기능 버튼 (새로고침 바로 아래 우측 배치) */}
            <div className="flex items-center justify-end w-full">
              <button
                type="button"
                onClick={() => setIsFinderModalOpen(true)}
                className="w-full sm:w-auto h-[44px] px-5 bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] hover:from-[#7c3aed] hover:via-[#9333ea] hover:to-[#db2777] text-white rounded-2xl text-[13px] font-black shadow-[0_4px_20px_rgba(139,92,246,0.35)] hover:shadow-[0_6px_25px_rgba(168,85,247,0.5)] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95 ring-2 ring-white/20 whitespace-nowrap"
              >
                <Search size={16} className="stroke-[2.5]" />
                <span>🔍 CK멤버 찾기</span>
                <span className="text-[10px] bg-black/30 border border-white/20 px-2 py-0.5 rounded-full font-bold ml-0.5 text-[#f3e8ff]">
                  1:1 맞라인 섭외판
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Position Filter Bar: 라인 버튼 선택 시에만 하단 화면 활성화 */}
        <div className="relative z-10 mt-5 pt-4 border-t border-[#222234] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <span className="text-[11.5px] text-[#7a7a90] mr-1 hidden sm:inline">포지션 선택:</span>

            {/* 전체 버튼 */}
            <button
              type="button"
              onClick={() => handleLineFilterClick('ALL')}
              className={`h-[34px] px-4 rounded-xl text-[12px] font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                selectedLineFilter === 'ALL'
                  ? 'bg-white text-black border-white shadow-lg font-black ring-2 ring-white/30'
                  : 'bg-[#12121a] text-[#8a8aa0] hover:text-white border-[#222232]'
              }`}
            >
              <span>전체</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedLineFilter === 'ALL'
                    ? 'bg-[#ef4444] text-white font-black'
                    : totalLiveCount > 0
                    ? 'bg-[#ef4444]/20 text-[#fca5a5]'
                    : 'bg-[#1e1e2a] text-[#6a6a80]'
                }`}
              >
                {totalLiveCount}
              </span>
            </button>

            {/* 5개 라인 버튼 (TOP, JGL, MID, ADC, SUP) */}
            {LINE_KEYS.map((k) => {
              const count = lineGroups[k].length;
              const isSelected = selectedLineFilter === k;
              const cfg = LINE_CONFIG[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleLineFilterClick(k)}
                  className={`h-[34px] px-3.5 rounded-xl text-[12px] font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} ring-2 ring-white/20 shadow-md font-black`
                      : 'bg-[#12121a] text-[#8a8aa0] hover:text-white border-[#222232]'
                  }`}
                >
                  <span>{LINE_LABELS[k]}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      count > 0 ? 'bg-[#ef4444] text-white font-black' : 'bg-[#1e1e2a] text-[#6a6a80]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative sm:w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="멤버 또는 방송 제목 검색"
              className="w-full h-[32px] bg-[#0a0a10] border border-[#222232] rounded-full pl-3 pr-8 text-[11.5px] text-white focus:outline-none focus:border-[#8b5cf6] placeholder-[#5a5a70]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Main Body: Initial Guide vs Activated Line Screen      */}
      {/* ======================================================== */}
      {selectedLineFilter === null ? (
        /* 초기 비활성화 상태: 안내 문구 노출 (카드 자동 노출 방지) */
        <div className="bg-[#0e0e16] border border-[#1e1e2c] rounded-[24px] p-10 sm:p-14 text-center shadow-xl space-y-4 animate-[fadeIn_0.15s]">
          <div className="w-16 h-16 rounded-2xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 flex items-center justify-center mx-auto text-[#a78bfa]">
            <Tv size={32} />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-[17px] sm:text-[19px] font-black text-white">
              상단 포지션 버튼(전체, TOP, JGL, MID, ADC, SUP)을 클릭하여 라이브 방송을 확인하세요
            </h3>
            <p className="text-[12.5px] sm:text-[13px] text-[#8a8aa0] leading-relaxed">
              원하는 라인을 선택하면 현재 SOOP에서 실시간 라이브 방송 중인 멤버 카드 목록이 활성화됩니다.
            </p>
          </div>
        </div>
      ) : (
        /* 라인 버튼 선택 시 활성화: 해당 포지션(또는 전체) 라이브 카드 목록 출력 */
        <div className="space-y-6 animate-[fadeIn_0.2s]">
          {/* Active Status & Deselect Bar */}
          <div className="flex items-center justify-between bg-[#101018] border border-[#1e1e2c] px-4 py-2.5 rounded-2xl text-[12px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span className="text-[#a0a0b8]">현재 활성화된 포지션:</span>
              <strong className="text-white font-black">
                {selectedLineFilter === 'ALL'
                  ? '전체 포지션'
                  : `${LINE_CONFIG[selectedLineFilter].kr}(${LINE_CONFIG[selectedLineFilter].name})`}
              </strong>
              <span className="text-[#ef4444] font-bold">
                (
                {selectedLineFilter === 'ALL'
                  ? totalLiveCount
                  : lineGroups[selectedLineFilter].length}
                명 LIVE)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLineFilter(null)}
              className="h-[28px] px-3 bg-[#181824] hover:bg-[#222234] text-[#a0a0b8] hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border border-[#2a2a3e]"
            >
              <span>화면 닫기</span>
              <X size={13} />
            </button>
          </div>

          {/* Line Sections */}
          <div className="space-y-7">
            {linesToRender.map((lineKey) => {
              const cfg = LINE_CONFIG[lineKey];
              const members = lineGroups[lineKey];
              const isAdc = lineKey === 'adc';

              return (
                <div
                  key={lineKey}
                  className="bg-[#0c0c14] border border-[#1b1b28] rounded-[24px] p-4 sm:p-5 shadow-xl"
                >
                  {/* Line Section Header */}
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#1b1b28]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-[28px] px-3 rounded-xl font-black text-[12px] flex items-center justify-center border shadow-sm ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                      >
                        {cfg.name}
                      </span>
                      <h2 className="text-[16px] font-black text-white tracking-tight">
                        {cfg.kr} 라인 멤버
                      </h2>
                      <span className="text-[11px] font-bold text-[#8a8aa0] bg-[#161622] px-2.5 py-0.5 rounded-full border border-[#222232]">
                        현재 {members.length}명 LIVE
                      </span>
                    </div>

                    {isAdc && (
                      <div className="text-[11px] text-[#c4b5fd] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                        <Crown size={12} className="text-[#a78bfa]" />
                        <span>우리밍_ 고정 영역</span>
                      </div>
                    )}
                  </div>

                  {/* ADC Section: Dedicated Wooriming Spotlight Slot */}
                  {isAdc && (
                    <div className="mb-4">
                      {woorimingLive ? (
                        <div className="p-4 rounded-[20px] bg-gradient-to-r from-[#1c1230] via-[#261546] to-[#1c1230] border-2 border-[#a855f7] shadow-[0_0_25px_rgba(168,85,247,0.35)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4 relative z-10">
                            <div className="relative shrink-0">
                              <img
                                src="https://profile.img.sooplive.co.kr/LOGO/km/kmj05317/kmj05317.jpg"
                                alt="우리밍_"
                                className="w-16 h-16 rounded-full border-2 border-[#a855f7] object-cover ring-4 ring-[#a855f7]/30"
                              />
                              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#ef4444] border-2 border-[#12121a] rounded-full animate-ping" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[16px] font-black text-white">우리밍_</span>
                                <span className="bg-[#ef4444] text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  LIVE ON AIR
                                </span>
                                <span className="text-[11px] text-[#fbbf24] font-black flex items-center gap-1">
                                  <Flame size={12} className="fill-[#fbbf24]" />
                                  시청자 {formatViewerCount(woorimingLive.live?.total_view_cnt)}명
                                </span>
                              </div>
                              <p className="text-[13px] text-[#e0d6ff] font-semibold mt-1">
                                {woorimingLive.live?.broad_title || '우리밍_ SOOP 라이브 방송 진행 중!'}
                              </p>
                            </div>
                          </div>

                          <a
                            href="https://play.sooplive.co.kr/kmj05317"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-[42px] px-5 bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] hover:from-[#7c3aed] hover:to-[#9333ea] text-white rounded-xl text-[13px] font-black shadow-lg transition flex items-center gap-2 cursor-pointer shrink-0 z-10"
                          >
                            <Play size={15} className="fill-white" />
                            <span>우리밍_ 방송 바로보기</span>
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-[18px] bg-[#12121e] border border-[#2a2444] flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src="https://profile.img.sooplive.co.kr/LOGO/km/kmj05317/kmj05317.jpg"
                              alt="우리밍_"
                              className="w-10 h-10 rounded-full border border-[#8b5cf6]/50 object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-bold text-white">우리밍_</span>
                                <span className="text-[10px] text-[#a0a0b8] bg-[#1a1a28] px-2 py-0.3 rounded-full">
                                  현재 방송 준비 중
                                </span>
                              </div>
                              <span className="text-[11px] text-[#7a7a90]">
                                SOOP 방송국 ID: kmj05317 • 주 포지션: 원딜 (ADC)
                              </span>
                            </div>
                          </div>

                          <a
                            href="https://www.sooplive.co.kr/station/kmj05317"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-[32px] px-3.5 bg-[#1e1e2e] hover:bg-[#282840] border border-[#2e2e44] text-[#c4b5fd] rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <span>우리밍_ 방송국 바로가기</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Cards Grid for this Line */}
                  {members.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {members.map((member) => renderLiveCard(member))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[#08080f] rounded-[18px] border border-[#161622]">
                      <Tv size={26} className="mx-auto mb-2 text-[#4a4a60]" />
                      <p className="text-[13px] font-bold text-[#8a8aa0]">
                        현재 방송 중인 {cfg.kr}({cfg.name}) 멤버가 없습니다.
                      </p>
                      <p className="text-[11px] text-[#5a5a70] mt-1">
                        방송이 켜지면 실시간으로 감지되어 자동으로 이 영역에 나타납니다.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. Global Empty State (If 0 Live in entire system)        */}
      {/* ======================================================== */}
      {totalLiveCount === 0 && !isLoading && (
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-12 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-[#1e1e2a] flex items-center justify-center mx-auto mb-4 text-[#8a8aa0]">
            <Radio size={28} />
          </div>
          <h3 className="text-[17px] font-black text-white mb-1.5">
            현재 LIVE 방송 중인 CK 멤버가 없습니다.
          </h3>
          <p className="text-[13px] text-[#7a7a90] max-w-md mx-auto mb-5 leading-relaxed">
            등록된 총 {totalProfilesCount}명의 CK 스트리머가 현재 모두 오프라인 상태이거나 방송 준비 중입니다.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleFetchLive(true, true)}
              className="px-5 py-2.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-xl text-[12px] font-bold transition flex items-center gap-2 cursor-pointer border border-[#2a2a3a]"
            >
              <RefreshCw size={14} />
              <span>지금 다시 확인하기</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="px-5 py-2.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-xl text-[12px] font-bold transition flex items-center gap-2 cursor-pointer border border-[#2a2a3a]"
              >
                <Settings size={14} />
                <span>스트리머 SOOP ID 관리</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. Streamer SOOP ID Manage Modal                          */}
      {/* ======================================================== */}
      {isManageModalOpen && (
        <StreamerManageModal
          isOpen={isManageModalOpen}
          onClose={() => {
            setIsManageModalOpen(false);
            syncStreamersFromBackend(true).then((fresh) => {
              if (fresh && fresh.length > 0) setProfiles(fresh);
              handleFetchLive(false, true);
            });
          }}
          matches={matches}
          allProfiles={profiles}
          onProfilesUpdated={handleProfilesUpdated}
          onSaveComplete={handleSaveComplete}
          liveUserIds={liveUserIds}
          onToast={onToast}
          isAdmin={isAdmin}
        />
      )}

      {/* ======================================================== */}
      {/* 5. CkMemberFinderModal (🔍 CK멤버 찾기 전용 모달)         */}
      {/* ======================================================== */}
      {isFinderModalOpen && (
        <CkMemberFinderModal
          isOpen={isFinderModalOpen}
          onClose={() => setIsFinderModalOpen(false)}
          matches={matches}
          allProfiles={profiles}
          liveBroadcasts={liveBroadcasts}
          onRefresh={() => handleFetchLive(true, true)}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onToast={onToast}
          onProfilesUpdated={(updated) => setProfiles(updated)}
        />
      )}
    </div>
  );
};
