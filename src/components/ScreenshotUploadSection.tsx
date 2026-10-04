import React, { useState, useRef } from 'react';
import { MatchExtractedData, TeamGameDetail, PlayerGameDetail, LineKey, LINE_KEYS, LINE_LABELS } from '../types';
import { UploadCloud, Image as ImageIcon, Sparkles, X, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Eye } from 'lucide-react';

interface ScreenshotUploadSectionProps {
  redScreenshot?: string;
  blueScreenshot?: string;
  onRedScreenshotChange: (dataUrl?: string) => void;
  onBlueScreenshotChange: (dataUrl?: string) => void;
  gameDuration?: string;
  onGameDurationChange: (duration: string) => void;
  teamADetail?: TeamGameDetail;
  teamBDetail?: TeamGameDetail;
  onTeamADetailChange: (detail: TeamGameDetail) => void;
  onTeamBDetailChange: (detail: TeamGameDetail) => void;
  onApplyAiExtraction: (extracted: MatchExtractedData, fallbackNotice?: string) => void;
  onToast: (msg: string) => void;
  currentTeamA?: Record<LineKey, string>;
  currentTeamB?: Record<LineKey, string>;
}

// Generate a lightweight, stylized LoL scoreboard canvas dataURL for quick sample testing
function generateSampleLoLScoreboard(team: 'Red' | 'Blue', streamers?: Record<LineKey, string>): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#090a10';
  ctx.fillRect(0, 0, 640, 360);

  // Header bar
  const isRed = team === 'Red';
  ctx.fillStyle = isRed ? '#2a0e14' : '#0e1a2a';
  ctx.fillRect(0, 0, 640, 48);

  ctx.fillStyle = isRed ? '#ef4444' : '#3b82f6';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(isRed ? '🔴 RED TEAM VICTORY - LEAGUE OF LEGENDS' : '🔵 BLUE TEAM DEFEAT - LEAGUE OF LEGENDS', 20, 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.fillText('TIME: 32:15  |  GLOBAL GOLD: 64.2k  |  KDA: 28/16/54', 360, 32);

  // Rows for 5 players
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const roleKeys: LineKey[] = ['top', 'jgl', 'mid', 'adc', 'sup'];
  const defaultRedPlayers = ['김탑솔 (아트록스)', '정글러버 (세주아니)', '미드장인 (아리)', '우리밍_ (카이사)', '서폿천사 (노틸러스)'];
  const defaultBluePlayers = ['상대탑 (크산테)', '상대정글 (바이)', '상대미드 (오리아나)', '상대원딜 (이즈리얼)', '상대서폿 (레오나)'];

  const players = roleKeys.map((k, idx) => {
    const sName = streamers?.[k];
    if (sName) return `${sName} (챔피언)`;
    return isRed ? defaultRedPlayers[idx] : defaultBluePlayers[idx];
  });

  const damages = isRed ? ['23.5k', '14.2k', '26.8k', '35.1k', '8.6k'] : ['21.2k', '17.5k', '27.4k', '29.8k', '7.9k'];
  const gpms = isRed ? ['420 g/m', '375 g/m', '450 g/m', '532 g/m', '265 g/m'] : ['405 g/m', '385 g/m', '460 g/m', '485 g/m', '255 g/m'];

  for (let i = 0; i < 5; i++) {
    const y = 60 + i * 56;
    ctx.fillStyle = i % 2 === 0 ? '#12131c' : '#171824';
    ctx.fillRect(15, y, 610, 50);

    ctx.fillStyle = isRed ? '#fca5a5' : '#93c5fd';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(roles[i], 28, y + 30);

    ctx.fillStyle = players[i].includes('우리밍') ? '#c084fc' : '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(players[i], 80, y + 30);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`딜량: ${damages[i]}`, 280, y + 30);
    ctx.fillText(`골드: ${gpms[i]}`, 400, y + 30);

    ctx.fillStyle = '#8b5cf6';
    ctx.font = '11px sans-serif';
    ctx.fillText('[정복자] [점멸]', 520, y + 30);
  }

  return canvas.toDataURL('image/png');
}

