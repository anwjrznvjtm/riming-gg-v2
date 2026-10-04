import React from 'react';
import { ChampionTierItem, ChampionBuildItem } from '../types/d1Meta';
import { getChampionIconUrl, getChampionFallbackUrl } from '../lib/champions';
import {
  ArrowLeft,
  Shield,
  Zap,
  Swords,
  ChevronRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  Sparkles,
  Flame,
  Info,
} from 'lucide-react';

interface ChampionBuildDetailProps {
  champion: ChampionTierItem;
  build: ChampionBuildItem | null;
  onBack: () => void;
}

export const ChampionBuildDetail: React.FC<ChampionBuildDetailProps> = ({
  champion,
  build,
  onBack,
}) => {
  const champIcon =
    getChampionIconUrl(champion.championId) ||
    getChampionFallbackUrl(champion.championId) ||
    '';

  const positionLabelMap: Record<string, string> = {
    top: '탑 (TOP)',
    jungle: '정글 (JGL)',
    mid: '미드 (MID)',
    adc: '원딜 (ADC)',
    support: '서포터 (SUP)',
  };

  const tierColors: Record<number, { bg: string; text: string; border: string }> = {
    1: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
    2: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
    3: { bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30' },
    4: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
    5: { bg: 'bg-zinc-700/25', text: 'text-zinc-400', border: 'border-zinc-700/40' },
  };

  const tierStyle = tierColors[champion.tier] || tierColors[2];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. 상단 네비게이션 & 뒤로가기 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161822] hover:bg-[#202332] text-[#c0c4d6] hover:text-white border border-[#272b3d] transition-all text-[13px] font-medium shadow-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>솔로랭크 티어리스트 목록으로 돌아가기</span>
        </button>
        <div className="flex items-center gap-2 text-[12px] text-[#8e95ad]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>D1 Database (env.DB) 실시간 메타 연동</span>
        </div>
      </div>

      {/* 2. 챔피언 히어로 배너 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#12141c] via-[#161926] to-[#12141c] border border-[#262a3d] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <img
                src={champIcon}
                alt={champion.championName}
                onError={(e) => {
                  const fallback = getChampionFallbackUrl(champion.championId);
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl object-cover ring-2 ring-emerald-500/30 shadow-lg"
              />
              <span
                className={`absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${tierStyle.bg} ${tierStyle.text} border ${tierStyle.border} shadow-md`}
              >
                {champion.tier}티어
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {champion.championName}
                </h1>
                <span className="text-[14px] text-[#717894] font-medium">
                  {champion.championId}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#222738] text-[#a9b2d0] text-[12px] font-semibold border border-[#31374f]">
                  {positionLabelMap[champion.position] || champion.position.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#182a20] text-emerald-300 text-[11px] font-medium border border-emerald-500/30">
                  패치 {champion.patchVersion}
                </span>
              </div>
              <p className="text-[13px] text-[#9aa2be] mt-1.5 flex items-center gap-2">
                <span>랭킹 <strong>{champion.ranking}위</strong></span>
                <span className="text-[#555d78]">•</span>
                <span>순위 변동: <strong className={champion.rankChange.includes('▲') ? 'text-rose-400' : champion.rankChange.includes('▼') ? 'text-sky-400' : 'text-zinc-400'}>{champion.rankChange}</strong></span>
              </p>
            </div>
          </div>

          {/* 핵심 메타 지표 */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0 bg-[#0d0e14]/70 p-3 sm:p-4 rounded-xl border border-[#232738]">
            <div className="text-center px-2">
              <div className="text-[11px] font-semibold text-[#8089a8] mb-0.5">승률</div>
              <div className={`text-lg sm:text-xl font-black ${champion.winRate >= 51 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                {champion.winRate.toFixed(2)}%
              </div>
            </div>
            <div className="text-center px-2 border-x border-[#232738]">
              <div className="text-[11px] font-semibold text-[#8089a8] mb-0.5">픽률</div>
              <div className="text-lg sm:text-xl font-black text-white">
                {champion.pickRate.toFixed(2)}%
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-[11px] font-semibold text-[#8089a8] mb-0.5">밴률</div>
              <div className="text-lg sm:text-xl font-black text-rose-400">
                {champion.banRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 빌드 정보 섹션 */}
      {build ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 좌측: 전체 룬 트리 하이라이트 (DeepLoL / 롤PS 스타일) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl bg-[#12141c] border border-[#232738] p-5 sm:p-6 shadow-md">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#212536]">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    전체 룬 트리 하이라이트
                  </h2>
                </div>
                <span className="text-[12px] text-[#7d86a4]">
                  DeepLoL 추천 룬 빌드
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* 1) 메인 룬 트리 (4행 전체 룬 슬롯 중 선택 하이라이트) */}
                <div className="md:col-span-7 rounded-xl bg-[#0d0e14] p-4 border border-[#1e2230]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] font-bold text-amber-300">
                      메인: {build.mainRuneTree.styleName}
                    </span>
                    <span className="text-[11px] text-amber-400/80 font-medium px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                      핵심: {build.mainRuneTree.keystone.name}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {build.mainRuneTree.fullTree.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        className={`flex items-center justify-center gap-3 p-2 rounded-lg ${
                          rIdx === 0
                            ? 'bg-amber-500/5 border border-amber-500/20 py-2.5'
                            : 'bg-[#151722]/50'
                        }`}
                      >
                        {row.runes.map((rune) => {
                          const isSelected = rune.selected;
                          return (
                            <div
                              key={rune.id}
                              className={`relative group flex flex-col items-center transition-all ${
                                isSelected ? 'scale-110 z-10' : 'opacity-30 hover:opacity-70'
                              }`}
                            >
                              <div
                                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center p-0.5 transition-all ${
                                  isSelected
                                    ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0d0e14] bg-amber-400/20 shadow-lg shadow-amber-400/20'
                                    : 'ring-1 ring-zinc-700 bg-zinc-800'
                                }`}
                              >
                                <img
                                  src={rune.icon}
                                  alt={rune.name}
                                  className="w-full h-full object-contain rounded-full"
                                />
                              </div>
                              <span
                                className={`text-[10px] mt-1 font-medium truncate max-w-[65px] text-center ${
                                  isSelected ? 'text-amber-200 font-bold' : 'text-zinc-500'
                                }`}
                              >
                                {rune.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2) 보조 룬 트리 & 능력치 파편 */}
                <div className="md:col-span-5 flex flex-col gap-4">
                  {/* 보조 룬 */}
                  <div className="rounded-xl bg-[#0d0e14] p-4 border border-[#1e2230] flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-bold text-sky-300">
                        보조: {build.subRuneTree.styleName}
                      </span>
                      <span className="text-[11px] text-sky-400/80 font-medium px-2 py-0.5 rounded bg-sky-400/10 border border-sky-400/20">
                        선택 2개
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {build.subRuneTree.fullTree.map((row, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex items-center justify-center gap-3 p-1.5 rounded-lg bg-[#151722]/50"
                        >
                          {row.runes.map((rune) => {
                            const isSelected = rune.selected;
                            return (
                              <div
                                key={rune.id}
                                className={`relative group flex flex-col items-center transition-all ${
                                  isSelected ? 'scale-110 z-10' : 'opacity-30 hover:opacity-70'
                                }`}
                              >
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center p-0.5 transition-all ${
                                    isSelected
                                      ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-[#0d0e14] bg-sky-400/20 shadow-md shadow-sky-400/20'
                                      : 'ring-1 ring-zinc-700 bg-zinc-800'
                                  }`}
                                >
                                  <img
                                    src={rune.icon}
                                    alt={rune.name}
                                    className="w-full h-full object-contain rounded-full"
                                  />
                                </div>
                                <span
                                  className={`text-[9px] mt-0.5 font-medium truncate max-w-[55px] text-center ${
                                    isSelected ? 'text-sky-200 font-bold' : 'text-zinc-500'
                                  }`}
                                >
                                  {rune.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 능력치 파편 */}
                  <div className="rounded-xl bg-[#0d0e14] p-3.5 border border-[#1e2230]">
                    <span className="text-[12px] font-bold text-zinc-300 block mb-2">
                      능력치 파편
                    </span>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2 text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
                        <Swords className="w-3.5 h-3.5 shrink-0" />
                        <span>공격: {build.statShards.offense.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span>유연: {build.statShards.flex.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded border border-sky-500/20">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span>방어: {build.statShards.defense.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 시작 아이템 & 추천 스펠 & 추천 신발 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 시작 아이템 */}
              <div className="rounded-xl bg-[#12141c] border border-[#232738] p-4">
                <span className="text-[12px] font-bold text-[#808aa8] block mb-3">
                  시작 아이템
                </span>
                <div className="flex items-center gap-2.5">
                  {build.startItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#171a26] p-2 rounded-lg border border-[#252a3d]">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/15.14.1/img/item/${item.id}.png`}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <div className="text-[11px]">
                        <div className="font-semibold text-white truncate max-w-[80px]">{item.name}</div>
                        <div className="text-amber-400/80 text-[10px]">{item.price} G</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 추천 스펠 */}
              <div className="rounded-xl bg-[#12141c] border border-[#232738] p-4">
                <span className="text-[12px] font-bold text-[#808aa8] block mb-3">
                  추천 소환사 주문 (스펠)
                </span>
                <div className="flex items-center gap-2.5">
                  {build.spells.map((spell, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#171a26] p-2 rounded-lg border border-[#252a3d]">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/15.14.1/img/spell/${spell.id}.png`}
                        alt={spell.name}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <span className="text-[11px] font-semibold text-white">{spell.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 추천 신발 */}
              <div className="rounded-xl bg-[#12141c] border border-[#232738] p-4">
                <span className="text-[12px] font-bold text-[#808aa8] block mb-3">
                  추천 신발
                </span>
                <div className="flex items-center gap-2.5 bg-[#171a26] p-2 rounded-lg border border-[#252a3d]">
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/15.14.1/img/item/${build.boots.id}.png`}
                    alt={build.boots.name}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-8 h-8 rounded object-cover"
                  />
                  <div>
                    <div className="text-[11px] font-semibold text-white">{build.boots.name}</div>
                    <div className="text-[10px] text-emerald-400 font-medium">
                      승률 {build.boots.winRate}% (픽률 {build.boots.pickRate}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 1~5코어 아이템 빌드 트리 */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl bg-[#12141c] border border-[#232738] p-5 sm:p-6 shadow-md">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#212536]">
                <div className="flex items-center gap-2.5">
                  <Flame className="w-5 h-5 text-rose-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    1 ~ 5코어 아이템 빌드 트리
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#7d86a4] block">빌드 승률</span>
                  <span className="text-[13px] font-bold text-emerald-400">
                    {build.coreItems.winRate}%
                  </span>
                </div>
              </div>

              {/* 5코어 순차 카드 목록 */}
              <div className="space-y-3">
                {[
                  { core: '1 코어', data: build.coreItems.core1 },
                  { core: '2 코어', data: build.coreItems.core2 },
                  { core: '3 코어', data: build.coreItems.core3 },
                  { core: '4 코어', data: build.coreItems.core4 },
                  { core: '5 코어', data: build.coreItems.core5 },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0e1017] border border-[#1e2333] hover:border-[#323952] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-center py-1 text-[10px] font-bold uppercase rounded bg-[#181c2b] text-[#8e98bd] border border-[#2a3047]">
                        {item.core}
                      </span>
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/15.14.1/img/item/${item.data.id}.png`}
                        alt={item.data.name}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-10 h-10 rounded-lg object-cover ring-1 ring-zinc-700"
                      />
                      <div>
                        <div className="text-[13px] font-bold text-white">{item.data.name}</div>
                        <div className="text-[11px] text-[#717b9b]">추천 핵심 코어</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[12px] font-bold text-emerald-400">
                        {item.data.winRate}% 승률
                      </div>
                      <div className="text-[11px] text-[#717b9b]">
                        픽률 {item.data.pickRate}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 5코어 빌드 패스 요약 플로우 */}
              <div className="mt-5 p-4 rounded-xl bg-[#090a0f] border border-[#1d202e]">
                <div className="text-[11px] font-semibold text-[#808aa8] mb-2.5 flex items-center justify-between">
                  <span>추천 5코어 빌드 패스 요약</span>
                  <span className="text-[10px] text-amber-400">DeepLoL 최적 조합</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {build.coreItems.buildPathSummary.map((name, i) => (
                    <React.Fragment key={i}>
                      <span className="px-2.5 py-1 rounded-md bg-[#161926] text-white text-[11px] font-medium border border-[#272d42]">
                        {name}
                      </span>
                      {i < build.coreItems.buildPathSummary.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-[#525b7a] shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 카운터 챔피언 대처법 카드 */}
              <div className="mt-5 p-4 rounded-xl bg-[#14121a] border border-[#2d2238]">
                <div className="flex items-center gap-2 mb-3 text-rose-300 text-[12px] font-bold">
                  <Shield className="w-4 h-4 text-rose-400" />
                  <span>상대하기 힘든 카운터 챔피언 ({champion.counterChampionIds.length}개)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {champion.counterChampionIds.map((cid, i) => {
                    const cIcon = getChampionIconUrl(cid) || getChampionFallbackUrl(cid);
                    return (
                      <div
                        key={i}
                        className="flex flex-col items-center p-2 rounded-lg bg-[#1f1728] border border-[#382747] text-center"
                      >
                        <img
                          src={cIcon || ''}
                          alt={cid}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-rose-500/40 mb-1"
                        />
                        <span className="text-[11px] font-semibold text-white truncate max-w-[70px]">
                          {cid}
                        </span>
                        <span className="text-[9px] text-rose-300">카운터</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-[#12141c] rounded-2xl border border-[#232738]">
          <Info className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <p className="text-base text-zinc-300 font-semibold">
            선택하신 챔피언({champion.championName})의 D1 빌드 데이터를 불러오는 중입니다.
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            D1 DB에 아직 동기화되지 않은 경우 상단의 [최신 메타 동기화]를 실행해주세요.
          </p>
        </div>
      )}
    </div>
  );
};
