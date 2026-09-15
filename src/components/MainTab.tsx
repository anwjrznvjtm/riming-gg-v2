import React, { useState, useMemo } from 'react';
import { Match, LineKey, LINE_KEYS } from '../types';
import { ComputedStats, getWoorimingTeam, isWooriming } from '../lib/stats';
import { isAllyWonMatch, sortMatchesDescending } from '../lib/seriesScores';
import { BarChart2, Calendar, TrendingUp } from 'lucide-react';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers?: string[];
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
  onOpenMatchDetail?: (match: Match) => void;
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
  onOpenMatchDetail,
}) => {
  const [recentGamesOrder, setRecentGamesOrder] = useState<'chrono' | 'latest'>('latest');

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

  // 최근 3개월 월별 승률 통계
  const monthlyStats = useMemo(() => {
    const byMonth: Record<string, { wins: number; losses: number; total: number }> = {};
    for (const m of matches) {
      const team = getPlayerTeam(m, '우리밍_');
      if (!team) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      const month = (m.date || '').slice(0, 7) || '2026-09';
      if (!byMonth[month]) byMonth[month] = { wins: 0, losses: 0, total: 0 };
      byMonth[month].total++;
      if (team === winner) byMonth[month].wins++;
      else byMonth[month].losses++;
    }
    const sorted = Object.entries(byMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-3);

    return sorted.map(([month, s]) => ({
      month,
      label: month.slice(5) + '월',
      rate: s.total ? Math.round((s.wins / s.total) * 100) : 0,
      subText: `${s.total}판 ${s.total ? Math.round((s.wins / s.total) * 100) : 0}%`,
      ...s,
    }));
  }, [matches]);

  // CK 일지와 100% 동일한 정렬 및 파싱 기준을 적용한 최근 10경기 데이터
  const recentGamesData = useMemo(() => {
    const woorimingMatches = matches.filter((m) => {
      const inA = Object.values(m.team_a || {}).some(isWooriming);
      const inB = Object.values(m.team_b || {}).some(isWooriming);
      return inA || inB;
    });

    const sortedDesc = sortMatchesDescending(woorimingMatches);

    const top10 = sortedDesc.slice(0, 10).map((m, idx) => {
      const wTeam = getWoorimingTeam(m);
      const won = isAllyWonMatch(m);
      const roster = wTeam === 'Red' ? m.team_a : m.team_b;
      const champs = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
      const kdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;

      let wLine: LineKey = 'adc';
      for (const k of LINE_KEYS) {
        if (isWooriming(roster?.[k])) {
          wLine = k;
          break;
        }
      }
      const champ = champs?.[wLine] || '';
      const kda = kdas?.[wLine] || '';

      return {
        id: m.id,
        date: m.date,
        ck_name: m.ck_name,
        set_number: Math.max(1, parseInt(String(m.set_number), 10) || 1),
        score: m.score,
        won,
        side: wTeam,
        sideLabel: wTeam === 'Red' ? '레드' : '블루',
        champ,
        kda,
        line: wLine,
        matchIndex: idx + 1,
        relativeLabel: idx === 0 ? '최신' : `${idx + 1}전`,
      };
    });

    if (recentGamesOrder === 'latest') {
      return top10;
    } else {
      return [...top10].reverse();
    }
  }, [matches, recentGamesOrder]);

  const recentGamesSummary = useMemo(() => {
    let wins = 0;
    let blueGames = 0;
    let blueWins = 0;
    let redGames = 0;
    let redWins = 0;
    for (const g of recentGamesData) {
      if (g.won) wins++;
      if (g.side === 'Blue') {
        blueGames++;
        if (g.won) blueWins++;
      } else {
        redGames++;
        if (g.won) redWins++;
      }
    }
    const total = recentGamesData.length;
    const losses = total - wins;
    const rate = total ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, total, rate, blueGames, blueWins, redGames, redWins };
  }, [recentGamesData]);

  return (
    <div className="max-w-[960px] mx-auto space-y-6 animate-[fadeIn_0.2s]">
      {/* 상단 안내 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#1e1e2a]/60">
        <div>
          <h1 className="text-[20px] font-black text-white flex items-center gap-2.5">
            <span className="w-2.5 h-6 bg-[#8b5cf6] rounded-full inline-block shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            <span>우리밍_ 개인 전적 요약</span>
          </h1>
          <p className="text-[12px] text-[#8a8aa0] mt-1">
            등록된 CK 매치 데이터를 기반으로 산출된 개인 승률, 월별 성적 추이 및 최근 10경기 흐름입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSummaryModal}
          className="self-start sm:self-auto h-[36px] px-4 bg-[#8b5cf6]/15 hover:bg-[#8b5cf6] text-[#c4b5fd] hover:text-white border border-[#8b5cf6]/35 rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <BarChart2 size={15} />
          <span>전체 전적 상세 보기</span>
        </button>
      </div>

      {/* 2단 메인 레이아웃: 좌측 (프로필 & 전체 승률) / 우측 (월별 차트 & 최근 10경기 흐름) */}
      <div className="grid grid-cols-1 md:grid-cols-[310px_1fr] gap-6 items-start">
        {/* 좌측: 프로필 및 종합 승률 카드 */}
        <div className="space-y-5">
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-6 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
            {/* 은은한 배경 글로우 */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#8b5cf6]/10 rounded-full blur-2xl pointer-events-none" />

            <button
              type="button"
              onClick={onOpenSummaryModal}
              className="relative w-[124px] h-[124px] mb-4 group cursor-pointer transition-transform hover:scale-105"
              title="클릭 시 전체 전적 상세 모달 열기"
            >
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
                  className="group-hover:stroke-[#c4b5fd] transition"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[26px] font-black text-white group-hover:text-[#c4b5fd] transition">우</div>
                <div className="text-[17px] font-black text-[#a78bfa]">{woorimingStats.monthWinRate}%</div>
              </div>
            </button>

            <div className="text-[18px] font-black text-white">우리밍_</div>

            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[11px] text-[#c2c6d6]">
              <span className="font-semibold text-white">이번달 (2026-09)</span>
              <span className="text-[#64748b]">•</span>
              <span className="text-[#a78bfa] font-black">{woorimingStats.mainLine.toUpperCase()} 포지션</span>
            </div>

            <div className="mt-3 text-[13px] text-[#c0c0d0] font-medium">
              <span className="text-[#60a5fa] font-bold">{woorimingStats.monthWins}승</span>{' '}
              <span className="text-[#f87171] font-bold">{woorimingStats.monthLosses}패</span>{' '}
              <span className="text-[#8a8aa0]">/ 총 {woorimingStats.monthTotal}판</span>
            </div>

            {/* 통산 전체 승률 박스 */}
            <div className="w-full mt-5 pt-4 border-t border-[#1e1e2a] space-y-2">
              <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-[12px] text-[#9aa0b8] font-medium">통산 전체 승률</span>
                <span className="text-[13px] font-black text-[#a78bfa]">
                  {woorimingStats.winRate}%{' '}
                  <span className="text-[11px] font-normal text-[#9aa0b8]">
                    ({woorimingStats.wins}승 {woorimingStats.losses}패)
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSummaryModal}
              className="mt-4 w-full h-[40px] bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] hover:border-[#8b5cf6]/40 rounded-xl text-[12px] font-bold text-[#c2c6d6] hover:text-white transition shadow-sm"
            >
              전체 전적 상세 보기
            </button>
          </div>
        </div>

        {/* 우측: 월별 승률 추이 + 최근 10경기 흐름 */}
        <div className="space-y-6">
          {/* 월별 승률 추이 카드 */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-5 shadow-lg">
            <div className="flex items-center justify-between text-[12px] mb-3 px-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Calendar size={14} className="text-[#8b5cf6]" />
                <span>월별 승률 추이</span>
              </span>
              <span className="text-[10px] text-[#9aa0b8] font-medium">최근 3개월</span>
            </div>

            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-4">
              <div className="flex items-end justify-around h-[115px] gap-3">
                {(monthlyStats.length > 0
                  ? monthlyStats
                  : [
                      { month: '2026-08', label: '08월', rate: 39, total: 28, subText: '28판 39%' },
                      { month: '2026-09', label: '09월', rate: 52, total: 25, subText: '25판 52%' },
                    ]
                ).map((m, i, arr) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[12px] font-black text-white">{m.rate}%</div>
                    <div className="w-full flex justify-center items-end h-[65px]">
                      <div
                        className="w-[70%] max-w-[48px] rounded-t-lg transition-all"
                        style={{
                          height: `${Math.max(12, m.rate)}%`,
                          background: i === arr.length - 1 ? '#8b5cf6' : '#2e2e42',
                          minHeight: '8px',
                        }}
                      />
                    </div>
                    <div className="text-[11px] font-bold text-[#c2c6d6]">{m.label}</div>
                    <div className="text-[10px] text-[#8a8aa0] font-medium">{m.subText || `${m.total}판 ${m.rate}%`}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 최근 10경기 흐름 (승/패 및 블루/레드 진영 표시) */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-5 shadow-lg">
            <div className="flex items-center justify-between text-[12px] mb-3 px-1">
              <span className="font-bold text-white flex items-center gap-2">
                <TrendingUp size={15} className="text-[#8b5cf6]" />
                <span>최근 10경기 흐름</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    recentGamesSummary.rate >= 50
                      ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40'
                      : 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40'
                  }`}
                >
                  {recentGamesSummary.wins}승 {recentGamesSummary.losses}패 ({recentGamesSummary.rate}%)
                </span>
              </span>

              {/* 최신순 / 시간순 정렬 토글 */}
              <div className="flex items-center bg-[#08080c] p-0.5 rounded-lg border border-[#1e1e2a]">
                <button
                  type="button"
                  onClick={() => setRecentGamesOrder('latest')}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition font-semibold ${
                    recentGamesOrder === 'latest'
                      ? 'bg-[#8b5cf6] text-white shadow-sm'
                      : 'text-[#8a8aa0] hover:text-white'
                  }`}
                  title="최신 경기부터 10경기 전 순서로 보기"
                >
                  최신순 ⚡
                </button>
                <button
                  type="button"
                  onClick={() => setRecentGamesOrder('chrono')}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition font-semibold ${
                    recentGamesOrder === 'chrono'
                      ? 'bg-[#8b5cf6] text-white shadow-sm'
                      : 'text-[#8a8aa0] hover:text-white'
                  }`}
                  title="10경기 전부터 최신 경기 순서로 보기"
                >
                  시간순 ⏱️
                </button>
              </div>
            </div>

            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3.5">
              {/* 순서 방향 안내 바 */}
              <div className="flex items-center justify-between mb-2.5 px-0.5 text-[9px]">
                <span className="px-2 py-0.5 rounded bg-[#1e1e2a] text-[#8a8aa0] font-bold">
                  {recentGamesOrder === 'latest' ? '⚡ [최신 경기]' : '⏱️ [10경기 전]'}
                </span>
                <span className="text-[9px] text-[#6b7280] font-medium tracking-wide">
                  {recentGamesOrder === 'latest' ? '최신순 (1 ➔ 10)' : '시간 흐름 (10 ➔ 1)'}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#1e1e2a] text-[#a78bfa] font-bold">
                  {recentGamesOrder === 'latest' ? '[10경기 전]' : '[최신 경기] ⚡'}
                </span>
              </div>

              {/* 5x2 그리드: 승/패 결과 및 블루/레드 진영 배지 */}
              <div className="grid grid-cols-5 gap-1.5">
                {recentGamesData.map((g) => {
                  const isWin = g.won;
                  const isBlueSide = g.side === 'Blue';
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        const fullMatch = matches.find((m) => String(m.id) === String(g.id));
                        if (fullMatch && onOpenMatchDetail) {
                          onOpenMatchDetail(fullMatch);
                        } else if (onJumpToStreamer) {
                          onJumpToStreamer('우리밍_', g.id);
                          onToast(`${g.date} ${g.ck_name} ${g.set_number}세트 기록으로 이동했습니다.`);
                        }
                      }}
                      title={`[${g.date}] ${g.ck_name} ${g.set_number}세트\n진영: ${
                        isBlueSide ? '블루 진영 (Blue Side)' : '레드 진영 (Red Side)'
                      }\n결과: ${isWin ? '승리 (WIN)' : '패배 (DEFEAT)'}\n스코어: ${g.score || '-'}\n픽: ${
                        g.champ || '-'
                      }${g.kda ? ` (${g.kda})` : ''}\n👉 클릭 시 경기 상세 정보 및 AI 비전 분석 팝업`}
                      className={`group relative flex flex-col items-center justify-between py-2 px-1 rounded-[10px] border transition-all duration-150 cursor-pointer active:scale-95 ${
                        isWin
                          ? 'bg-[#1e3a8a]/35 hover:bg-[#1e3a8a]/65 border-[#3b82f6]/50 hover:border-[#60a5fa] hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                          : 'bg-[#7f1d1d]/35 hover:bg-[#7f1d1d]/65 border-[#ef4444]/50 hover:border-[#f87171] hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                      }`}
                    >
                      {/* 상단: 진영 뱃지 (블루 / 레드) & 순번 */}
                      <div className="w-full flex items-center justify-between text-[8px] leading-none mb-0.5">
                        <span
                          className={`font-black rounded-[3px] px-1 py-0.5 text-[8px] shrink-0 ${
                            isBlueSide ? 'bg-[#2563eb] text-white' : 'bg-[#dc2626] text-white'
                          }`}
                        >
                          {isBlueSide ? '블루' : '레드'}
                        </span>
                        <span className="text-[8px] text-[#9aa0b8] font-bold">{g.relativeLabel}</span>
                      </div>

                      {/* 중앙: 승 / 패 커다란 표시 */}
                      <div
                        className={`my-1 text-[15px] font-black tracking-tight ${
                          isWin ? 'text-[#60a5fa]' : 'text-[#f87171]'
                        }`}
                      >
                        {isWin ? '승' : '패'}
                      </div>

                      {/* 하단: 날짜 및 세트 */}
                      <div className="w-full text-center text-[8px] text-[#94a3b8] truncate font-semibold leading-none">
                        {g.date.slice(5).replace('-', '/')} {g.set_number}S
                      </div>
                    </button>
                  );
                })}
                {recentGamesData.length === 0 &&
                  Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-[10px] bg-[#1e1e2a] border border-white/10 grid place-items-center text-[10px] text-white/20"
                    >
                      -
                    </div>
                  ))}
              </div>

              {/* 하단 범례 및 진영별 승률 요약 */}
              <div className="mt-2.5 pt-2 border-t border-[#1e1e2a] flex items-center justify-between text-[9px] text-[#8a8aa0]">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] inline-block" />
                    <span className="text-white font-medium">블루 진영</span> ({recentGamesSummary.blueWins}승{' '}
                    {recentGamesSummary.blueGames - recentGamesSummary.blueWins}패)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#dc2626] inline-block" />
                    <span className="text-white font-medium">레드 진영</span> ({recentGamesSummary.redWins}승{' '}
                    {recentGamesSummary.redGames - recentGamesSummary.redWins}패)
                  </span>
                </div>
                <span className="text-[#a78bfa] hover:text-[#c4b5fd] font-semibold">
                  클릭 시 상세 정보 & AI 분석 팝업
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
