import React, { useMemo } from 'react';
import { Match } from '../types';
import { calculateMonthlyFundingStats } from '../lib/fundingStats';
import { ChevronRight } from 'lucide-react';

interface MonthlyFundingSummaryCardProps {
  matches: Match[];
  onClick: () => void;
}

export const MonthlyFundingSummaryCard: React.FC<MonthlyFundingSummaryCardProps> = ({
  matches,
  onClick,
}) => {
  // Determine current/latest active month
  const { monthLabel, netBalloonsTotal, netBalloonsPerPerson, wonSubsidyCount, subsidyWonAmount } =
    useMemo(() => {
      const now = new Date();
      const currentCalMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const availableMonths: string[] = Array.from(
        new Set<string>(matches.map((m) => m.date.slice(0, 7)).filter(Boolean))
      ).sort().reverse();

      const active: string = availableMonths.includes(currentCalMonth)
        ? currentCalMonth
        : availableMonths[0] || currentCalMonth;

      const stats = calculateMonthlyFundingStats(matches, active);

      return {
        monthLabel: stats.monthLabel,
        netBalloonsTotal: stats.netBalloonsTotal,
        netBalloonsPerPerson: stats.netBalloonsPerPerson,
        wonSubsidyCount: stats.subsidyWonCount,
        subsidyWonAmount: stats.subsidyWonTotalAmount,
      };
    }, [matches]);

  const isPositive = netBalloonsTotal > 0;
  const isNegative = netBalloonsTotal < 0;
  const totalSign = isPositive ? '+' : '';
  const perPersonSign = netBalloonsPerPerson > 0 ? '+' : '';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="bg-[#12121a] hover:bg-[#151524] border border-[#1e1e2a] hover:border-[#fbbf24]/50 rounded-[20px] p-4 shadow-lg cursor-pointer transition-all duration-200 group relative overflow-hidden"
      title="클릭하여 월별 펀딩 및 지원금 상세 통계 확인"
    >
      {/* Background ambient light */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#fbbf24]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#fbbf24]/10 transition-colors duration-300" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px]">💰</span>
          <h3 className="font-black text-[13px] text-white tracking-tight flex items-center gap-1.5">
            <span>이번 달 펀딩 요약</span>
            <span className="text-[10px] font-bold text-[#fbbf24] bg-[#fbbf24]/15 border border-[#fbbf24]/30 px-1.5 py-0.2 rounded-full">
              {monthLabel}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-bold text-[#8e8ea8] group-hover:text-[#fbbf24] transition-colors">
          <span>상세보기</span>
          <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* 2 Main Stats Badges */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        {/* Star Balloons Net Profit / Loss */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors ${
            isPositive
              ? 'bg-[#22c55e]/10 border-[#22c55e]/30'
              : isNegative
              ? 'bg-[#ef4444]/10 border-[#ef4444]/30'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-[10.5px] font-semibold flex items-center gap-1 ${
                isPositive
                  ? 'text-[#86efac]'
                  : isNegative
                  ? 'text-[#fca5a5]'
                  : 'text-[#d1d5db]'
              }`}
            >
              <span>🎈</span>
              <span>펀딩 순손익 (NET)</span>
            </span>
            <span
              className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                isPositive
                  ? 'bg-[#22c55e]/20 text-[#4ade80]'
                  : isNegative
                  ? 'bg-[#ef4444]/20 text-[#f87171]'
                  : 'bg-white/10 text-[#a0a0b8]'
              }`}
            >
              {isPositive ? '순이득' : isNegative ? '손실' : '0'}
            </span>
          </div>
          <div className="mt-0.5">
            <div
              className={`text-[16px] font-black tracking-tight leading-tight ${
                isPositive
                  ? 'text-[#4ade80]'
                  : isNegative
                  ? 'text-[#f87171]'
                  : 'text-white'
              }`}
            >
              {totalSign}{netBalloonsTotal.toLocaleString()}
              <span
                className={`text-[11px] font-bold ml-0.5 ${
                  isPositive
                    ? 'text-[#86efac]'
                    : isNegative
                    ? 'text-[#fca5a5]'
                    : 'text-[#8e8ea8]'
                }`}
              >
                개
              </span>
            </div>
            <div
              className={`text-[9.5px] font-medium mt-0.5 truncate ${
                isPositive
                  ? 'text-[#4ade80]/80'
                  : isNegative
                  ? 'text-[#f87171]/80'
                  : 'text-[#8e8ea8]'
              }`}
            >
              인당 {perPersonSign}{netBalloonsPerPerson.toLocaleString()}개 (5인)
            </div>
          </div>
        </div>

        {/* SOOP Partner Subsidy Won */}
        <div className="p-2.5 rounded-xl border bg-[#00c73c]/10 border-[#00c73c]/25 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10.5px] font-semibold text-[#86efac] flex items-center gap-1">
              <span>🌱</span>
              <span>숲 지원금 획득</span>
            </span>
          </div>
          <div className="mt-0.5">
            <div className="text-[16px] font-black text-white tracking-tight leading-tight">
              {wonSubsidyCount > 0 ? `${wonSubsidyCount}회` : '0회'}
            </div>
            <div className="text-[9.5px] text-[#4ade80]/90 font-medium mt-0.5 truncate">
              {wonSubsidyCount > 0
                ? `총 ${(subsidyWonAmount / 10000).toLocaleString()}만 원`
                : '미획득'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-[#787890] relative z-10">
        <span>클릭하여 월별 손익 분석 그래프 확인</span>
        <span className="text-[#a78bfa] font-bold group-hover:underline">분석 보기 →</span>
      </div>
    </div>
  );
};
