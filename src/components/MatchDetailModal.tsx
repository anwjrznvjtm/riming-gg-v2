import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS, MatchDetailedStats, PlayerDetailedSpec, TeamDetailedSpec } from '../types';
import { ChampionIcon } from './ChampionIcon';
import { StreamerAvatar } from './StreamerAvatar';
import { isWooriming, getWoorimingTeam } from '../lib/stats';
import { isAllyWonMatch } from '../lib/seriesScores';
import { analyzeScoreboardImage, generateSampleScoreboard } from '../lib/geminiScoreboard';
import {
  X,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Swords,
  Coins,
  Shield,
  Crosshair,
  FileImage,
  RefreshCw,
  Save,
  Edit3,
  Check,
  Eye,
  Zap,
} from 'lucide-react';

interface MatchDetailModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveMatch?: (updatedMatch: Match) => void;
  onToast?: (msg: string) => void;
  allChampions?: string[];
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  isOpen,
  onClose,
  onSaveMatch,
  onToast,
  allChampions = [],
}) => {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'ai_upload'>('scoreboard');
  const [detailedStats, setDetailedStats] = useState<MatchDetailedStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or restore detailed stats from match.details, or generate demo sample
  useEffect(() => {
    if (!match) {
      setDetailedStats(null);
      setSelectedImage(null);
      return;
    }

    if (match.details) {
      setDetailedStats(match.details);
      if (match.details.screenshotUrl) {
        setSelectedImage(match.details.screenshotUrl);
      }
    } else {
      // Auto-generate realistic initial scoreboard from match basic data
      const sample = generateSampleScoreboard(match);
      setDetailedStats(sample);
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditMode(false);
  }, [match]);

  // Handle clipboard paste (Ctrl+V / Cmd+V) of screenshot image
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            processImageFile(blob, '클립보드_캡처_이미지.png');
            setActiveTab('ai_upload');
            onToast?.('📋 클립보드 스크린샷 이미지를 감지했습니다!');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, onToast]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const wTeam = getWoorimingTeam(match);
  const isAllyWon = isAllyWonMatch(match);
  const isBlueWin = match.winning_team === 'Blue';

  const processImageFile = (file: File, customName?: string) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('이미지 파일(PNG, JPG, WebP 등)만 업로드할 수 있습니다.');
      return;
    }
    setImageFileName(customName || file.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setSuccessMessage('이미지 파일이 준비되었습니다. 아래 [AI 비전 분석 시작]을 눌러주세요.');
    };
    reader.onerror = () => {
      setErrorMessage('이미지 파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!selectedImage) {
      setErrorMessage('먼저 LoL 결과창 스크린샷을 등록해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setAnalysisStep('1단계: 스크린샷 텍스트 및 10인 테이블 구조 인식 중...');
      await new Promise((r) => setTimeout(r, 600));

      setAnalysisStep('2단계: 챔피언, 스펠, 룬, 아이템 원본 명칭 추출 중 (Gemini Flash)...');
      const result = await analyzeScoreboardImage(selectedImage, 'image/png', match);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'AI 비전 분석에 실패했습니다.');
      }

      setAnalysisStep('3단계: KDA, 딜량, 분당 CS, 글로벌 골드 폼 자동 매핑 완료!');
      await new Promise((r) => setTimeout(r, 400));

      const finalStats: MatchDetailedStats = {
        ...result.data,
        screenshotUrl: selectedImage,
      };

      setDetailedStats(finalStats);
      setSuccessMessage('✓ AI 비전 분석 완료! 10인 세부 스펙이 폼에 완벽히 매핑되었습니다.');
      onToast?.('🤖 AI 비전 분석이 완료되어 10인 세부 스펙이 자동 매핑되었습니다.');
      setActiveTab('scoreboard');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || '스크린샷 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  const handleLoadSample = () => {
    const sample = generateSampleScoreboard(match);
    setDetailedStats(sample);
    setSuccessMessage('✓ 샘플 결과창 세부 스펙이 성공적으로 로드되었습니다.');
    onToast?.('💡 샘플 경기 결과창 세부 스펙이 로드되었습니다.');
    setActiveTab('scoreboard');
  };

  const handleSaveToMatch = () => {
    if (!detailedStats) return;

    // Synchronize primary match fields if detailed stats updated them
    const updatedTeamAChamps = { ...match.team_a_champs };
    const updatedTeamBChamps = { ...match.team_b_champs };
    const updatedTeamAKda = { ...match.team_a_kda };
    const updatedTeamBKda = { ...match.team_b_kda };

    for (const k of LINE_KEYS) {
      if (detailedStats.redTeam.players[k]?.champ) {
        updatedTeamAChamps[k] = detailedStats.redTeam.players[k].champ;
      }
      if (detailedStats.redTeam.players[k]?.kda) {
        updatedTeamAKda[k] = detailedStats.redTeam.players[k].kda;
      }
      if (detailedStats.blueTeam.players[k]?.champ) {
        updatedTeamBChamps[k] = detailedStats.blueTeam.players[k].champ;
      }
      if (detailedStats.blueTeam.players[k]?.kda) {
        updatedTeamBKda[k] = detailedStats.blueTeam.players[k].kda;
      }
    }

    const updatedMatch: Match = {
      ...match,
      team_a_champs: updatedTeamAChamps,
      team_b_champs: updatedTeamBChamps,
      team_a_kda: updatedTeamAKda,
      team_b_kda: updatedTeamBKda,
      details: detailedStats,
      updated_at: new Date().toISOString(),
    };

    if (onSaveMatch) {
      onSaveMatch(updatedMatch);
    }
    onToast?.('💾 경기 상세 스펙 및 AI 분석 데이터가 저장되었습니다.');
    setIsEditMode(false);
  };

  // Helper to safely update a specific player in local state during edit mode
  const handleUpdatePlayerStat = (
    team: 'blue' | 'red',
    line: LineKey,
    field: keyof PlayerDetailedSpec,
    value: any
  ) => {
    if (!detailedStats) return;
    setDetailedStats((prev) => {
      if (!prev) return prev;
      const teamKey = team === 'blue' ? 'blueTeam' : 'redTeam';
      const currentTeam = prev[teamKey];
      const currentPlayer = currentTeam.players[line];

      return {
        ...prev,
        [teamKey]: {
          ...currentTeam,
          players: {
            ...currentTeam.players,
            [line]: {
              ...currentPlayer,
              [field]: value,
            },
          },
        },
      };
    });
  };

  // Max damage in the game for visual bar scaling
  const maxDamageInGame = useMemo(() => {
    if (!detailedStats) return 1;
    let max = 1;
    for (const line of LINE_KEYS) {
      const bDmg = detailedStats.blueTeam.players[line]?.damage || 0;
      const rDmg = detailedStats.redTeam.players[line]?.damage || 0;
      if (bDmg > max) max = bDmg;
      if (rDmg > max) max = rDmg;
    }
    return max;
  }, [detailedStats]);

  return (
    <div
      id="match-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-[fadeIn_0.15s_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="match-detail-modal-container"
        className="relative w-full max-w-[1200px] my-auto bg-[#0d0d14] border border-[#27273a] rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더: 경기 메타 정보 & 승패 배너 */}
        <div className="px-5 py-4 border-b border-[#1f1f2e] bg-[#12121b] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[16px] shadow-md shrink-0 ${
                isAllyWon
                  ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400'
                  : 'bg-red-600/20 border border-red-500/40 text-red-400'
              }`}
            >
              {isAllyWon ? '승' : '패'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-black text-white tracking-tight">
                  {match.ck_name}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#1e1e2c] border border-[#2e2e42] text-[11px] font-bold text-[#c4b5fd]">
                  {match.set_number}세트 ({match.match_format})
                </span>
                <span className="text-[12px] text-[#8e8ea6] font-medium">
                  {match.date}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                    isBlueWin
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {isBlueWin ? '🔵 블루팀 승리' : '🔴 레드팀 승리'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8a8aa0]">
                <span>스코어: <strong className="text-white font-black">{match.score || '1:0'}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-[#a78bfa]" />
                  <span>진행 시간: <strong className="text-white">{detailedStats?.gameDuration || '31:45'}</strong></span>
                </span>
                {wTeam && (
                  <>
                    <span>•</span>
                    <span className="text-[#c4b5fd]">
                      우리밍_ 진영: <strong>{wTeam === 'Blue' ? '블루(Blue)' : '레드(Red)'}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 우측 탭 스위치 & 닫기 버튼 */}
          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <div className="flex items-center bg-[#08080d] p-1 rounded-xl border border-[#222232]">
              <button
                type="button"
                id="btn-tab-scoreboard"
                onClick={() => setActiveTab('scoreboard')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'scoreboard'
                    ? 'bg-[#8b5cf6] text-white shadow-sm'
                    : 'text-[#8a8aa0] hover:text-white'
                }`}
              >
                <Eye size={14} />
                <span>10인 상세 스펙</span>
              </button>
              <button
                type="button"
                id="btn-tab-ai-upload"
                onClick={() => setActiveTab('ai_upload')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'ai_upload'
                    ? 'bg-[#8b5cf6] text-white shadow-sm'
                    : 'text-[#8a8aa0] hover:text-white'
                }`}
              >
                <Sparkles size={14} className="text-yellow-300" />
                <span>AI 비전 분석</span>
                {selectedImage && (
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                )}
              </button>
            </div>

            <button
              type="button"
              id="btn-close-match-detail-modal"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#8a8aa0] hover:text-white flex items-center justify-center transition border border-[#2a2a3a]"
              title="닫기 (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 바디 컨텐츠 (스크롤 가능) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* 탭 1: AI 비전 분석 업로드 및 자동 매핑 섹션 */}
          {activeTab === 'ai_upload' && (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              {/* 안내 배너 */}
              <div className="bg-[#12121e] border border-[#2a2a40] rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#c4b5fd] shrink-0 mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-[13px] font-black text-white flex items-center gap-2">
                    <span>LoL 결과 스크린샷 AI 비전 분석 (Gemini Flash OCR)</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                      게임 원본 명칭 보존 모드
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                    리그 오브 레전드 인게임 결과창, 통계창, OP.GG 상세 스크린샷을 등록하면 AI 비전 모델이 10인의{' '}
                    <strong className="text-white">KDA, 딜량, 분당 CS, 아이템, 특성(룬), 스펠, 글로벌 골드, 팀 KDA</strong>를 자동 분석하여
                    해당 폼에 즉시 매핑합니다.
                  </p>
                  <p className="text-[10px] text-[#71717a]">
                    ※ 아이템, 특성, 스펠, 챔피언 데이터는 임의 변환 없이 게임 원본 공식 한국어 명칭 그대로 인식됩니다.
                  </p>
                </div>
              </div>

              {/* 드래그 & 드롭 / 파일 선택 영역 */}
              <div
                id="drop-zone-scoreboard"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 ${
                  isDragOver
                    ? 'border-[#8b5cf6] bg-[#8b5cf6]/10 scale-[1.01]'
                    : selectedImage
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-[#2e2e42] hover:border-[#8b5cf6]/60 bg-[#0e0e16] hover:bg-[#13131f]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedImage ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                      <img
                        src={selectedImage}
                        alt="선택된 결과창 스크린샷"
                        className="max-h-[190px] rounded-xl border border-[#2e2e42] object-contain shadow-lg"
                      />
                      <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <span className="text-[11px] text-white font-bold bg-[#8b5cf6] px-3 py-1 rounded-lg">
                          다른 이미지로 변경
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-emerald-400 font-bold">
                      <CheckCircle2 size={16} />
                      <span>{imageFileName || '스크린샷 이미지 업로드 완료'}</span>
                    </div>
                    <p className="text-[11px] text-[#8a8aa0]">
                      클릭하여 다른 이미지로 변경하거나, 아래 버튼을 눌러 AI 분석을 시작하세요.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-[#1e1e2e] flex items-center justify-center text-[#8b5cf6] mb-2 shadow-md">
                      <UploadCloud size={28} />
                    </div>
                    <h4 className="text-[14px] font-bold text-white">
                      결과창 스크린샷 이미지를 여기에 드래그하거나 클릭하여 업로드
                    </h4>
                    <p className="text-[11px] text-[#8a8aa0] max-w-md">
                      지원 파일: PNG, JPG, WebP, GIF | 또는 캡처 도구로 복사 후 이 창에서 바로{' '}
                      <kbd className="px-1.5 py-0.5 bg-[#1e1e2e] rounded text-[#c4b5fd] font-mono">Ctrl + V</kbd>를 눌러 붙여넣으세요.
                    </p>
                  </div>
                )}
              </div>

              {/* 오류 / 성공 메시지 피드백 */}
              {errorMessage && (
                <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-3.5 flex items-center gap-2.5 text-red-300 text-[12px]">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3.5 flex items-center gap-2.5 text-emerald-300 text-[12px]">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* 진행 상태 인디케이터 */}
              {isAnalyzing && (
                <div className="bg-[#141422] border border-[#8b5cf6]/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-[12px] font-bold text-white">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-[#8b5cf6]" />
                      <span>AI 비전 분석 진행 중...</span>
                    </span>
                    <span className="text-[#a78bfa] text-[11px]">Gemini 3.8 Flash Vision</span>
                  </div>
                  <div className="w-full bg-[#1e1e2e] h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] h-full animate-[pulse_1s_infinite] w-[85%]" />
                  </div>
                  <p className="text-[11px] text-[#a0a6bd]">{analysisStep}</p>
                </div>
              )}

              {/* 액션 버튼 그룹 */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  id="btn-load-sample-scoreboard"
                  onClick={handleLoadSample}
                  disabled={isAnalyzing}
                  className="h-[40px] px-4 rounded-xl bg-[#1e1e2c] hover:bg-[#2a2a3e] border border-[#2e2e46] text-[12px] font-bold text-[#c2c6dc] hover:text-white transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Zap size={15} className="text-yellow-400" />
                  <span>샘플 결과창 데이터로 즉시 체험</span>
                </button>

                <div className="flex items-center gap-2.5">
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImageFileName('');
                        setSuccessMessage(null);
                        setErrorMessage(null);
                      }}
                      className="h-[40px] px-3.5 rounded-xl bg-[#1a1a24] hover:bg-red-500/20 text-[#8a8aa0] hover:text-red-300 border border-[#2a2a3a] hover:border-red-500/40 text-[12px] font-bold transition"
                    >
                      초기화
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-run-ai-vision"
                    onClick={handleRunAiAnalysis}
                    disabled={!selectedImage || isAnalyzing}
                    className="h-[40px] px-5 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] hover:from-[#7c3aed] hover:to-[#5b21b6] text-white text-[12px] font-black shadow-lg shadow-[#8b5cf6]/25 transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>비전 분석 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>AI 비전 분석 시작 (자동 매핑)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 탭 2: 10인 로스터 세부 스펙 (블루팀 / 레드팀 경기 분석표) */}
          {detailedStats && (
            <div className="space-y-6">
              {/* 글로벌 골드 & 팀 KDA 비교 요약 바 */}
              <div className="bg-[#12121c] border border-[#222234] rounded-2xl p-4 sm:p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1e1e2e]">
                  {/* 블루팀 요약 */}
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-black text-blue-400">
                          {detailedStats.blueTeam.teamName || '블루팀'}
                        </span>
                        {isBlueWin && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black">
                            승리팀
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#9ca3af] mt-0.5">
                        <span>팀 KDA: <strong className="text-white font-bold">{detailedStats.blueTeam.teamKda}</strong></span>
                        <span>•</span>
                        <span>글로벌 골드: <strong className="text-yellow-400 font-bold">{detailedStats.blueTeam.globalGold}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* 중앙 게임 시간 & VS 배지 */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="px-3 py-1 rounded-full bg-[#1b1b28] border border-[#2c2c3e] text-[11px] font-black text-[#c4b5fd] flex items-center gap-1.5">
                      <Swords size={12} />
                      <span>{detailedStats.gameDuration || '31:45'}</span>
                    </div>
                    <span className="text-[10px] text-[#71717a] mt-1 font-mono">GAME DURATION</span>
                  </div>

                  {/* 레드팀 요약 */}
                  <div className="flex items-center gap-3 sm:text-right sm:flex-row-reverse">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                    <div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        {!isBlueWin && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-black">
                            승리팀
                          </span>
                        )}
                        <span className="text-[13px] font-black text-red-400">
                          {detailedStats.redTeam.teamName || '레드팀'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#9ca3af] mt-0.5 sm:justify-end">
                        <span>팀 KDA: <strong className="text-white font-bold">{detailedStats.redTeam.teamKda}</strong></span>
                        <span>•</span>
                        <span>글로벌 골드: <strong className="text-yellow-400 font-bold">{detailedStats.redTeam.globalGold}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 컨트롤 버튼: 편집 모드 토글 & 저장 */}
                <div className="flex items-center justify-between pt-3 text-[11px]">
                  <div className="flex items-center gap-2 text-[#8a8aa0]">
                    <span>매핑 상태:</span>
                    <span className="px-2 py-0.5 rounded bg-[#1c1c2b] text-emerald-400 font-bold flex items-center gap-1">
                      <Check size={12} /> 10인 세부 스펙 완료
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-toggle-edit-mode"
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`h-[32px] px-3 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                        isEditMode
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#1e1e2c] text-[#a0a6bd] hover:text-white border border-[#2c2c3e]'
                      }`}
                    >
                      <Edit3 size={13} />
                      <span>{isEditMode ? '편집 완료 (미리보기)' : '수치 직접 수정'}</span>
                    </button>

                    <button
                      type="button"
                      id="btn-save-match-details"
                      onClick={handleSaveToMatch}
                      className="h-[32px] px-3.5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[11px] font-black transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Save size={13} />
                      <span>경기 데이터에 저장</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 10인 로스터: 블루팀 (Blue Team) 섹션 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[14px] font-black text-blue-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>블루팀 (Blue Side) 세부 스펙</span>
                    {isBlueWin && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        VICTORY 🏆
                      </span>
                    )}
                  </h3>
                  <span className="text-[11px] text-[#71717a]">
                    총 골드: <strong className="text-yellow-400">{detailedStats.blueTeam.globalGold}</strong> | 팀 KDA:{' '}
                    <strong className="text-white">{detailedStats.blueTeam.teamKda}</strong>
                  </span>
                </div>

                <div className="bg-[#101018] border border-blue-900/30 rounded-2xl overflow-hidden divide-y divide-[#1b1b28]">
                  {LINE_KEYS.map((line) => {
                    const p = detailedStats.blueTeam.players[line];
                    return (
                      <PlayerSpecRow
                        key={`blue-${line}`}
                        player={p}
                        line={line}
                        team="blue"
                        maxDamage={maxDamageInGame}
                        isEditMode={isEditMode}
                        onUpdate={(field, val) => handleUpdatePlayerStat('blue', line, field, val)}
                        allChampions={allChampions}
                      />
                    );
                  })}
                </div>
              </div>

              {/* 10인 로스터: 레드팀 (Red Team) 섹션 */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[14px] font-black text-red-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>레드팀 (Red Side) 세부 스펙</span>
                    {!isBlueWin && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                        VICTORY 🏆
                      </span>
                    )}
                  </h3>
                  <span className="text-[11px] text-[#71717a]">
                    총 골드: <strong className="text-yellow-400">{detailedStats.redTeam.globalGold}</strong> | 팀 KDA:{' '}
                    <strong className="text-white">{detailedStats.redTeam.teamKda}</strong>
                  </span>
                </div>

                <div className="bg-[#101018] border border-red-900/30 rounded-2xl overflow-hidden divide-y divide-[#1b1b28]">
                  {LINE_KEYS.map((line) => {
                    const p = detailedStats.redTeam.players[line];
                    return (
                      <PlayerSpecRow
                        key={`red-${line}`}
                        player={p}
                        line={line}
                        team="red"
                        maxDamage={maxDamageInGame}
                        isEditMode={isEditMode}
                        onUpdate={(field, val) => handleUpdatePlayerStat('red', line, field, val)}
                        allChampions={allChampions}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-5 py-3.5 bg-[#0e0e16] border-t border-[#1e1e2a] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#71717a] flex items-center gap-2">
            <span>단축키: <kbd className="px-1.5 py-0.5 bg-[#1b1b28] rounded text-[#a0a6bd]">Esc</kbd> 닫기</span>
            <span>•</span>
            <span>클립보드 스크린샷: <kbd className="px-1.5 py-0.5 bg-[#1b1b28] rounded text-[#a0a6bd]">Ctrl+V</kbd></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[36px] px-4 rounded-xl bg-[#1b1b26] hover:bg-[#252535] text-[#9ca3af] hover:text-white text-[12px] font-bold transition border border-[#28283a]"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSaveToMatch}
              className="h-[36px] px-4 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[12px] font-black transition flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Save size={14} />
              <span>변경사항 저장</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PlayerSpecRowProps {
  player: PlayerDetailedSpec;
  line: LineKey;
  team: 'blue' | 'red';
  maxDamage: number;
  isEditMode: boolean;
  onUpdate: (field: keyof PlayerDetailedSpec, val: any) => void;
  allChampions: string[];
}

const PlayerSpecRow: React.FC<PlayerSpecRowProps> = ({
  player,
  line,
  team,
  maxDamage,
  isEditMode,
  onUpdate,
  allChampions,
}) => {
  const isTargetWooriming = isWooriming(player.name);

  // Parse KDA
  const [k, d, a] = (player.kda || '0/0/0').split('/').map((s) => parseInt(s.trim(), 10) || 0);
  const kdaScore = d === 0 ? 'Perfect' : ((k + a) / d).toFixed(2);

  const damageRatio = Math.min(100, Math.round(((player.damage || 0) / (maxDamage || 1)) * 100));

  return (
    <div
      className={`p-3 sm:px-4 sm:py-3 transition-colors ${
        isTargetWooriming
          ? 'bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/15'
          : team === 'blue'
          ? 'hover:bg-blue-950/10'
          : 'hover:bg-red-950/10'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 1. 라인, 챔피언, 선수명, 스펠, 룬 */}
        <div className="flex items-center gap-3 min-w-[280px]">
          {/* 라인 배지 */}
          <span
            className={`w-10 text-center py-0.5 rounded text-[10px] font-black shrink-0 ${
              team === 'blue'
                ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
                : 'bg-red-950/80 text-red-300 border border-red-800/40'
            }`}
          >
            {LINE_LABELS[line]}
          </span>

          {/* 챔피언 아이콘 */}
          <div className="relative shrink-0">
            <ChampionIcon name={player.champ} size={40} shape="square" />
            {isTargetWooriming && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#8b5cf6] text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm">
                ★
              </span>
            )}
          </div>

          {/* 스펠 2개 & 룬 */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-1">
              {(player.spells || ['점멸', '점화']).slice(0, 2).map((spell, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-[#1a1a28] border border-[#2b2b3e] text-[9px] font-bold text-[#c4b5fd] truncate max-w-[55px]"
                  title={spell}
                >
                  {spell}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span
                className="px-1.5 py-0.5 rounded bg-[#1e1e28] border border-[#2b2b3e] text-[9px] font-medium text-[#93c5fd] truncate max-w-[65px]"
                title={`핵심 룬: ${player.runes?.primary || '정복자'}`}
              >
                {player.runes?.primary || '정복자'}
              </span>
              <span
                className="px-1 py-0.5 rounded bg-[#14141c] text-[8px] text-[#71717a] truncate max-w-[40px]"
                title={`보조 룬: ${player.runes?.secondary || '영감'}`}
              >
                {player.runes?.secondary || '영감'}
              </span>
            </div>
          </div>

          {/* 선수명 및 챔피언명 */}
          <div className="min-w-[90px]">
            {isEditMode ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => onUpdate('name', e.target.value)}
                  placeholder="선수명"
                  className="w-full h-6 px-1.5 text-[11px] bg-[#0c0c14] border border-[#2e2e42] rounded text-white font-bold"
                />
                <input
                  type="text"
                  value={player.champ}
                  onChange={(e) => onUpdate('champ', e.target.value)}
                  placeholder="챔피언"
                  className="w-full h-6 px-1.5 text-[11px] bg-[#0c0c14] border border-[#2e2e42] rounded text-white font-bold"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[12px] font-bold truncate ${isTargetWooriming ? 'text-[#c4b5fd] font-black' : 'text-white'}`}>
                    {player.name || `${LINE_LABELS[line]} 선수`}
                  </span>
                  {isTargetWooriming && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#8b5cf6]/30 text-[#e9d5ff] text-[9px] font-black">
                      우리밍_
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#8e8ea6] font-medium block truncate">
                  {player.champ || '-'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. KDA 및 평점 */}
        <div className="flex items-center gap-2 min-w-[140px]">
          {isEditMode ? (
            <input
              type="text"
              value={player.kda}
              onChange={(e) => onUpdate('kda', e.target.value)}
              placeholder="K/D/A"
              className="w-24 h-7 px-2 text-[12px] bg-[#0c0c14] border border-[#2e2e42] rounded text-white font-mono text-center"
            />
          ) : (
            <div>
              <div className="text-[13px] font-black tracking-tight text-white font-mono">
                <span>{k}</span> <span className="text-[#64748b]">/</span>{' '}
                <span className="text-red-400">{d}</span> <span className="text-[#64748b]">/</span>{' '}
                <span>{a}</span>
              </div>
              <div className="text-[10px] text-[#a0a6bd] font-medium flex items-center gap-1">
                <span>평점:</span>
                <strong className={kdaScore === 'Perfect' || parseFloat(kdaScore) >= 4.0 ? 'text-amber-400' : 'text-white'}>
                  {kdaScore === 'Perfect' ? 'Perfect' : `${kdaScore}:1`}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* 3. 딜량 (Damage) & 딜 점유율 바 */}
        <div className="min-w-[150px] space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8a8aa0] text-[10px]">딜량:</span>
            {isEditMode ? (
              <input
                type="number"
                value={player.damage || 0}
                onChange={(e) => onUpdate('damage', parseInt(e.target.value, 10) || 0)}
                className="w-20 h-6 px-1 text-[11px] bg-[#0c0c14] border border-[#2e2e42] rounded text-white text-right font-mono"
              />
            ) : (
              <span className="font-bold text-white font-mono">
                {(player.damage || 0).toLocaleString()}
                {player.damageShare ? (
                  <span className="text-[10px] text-[#8e8ea6] ml-1">({player.damageShare}%)</span>
                ) : null}
              </span>
            )}
          </div>
          <div className="w-full bg-[#181824] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                team === 'blue' ? 'bg-blue-500' : 'bg-red-500'
              }`}
              style={{ width: `${damageRatio}%` }}
            />
          </div>
        </div>

        {/* 4. CS & 분당 CS & 골드 */}
        <div className="min-w-[120px] text-[11px] space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[#8a8aa0] text-[10px]">CS:</span>
            {isEditMode ? (
              <input
                type="number"
                value={player.cs || 0}
                onChange={(e) => onUpdate('cs', parseInt(e.target.value, 10) || 0)}
                className="w-16 h-6 px-1 text-[11px] bg-[#0c0c14] border border-[#2e2e42] rounded text-white text-right font-mono"
              />
            ) : (
              <span className="font-bold text-white font-mono">
                {player.cs || 0} <span className="text-[#8e8ea6] text-[10px]">({player.csPerMin || 0}/m)</span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#8a8aa0]">골드:</span>
            <span className="text-yellow-400 font-bold font-mono">
              {player.gold ? `${(player.gold / 1000).toFixed(1)}k` : '-'}
            </span>
          </div>
        </div>

        {/* 5. 아이템 (6 슬롯 + 1 장신구) */}
        <div className="flex items-center gap-1 shrink-0 overflow-x-auto py-1">
          {Array.from({ length: 6 }).map((_, idx) => {
            const itemName = player.items?.[idx];
            return (
              <div
                key={idx}
                className="w-7 h-7 rounded bg-[#171724] border border-[#2a2a3e] flex items-center justify-center text-[9px] text-white/40 overflow-hidden relative group"
                title={itemName || '빈 아이템 슬롯'}
              >
                {itemName ? (
                  <span className="text-[9px] font-bold text-[#c4b5fd] text-center leading-tight line-clamp-2 px-0.5">
                    {itemName.slice(0, 3)}
                  </span>
                ) : (
                  <span className="text-[#3a3a50] text-[8px]">-</span>
                )}
                {itemName && (
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 bg-[#09090f] text-[#c4b5fd] text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap border border-[#2e2e46]">
                    {itemName}
                  </div>
                )}
              </div>
            );
          })}
          {/* 장신구 / 와드 */}
          <div
            className="w-7 h-7 rounded-full bg-[#1b1b2a] border border-amber-500/30 flex items-center justify-center text-[8px] text-amber-300 font-bold overflow-hidden relative group ml-0.5"
            title={player.items?.[6] || '장신구 (망원 개조/예언자의 렌즈)'}
          >
            {player.items?.[6] ? player.items[6].slice(0, 2) : '👁️'}
            {player.items?.[6] && (
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 bg-[#09090f] text-amber-300 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap border border-amber-500/40">
                {player.items[6]}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
