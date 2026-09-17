import { GoogleGenAI, Type } from '@google/genai';
import { MatchExtractedData, TeamGameDetail, PlayerGameDetail, LineKey, WinningTeam } from '../src/types';

// Lazy initialization of Gemini client with recommended telemetry header
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Real-time vision-only processing
 */
export function generateHeuristicMatchData(): MatchExtractedData {
  return {
    game_duration: '',
    winning_team: 'Blue',
    red_team: { team_kda: '', global_gold: '', players: {} as any },
    blue_team: { team_kda: '', global_gold: '', players: {} as any },
  };
}

/**
 * Call Gemini 3.8 Flash Vision to analyze scoreboard screenshot
 */
export async function analyzeScreenshotWithGemini(params: {
  imageBase64: string;
  teamTarget?: 'Red' | 'Blue' | 'both';
  fileName?: string;
  teamAStreamers?: Record<LineKey, string>;
  teamBStreamers?: Record<LineKey, string>;
}): Promise<{
  success: boolean;
  data: MatchExtractedData;
  isSimulationFallback: boolean;
  message?: string;
  rawResponse?: string;
}> {
  const { imageBase64, teamTarget = 'both', fileName, teamAStreamers, teamBStreamers } = params;

  let mimeType = 'image/png';
  let cleanBase64 = imageBase64;

  if (imageBase64.includes(',')) {
    const match = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    if (match) {
      mimeType = match[1];
    }
    cleanBase64 = imageBase64.split(',')[1];
  }

  const ai = getGeminiClient();

  if (!ai) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않아 스크린샷 실시간 분석을 진행할 수 없습니다. Settings에서 GEMINI_API_KEY를 등록해 주세요.');
  }

  const prompt = `
당신은 리그 오브 레전드(LoL) 경기 결과 및 통계 스크린샷 전문 비전 분석 AI입니다.
첨부된 리그 오브 레전드 경기 결과 스크린샷(인게임 통계창, 승패 결과창, OP.GG 리포트)을 실시간으로 정밀 분석하여, 아래 명시된 영역별 데이터 매칭 좌표 기준과 엄격한 규칙에 맞춰 데이터를 추출하십시오.
절대 고정값이나 예시 수치를 지어내지 말고, 업로드된 이미지 속 텍스트와 숫자를 있는 그대로 읽어내야 합니다.

======================================================================
[★ 1. 절대 보존 영역 (수정 금지 및 락 Lock 조건) ★]
- 스크린샷 속 10명의 롤 인게임 닉네임과 챔피언 이름은 완전히 무시하십시오.
- AI가 닉네임이나 챔피언 이름을 보고 매칭을 시도하는 것은 엄격히 금지됩니다 (환각 오류의 원인).
- 폼에 이미 입력되어 있는 **'스트리머명'**과 **'챔피언'** 값은 어떠한 경우에도 AI가 건드리거나 덮어씌우지 않도록 클라이언트 및 서버 양쪽에서 완전히 락(Lock)이 걸려 있습니다.
- 반환하는 JSON의 'player' 필드에는 스크린샷 닉네임 대신 반드시 해당 라인 식별자(TOP, JGL, MID, ADC, SUP)를 전달하십시오.

======================================================================
[★ 2. 매칭 방식: 오직 위에서 아래로 내려오는 줄(Row) 순서 1:1 직진 매칭 ★]
- 스크린샷의 각 팀 5명 데이터와 폼 데이터를 연결하는 유일한 기준은 **위에서 아래로 내려오는 행(Row) 순서**입니다:
  * 1번째 줄 (Row 1) = top (TOP)
  * 2번째 줄 (Row 2) = jgl (JGL)
  * 3번째 줄 (Row 3) = mid (MID)
  * 4번째 줄 (Row 4) = adc (ADC)
  * 5번째 줄 (Row 5) = sup (SUP)
- 스크린샷의 1번째 줄부터 5번째 줄까지 순서대로 1:1 직진 복사하여 해당 줄의 수치들만 정확히 추출해 입력하십시오.

======================================================================
[★ 3. 이미지 영역별 데이터 매칭 좌표 기준 ★]

1. 공통 경기 정보 (상단 헤더):
   - 경기 시간 (game_duration):
     상단 '사용자 설정' 문구 우측 또는 게임 결과 헤더의 시간 텍스트 (예: "38:39", "25:12" 등)
   - 1팀(Red) / 2팀(Blue) 통합 스탯:
     * 팀 이름 우측의 ⚔️ (교차 칼) 아이콘 옆 수치 = 팀 KDA (team_kda, 예: "20 / 10 / 45" 또는 "20/10/45")
     * 💰 (주머니) 아이콘 옆 수치 = 글로벌 골드 (global_gold, 예: "72,890" 또는 "72.8k")
   - 승리 팀 판별 (winning_team): 승리/패배 배너 또는 강조 엠블럼 기준 ("Red" 또는 "Blue")

2. 라인별 개인 스탯 (우측 헤더 기준, 위에서 아래로 내려오는 1~5번째 줄):
   - ⚔️ (교차 칼): 개인 KDA (예: "10 / 3 / 8" -> kills: 10, deaths: 3, assists: 8, kda: "10/3/8")
   - 🗡️ (단검): 총 딜량/챔피언에게 가한 총 피해량 (damage_dealt, 쉼표 제외한 순수 정수, 예: 38195)
   - 💰 (주머니):
     * 상단 큰 숫자: 개인 획득 골드
     * 하단 숫자/분: 분당 골드 (GPM / gold_per_minute, 예: "509/분" -> 509)
   - 특성/룬 (runes): 주요 룬 및 보조 룬 원본 한글 명칭 배열 (예: ["정복자", "승전보", "전설: 민첩함", ...])
   - 스펠/소환사 주문 (spells): 소환사 주문 한글 명칭 배열 (예: ["점멸", "순간이동"])
   - 아이템 (items): 구매한 아이템 슬롯 한글 명칭 배열 (예: ["도란의 검", "삼위일체", ...])

======================================================================
[★ 4. 정확도 100% 강제 (임의 추측 및 더미 생성 절대 금지) ★]
- 절대 숫자를 임의로 추측하거나 예시 데이터를 만들어내지 마십시오.
- 화면에 실제로 보이는 텍스트와 숫자 그대로만 정확하게 추출하십시오.
- 만약 해상도가 흐리거나 가려져서 보이지 않는 항목은 임의로 지어내지 말고 0 또는 빈 문자열/빈 배열로 두십시오.
`.trim();

  try {
    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: prompt,
    };

    const playerSchema = {
      type: Type.OBJECT,
      properties: {
        player: { type: Type.STRING },
        champion: { type: Type.STRING },
        line: { type: Type.STRING },
        kills: { type: Type.INTEGER },
        deaths: { type: Type.INTEGER },
        assists: { type: Type.INTEGER },
        kda: { type: Type.STRING },
        damage_dealt: { type: Type.INTEGER },
        gold_per_minute: { type: Type.INTEGER },
        runes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        spells: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        items: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    };

    const teamSchema = {
      type: Type.OBJECT,
      properties: {
        team_kda: { type: Type.STRING },
        global_gold: { type: Type.STRING },
        players: {
          type: Type.OBJECT,
          properties: {
            top: playerSchema,
            jgl: playerSchema,
            mid: playerSchema,
            adc: playerSchema,
            sup: playerSchema,
          },
        },
      },
    };

    let responseText = '';
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              game_duration: { type: Type.STRING },
              winning_team: { type: Type.STRING },
              red_team: teamSchema,
              blue_team: teamSchema,
            },
          },
        },
      });
      responseText = response.text || '';
    } catch (primaryErr: any) {
      console.warn('[GeminiVision] Primary model gemini-3.8-flash error, retrying with gemini-flash-latest:', primaryErr?.message);
      // Fallback to gemini-flash-latest in case of model-specific rate limits or transient issues
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              game_duration: { type: Type.STRING },
              winning_team: { type: Type.STRING },
              red_team: teamSchema,
              blue_team: teamSchema,
            },
          },
        },
      });
      responseText = fallbackResponse.text || '';
    }

    if (!responseText) {
      throw new Error('Gemini AI 모델로부터 응답 텍스트를 수신하지 못했습니다.');
    }

    const parsed = JSON.parse(responseText);

    const lineKeys: LineKey[] = ['top', 'jgl', 'mid', 'adc', 'sup'];

    const redPlayersRaw = parsed.red_team?.players || {};
    const redPlayers: Record<LineKey, PlayerGameDetail> = {} as any;
    for (const l of lineKeys) {
      const p = redPlayersRaw[l] || {};
      redPlayers[l] = {
        ...p,
        player: teamAStreamers?.[l] || p.player || l.toUpperCase(),
        line: l,
      };
    }

    const bluePlayersRaw = parsed.blue_team?.players || {};
    const bluePlayers: Record<LineKey, PlayerGameDetail> = {} as any;
    for (const l of lineKeys) {
      const p = bluePlayersRaw[l] || {};
      bluePlayers[l] = {
        ...p,
        player: teamBStreamers?.[l] || p.player || l.toUpperCase(),
        line: l,
      };
    }

    const redTeam: TeamGameDetail = {
      team_kda: parsed.red_team?.team_kda || '',
      global_gold: parsed.red_team?.global_gold || '',
      players: redPlayers,
    };

    const blueTeam: TeamGameDetail = {
      team_kda: parsed.blue_team?.team_kda || '',
      global_gold: parsed.blue_team?.global_gold || '',
      players: bluePlayers,
    };

    const resultData: MatchExtractedData = {
      game_duration: parsed.game_duration || '',
      winning_team: (parsed.winning_team === 'Blue' ? 'Blue' : 'Red') as WinningTeam,
      red_team: redTeam,
      blue_team: blueTeam,
    };

    return {
      success: true,
      data: resultData,
      isSimulationFallback: false,
      rawResponse: responseText,
    };
  } catch (err: any) {
    console.error('[GeminiVision] 실시간 이미지 분석 중 오류 발생:', err);

    const rawMessage = err?.message || String(err);
    const isCreditDepleted =
      rawMessage.includes('prepayment credits are depleted') ||
      rawMessage.includes('RESOURCE_EXHAUSTED') ||
      rawMessage.includes('429');

    if (isCreditDepleted) {
      throw new Error(
        'Gemini API 선불 크레딧/할당량이 모두 소진되었습니다. (AI Studio 또는 Google Cloud 콘솔에서 크레딧 충전 또는 결제 계정 확인이 필요합니다.)'
      );
    }

    throw new Error(`[AI 비전 실시간 분석 실패] ${rawMessage}`);
  }
}
