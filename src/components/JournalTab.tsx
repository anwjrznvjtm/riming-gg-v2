import React, { useState, useMemo } from 'react';
import { Match, LineKey, MatchFormat, WinningTeam, LINE_KEYS, LINE_LABELS, PlayerGameDetail, TeamGameDetail } from '../types';
import {
  ComputedStats,
  OpponentStat,
  isMatchWonByWooriming,
  formatPlayerWithChamp,
  isKdaEmpty,
  getWoorimingTeam,
  getWoorimingLine,
} from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { StreamerAvatar } from './StreamerAvatar';
import { parseKdaString, normalizeChampionName, SOOP_POPULAR_STREAMERS } from '../lib/champions';
import { PASSCODE } from '../data/initialMatches';
import { calculateMatchSeriesScores, calculateScoreForSetInSeries, sortMatchesDescending } from '../lib/seriesScores';
import { ScreenshotUploadSection } from './ScreenshotUploadSection';
import {
  Plus,
  Search,
  Filter,
  ShieldAlert,
  X,
  Edit2,
  Trash2,
  Eye,
  Save,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Trophy,
  ArrowLeftRight,
  Copy,
  FastForward,
  Swords,
  Zap,
  ArrowDownCircle,
} from 'lucide-react';

// ============================================================================
// Team Check Logic: 특정 스트리머가 아군(같은 팀)인지 적팀(상대팀)인지 판별하는 조건문 함수
// 경기 목록 데이터 구조에서 아군 팀과 적팀 명단에 해당 스트리머의 이름과 포지션이 포함되어 있는지 확인
// ============================================================================
export type StreamerTeamRole = 'all' | 'ally' | 'enemy';

/**
 * isSameTeam: 특정 스트리머가 해당 경기에서 우리밍_과 같은 팀(아군)이었는지 확인하는 조건문 함수
 * @param match 경기 데이터 (team_a: Red팀 로스터, team_b: Blue팀 로스터)
 * @param streamerName 확인할 스트리머 이름
 * @param position (선택사항) 특정 라인/포지션 ('top' | 'jgl' | 'mid' | 'adc' | 'sup')
 * @returns 아군 팀 소속 여부 (true/false)
 */
export function isSameTeam(
  match: Match,
  streamerName: string,
  position?: LineKey | string
): boolean {
  if (!streamerName || !match) return false;
  const target = streamerName.trim().toLowerCase();

  // 우리밍_ 소속 팀 식별 ('Red' 또는 'Blue')
  const wTeam = getWoorimingTeam(match);
  const isWRed = wTeam === 'Red';

  // 아군 팀 로스터 선택 (우리밍_이 Red팀이면 team_a, Blue팀이면 team_b)
  const allyRoster = isWRed ? match.team_a : match.team_b;
  if (!allyRoster) return false;

  // 특정 포지션이 지정된 경우 해당 라인의 선수와 이름 비교
  if (position) {
    const posKey = position.toLowerCase() as LineKey;
    const playerAtPos = String(allyRoster[posKey] || '').trim().toLowerCase();
    return playerAtPos === target;
  }

  // 포지션이 지정되지 않은 경우 아군 전체 5개 포지션 중 하나라도 일치하는지 확인
  return Object.values(allyRoster).some(
    (player) => String(player || '').trim().toLowerCase() === target
  );
}

/**
 * isEnemyTeam: 특정 스트리머가 해당 경기에서 우리밍_과 상대팀(적팀)이었는지 확인하는 조건문 함수
 * @param match 경기 데이터
 * @param streamerName 확인할 스트리머 이름
 * @param position (선택사항) 특정 라인/포지션
 * @returns 적팀 소속 여부 (true/false)
 */
export function isEnemyTeam(
  match: Match,
  streamerName: string,
  position?: LineKey | string
): boolean {
  if (!streamerName || !match) return false;
  const target = streamerName.trim().toLowerCase();

  const wTeam = getWoorimingTeam(match);
  const isWRed = wTeam === 'Red';

  // 적팀 로스터 선택 (우리밍_이 Red팀이면 상대는 team_b, Blue팀이면 상대는 team_a)
  const enemyRoster = isWRed ? match.team_b : match.team_a;
  if (!enemyRoster) return false;

  if (position) {
    const posKey = position.toLowerCase() as LineKey;
    const playerAtPos = String(enemyRoster[posKey] || '').trim().toLowerCase();
    return playerAtPos === target;
  }

  return Object.values(enemyRoster).some(
    (player) => String(player || '').trim().toLowerCase() === target
  );
}

/**
 * checkStreamerTeamRole: 스트리머가 아군인지 적팀인지 판별하여 'ally' | 'enemy' | null 반환
 */
export function checkStreamerTeamRole(
  match: Match,
  streamerName: string,
  position?: LineKey | string
): 'ally' | 'enemy' | null {
  if (isSameTeam(match, streamerName, position)) {
    return 'ally';
  }
  if (isEnemyTeam(match, streamerName, position)) {
    return 'enemy';
  }
  return null;
}

interface JournalTabProps {
  stats: ComputedStats;
  matches: Match[];
  onAddMatch: (match: Match) => void;
  onUpdateMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  onImportMatches?: (matches: Match[]) => void;
  isAdmin: boolean;
  onAdminLoginSuccess: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
  allChampions: string[];
  targetStreamer?: string | null;
  targetMatchId?: string | null;
  targetStreamerRole?: 'all' | 'ally' | 'enemy' | null;
  jumpTimestamp?: number;
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
}

