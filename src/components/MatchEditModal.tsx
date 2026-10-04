import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Match,
  LineKey,
  LINE_KEYS,
  LINE_LABELS,
  MatchFormat,
} from '../types';
import { normalizeChampionName } from '../lib/champions';
import { isWooriming } from '../lib/stats';
import { calculateScoreForSetInSeries } from '../lib/seriesScores';
import {
  X,
  Copy,
  ArrowLeftRight,
  Trophy,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FastForward,
  Save,
} from 'lucide-react';

interface MatchEditModalProps {
  isOpen: boolean;
  editingMatch: Match | null;
  allMatches: Match[];
  isAdmin: boolean;
  onClose: () => void;
  onAddMatch: (m: Match) => void;
  onUpdateMatch: (m: Match) => void;
  onAdminLoginSuccess: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
  allChampions: string[];
}

const PASSCODE = '0928';

export const MatchEditModal: React.FC<MatchEditModalProps> = ({
  isOpen,
  editingMatch,
  allMatches,
  isAdmin,
  onClose,
  onAddMatch,
  onUpdateMatch,
  onAdminLoginSuccess,
  onToast,
}) => {
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

  const [seriesWinners, setSeriesWinners] = useState<('Red' | 'Blue')[]>([]);
  const [seriesHistory, setSeriesHistory] = useState<{ set: number; won: boolean; label: string }[]>([]);
  const [formPasscode, setFormPasscode] = useState('');
  const [persistAdminInForm, setPersistAdminInForm] = useState(true);
  const [formError, setFormError] = useState('');
  const [activeEditingMatch, setActiveEditingMatch] = useState<Match | null>(editingMatch);

  // Local state isolation: Do not reset form data during typing or parent re-renders
  const isInitializedRef = useRef(false);
  const editingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      editingIdRef.current = null;
      setActiveEditingMatch(null);
      return;
    }

    if (isInitializedRef.current) {
      // Already initialized for this modal session, strictly avoid wiping user inputs
      return;
    }

    isInitializedRef.current = true;
    editingIdRef.current = editingMatch ? editingMatch.id : 'new';
    setActiveEditingMatch(editingMatch);

    if (editingMatch) {
      const calcResult = calculateScoreForSetInSeries({
        date: editingMatch.date,
        ck_name: editingMatch.ck_name,
        set_number: editingMatch.set_number,
        winning_team: editingMatch.winning_team,
        team_a: editingMatch.team_a,
        team_b: editingMatch.team_b,
        excludeMatchId: editingMatch.id,
        allMatches,
      });

      setFormData({
        ...editingMatch,
        score: calcResult.score,
        team_a: { ...editingMatch.team_a },
        team_b: { ...editingMatch.team_b },
        team_a_champs: { ...editingMatch.team_a_champs },
        team_b_champs: { ...editingMatch.team_b_champs },
        ban_a: [...editingMatch.ban_a],
        ban_b: [...editingMatch.ban_b],
        team_a_kda: { ...editingMatch.team_a_kda },
        team_b_kda: { ...editingMatch.team_b_kda },
        game_duration: editingMatch.game_duration || '31:40',
        team_a_detail: editingMatch.team_a_detail,
        team_b_detail: editingMatch.team_b_detail,
        red_screenshot: editingMatch.red_screenshot,
        blue_screenshot: editingMatch.blue_screenshot,
        extracted_data: editingMatch.extracted_data,
      });
      setSeriesWinners(calcResult.priorWinners);
      setSeriesHistory(calcResult.priorHistory);
    } else {
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
        allMatches,
      });

      setFormData({
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
    }
    setFormPasscode('');
    setFormError('');
  }, [isOpen, editingMatch, allMatches]);

  const woorimingLocation = useMemo(() => {
    for (const l of LINE_KEYS) {
      if (isWooriming(formData.team_a[l])) return { team: 'team_a' as const, line: l };
      if (isWooriming(formData.team_b[l])) return { team: 'team_b' as const, line: l };
    }
    return null;
  }, [formData.team_a, formData.team_b]);

  const duplicatePlayers = useMemo(() => {
    const all = [
      ...(Object.values(formData.team_a) as string[]),
      ...(Object.values(formData.team_b) as string[]),
    ];
    const counts = new Map<string, number>();
    for (const p of all) {
      const trimmed = (p || '').trim();
      if (trimmed) {
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }
    }
    const dups = new Set<string>();
    for (const [p, c] of counts.entries()) {
      if (c > 1) dups.add(p);
    }
    return dups;
  }, [formData.team_a, formData.team_b]);

  const duplicateChamps = useMemo(() => {
    const all = [
      ...(Object.values(formData.team_a_champs) as string[]),
      ...(Object.values(formData.team_b_champs) as string[]),
    ];
    const counts = new Map<string, number>();
    for (const c of all) {
      const norm = normalizeChampionName(c);
      if (norm) {
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
    }
    const dups = new Set<string>();
    for (const [c, count] of counts.entries()) {
      if (count > 1) dups.add(c);
    }
    return dups;
  }, [formData.team_a_champs, formData.team_b_champs]);

  const handleSetWooriming = (targetTeam: 'team_a' | 'team_b', targetLine: LineKey) => {
    setFormData((prev) => {
      const newA = { ...prev.team_a };
      const newB = { ...prev.team_b };

      for (const l of LINE_KEYS) {
        if (isWooriming(newA[l])) newA[l] = '';
        if (isWooriming(newB[l])) newB[l] = '';
      }

      if (targetTeam === 'team_a') {
        newA[targetLine] = '우리밍_';
      } else {
        newB[targetLine] = '우리밍_';
      }

      const calcResult = calculateScoreForSetInSeries({
        date: prev.date,
        ck_name: prev.ck_name,
        set_number: prev.set_number,
        winning_team: prev.winning_team,
        team_a: newA,
        team_b: newB,
        excludeMatchId: prev.id,
        allMatches,
      });
      setSeriesWinners(calcResult.priorWinners);
      setSeriesHistory(calcResult.priorHistory);

      return {
        ...prev,
        team_a: newA,
        team_b: newB,
        score: calcResult.score,
      };
    });
    setFormError('');
  };

  const handleSelectWinner = (winner: 'Red' | 'Blue') => {
    const calcResult = calculateScoreForSetInSeries({
      date: formData.date,
      ck_name: formData.ck_name,
      set_number: formData.set_number,
      winning_team: winner,
      team_a: formData.team_a,
      team_b: formData.team_b,
      excludeMatchId: formData.id,
      allMatches,
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
    if (allMatches.length === 0) {
      onToast('불러올 이전 경기 데이터가 없습니다.');
      return;
    }
    const sorted = [...allMatches].sort((a, b) => {
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
      allMatches,
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
      const nextWinner: 'Red' | 'Blue' = prev.winning_team === 'Red' ? 'Blue' : 'Red';

      const calcResult = calculateScoreForSetInSeries({
        date: prev.date,
        ck_name: prev.ck_name,
        set_number: prev.set_number,
        winning_team: nextWinner,
        team_a: nextA,
        team_b: nextB,
        excludeMatchId: prev.id,
        allMatches,
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
        winning_team: nextWinner,
        score: calcResult.score,
      };
    });
    onToast('Red ↔ Blue 팀 로스터를 맞교환했습니다.');
  };

  const validateMatchForm = (matchData: Match): { isValid: boolean; errorMsg: string } => {
    if (!matchData.date) return { isValid: false, errorMsg: '경기 일자를 선택해주세요.' };
    const cleanCkName = (matchData.ck_name || '').trim();
    if (!cleanCkName) return { isValid: false, errorMsg: 'CK 명칭(대회명)을 입력해주세요.' };

    if (!isAdmin) {
      const cleanPass = formPasscode.trim().toLowerCase();
      if (!cleanPass) return { isValid: false, errorMsg: '관리자 패스코드를 입력해주세요.' };
      if (cleanPass !== PASSCODE.toLowerCase()) return { isValid: false, errorMsg: '패스코드가 올바르지 않습니다.' };
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

    if (duplicatePlayers.size > 0 || duplicateChamps.size > 0) {
      const parts: string[] = [];
      if (duplicatePlayers.size > 0) parts.push(`중복 선수: ${Array.from(duplicatePlayers).join(', ')}`);
      if (duplicateChamps.size > 0) parts.push(`중복 챔피언: ${Array.from(duplicateChamps).join(', ')}`);
      return {
        isValid: false,
        errorMsg: `동일한 선수 또는 챔피언이 중복 선택되었습니다. (${parts.join(' / ')})`,
      };
    }

    return { isValid: true, errorMsg: '' };
  };

  const buildMatchToSave = (currentData: Match): Match => {
    const cleanCkName = (currentData.ck_name || '').trim();

    // Sanitize player names in detail
    let sanitizedTeamADetail = currentData.team_a_detail;
    if (sanitizedTeamADetail?.players) {
      const updatedPlayers = { ...sanitizedTeamADetail.players };
      for (const lk of LINE_KEYS) {
        if (updatedPlayers[lk]) {
          updatedPlayers[lk] = {
            ...updatedPlayers[lk],
            player: currentData.team_a[lk] || updatedPlayers[lk].player,
            line: lk,
          };
        }
      }
      sanitizedTeamADetail = { ...sanitizedTeamADetail, players: updatedPlayers };
    }

    let sanitizedTeamBDetail = currentData.team_b_detail;
    if (sanitizedTeamBDetail?.players) {
      const updatedPlayers = { ...sanitizedTeamBDetail.players };
      for (const lk of LINE_KEYS) {
        if (updatedPlayers[lk]) {
          updatedPlayers[lk] = {
            ...updatedPlayers[lk],
            player: currentData.team_b[lk] || updatedPlayers[lk].player,
            line: lk,
          };
        }
      }
      sanitizedTeamBDetail = { ...sanitizedTeamBDetail, players: updatedPlayers };
    }

    return {
      ...currentData,
      ck_name: cleanCkName,
      team_a_detail: sanitizedTeamADetail,
      team_b_detail: sanitizedTeamBDetail,
    };
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

    const matchToSave = buildMatchToSave(formData);

    try {
      if (activeEditingMatch) {
        onUpdateMatch(matchToSave);
        onToast('경기가 성공적으로 수정되었습니다.');
      } else {
        onAddMatch(matchToSave);
        onToast('새로운 경기가 등록되었습니다.');
      }
      onClose();
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

    const matchToSave = buildMatchToSave(formData);

    try {
      if (activeEditingMatch) {
        onUpdateMatch(matchToSave);
      } else {
        onAddMatch(matchToSave);
      }
    } catch (err) {
      console.error('Save match error', err);
      setFormError('경기 저장 중 예기치 않은 오류가 발생했습니다.');
      onToast('저장 실패');
      return;
    }

    const currentSetNum = Number(formData.set_number || 1);
    const nextSet = currentSetNum + 1;

    const nextMatchFormat: MatchFormat =
      formData.match_format === '단판'
        ? '3판2선승'
        : formData.match_format === '3판2선승' && nextSet > 3
        ? '5판3선승'
        : formData.match_format;

    // Immediately incorporate current saved set for next set series calculation
    const updatedMatches = activeEditingMatch
      ? allMatches.map((m) => (String(m.id) === String(matchToSave.id) ? matchToSave : m))
      : [matchToSave, ...allMatches.filter((m) => String(m.id) !== String(matchToSave.id))];

    const calcResult = calculateScoreForSetInSeries({
      date: formData.date,
      ck_name: matchToSave.ck_name,
      set_number: nextSet,
      winning_team: 'Red',
      team_a: formData.team_a,
      team_b: formData.team_b,
      allMatches: updatedMatches,
    });

    setSeriesWinners(calcResult.priorWinners);
    setSeriesHistory(calcResult.priorHistory);

    // Any subsequent save from now on is registered as a new match
    setActiveEditingMatch(null);

    const nextId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Retain streamer nicknames and team roster; reset champs, kda, bans, screenshots
    setFormData((prev) => ({
      id: nextId,
      date: prev.date,
      ck_name: matchToSave.ck_name,
      match_format: nextMatchFormat,
      set_number: nextSet,
      // Retain 10 streamer nicknames and team roster
      team_a: { ...prev.team_a },
      team_b: { ...prev.team_b },
      // Reset champions, KDA, bans, and screenshots for the new set
      team_a_champs: { ...emptyRoster },
      team_b_champs: { ...emptyRoster },
      team_a_kda: { ...emptyRoster },
      team_b_kda: { ...emptyRoster },
      ban_a: ['', '', '', '', ''],
      ban_b: ['', '', '', '', ''],
      game_duration: '31:40',
      winning_team: 'Red',
      score: calcResult.score,
      team_a_detail: undefined,
      team_b_detail: undefined,
      red_screenshot: undefined,
      blue_screenshot: undefined,
      extracted_data: undefined,
    }));

    setFormError('');
    onToast(`${currentSetNum}세트 저장 완료! ${nextSet}세트 작성 모드로 연속 진행됩니다. (10인 로스터 유지)`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center sm:items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        className="relative z-[10000] w-full max-w-[850px] bg-[#12121a] border border-[#1e1e2a] rounded-[22px] p-5 sm:p-6 my-4 sm:my-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-bold text-[17px] text-white flex items-center gap-1.5">
              <span>{activeEditingMatch ? 'CK 경기 수정' : '새 CK 경기 등록'}</span>
              <span className="text-[#8b5cf6] text-[14px] font-semibold">
                ({formData.set_number || 1}세트)
              </span>
            </h3>
            <span className="text-[10px] bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 text-[#c4b5fd] px-2.5 py-0.5 rounded-full font-semibold">
              스마트 세트 시스템
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
          >
            <X size={14} />
          </button>
        </div>

        {isAdmin && (
          <div className="mb-4 inline-flex items-center gap-1.5 text-[11px] bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] px-3 py-1 rounded-full">
            <CheckCircle2 size={13} />
            <span>관리자 인증 완료 (패스코드 입력 불필요)</span>
          </div>
        )}

        {/* Action Row: Load previous roster & Swap */}
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

        {/* Basic Match Fields */}
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
                  allMatches,
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
                  allMatches,
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
                  allMatches,
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
                  length: Math.max(
                    formData.set_number || 1,
                    formData.match_format === '5판3선승'
                      ? 5
                      : formData.match_format === '3판2선승'
                      ? 3
                      : 1
                  ),
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

        {/* Winner Selection & Cumulative Score */}
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

        {/* Wooriming Assignment */}
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
                {woorimingLocation.team === 'team_a' ? '🔴 Red팀' : '🔵 Blue팀'}{' '}
                {LINE_LABELS[woorimingLocation.line]} ({woorimingLocation.line.toUpperCase()})
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

        {/* 10-Player Team Roster Inputs */}
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
                  const champName = formData[champsKey][lineKey] || '';
                  const isW = isWooriming(playerName);
                  const isPlayerDup = duplicatePlayers.has(playerName.trim());
                  const isChampDup = duplicateChamps.has(normalizeChampionName(champName));

                  return (
                    <div
                      key={lineKey}
                      className={`flex items-center gap-2 p-1.5 rounded-[10px] transition ${
                        isW
                          ? 'bg-[#8b5cf6]/10 border border-[#8b5cf6]/30'
                          : 'bg-[#0f0f16] border border-transparent'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-[#8a8aa0] w-[32px] pl-1 shrink-0">
                        {LINE_LABELS[lineKey]}
                      </span>

                      <div className="relative flex-1">
                        <input
                          value={playerName}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              [teamKey]: { ...prev[teamKey], [lineKey]: e.target.value },
                            }))
                          }
                          placeholder={isW ? '👑 우리밍_' : '스트리머 닉네임'}
                          list="players-datalist"
                          className={`h-[32px] w-full bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none transition ${
                            isPlayerDup
                              ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5] ring-1 ring-[#ef4444]/50 font-bold'
                              : isW
                              ? 'border-[#8b5cf6] text-[#c4b5fd] font-bold'
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

              {/* Bans */}
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

        {/* Duplicate Error Warning */}
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

        {/* Footer & Submit */}
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
              onClick={onClose}
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
  );
};
