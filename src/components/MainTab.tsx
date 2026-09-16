import React, { useMemo } from 'react';
import { Match, LineKey, LINE_KEYS } from '../types';
import { ComputedStats } from '../lib/stats';
import { WoorimingPerformanceDashboard } from './WoorimingPerformanceDashboard';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers?: string[];
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
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

export const MainTab: React.FC<MainTabProps> = ({
  stats,
  matches,
  onOpenSummaryModal,
  onToast,
  onJumpToStreamer,
}) => {
  // 우리밍_ 전적 종합 계산
  const woorimingStats = useMemo(() => {
    let wins = 0,
      losses = 0,
      total = 0;
    let monthWins = 0,
      monthLosses = 0,
      monthTotal = 0;
    const lineCounts: Record<LineKey, number> = { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 };
    const thisMonthStr = '2026-09';

    for (const m of matches) {
      const team = getPlayerTeam(m, '우리밍_');
      if (!team) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      total++;
      if (team === winner) wins++;
      else losses++;

      const mMonth = (m.date || '').slice(0, 7);
      if (mMonth === thisMonthStr) {
        monthTotal++;
        if (team === winner) monthWins++;
        else monthLosses++;
      }
      for (const k of LINE_KEYS as LineKey[]) {
        if ((m.team_a?.[k] || '').trim() === '우리밍_' || (m.team_b?.[k] || '').trim() === '우리밍_') {
          lineCounts[k]++;
        }
      }
    }

    let maxLine: LineKey = 'adc';
    let maxCnt = -1;
    for (const k of LINE_KEYS as LineKey[]) {
      if (lineCounts[k] > maxCnt) {
        maxCnt = lineCounts[k];
        maxLine = k;
      }
    }

    const winRate = total ? Math.round((wins / total) * 100) : 0;
    const monthWinRate = monthTotal ? Math.round((monthWins / monthTotal) * 100) : winRate;
    return { wins, losses, total, winRate, monthWins, monthLosses, monthTotal, monthWinRate, mainLine: maxLine };
  }, [matches]);

  return (
    <div className="max-w-[960px] mx-auto space-y-6 animate-[fadeIn_0.2s]">
      {/* 상단 프로필 & 전적 요약 카드 */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-5 shadow-lg relative overflow-hidden">
        {/* 은은한 배경 글로우 */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#8b5cf6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          {/* 좌측: 도넛 게이지 + 프로필 기본 정보 */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-[78px] h-[78px] shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#1e1e2a" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${woorimingStats.monthWinRate * 2.76} 276`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <div className="text-[14px] font-black text-white mb-0.5">우</div>
                <div className="text-[14px] font-black text-[#a78bfa]">{woorimingStats.monthWinRate}%</div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-black text-white tracking-tight">우리밍_</span>
                <span className="px-2 py-0.5 rounded-md bg-[#8b5cf6]/20 border border-[#8b5cf6]/35 text-[11px] font-black text-[#c4b5fd]">
                  {woorimingStats.mainLine.toUpperCase()}
                </span>
                <span className="text-[11px] text-[#8a8aa0] font-medium">원거리 딜러</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px] mt-1.5">
                <span className="text-[#8a8aa0]">이번달 (2026-09):</span>
                <span className="text-[#60a5fa] font-bold">{woorimingStats.monthWins}승</span>
                <span className="text-[#f87171] font-bold">{woorimingStats.monthLosses}패</span>
                <span className="text-[#8a8aa0]">
                  ({woorimingStats.monthTotal}전 {woorimingStats.monthWinRate}%)
                </span>
              </div>
            </div>
          </div>

          {/* 우측: 통산 전체 승률 지표 */}
          <div className="w-full md:w-auto flex justify-start md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#1e1e2a]">
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-[11px] text-[#8a8aa0] font-medium">통산 전체 전적</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-black text-[#a78bfa]">
                  {woorimingStats.winRate}%
                </span>
                <span className="text-[11px] text-[#9aa0b8]">
                  ({woorimingStats.wins}승 {woorimingStats.losses}패 / 총 {woorimingStats.total}전)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 우리밍_ 인게임 정밀 통계 & 그래프 */}
      <WoorimingPerformanceDashboard
        matches={matches}
        onJumpToMatch={(matchId) => {
          if (onJumpToStreamer) {
            onJumpToStreamer('우리밍_', matchId);
            onToast('선택한 매치 상세 기록으로 이동했습니다.');
          }
        }}
      />
    </div>
  );
};
