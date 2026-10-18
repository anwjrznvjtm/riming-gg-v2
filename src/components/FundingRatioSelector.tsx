import React, { useMemo, useEffect } from 'react';
import {
  FundingRatio,
  FundingTargetTeam,
  FUNDING_RATIO_OPTIONS,
  calculateFundingByRatio,
} from '../lib/fundingRatio';
import { Trophy, Shield, Sparkles, Check, RotateCcw } from 'lucide-react';

interface FundingRatioSelectorProps {
  baseAmount?: number;
  ratio?: FundingRatio | string;
  targetTeam?: FundingTargetTeam | string;
  hasSubsidy?: boolean;
  isWon?: boolean;
  onFundingChange: (updated: {
    funding_base_amount: number | undefined;
    funding_ratio: FundingRatio;
    funding_target_team: FundingTargetTeam;
    funding_per_person: number | undefined;
    funding: number | undefined;
    star_balloons: number | undefined;
    funding_split_count: number;
  }) => void;
  onSubsidyToggle: (nextState: boolean) => void;
  onToast?: (msg: string) => void;
}

export const FundingRatioSelector: React.FC<FundingRatioSelectorProps> = ({
  baseAmount,
  ratio = '100:0',
  targetTeam = 'auto',
  hasSubsidy = false,
  isWon = true,
  onFundingChange,
  onSubsidyToggle,
  onToast,
}) => {
  const currentRatio: FundingRatio = (ratio as FundingRatio) || '100:0';
  const currentTargetTeam: FundingTargetTeam =
    targetTeam === 'winner' || targetTeam === 'loser' ? targetTeam : 'auto';

  // Calculate breakdown
  const calc = useMemo(() => {
    return calculateFundingByRatio({
      baseAmount,
      ratio: currentRatio,
      targetTeam: currentTargetTeam,
      isWon,
      splitCount: 5,
    });
  }, [baseAmount, currentRatio, currentTargetTeam, isWon]);

  // Keep parent in sync when isWon changes under auto mode
  useEffect(() => {
    if (baseAmount !== undefined && baseAmount > 0) {
      onFundingChange({
        funding_base_amount: calc.baseAmount,
        funding_ratio: calc.ratio,
        funding_target_team: calc.targetTeam,
        funding_per_person: calc.finalPerPerson,
        funding: calc.finalTotal,
        star_balloons: calc.finalTotal,
        funding_split_count: 5,
      });
    }
  }, [calc.finalPerPerson, calc.finalTotal, calc.ratio, calc.targetTeam]);

  const handleBaseAmountChange = (newBase?: number) => {
    if (newBase === undefined || newBase <= 0) {
      onFundingChange({
        funding_base_amount: undefined,
        funding_ratio: currentRatio,
        funding_target_team: currentTargetTeam,
        funding_per_person: undefined,
        funding: undefined,
        star_balloons: undefined,
        funding_split_count: 5,
      });
      return;
    }

    const nextCalc = calculateFundingByRatio({
      baseAmount: newBase,
      ratio: currentRatio,
      targetTeam: currentTargetTeam,
      isWon,
      splitCount: 5,
    });

    onFundingChange({
      funding_base_amount: nextCalc.baseAmount,
      funding_ratio: nextCalc.ratio,
      funding_target_team: nextCalc.targetTeam,
      funding_per_person: nextCalc.finalPerPerson,
      funding: nextCalc.finalTotal,
      star_balloons: nextCalc.finalTotal,
      funding_split_count: 5,
    });
  };

  const handleRatioSelect = (newRatio: FundingRatio) => {
    const nextCalc = calculateFundingByRatio({
      baseAmount,
      ratio: newRatio,
      targetTeam: currentTargetTeam,
      isWon,
      splitCount: 5,
    });

    onFundingChange({
      funding_base_amount: baseAmount,
      funding_ratio: newRatio,
      funding_target_team: currentTargetTeam,
      funding_per_person: baseAmount ? nextCalc.finalPerPerson : undefined,
      funding: baseAmount ? nextCalc.finalTotal : undefined,
      star_balloons: baseAmount ? nextCalc.finalTotal : undefined,
      funding_split_count: 5,
    });
  };

  const handleTargetTeamSelect = (newTarget: FundingTargetTeam) => {
    const nextCalc = calculateFundingByRatio({
      baseAmount,
      ratio: currentRatio,
      targetTeam: newTarget,
      isWon,
      splitCount: 5,
    });

    onFundingChange({
      funding_base_amount: baseAmount,
      funding_ratio: currentRatio,
      funding_target_team: newTarget,
      funding_per_person: baseAmount ? nextCalc.finalPerPerson : undefined,
      funding: baseAmount ? nextCalc.finalTotal : undefined,
      star_balloons: baseAmount ? nextCalc.finalTotal : undefined,
      funding_split_count: 5,
    });
  };

  const handleReset = () => {
    onFundingChange({
      funding_base_amount: undefined,
      funding_ratio: '100:0',
      funding_target_team: 'auto',
      funding_per_person: undefined,
      funding: undefined,
      star_balloons: undefined,
      funding_split_count: 5,
    });
  };

  return (
    <div className="mb-4 p-3.5 bg-[#0a0a14] border border-[#1e1e2c] rounded-[16px] space-y-3.5">
      {/* 1. Header: 펀딩 설정 타이틀 & 숲 파트너 지원금 토글 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Input for base per-person funding amount */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="text-[12px] font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
            <span>🎈</span>
            <span>인당 별풍선 펀딩</span>
          </label>

          <div className="relative w-[150px] sm:w-[170px]">
            <input
              type="text"
              inputMode="numeric"
              value={baseAmount !== undefined && baseAmount !== null ? baseAmount.toLocaleString() : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                const val = raw ? parseInt(raw, 10) : undefined;
                handleBaseAmountChange(val);
              }}
              placeholder="예: 10,000"
              className="w-full h-[36px] bg-[#12121e] border border-[#2a2a3e] rounded-full pl-3.5 pr-8 text-[12.5px] text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#fbbf24] font-bold"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[#8a8aa0] pointer-events-none font-semibold">
              개
            </span>
          </div>

          {/* 기준 총 펀딩 배지 */}
          {Boolean(baseAmount && baseAmount > 0) && (
            <div className="text-[11px] font-semibold text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/25 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
              <span className="text-[#8a8aa0] font-normal">↳ 기준 총액:</span>
              <span className="font-bold">{(baseAmount * 5).toLocaleString()}개</span>
              <span className="text-[10px] text-[#fbbf24]/70 font-normal">(5인 기준)</span>
            </div>
          )}
        </div>

        {/* Right: SOOP Partner Subsidy Toggle */}
        <div className="flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              const nextState = !hasSubsidy;
              onSubsidyToggle(nextState);
              if (onToast) {
                onToast(
                  nextState
                    ? '🌱 숲 파트너 지원금 100만 원(인당 20만 원)이 적용되었습니다.'
                    : '숲 파트너 지원금이 해제되었습니다.'
                );
              }
            }}
            className={`h-[36px] px-3.5 rounded-full border text-[11.5px] font-bold transition-all flex items-center gap-2.5 shadow-sm active:scale-95 cursor-pointer ${
              hasSubsidy
                ? 'bg-[#00c73c]/20 border-[#00c73c] text-[#4ade80] shadow-[0_0_14px_rgba(0,199,60,0.25)]'
                : 'bg-[#12121e] border-[#2a2a3e] text-[#8a8aa0] hover:text-[#c0c0d0] hover:border-[#3a3a4e]'
            }`}
            title="숲 파트너 공식 지원금 (100만 원) 적용 토글"
          >
            <span className="flex items-center gap-1.5">
              <span>🌱</span>
              <span>숲 지원금 (100만 원)</span>
            </span>
            <span
              className={`w-7 h-4 rounded-full flex items-center px-0.5 transition-colors duration-200 ${
                hasSubsidy ? 'bg-[#00c73c] justify-end' : 'bg-[#2a2a3a] justify-start'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-white shadow-md inline-block" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider ml-0.5">
              {hasSubsidy ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. 간편 추가 버튼들 */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span className="text-[11px] text-[#8a8aa0] font-medium mr-1">간편 추가:</span>
        {[1000, 5000, 10000, 20000].map((addAmount) => (
          <button
            key={addAmount}
            type="button"
            onClick={() => {
              const next = (baseAmount || 0) + addAmount;
              handleBaseAmountChange(next);
            }}
            className="h-[28px] px-2.5 bg-[#181824] hover:bg-[#252536] border border-[#2a2a3e] text-[#d1d5db] hover:text-white rounded-lg text-[11px] font-bold transition active:scale-95 cursor-pointer"
          >
            +{addAmount >= 10000 ? `${addAmount / 10000}만` : `${addAmount.toLocaleString()}`}
          </button>
        ))}

        {Boolean(baseAmount && baseAmount > 0) && (
          <button
            type="button"
            onClick={handleReset}
            className="h-[28px] px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-lg text-[10.5px] font-semibold transition ml-1 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>초기화</span>
          </button>
        )}
      </div>

      {/* 3. 펀딩 배분 비율 선택 옵션 (드롭다운 & 칩 버튼) */}
      <div className="pt-2 border-t border-[#1e1e2e]/80 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-bold text-white flex items-center gap-1">
              <span>⚖️</span>
              <span>펀딩 배분 비율</span>
            </span>
            <span className="text-[10px] text-[#8a8aa0]">
              ({calc.ratioOption.desc})
            </span>
          </div>

          {/* Ratio Dropdown */}
          <select
            value={currentRatio}
            onChange={(e) => handleRatioSelect(e.target.value as FundingRatio)}
            className="h-[28px] bg-[#12121e] border border-[#2a2a3e] rounded-lg px-2.5 text-[11px] text-[#fbbf24] font-bold focus:outline-none focus:border-[#fbbf24] cursor-pointer"
          >
            {FUNDING_RATIO_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quick-Select Chip Buttons */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {FUNDING_RATIO_OPTIONS.map((opt) => {
            const isSelected = opt.key === currentRatio;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleRatioSelect(opt.key)}
                className={`h-[30px] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                  isSelected
                    ? 'bg-[#fbbf24]/20 border-[#fbbf24] text-[#fbbf24] shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                    : 'bg-[#141420] border-[#252538] text-[#8a8aa0] hover:text-white hover:border-[#3a3a52]'
                }`}
              >
                <span>{opt.shortLabel}</span>
                {opt.key === '100:0' && (
                  <span className="text-[9px] font-normal opacity-80">(기본)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. 비율 반영 계산 로직 및 승리팀/패배팀(지분율) 선택 UI */}
      {Boolean(baseAmount && baseAmount > 0) && (
        <div className="pt-2 border-t border-[#1e1e2e]/80 space-y-2.5 bg-[#0e0e1a]/80 -mx-3.5 -mb-3.5 p-3.5 rounded-b-[16px]">
          <div className="flex items-center justify-between text-[11px] text-[#8a8aa0]">
            <span className="font-semibold text-white flex items-center gap-1">
              <Sparkles size={12} className="text-[#fbbf24]" />
              <span>지분율 자동 산출 & 반영 대상 선택</span>
            </span>
            <span className="text-[10px]">
              현재 경기 결과: <b className={isWon ? 'text-[#4ade80]' : 'text-[#f87171]'}>{isWon ? '우리밍 승리' : '우리밍 패배'}</b>
            </span>
          </div>

          {/* 승리팀 / 패배팀 지분 카드 */}
          <div className="grid grid-cols-2 gap-2">
            {/* 🏆 승리팀 지분 */}
            <div
              onClick={() => handleTargetTeamSelect('winner')}
              role="button"
              tabIndex={0}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                calc.effectiveTarget === 'winner'
                  ? 'bg-[#22c55e]/15 border-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : 'bg-[#141420] border-[#222234] opacity-70 hover:opacity-100 hover:border-[#22c55e]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-[#4ade80] flex items-center gap-1">
                  <Trophy size={12} />
                  <span>승리팀 ({calc.ratioOption.winPct}%)</span>
                </span>
                {calc.effectiveTarget === 'winner' && (
                  <span className="text-[9px] font-black bg-[#22c55e] text-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                    <Check size={9} />
                    적용중
                  </span>
                )}
              </div>
              <div className="text-[15px] font-black text-white">
                {calc.winPerPerson.toLocaleString()}
                <span className="text-[10px] text-[#8a8aa0] ml-0.5 font-normal">개 / 1인</span>
              </div>
              <div className="text-[9.5px] text-[#4ade80]/80 mt-0.5">
                팀 총액: {calc.winTotal.toLocaleString()}개 (5인)
              </div>
            </div>

            {/* 🛡️ 패배팀 지분 */}
            <div
              onClick={() => handleTargetTeamSelect('loser')}
              role="button"
              tabIndex={0}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                calc.effectiveTarget === 'loser'
                  ? 'bg-[#ef4444]/15 border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                  : 'bg-[#141420] border-[#222234] opacity-70 hover:opacity-100 hover:border-[#ef4444]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-[#f87171] flex items-center gap-1">
                  <Shield size={12} />
                  <span>패배팀 ({calc.ratioOption.lossPct}%)</span>
                </span>
                {calc.effectiveTarget === 'loser' && (
                  <span className="text-[9px] font-black bg-[#ef4444] text-white px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                    <Check size={9} />
                    적용중
                  </span>
                )}
              </div>
              <div className="text-[15px] font-black text-white">
                {calc.lossPerPerson.toLocaleString()}
                <span className="text-[10px] text-[#8a8aa0] ml-0.5 font-normal">개 / 1인</span>
              </div>
              <div className="text-[9.5px] text-[#f87171]/80 mt-0.5">
                팀 총액: {calc.lossTotal.toLocaleString()}개 (5인)
              </div>
            </div>
          </div>

          {/* 반영 대상 모드 토글 (경기결과 연동 / 승리팀 고정 / 패배팀 고정) */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 text-[11px]">
            <span className="text-[#8a8aa0] text-[10.5px]">반영 기준:</span>
            <div className="flex items-center gap-1 bg-[#12121e] p-0.5 rounded-lg border border-[#222234]">
              <button
                type="button"
                onClick={() => handleTargetTeamSelect('auto')}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                  currentTargetTeam === 'auto'
                    ? 'bg-[#8b5cf6] text-white shadow'
                    : 'text-[#8a8aa0] hover:text-white'
                }`}
                title="우리밍 팀의 승/패에 따라 승리팀/패배팀 지분이 자동 반영됩니다"
              >
                ⚡ 경기 결과 연동(자동)
              </button>
              <button
                type="button"
                onClick={() => handleTargetTeamSelect('winner')}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                  currentTargetTeam === 'winner'
                    ? 'bg-[#22c55e] text-black shadow'
                    : 'text-[#8a8aa0] hover:text-white'
                }`}
              >
                🏆 승리팀 지분
              </button>
              <button
                type="button"
                onClick={() => handleTargetTeamSelect('loser')}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                  currentTargetTeam === 'loser'
                    ? 'bg-[#ef4444] text-white shadow'
                    : 'text-[#8a8aa0] hover:text-white'
                }`}
              >
                🛡️ 패배팀 지분
              </button>
            </div>
          </div>

          {/* 최종 저장 인당 펀딩 요약 바 */}
          <div className="bg-[#12121f] border border-[#2b2b3e] rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px]">🎈</span>
              <div>
                <div className="text-[10px] text-[#8a8aa0] font-semibold">
                  최종 반영 인당 펀딩액 ({calc.ratio} 배분 · {calc.effectiveTarget === 'winner' ? '승리팀' : '패배팀'} 기준)
                </div>
                <div className="text-[15px] font-black text-[#fbbf24] tracking-tight">
                  {calc.finalPerPerson.toLocaleString()}
                  <span className="text-[11px] font-bold text-white ml-0.5">개</span>
                </div>
              </div>
            </div>

            <div className="text-right text-[10.5px] text-[#8a8aa0]">
              <div>팀 총액 <b className="text-white">{calc.finalTotal.toLocaleString()}개</b> 저장</div>
              <div className="text-[9.5px] text-[#fbbf24]/80">경기 카드 및 통계에 자동 반영</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
