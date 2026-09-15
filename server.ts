import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

// Allow large image uploads for LoL match scoreboard screenshots
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Lazy initialization of Gemini client per platform guidelines
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// AI Vision Scoreboard Analysis Endpoint
app.post('/api/gemini/analyze-scoreboard', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png', currentMatchContext } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: '분석할 스크린샷 이미지 데이터(Base64)가 필요합니다.',
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const cleanMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : 'image/png';

    const promptText = `
당신은 리그 오브 레전드(League of Legends) 경기 분석 전문가 및 이미지 OCR 판독 시스템입니다.
첨부된 리그 오브 레전드 경기 결과 스크린샷(인게임 결과창, 통계창, OP.GG 경기 상세, 롤 클라이언트 대전 기록 등)을 정밀 분석하여
10인의 플레이어와 팀 종합 통계 데이터를 추출해 주세요.

[중요 필수 원칙 - 게임 원본 명칭 유지]
1. 아이템, 특성(룬), 스펠, 챔피언 데이터는 절대 임의로 영어로 번역하거나 속어/줄임말로 변환하지 말고 게임 원본 공식 한국어 명칭 그대로 인식하세요.
   - 챔피언 원본 명칭 예시: 카이사, 바루스, 아펠리오스, 아트록스, 자크, 신 짜오, 오리아나, 노틸러스, 레오나, 렐, 탈리야, 진, 애쉬, 빅토르, 아지르, 징크스, 이즈리얼, 르블랑, 세주아니, 마오카이 등
   - 스펠 원본 명칭 예시: 점멸, 순간이동, 점화, 탈진, 회복, 유체화, 강타, 정화, 방호 등
   - 룬/특성 원본 명칭 예시: 정복자, 치명적 속도, 기민한 발놀림, 집중 공격, 감전, 어둠의 수확, 칼날비, 난입, 콩콩이 소환, 유성, 착취의 손아귀, 여진, 수호자, 빙결 강화, 선제공격, 정밀, 지배, 마법, 결의, 영감 등
   - 아이템 원본 명칭 예시: 도란의 검, 도란의 방패, 도란의 반지, 무한의 대검, 루난의 허리케인, 고속 연사포, 크라켄 학살자, 몰락한 왕의 검, 징수의 총, 도미닉 경의 인사, 피바라기, 나보리 명멸검, 광전사의 군화, 판금 장화, 헤르메스의 발걸음, 신속의 장화, 마법사의 신발, 명석함의 아이오니아 장화, 존야의 모래시계, 라바돈의 죽음모자, 루덴의 동반자, 그림자불꽃, 악의, 공허의 지팡이, 지평선의 초점, 밴시의 장막, 대자연의 힘, 태양불꽃 방패, 란두인의 예언, 가시 갑옷, 워모그의 갑옷, 강철심장, 얼어붙은 심장, 심연의 가면, 공허한 광휘, 슈렐리아의 군가, 강철의 솔라리 펜던트, 기사의 맹세, 구원, 미카엘의 축복, 불타는 향로, 흐르는 물의 지팡이, 제국의 명령, 망원 개조, 예언자의 렌즈, 투명 와드, 제어 와드 등

2. 세부 스펙 추출 항목 (각 팀 5명 포지션 순서: top, jgl, mid, adc, sup):
   - 플레이어 닉네임/스트리머명 (식별 가능할 경우, 우리밍_ 선수가 있으면 꼭 우리밍_으로 매핑)
   - 챔피언 이름 (champ)
   - KDA: "킬/데스/어시스트" 문자열 (예: "9/2/11"), 그리고 kills, deaths, assists 정수
   - 딜량 (damage): 챔피언에게 가한 총 피해량 숫자 (예: 28450)
   - 분당 CS (cs, csPerMin): 총 CS 숫자 및 분당 CS (예: cs: 245, csPerMin: 8.2)
   - 글로벌 골드 및 개인 골드 (gold): 획득 골드 숫자 (예: 14500)
   - 아이템 (items): 착용 아이템 6개 + 장신구 1개 목록 (예: ["도란의 검", "무한의 대검", "크라켄 학살자", "고속 연사포", "광전사의 군화", "수호 천사", "망원 개조"])
   - 룬/특성 (runes): { primary: "핵심 룬", secondary: "보조 룬 계열" }
   - 스펠 (spells): [D스펠, F스펠] (예: ["점멸", "정화"])

3. 팀 스탯 및 게임 요약:
   - gameDuration: 게임 진행 시간 문자열 (예: "31:45")
   - winningTeam: "Blue" 또는 "Red"
   - blueTeam: { teamKda: "34/18/65", globalGold: "64.2k", towerKills: 8, dragonKills: 3, baronKills: 1, players: { top, jgl, mid, adc, sup } }
   - redTeam: { teamKda: "18/34/32", globalGold: "51.8k", towerKills: 2, dragonKills: 1, baronKills: 0, players: { top, jgl, mid, adc, sup } }

현재 경기 정보 참고(필요시): ${JSON.stringify(currentMatchContext || {})}

결과는 오직 아래 명시된 구조의 유효한 JSON 문자열로만 응답하세요. 백틱 코드블록이나 불필요한 서술은 제외하세요.
`;

    const ai = getGenAI();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: cleanMime,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text || '';
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch {
      // Clean possible markdown code fence
      const cleaned = responseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleaned);
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('[Gemini Vision Scoreboard Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || '스크린샷 비전 분석 중 오류가 발생했습니다.',
    });
  }
});

// Vite / Static file serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
