import React, { useState, useMemo } from 'react';
import { Match, LineName, PartnerStat, LINE_LABELS, LineKey } from '../types';
import { ComputedStats, getWoorimingTeam, getWoorimingLineKey, getPlayerLineChampionStats } from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { StreamerAvatar } from './StreamerAvatar';
import { TeamSimulator } from './TeamSimulator';
import { X, Trophy, TrendingDown, Users, ChevronRight, Calendar, Swords, Zap, Target, Shield } from 'lucide-react';

interface SynergyTabProps {
  stats: ComputedStats;
  matches: Match[];
  allStreamers?: string[];
  onToast?: (msg: string) => void;
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
}

export const SynergyTab: React.FC<SynergyTabProps> = ({
  stats,
  matches,
  allStreamers = [],
  onToast = () => {},
  onJumpToStreamer,
}) => {
  // 기본 원딜(ADC) 포지션 중심 4카드 표시 (원딜 or 서폿 토글 가능)
  const [activeRole, setActiveRole] = useState<'ADC' | 'SUP'>('ADC');
  const [selectedModal, setSelectedModal] = useState<{
    woorimingLine: 'ADC' | 'SUP';
    partnerLine: LineName;
    selectedStreamer?: string | null;
  } | null>(null);

  // 파트너 라인 (원딜일 때: TOP, JGL, MID, SUP 4개 카드)
  const partnerLines: LineName[] = useMemo(() => {
    return (['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as LineName[]).filter((l) => l !== activeRole);
  }, [activeRole]);

  // 모달 내 특정 스트리머와 함께 출전한 경기 목록
  const partnerMatches = useMemo(() => {
    if (!selectedModal?.selectedStreamer) return [];
    const partnerName = selectedModal.selectedStreamer;
    const targetWLine = selectedModal.woorimingLine;
    const targetPLine = selectedModal.partnerLine;

    return matches.filter((m) => {
      const wTeam = getWoorimingTeam(m);
      const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
      const wKey = getWoorimingLineKey(m);
      if (LINE_LABELS[wKey] !== targetWLine) return false;

      const pKey = (Object.keys(LINE_LABELS) as LineKey[]).find((k) => LINE_LABELS[k] === targetPLine);
      if (!pKey) return false;
      return wRoster[pKey]?.trim() === partnerName.trim();
    });
  }, [matches, selectedModal]);

  return (
    <div className="space-y-10 animate-[fadeIn_0.2s]">
      {/* 탭 상단 타이틀 */}
      <div>
        <h1 className="text-[20px] font-black text-white flex items-center gap-2.5">
          <Users size={22} className="text-[#8b5cf6]" />
          <span>시너지 분석 &amp; 팀 시뮬레이터</span>
        </h1>
        <p className="text-[13px] text-[#8a8aa0] mt-1">
          상단에서는 우리밍_ 중심의 라인별 파트너 시너지를, 하단에서는 10인 명단을 등록하여 5:5 최적 팀 승률을 시뮬레이션할 수 있습니다.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. 상단: 개인 시너지 (원딜 포지션 중심의 기본 4카드 및 관련 통계) */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1e1e2a]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-6 bg-[#8b5cf6] rounded-full inline-block shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            <div>
              <h2 className="text-[16px] font-black text-white flex items-center gap-2">
                <span>개인 시너지</span>
                <span className="text-[12px] font-bold text-[#a78bfa]">
                  ({activeRole === 'ADC' ? '원딜 포지션 중심 기본 4카드' : '서폿 포지션 4카드'})
                </span>
              </h2>
              <p className="text-[11px] text-[#8a8aa0]">
                우리밍_이 {activeRole === 'ADC' ? '원딜(ADC)' : '서폿(SUP)'}일 때 함께한 라인별 Best &amp; Worst 파트너 및 상세 전적입니다.
              </p>
            </div>
          </div>

          {/* 원딜 / 서폿 토글 (기본: 원딜 ADC) */}
          <div className="flex items-center bg-[#12121a] border border-[#1e1e2a] rounded-xl p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveRole('ADC')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                activeRole === 'ADC'
                  ? 'bg-[#8b5cf6] text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                  : 'text-[#8a8aa0] hover:text-white'
              }`}
            >
              <Target size={13} />
              <span>원딜(ADC) 시너지 [기본]</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('SUP')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                activeRole === 'SUP'
                  ? 'bg-[#8b5cf6] text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                  : 'text-[#8a8aa0] hover:text-white'
              }`}
            >
              <Shield size={13} />
              <span>서폿(SUP) 시너지</span>
            </button>
          </div>
        </div>

        {/* 4개 라인 카드 컨테이너 */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-5 md:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#8b5cf6]/20 text-[#c4b5fd] border border-[#8b5cf6]/40 text-[11px] font-black">
                우리밍_ {activeRole}
              </span>
              <span className="text-[11px] text-[#8a8aa0]">
                {activeRole === 'ADC'
                  ? '탑(TOP) · 정글(JGL) · 미드(MID) · 서폿(SUP) 파트너'
                  : '탑(TOP) · 정글(JGL) · 미드(MID) · 원딜(ADC) 파트너'}
              </span>
            </div>
            <span className="text-[10px] text-[#6a6a80]">카드 클릭 시 상세 랭킹 및 경기 목록 조회</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {partnerLines.map((pLine) => {
              const partnerMap = stats.partnerStats.overall[activeRole];
              const allPartnersInLine = (Object.values(partnerMap) as PartnerStat[]).filter(
                (p) => p.line === pLine
              );

              // 1. Best 파트너: 승률 50% 초과 & 최소 1승 이상
              const bestCandidates = allPartnersInLine
                .filter((p) => p.wins > 0 && p.wins > p.games - p.wins)
                .sort(
                  (a, b) => b.wins / b.games - a.wins / a.games || b.wins - a.wins || b.games - a.games
                );
              const best = bestCandidates[0] || null;

              // 2. Worst 파트너: 패가 승보다 많거나 0승
              const worstCandidates = allPartnersInLine
                .filter((p) => p.wins === 0 || p.games - p.wins > p.wins)
                .sort(
                  (a, b) =>
                    a.wins / a.games - b.wins / b.games ||
                    (b.games - b.wins) - (a.games - a.wins) ||
                    b.games - a.games
                );
              const worst = worstCandidates[0] || null;

              const bestChamps = best ? getPlayerLineChampionStats(best.name, pLine, matches).slice(0, 3) : [];
              const worstChamps = worst ? getPlayerLineChampionStats(worst.name, pLine, matches).slice(0, 3) : [];

              return (
                <div
                  key={pLine}
                  onClick={() =>
                    setSelectedModal({
                      woorimingLine: activeRole,
                      partnerLine: pLine,
                      selectedStreamer: null,
                    })
                  }
                  className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-4 hover:border-[#8b5cf6]/50 transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-[#1e1e2a]/50">
                      <div className="text-[12px] tracking-wider text-[#8b5cf6] font-black flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-[#8b5cf6] rounded-full inline-block" />
                        <span>{pLine} 라인</span>
                      </div>
                      <span className="text-[10px] text-[#5a5a6a] group-hover:text-[#a78bfa] transition flex items-center gap-0.5 font-medium">
                        랭킹 보기 <ChevronRight size={12} />
                      </span>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {/* BEST */}
                      <div
                        onClick={(e) => {
                          if (best) {
                            e.stopPropagation();
                            setSelectedModal({
                              woorimingLine: activeRole,
                              partnerLine: pLine,
                              selectedStreamer: best.name,
                            });
                          }
                        }}
                        className={`p-2.5 rounded-[12px] border transition ${
                          best
                            ? 'bg-[#10b981]/5 border-[#10b981]/20 hover:bg-[#10b981]/15'
                            : 'bg-transparent border-[#1e1e2a]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1 text-[11px] text-[#10b981] font-black">
                            <Trophy size={13} />
                            <span>BEST</span>
                          </div>
                          {best ? (
                            <div className="flex items-center gap-2">
                              <StreamerAvatar
                                name={best.name}
                                size={28}
                                shape="circle"
                                className="border border-[#10b981]/40"
                              />
                              <div className="text-right">
                                <div className="text-[12px] font-bold text-white group-hover:text-[#86efac] transition leading-tight">
                                  {best.name}
                                </div>
                                <div className="text-[10px] text-[#8a8aa0] mt-0.5">
                                  {best.games}판 {best.wins}승 {best.games - best.wins}패{' '}
                                  <span className="text-[#10b981] font-bold">
                                    {((best.wins / best.games) * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#5a5a6a]">조건 만족 없음</div>
                          )}
                        </div>

                        {/* Best Most Champions */}
                        {best && bestChamps.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[#10b981]/15 space-y-1">
                            <div className="text-[9px] text-[#8a8aa0] flex items-center justify-between">
                              <span>모스트 챔피언</span>
                              <span className="text-[9px] text-[#10b981] font-bold">TOP {bestChamps.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {bestChamps.map((c) => (
                                <div
                                  key={c.champ}
                                  className="inline-flex items-center gap-1 bg-[#08080c] border border-[#10b981]/25 px-1.5 py-0.5 rounded-[5px] text-[9px]"
                                  title={`${c.champ}: ${c.games}판 ${c.wins}승 ${c.losses}패 (${c.winrate.toFixed(0)}%)`}
                                >
                                  <ChampionIcon name={c.champ} size={12} />
                                  <span className="font-semibold text-white truncate max-w-[45px]">{c.champ}</span>
                                  <span
                                    className={`font-bold ${
                                      c.winrate >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'
                                    }`}
                                  >
                                    {c.winrate.toFixed(0)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* WORST */}
                      <div
                        onClick={(e) => {
                          if (worst) {
                            e.stopPropagation();
                            setSelectedModal({
                              woorimingLine: activeRole,
                              partnerLine: pLine,
                              selectedStreamer: worst.name,
                            });
                          }
                        }}
                        className={`p-2.5 rounded-[12px] border transition ${
                          worst
                            ? 'bg-[#ef4444]/5 border-[#ef4444]/20 hover:bg-[#ef4444]/15'
                            : 'bg-transparent border-[#1e1e2a]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1 text-[11px] text-[#ef4444] font-black">
                            <TrendingDown size={13} />
                            <span>WORST</span>
                          </div>
                          {worst ? (
                            <div className="flex items-center gap-2">
                              <StreamerAvatar
                                name={worst.name}
                                size={28}
                                shape="circle"
                                className="border border-[#ef4444]/40"
                              />
                              <div className="text-right">
                                <div className="text-[12px] font-bold text-white group-hover:text-[#fca5a5] transition leading-tight">
                                  {worst.name}
                                </div>
                                <div className="text-[10px] text-[#8a8aa0] mt-0.5">
                                  {worst.games}판 {worst.wins}승 {worst.games - worst.wins}패{' '}
                                  <span className="text-[#ef4444] font-bold">
                                    {((worst.wins / worst.games) * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#5a5a6a]">조건 만족 없음</div>
                          )}
                        </div>

                        {/* Worst Most Champions */}
                        {worst && worstChamps.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[#ef4444]/15 space-y-1">
                            <div className="text-[9px] text-[#8a8aa0] flex items-center justify-between">
                              <span>모스트 챔피언</span>
                              <span className="text-[9px] text-[#ef4444] font-bold">TOP {worstChamps.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {worstChamps.map((c) => (
                                <div
                                  key={c.champ}
                                  className="inline-flex items-center gap-1 bg-[#08080c] border border-[#ef4444]/25 px-1.5 py-0.5 rounded-[5px] text-[9px]"
                                  title={`${c.champ}: ${c.games}판 ${c.wins}승 ${c.losses}패 (${c.winrate.toFixed(0)}%)`}
                                >
                                  <ChampionIcon name={c.champ} size={12} />
                                  <span className="font-semibold text-white truncate max-w-[45px]">{c.champ}</span>
                                  <span
                                    className={`font-bold ${
                                      c.winrate >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'
                                    }`}
                                  >
                                    {c.winrate.toFixed(0)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[10px] text-[#5a5a6a] text-center pt-2 border-t border-[#1e1e2a]/60 font-medium">
                    총 {allPartnersInLine.length}명의 {pLine} 파트너 기록
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. 하단: 팀 시너지 (Red/Blue 10인 팀 입력 및 시뮬레이터 기능) */}
      {/* ========================================================================= */}
      <section className="space-y-4 pt-4 border-t border-[#1e1e2a]/80">
        <div className="flex items-center gap-2.5 pb-1">
          <span className="w-2.5 h-6 bg-[#3b82f6] rounded-full inline-block shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          <div>
            <h2 className="text-[16px] font-black text-white flex items-center gap-2">
              <span>팀 시너지</span>
              <span className="text-[12px] font-bold text-[#60a5fa]">(Red / Blue 10인 시뮬레이터)</span>
            </h2>
            <p className="text-[11px] text-[#8a8aa0]">
              맞라인 1:1 상대 전적 및 같은 팀 케미를 기반으로 5:5 최적의 팀 밸런스와 승률을 예측합니다.
            </p>
          </div>
        </div>

        {/* TeamSimulator 컴포넌트 마운트 */}
        <TeamSimulator
          stats={stats}
          matches={matches}
          allStreamers={allStreamers}
          onToast={onToast}
          onJumpToStreamer={onJumpToStreamer}
        />
      </section>

      {/* ========================================================================= */}
      {/* 파트너 랭킹 & 출전 경기 상세 모달 */}
      {/* ========================================================================= */}
      {selectedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s]"
          onClick={() => setSelectedModal(null)}
        >
          <div
            className="w-full max-w-[880px] bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-6 max-h-[88vh] overflow-y-auto shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex justify-between items-start border-b border-[#1e1e2a] pb-4">
              <div>
                <div className="font-bold text-[17px] text-white flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#8b5cf6] text-white rounded text-[11px] font-black">
                    우리밍_ {selectedModal.woorimingLine === 'ADC' ? '원딜' : '서폿'}
                  </span>
                  <span>×</span>
                  <span className="text-[#a78bfa]">{selectedModal.partnerLine} 파트너 상세 데이터</span>
                </div>
                <div className="text-[11px] text-[#8a8aa0] mt-1">
                  파트너별 승률 랭킹, 해당 라인 모스트 챔피언 TOP 3 및 스트리머 클릭 시 함께 출전한 전적(경기 목록) 확인
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModal(null)}
                className="w-[30px] h-[30px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white text-[12px] transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* 랭킹 테이블 */}
            <div>
              <div className="text-[12px] font-bold text-white mb-2 flex items-center justify-between">
                <span>파트너 랭킹 목록 (스트리머 클릭 시 하단에 경기 목록 표시)</span>
                <span className="text-[11px] text-[#8a8aa0] font-normal">
                  승&gt;패: Best / 패&gt;승·0승: Worst • 모스트 챔피언 순
                </span>
              </div>
              <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="text-[#6a6a80] text-[11px] bg-[#0f0f18] border-b border-[#1e1e2a]">
                      <tr>
                        <th className="text-left p-2.5">순위</th>
                        <th className="text-left p-2.5">스트리머</th>
                        <th className="text-left p-2.5">구분</th>
                        <th className="text-left p-2.5">전적</th>
                        <th className="text-right p-2.5">승률</th>
                        <th className="text-left p-2.5 min-w-[210px]">{selectedModal.partnerLine} 모스트 TOP 3</th>
                        <th className="text-center p-2.5">경기 목록</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const partners = (Object.values(
                          stats.partnerStats.overall[selectedModal.woorimingLine]
                        ) as PartnerStat[])
                          .filter((p) => p.line === selectedModal.partnerLine)
                          .sort(
                            (a, b) => b.wins / b.games - a.wins / a.games || b.wins - a.wins || b.games - a.games
                          );

                        if (partners.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-[#5a5a6a]">
                                해당 포지션과 함께한 경기 기록이 없습니다.
                              </td>
                            </tr>
                          );
                        }

                        return partners.map((p, idx) => {
                          const rate = (p.wins / p.games) * 100;
                          const isSelected = selectedModal.selectedStreamer === p.name;
                          const isBestCandidate = p.wins > 0 && p.wins > p.games - p.wins;
                          const isWorstCandidate = p.wins === 0 || p.games - p.wins > p.wins;
                          const pChamps = getPlayerLineChampionStats(p.name, selectedModal.partnerLine, matches).slice(0, 3);

                          return (
                            <tr
                              key={p.name}
                              onClick={() =>
                                setSelectedModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        selectedStreamer: prev.selectedStreamer === p.name ? null : p.name,
                                      }
                                    : null
                                )
                              }
                              className={`border-t border-[#1e1e2a] cursor-pointer transition ${
                                isSelected
                                    ? 'bg-[#8b5cf6]/20 border-l-4 border-l-[#8b5cf6]'
                                  : 'hover:bg-[#1a1a26]'
                              }`}
                            >
                              <td className="p-2.5 text-[#8a8aa0] font-medium">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-white flex items-center gap-2">
                                <StreamerAvatar name={p.name} size={22} shape="circle" />
                                <span>{p.name}</span>
                                {isSelected && (
                                  <span className="text-[10px] bg-[#8b5cf6] text-white px-1.5 py-0.2 rounded font-normal">
                                    선택됨
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {isBestCandidate ? (
                                  <span className="text-[10px] font-semibold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 px-1.5 py-0.5 rounded">
                                    BEST
                                  </span>
                                ) : isWorstCandidate ? (
                                  <span className="text-[10px] font-semibold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 px-1.5 py-0.5 rounded">
                                    WORST
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold bg-[#8a8aa0]/15 text-[#8a8aa0] px-1.5 py-0.5 rounded">
                                    50%
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-[#c0c0d0]">
                                {p.games}판 <span className="text-[#3b82f6] font-semibold">{p.wins}승</span>{' '}
                                <span className="text-[#ef4444] font-semibold">{p.games - p.wins}패</span>
                              </td>
                              <td className="p-2.5 text-right">
                                <span
                                  className={`font-bold min-w-[36px] ${
                                    rate >= 50 ? 'text-[#3b82f6]' : 'text-[#ef4444]'
                                  }`}
                                >
                                  {rate.toFixed(0)}%
                                </span>
                              </td>
                              <td className="p-2.5">
                                {pChamps.length === 0 ? (
                                  <span className="text-[11px] text-[#5a5a6a]">기록 없음</span>
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {pChamps.map((c) => (
                                      <div
                                        key={c.champ}
                                        className="inline-flex items-center gap-1 bg-[#12121c] border border-[#252538] hover:border-[#8b5cf6]/40 px-2 py-0.5 rounded-[7px] text-[11px] transition-colors"
                                        title={`${c.champ}: ${c.games}판 ${c.wins}승 ${c.losses}패 (${c.winrate.toFixed(0)}%)`}
                                      >
                                        <ChampionIcon name={c.champ} size={15} />
                                        <span className="font-semibold text-white">{c.champ}</span>
                                        <span className="text-[#8a8aa0] text-[10px] ml-0.5">
                                          {c.games}판
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold ${
                                            c.winrate >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'
                                          }`}
                                        >
                                          ({c.winrate.toFixed(0)}%)
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                                    isSelected
                                      ? 'bg-[#8b5cf6] text-white'
                                      : 'bg-[#1a1a26] text-[#8a8aa0] hover:text-white'
                                  }`}
                                >
                                  {isSelected ? '접기 ▲' : '조회 ▼'}
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 선택된 스트리머와 함께한 경기 목록 */}
            {selectedModal.selectedStreamer && (
              <div className="border-t border-[#1e1e2a] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold text-white flex items-center gap-2">
                    <StreamerAvatar name={selectedModal.selectedStreamer} size={20} shape="circle" />
                    <span className="text-[#a78bfa]">{selectedModal.selectedStreamer}</span>
                    <span>선수와 함께 출전한 경기 목록</span>
                    <span className="text-[#8a8aa0] text-[12px] font-normal">
                      (총 {partnerMatches.length}경기)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6a6a80]">최신순</span>
                </div>

                {partnerMatches.length === 0 ? (
                  <div className="p-8 text-center text-[#5a5a6a] bg-[#08080c] rounded-[14px] border border-[#1e1e2a] text-[12px]">
                    해당 파트너와의 직접 경기 기록이 조회되지 않습니다.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {partnerMatches.map((m) => {
                      const wTeam = getWoorimingTeam(m);
                      const won = m.winning_team === wTeam;
                      const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
                      const wChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
                      const wKdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;
                      const wKey = getWoorimingLineKey(m);
                      const pKey = (Object.keys(LINE_LABELS) as LineKey[]).find(
                        (k) => LINE_LABELS[k] === selectedModal.partnerLine
                      )!;

                      return (
                        <div
                          key={m.id}
                          className="bg-[#08080c] border border-[#1e1e2a] rounded-[12px] p-3 flex items-center justify-between gap-4 hover:border-[#8b5cf6]/30 transition"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  won
                                    ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40'
                                    : 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40'
                                }`}
                              >
                                {won ? '승리' : '패배'}
                              </span>
                              <span className="text-[#8a8aa0] text-[11px] flex items-center gap-1">
                                <Calendar size={11} />
                                {m.date}
                              </span>
                              <span className="font-semibold text-white truncate max-w-[200px]">
                                {m.ck_name}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#c0c0d0] flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1">
                                <strong className="text-[#8b5cf6]">우리밍_({LINE_LABELS[wKey]}):</strong>{' '}
                                {wChamps[wKey] ? (
                                  <>
                                    <ChampionIcon name={wChamps[wKey]} size={14} />
                                    <span>{wChamps[wKey]}</span>
                                  </>
                                ) : (
                                  <span>-</span>
                                )}
                                {wKdas[wKey] ? ` (${wKdas[wKey]})` : ''}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <strong>
                                  {selectedModal.selectedStreamer}({selectedModal.partnerLine}):
                                </strong>{' '}
                                {wChamps[pKey] ? (
                                  <>
                                    <ChampionIcon name={wChamps[pKey]} size={14} />
                                    <span>{wChamps[pKey]}</span>
                                  </>
                                ) : (
                                  <span>-</span>
                                )}
                                {wKdas[pKey] ? ` (${wKdas[pKey]})` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <div className="text-[11px] font-bold text-white">
                              {m.winning_team === 'Red' ? 'RED팀' : 'BLUE팀'} {m.score || ''}
                            </div>
                            <div className="text-[10px] text-[#8a8aa0]">
                              소속: {wTeam === 'Red' ? '🔴 Red팀' : '🔵 Blue팀'}
                            </div>
                            {onJumpToStreamer && (
                              <button
                                type="button"
                                onClick={() => {
                                  const name = selectedModal.selectedStreamer || '';
                                  setSelectedModal(null);
                                  onJumpToStreamer(name, m.id, 'ally');
                                }}
                                className="mt-0.5 px-2 py-0.5 rounded bg-[#1e1e30] hover:bg-[#8b5cf6] text-[#c0c0d8] hover:text-white rounded-md text-[10px] font-bold border border-[#2a2a44] transition flex items-center gap-1"
                                title="CK 일지의 해당 세트 카드로 이동"
                              >
                                <span>이 세트로 이동</span>
                                <Zap size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
