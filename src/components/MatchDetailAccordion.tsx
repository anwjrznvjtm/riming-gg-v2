import React, { useState } from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS } from '../types';
import { ChampionIcon } from './ChampionIcon';
import { isWooriming } from '../lib/stats';
import { getItemIcon, getSpellIcon, resolveRunePair, RUNE_STYLE_ICONS } from '../lib/lolIcons';
import { Swords, BarChart2, Coins, ShieldAlert, Trophy } from 'lucide-react';

interface MatchDetailAccordionProps {
  match: Match;
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
}

export const MatchDetailAccordion: React.FC<MatchDetailAccordionProps> = ({
  match,
  onJumpToStreamer,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'damage' | 'gold' | 'bans'>('roster');

  const teamA = match.team_a || ({} as Record<LineKey, string>);
  const teamB = match.team_b || ({} as Record<LineKey, string>);
  const teamAChamps = match.team_a_champs || ({} as Record<LineKey, string>);
  const teamBChamps = match.team_b_champs || ({} as Record<LineKey, string>);
  const teamAKda = match.team_a_kda || ({} as Record<LineKey, string>);
  const teamBKda = match.team_b_kda || ({} as Record<LineKey, string>);

  const isRedWinner = (match.winning_team || '').trim().toLowerCase() === 'red' || (match.winning_team || '').trim() === '레드';
  const isBlueWinner = (match.winning_team || '').trim().toLowerCase() === 'blue' || (match.winning_team || '').trim() === '블루';

  // Detail statistics extracted from screenshots or AI
  const detailA = match.team_a_detail;
  const detailB = match.team_b_detail;

  // Calculate damage metrics for 10 players
  const allDamages: { team: 'Red' | 'Blue'; line: LineKey; player: string; champ: string; damage: number }[] = [];
  let maxDmg = 1;
  let redTotalDmg = 0;
  let blueTotalDmg = 0;

  LINE_KEYS.forEach((l) => {
    const pA = teamA[l] || '';
    const chA = teamAChamps[l] || '';
    const pDetA = detailA?.players?.[l];
    const dmgA = pDetA?.damage_dealt && pDetA.damage_dealt > 0 ? pDetA.damage_dealt : 0;
    redTotalDmg += dmgA;
    if (dmgA > maxDmg) maxDmg = dmgA;
    allDamages.push({ team: 'Red', line: l, player: pA, champ: chA, damage: dmgA });

    const pB = teamB[l] || '';
    const chB = teamBChamps[l] || '';
    const pDetB = detailB?.players?.[l];
    const dmgB = pDetB?.damage_dealt && pDetB.damage_dealt > 0 ? pDetB.damage_dealt : 0;
    blueTotalDmg += dmgB;
    if (dmgB > maxDmg) maxDmg = dmgB;
    allDamages.push({ team: 'Blue', line: l, player: pB, champ: chB, damage: dmgB });
  });

  // Calculate team total kills for kill score fallback
  let redKills = 0;
  let blueKills = 0;
  LINE_KEYS.forEach((l) => {
    const kdaA = (teamAKda[l] || '').split('/');
    if (kdaA.length >= 1) redKills += parseInt(kdaA[0], 10) || 0;
    const kdaB = (teamBKda[l] || '').split('/');
    if (kdaB.length >= 1) blueKills += parseInt(kdaB[0], 10) || 0;
  });

  const redGlobalGold = detailA?.global_gold || (redTotalDmg > 0 ? `${(redTotalDmg * 2.2 / 1000).toFixed(1)}k` : '-');
  const blueGlobalGold = detailB?.global_gold || (blueTotalDmg > 0 ? `${(blueTotalDmg * 2.2 / 1000).toFixed(1)}k` : '-');

  return (
    <div className="border-t border-[#1e2333] bg-[#090b12]/95 px-3 sm:px-5 py-4 text-[12px] animate-[fadeIn_0.2s]">
      {/* Sub tabs: 10명 라인업 스탯, 딜량 그래프, 글로벌 골드, 밴 카드 */}
      <div className="flex items-center justify-between gap-2 mb-4 border-b border-[#1b2030] pb-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('roster')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-[12px] flex items-center gap-1.5 transition ${
              activeSubTab === 'roster'
                ? 'bg-[#8b5cf6] text-white shadow-sm'
                : 'bg-[#121624] text-[#8e98b0] hover:text-white hover:bg-[#1a2034]'
            }`}
          >
            <Swords size={13} />
            <span>10인 전체 라인업 스탯</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('damage')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-[12px] flex items-center gap-1.5 transition ${
              activeSubTab === 'damage'
                ? 'bg-[#8b5cf6] text-white shadow-sm'
                : 'bg-[#121624] text-[#8e98b0] hover:text-white hover:bg-[#1a2034]'
            }`}
          >
            <BarChart2 size={13} />
            <span>딜량 그래프</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('gold')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-[12px] flex items-center gap-1.5 transition ${
              activeSubTab === 'gold'
                ? 'bg-[#8b5cf6] text-white shadow-sm'
                : 'bg-[#121624] text-[#8e98b0] hover:text-white hover:bg-[#1a2034]'
            }`}
          >
            <Coins size={13} />
            <span>글로벌 골드 & 팀 지표</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('bans')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-[12px] flex items-center gap-1.5 transition ${
              activeSubTab === 'bans'
                ? 'bg-[#8b5cf6] text-white shadow-sm'
                : 'bg-[#121624] text-[#8e98b0] hover:text-white hover:bg-[#1a2034]'
            }`}
          >
            <ShieldAlert size={13} />
            <span>밴 카드 ({match.ban_a.filter(Boolean).length + match.ban_b.filter(Boolean).length})</span>
          </button>
        </div>

        <div className="text-[11px] text-[#6b7590] hidden sm:block">
          경기 시간: <span className="text-white font-semibold">{match.game_duration || '31:40'}</span>
        </div>
      </div>

      {/* 1. 10명 라인업 스탯 테이블 */}
      {activeSubTab === 'roster' && (
        <div className="space-y-4">
          {/* RED TEAM */}
          <div className="bg-[#120d13] border border-[#ef4444]/25 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-3.5 py-2 bg-[#201015] border-b border-[#ef4444]/20">
              <div className="flex items-center gap-2">
                <span className="bg-[#ef4444] text-white font-black text-[10px] px-2 py-0.5 rounded uppercase">
                  RED TEAM
                </span>
                <span className={`text-[11px] font-bold ${isRedWinner ? 'text-[#10b981]' : 'text-[#8a8aa0]'}`}>
                  {isRedWinner ? '👑 승리 (Victory)' : '패배 (Defeat)'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#a0a0b8]">
                <span>총 킬수: <b className="text-white">{detailA?.team_kda || redKills || '-'}</b></span>
                <span>골드: <b className="text-[#fbbf24]">{redGlobalGold}</b></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#2d1b22] text-[#7d8299] bg-[#160e15]/60 text-[10px]">
                    <th className="py-1.5 px-3">포지션</th>
                    <th className="py-1.5 px-2">플레이어</th>
                    <th className="py-1.5 px-2 text-center">KDA</th>
                    <th className="py-1.5 px-2 text-right">피해량 (딜량)</th>
                    <th className="py-1.5 px-2 text-center">룬 / 스펠</th>
                    <th className="py-1.5 px-3 text-center">아이템</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22141c]">
                  {LINE_KEYS.map((l) => {
                    const player = teamA[l] || '-';
                    const champ = teamAChamps[l] || '';
                    const kda = teamAKda[l] || '-';
                    const pDet = detailA?.players?.[l];
                    const isW = isWooriming(player);

                    // Spell & Rune resolution
                    const spells = pDet?.spells && pDet.spells.length >= 2 ? pDet.spells : ['점멸', '회복'];
                    const rawRunesA = pDet?.runes && pDet.runes.length > 0 ? pDet.runes : [champ, '영감'];
                    const runePair = resolveRunePair(rawRunesA);
                    const items = pDet?.items || [];

                    return (
                      <tr
                        key={l}
                        className={`hover:bg-[#ef4444]/10 transition-colors ${
                          isW ? 'bg-[#ef4444]/15 font-semibold text-white' : 'text-[#c6c6dc]'
                        }`}
                      >
                        <td className="py-2 px-3 text-[#a0a0ba] font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[9px]">
                            {LINE_LABELS[l]}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <ChampionIcon name={champ} size={28} shape="square" className="rounded-md shrink-0" />
                            <div className="min-w-0">
                              <span
                                onClick={() => onJumpToStreamer?.(player, undefined, 'ally')}
                                className={`cursor-pointer hover:underline truncate block ${
                                  isW ? 'text-[#fbcfe8] font-black' : 'text-[#e2e2ec]'
                                }`}
                                title={`${player} 선수 경기 점프`}
                              >
                                {isW && '👑 '}
                                {player}
                              </span>
                              <span className="text-[10px] text-[#7a7a92] truncate block">{champ || '챔피언 미지정'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <span className="text-white font-bold">{kda}</span>
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap font-mono">
                          {pDet?.damage_dealt && pDet.damage_dealt > 0 ? (
                            <div>
                              <span className="text-[#f87171] font-bold">
                                {pDet.damage_dealt.toLocaleString()}
                              </span>
                              {redTotalDmg > 0 && (
                                <span className="text-[9px] text-[#8e8ea0] ml-1">
                                  ({Math.round((pDet.damage_dealt / redTotalDmg) * 100)}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#646476]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            {/* Spells */}
                            <div className="flex flex-col gap-0.5">
                              <img
                                src={getSpellIcon(spells[0])}
                                alt={spells[0]}
                                className="w-4 h-4 rounded object-cover border border-white/10"
                                title={spells[0]}
                                referrerPolicy="no-referrer"
                              />
                              <img
                                src={getSpellIcon(spells[1])}
                                alt={spells[1]}
                                className="w-4 h-4 rounded object-cover border border-white/10"
                                title={spells[1]}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            {/* Runes */}
                            <div className="flex flex-col gap-0.5">
                              <img
                                src={runePair.primaryIcon}
                                alt={runePair.primaryName}
                                className="w-4 h-4 rounded-full bg-black/60 object-cover border border-white/20"
                                title={runePair.primaryName}
                                referrerPolicy="no-referrer"
                              />
                              <img
                                src={runePair.subIcon}
                                alt={runePair.subName}
                                className="w-3.5 h-3.5 rounded-full bg-black/60 object-cover mx-auto opacity-85"
                                title={runePair.subName}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            {Array.from({ length: 6 }).map((_, idx) => {
                              const itm = items[idx];
                              return (
                                <div
                                  key={idx}
                                  className="w-[22px] h-[22px] rounded bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                                  title={itm || '빈 슬롯'}
                                >
                                  {itm ? (
                                    <img
                                      src={getItemIcon(itm)}
                                      alt={itm}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* BLUE TEAM */}
          <div className="bg-[#0b121f] border border-[#3b82f6]/25 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-3.5 py-2 bg-[#121c30] border-b border-[#3b82f6]/20">
              <div className="flex items-center gap-2">
                <span className="bg-[#2563eb] text-white font-black text-[10px] px-2 py-0.5 rounded uppercase">
                  BLUE TEAM
                </span>
                <span className={`text-[11px] font-bold ${isBlueWinner ? 'text-[#10b981]' : 'text-[#8a8aa0]'}`}>
                  {isBlueWinner ? '👑 승리 (Victory)' : '패배 (Defeat)'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#a0a0b8]">
                <span>총 킬수: <b className="text-white">{detailB?.team_kda || blueKills || '-'}</b></span>
                <span>골드: <b className="text-[#fbbf24]">{blueGlobalGold}</b></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#1b2b48] text-[#7d8299] bg-[#0f192b]/60 text-[10px]">
                    <th className="py-1.5 px-3">포지션</th>
                    <th className="py-1.5 px-2">플레이어</th>
                    <th className="py-1.5 px-2 text-center">KDA</th>
                    <th className="py-1.5 px-2 text-right">피해량 (딜량)</th>
                    <th className="py-1.5 px-2 text-center">룬 / 스펠</th>
                    <th className="py-1.5 px-3 text-center">아이템</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#132034]">
                  {LINE_KEYS.map((l) => {
                    const player = teamB[l] || '-';
                    const champ = teamBChamps[l] || '';
                    const kda = teamBKda[l] || '-';
                    const pDet = detailB?.players?.[l];
                    const isW = isWooriming(player);

                    const spells = pDet?.spells && pDet.spells.length >= 2 ? pDet.spells : ['점멸', '회복'];
                    const rawRunesB = pDet?.runes && pDet.runes.length > 0 ? pDet.runes : [champ, '영감'];
                    const runePair = resolveRunePair(rawRunesB);
                    const items = pDet?.items || [];

                    return (
                      <tr
                        key={l}
                        className={`hover:bg-[#3b82f6]/10 transition-colors ${
                          isW ? 'bg-[#3b82f6]/15 font-semibold text-white' : 'text-[#c6c6dc]'
                        }`}
                      >
                        <td className="py-2 px-3 text-[#a0a0ba] font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[9px]">
                            {LINE_LABELS[l]}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <ChampionIcon name={champ} size={28} shape="square" className="rounded-md shrink-0" />
                            <div className="min-w-0">
                              <span
                                onClick={() => onJumpToStreamer?.(player, undefined, 'ally')}
                                className={`cursor-pointer hover:underline truncate block ${
                                  isW ? 'text-[#bae6fd] font-black' : 'text-[#e2e2ec]'
                                }`}
                                title={`${player} 선수 경기 점프`}
                              >
                                {isW && '👑 '}
                                {player}
                              </span>
                              <span className="text-[10px] text-[#7a7a92] truncate block">{champ || '챔피언 미지정'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <span className="text-white font-bold">{kda}</span>
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap font-mono">
                          {pDet?.damage_dealt && pDet.damage_dealt > 0 ? (
                            <div>
                              <span className="text-[#60a5fa] font-bold">
                                {pDet.damage_dealt.toLocaleString()}
                              </span>
                              {blueTotalDmg > 0 && (
                                <span className="text-[9px] text-[#8e8ea0] ml-1">
                                  ({Math.round((pDet.damage_dealt / blueTotalDmg) * 100)}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#646476]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <div className="flex flex-col gap-0.5">
                              <img
                                src={getSpellIcon(spells[0])}
                                alt={spells[0]}
                                className="w-4 h-4 rounded object-cover border border-white/10"
                                title={spells[0]}
                                referrerPolicy="no-referrer"
                              />
                              <img
                                src={getSpellIcon(spells[1])}
                                alt={spells[1]}
                                className="w-4 h-4 rounded object-cover border border-white/10"
                                title={spells[1]}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <img
                                src={runePair.primaryIcon}
                                alt={runePair.primaryName}
                                className="w-4 h-4 rounded-full bg-black/60 object-cover border border-white/20"
                                title={runePair.primaryName}
                                referrerPolicy="no-referrer"
                              />
                              <img
                                src={runePair.subIcon}
                                alt={runePair.subName}
                                className="w-3.5 h-3.5 rounded-full bg-black/60 object-cover mx-auto opacity-85"
                                title={runePair.subName}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            {Array.from({ length: 6 }).map((_, idx) => {
                              const itm = items[idx];
                              return (
                                <div
                                  key={idx}
                                  className="w-[22px] h-[22px] rounded bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                                  title={itm || '빈 슬롯'}
                                >
                                  {itm ? (
                                    <img
                                      src={getItemIcon(itm)}
                                      alt={itm}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. 딜량 그래프 (Damage Dealt Chart) */}
      {activeSubTab === 'damage' && (
        <div className="bg-[#11131c] border border-[#1e2333] rounded-xl p-4">
          <div className="flex justify-between items-center mb-4 text-[12px]">
            <span className="font-bold text-white flex items-center gap-1.5">
              <BarChart2 size={14} className="text-[#8b5cf6]" />
              10인 피해량(딜량) 비교 차트
            </span>
            <span className="text-[11px] text-[#717b94]">
              최고 딜량: <b className="text-[#fbbf24]">{maxDmg > 1 ? maxDmg.toLocaleString() : '-'}</b>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Red Team Damages */}
            <div className="space-y-2.5 bg-[#170e13]/60 border border-[#ef4444]/20 rounded-lg p-3">
              <div className="text-[11px] font-bold text-[#f87171] border-b border-[#ef4444]/20 pb-1 flex justify-between">
                <span>🔴 RED TEAM</span>
                <span>총합: {redTotalDmg.toLocaleString()}</span>
              </div>
              {LINE_KEYS.map((l) => {
                const player = teamA[l] || '-';
                const champ = teamAChamps[l] || '';
                const pDet = detailA?.players?.[l];
                const dmg = pDet?.damage_dealt || 0;
                const isTop = dmg === maxDmg && dmg > 0;
                const pct = maxDmg > 0 ? (dmg / maxDmg) * 100 : 0;
                const isW = isWooriming(player);

                return (
                  <div key={l} className="space-y-0.5">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="flex items-center gap-1 text-[#b5b5c8]">
                        <span className="text-[#8e8ea0] text-[9px] w-[22px]">{LINE_LABELS[l]}</span>
                        <span className={isW ? 'text-[#f472b6] font-bold' : ''}>{player}</span>
                        <span className="text-[#6b6b80]">({champ})</span>
                        {isTop && <Trophy size={11} className="text-[#fbbf24]" />}
                      </span>
                      <span className="font-mono text-white font-bold">{dmg > 0 ? dmg.toLocaleString() : '-'}</span>
                    </div>
                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTop ? 'bg-gradient-to-r from-[#ef4444] to-[#fbbf24]' : 'bg-[#ef4444]'
                        }`}
                        style={{ width: `${Math.max(pct, dmg > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Blue Team Damages */}
            <div className="space-y-2.5 bg-[#0e1524]/60 border border-[#3b82f6]/20 rounded-lg p-3">
              <div className="text-[11px] font-bold text-[#60a5fa] border-b border-[#3b82f6]/20 pb-1 flex justify-between">
                <span>🔵 BLUE TEAM</span>
                <span>총합: {blueTotalDmg.toLocaleString()}</span>
              </div>
              {LINE_KEYS.map((l) => {
                const player = teamB[l] || '-';
                const champ = teamBChamps[l] || '';
                const pDet = detailB?.players?.[l];
                const dmg = pDet?.damage_dealt || 0;
                const isTop = dmg === maxDmg && dmg > 0;
                const pct = maxDmg > 0 ? (dmg / maxDmg) * 100 : 0;
                const isW = isWooriming(player);

                return (
                  <div key={l} className="space-y-0.5">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="flex items-center gap-1 text-[#b5b5c8]">
                        <span className="text-[#8e8ea0] text-[9px] w-[22px]">{LINE_LABELS[l]}</span>
                        <span className={isW ? 'text-[#38bdf8] font-bold' : ''}>{player}</span>
                        <span className="text-[#6b6b80]">({champ})</span>
                        {isTop && <Trophy size={11} className="text-[#fbbf24]" />}
                      </span>
                      <span className="font-mono text-white font-bold">{dmg > 0 ? dmg.toLocaleString() : '-'}</span>
                    </div>
                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTop ? 'bg-gradient-to-r from-[#3b82f6] to-[#fbbf24]' : 'bg-[#3b82f6]'
                        }`}
                        style={{ width: `${Math.max(pct, dmg > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. 글로벌 골드 & 팀 종합 지표 */}
      {activeSubTab === 'gold' && (
        <div className="bg-[#11131c] border border-[#1e2333] rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* RED SUMMARY */}
            <div className="bg-[#1a0e14] border border-[#ef4444]/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 border-b border-[#ef4444]/20 pb-2">
                <span className="font-bold text-[#f87171] text-[13px]">🔴 RED 진영 종합</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isRedWinner ? 'bg-[#ef4444] text-white' : 'bg-black/40 text-[#8e8ea0]'}`}>
                  {isRedWinner ? '승리 (WIN)' : '패배 (LOSS)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                  <div className="text-[10px] text-[#8e8ea0]">총 킬수</div>
                  <div className="text-[18px] font-black text-white">{detailA?.team_kda || redKills || '-'}</div>
                </div>
                <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                  <div className="text-[10px] text-[#8e8ea0]">글로벌 골드</div>
                  <div className="text-[18px] font-black text-[#fbbf24]">{redGlobalGold}</div>
                </div>
              </div>
            </div>

            {/* BLUE SUMMARY */}
            <div className="bg-[#0e1626] border border-[#3b82f6]/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 border-b border-[#3b82f6]/20 pb-2">
                <span className="font-bold text-[#60a5fa] text-[13px]">🔵 BLUE 진영 종합</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isBlueWinner ? 'bg-[#2563eb] text-white' : 'bg-black/40 text-[#8e8ea0]'}`}>
                  {isBlueWinner ? '승리 (WIN)' : '패배 (LOSS)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                  <div className="text-[10px] text-[#8e8ea0]">총 킬수</div>
                  <div className="text-[18px] font-black text-white">{detailB?.team_kda || blueKills || '-'}</div>
                </div>
                <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                  <div className="text-[10px] text-[#8e8ea0]">글로벌 골드</div>
                  <div className="text-[18px] font-black text-[#fbbf24]">{blueGlobalGold}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. 밴 카드 정보 */}
      {activeSubTab === 'bans' && (
        <div className="bg-[#11131c] border border-[#1e2333] rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Red Bans */}
            <div className="bg-[#180e14] border border-[#ef4444]/20 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-[#f87171] mb-2.5 flex items-center justify-between">
                <span>🔴 RED 밴 (5 챔피언)</span>
                <span className="text-[10px] text-[#8e8ea0]">{match.ban_a.filter(Boolean).length}/5</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {match.ban_a.filter(Boolean).length > 0 ? (
                  match.ban_a.filter(Boolean).map((ban, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 bg-black/50 border border-[#ef4444]/30 px-2.5 py-1 rounded-lg text-[11px] text-[#e2d5d8]"
                      title={`RED 금지: ${ban}`}
                    >
                      <ChampionIcon name={ban} size={20} shape="square" className="rounded grayscale" />
                      <span className="font-semibold">{ban}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-[#6b6b80] py-2">등록된 밴 정보가 없습니다.</span>
                )}
              </div>
            </div>

            {/* Blue Bans */}
            <div className="bg-[#0e1625] border border-[#3b82f6]/20 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-[#60a5fa] mb-2.5 flex items-center justify-between">
                <span>🔵 BLUE 밴 (5 챔피언)</span>
                <span className="text-[10px] text-[#8e8ea0]">{match.ban_b.filter(Boolean).length}/5</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {match.ban_b.filter(Boolean).length > 0 ? (
                  match.ban_b.filter(Boolean).map((ban, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 bg-black/50 border border-[#3b82f6]/30 px-2.5 py-1 rounded-lg text-[11px] text-[#d0d8e8]"
                      title={`BLUE 금지: ${ban}`}
                    >
                      <ChampionIcon name={ban} size={20} shape="square" className="rounded grayscale" />
                      <span className="font-semibold">{ban}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-[#6b6b80] py-2">등록된 밴 정보가 없습니다.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