export const JournalTab: React.FC<JournalTabProps> = ({
  stats,
  matches,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  onImportMatches,
  isAdmin,
  onAdminLoginSuccess,
  onToast,
  allStreamers,
  allChampions,
  targetStreamer,
  targetMatchId,
  targetStreamerRole,
  jumpTimestamp,
  onJumpToStreamer,
}) => {
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterLine, setFilterLine] = useState('ALL');
  const [filterStreamer, setFilterStreamer] = useState('');
  const [filterStreamerRole, setFilterStreamerRole] = useState<'all' | 'ally' | 'enemy'>('all');

  const [isChampsModalOpen, setIsChampsModalOpen] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentStat | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [formError, setFormError] = useState('');

  const [seriesWinners, setSeriesWinners] = useState<('Red' | 'Blue')[]>([]);
  const [seriesHistory, setSeriesHistory] = useState<{ set: number; won: boolean; label: string }[]>([]);

  const emptyRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
  const [formData, setFormData] = useState<Match>({
    id: '',
    date: new Date().toISOString().slice(0, 10),
    ck_name: '',
    team_a: { ...emptyRoster, adc: '우리밍_' },
    team_b: { ...emptyRoster },
    team_a_champs: { ...emptyRoster },
    team_b_champs: { ...emptyRoster },
    ban_a: ['', '', '', '', ''],
    ban_b: ['', '', '', '', ''],
    team_a_kda: { ...emptyRoster },
    team_b_kda: { ...emptyRoster },
    score: '1:0',
    winning_team: 'Red',
    match_format: '3판2선승',
    set_number: 1,
    game_duration: '31:40',
    team_a_detail: undefined,
    team_b_detail: undefined,
    red_screenshot: undefined,
    blue_screenshot: undefined,
    extracted_data: undefined,
  });

  const [formPasscode, setFormPasscode] = useState('');
  const [persistAdminInForm, setPersistAdminInForm] = useState(true);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // === FIXED: Correct cumulative score calculation grouped by date+ck_name ===
  const seriesScoreResult = useMemo(() => calculateMatchSeriesScores(matches), [matches]);
  const correctedScoreMap = seriesScoreResult.scoreMap;

  // === FIXED: Filter + Sort - 날짜 내림차순, 같은 날짜는 세트번호 내림차순 (최신이 위, 1세트가 아래) ===
  const filteredMatches = useMemo(() => {
    const filtered = matches.filter((m) => {
      if (filterDate && !m.date.includes(filterDate)) return false;
      if (filterName && !m.ck_name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterLine !== 'ALL') {
        const line = getWoorimingLine(m);
        if (line !== filterLine) return false;
      }
      if (filterStreamer) {
        // Team Check Logic: 해당 선수가 아군/적팀 명단에 있는지 판별
        const role = checkStreamerTeamRole(m, filterStreamer);
        if (!role) return false;
        if (filterStreamerRole === 'ally' && role !== 'ally') return false;
        if (filterStreamerRole === 'enemy' && role !== 'enemy') return false;
      }
      return true;
    });
    return sortMatchesDescending(filtered);
  }, [matches, filterDate, filterName, filterLine, filterStreamer, filterStreamerRole]);

  // 스트리머 경기 영역으로 스크롤 점프 함수 (아군/적팀 Team Check Logic 적용)
  const handleJumpToStreamer = (
    streamerName: string,
    specificMatchId?: string,
    teamRole: 'all' | 'ally' | 'enemy' = 'all'
  ) => {
    if (!streamerName && !specificMatchId) return;
    const cleanName = (streamerName || '').trim();

    // 1. 만약 현재 필터로 인해 해당 스트리머/경기가 숨겨져 있다면 필터 재설정
    if (cleanName) {
      const matchExistsInAll = matches.some((m) => {
        if (specificMatchId && m.id !== specificMatchId) return false;
        // Team Check Logic 적용
        const role = checkStreamerTeamRole(m, cleanName);
        if (!role) return false;
        if (teamRole === 'ally' && role !== 'ally') return false;
        if (teamRole === 'enemy' && role !== 'enemy') return false;
        return true;
      });

      if (matchExistsInAll) {
        const isVisibleInCurrent = filteredMatches.some((m) => {
          if (specificMatchId && m.id !== specificMatchId) return false;
          const role = checkStreamerTeamRole(m, cleanName);
          if (!role) return false;
          if (teamRole === 'ally' && role !== 'ally') return false;
          if (teamRole === 'enemy' && role !== 'enemy') return false;
          return true;
        });

        if (!isVisibleInCurrent) {
          setFilterDate('');
          setFilterName('');
          setFilterLine('ALL');
          setFilterStreamer(cleanName);
          setFilterStreamerRole(teamRole);
        }
      }
    }

    // 2. DOM에서 카드 찾아서 element.scrollIntoView({ behavior: 'smooth' }) 실행
    const attemptScroll = (retryCount = 0) => {
      let targetEl: HTMLElement | null = null;

      if (specificMatchId) {
        targetEl = document.getElementById(`match-${specificMatchId}`);
      }

      if (!targetEl && cleanName) {
        const cards = Array.from(
          document.querySelectorAll<HTMLElement>('[data-match-card], [id^="match-"]')
        );

        for (const card of cards) {
          const allyStreamers = card.getAttribute('data-ally-streamers') || '';
          const enemyStreamers = card.getAttribute('data-enemy-streamers') || '';
          const allStreamers = card.getAttribute('data-streamers') || card.textContent || '';

          // Team Check Logic: 아군/적팀 선수 명단 여부에 따른 매칭 조건문
          if (teamRole === 'ally') {
            if (allyStreamers.toLowerCase().includes(cleanName.toLowerCase())) {
              targetEl = card;
              break;
            }
          } else if (teamRole === 'enemy') {
            if (enemyStreamers.toLowerCase().includes(cleanName.toLowerCase())) {
              targetEl = card;
              break;
            }
          } else {
            if (allStreamers.toLowerCase().includes(cleanName.toLowerCase())) {
              targetEl = card;
              break;
            }
          }
        }
      }

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.remove('match-card-highlight');
        void targetEl.offsetWidth; // trigger reflow for css animation
        targetEl.classList.add('match-card-highlight');
        setTimeout(() => {
          targetEl?.classList.remove('match-card-highlight');
        }, 2600);

        if (cleanName) {
          if (teamRole === 'ally') {
            onToast(`'${cleanName}' 선수와 같은 팀(아군)으로 함께한 경기 영역으로 이동했습니다 🤝`);
          } else if (teamRole === 'enemy') {
            onToast(`'${cleanName}' 선수가 상대팀(적팀)으로 출전한 경기 영역으로 이동했습니다 ⚔`);
          } else {
            onToast(`'${cleanName}' 선수의 CK 일지 경기 영역으로 이동했습니다 🎯`);
          }
        }
      } else if (retryCount < 8) {
        setTimeout(() => attemptScroll(retryCount + 1), 80);
      }
    };

    setTimeout(() => attemptScroll(0), 40);
  };

  // 상위(App)에서 targetStreamer나 targetMatchId가 전달되었을 때 자동 점프
  React.useEffect(() => {
    if (targetStreamer || targetMatchId) {
      handleJumpToStreamer(
        targetStreamer || '',
        targetMatchId || undefined,
        targetStreamerRole || 'all'
      );
    }
  }, [targetStreamer, targetMatchId, targetStreamerRole, jumpTimestamp]);

  const woorimingLocation = useMemo(() => {
    for (const teamKey of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) {
        if (formData[teamKey][l]?.trim() === '우리밍_') {
          return { team: teamKey, line: l };
        }
      }
    }
    return null;
  }, [formData.team_a, formData.team_b]);

  const handleSetWooriming = (targetTeam: 'team_a' | 'team_b', targetLine: LineKey) => {
    setFormData((prev) => {
      const nextA = { ...prev.team_a };
      const nextB = { ...prev.team_b };
      for (const l of LINE_KEYS) {
        if (nextA[l]?.trim() === '우리밍_') nextA[l] = '';
        if (nextB[l]?.trim() === '우리밍_') nextB[l] = '';
      }
      if (targetTeam === 'team_a') {
        nextA[targetLine] = '우리밍_';
      } else {
        nextB[targetLine] = '우리밍_';
      }
      const calcResult = calculateScoreForSetInSeries({
        date: prev.date,
        ck_name: prev.ck_name,
        set_number: prev.set_number,
        winning_team: prev.winning_team,
        team_a: nextA,
        team_b: nextB,
        excludeMatchId: prev.id,
        allMatches: matches,
      });
      setSeriesWinners(calcResult.priorWinners);
      setSeriesHistory(calcResult.priorHistory);
      return {
        ...prev,
        team_a: nextA,
        team_b: nextB,
        score: calcResult.score,
      };
    });
    setFormError('');
  };

  const { duplicatePlayers, duplicateChamps } = useMemo(() => {
    const pCounts = new Map<string, number>();
    const cCounts = new Map<string, number>();
    for (const t of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) {
        const p = (formData[t]?.[l] || '').trim();
        if (p) pCounts.set(p, (pCounts.get(p) || 0) + 1);
        const c = normalizeChampionName(formData[`${t}_champs` as const]?.[l]);
        if (c) cCounts.set(c, (cCounts.get(c) || 0) + 1);
      }
    }
    const dupP = new Set<string>();
    for (const [p, cnt] of pCounts.entries()) {
      if (cnt > 1) dupP.add(p);
    }
    const dupC = new Set<string>();
    for (const [c, cnt] of cCounts.entries()) {
      if (cnt > 1) dupC.add(c);
    }
    return { duplicatePlayers: dupP, duplicateChamps: dupC };
  }, [formData.team_a, formData.team_b, formData.team_a_champs, formData.team_b_champs]);

  const handleOpenAddModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultTeamA = { ...emptyRoster, adc: '우리밍_' };
    const defaultTeamB = { ...emptyRoster };
    const initialScoreResult = calculateScoreForSetInSeries({
      date: today,
      ck_name: '',
      set_number: 1,
      winning_team: 'Red',
      team_a: defaultTeamA,
      team_b: defaultTeamB,
      allMatches: matches,
    });
    setFormData({
      id: `m_${Date.now()}`,
      date: today,
      ck_name: '',
      team_a: defaultTeamA,
      team_b: defaultTeamB,
      team_a_champs: { ...emptyRoster },
      team_b_champs: { ...emptyRoster },
      ban_a: ['', '', '', '', ''],
      ban_b: ['', '', '', '', ''],
      team_a_kda: { ...emptyRoster },
      team_b_kda: { ...emptyRoster },
      score: initialScoreResult.score,
      winning_team: 'Red',
      match_format: '3판2선승',
      set_number: 1,
      game_duration: '31:40',
      team_a_detail: undefined,
      team_b_detail: undefined,
      red_screenshot: undefined,
      blue_screenshot: undefined,
      extracted_data: undefined,
    });
    setSeriesWinners(initialScoreResult.priorWinners);
    setSeriesHistory(initialScoreResult.priorHistory);
    setEditingMatch(null);
    setFormPasscode('');
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (m: Match) => {
    const calcResult = calculateScoreForSetInSeries({
      date: m.date,
      ck_name: m.ck_name,
      set_number: m.set_number,
      winning_team: m.winning_team,
      team_a: m.team_a,
      team_b: m.team_b,
      excludeMatchId: m.id,
      allMatches: matches,
    });
    setFormData({
      ...m,
      score: calcResult.score,
      team_a: { ...m.team_a },
      team_b: { ...m.team_b },
      team_a_champs: { ...m.team_a_champs },
      team_b_champs: { ...m.team_b_champs },
      ban_a: [...m.ban_a],
      ban_b: [...m.ban_b],
      team_a_kda: { ...m.team_a_kda },
      team_b_kda: { ...m.team_b_kda },
      game_duration: m.game_duration || '31:40',
      team_a_detail: m.team_a_detail,
      team_b_detail: m.team_b_detail,
      red_screenshot: m.red_screenshot,
      blue_screenshot: m.blue_screenshot,
      extracted_data: m.extracted_data,
    });
    setSeriesWinners(calcResult.priorWinners);
    setSeriesHistory(calcResult.priorHistory);
    setEditingMatch(m);
    setFormPasscode('');
    setFormError('');
    setIsEditModalOpen(true);
  };

  // FIXED: Winner selection - calculate strictly from prior sets in same series
  const handleSelectWinner = (winner: 'Red' | 'Blue') => {
    const calcResult = calculateScoreForSetInSeries({
      date: formData.date,
      ck_name: formData.ck_name,
      set_number: formData.set_number,
      winning_team: winner,
      team_a: formData.team_a,
      team_b: formData.team_b,
      excludeMatchId: formData.id,
      allMatches: matches,
    });
    setSeriesWinners(calcResult.priorWinners);
    setSeriesHistory(calcResult.priorHistory);
    setFormData((prev) => ({
      ...prev,
      winning_team: winner,
      score: calcResult.score,
    }));
    setFormError('');
  };

  const handleLoadPreviousSetRoster = () => {
    if (matches.length === 0) {
      onToast('불러올 이전 경기 데이터가 없습니다.');
      return;
    }
    const sorted = [...matches].sort((a, b) => {
      const dDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dDiff !== 0) return dDiff;
      const setA = Number(a.set_number) || 1;
      const setB = Number(b.set_number) || 1;
      return setB - setA;
    });
    const prevMatch = sorted[0];
    const nextSet = (Number(prevMatch.set_number) || 1) + 1;

    const calcResult = calculateScoreForSetInSeries({
      date: prevMatch.date || formData.date,
      ck_name: prevMatch.ck_name || formData.ck_name,
      set_number: nextSet,
      winning_team: 'Red',
      team_a: prevMatch.team_a,
      team_b: prevMatch.team_b,
      allMatches: matches,
    });
    setSeriesWinners(calcResult.priorWinners);
    setSeriesHistory(calcResult.priorHistory);

    setFormData((curr) => ({
      ...curr,
      ck_name: prevMatch.ck_name || curr.ck_name,
      date: prevMatch.date || curr.date,
      match_format: prevMatch.match_format || curr.match_format,
      set_number: nextSet,
      team_a: { ...prevMatch.team_a },
      team_b: { ...prevMatch.team_b },
      team_a_champs: { ...prevMatch.team_a_champs },
      team_b_champs: { ...prevMatch.team_b_champs },
      team_a_kda: { ...emptyRoster },
      team_b_kda: { ...emptyRoster },
      winning_team: 'Red',
      score: calcResult.score,
    }));

    onToast(`직전 경기(${prevMatch.ck_name || 'CK'} ${prevMatch.set_number}세트)의 10인 로스터를 불러왔습니다.`);
  };

  const handleSwapTeams = () => {
    setFormData((prev) => {
      const nextA = { ...prev.team_b };
      const nextB = { ...prev.team_a };
      const nextAChamps = { ...prev.team_b_champs };
      const nextBChamps = { ...prev.team_a_champs };
      const nextAKda = { ...prev.team_b_kda };
      const nextBKda = { ...prev.team_a_kda };
      const nextBanA = [...prev.ban_b];
      const nextBanB = [...prev.ban_a];
      const nextWinner: 'Red' | 'Blue' = prev.winning_team === 'Red' ? 'Blue' : 'Red';

      const calcResult = calculateScoreForSetInSeries({
        date: prev.date,
        ck_name: prev.ck_name,
        set_number: prev.set_number,
        winning_team: nextWinner,
        team_a: nextA,
        team_b: nextB,
        excludeMatchId: prev.id,
        allMatches: matches,
      });
      setSeriesWinners(calcResult.priorWinners);
      setSeriesHistory(calcResult.priorHistory);

      return {
        ...prev,
        team_a: nextA,
        team_b: nextB,
        team_a_champs: nextAChamps,
        team_b_champs: nextBChamps,
        team_a_kda: nextAKda,
        team_b_kda: nextBKda,
        ban_a: nextBanA,
        ban_b: nextBanB,
        winning_team: nextWinner,
        score: calcResult.score,
      };
    });
    onToast('Red팀과 Blue팀 로스터 배치가 맞교환(Swap)되었습니다.');
  };

  const validateMatchForm = (matchData: Match): { isValid: boolean; errorMsg: string } => {
    if (!isAdmin) {
      const cleanPass = formPasscode.trim().toLowerCase();
      if (!cleanPass) {
        return { isValid: false, errorMsg: '관리자 패스코드를 입력해주세요.' };
      }
      if (cleanPass !== PASSCODE.toLowerCase()) {
        return { isValid: false, errorMsg: '패스코드가 올바르지 않습니다.' };
      }
    }

    const allPlayers: string[] = [
      ...(Object.values(matchData.team_a) as string[]),
      ...(Object.values(matchData.team_b) as string[]),
    ];
    const wCount = allPlayers.filter((p) => p && p.trim() === '우리밍_').length;
    if (wCount === 0) {
      return {
        isValid: false,
        errorMsg: "양 팀 중 정확히 1개 라인에 '우리밍_'을 지정해야 합니다. (상단 빠른 지정 버튼 클릭)",
      };
    }
    if (wCount > 1) {
      return {
        isValid: false,
        errorMsg: `우리밍_이 ${wCount}곳에 중복으로 입력되어 있습니다. 1곳에만 지정해주세요.`,
      };
    }

    const playerCounts = new Map<string, number>();
    for (const p of allPlayers) {
      const trimmed = (p || '').trim();
      if (trimmed) {
        playerCounts.set(trimmed, (playerCounts.get(trimmed) || 0) + 1);
      }
    }
    const dupPlayers: string[] = [];
    for (const [p, count] of playerCounts.entries()) {
      if (count > 1) dupPlayers.push(p);
    }

    const allChamps: string[] = [
      ...(Object.values(matchData.team_a_champs) as string[]),
      ...(Object.values(matchData.team_b_champs) as string[]),
    ];
    const champCounts = new Map<string, number>();
    for (const c of allChamps) {
      const norm = normalizeChampionName(c);
      if (norm) {
        champCounts.set(norm, (champCounts.get(norm) || 0) + 1);
      }
    }
    const dupChamps: string[] = [];
    for (const [c, count] of champCounts.entries()) {
      if (count > 1) dupChamps.push(c);
    }

    if (dupPlayers.length > 0 || dupChamps.length > 0) {
      const parts: string[] = [];
      if (dupPlayers.length > 0) parts.push(`중복 선수: ${dupPlayers.join(', ')}`);
      if (dupChamps.length > 0) parts.push(`중복 챔피언: ${dupChamps.join(', ')}`);
      return {
        isValid: false,
        errorMsg: `동일한 선수 또는 챔피언이 중복 선택되었습니다. (${parts.join(' / ')})`,
      };
    }

    return { isValid: true, errorMsg: '' };
  };

  const handleSaveMatch = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) {
      setFormError(val.errorMsg);
      onToast(val.errorMsg.includes('중복') ? '동일한 선수 또는 챔피언이 중복 선택되었습니다.' : val.errorMsg);
      return;
    }

    if (!isAdmin && persistAdminInForm) {
      onAdminLoginSuccess();
    }

    const cleanCkName =
      formData.ck_name.trim() || `${formData.date} CK 경기 (${formData.winning_team}팀 승)`;

    // Ensure team_a_detail and team_b_detail player keys match the exact streamer names in team_a and team_b
    let sanitizedTeamADetail = formData.team_a_detail;
    if (sanitizedTeamADetail?.players) {
      const updatedPlayers = { ...sanitizedTeamADetail.players };
      for (const lk of LINE_KEYS) {
        if (updatedPlayers[lk]) {
          updatedPlayers[lk] = {
            ...updatedPlayers[lk],
            player: formData.team_a[lk] || updatedPlayers[lk].player,
            line: lk,
          };
        }
      }
      sanitizedTeamADetail = { ...sanitizedTeamADetail, players: updatedPlayers };
    }

    let sanitizedTeamBDetail = formData.team_b_detail;
    if (sanitizedTeamBDetail?.players) {
      const updatedPlayers = { ...sanitizedTeamBDetail.players };
      for (const lk of LINE_KEYS) {
        if (updatedPlayers[lk]) {
          updatedPlayers[lk] = {
            ...updatedPlayers[lk],
            player: formData.team_b[lk] || updatedPlayers[lk].player,
            line: lk,
          };
        }
      }
      sanitizedTeamBDetail = { ...sanitizedTeamBDetail, players: updatedPlayers };
    }

    const matchToSave: Match = {
      ...formData,
      ck_name: cleanCkName,
      team_a_detail: sanitizedTeamADetail,
      team_b_detail: sanitizedTeamBDetail,
    };

    try {
      if (editingMatch) {
        onUpdateMatch(matchToSave);
        onToast('경기가 성공적으로 수정되었습니다.');
      } else {
        onAddMatch(matchToSave);
        onToast('새로운 경기가 등록되었습니다.');
      }
      setIsEditModalOpen(false);
      setFormError('');
    } catch (err) {
      console.error('Save match error', err);
      setFormError('경기 저장 중 예기치 않은 오류가 발생했습니다.');
      onToast('저장 실패');
    }
  };

  const handleSaveAndNextSet = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) {
      setFormError(val.errorMsg);
      onToast(val.errorMsg.includes('중복') ? '동일한 선수 또는 챔피언이 중복 선택되었습니다.' : val.errorMsg);
      return;
    }

    if (!isAdmin && persistAdminInForm) {
      onAdminLoginSuccess();
    }

    const cleanCkName = formData.ck_name.trim() || `${formData.date} CK 경기`;

    // Ensure team_a_detail and team_b_detail player keys match the exact streamer names in team_a and team_b
    let sanitizedTeamADetail = formData.team_a_detail;
    if (sanitizedTeamADetail?.players) {
      const updatedPlayers = { ...sanitizedTeamADetail.players };
      for (const lk of LINE_KEYS) {
        if (updatedPlayers[lk]) {
          updatedPlayers[lk] = {
            ...updatedPlayers[lk],
            player: formData.team_a[lk] || updatedPlayers[lk].player,
            line: lk,
          };
        }
      }
      sanitizedTeamADetail = { ...sanitizedTeamADetail, players: updatedPlayers };
    }

    let sanitizedTeamBDetail = formData.team_b_detail;
    if (sanitizedTeamBDetail?.players) {
      const updatedPlayers = { ...sanitizedTeamBDetail.players };
      for (const lk of LINE_KEYS) {
        if (updatedPlayers[lk]) {
          updatedPlayers[lk] = {
            ...updatedPlayers[lk],
            player: formData.team_b[lk] || updatedPlayers[lk].player,
            line: lk,
          };
        }
      }
      sanitizedTeamBDetail = { ...sanitizedTeamBDetail, players: updatedPlayers };
    }

    const matchToSave: Match = {
      ...formData,
      ck_name: cleanCkName,
      team_a_detail: sanitizedTeamADetail,
      team_b_detail: sanitizedTeamBDetail,
    };

    try {
      if (editingMatch) {
        onUpdateMatch(matchToSave);
      } else {
        onAddMatch(matchToSave);
      }

      const nextSetNum = (Number(formData.set_number) || 1) + 1;
      const updatedListForCalc = [...matches.filter((m) => m.id !== matchToSave.id), matchToSave];
      const calcResult = calculateScoreForSetInSeries({
        date: formData.date,
        ck_name: cleanCkName,
        set_number: nextSetNum,
        winning_team: 'Red',
        team_a: formData.team_a,
        team_b: formData.team_b,
        allMatches: updatedListForCalc,
      });
      setSeriesWinners(calcResult.priorWinners);
      setSeriesHistory(calcResult.priorHistory);

      setFormData((curr) => ({
        ...curr,
        id: `m_${Date.now()}`,
        set_number: nextSetNum,
        score: calcResult.score,
        winning_team: 'Red',
        team_a_kda: { ...emptyRoster },
        team_b_kda: { ...emptyRoster },
      }));
      setEditingMatch(null);
      setFormError('');
      onToast(`${formData.set_number}세트 저장 완료! (${nextSetNum}세트 작성을 이어갑니다 ⚡)`);
    } catch (err) {
      console.error('Save next set error', err);
      setFormError('다음 세트 저장 중 오류가 발생했습니다.');
      onToast('저장 실패');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setDeletePasscode('');
    setDeleteError('');
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;

    if (!isAdmin) {
      const cleanPass = deletePasscode.trim().toLowerCase();
      if (cleanPass !== PASSCODE.toLowerCase()) {
        setDeleteError('패스코드가 올바르지 않습니다.');
        return;
      }
      onAdminLoginSuccess();
    }

    onDeleteMatch(deleteTargetId);
    onToast('경기가 삭제되었습니다.');
    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s]">
      {/* Top Banner Stats: Opponent Stats TOP 5 & Most Picked TOP 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[14px] text-white flex items-center gap-2">
                <span>⚔</span>
                <span>맞라인 상대 승률 TOP 5</span>
              </h3>
              <span className="text-[10px] text-[#8a8aa0] bg-[#1e1e2a] px-2.5 py-0.5 rounded-full border border-[#2a2a3a]">
                클릭 시 상대 전적 상세
              </span>
            </div>

            <div className="space-y-2">
              {stats.opponentStats.length === 0 ? (
                <div className="text-[12px] text-[#6a6a80] py-6 text-center">
                  기록된 맞라인 상대 데이터가 없습니다.
                </div>
              ) : (
                stats.opponentStats.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.name}
                    onClick={() => setSelectedOpponent(item)}
                    className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] hover:border-[#8b5cf6]/50 rounded-[10px] px-3.5 py-2.5 cursor-pointer transition-all hover:bg-[#151522] group"
                    title="클릭하여 상대 전적 상세 보기"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-[#6a6a80] font-bold w-[14px]">{idx + 1}</span>
                      <StreamerAvatar name={item.name} size={22} shape="circle" />
                      <span className="text-[13px] font-semibold text-white group-hover:text-[#a78bfa] transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-[#a78bfa] bg-[#8b5cf6]/10 px-1.5 py-0.5 rounded font-medium border border-[#8b5cf6]/20">
                        {item.primaryLine}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-[11px] text-[#8a8aa0]">
                        {item.games}전 {item.wins}승 {item.losses}패
                      </span>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                          item.winrate >= 60
                            ? 'bg-[#3b82f6]/20 text-[#60a5fa]'
                            : item.winrate >= 50
                            ? 'bg-[#8b5cf6]/20 text-[#c4b5fd]'
                            : 'bg-[#ef4444]/20 text-[#f87171]'
                        }`}
                      >
                        {item.winrate.toFixed(0)}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToStreamer(item.name, undefined, 'enemy');
                        }}
                        className="px-2 py-0.5 rounded bg-[#8b5cf6]/15 hover:bg-[#8b5cf6] text-[#c4b5fd] hover:text-white border border-[#8b5cf6]/30 text-[10px] font-bold transition flex items-center gap-1 shrink-0 ml-0.5"
                        title={`${item.name} 선수가 상대팀(적팀)으로 출전한 경기 영역으로 이동`}
                      >
                        <span>일지 이동</span>
                        <Zap size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#1e1e2a] flex items-center justify-between text-[11px] text-[#6a6a80]">
            <span>우리밍_ 과의 맞라인 상대 기준</span>
            <span className="text-[#a78bfa]">상세 전적 지원</span>
          </div>
        </div>

        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-[14px] text-white flex items-center gap-2">
              <span>🏆</span>
              <span>모스트픽 TOP 5</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsChampsModalOpen(true)}
              className="text-[11px] bg-[#1e1e2a] border border-[#2a2a3a] text-[#c0c0d0] hover:text-white rounded-full px-3 py-1 hover:bg-[#2a2a3a] transition"
            >
              전체 보기
            </button>
          </div>
          <div className="space-y-2">
            {stats.mostPickedChamps.slice(0, 5).map((item, idx) => (
              <div
                key={item.champ}
                className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3.5 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-[#6a6a80] font-bold w-[14px]">{idx + 1}</span>
                  <ChampionIcon name={item.champ} size={24} shape="square" />
                  <span className="text-[13px] font-semibold text-white">{item.champ}</span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-white font-medium">
                    {item.wins}승 {item.losses}패 •{' '}
                    <span className="text-[#8b5cf6] font-bold">{item.winrate.toFixed(0)}%</span>
                  </div>
                  {item.avgKDA ? (
                    <div className="text-[10px] text-[#a78bfa]">KDA {item.avgKDA}</div>
                  ) : (
                    <div className="text-[10px] text-[#5a5a6a]">KDA -</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <div className="relative">
            <input
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="날짜 검색 (예: 2026-09)"
              className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] w-[180px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <div className="relative">
            <input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="CK명 검색"
              className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] w-[140px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-[#c0c0d0] focus:outline-none focus:border-[#8b5cf6]/50"
          >
            <option value="ALL">전체 라인</option>
            <option value="TOP">TOP</option>
            <option value="JGL">JGL</option>
            <option value="MID">MID</option>
            <option value="ADC">ADC</option>
            <option value="SUP">SUP</option>
          </select>

          {/* 스트리머 검색/필터 */}
          <div className="relative">
            <input
              value={filterStreamer}
              onChange={(e) => setFilterStreamer(e.target.value)}
              placeholder="스트리머 필터"
              list="journal-streamers-list"
              className="h-[36px] bg-[#08080c] border border-[#1e1e2a] focus:border-[#8b5cf6]/60 rounded-full pl-3.5 pr-7 text-[12px] w-[130px] placeholder:text-[#5a5a6a] text-white focus:outline-none"
            />
            {filterStreamer && (
              <button
                type="button"
                onClick={() => setFilterStreamer('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-white"
                title="스트리머 필터 지우기"
              >
                <X size={12} />
              </button>
            )}
            <datalist id="journal-streamers-list">
              {allStreamers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {filterStreamer && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 rounded-full text-[11px] text-[#c4b5fd]">
                <span>선수: <strong>{filterStreamer}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStreamer('');
                    setFilterStreamerRole('all');
                  }}
                  className="hover:text-white ml-0.5"
                  title="선수 필터 초기화"
                >
                  <X size={11} />
                </button>
              </div>

              {/* Team Role Check Selector */}
              <div className="flex items-center bg-[#08080c] border border-[#1e1e2a] rounded-full p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterStreamerRole('all')}
                  className={`px-2.5 py-1 rounded-full transition ${
                    filterStreamerRole === 'all'
                      ? 'bg-[#8b5cf6] text-white shadow-sm'
                      : 'text-[#8a8aa0] hover:text-white'
                  }`}
                >
                  전체 ({matches.filter((m) => checkStreamerTeamRole(m, filterStreamer)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStreamerRole('ally')}
                  className={`px-2.5 py-1 rounded-full transition flex items-center gap-1 ${
                    filterStreamerRole === 'ally'
                      ? 'bg-[#3b82f6] text-white shadow-sm'
                      : 'text-[#8a8aa0] hover:text-[#60a5fa]'
                  }`}
                  title="우리밍_과 같은 팀(아군)이었던 경기만 표시"
                >
                  <span>🤝 아군</span>
                  <span>({matches.filter((m) => checkStreamerTeamRole(m, filterStreamer) === 'ally').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStreamerRole('enemy')}
                  className={`px-2.5 py-1 rounded-full transition flex items-center gap-1 ${
                    filterStreamerRole === 'enemy'
                      ? 'bg-[#ef4444] text-white shadow-sm'
                      : 'text-[#8a8aa0] hover:text-[#f87171]'
                  }`}
                  title="우리밍_과 상대팀(적팀)이었던 경기만 표시"
                >
                  <span>⚔ 적팀</span>
                  <span>({matches.filter((m) => checkStreamerTeamRole(m, filterStreamer) === 'enemy').length})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="h-[36px] px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-semibold flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <Plus size={14} />
            <span>경기 추가</span>
          </button>
        </div>
      </div>

      <div className="space-y-3.5">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-[#62627a] bg-[#12121a]/80 border border-[#1e1e2a] rounded-[20px]">
            일치하는 경기 기록이 없습니다.
          </div>
        ) : (
          filteredMatches.map((m) => {
            const wTeam = getWoorimingTeam(m);
            const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
            const wChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
            const wKdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;

            let wKey: LineKey = 'adc';
            for (const k of LINE_KEYS) {
              if (wRoster[k] === '우리밍_') {
                wKey = k;
                break;
              }
            }

            const champ = wChamps[wKey];
            const kdaRaw = wKdas[wKey];
            const kdaInfo = parseKdaString(kdaRaw);
            const won = m.winning_team === wTeam;
            const format = m.match_format || '단판';
            const setNum = m.set_number || 1;

            const isWRed = wTeam === 'Red';
            const allyTeamKey: WinningTeam = isWRed ? 'Red' : 'Blue';
            const enemyTeamKey: WinningTeam = isWRed ? 'Blue' : 'Red';

            const allyRoster = isWRed ? m.team_a : m.team_b;
            const allyChamps = isWRed ? m.team_a_champs : m.team_b_champs;
            const enemyRoster = isWRed ? m.team_b : m.team_a;
            const enemyChamps = isWRed ? m.team_b_champs : m.team_a_champs;
            const allyWon = m.winning_team === allyTeamKey;
            const enemyWon = m.winning_team === enemyTeamKey;

            // FIXED: Use correctedScoreMap instead of m.score parsing
            const allyEnemyScoreText = correctedScoreMap.get(m.id) || '1:0';

            // Winner faction formatting for score display
            const isWinnerRed = m.winning_team === 'Red';
            const winnerTeamName = isWinnerRed ? 'RED' : 'BLUE';

            const cardBgClass = won
              ? 'bg-gradient-to-r from-[#0e213b]/95 via-[#0e192c]/95 to-[#0b1321]/95'
              : 'bg-gradient-to-r from-[#2c1218]/95 via-[#1d1016]/95 to-[#140b10]/95';

            const cardBorderClass = won
              ? 'border-[#3b82f6]/40 hover:border-[#3b82f6]/70 shadow-[0_4px_24px_rgba(59,130,246,0.12)]'
              : 'border-[#ef4444]/40 hover:border-[#ef4444]/70 shadow-[0_4px_24px_rgba(239,68,68,0.12)]';

            const accentBarClass = won ? 'bg-[#3b82f6]' : 'bg-[#ef4444]';

            return (
              <div
                key={m.id}
                id={`match-${m.id}`}
                data-match-card="true"
                data-match-id={m.id}
                data-streamers={`${Object.values(m.team_a || {}).join(' ')} ${Object.values(m.team_b || {}).join(' ')}`}
                data-ally-streamers={Object.values(allyRoster || {}).join(' ')}
                data-enemy-streamers={Object.values(enemyRoster || {}).join(' ')}
                className={`relative rounded-xl border ${cardBorderClass} ${cardBgClass} transition-all duration-200 overflow-hidden group`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBarClass}`} />

                <div className="p-3.5 pl-5 md:p-4.5 md:pl-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex xl:flex-col justify-between xl:justify-center items-start gap-1 min-w-[140px] xl:w-[150px] border-b xl:border-b-0 xl:border-r border-white/10 pb-3 xl:pb-0 xl:pr-4 shrink-0">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-bold text-[#8a8aa0] tracking-wider uppercase">
                        {format !== '단판' ? `${format} ${setNum}세트` : '단판 CK'}
                      </div>
                      <div className="text-[11px] text-[#6a6a80] font-medium">{m.date}</div>
                    </div>

                    <div className="space-y-1.5 xl:mt-2">
                      <div
                        className="font-extrabold text-white text-[13px] line-clamp-1 group-hover:text-[#c4b5fd] transition-colors"
                        title={m.ck_name}
                      >
                        {m.ck_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[12px] font-black px-2.5 py-0.5 rounded shadow-sm inline-flex items-center gap-1 ${
                            won
                              ? 'bg-[#2563eb] text-white shadow-[#2563eb]/20'
                              : 'bg-[#dc2626] text-white shadow-[#dc2626]/20'
                          }`}
                        >
                          {won ? '승리' : '패배'}
                        </span>
                        <div className="text-[11px] font-bold text-[#b4b4cb]">
                          스코어 {allyEnemyScoreText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-1 xl:px-4">
                    <div className="relative shrink-0">
                      <ChampionIcon
                        name={champ || ''}
                        size={56}
                        shape="square"
                        className="border-2 border-white/20 shadow-md group-hover:scale-105 transition-transform"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded shadow ${
                          LINE_LABELS[wKey] === 'ADC'
                            ? 'bg-[#8b5cf6] text-white'
                            : 'bg-[#3b82f6] text-white'
                        }`}
                      >
                        {LINE_LABELS[wKey]}
                      </span>
                    </div>

                    <div className="flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-extrabold text-white tracking-tight flex items-center gap-1">
                          <span className="text-[#fbbf24] text-[13px]">👑</span>
                          우리밍_
                        </span>
                        <span className="text-[11px] text-[#8e8ea8] font-medium">
                          ({champ || '챔피언 미지정'} · {LINE_LABELS[wKey]})
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        {kdaInfo && kdaInfo.kills !== undefined ? (
                          <div className="text-[18px] md:text-[20px] font-black tracking-wide text-white">
                            <span>{kdaInfo.kills}</span>
                            <span className="text-[#6a6a80] mx-1 font-medium">/</span>
                            <span className="text-[#f87171]">{kdaInfo.deaths}</span>
                            <span className="text-[#6a6a80] mx-1 font-medium">/</span>
                            <span>{kdaInfo.assists}</span>
                          </div>
                        ) : (
                          <div className="text-[17px] font-black text-white">
                            {kdaRaw && !isKdaEmpty(kdaRaw) ? `KDA ${kdaRaw}` : 'KDA -'}
                          </div>
                        )}

                        {kdaInfo && (
                          <span
                            className={`text-[12px] font-extrabold px-2 py-0.5 rounded-md ${
                              kdaInfo.isPerfect
                                ? 'bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40'
                                : parseFloat(kdaInfo.ratioText) >= 3
                                ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                                : 'bg-white/5 text-[#a0a0b8] border border-white/10'
                            }`}
                          >
                            {kdaInfo.ratioText} {kdaInfo.isPerfect ? '' : '평점'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FIXED: 아군 왼쪽, 적팀 오른쪽 고정 */}
                  <div className="bg-[#07070d]/85 border border-white/10 rounded-[14px] p-2.5 sm:p-3 shrink-0">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex flex-col gap-1 min-w-[130px] sm:min-w-[150px]">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-0.5">
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isWRed
                                ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30'
                                : 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                            }`}
                          >
                            아군팀 ({isWRed ? 'RED' : 'BLUE'})
                          </span>
                          {allyWon && (
                            <span className="text-[10px] font-bold text-[#fbbf24] flex items-center gap-0.5">
                              👑 승리
                            </span>
                          )}
                        </div>
                        {LINE_KEYS.map((k) => {
                          const pName = allyRoster[k];
                          const pChamp = allyChamps[k];
                          const isW = pName === '우리밍_';
                          return (
                            <div
                              key={k}
                              className={`flex items-center gap-1.5 text-[11px] py-0.5 px-1.5 rounded transition ${
                                isW
                                  ? 'bg-[#8b5cf6]/25 border border-[#8b5cf6]/50 text-[#f5d0fe] font-bold shadow-sm'
                                  : 'text-[#c4c4d6]'
                              }`}
                              title={`${LINE_LABELS[k]}: ${pName || '-'} (${pChamp || '-'})`}
                            >
                              <ChampionIcon name={pChamp || ''} size={18} shape="square" />
                              <span className="text-[#6a6a80] text-[10px] font-semibold w-[22px] shrink-0">
                                {LINE_LABELS[k]}
                              </span>
                              <span className="whitespace-nowrap flex items-center gap-1">
                                {isW && <span className="text-[#fbbf24] text-[11px]">👑</span>}
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (pName) handleJumpToStreamer(pName, undefined, 'ally');
                                  }}
                                  className={`cursor-pointer hover:underline hover:text-[#a78bfa] transition-colors ${
                                    isW ? 'text-[#f5d0fe] font-black' : ''
                                  }`}
                                  title={`${pName} 선수와 같은 팀(아군)으로 함께한 경기 영역으로 이동`}
                                >
                                  {pName || '-'}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col gap-1 min-w-[130px] sm:min-w-[150px] pl-2.5 sm:pl-3 border-l border-white/10">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-0.5">
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              !isWRed
                                ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30'
                                : 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                            }`}
                          >
                            적팀 ({!isWRed ? 'RED' : 'BLUE'})
                          </span>
                          {enemyWon && (
                            <span className="text-[10px] font-bold text-[#fbbf24] flex items-center gap-0.5">
                              👑 승리
                            </span>
                          )}
                        </div>
                        {LINE_KEYS.map((k) => {
                          const pName = enemyRoster[k];
                          const pChamp = enemyChamps[k];
                          return (
                            <div
                              key={k}
                              className="flex items-center gap-1.5 text-[11px] py-0.5 px-1.5 rounded text-[#a5a5bb]"
                              title={`${LINE_LABELS[k]}: ${pName || '-'} (${pChamp || '-'})`}
                            >
                              <ChampionIcon name={pChamp || ''} size={18} shape="square" />
                              <span className="text-[#6a6a80] text-[10px] font-semibold w-[22px] shrink-0">
                                {LINE_LABELS[k]}
                              </span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (pName) handleJumpToStreamer(pName, undefined, 'enemy');
                                }}
                                className="whitespace-nowrap cursor-pointer hover:underline hover:text-[#a78bfa] transition-colors"
                                title={`${pName} 선수가 상대팀(적팀)으로 출전한 경기 영역으로 이동`}
                              >
                                {pName || '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex xl:flex-col items-center justify-end gap-1.5 shrink-0 pl-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(m)}
                      className="p-1.5 bg-[#1b1b28] hover:bg-[#2c2c40] text-[#a0a0b8] hover:text-white rounded-lg transition border border-[#2a2a3e]"
                      title="경기 수정"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(m.id)}
                      className="p-1.5 bg-[#2d161a] hover:bg-[#3d1e23] text-[#f87171] hover:text-[#fca5a5] rounded-lg transition border border-[#ef4444]/30"
                      title="경기 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {(m.ban_a.filter(Boolean).length > 0 || m.ban_b.filter(Boolean).length > 0) && (
                  <div className="px-4 py-2 bg-black/50 border-t border-white/5 flex items-center gap-4 text-[11px] text-[#8a8aa0] flex-wrap">
                    <span className="font-extrabold text-[#6a6a80] text-[10px] tracking-wider uppercase">BANS:</span>
                    {m.ban_a.filter(Boolean).length > 0 && (
                      <div className="inline-flex items-center gap-1.5 bg-[#1a1215] border border-[#ef4444]/25 px-2 py-0.5 rounded-full">
                        <span className="text-[#f87171] font-black text-[9px]">RED</span>
                        <div className="inline-flex items-center gap-1">
                          {m.ban_a.filter(Boolean).map((banName, bIdx) => (
                            <div
                              key={bIdx}
                              className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-[#e0d0d0]"
                              title={`RED 밴: ${banName}`}
                            >
                              <ChampionIcon name={banName} size={15} shape="circle" />
                              <span className="whitespace-nowrap">{banName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.ban_b.filter(Boolean).length > 0 && (
                      <div className="inline-flex items-center gap-1.5 bg-[#101724] border border-[#3b82f6]/25 px-2 py-0.5 rounded-full">
                        <span className="text-[#60a5fa] font-black text-[9px]">BLUE</span>
                        <div className="inline-flex items-center gap-1">
                          {m.ban_b.filter(Boolean).map((banName, bIdx) => (
                            <div
                              key={bIdx}
                              className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-[#d0d8e8]"
                              title={`BLUE 밴: ${banName}`}
                            >
                              <ChampionIcon name={banName} size={15} shape="circle" />
                              <span className="whitespace-nowrap">{banName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isChampsModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]">
          <div className="relative z-[10000] w-full max-w-[520px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[16px] text-white">우리밍_ 전체 챔피언 픽 통계</h3>
              <button
                type="button"
                onClick={() => setIsChampsModalOpen(false)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white text-[12px]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {stats.mostPickedChamps.map((item, idx) => (
                <div
                  key={item.champ}
                  className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3.5 py-2 text-[12px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[#6a6a80] text-[11px] w-[16px]">{idx + 1}</span>
                    <ChampionIcon name={item.champ} size={24} shape="square" />
                    <span className="font-semibold text-white">{item.champ}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[#c0c0d0]">
                      {item.picks}픽 {item.wins}승 {item.losses}패{' '}
                      <span className="text-[#8b5cf6] font-bold ml-1">{item.winrate.toFixed(0)}%</span>
                    </div>
                    {item.avgKDA ? (
                      <div className="text-[11px] text-[#a78bfa]">평균 KDA {item.avgKDA}</div>
                    ) : (
                      <div className="text-[10px] text-[#5a5a6a]">KDA 없음</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]">
          <div className="relative z-[10000] w-full max-w-[850px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-[16px] text-white">
                  {editingMatch ? '경기 수정' : '스마트 세트 경기 등록'}
                </h3>
                <span className="text-[10px] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 text-[#c4b5fd] px-2 py-0.5 rounded-full font-semibold">
                  스마트 세트 시스템
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            {isAdmin && (
              <div className="mb-4 inline-flex items-center gap-1.5 text-[11px] bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] px-3 py-1 rounded-full">
                <span>🔒 관리자 인증 완료 (패스코드 입력 불필요)</span>
              </div>
            )}

            {/* 📸 스크린샷 업로드 영역 (UI) 및 AI 비전 자동 입력 (1·2·3단계 구현) */}
            <ScreenshotUploadSection
              redScreenshot={formData.red_screenshot}
              blueScreenshot={formData.blue_screenshot}
              onRedScreenshotChange={(dataUrl) =>
                setFormData((prev) => ({ ...prev, red_screenshot: dataUrl }))
              }
              onBlueScreenshotChange={(dataUrl) =>
                setFormData((prev) => ({ ...prev, blue_screenshot: dataUrl }))
              }
              gameDuration={formData.game_duration}
              onGameDurationChange={(dur) =>
                setFormData((prev) => ({ ...prev, game_duration: dur }))
              }
              teamADetail={formData.team_a_detail}
              teamBDetail={formData.team_b_detail}
              onTeamADetailChange={(detail) =>
                setFormData((prev) => ({ ...prev, team_a_detail: detail }))
              }
              onTeamBDetailChange={(detail) =>
                setFormData((prev) => ({ ...prev, team_b_detail: detail }))
              }
              onApplyAiExtraction={(extracted, notice) => {
                setFormData((prev) => {
                  // [CK 일지] 절대 보존 영역 (수정 금지):
                  // 폼에 이미 입력되어 있는 '스트리머명'과 '챔피언' 값은 어떠한 경우에도 AI가 건드리거나 덮어씌우지 않도록 완전히 락(Lock)
                  // 오직 포지션 순서(위에서 아래로 1~5행: TOP, JGL, MID, ADC, SUP)대로만 통계 수치(KDA, 딜량, 분당골드, 특성, 스펠, 아이템) 1:1 직진 복사
                  const newAChamps = { ...prev.team_a_champs };
                  const newBChamps = { ...prev.team_b_champs };
                  const newAKda = { ...prev.team_a_kda };
                  const newBKda = { ...prev.team_b_kda };

                  const newTeamAPlayers: Record<LineKey, PlayerGameDetail> = {} as any;
                  const newTeamBPlayers: Record<LineKey, PlayerGameDetail> = {} as any;

                  for (const l of LINE_KEYS) {
                    // 1. 기존 스트리머명 및 기존 챔피언 값 보존 (락 처리)
                    const lockedStreamerA = prev.team_a[l];
                    const lockedChampA = prev.team_a_champs[l];
                    const extractedA = extracted.red_team?.players?.[l];
                    
                    // 챔피언은 기존 폼에 값이 비어있을 때만 채우고 이미 입력된 값은 절대 덮어쓰지 않음
                    if (!lockedChampA && extractedA?.champion) {
                      newAChamps[l] = extractedA.champion;
                    }
                    if (extractedA?.kda) {
                      newAKda[l] = extractedA.kda;
                    }

                    if (extractedA) {
                      newTeamAPlayers[l] = {
                        ...extractedA,
                        player: lockedStreamerA || extractedA.player, // 기존 스트리머명 락(Lock)
                        champion: lockedChampA || extractedA.champion, // 기존 챔피언 락(Lock)
                        line: l,
                      };
                    } else if (prev.team_a_detail?.players?.[l]) {
                      newTeamAPlayers[l] = {
                        ...prev.team_a_detail.players[l],
                        player: lockedStreamerA || prev.team_a_detail.players[l].player,
                        champion: lockedChampA || prev.team_a_detail.players[l].champion,
                      };
                    }

                    // 2. 블루팀 기존 스트리머명 및 챔피언 값 보존 (락 처리)
                    const lockedStreamerB = prev.team_b[l];
                    const lockedChampB = prev.team_b_champs[l];
                    const extractedB = extracted.blue_team?.players?.[l];

                    // 챔피언은 기존 폼에 값이 비어있을 때만 채우고 이미 입력된 값은 절대 덮어쓰지 않음
                    if (!lockedChampB && extractedB?.champion) {
                      newBChamps[l] = extractedB.champion;
                    }
                    if (extractedB?.kda) {
                      newBKda[l] = extractedB.kda;
                    }

                    if (extractedB) {
                      newTeamBPlayers[l] = {
                        ...extractedB,
                        player: lockedStreamerB || extractedB.player, // 기존 스트리머명 락(Lock)
                        champion: lockedChampB || extractedB.champion, // 기존 챔피언 락(Lock)
                        line: l,
                      };
                    } else if (prev.team_b_detail?.players?.[l]) {
                      newTeamBPlayers[l] = {
                        ...prev.team_b_detail.players[l],
                        player: lockedStreamerB || prev.team_b_detail.players[l].player,
                        champion: lockedChampB || prev.team_b_detail.players[l].champion,
                      };
                    }
                  }

                  const newTeamADetail: TeamGameDetail = {
                    team_kda: extracted.red_team?.team_kda || prev.team_a_detail?.team_kda || '',
                    global_gold: extracted.red_team?.global_gold || prev.team_a_detail?.global_gold || '',
                    players: newTeamAPlayers,
                  };

                  const newTeamBDetail: TeamGameDetail = {
                    team_kda: extracted.blue_team?.team_kda || prev.team_b_detail?.team_kda || '',
                    global_gold: extracted.blue_team?.global_gold || prev.team_b_detail?.global_gold || '',
                    players: newTeamBPlayers,
                  };

                  return {
                    ...prev,
                    // prev.team_a 및 prev.team_b(스트리머명)는 변경 없이 그대로 완전 보존
                    team_a_champs: newAChamps,
                    team_b_champs: newBChamps,
                    team_a_kda: newAKda,
                    team_b_kda: newBKda,
                    game_duration: extracted.game_duration || prev.game_duration,
                    winning_team: extracted.winning_team || prev.winning_team,
                    team_a_detail: newTeamADetail,
                    team_b_detail: newTeamBDetail,
                    extracted_data: {
                      ...extracted,
                      red_team: newTeamADetail,
                      blue_team: newTeamBDetail,
                    },
                  };
                });
                if (notice) {
                  onToast(notice);
                }
              }}
              onToast={onToast}
              currentTeamA={formData.team_a}
              currentTeamB={formData.team_b}
            />

            <div className="mb-4 p-3 bg-[#0a0a12] border border-[#1e1e2a] rounded-[14px] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadPreviousSetRoster}
                  className="h-[32px] px-3.5 bg-[#8b5cf6]/15 hover:bg-[#8b5cf6]/25 border border-[#8b5cf6]/40 text-[#c4b5fd] rounded-full text-[11px] font-bold transition flex items-center gap-1.5"
                >
                  <Copy size={13} className="text-[#a78bfa]" />
                  <span>⚡ 이전 세트 10인 로스터 불러오기</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwapTeams}
                  className="h-[32px] px-3.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-[#c0c0d0] rounded-full text-[11px] font-bold transition flex items-center gap-1.5"
                >
                  <ArrowLeftRight size={13} className="text-[#38bdf8]" />
                  <span>🔄 Red ↔ Blue 팀 스왑</span>
                </button>
              </div>

              <div className="text-[11px] text-[#8a8aa0]">중복 방지 유효성 검사 활성</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">경기 일자</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const calcResult = calculateScoreForSetInSeries({
                      date: newDate,
                      ck_name: formData.ck_name,
                      set_number: formData.set_number,
                      winning_team: formData.winning_team,
                      team_a: formData.team_a,
                      team_b: formData.team_b,
                      excludeMatchId: formData.id,
                      allMatches: matches,
                    });
                    setSeriesWinners(calcResult.priorWinners);
                    setSeriesHistory(calcResult.priorHistory);
                    setFormData((prev) => ({ ...prev, date: newDate, score: calcResult.score }));
                  }}
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">CK 명칭</label>
                <input
                  value={formData.ck_name}
                  onChange={(e) => {
                    const newCk = e.target.value;
                    const calcResult = calculateScoreForSetInSeries({
                      date: formData.date,
                      ck_name: newCk,
                      set_number: formData.set_number,
                      winning_team: formData.winning_team,
                      team_a: formData.team_a,
                      team_b: formData.team_b,
                      excludeMatchId: formData.id,
                      allMatches: matches,
                    });
                    setSeriesWinners(calcResult.priorWinners);
                    setSeriesHistory(calcResult.priorHistory);
                    setFormData((prev) => ({ ...prev, ck_name: newCk, score: calcResult.score }));
                  }}
                  placeholder="예: 치지직 심야 드래프트 CK"
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">경기 방식</label>
                <select
                  value={formData.match_format}
                  onChange={(e) => {
                    const fmt = e.target.value as MatchFormat;
                    setFormData((prev) => ({
                      ...prev,
                      match_format: fmt,
                      set_number: fmt === '단판' ? 1 : prev.set_number,
                    }));
                  }}
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50"
                >
                  <option value="단판">단판</option>
                  <option value="3판2선승">3판2선승</option>
                  <option value="5판3선승">5판3선승</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">세트 번호</label>
                <select
                  value={formData.set_number}
                  onChange={(e) => {
                    const newSetNum = parseInt(e.target.value, 10) || 1;
                    const calcResult = calculateScoreForSetInSeries({
                      date: formData.date,
                      ck_name: formData.ck_name,
                      set_number: newSetNum,
                      winning_team: formData.winning_team,
                      team_a: formData.team_a,
                      team_b: formData.team_b,
                      excludeMatchId: formData.id,
                      allMatches: matches,
                    });
                    setSeriesWinners(calcResult.priorWinners);
                    setSeriesHistory(calcResult.priorHistory);
                    setFormData((prev) => ({
                      ...prev,
                      set_number: newSetNum,
                      score: calcResult.score,
                    }));
                  }}
                  disabled={formData.match_format === '단판'}
                  className={`w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50 ${
                    formData.match_format === '단판' ? 'opacity-50' : ''
                  }`}
                >
                  {Array.from(
                    {
                      length:
                        formData.match_format === '5판3선승'
                          ? 5
                          : formData.match_format === '3판2선승'
                          ? 3
                          : 1,
                    },
                    (_, i) => i + 1
                  ).map((num) => (
                    <option key={num} value={num}>
                      {num}세트
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4 bg-[#0a0a10] border border-[#1e1e2a] rounded-[16px] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="text-[12px] font-bold text-white flex items-center gap-1.5">
                  <Trophy size={14} className="text-[#fbbf24]" />
                  <span>승리 팀 선택 & 세트 스코어 자동 계산</span>
                </div>
                {seriesHistory.length > 0 && (
                  <div className="text-[11px] text-[#c0c0d0] bg-[#1e1e2a] px-3 py-1 rounded-full border border-[#2a2a3a]">
                    이전 세트: {seriesHistory.map((h) => h.label).join(' → ')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => handleSelectWinner('Red')}
                  className={`h-[42px] rounded-[12px] font-bold text-[13px] border transition flex items-center justify-center gap-2 ${
                    formData.winning_team === 'Red'
                      ? 'bg-[#ef4444] text-white border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                      : 'bg-[#ef4444]/10 text-[#fca5a5] border-[#ef4444]/30 hover:bg-[#ef4444]/20'
                  }`}
                >
                  <span>🔴 RED팀 승리</span>
                  {formData.winning_team === 'Red' && (
                    <span className="text-[11px] bg-black/30 px-2 py-0.5 rounded-full">선택됨</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectWinner('Blue')}
                  className={`h-[42px] rounded-[12px] font-bold text-[13px] border transition flex items-center justify-center gap-2 ${
                    formData.winning_team === 'Blue'
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.35)]'
                      : 'bg-[#3b82f6]/10 text-[#93c5fd] border-[#3b82f6]/30 hover:bg-[#3b82f6]/20'
                  }`}
                >
                  <span>🔵 BLUE팀 승리</span>
                  {formData.winning_team === 'Blue' && (
                    <span className="text-[11px] bg-black/30 px-2 py-0.5 rounded-full">선택됨</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-[11px] font-semibold text-[#a0a0b8] whitespace-nowrap">
                  누적 세트 스코어:
                </label>
                <input
                  value={formData.score}
                  onChange={(e) => setFormData((prev) => ({ ...prev, score: e.target.value }))}
                  placeholder="예: 1:0, 2:1"
                  className="h-[34px] w-[110px] text-center font-bold font-mono bg-[#12121a] border border-[#2a2a3a] rounded-full px-3 text-[13px] text-white focus:outline-none focus:border-[#8b5cf6]"
                />
                <span className="text-[10px] text-[#6a6a80]">(승리 버튼 클릭 시 자동 계산 / 수동 수정 가능)</span>
              </div>
            </div>

            <div className="mb-4 bg-[#0a0a10] border border-[#222232] rounded-[14px] p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#a78bfa]" />
                  <span>우리밍_ 배치 라인:</span>
                </span>
                {woorimingLocation ? (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      woorimingLocation.team === 'team_a'
                        ? 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                        : 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                    }`}
                  >
                    {woorimingLocation.team === 'team_a' ? '🔴 Red팀' : '🔵 Blue팀'} {LINE_LABELS[woorimingLocation.line]} ({woorimingLocation.line.toUpperCase()})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[#ef4444] bg-[#ef4444]/15 px-2.5 py-0.5 rounded-full border border-[#ef4444]/30">
                    ⚠ 아직 미배치됨 (전적 산출 필수)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-[#8a8aa0] text-[10px] mr-1">원클릭 배치:</span>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_a', 'adc')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_a' && woorimingLocation?.line === 'adc'
                      ? 'bg-[#ef4444] text-white border-[#ef4444]'
                      : 'bg-[#ef4444]/10 text-[#fca5a5] border-[#ef4444]/30 hover:bg-[#ef4444]/25'
                  }`}
                >
                  🔴 Red 원딜(ADC)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_a', 'sup')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_a' && woorimingLocation?.line === 'sup'
                      ? 'bg-[#ef4444] text-white border-[#ef4444]'
                      : 'bg-[#ef4444]/10 text-[#fca5a5] border-[#ef4444]/30 hover:bg-[#ef4444]/25'
                  }`}
                >
                  🔴 Red 서폿(SUP)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_b', 'adc')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_b' && woorimingLocation?.line === 'adc'
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                      : 'bg-[#3b82f6]/10 text-[#93c5fd] border-[#3b82f6]/30 hover:bg-[#3b82f6]/25'
                  }`}
                >
                  🔵 Blue 원딜(ADC)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_b', 'sup')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_b' && woorimingLocation?.line === 'sup'
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                      : 'bg-[#3b82f6]/10 text-[#93c5fd] border-[#3b82f6]/30 hover:bg-[#3b82f6]/25'
                  }`}
                >
                  🔵 Blue 서폿(SUP)
                </button>
              </div>
            </div>

            {(['team_a', 'team_b'] as const).map((teamKey) => {
              const isRed = teamKey === 'team_a';
              const champsKey = `${teamKey}_champs` as const;
              const kdaKey = `${teamKey}_kda` as const;
              const banKey = isRed ? 'ban_a' : 'ban_b';

              return (
                <div
                  key={teamKey}
                  className="mb-4 bg-[#08080c] border rounded-[14px] p-4"
                  style={{
                    borderColor: isRed ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)',
                  }}
                >
                  <div
                    className="text-[12px] font-bold mb-3 flex items-center justify-between"
                    style={{ color: isRed ? '#ef4444' : '#3b82f6' }}
                  >
                    <span>
                      {isRed ? '🔴 Red팀' : '🔵 Blue팀'} 로스터 (플레이어 / 챔피언 / KDA)
                    </span>
                    <span className="text-[10px] text-[#8a8aa0] font-normal">
                      우리밍_은 '밍' 버튼으로 빠른 지정 가능
                    </span>
                  </div>

                  <div className="space-y-2">
                    {LINE_KEYS.map((lineKey) => {
                      const playerName = formData[teamKey][lineKey] || '';
                      const isW = playerName === '우리밍_';
                      const isPlayerDup = playerName.trim() !== '' && duplicatePlayers.has(playerName.trim());
                      const champName = formData[champsKey][lineKey] || '';
                      const normChamp = normalizeChampionName(champName);
                      const isChampDup = normChamp !== '' && duplicateChamps.has(normChamp);

                      return (
                        <div key={lineKey} className="flex flex-wrap gap-2 items-center">
                          <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0] tracking-widest">
                            {LINE_LABELS[lineKey]}
                          </span>

                          <div className="relative">
                            <input
                              value={playerName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((prev) => ({
                                  ...prev,
                                  [teamKey]: { ...prev[teamKey], [lineKey]: val },
                                }));
                                setFormError('');
                              }}
                              placeholder="플레이어"
                              list="players-datalist"
                              className={`h-[32px] w-[115px] bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none transition ${
                                isPlayerDup
                                  ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5] ring-1 ring-[#ef4444]/50 font-bold'
                                  : isW
                                  ? 'border-[#8b5cf6] font-bold text-[#a78bfa]'
                                  : 'border-[#1e1e2a]'
                              }`}
                            />
                            {isPlayerDup && (
                              <span
                                className="absolute -top-1.5 -right-1 text-[8px] bg-[#ef4444] text-white px-1 rounded-full font-black"
                                title="동일한 선수가 중복되었습니다"
                              >
                                중복
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              value={champName}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  [champsKey]: { ...prev[champsKey], [lineKey]: e.target.value },
                                }))
                              }
                              placeholder="챔피언"
                              list="champs-datalist"
                              className={`h-[32px] w-[115px] bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none transition ${
                                isChampDup
                                  ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5] ring-1 ring-[#ef4444]/50 font-bold'
                                  : isW
                                  ? 'border-[#8b5cf6]/50'
                                  : 'border-[#1e1e2a]'
                              }`}
                            />
                            {isChampDup && (
                              <span
                                className="absolute -top-1.5 -right-1 text-[8px] bg-[#ef4444] text-white px-1 rounded-full font-black"
                                title="동일한 챔피언이 중복되었습니다"
                              >
                                중복
                              </span>
                            )}
                          </div>

                          <input
                            value={formData[kdaKey][lineKey]}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                [kdaKey]: { ...prev[kdaKey], [lineKey]: e.target.value },
                              }))
                            }
                            placeholder={isW ? 'K/D/A (우리밍_)' : 'K/D/A (선택)'}
                            className={`h-[32px] w-[90px] bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none ${
                              isW
                                ? 'border-[#8b5cf6] bg-[#8b5cf6]/10 font-bold'
                                : 'border-[#1e1e2a] opacity-60'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleSetWooriming(teamKey, lineKey)}
                            className={`h-[28px] px-2.5 border rounded-full text-[10px] font-bold transition ${
                              isW
                                ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                                : 'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/30 text-[#a78bfa]'
                            }`}
                          >
                            밍
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-[#1e1e2a] pt-3">
                    <span className="text-[11px] text-[#6a6a80] mr-2 font-medium">밴 (5개):</span>
                    {formData[banKey].map((banItem, bIdx) => (
                      <input
                        key={bIdx}
                        value={banItem}
                        onChange={(e) => {
                          const updated = [...formData[banKey]];
                          updated[bIdx] = e.target.value;
                          setFormData((prev) => ({ ...prev, [banKey]: updated }));
                        }}
                        placeholder={`밴 ${bIdx + 1}`}
                        list="champs-datalist"
                        className="h-[28px] w-[88px] bg-[#12121a] border border-[#1e1e2a] rounded-full px-2.5 text-[11px] text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#8b5cf6]/40"
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {(duplicatePlayers.size > 0 || duplicateChamps.size > 0) && (
              <div className="mb-4 p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-[12px] text-[#ef4444] text-[12px] flex items-center gap-2 animate-[fadeIn_0.15s]">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold">
                  동일한 선수 또는 챔피언이 중복 선택되었습니다.
                  {duplicatePlayers.size > 0 && ` [선수 중복: ${Array.from(duplicatePlayers).join(', ')}]`}
                  {duplicateChamps.size > 0 && ` [챔피언 중복: ${Array.from(duplicateChamps).join(', ')}]`}
                </span>
              </div>
            )}

            {formError && (
              <div className="mt-4 p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-[12px] text-[#ef4444] text-[12px] flex items-center gap-2 animate-[fadeIn_0.15s]">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3 items-center justify-between border-t border-[#1e1e2a] pt-4">
              {!isAdmin ? (
                <div className="flex items-center gap-2 flex-1 max-w-[340px]">
                  <input
                    type="password"
                    value={formPasscode}
                    onChange={(e) => {
                      setFormPasscode(e.target.value);
                      setFormError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMatch();
                    }}
                    placeholder="패스코드"
                    className="h-[36px] flex-1 bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-[#8a8aa0] cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={persistAdminInForm}
                      onChange={(e) => setPersistAdminInForm(e.target.checked)}
                      className="accent-[#8b5cf6]"
                    />
                    <span>24시간 유지</span>
                  </label>
                </div>
              ) : (
                <div className="text-[12px] text-[#10b981] font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>관리자 모드 활성화됨 (패스코드 입력 불필요)</span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-[36px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text-[12px] font-medium transition"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndNextSet}
                  className="h-[36px] px-4 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white rounded-full text-[12px] font-bold shadow transition flex items-center gap-1.5"
                >
                  <FastForward size={14} />
                  <span>저장하고 다음 세트 작성 (⚡)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatch}
                  className="h-[36px] px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold shadow transition flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>저장 완료</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOpponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w-[640px] bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-6 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-[#1e1e2a]">
              <div className="flex items-center gap-3">
                <StreamerAvatar
                  name={selectedOpponent.name}
                  size={44}
                  shape="circle"
                  className="border-2 border-[#8b5cf6]/50 shadow-md shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[17px] text-white">{selectedOpponent.name}</h3>
                    <span className="text-[11px] text-[#a78bfa] bg-[#8b5cf6]/15 px-2.5 py-0.5 rounded-full font-semibold border border-[#8b5cf6]/30">
                      주 맞라인: {selectedOpponent.primaryLine}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#8a8aa0] mt-0.5">
                    우리밍_ 상대 전적: <span className="text-white font-bold">{selectedOpponent.games}전 {selectedOpponent.wins}승 {selectedOpponent.losses}패</span> (승률 <span className="text-[#8b5cf6] font-extrabold">{selectedOpponent.winrate.toFixed(0)}%</span>)
                  </p>
                </div>
              </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const oppName = selectedOpponent.name;
                      setSelectedOpponent(null);
                      handleJumpToStreamer(oppName, undefined, 'enemy');
                    }}
                    className="h-[30px] px-3 bg-[#8b5cf6]/20 hover:bg-[#8b5cf6] text-[#c4b5fd] hover:text-white border border-[#8b5cf6]/40 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition"
                  >
                    <Zap size={12} />
                    <span>일지에서 경기 보기 ⚡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOpponent(null)}
                    className="w-[32px] h-[32px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-[#a0a0b8] hover:text-white transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

            <div className="overflow-y-auto my-4 space-y-2.5 pr-1 max-h-[480px]">
              {selectedOpponent.matches.map((m, idx) => (
                <div
                  key={`${m.matchId}_${idx}`}
                  className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#8b5cf6]/30 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-[#8a8aa0]">
                      <span className="text-[#c0c0d0] font-medium">{m.date}</span>
                      <span>•</span>
                      <span className="text-white font-semibold truncate max-w-[220px]">{m.ckName}</span>
                      <span>•</span>
                      <span className="text-[#a78bfa] font-bold">{m.setNumber}세트</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[12px] flex-wrap">
                      <div className="flex items-center gap-1.5 bg-[#12121c] border border-[#222234] px-2.5 py-1 rounded-lg">
                        <ChampionIcon name={m.myChamp} size={20} shape="square" />
                        <span className="text-white font-bold text-[11px]">우리밍_</span>
                        <span className="text-[#8a8aa0] text-[10px]">({m.myChamp || '미지정'})</span>
                        {m.myKda && <span className="text-[#a78bfa] text-[10px] ml-1 font-mono">{m.myKda}</span>}
                      </div>

                      <span className="text-[#6a6a80] font-black text-[11px]">VS</span>

                      <div className="flex items-center gap-1.5 bg-[#12121c] border border-[#222234] px-2.5 py-1 rounded-lg">
                        <ChampionIcon name={m.opponentChamp} size={20} shape="square" />
                        <span className="text-white font-bold text-[11px]">{selectedOpponent.name}</span>
                        <span className="text-[#8a8aa0] text-[10px]">({m.opponentChamp || '미지정'})</span>
                        {m.opponentKda && <span className="text-[#8a8aa0] text-[10px] ml-1 font-mono">{m.opponentKda}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0">
                    <span
                      className={`text-[11px] font-black px-3 py-1 rounded-full border ${
                        m.won
                          ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                          : 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                      }`}
                    >
                      {m.won ? '우리밍_ 승리 👑' : '우리밍_ 패배'}
                    </span>
                    {m.score && (
                      <span className="text-[10px] text-[#8a8aa0] mt-1 font-mono">
                        세트 스코어 {correctedScoreMap.get(m.matchId) || m.score}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const matchId = m.matchId;
                        const oppName = selectedOpponent.name;
                        setSelectedOpponent(null);
                        handleJumpToStreamer(oppName, matchId, 'enemy');
                      }}
                      className="mt-1.5 px-2.5 py-1 bg-[#1e1e30] hover:bg-[#8b5cf6] text-[#c0c0d8] hover:text-white rounded-md text-[10px] font-bold border border-[#2a2a44] transition flex items-center gap-1"
                      title="CK 일지의 해당 경기 카드로 스크롤 이동"
                    >
                      <span>이 세트로 이동</span>
                      <ArrowDownCircle size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#1e1e2a] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOpponent(null)}
                className="h-[34px] px-5 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-full text-[12px] font-medium transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]">
          <div className="relative z-[10000] w-full max-w-[360px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-[14px] text-white flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-[#ef4444]" />
                <span>경기 삭제 확인</span>
              </h4>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            {isAdmin ? (
              <p className="text-[12px] text-[#8a8aa0] mb-4 leading-relaxed">
                관리자 모드가 활성화되어 있습니다. 선택한 경기를 삭제하시겠습니까?
              </p>
            ) : (
              <>
                <p className="text-[12px] text-[#8a8aa0] mb-4">
                  경기를 삭제하려면 관리자 패스코드를 입력해주세요.
                </p>
                <input
                  type="password"
                  value={deletePasscode}
                  onChange={(e) => {
                    setDeletePasscode(e.target.value);
                    setDeleteError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDelete();
                  }}
                  placeholder="패스코드"
                  className="w-full h-[38px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white focus:outline-none focus:border-[#ef4444]/50 mb-2"
                  autoFocus
                />
                {deleteError && (
                  <div className="text-[11px] text-[#ff6b6b] mb-3">{deleteError}</div>
                )}
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 h-[36px] bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text-[12px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h-[36px] bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-full text-[12px] font-bold"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};