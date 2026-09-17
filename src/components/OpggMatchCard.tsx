import React from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS } from '../types';
import { ChampionIcon } from './ChampionIcon';
import {
  isWooriming,
  getWoorimingTeam,
  getWoorimingLineKey,
  isMatchWonByWooriming,
  parseKda,
} from '../lib/stats';
import { getItemIcon, getSpellIcon, resolveRunePair, RUNE_STYLE_ICONS } from '../lib/lolIcons';
import { MatchDetailAccordion } from './MatchDetailAccordion';
import { ChevronDown, ChevronUp, Edit2, Trash2, Crown } from 'lucide-react';

interface OpggMatchCardProps {
  match: Match;
  scoreText: string;
  onEdit: (match: Match) => void;
  onDelete: (id: string) => void;
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const OpggMatchCard: React.FC<OpggMatchCardProps> = ({
  match,
  scoreText,
  onEdit,
  onDelete,
  onJumpToStreamer,
  isExpanded,
  onToggleExpand,
}) => {
  const won = isMatchWonByWooriming(match);
  const wTeam = getWoorimingTeam(match); // 'Red' | 'Blue'
  const isWRed = wTeam === 'Red';
  const wLineKey = getWoorimingLineKey(match);

  // Wooriming's champion, kda, detail
  const myRoster = isWRed ? match.team_a : match.team_b;
  const myChamps = isWRed ? match.team_a_champs : match.team_b_champs;
  const myKdas = isWRed ? match.team_a_kda : match.team_b_kda;
  const myDetail = isWRed ? match.team_a_detail : match.team_b_detail;

  const enemyRoster = isWRed ? match.team_b : match.team_a;
  const enemyChamps = isWRed ? match.team_b_champs : match.team_a_champs;

  const champ = myChamps?.[wLineKey] || '';
  const kdaStr = myKdas?.[wLineKey] || '0/0/0';
  const { k, d, a } = parseKda(kdaStr);
  const kdaRatio = d === 0 ? 'Perfect' : ((k + a) / Math.max(1, d)).toFixed(2);

  // Detail for Wooriming
  const pDetail = myDetail?.players?.[wLineKey];
  const spells = pDetail?.spells && pDetail.spells.length >= 2 ? pDetail.spells : ['점멸', '회복'];
  const rawRunes = pDetail?.runes && pDetail.runes.length > 0 ? pDetail.runes : [champ, '영감'];
  const runePair = resolveRunePair(rawRunes);
  const items = pDetail?.items || [];
  const damage = pDetail?.damage_dealt;
  const gpm = pDetail?.gold_per_minute;

  // Calculate team total kills for Kill Participation (KP%)
  let teamKills = 0;
  LINE_KEYS.forEach((lk) => {
    const pk = (myKdas?.[lk] || '').split('/');
    if (pk.length >= 1) teamKills += parseInt(pk[0], 10) || 0;
  });
  const kpPct = teamKills > 0 ? Math.min(100, Math.round(((k + a) / teamKills) * 100)) : 0;

  return (
    <div
      id={`match-${match.id}`}
      data-match-card="true"
      data-match-id={match.id}
      className={`rounded-[16px] border transition-all duration-200 overflow-hidden relative ${
        won
          ? 'bg-[#101826] border-[#1e3455] hover:border-[#3b82f6]/50 shadow-lg shadow-[#0f1b30]/30'
          : 'bg-[#201217] border-[#441d24] hover:border-[#ef4444]/50 shadow-lg shadow-[#241014]/30'
      }`}
    >
      {/* Left Accent Bar: Blue for Victory, Red for Defeat */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[6px] ${
          won ? 'bg-[#3b82f6]' : 'bg-[#ef4444]'
        }`}
      />

      {/* Top Header Bar: Match Meta on Left, [수정] / [삭제] Admin Buttons on Right */}
      <div className="pl-4 pr-3.5 py-2 bg-black/25 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] overflow-hidden">
          <span
            className={`font-black text-[12px] shrink-0 ${
              won ? 'text-[#60a5fa]' : 'text-[#f87171]'
            }`}
          >
            {won ? '승리' : '패배'}
          </span>
          <span className="text-[#525266]">·</span>
          <span className="text-[#a0a0ba] font-medium shrink-0">
            {match.date.replace(/-/g, '.')}
          </span>
          <span className="text-[#525266]">·</span>
          <span className="text-white font-bold truncate max-w-[170px] sm:max-w-[280px]" title={match.ck_name}>
            {match.ck_name || 'CK 경기'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-[#c4b5fd] shrink-0">
            {match.set_number || 1}세트 ({scoreText})
          </span>
          <span className="text-[#787892] text-[10px] shrink-0 hidden sm:inline">
            {match.game_duration || '31:40'}
          </span>
        </div>

        {/* Right Admin Controls: [수정] / [삭제] */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(match);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-[#8b5cf6]/20 text-[#a0a0b8] hover:text-[#c4b5fd] rounded-lg transition border border-white/10 hover:border-[#8b5cf6]/40 text-[11px] font-bold cursor-pointer"
            title="경기 수정 (비밀번호 인증)"
          >
            <Edit2 size={12} className="text-[#a0a0b8]" />
            <span>수정</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(match.id);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#f87171] hover:text-[#fca5a5] rounded-lg transition border border-[#ef4444]/25 hover:border-[#ef4444]/40 text-[11px] font-bold cursor-pointer"
            title="경기 삭제 (비밀번호 인증)"
          >
            <Trash2 size={12} className="text-[#ef4444]" />
            <span>삭제</span>
          </button>
        </div>
      </div>

      {/* Main Single Row Section */}
      <div className="pl-4 pr-3 sm:pr-4 py-3 sm:py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        
        {/* 1. [CK 경기 일자/세트] */}
        <div className="flex xl:flex-col justify-between xl:justify-center items-start xl:w-[115px] shrink-0 gap-1 border-b xl:border-b-0 xl:border-r border-white/10 pb-2 xl:pb-0 pr-2">
          <div>
            <div
              className={`text-[13px] font-black tracking-tight ${
                won ? 'text-[#60a5fa]' : 'text-[#f87171]'
              }`}
            >
              {won ? 'VICTORY' : 'DEFEAT'}
            </div>
            <div className="text-[11px] text-[#8e8ea8] font-medium mt-0.5">
              {match.game_duration || '31:40'}
            </div>
          </div>

          <div className="text-right xl:text-left">
            <div className="text-[11px] font-bold text-white">
              {match.set_number || 1}세트
            </div>
            <div className="text-[10px] text-[#787892] mt-0.5">
              <span>스코어 {scoreText}</span>
            </div>
          </div>
        </div>

        {/* 2. [챔피언, 스펠, 룬] */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative shrink-0">
            <ChampionIcon
              name={champ}
              size={50}
              shape="square"
              className="rounded-xl border border-white/20 shadow-md"
            />
            <span
              className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded shadow ${
                LINE_LABELS[wLineKey] === 'ADC'
                  ? 'bg-[#8b5cf6] text-white'
                  : 'bg-[#3b82f6] text-white'
              }`}
            >
              {LINE_LABELS[wLineKey]}
            </span>
          </div>

          {/* Spells & Runes (OP.GG signature 2x2 layout) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Spells */}
            <div className="flex flex-col gap-1">
              <img
                src={getSpellIcon(spells[0])}
                alt={spells[0]}
                className="w-[20px] h-[20px] rounded-md object-cover border border-white/10"
                title={spells[0]}
                referrerPolicy="no-referrer"
              />
              <img
                src={getSpellIcon(spells[1])}
                alt={spells[1]}
                className="w-[20px] h-[20px] rounded-md object-cover border border-white/10"
                title={spells[1]}
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Runes */}
            <div className="flex flex-col gap-1">
              <div
                className="w-[20px] h-[20px] rounded-full bg-black/60 border border-white/15 overflow-hidden flex items-center justify-center p-0.5"
                title={runePair.primaryName}
              >
                <img
                  src={runePair.primaryIcon}
                  alt={runePair.primaryName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div
                className="w-[20px] h-[20px] rounded-full bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center p-0.5"
                title={runePair.subName}
              >
                <img
                  src={runePair.subIcon}
                  alt={runePair.subName}
                  className="w-full h-full object-cover opacity-85"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>

          {/* Champion Name & Player */}
          <div className="min-w-[70px] hidden sm:block">
            <div className="text-[12px] font-bold text-white flex items-center gap-1 truncate">
              <Crown size={12} className="text-[#fbbf24] shrink-0" />
              <span>우리밍_</span>
            </div>
            <div className="text-[11px] text-[#8e8ea8] truncate">{champ || '챔피언'}</div>
          </div>
        </div>

        {/* 3. [KDA, 평점] */}
        <div className="flex flex-col justify-center min-w-[120px] shrink-0">
          <div className="text-[16px] font-black tracking-tight text-white flex items-center gap-1">
            <span>{k}</span>
            <span className="text-[#64647a] text-[13px]">/</span>
            <span className="text-[#f87171]">{d}</span>
            <span className="text-[#64647a] text-[13px]">/</span>
            <span className="text-[#60a5fa]">{a}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] mt-0.5">
            <span
              className={`font-extrabold ${
                kdaRatio === 'Perfect'
                  ? 'text-[#fbbf24]'
                  : parseFloat(kdaRatio) >= 4
                  ? 'text-[#60a5fa]'
                  : parseFloat(kdaRatio) >= 3
                  ? 'text-[#34d399]'
                  : 'text-[#9e9eb4]'
              }`}
            >
              {kdaRatio === 'Perfect' ? 'Perfect' : `${kdaRatio}:1`} 평점
            </span>
            {kpPct > 0 && (
              <span className="text-[10px] text-[#f43f5e] font-semibold">
                킬관여 {kpPct}%
              </span>
            )}
          </div>
        </div>

        {/* 4. [아이템 트리] */}
        <div className="flex flex-col justify-center shrink-0">
          <div className="flex items-center gap-1">
            {/* 6 Core Item Slots */}
            {Array.from({ length: 6 }).map((_, idx) => {
              const itm = items[idx];
              return (
                <div
                  key={idx}
                  className="w-[24px] h-[24px] sm:w-[26px] sm:h-[26px] rounded-lg bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                  title={itm || '빈 슬롯'}
                >
                  {itm ? (
                    <img
                      src={getItemIcon(itm)}
                      alt={itm}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                  )}
                </div>
              );
            })}

            {/* 7th Trinket Slot */}
            <div
              className="w-[24px] h-[24px] sm:w-[26px] sm:h-[26px] rounded-full bg-black/70 border border-white/15 overflow-hidden flex items-center justify-center ml-0.5 shrink-0"
              title="장신구(와드)"
            >
              <img
                src={getItemIcon('투명 와드')}
                alt="와드"
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Quick Metrics: Damage & Gold */}
          {(damage || gpm) && (
            <div className="flex items-center gap-2 text-[10px] text-[#8e8ea8] mt-1">
              {damage && (
                <span>
                  🗡️ <b className="text-white">{damage.toLocaleString()}</b>
                </span>
              )}
              {gpm && (
                <span>
                  💰 <b className="text-[#fbbf24]">{gpm}</b> GPM
                </span>
              )}
            </div>
          )}
        </div>

