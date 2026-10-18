export type FundingRatio = '100:0' | '9:1' | '8:2' | '7:3' | '6:4' | '5:5';
export type FundingTargetTeam = 'auto' | 'winner' | 'loser';

export interface FundingRatioOption {
  key: FundingRatio;
  label: string;
  shortLabel: string;
  winPct: number; // e.g. 100, 90, 80, 70, 60, 50
  lossPct: number; // e.g. 0, 10, 20, 30, 40, 50
  desc: string;
}

export const FUNDING_RATIO_OPTIONS: FundingRatioOption[] = [
  {
    key: '100:0',
    label: '100:0 (1/n 동일 배분 / 승자독식)',
    shortLabel: '100:0',
    winPct: 100,
    lossPct: 0,
    desc: '승리팀 100% · 패배팀 0%',
  },
  {
    key: '9:1',
    label: '9:1 배분',
    shortLabel: '9:1',
    winPct: 90,
    lossPct: 10,
    desc: '승리팀 90% · 패배팀 10%',
  },
  {
    key: '8:2',
    label: '8:2 배분',
    shortLabel: '8:2',
    winPct: 80,
    lossPct: 20,
    desc: '승리팀 80% · 패배팀 20%',
  },
  {
    key: '7:3',
    label: '7:3 배분',
    shortLabel: '7:3',
    winPct: 70,
    lossPct: 30,
    desc: '승리팀 70% · 패배팀 30%',
  },
  {
    key: '6:4',
    label: '6:4 배분',
    shortLabel: '6:4',
    winPct: 60,
    lossPct: 40,
    desc: '승리팀 60% · 패배팀 40%',
  },
  {
    key: '5:5',
    label: '5:5 (반반 배분)',
    shortLabel: '5:5',
    winPct: 50,
    lossPct: 50,
    desc: '승리팀 50% · 패배팀 50%',
  },
];

export interface FundingCalculationResult {
  baseAmount: number; // 기준 인당 금액 (100% 기준)
  ratio: FundingRatio;
  ratioOption: FundingRatioOption;
  winPerPerson: number;
  lossPerPerson: number;
  winTotal: number;
  lossTotal: number;
  finalPerPerson: number;
  finalTotal: number;
  effectiveTarget: 'winner' | 'loser';
  targetTeam: FundingTargetTeam;
  splitCount: number;
}

/**
 * Calculates per-person and total funding amounts based on base amount, selected ratio,
 * and chosen target team (or auto-synced with match result).
 */
export function calculateFundingByRatio(params: {
  baseAmount?: number;
  ratio?: FundingRatio | string;
  targetTeam?: FundingTargetTeam | string;
  isWon?: boolean;
  splitCount?: number;
}): FundingCalculationResult {
  const baseAmount = Math.max(0, params.baseAmount || 0);
  const ratioKey = (params.ratio as FundingRatio) || '100:0';
  const ratioOption =
    FUNDING_RATIO_OPTIONS.find((r) => r.key === ratioKey) || FUNDING_RATIO_OPTIONS[0];
  const splitCount = params.splitCount || 5;

  const winPerPerson = Math.round(baseAmount * (ratioOption.winPct / 100));
  const lossPerPerson = Math.round(baseAmount * (ratioOption.lossPct / 100));
  const winTotal = winPerPerson * splitCount;
  const lossTotal = lossPerPerson * splitCount;

  const targetTeam: FundingTargetTeam =
    params.targetTeam === 'winner' || params.targetTeam === 'loser'
      ? params.targetTeam
      : 'auto';

  let effectiveTarget: 'winner' | 'loser' = 'winner';
  if (targetTeam === 'winner') {
    effectiveTarget = 'winner';
  } else if (targetTeam === 'loser') {
    effectiveTarget = 'loser';
  } else {
    // 'auto': default to match winner, or winner if undefined
    effectiveTarget = params.isWon === false ? 'loser' : 'winner';
  }

  const finalPerPerson = effectiveTarget === 'winner' ? winPerPerson : lossPerPerson;
  const finalTotal = effectiveTarget === 'winner' ? winTotal : lossTotal;

  return {
    baseAmount,
    ratio: ratioOption.key,
    ratioOption,
    winPerPerson,
    lossPerPerson,
    winTotal,
    lossTotal,
    finalPerPerson,
    finalTotal,
    effectiveTarget,
    targetTeam,
    splitCount,
  };
}