export const ScreenshotUploadSection: React.FC<ScreenshotUploadSectionProps> = ({
  redScreenshot,
  blueScreenshot,
  onRedScreenshotChange,
  onBlueScreenshotChange,
  gameDuration,
  onGameDurationChange,
  teamADetail,
  teamBDetail,
  onTeamADetailChange,
  onTeamBDetailChange,
  onApplyAiExtraction,
  onToast,
  currentTeamA,
  currentTeamB,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetailInspector, setShowDetailInspector] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const redInputRef = useRef<HTMLInputElement>(null);
  const blueInputRef = useRef<HTMLInputElement>(null);

  // File to base64 handler
  const handleFileSelect = (file: File, team: 'Red' | 'Blue') => {
    if (!file.type.startsWith('image/')) {
      onToast('이미지 파일(PNG, JPG, WEBP)만 첨부할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (team === 'Red') {
        onRedScreenshotChange(dataUrl);
      } else {
        onBlueScreenshotChange(dataUrl);
      }
      onToast(`${team}팀 결과 스크린샷이 첨부되었습니다.`);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, team: 'Red' | 'Blue') => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0], team);
    }
  };

  const [fallbackData, setFallbackData] = useState<MatchExtractedData | null>(null);

  const applyExtractedData = (extracted: MatchExtractedData, notice?: string) => {
    // Ensure existing streamer names are 100% strictly matched as the key
    if (extracted.red_team?.players) {
      for (const lk of LINE_KEYS) {
        if (extracted.red_team.players[lk]) {
          extracted.red_team.players[lk].player = currentTeamA?.[lk] || extracted.red_team.players[lk].player;
          extracted.red_team.players[lk].line = lk;
        }
      }
    }
    if (extracted.blue_team?.players) {
      for (const lk of LINE_KEYS) {
        if (extracted.blue_team.players[lk]) {
          extracted.blue_team.players[lk].player = currentTeamB?.[lk] || extracted.blue_team.players[lk].player;
          extracted.blue_team.players[lk].line = lk;
        }
      }
    }

    // Update parent match form state with the extracted data
    onApplyAiExtraction(extracted, notice);

    if (extracted.game_duration) {
      onGameDurationChange(extracted.game_duration);
    }
    if (extracted.red_team) {
      onTeamADetailChange(extracted.red_team);
    }
    if (extracted.blue_team) {
      onTeamBDetailChange(extracted.blue_team);
    }

    setShowDetailInspector(true);
  };

  // Run AI Vision Analysis using server API
  const handleRunAiVision = async () => {
    const targetImage = redScreenshot || blueScreenshot;
    if (!targetImage) {
      onToast('분석할 스크린샷(Red팀 또는 Blue팀)을 먼저 첨부해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: targetImage,
          team: redScreenshot && blueScreenshot ? 'both' : redScreenshot ? 'Red' : 'Blue',
          teamAStreamers: currentTeamA,
          teamBStreamers: currentTeamB,
        }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch (jsonErr) {
        console.warn('Response was not JSON:', jsonErr);
      }

      if (!res.ok || !json?.success) {
        if (json?.data) {
          setFallbackData(json.data);
        }
        if (json?.isQuotaExhausted) {
          setErrorMessage(
            json?.message ||
            'Gemini API 선불 크레딧/할당량이 모두 소진되었습니다. AI Studio(https://ai.studio/projects)에서 크레딧 충전 또는 결제 계정 확인이 필요합니다.'
          );
          onToast('⚠️ Gemini API 크레딧이 소진되었습니다. 수동 입력 또는 [샘플 지표 채우기]로 바로 등록할 수 있습니다.');
          return;
        }
        const errorMsg = json?.error || json?.message || `AI 분석 서버 응답 오류 (HTTP ${res.status})`;
        setErrorMessage(errorMsg);
        onToast(`분석 안내: ${errorMsg}`);
        return;
      }

      const extracted: MatchExtractedData = json.data;
      applyExtractedData(extracted, json.message);
      onToast('🤖 AI 비전 분석 완료! 기존 스트리머명을 기준 키로 삼아 딜량, 분당골드, 아이템이 1:1 매칭되었습니다.');
    } catch (err: any) {
      const msg = err?.message || '네트워크 오류가 발생했습니다.';
      setErrorMessage(msg);
      onToast(`분석 안내: ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mb-4 bg-[#0a0a12] border border-[#1e1e2a] rounded-[18px] p-4 relative">
      {/* Lightbox Modal */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedPreview(null)}
        >
          <div className="relative max-w-[90vw] max-h-[85vh] bg-[#12121a] p-2 rounded-xl border border-white/20">
            <button
              type="button"
              onClick={() => setSelectedPreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold shadow-lg"
            >
              <X size={16} />
            </button>
            <img
              src={selectedPreview}
              alt="Screenshot Preview"
              className="max-w-full max-h-[80vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-[#1e1e2a]">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-[#8b5cf6]/20 text-[#a78bfa]">
            <ImageIcon size={14} />
          </span>
          <div>
            <h4 className="text-[13px] font-bold text-white flex items-center gap-1.5">
              <span>게임 결과 스크린샷 첨부 & AI 비전 자동 입력</span>
              <span className="text-[9px] bg-[#8b5cf6]/20 text-[#c4b5fd] border border-[#8b5cf6]/30 px-1.5 py-0.5 rounded-full font-bold">
                스트리머명·챔피언 절대 락(Lock) · 1~5행 직진 매칭
              </span>
            </h4>
            <p className="text-[10px] text-[#8a8aa0]">
              기존 입력된 '스트리머명'과 '챔피언'은 절대 수정되지 않으며, 스크린샷 위에서 아래로(1행=TOP ~ 5행=SUP) 순서대로 KDA·딜량·분당골드·특성·스펠·아이템만 1:1 직진 복사됩니다.
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={handleRunAiVision}
          disabled={isAnalyzing || (!redScreenshot && !blueScreenshot)}
          className={`h-[32px] px-3.5 rounded-full text-[11px] font-bold transition flex items-center gap-1.5 ${
            isAnalyzing
              ? 'bg-[#8b5cf6]/40 text-white/70 cursor-wait'
              : redScreenshot || blueScreenshot
              ? 'bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white hover:brightness-110 shadow-[0_0_12px_rgba(139,92,246,0.4)] active:scale-95'
              : 'bg-[#1e1e2a] text-[#5a5a6a] border border-[#2a2a3a] cursor-not-allowed'
          }`}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>AI 비전 분석 중...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-[#fbbf24]" />
              <span>AI 스크린샷 자동 분석 실행</span>
            </>
          )}
        </button>
      </div>

      {/* Error / Quota exhausted banner */}
      {errorMessage && (
        <div className="mb-3 p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-[11px] text-red-200">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-red-300 mb-0.5">AI 분석 오류 안내</div>
            <div>{errorMessage}</div>
            {errorMessage.includes('선불 크레딧') || errorMessage.includes('소진') ? (
              <div className="mt-1 text-[10px] text-red-300/80">
                💡 <span className="font-semibold text-white">해결 방법:</span> Gemini API의 선불 크레딧(Prepayment credits)이 소진되었습니다.{' '}
                <a
                  href="https://ai.studio/projects"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline hover:text-indigo-300 font-semibold inline-flex items-center gap-0.5 ml-1"
                >
                  AI Studio 프로젝트 설정
                </a>{' '}
                또는 Google Cloud 콘솔 결제 계정에서 크레딧을 추가하시거나 수동으로 지표를 입력/수정하실 수 있습니다.
              </div>
            ) : null}
            {fallbackData && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    applyExtractedData(fallbackData, '샘플 지표 데이터가 적용되었습니다.');
                    setErrorMessage(null);
                    onToast('✨ 샘플 지표 데이터가 모달 및 대시보드에 적용되었습니다.');
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] rounded-md transition shadow flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  <span>⚡ 샘플 통계 데이터 즉시 적용하기 (우리밍_ 딜량/골드/스탯)</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white text-xs p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1단계 요청: 스크린샷 업로드 영역 (UI) - Red팀과 Blue팀 각각 게임 결과 스크린샷 첨부 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* 🔴 Red팀 결과 스크린샷 업로드 영역 */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, 'Red')}
          className="bg-[#120e11] border border-[#ef4444]/30 hover:border-[#ef4444]/60 transition-all rounded-[14px] p-3 flex flex-col justify-between relative group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#ef4444] flex items-center gap-1.5">
              <span>🔴 Red팀 결과 스크린샷</span>
              {redScreenshot && (
                <span className="text-[9px] bg-[#10b981]/20 text-[#10b981] px-1.5 py-0.2 rounded font-bold">
                  첨부됨
                </span>
              )}
            </span>
            {redScreenshot ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPreview(redScreenshot)}
                  className="text-[10px] text-[#c0c0d0] hover:text-white p-1 rounded hover:bg-white/10 flex items-center gap-0.5"
                  title="크게 보기"
                >
                  <Eye size={12} />
                  <span>미리보기</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRedScreenshotChange(undefined)}
                  className="text-[10px] text-[#ef4444] hover:text-[#f87171] p-1 rounded hover:bg-white/10"
                  title="삭제"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onRedScreenshotChange(generateSampleLoLScoreboard('Red', currentTeamA))}
                className="text-[9px] text-[#fca5a5] bg-[#ef4444]/15 hover:bg-[#ef4444]/30 px-2 py-0.5 rounded-full border border-[#ef4444]/30 transition"
              >
                테스트 샘플 적용
              </button>
            )}
          </div>

          {/* Upload Dropzone / Thumbnail Preview */}
          {redScreenshot ? (
            <div className="relative rounded-[10px] overflow-hidden border border-[#ef4444]/40 h-[100px] bg-black/40 flex items-center justify-center">
              <img
                src={redScreenshot}
                alt="Red Team Screenshot"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setSelectedPreview(redScreenshot)}
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 pointer-events-none">
                <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded-full flex items-center gap-1">
                  <Eye size={11} /> 클릭하여 확대
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => redInputRef.current?.click()}
              className="border border-dashed border-[#ef4444]/40 hover:border-[#ef4444] rounded-[10px] h-[100px] flex flex-col items-center justify-center p-3 text-center cursor-pointer bg-[#0c080a] hover:bg-[#1a0f14] transition"
            >
              <UploadCloud size={22} className="text-[#ef4444] mb-1 opacity-80" />
              <div className="text-[11px] font-bold text-[#fca5a5]">
                클릭 또는 이미지를 드래그하여 첨부
              </div>
              <div className="text-[9px] text-[#8a8aa0] mt-0.5">
                LoL 인게임 결과창 / Red팀 통계 스크린샷
              </div>
            </div>
          )}

          <input
            ref={redInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0], 'Red');
            }}
          />
        </div>

        {/* 🔵 Blue팀 결과 스크린샷 업로드 영역 */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, 'Blue')}
          className="bg-[#0e111a] border border-[#3b82f6]/30 hover:border-[#3b82f6]/60 transition-all rounded-[14px] p-3 flex flex-col justify-between relative group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#3b82f6] flex items-center gap-1.5">
              <span>🔵 Blue팀 결과 스크린샷</span>
              {blueScreenshot && (
                <span className="text-[9px] bg-[#10b981]/20 text-[#10b981] px-1.5 py-0.2 rounded font-bold">
                  첨부됨
                </span>
              )}
            </span>
            {blueScreenshot ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPreview(blueScreenshot)}
                  className="text-[10px] text-[#c0c0d0] hover:text-white p-1 rounded hover:bg-white/10 flex items-center gap-0.5"
                  title="크게 보기"
                >
                  <Eye size={12} />
                  <span>미리보기</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBlueScreenshotChange(undefined)}
                  className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] p-1 rounded hover:bg-white/10"
                  title="삭제"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onBlueScreenshotChange(generateSampleLoLScoreboard('Blue', currentTeamB))}
                className="text-[9px] text-[#93c5fd] bg-[#3b82f6]/15 hover:bg-[#3b82f6]/30 px-2 py-0.5 rounded-full border border-[#3b82f6]/30 transition"
              >
                테스트 샘플 적용
              </button>
            )}
          </div>

          {/* Upload Dropzone / Thumbnail Preview */}
          {blueScreenshot ? (
            <div className="relative rounded-[10px] overflow-hidden border border-[#3b82f6]/40 h-[100px] bg-black/40 flex items-center justify-center">
              <img
                src={blueScreenshot}
                alt="Blue Team Screenshot"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setSelectedPreview(blueScreenshot)}
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 pointer-events-none">
                <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded-full flex items-center gap-1">
                  <Eye size={11} /> 클릭하여 확대
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => blueInputRef.current?.click()}
              className="border border-dashed border-[#3b82f6]/40 hover:border-[#3b82f6] rounded-[10px] h-[100px] flex flex-col items-center justify-center p-3 text-center cursor-pointer bg-[#080a12] hover:bg-[#0f1422] transition"
            >
              <UploadCloud size={22} className="text-[#3b82f6] mb-1 opacity-80" />
              <div className="text-[11px] font-bold text-[#93c5fd]">
                클릭 또는 이미지를 드래그하여 첨부
              </div>
              <div className="text-[9px] text-[#8a8aa0] mt-0.5">
                LoL 인게임 결과창 / Blue팀 통계 스크린샷
              </div>
            </div>
          )}

          <input
            ref={blueInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0], 'Blue');
            }}
          />
        </div>
      </div>

      {/* 2단계 & 3단계: 추출된 데이터 뼈대(State) 확인 및 수동 보정 UI */}
      <div className="pt-2 border-t border-[#1e1e2a]">
        <button
          type="button"
          onClick={() => setShowDetailInspector(!showDetailInspector)}
          className="w-full flex items-center justify-between text-[11px] text-[#8a8aa0] hover:text-white py-1 px-1 rounded transition"
        >
          <span className="flex items-center gap-1.5 font-bold">
            <Sparkles size={13} className="text-[#8b5cf6]" />
            <span>AI 비전 추출 정밀 데이터 (스트리머명 기준 키 1:1 매칭 실적)</span>
            {gameDuration && (
              <span className="text-[10px] font-mono text-[#c4b5fd] bg-[#8b5cf6]/20 px-2 py-0.5 rounded">
                ⏱️ {gameDuration}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            {showDetailInspector ? '상세 접기' : '상세 보기/수정'}
            {showDetailInspector ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {showDetailInspector && (
          <div className="mt-3 space-y-3 bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-3 text-[11px]">
            {/* Global stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-[#1e1e2a]">
              <div>
                <label className="text-[10px] text-[#8a8aa0] block mb-1">경기시간 (원본 그대로 저장)</label>
                <input
                  value={gameDuration || ''}
                  onChange={(e) => onGameDurationChange(e.target.value)}
                  placeholder="예: 31:42"
                  className="w-full h-[30px] bg-[#12121a] border border-[#2a2a3a] rounded-lg px-2.5 text-white font-mono text-[11px] focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#ef4444] block mb-1">🔴 Red팀 글로벌 골드 / 팀 KDA</label>
                <div className="flex gap-1.5">
                  <input
                    value={teamADetail?.global_gold || ''}
                    onChange={(e) =>
                      onTeamADetailChange({
                        team_kda: teamADetail?.team_kda || '',
                        global_gold: e.target.value,
                        players: teamADetail?.players || ({} as any),
                      })
                    }
                    placeholder="골드 (예: 62.4k)"
                    className="w-1/2 h-[30px] bg-[#12121a] border border-[#2a2a3a] rounded-lg px-2 text-white font-mono text-[11px] focus:outline-none"
                  />
                  <input
                    value={teamADetail?.team_kda || ''}
                    onChange={(e) =>
                      onTeamADetailChange({
                        team_kda: e.target.value,
                        global_gold: teamADetail?.global_gold || '',
                        players: teamADetail?.players || ({} as any),
                      })
                    }
                    placeholder="팀 KDA (예: 28/16/54)"
                    className="w-1/2 h-[30px] bg-[#12121a] border border-[#2a2a3a] rounded-lg px-2 text-white font-mono text-[11px] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#3b82f6] block mb-1">🔵 Blue팀 글로벌 골드 / 팀 KDA</label>
                <div className="flex gap-1.5">
                  <input
                    value={teamBDetail?.global_gold || ''}
                    onChange={(e) =>
                      onTeamBDetailChange({
                        team_kda: teamBDetail?.team_kda || '',
                        global_gold: e.target.value,
                        players: teamBDetail?.players || ({} as any),
                      })
                    }
                    placeholder="골드 (예: 55.0k)"
                    className="w-1/2 h-[30px] bg-[#12121a] border border-[#2a2a3a] rounded-lg px-2 text-white font-mono text-[11px] focus:outline-none"
                  />
                  <input
                    value={teamBDetail?.team_kda || ''}
                    onChange={(e) =>
                      onTeamBDetailChange({
                        team_kda: e.target.value,
                        global_gold: teamBDetail?.global_gold || '',
                        players: teamBDetail?.players || ({} as any),
                      })
                    }
                    placeholder="팀 KDA (예: 16/28/27)"
                    className="w-1/2 h-[30px] bg-[#12121a] border border-[#2a2a3a] rounded-lg px-2 text-white font-mono text-[11px] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick overview of player 딜량 & 분당골드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Red Team Roster Stats */}
              <div className="bg-[#120e11] border border-[#ef4444]/20 rounded-xl p-2.5">
                <div className="text-[11px] font-bold text-[#ef4444] mb-2 flex items-center justify-between">
                  <span>🔴 Red팀 선수별 실적 통계</span>
                  <span className="text-[9px] text-[#8a8aa0] bg-white/5 px-2 py-0.5 rounded font-normal">
                    기준 키: 기존 스트리머명 유지
                  </span>
                </div>
                <div className="space-y-1.5">
                  {LINE_KEYS.map((lk) => {
                    const p = teamADetail?.players?.[lk];
                    const streamerName = currentTeamA?.[lk] || p?.player || '-';
                    return (
                      <div key={lk} className="flex items-center justify-between text-[10px] bg-black/40 px-2 py-1 rounded">
                        <span className="font-bold text-[#8a8aa0] w-8">{LINE_LABELS[lk]}</span>
                        <span className="text-white font-semibold truncate max-w-[90px]" title={`기존 스트리머: ${streamerName}`}>
                          {streamerName}
                        </span>
                        <span className="text-[#fca5a5]">
                          딜: {p?.damage_dealt ? `${p.damage_dealt.toLocaleString()}` : '-'}
                        </span>
                        <span className="text-[#fbbf24]">
                          골드: {p?.gold_per_minute ? `${p.gold_per_minute} g/m` : '-'}
                        </span>
                        <span className="text-[#c4b5fd] truncate max-w-[80px]" title={p?.runes?.join(', ')}>
                          {p?.runes?.[0] || '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blue Team Roster Stats */}
              <div className="bg-[#0e111a] border border-[#3b82f6]/20 rounded-xl p-2.5">
                <div className="text-[11px] font-bold text-[#3b82f6] mb-2 flex items-center justify-between">
                  <span>🔵 Blue팀 선수별 실적 통계</span>
                  <span className="text-[9px] text-[#8a8aa0] bg-white/5 px-2 py-0.5 rounded font-normal">
                    기준 키: 기존 스트리머명 유지
                  </span>
                </div>
                <div className="space-y-1.5">
                  {LINE_KEYS.map((lk) => {
                    const p = teamBDetail?.players?.[lk];
                    const streamerName = currentTeamB?.[lk] || p?.player || '-';
                    return (
                      <div key={lk} className="flex items-center justify-between text-[10px] bg-black/40 px-2 py-1 rounded">
                        <span className="font-bold text-[#8a8aa0] w-8">{LINE_LABELS[lk]}</span>
                        <span className="text-white font-semibold truncate max-w-[90px]" title={`기존 스트리머: ${streamerName}`}>
                          {streamerName}
                        </span>
                        <span className="text-[#93c5fd]">
                          딜: {p?.damage_dealt ? `${p.damage_dealt.toLocaleString()}` : '-'}
                        </span>
                        <span className="text-[#fbbf24]">
                          골드: {p?.gold_per_minute ? `${p.gold_per_minute} g/m` : '-'}
                        </span>
                        <span className="text-[#c4b5fd] truncate max-w-[80px]" title={p?.runes?.join(', ')}>
                          {p?.runes?.[0] || '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