        {/* 5. [참여 플레이어 10명 요약] */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-2 shrink-0 min-w-[210px] hidden md:block">
          <div className="grid grid-cols-2 gap-2 text-[10.5px]">
            {/* Ally 5 */}
            <div className="space-y-0.5">
              <div className="text-[9px] font-bold text-[#60a5fa] pb-0.5 border-b border-white/10">
                아군 ({isWRed ? 'RED' : 'BLUE'})
              </div>
              {LINE_KEYS.map((l) => {
                const name = myRoster[l];
                const c = myChamps[l];
                const isW = isWooriming(name);

                return (
                  <div
                    key={l}
                    onClick={() => name && onJumpToStreamer?.(name, undefined, 'ally')}
                    className={`flex items-center gap-1 cursor-pointer hover:underline truncate ${
                      isW ? 'text-[#f472b6] font-extrabold' : 'text-[#a6a6c0] hover:text-white'
                    }`}
                    title={`${LINE_LABELS[l]}: ${name || '-'} (${c || '-'})`}
                  >
                    <ChampionIcon name={c || ''} size={15} shape="square" className="rounded shrink-0" />
                    <span className="truncate">{name || '-'}</span>
                  </div>
                );
              })}
            </div>

            {/* Enemy 5 */}
            <div className="space-y-0.5 pl-1.5 border-l border-white/10">
              <div className="text-[9px] font-bold text-[#f87171] pb-0.5 border-b border-white/10">
                적팀 ({!isWRed ? 'RED' : 'BLUE'})
              </div>
              {LINE_KEYS.map((l) => {
                const name = enemyRoster[l];
                const c = enemyChamps[l];

                return (
                  <div
                    key={l}
                    onClick={() => name && onJumpToStreamer?.(name, undefined, 'enemy')}
                    className="flex items-center gap-1 cursor-pointer hover:underline text-[#8a8aa0] hover:text-white truncate"
                    title={`${LINE_LABELS[l]}: ${name || '-'} (${c || '-'})`}
                  >
                    <ChampionIcon name={c || ''} size={15} shape="square" className="rounded shrink-0" />
                    <span className="truncate">{name || '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6. [우측 상세보기(▼) 버튼] */}
        <div className="flex items-center justify-end shrink-0 border-t xl:border-t-0 border-white/10 pt-2 xl:pt-0">
          <button
            type="button"
            onClick={onToggleExpand}
            className={`px-3 py-2 rounded-xl text-[11.5px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isExpanded
                ? 'bg-[#8b5cf6] text-white shadow-md shadow-[#8b5cf6]/30'
                : 'bg-white/5 hover:bg-white/10 text-[#c6c6dc] hover:text-white border border-white/10'
            }`}
          >
            <span>{isExpanded ? '상세 접기' : '상세보기'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

      </div>

      {/* Accordion Detail View (Slide down) */}
      {isExpanded && (
        <MatchDetailAccordion
          match={match}
          onJumpToStreamer={onJumpToStreamer}
        />
      )}
    </div>
  );
};
