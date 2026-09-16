import React, { useState, useMemo } from 'react';
import { Match, LineKey, LINE_KEYS } from '../types';
import { isWooriming, getWoorimingTeam } from '../lib/stats';
import { isAllyWonMatch, sortMatchesDescending } from '../lib/seriesScores';
import { Flame, Coins, Shield, Zap, Sparkles, TrendingUp, Award, Clock, ArrowRight } from 'lucide-react';
import {
  resolveRunePair,
  getSpellIcon,
  getItemIcon,
  NON_CORE_ITEMS,
} from '../lib/lolIcons';

interface WoorimingPerformanceDashboardProps {
  matches: Match[];
  onJumpToMatch?: (matchId: string) => void;
}

interface WoorimingGameRecord {
  id: string;
  date: string;
  ck_name: string;
  set_number: number;
  score: string;
  won: boolean;
  side: 'Red' | 'Blue';
  line: LineKey;
  champion: string;
  kda: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number; // 0 if not extracted
  gpm: number; // 0 if not extracted
  duration: string;
  runes: string[]; // empty [] if not extracted
  spells: string[]; // empty [] if not extracted
  items: string[]; // empty [] if not extracted
  isAiExtracted: boolean;
  teamDamageShare: number; // 0 if not extracted
}

export const WoorimingPerformanceDashboard: React.FC<WoorimingPerformanceDashboardProps> = ({
  matches,
  onJumpToMatch,
}) => {
  const [activeTab, setActiveTab] = useState<'damage' | 'gpm' | 'builds'>('damage');
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);

  // Extract all matches where 우리밍_ participated and compile her detailed metrics
  const records = useMemo<WoorimingGameRecord[]>(() => {
    const wMatches = matches.filter((m) => {
      const inA = Object.values(m.team_a || {}).some(isWooriming);
      const inB = Object.values(m.team_b || {}).some(isWooriming);
      return inA || inB;
    });

    const sorted = sortMatchesDescending(wMatches);

    return sorted.map((m) => {
      const wTeam = getWoorimingTeam(m);
      const won = isAllyWonMatch(m);
      const isRed = wTeam === 'Red';
      const roster = isRed ? m.team_a : m.team_b;
      const champs = isRed ? m.team_a_champs : m.team_b_champs;
      const kdas = isRed ? m.team_a_kda : m.team_b_kda;
      const detail = isRed ? m.team_a_detail : m.team_b_detail;

      let wLine: LineKey = 'adc';
      for (const k of LINE_KEYS) {
        if (isWooriming(roster?.[k])) {
          wLine = k;
          break;
        }
      }

      const champ = champs?.[wLine] || '원거리 딜러';
      const kdaStr = kdas?.[wLine] || '0/0/0';
      const kdaParts = kdaStr.split('/').map((n) => parseInt(n.trim(), 10) || 0);
      const kills = kdaParts[0] || 0;
      const deaths = kdaParts[1] || 0;
      const assists = kdaParts[2] || 0;

      const playerDetail = detail?.players?.[wLine];
      const hasAiMetrics = !!playerDetail && (
        (playerDetail.damage_dealt && playerDetail.damage_dealt > 0) ||
        (playerDetail.gold_per_minute && playerDetail.gold_per_minute > 0) ||
        (playerDetail.items && playerDetail.items.length > 0) ||
        (playerDetail.runes && playerDetail.runes.length > 0) ||
        (playerDetail.spells && playerDetail.spells.length > 0)
      );
      const isAiExtracted = hasAiMetrics;

      // Extract duration or default if available in match
      const duration = m.game_duration || '-';

      // Damage: ONLY use real AI-extracted damage if available; otherwise 0 (no dummy damage)
      const damage = isAiExtracted && playerDetail?.damage_dealt ? playerDetail.damage_dealt : 0;

      // GPM: ONLY use real AI-extracted GPM if available; otherwise 0 (no dummy GPM)
      const gpm = isAiExtracted && playerDetail?.gold_per_minute ? playerDetail.gold_per_minute : 0;

      // Runes: ONLY use real AI-extracted runes; never force dummy defaults
      const runes = isAiExtracted && playerDetail?.runes && playerDetail.runes.length > 0
        ? playerDetail.runes
        : [];

      // Spells: ONLY use real AI-extracted spells; never force dummy defaults
      const spells = isAiExtracted && playerDetail?.spells && playerDetail.spells.length > 0
        ? playerDetail.spells
        : [];

      // Items: ONLY use real AI-extracted items; never force dummy defaults
      const items = isAiExtracted && playerDetail?.items && playerDetail.items.length > 0
        ? playerDetail.items
        : [];

      // Team damage share calculation: ONLY when damage is extracted and team total > 0
      let teamDamageShare = 0;
      if (isAiExtracted && damage > 0 && detail?.players) {
        let totalTeamDmg = 0;
        for (const lk of LINE_KEYS) {
          totalTeamDmg += detail.players[lk]?.damage_dealt || 0;
        }
        if (totalTeamDmg > 0) {
          teamDamageShare = Math.round((damage / totalTeamDmg) * 1000) / 10;
        }
      }

      return {
        id: m.id,
        date: m.date,
        ck_name: m.ck_name,
        set_number: m.set_number || 1,
        score: m.score,
        won,
        side: wTeam || 'Red',
        line: wLine,
        champion: champ,
        kda: kdaStr,
        kills,
        deaths,
        assists,
        damage,
        gpm,
        duration,
        runes,
        spells,
        items,
        isAiExtracted,
        teamDamageShare,
      };
    });
  }, [matches]);

  // Aggregate stats strictly based on CK Journal matches
  const aggregates = useMemo(() => {
    if (records.length === 0) {
      return {
        avgDamage: 0,
        maxDamage: 0,
        avgGpm: 0,
        maxGpm: 0,
        avgDurationMinutes: 0,
        aiExtractedCount: 0,
        topRunePairs: [],
        topSpellSets: [],
        topCoreBuilds: [],
      };
    }

    let sumDamage = 0;
    let maxDamage = 0;
    let sumGpm = 0;
    let maxGpm = 0;
    let aiExtractedCount = 0;

    // 1. Rune Pair (KeyStone + Secondary) Counter
    const runePairCounts: Record<
      string,
      {
        count: number;
        wins: number;
        primaryName: string;
        subName: string;
        primaryIcon: string;
        subIcon: string;
      }
    > = {};

    // 2. Spell Set ([Spell 1] + [Spell 2]) Counter
    const spellSetCounts: Record<
      string,
      {
        count: number;
        wins: number;
        spell1: string;
        spell2: string;
        icon1: string;
        icon2: string;
      }
    > = {};

    // 3. 3-Core Build Counter ([1-Core] -> [2-Core] -> [3-Core])
    const buildCounts: Record<
      string,
      {
        count: number;
        wins: number;
        items: string[];
        icons: string[];
      }
    > = {};

    for (const r of records) {
      sumDamage += r.damage;
      if (r.damage > maxDamage) maxDamage = r.damage;
      sumGpm += r.gpm;
      if (r.gpm > maxGpm) maxGpm = r.gpm;
      if (r.isAiExtracted) aiExtractedCount++;

      // --- Process Rune Pair ---
      if (r.runes && r.runes.length > 0) {
        const pair = resolveRunePair(r.runes);
        const pairKey = `${pair.primaryName}__${pair.subName}`;
        if (!runePairCounts[pairKey]) {
          runePairCounts[pairKey] = {
            count: 0,
            wins: 0,
            primaryName: pair.primaryName,
            subName: pair.subName,
            primaryIcon: pair.primaryIcon,
            subIcon: pair.subIcon,
          };
        }
        runePairCounts[pairKey].count++;
        if (r.won) runePairCounts[pairKey].wins++;
      }

      // --- Process Spells ([Spell 1] + [Spell 2] Set) ---
      if (r.spells && r.spells.length >= 2) {
        const s1 = r.spells[0]?.trim() || '점멸';
        const s2 = r.spells[1]?.trim() || '정화';
        const sortedSpells = s2 === '점멸' ? [s2, s1] : [s1, s2];
        const spellKey = sortedSpells.join('__');
        if (!spellSetCounts[spellKey]) {
          spellSetCounts[spellKey] = {
            count: 0,
            wins: 0,
            spell1: sortedSpells[0],
            spell2: sortedSpells[1],
            icon1: getSpellIcon(sortedSpells[0]),
            icon2: getSpellIcon(sortedSpells[1]),
          };
        }
        spellSetCounts[spellKey].count++;
        if (r.won) spellSetCounts[spellKey].wins++;
      }

      // --- Process 3-Core Item Builds: Only count games that actually have core items from AI extraction ---
      const coreItems = r.items.filter((it) => {
        const clean = it.trim();
        if (!clean) return false;
        if (NON_CORE_ITEMS.has(clean)) return false;
        if (clean.includes('군화') || clean.includes('장화') || clean.includes('신발')) return false;
        return true;
      });

      if (coreItems.length >= 3) {
        const build3 = coreItems.slice(0, 3);
        const buildKey = build3.join(' -> ');
        if (!buildCounts[buildKey]) {
          buildCounts[buildKey] = {
            count: 0,
            wins: 0,
            items: build3,
            icons: build3.map((it) => getItemIcon(it)),
          };
        }
        buildCounts[buildKey].count++;
        if (r.won) buildCounts[buildKey].wins++;
      } else if (coreItems.length > 0 && r.isAiExtracted) {
        // If 1 or 2 core items extracted, preserve them without inventing dummy fake items
        const buildKey = coreItems.join(' -> ');
        if (!buildCounts[buildKey]) {
          buildCounts[buildKey] = {
            count: 0,
            wins: 0,
            items: coreItems,
            icons: coreItems.map((it) => getItemIcon(it)),
          };
        }
        buildCounts[buildKey].count++;
        if (r.won) buildCounts[buildKey].wins++;
      }
    }

    const totalExtractedWithRunes = Object.values(runePairCounts).reduce((acc, c) => acc + c.count, 0) || 1;
    const totalExtractedWithSpells = Object.values(spellSetCounts).reduce((acc, c) => acc + c.count, 0) || 1;
    const totalExtractedWithBuilds = Object.values(buildCounts).reduce((acc, c) => acc + c.count, 0) || 1;

    const topRunePairs = Object.values(runePairCounts)
      .map((item) => ({
        ...item,
        winRate: Math.round((item.wins / item.count) * 100),
        pickRate: Math.round((item.count / totalExtractedWithRunes) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const topSpellSets = Object.values(spellSetCounts)
      .map((item) => ({
        ...item,
        winRate: Math.round((item.wins / item.count) * 100),
        pickRate: Math.round((item.count / totalExtractedWithSpells) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const topCoreBuilds = Object.values(buildCounts)
      .map((item) => ({
        ...item,
        winRate: Math.round((item.wins / item.count) * 100),
        pickRate: Math.round((item.count / totalExtractedWithBuilds) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const extractedDmgCount = records.filter((r) => r.isAiExtracted && r.damage > 0).length;
    const extractedGpmCount = records.filter((r) => r.isAiExtracted && r.gpm > 0).length;

    return {
      avgDamage: extractedDmgCount > 0 ? Math.round(sumDamage / extractedDmgCount) : 0,
      maxDamage,
      avgGpm: extractedGpmCount > 0 ? Math.round(sumGpm / extractedGpmCount) : 0,
      maxGpm,
      aiExtractedCount,
      topRunePairs,
      topSpellSets,
      topCoreBuilds,
    };
  }, [records]);

  // Max scale for damage and gpm charts
  const maxDmgScale = Math.max(40000, aggregates.maxDamage * 1.15 || 40000);
  const maxGpmScale = Math.max(700, aggregates.maxGpm * 1.15 || 700);

  return (
    <div className="mt-8 bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#8b5cf6]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-[#1e1e2a]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#8b5cf6]/20 text-[#a78bfa]">
              <Sparkles size={16} />
            </span>
            <h3 className="text-[17px] font-bold text-white tracking-tight">
              우리밍_ 인게임 정밀 통계 & 그래프
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 text-[#c4b5fd] font-semibold">
              AI 비전 연동
            </span>
          </div>
          <p className="text-[12px] text-[#8a8aa0]">
            게임 결과 스크린샷에서 AI 비전 로직으로 자동 추출된 딜량, 분당골드, 룬/스펠/아이템 원본 데이터입니다.
          </p>
        </div>

        {/* View switcher tabs */}
        <div className="flex items-center bg-[#08080c] p-1 rounded-xl border border-[#1e1e2a]">
          <button
            type="button"
            onClick={() => setActiveTab('damage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              activeTab === 'damage'
                ? 'bg-[#ef4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.35)]'
                : 'text-[#8a8aa0] hover:text-white'
            }`}
          >
            <Flame size={13} />
            <span>딜량 추이</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gpm')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              activeTab === 'gpm'
                ? 'bg-[#fbbf24] text-black shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                : 'text-[#8a8aa0] hover:text-white'
            }`}
          >
            <Coins size={13} />
            <span>분당골드 추이</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builds')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              activeTab === 'builds'
                ? 'bg-[#8b5cf6] text-white shadow-[0_0_12px_rgba(139,92,246,0.35)]'
                : 'text-[#8a8aa0] hover:text-white'
            }`}
          >
            <Shield size={13} />
            <span>특성 / 스펠 / 아이템</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col justify-between">
          <div className="text-[11px] text-[#8a8aa0] flex items-center justify-between mb-1">
            <span>평균 딜량 (Avg Damage)</span>
            <Flame size={14} className="text-[#ef4444]" />
          </div>
          <div className="text-[20px] font-black text-white">
            {aggregates.avgDamage.toLocaleString()}
            <span className="text-[12px] font-normal text-[#8a8aa0] ml-1">dmg</span>
          </div>
          <div className="text-[10px] text-[#a78bfa] mt-1 font-medium">
            최고: {aggregates.maxDamage.toLocaleString()}
          </div>
        </div>

        <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col justify-between">
          <div className="text-[11px] text-[#8a8aa0] flex items-center justify-between mb-1">
            <span>평균 분당골드 (Avg GPM)</span>
            <Coins size={14} className="text-[#fbbf24]" />
          </div>
          <div className="text-[20px] font-black text-white">
            {aggregates.avgGpm}
            <span className="text-[12px] font-normal text-[#8a8aa0] ml-1">g/m</span>
          </div>
          <div className="text-[10px] text-[#fbbf24] mt-1 font-medium">
            최고: {aggregates.maxGpm} g/m
          </div>
        </div>

        <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col justify-between">
          <div className="text-[11px] text-[#8a8aa0] flex items-center justify-between mb-1">
            <span>평균 팀 딜 비중</span>
            <Award size={14} className="text-[#3b82f6]" />
          </div>
          <div className="text-[20px] font-black text-white">
            {records.filter((r) => r.isAiExtracted && r.teamDamageShare > 0).length > 0
              ? (
                  records
                    .filter((r) => r.isAiExtracted && r.teamDamageShare > 0)
                    .reduce((acc, r) => acc + r.teamDamageShare, 0) /
                  records.filter((r) => r.isAiExtracted && r.teamDamageShare > 0).length
                ).toFixed(1)
              : '-'}
            {records.some((r) => r.isAiExtracted && r.teamDamageShare > 0) && (
              <span className="text-[12px] font-normal text-[#8a8aa0] ml-1">%</span>
            )}
          </div>
          <div className="text-[10px] text-[#60a5fa] mt-1 font-medium">
            {records.some((r) => r.isAiExtracted && r.teamDamageShare > 0)
              ? '실제 스크린샷 딜 비중 집계'
              : '스크린샷 첨부 시 계산'}
          </div>
        </div>

        <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col justify-between">
          <div className="text-[11px] text-[#8a8aa0] flex items-center justify-between mb-1">
            <span>스크린샷 분석 완료</span>
            <Zap size={14} className="text-[#10b981]" />
          </div>
          <div className="text-[20px] font-black text-[#10b981]">
            {aggregates.aiExtractedCount}
            <span className="text-[12px] font-normal text-[#8a8aa0] ml-1">/ {records.length}경기</span>
          </div>
          <div className="text-[10px] text-[#10b981] mt-1 font-medium">
            {aggregates.aiExtractedCount > 0 ? '정밀 실적 1:1 동기화됨' : '스크린샷 데이터 대기'}
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {records.length === 0 ? (
        <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#8b5cf6]/10 text-[#a78bfa] flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={24} />
          </div>
          <h4 className="text-[14px] font-bold text-white mb-1">아직 등록된 경기 데이터가 없습니다</h4>
          <p className="text-[12px] text-[#8a8aa0] max-w-[400px] mx-auto">
            [CK 일지] 탭에서 '경기 추가' 버튼을 누르고 게임 결과 스크린샷을 첨부하면 우리밍_ 전용 딜량 및 분당골드 그래프가 자동으로 생성됩니다.
          </p>
        </div>
      ) : activeTab === 'damage' ? (
        /* Damage Trend Chart */
        <div className="space-y-4">
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[18px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-white">경기별 총 딜량(피해량) 추이</span>
                <span className="text-[11px] text-[#8a8aa0] font-normal">
                  (막대 높이 = 챔피언 총 딜량, 색상 = 승/패)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5 text-[#60a5fa]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
                  <span>승리</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#f87171]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
                  <span>패배</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a78bfa]">
                  <span className="w-3 h-0.5 bg-[#8b5cf6] border-b border-dashed" />
                  <span>평균 딜량선 ({aggregates.avgDamage.toLocaleString()})</span>
                </div>
              </div>
            </div>

            {/* SVG Chart Container */}
            <div className="relative h-[220px] w-full pt-4 pb-8 flex items-end justify-between gap-2 px-2 border-b border-[#1e1e2a]">
              {/* Benchmark dashed line for average damage */}
              {aggregates.avgDamage > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-[#8b5cf6]/60 pointer-events-none z-10 flex justify-end pr-2"
                  style={{
                    bottom: `${Math.min(92, Math.max(8, (aggregates.avgDamage / maxDmgScale) * 100))}%`,
                  }}
                >
                  <span className="text-[9px] bg-[#1e1e2a] text-[#c4b5fd] px-1.5 py-0.5 rounded -mt-2.5 font-bold">
                    평균 {aggregates.avgDamage.toLocaleString()}
                  </span>
                </div>
              )}

              {records.slice(0, 15).reverse().map((rec, idx) => {
                const heightPercent = Math.min(100, Math.max(12, (rec.damage / maxDmgScale) * 100));
                const isHovered = hoveredGameId === rec.id;

                return (
                  <div
                    key={rec.id}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                    onMouseEnter={() => setHoveredGameId(rec.id)}
                    onMouseLeave={() => setHoveredGameId(null)}
                    onClick={() => onJumpToMatch && onJumpToMatch(rec.id)}
                  >
                    {/* Hover Card */}
                    {isHovered && (
                      <div className="absolute bottom-[calc(100%+8px)] z-30 bg-[#1e1e2a] border border-[#3b3b4f] text-white p-3 rounded-xl shadow-2xl text-[11px] min-w-[190px] pointer-events-none">
                        <div className="font-bold flex items-center justify-between mb-1.5">
                          <span>{rec.champion}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              rec.won ? 'bg-[#3b82f6] text-white' : 'bg-[#ef4444] text-white'
                            }`}
                          >
                            {rec.won ? '승리' : '패배'}
                          </span>
                        </div>
                        <div className="space-y-1 text-[#c0c0d0]">
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">딜량:</span>
                            <span className="font-bold text-[#fca5a5]">
                              {rec.isAiExtracted && rec.damage > 0 ? `${rec.damage.toLocaleString()} dmg` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">팀 딜 비중:</span>
                            <span className="font-bold text-white">
                              {rec.isAiExtracted && rec.teamDamageShare > 0 ? `${rec.teamDamageShare}%` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">KDA:</span>
                            <span className="font-mono text-white">{rec.kda}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">경기시간:</span>
                            <span className="text-white">{rec.duration}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-[#8a8aa0] pt-1 border-t border-[#2a2a3a]">
                            <span>{rec.date}</span>
                            <span>{rec.set_number}세트</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Value on top of bar on hover or top peaks */}
                    <div
                      className={`text-[9px] font-bold mb-1 transition-opacity ${
                        isHovered ? 'opacity-100 text-white' : 'opacity-0 text-[#8a8aa0]'
                      }`}
                    >
                      {rec.isAiExtracted && rec.damage > 0 ? `${(rec.damage / 1000).toFixed(1)}k` : '-'}
                    </div>

                    {/* Bar */}
                    <div
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                        !rec.isAiExtracted || rec.damage === 0
                          ? 'bg-[#2a2a3a] border border-dashed border-[#4a4a60]'
                          : rec.won
                          ? 'bg-gradient-to-t from-[#1d4ed8] to-[#60a5fa] group-hover:brightness-125'
                          : 'bg-gradient-to-t from-[#b91c1c] to-[#f87171] group-hover:brightness-125'
                      } ${isHovered ? 'ring-2 ring-white scale-y-105' : ''}`}
                      style={{ height: `${rec.isAiExtracted && rec.damage > 0 ? heightPercent : 6}%` }}
                    />

                    {/* Bottom Label (Champion & Match) */}
                    <div className="absolute -bottom-6 w-full text-center text-[9px] text-[#8a8aa0] truncate font-medium">
                      {rec.champion.slice(0, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'gpm' ? (
        /* Gold Per Minute Trend Chart */
        <div className="space-y-4">
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[18px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-white">경기별 분당골드 (GPM) 수급 추이</span>
                <span className="text-[11px] text-[#8a8aa0] font-normal">
                  (골드 획득 속도 & 파밍 지배력)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5 text-[#fbbf24]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#fbbf24]" />
                  <span>분당골드 (GPM)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#a78bfa]">
                  <span className="w-3 h-0.5 bg-[#fbbf24] border-b border-dashed" />
                  <span>평균 GPM ({aggregates.avgGpm} g/m)</span>
                </div>
              </div>
            </div>

            {/* SVG Chart Container */}
            <div className="relative h-[220px] w-full pt-4 pb-8 flex items-end justify-between gap-2 px-2 border-b border-[#1e1e2a]">
              {aggregates.avgGpm > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-[#fbbf24]/60 pointer-events-none z-10 flex justify-end pr-2"
                  style={{
                    bottom: `${Math.min(92, Math.max(8, (aggregates.avgGpm / maxGpmScale) * 100))}%`,
                  }}
                >
                  <span className="text-[9px] bg-[#1e1e2a] text-[#fbbf24] px-1.5 py-0.5 rounded -mt-2.5 font-bold">
                    평균 {aggregates.avgGpm} g/m
                  </span>
                </div>
              )}

              {records.slice(0, 15).reverse().map((rec) => {
                const heightPercent = Math.min(100, Math.max(12, (rec.gpm / maxGpmScale) * 100));
                const isHovered = hoveredGameId === rec.id;

                return (
                  <div
                    key={rec.id}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                    onMouseEnter={() => setHoveredGameId(rec.id)}
                    onMouseLeave={() => setHoveredGameId(null)}
                    onClick={() => onJumpToMatch && onJumpToMatch(rec.id)}
                  >
                    {isHovered && (
                      <div className="absolute bottom-[calc(100%+8px)] z-30 bg-[#1e1e2a] border border-[#3b3b4f] text-white p-3 rounded-xl shadow-2xl text-[11px] min-w-[180px] pointer-events-none">
                        <div className="font-bold flex items-center justify-between mb-1.5">
                          <span>{rec.champion}</span>
                          <span className="text-[#fbbf24] font-black">
                            {rec.isAiExtracted && rec.gpm > 0 ? `${rec.gpm} GPM` : '-'}
                          </span>
                        </div>
                        <div className="space-y-1 text-[#c0c0d0]">
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">경기시간:</span>
                            <span className="text-white">{rec.duration}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">딜량:</span>
                            <span className="text-white">
                              {rec.isAiExtracted && rec.damage > 0 ? `${rec.damage.toLocaleString()} dmg` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8a8aa0]">KDA:</span>
                            <span className="font-mono text-white">{rec.kda}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className={`text-[9px] font-bold mb-1 transition-opacity ${
                        isHovered ? 'opacity-100 text-[#fbbf24]' : 'opacity-0 text-[#8a8aa0]'
                      }`}
                    >
                      {rec.isAiExtracted && rec.gpm > 0 ? rec.gpm : '-'}
                    </div>

                    <div
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                        !rec.isAiExtracted || rec.gpm === 0
                          ? 'bg-[#2a2a3a] border border-dashed border-[#4a4a60]'
                          : 'bg-gradient-to-t from-[#b45309] to-[#fbbf24] group-hover:brightness-125'
                      } ${isHovered ? 'ring-2 ring-white scale-y-105' : ''}`}
                      style={{ height: `${rec.isAiExtracted && rec.gpm > 0 ? heightPercent : 6}%` }}
                    />

                    <div className="absolute -bottom-6 w-full text-center text-[9px] text-[#8a8aa0] truncate font-medium">
                      {rec.champion.slice(0, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Builds Tab: 100% LoL Official Icon Visualization based strictly on CK Journal matches */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Trait (Runes) Area: [Primary Rune Icon + Secondary Rune Icon] Card Sets */}
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[18px] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1e1e2a]">
                <div className="flex items-center gap-1.5">
                  <Shield size={15} className="text-[#8b5cf6]" />
                  <span className="text-[12px] font-bold text-white">특성 (룬 세트 조합)</span>
                </div>
                <span className="text-[10px] text-[#c4b5fd] font-bold bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 px-2 py-0.5 rounded-full">
                  [주요룬 + 보조룬] TOP
                </span>
              </div>

              <div className="space-y-2.5">
                {aggregates.topRunePairs.map((pair, idx) => (
                  <div
                    key={`${pair.primaryName}-${pair.subName}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#12121a] border border-[#1e1e2a] hover:border-[#8b5cf6]/40 transition flex items-center justify-between"
                  >
                    {/* Official Rune Icons (Pair: KeyStone + Secondary) */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center">
                        {/* Primary Rune Icon (Large, Keystone) */}
                        <div
                          className="w-10 h-10 rounded-full bg-black/70 border-2 border-[#8b5cf6]/70 p-0.5 shadow-md flex items-center justify-center overflow-hidden"
                          title={`주요 룬: ${pair.primaryName}`}
                        >
                          <img
                            src={pair.primaryIcon}
                            alt={pair.primaryName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain filter drop-shadow hover:scale-110 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png';
                            }}
                          />
                        </div>

                        {/* Secondary Rune Icon (Small, Overlapping bottom-right) */}
                        <div
                          className="w-6 h-6 rounded-full bg-[#181824] border border-[#a78bfa] p-0.5 -ml-2.5 -mb-3 shadow-lg flex items-center justify-center overflow-hidden z-10"
                          title={`보조 룬: ${pair.subName}`}
                        >
                          <img
                            src={pair.subIcon}
                            alt={pair.subName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png';
                            }}
                          />
                        </div>
                      </div>

                      {/* Tooltip detail and pick rank badge */}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#c4b5fd]">
                          TOP {idx + 1}
                        </span>
                        <span className="text-[9px] text-[#8a8aa0] font-mono">
                          {pair.count}회 픽 ({pair.pickRate}%)
                        </span>
                      </div>
                    </div>

                    {/* Winrate Stats */}
                    <div className="text-right">
                      <div className="text-[12px] font-black text-white">{pair.winRate}%</div>
                      <div className="text-[9px] text-[#60a5fa] font-bold">
                        {pair.wins}승 {pair.count - pair.wins}패
                      </div>
                    </div>
                  </div>
                ))}

                {aggregates.topRunePairs.length === 0 && (
                  <div className="text-[11px] text-[#8a8aa0] text-center py-6">
                    CK 일지에 기록된 룬 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="text-[9px] text-[#6a6a80] mt-3 pt-2 border-t border-[#1e1e2a]/50 text-center">
              주요 룬 및 보조 룬 세트 공식 아이콘
            </div>
          </div>

          {/* 2. Summoner Spells Area: [Spell 1][Spell 2] Side-by-Side Sets */}
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[18px] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1e1e2a]">
                <div className="flex items-center gap-1.5">
                  <Zap size={15} className="text-[#38bdf8]" />
                  <span className="text-[12px] font-bold text-white">소환사 주문 (스펠 세트)</span>
                </div>
                <span className="text-[10px] text-[#7dd3fc] font-bold bg-[#0284c7]/15 border border-[#0284c7]/30 px-2 py-0.5 rounded-full">
                  [스펠1 + 스펠2] 듀오
                </span>
              </div>

              <div className="space-y-2.5">
                {aggregates.topSpellSets.map((spSet, idx) => (
                  <div
                    key={`${spSet.spell1}-${spSet.spell2}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#12121a] border border-[#1e1e2a] hover:border-[#38bdf8]/40 transition flex items-center justify-between"
                  >
                    {/* Side-by-side Official Spell Icons */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center -space-x-1.5">
                        {/* Spell 1 Icon */}
                        <div
                          className="w-9 h-9 rounded-lg bg-black/60 border border-[#38bdf8]/80 p-0.5 shadow-md overflow-hidden relative z-10 group"
                          title={spSet.spell1}
                        >
                          <img
                            src={spSet.icon1}
                            alt={spSet.spell1}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover rounded"
                          />
                        </div>

                        {/* Spell 2 Icon */}
                        <div
                          className="w-9 h-9 rounded-lg bg-black/60 border border-[#38bdf8]/80 p-0.5 shadow-md overflow-hidden relative z-20 group"
                          title={spSet.spell2}
                        >
                          <img
                            src={spSet.icon2}
                            alt={spSet.spell2}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#7dd3fc]">
                          TOP {idx + 1} 세트
                        </span>
                        <span className="text-[9px] text-[#8a8aa0] font-mono">
                          {spSet.count}회 기용 ({spSet.pickRate}%)
                        </span>
                      </div>
                    </div>

                    {/* Winrate Stats */}
                    <div className="text-right">
                      <div className="text-[12px] font-black text-white">{spSet.winRate}%</div>
                      <div className="text-[9px] text-[#38bdf8] font-bold">
                        {spSet.wins}승 {spSet.count - spSet.wins}패
                      </div>
                    </div>
                  </div>
                ))}

                {aggregates.topSpellSets.length === 0 && (
                  <div className="text-[11px] text-[#8a8aa0] text-center py-6">
                    CK 일지에 기록된 스펠 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="text-[9px] text-[#6a6a80] mt-3 pt-2 border-t border-[#1e1e2a]/50 text-center">
              소환사 주문 나란히 붙은 2종 공식 세트
            </div>
          </div>

          {/* 3. Core Items Area: [1-Core] ➔ [2-Core] ➔ [3-Core] Build Triplets TOP 3 */}
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[18px] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1e1e2a]">
                <div className="flex items-center gap-1.5">
                  <Award size={15} className="text-[#fbbf24]" />
                  <span className="text-[12px] font-bold text-white">3코어 완성 템트리 빌드</span>
                </div>
                <span className="text-[10px] text-[#fde68a] font-bold bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2 py-0.5 rounded-full">
                  TOP 3 빌드
                </span>
              </div>

              <div className="space-y-2.5">
                {aggregates.topCoreBuilds.map((build, idx) => (
                  <div
                    key={`${build.items.join('-')}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#12121a] border border-[#1e1e2a] hover:border-[#fbbf24]/40 transition flex items-center justify-between"
                  >
                    {/* [1 Core] ➔ [2 Core] ➔ [3 Core] Chain Icons */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-[#2a2a3a]">
                        {build.items.map((it, itemIdx) => (
                          <React.Fragment key={itemIdx}>
                            <div
                              className="w-8 h-8 rounded border border-[#fbbf24]/60 bg-black/50 overflow-hidden relative"
                              title={`${itemIdx + 1}코어: ${it}`}
                            >
                              <img
                                src={build.icons[itemIdx] || getItemIcon(it)}
                                alt={it}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 right-0 bg-black/80 text-[#fbbf24] text-[8px] font-black px-0.5 leading-none">
                                {itemIdx + 1}
                              </span>
                            </div>
                            {itemIdx < build.items.length - 1 && (
                              <ArrowRight size={10} className="text-[#8a8aa0] shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#fbbf24]">
                          {idx === 0 ? '👑 1위 빌드' : `${idx + 1}위 빌드`}
                        </span>
                        <span className="text-[9px] text-[#8a8aa0] font-mono">
                          {build.count}회 완성
                        </span>
                      </div>
                    </div>

                    {/* Winrate Stats */}
                    <div className="text-right">
                      <div className="text-[12px] font-black text-white">{build.winRate}%</div>
                      <div className="text-[9px] text-[#fbbf24] font-bold">
                        {build.wins}승 {build.count - build.wins}패
                      </div>
                    </div>
                  </div>
                ))}

                {aggregates.topCoreBuilds.length === 0 && (
                  <div className="text-[11px] text-[#8a8aa0] text-center py-6">
                    CK 일지에 기록된 코어 아이템 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="text-[9px] text-[#6a6a80] mt-3 pt-2 border-t border-[#1e1e2a]/50 text-center">
              1코어 ➔ 2코어 ➔ 3코어 전설급 완성 템트리 빌드
            </div>
          </div>
        </div>
      )}

      {/* Scannable Recent Game Performance Table */}
      {records.length > 0 && (
        <div className="mt-6 pt-5 border-t border-[#1e1e2a]">
          <div className="text-[12px] font-bold text-white mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-[#8a8aa0]" />
              <span>최근 경기별 우리밍_ 퍼포먼스 내역</span>
            </span>
            <span className="text-[11px] text-[#8a8aa0]">총 {records.length}경기 집계</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-[#c0c0d0]">
              <thead>
                <tr className="border-b border-[#1e1e2a] text-[#8a8aa0] text-[10px]">
                  <th className="py-2 px-3">경기 / 세트</th>
                  <th className="py-2 px-3">결과</th>
                  <th className="py-2 px-3">챔피언 / KDA</th>
                  <th className="py-2 px-3">경기시간</th>
                  <th className="py-2 px-3">딜량 (팀 비중)</th>
                  <th className="py-2 px-3">분당골드</th>
                  <th className="py-2 px-3">특성 / 스펠 / 3코어 빌드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2a]/60">
                {records.slice(0, 5).map((r) => {
                  const runePair = resolveRunePair(r.runes);
                  const s1 = r.spells[0]?.trim() || '점멸';
                  const s2 = r.spells[1]?.trim() || '정화';
                  const coreItems = r.items
                    .filter(
                      (it) =>
                        !NON_CORE_ITEMS.has(it.trim()) &&
                        !it.includes('신발') &&
                        !it.includes('군화') &&
                        !it.includes('장화')
                    )
                    .slice(0, 3);

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-[#181824] transition cursor-pointer"
                      onClick={() => onJumpToMatch && onJumpToMatch(r.id)}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-white">{r.ck_name}</div>
                        <div className="text-[10px] text-[#8a8aa0]">
                          {r.date} {r.set_number}세트
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-black text-[10px] ${
                            r.won ? 'bg-[#3b82f6]/20 text-[#60a5fa]' : 'bg-[#ef4444]/20 text-[#f87171]'
                          }`}
                        >
                          {r.won ? '승리' : '패배'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-white">{r.champion}</div>
                        <div className="font-mono text-[10px] text-[#a78bfa]">{r.kda}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#8a8aa0] font-mono">
                        {r.duration}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.isAiExtracted && r.damage > 0 ? (
                          <>
                            <div className="font-bold text-[#fca5a5]">
                              {r.damage.toLocaleString()} dmg
                            </div>
                            <div className="text-[10px] text-[#8a8aa0]">
                              {r.teamDamageShare > 0 ? `팀 딜 ${r.teamDamageShare}%` : '-'}
                            </div>
                          </>
                        ) : (
                          <div className="font-bold text-[#6a6a80]">-</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.isAiExtracted && r.gpm > 0 ? (
                          <>
                            <span className="font-bold text-[#fbbf24]">{r.gpm}</span>
                            <span className="text-[10px] text-[#8a8aa0] ml-0.5">g/m</span>
                          </>
                        ) : (
                          <span className="font-bold text-[#6a6a80]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.isAiExtracted && (r.runes.length > 0 || r.spells.length > 0 || r.items.length > 0) ? (
                          <div className="flex items-center gap-2 max-w-[280px]">
                            {/* Runes pair icon (only if runes exist) */}
                            {r.runes.length > 0 && (
                              <div
                                className="flex items-center -space-x-1"
                                title={`특성: ${runePair.primaryName} + ${runePair.subName}`}
                              >
                                <div className="w-5 h-5 rounded-full bg-black/70 border border-[#8b5cf6] p-0.5 overflow-hidden">
                                  <img
                                    src={runePair.primaryIcon}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <div className="w-4 h-4 rounded-full bg-[#181824] border border-[#a78bfa] p-0.5 overflow-hidden">
                                  <img
                                    src={runePair.subIcon}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Spells icons (only if spells exist) */}
                            {r.spells.length >= 2 && (
                              <div
                                className="flex items-center -space-x-0.5"
                                title={`스펠: ${s1} + ${s2}`}
                              >
                                <img
                                  src={getSpellIcon(s1)}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-4 h-4 rounded border border-[#38bdf8]/60 object-cover"
                                />
                                <img
                                  src={getSpellIcon(s2)}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-4 h-4 rounded border border-[#38bdf8]/60 object-cover"
                                />
                              </div>
                            )}

                            {/* Core items chain (only if items exist) */}
                            {coreItems.length > 0 && (
                              <div className="flex items-center gap-0.5">
                                {coreItems.map((ci, idx) => (
                                  <img
                                    key={idx}
                                    src={getItemIcon(ci)}
                                    alt={ci}
                                    title={`코어: ${ci}`}
                                    referrerPolicy="no-referrer"
                                    className="w-5 h-5 rounded border border-[#fbbf24]/60 object-cover bg-black/40"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[#6a6a80] font-mono text-[11px]">-</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
