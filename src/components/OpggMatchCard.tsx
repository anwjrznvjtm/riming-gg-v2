import React from 'react';
import { Match, LINE_KEYS, LINE_LABELS } from '../types';
import { ChampionIcon } from './ChampionIcon';
import {
  isWooriming,
  getWoorimingTeam,
  getWoorimingLineKey,
  isMatchWonByWooriming,
  parseKda,
} from '../lib/stats';
import { getItemIcon } from '../lib/lolIcons';
import { Edit2, Trash2, Crown } from 'lucide-react';

interface OpggMatchCardProps {
  match: Match;
  scoreText: string;
  onEdit: (match: Match) => void;
  onDelete: (id: string) => void;
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
}

export const OpggMatchCard: React.FC<OpggMatchCardProps> = ({
  match,
  scoreText,
  onEdit,
  onDelete,
  onJumpToStreamer,
}) => {
  const won = isMatchWonByWooriming(match);
  const wTeam = getWoorimingTeam(match); // 'Red' | 'Blue'
  const isWRed = wTeam === 'Red';
  const wLineKey = getWoorimingLineKey(match);

  // Wooriming's side rosters
  const allyRoster = isWRed ? match.team_a : match.team_b;
  const allyChamps = isWRed ? match.team_a_champs : match.team_b_champs;
  const allyKdas = isWRed ? match.team_a_kda : match.team_b_kda;
  const allyDetail = isWRed ? match.team_a_detail : match.team_b_detail;
  const allyWon = match.winning_team === wTeam;

  const enemyRoster = isWRed ? match.team_b : match.team_a;
  const enemyChamps = isWRed ? match.team_b_champs : match.team_a_champs;
  const enemyWon = !allyWon;
  const winnerTeamName = match.winning_team === 'Red' ? 'RED' : 'BLUE';
  const isWinnerRed = match.winning_team === 'Red';

  const champ = allyChamps?.[wLineKey] || '';
  const kdaStr = allyKdas?.[wLineKey] || '0/0/0';
  const { k, d, a } = parseKda(kdaStr);
  const isPerfect = d === 0;
  const kdaRatio = isPerfect ? 'Perfect' : ((k + a) / Math.max(1, d)).toFixed(2);

  // Detail for Wooriming
  const pDetail = allyDetail?.players?.[wLineKey];
  const items = pDetail?.items || [];
  const damage = pDetail?.damage_dealt;

  // Bans
  const redBans = (match.ban_a || []).filter(Boolean);
  const blueBans = (match.ban_b || []).filter(Boolean);
  const hasBans = redBans.length > 0 || blueBans.length > 0;

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
      {/* Left Accent Bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[5px] ${
          won ? 'bg-[#3b82f6]' : 'bg-[#ef4444]'
        }`}
      />

      {/* Main Container */}
      <div className="pl-4 sm:pl-5 pr-3 sm:pr-4 py-3 sm:py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        
        {/* 1. [왼쪽 영역] 경기 방식 및 세트 정보, 일자, CK 제목, 승리/패배 뱃지, 세트 스코어/진영 */}
        <div className="flex xl:flex-col justify-between xl:justify-center items-start xl:w-[155px] shrink-0 gap-1.5 border-b xl:border-b-0 xl:border-r border-white/10 pb-2.5 xl:pb-0 xl:pr-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11.5px] font-semibold text-[#8e8ea8]">
                {match.match_format || '5판3선승'} {match.set_number || 1}세트
              </span>
              {match.game_duration && (
                <span className="text-[10.5px] text-[#65657d] font-medium">
                  ({match.game_duration})
                </span>
              )}
            </div>

            <div className="text-[11px] text-[#6b6b85] font-medium mt-0.5">
              {match.date.replace(/-/g, '.')}
            </div>

            <div
              className="text-[13.5px] font-black text-white truncate max-w-[190px] mt-0.5 leading-snug"
              title={match.ck_name || 'CK 경기'}
            >
              {match.ck_name || 'CK 경기'}
            </div>
          </div>

          <div className="flex flex-col items-end xl:items-start gap-1">
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider uppercase inline-flex items-center gap-1 shadow-sm ${
                won
                  ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40'
                  : 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40'
              }`}
            >
              {won ? '승리' : '패배'}
            </span>

            <div className="text-[11px] font-bold text-[#b4b4cb]">
              스코어 {scoreText}
            </div>
          </div>
        </div>

        {/* 2. [중앙 영역] 우리밍_ 큰 챔피언 아이콘, 왕관 + '우리밍_ (챔피언명 · 포지션)', 큰 글씨 KDA, 평점 뱃지 */}
        <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-[210px] xl:px-2">
          {/* 우리밍_ 플레이 챔피언 큰 아이콘 (우하단 포지션 뱃지) */}
          <div className="relative shrink-0">
            <ChampionIcon
              name={champ || ''}
              size={56}
              shape="square"
              className="rounded-xl border-2 border-white/20 shadow-lg"
            />
            <span
              className={`absolute -bottom-1 -right-1 text-[9.5px] font-black px-1.5 py-0.2 rounded-md shadow border border-black/40 ${
                LINE_LABELS[wLineKey] === 'ADC'
                  ? 'bg-[#8b5cf6] text-white'
                  : 'bg-[#3b82f6] text-white'
              }`}
            >
              {LINE_LABELS[wLineKey]}
            </span>
          </div>

          {/* 정보 (왕관 + 닉네임, 챔피언/포지션, 큰 글씨 KDA, 평점 뱃지, 아이템) */}
          <div className="flex flex-col justify-center gap-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13.5px] font-black text-white tracking-tight flex items-center gap-1">
                <Crown size={13} className="text-[#fbbf24] shrink-0" />
                <span>우리밍_</span>
              </span>
              <span className="text-[11.5px] text-[#9a9ab4] font-semibold truncate">
                ({champ || '챔피언 미지정'} · {LINE_LABELS[wLineKey]})
              </span>
            </div>

            {/* KDA & 평점 뱃지 */}
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <div className="text-[18px] sm:text-[20px] font-black tracking-tight text-white flex items-center">
                <span>{k}</span>
                <span className="text-[#64647a] mx-1 text-[13px] font-normal">/</span>
                <span className="text-[#f87171]">{d}</span>
                <span className="text-[#64647a] mx-1 text-[13px] font-normal">/</span>
                <span className="text-[#60a5fa]">{a}</span>
              </div>

              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                  isPerfect
                    ? 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/40'
                    : parseFloat(kdaRatio) >= 4
                    ? 'bg-[#60a5fa]/20 text-[#60a5fa] border-[#60a5fa]/40'
                    : parseFloat(kdaRatio) >= 3
                    ? 'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/40'
                    : 'bg-white/5 text-[#a0a0b8] border-white/10'
                }`}
              >
                {isPerfect ? 'Perfect' : `${kdaRatio}:1`} 평점
              </span>
            </div>

            {/* 아이템 & 딜량 미니 표시 (있을 경우) */}
            {(items.length > 0 || damage) && (
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                {items.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {items.slice(0, 6).map((itm, iIdx) => (
                      <div
                        key={iIdx}
                        className="w-[18px] h-[18px] rounded bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                        title={itm}
                      >
                        <img
                          src={getItemIcon(itm)}
                          alt={itm}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {damage && (
                  <span className="text-[10px] text-[#8e8ea8]">
                    🗡️ <b className="text-white font-bold">{damage.toLocaleString()}</b>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. [우측 영역] 아군팀/적팀 구분 카드 (5인 라인업 세로 정렬, 우리밍_ 라인 하이라이트) */}
        <div className="bg-[#080811]/85 border border-white/10 rounded-[14px] p-2.5 shrink-0 min-w-[270px] sm:min-w-[300px]">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* 아군 5인 */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-0.5">
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    isWRed
                      ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30'
                      : 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                  }`}
                >
                  아군팀 ({isWRed ? 'RED' : 'BLUE'})
                </span>
                {allyWon && (
                  <span className="text-[9.5px] font-black text-[#fbbf24] flex items-center gap-0.5">
                    <Crown size={10} /> 승리
                  </span>
                )}
              </div>

              {LINE_KEYS.map((k) => {
                const name = allyRoster[k];
                const c = allyChamps[k];
                const isW = isWooriming(name);

                return (
                  <div
                    key={k}
                    className={`flex items-center gap-1.5 text-[10.5px] py-0.5 px-1.5 rounded transition ${
                      isW
                        ? 'bg-[#8b5cf6]/25 border border-[#8b5cf6]/50 text-[#f5d0fe] font-bold shadow-sm'
                        : 'text-[#c4c4d6]'
                    }`}
                    title={`${LINE_LABELS[k]}: ${name || '-'} (${c || '-'})`}
                  >
                    <ChampionIcon name={c || ''} size={17} shape="square" className="rounded shrink-0" />
                    <span className="text-[#6a6a80] text-[9.5px] font-bold w-[22px] shrink-0">
                      {LINE_LABELS[k]}
                    </span>
                    <span className="truncate flex items-center gap-1">
                      {isW && <Crown size={10} className="text-[#fbbf24] shrink-0" />}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (name) onJumpToStreamer?.(name, undefined, 'ally');
                        }}
                        className={`truncate cursor-pointer hover:underline hover:text-[#a78bfa] transition-colors ${
                          isW ? 'text-[#f5d0fe] font-black' : ''
                        }`}
                        title={`${name} 선수와 같은 팀(아군)으로 함께한 경기 영역으로 이동`}
                      >
                        {name || '-'}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 적팀 5인 */}
            <div className="space-y-0.5 pl-2 border-l border-white/10">
              <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-0.5">
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    !isWRed
                      ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30'
                      : 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                  }`}
                >
                  적팀 ({!isWRed ? 'RED' : 'BLUE'})
                </span>
                {enemyWon && (
                  <span className="text-[9.5px] font-black text-[#fbbf24] flex items-center gap-0.5">
                    <Crown size={10} /> 승리
                  </span>
                )}
              </div>

              {LINE_KEYS.map((k) => {
                const name = enemyRoster[k];
                const c = enemyChamps[k];

                return (
                  <div
                    key={k}
                    className="flex items-center gap-1.5 text-[10.5px] py-0.5 px-1.5 rounded text-[#a5a5bb]"
                    title={`${LINE_LABELS[k]}: ${name || '-'} (${c || '-'})`}
                  >
                    <ChampionIcon name={c || ''} size={17} shape="square" className="rounded shrink-0" />
                    <span className="text-[#6a6a80] text-[9.5px] font-bold w-[22px] shrink-0">
                      {LINE_LABELS[k]}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (name) onJumpToStreamer?.(name, undefined, 'enemy');
                      }}
                      className="truncate cursor-pointer hover:underline hover:text-[#a78bfa] transition-colors text-[#9fa0b5] hover:text-white"
                      title={`${name} 선수가 상대팀(적팀)으로 출전한 경기 영역으로 이동`}
                    >
                      {name || '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. [최우측 영역] Vertical [수정], [삭제] 아이콘 버튼 */}
        <div className="flex xl:flex-col items-center justify-end gap-1.5 shrink-0 border-t xl:border-t-0 border-white/10 pt-2 xl:pt-0 xl:pl-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(match);
            }}
            className="p-2 bg-white/5 hover:bg-[#8b5cf6]/25 text-[#a0a0b8] hover:text-[#ddd6fe] rounded-xl transition border border-white/10 hover:border-[#8b5cf6]/40 cursor-pointer shadow-sm"
            title="경기 수정"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(match.id);
            }}
            className="p-2 bg-[#ef4444]/10 hover:bg-[#ef4444]/25 text-[#f87171] hover:text-[#fca5a5] rounded-xl transition border border-[#ef4444]/25 hover:border-[#ef4444]/40 cursor-pointer shadow-sm"
            title="경기 삭제"
          >
            <Trash2 size={13} />
          </button>
        </div>

      </div>

      {/* 5. [하단 BANS 영역] RED/BLUE 팀별 구분 뱃지 옆 챔피언 작은 초상화 아이콘 가로 정렬 */}
      {hasBans && (
        <div className="px-4 sm:px-5 py-2 bg-black/45 border-t border-white/5 flex items-center gap-3 text-[11px] text-[#8a8aa0] flex-wrap">
          <span className="font-black text-[#6a6a80] text-[10px] tracking-wider uppercase shrink-0">
            BANS:
          </span>

          {/* RED BANS */}
          {redBans.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-[#1a1215] border border-[#ef4444]/25 px-2 py-0.5 rounded-lg">
              <span className="text-[#f87171] font-black text-[9px] px-1 py-0.2 rounded bg-[#ef4444]/20 border border-[#ef4444]/30 shrink-0">
                RED
              </span>
              <div className="inline-flex items-center gap-1">
                {redBans.map((banName, bIdx) => (
                  <div
                    key={bIdx}
                    className="inline-flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded border border-white/5 hover:border-white/20 transition-colors"
                    title={`RED 밴: ${banName}`}
                  >
                    <ChampionIcon name={banName} size={16} shape="square" className="rounded shrink-0" />
                    <span className="text-[10px] text-[#d6c7c7] font-medium hidden sm:inline truncate max-w-[55px]">
                      {banName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BLUE BANS */}
          {blueBans.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-[#101724] border border-[#3b82f6]/25 px-2 py-0.5 rounded-lg">
              <span className="text-[#60a5fa] font-black text-[9px] px-1 py-0.2 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/30 shrink-0">
                BLUE
              </span>
              <div className="inline-flex items-center gap-1">
                {blueBans.map((banName, bIdx) => (
                  <div
                    key={bIdx}
                    className="inline-flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded border border-white/5 hover:border-white/20 transition-colors"
                    title={`BLUE 밴: ${banName}`}
                  >
                    <ChampionIcon name={banName} size={16} shape="square" className="rounded shrink-0" />
                    <span className="text-[10px] text-[#c7d1e6] font-medium hidden sm:inline truncate max-w-[55px]">
                      {banName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
