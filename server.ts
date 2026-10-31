import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { analyzeScreenshotWithGemini } from './server/geminiVision';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // SOOP Live Stream caching
  // SOOP Live Stream caching
  const SOOP_CLIENT_ID = '6746e3e1945b4cd93b1fba5fd28afc34';
  let cachedLiveResponse: { total_cnt: number; broad: any[]; cachedAt: number } | null = null;
  const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

  // Cache invalidation endpoint
  app.post('/api/soop/live/invalidate', (req, res) => {
    cachedLiveResponse = null;
    return res.json({ success: true, message: 'SOOP live cache invalidated' });
  });

  app.get('/api/soop/live', async (req, res) => {
    try {
      const now = Date.now();
      const force = req.query.force === 'true' || req.headers['x-cache-bypass'] === 'true';

      if (!force && cachedLiveResponse && now - cachedLiveResponse.cachedAt < CACHE_TTL_MS) {
        return res.json({
          success: true,
          source: 'cache',
          total_cnt: cachedLiveResponse.total_cnt,
          broad: cachedLiveResponse.broad,
        });
      }

      const page1Res = await fetch(
        `https://openapi.sooplive.co.kr/broad/list?client_id=${SOOP_CLIENT_ID}&page_no=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (!page1Res.ok) {
        if (cachedLiveResponse) {
          return res.json({
            success: true,
            source: 'stale_cache',
            total_cnt: cachedLiveResponse.total_cnt,
            broad: cachedLiveResponse.broad,
          });
        }
        return res.status(page1Res.status).json({
          success: false,
          error: `SOOP API responded with status ${page1Res.status}`,
        });
      }

      const page1Data: any = await page1Res.json();
      const totalCount = Number(page1Data.total_cnt) || 0;
      const broadsPage1 = Array.isArray(page1Data.broad) ? page1Data.broad : [];

      const totalPages = Math.min(Math.ceil(totalCount / 60), 25);
      const pagePromises: Promise<any[]>[] = [];

      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          fetch(
            `https://openapi.sooplive.co.kr/broad/list?client_id=${SOOP_CLIENT_ID}&page_no=${p}`,
            { headers: { Accept: 'application/json' } }
          )
            .then((r) => r.json())
            .then((d: any) => (Array.isArray(d?.broad) ? d.broad : []))
            .catch(() => [])
        );
      }

      const restPages = await Promise.all(pagePromises);
      const allBroads = broadsPage1.concat(...restPages);

      cachedLiveResponse = {
        total_cnt: totalCount,
        broad: allBroads,
        cachedAt: now,
      };

      return res.json({
        success: true,
        source: 'live',
        total_cnt: totalCount,
        broad: allBroads,
      });
    } catch (err: any) {
      if (cachedLiveResponse) {
        return res.json({
          success: true,
          source: 'fallback_cache',
          total_cnt: cachedLiveResponse.total_cnt,
          broad: cachedLiveResponse.broad,
        });
      }
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to fetch SOOP live broadcast list',
      });
    }
  });

  // Streamers persistence (file-backed JSON)
  const streamersFilePath = path.join(process.cwd(), 'server', 'streamers.json');

  function readStreamersFromFile(): any[] {
    try {
      if (fs.existsSync(streamersFilePath)) {
        const raw = fs.readFileSync(streamersFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[Server] Error reading streamers.json:', err);
    }
    return [];
  }

  function writeStreamersToFile(data: any[]) {
    try {
      const dir = path.dirname(streamersFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(streamersFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Server] Error writing streamers.json:', err);
    }
  }

  function ensureDefaultStreamersFile() {
    try {
      const existing = readStreamersFromFile();
      if (existing.length >= 10) return;

      const defaults = [
        { name: '우리밍_', soop_id: 'kmj05317', main_position: 'adc', is_hidden: false, memo: '기준 스트리머 (원딜)' },
        { name: '김민교', soop_id: 'minkyo1994', main_position: 'mid', is_hidden: false },
        { name: '이상호', soop_id: 'opklol', main_position: 'sup', is_hidden: false },
        { name: '김봉준', soop_id: 'khm11903', main_position: 'sup', is_hidden: false },
        { name: '임선비', soop_id: 'sunbi1024', main_position: 'mid', is_hidden: false },
        { name: '다단', soop_id: 'dadan', main_position: 'top', is_hidden: false },
        { name: '오아', soop_id: 'oa1214', main_position: 'adc', is_hidden: false },
        { name: '토마토', soop_id: 'tomato', main_position: 'sup', is_hidden: false },
        { name: '박사장', soop_id: 'parksajang', main_position: 'mid', is_hidden: false },
        { name: '남봉', soop_id: 'nambong', main_position: 'jgl', is_hidden: false },
        { name: '유소나', soop_id: 'yusona', main_position: 'sup', is_hidden: false },
        { name: '수피', soop_id: 'soopi', main_position: 'adc', is_hidden: false },
        { name: '강만식', soop_id: 'kangmansik', main_position: 'mid', is_hidden: false },
        { name: '저라뎃', soop_id: 'jradet', main_position: 'jgl', is_hidden: false },
        { name: '준밧드', soop_id: 'junbadd', main_position: 'jgl', is_hidden: false },
        { name: '뜨뜨뜨뜨', soop_id: 'daddaddadda', main_position: 'adc', is_hidden: false },
        { name: '단아냥', soop_id: 'dananyang', main_position: 'sup', is_hidden: false },
        { name: '임아니', soop_id: 'imani', main_position: 'sup', is_hidden: false },
        { name: '앵지', soop_id: 'angji', main_position: 'mid', is_hidden: false },
        { name: '서리', soop_id: 'seori', main_position: 'adc', is_hidden: false },
        { name: '하티', soop_id: 'hatti', main_position: 'mid', is_hidden: false },
        { name: '연두', soop_id: 'yeondoo', main_position: 'sup', is_hidden: false },
        { name: '유혜디', soop_id: 'yuhedi', main_position: 'jgl', is_hidden: false },
        { name: '다누리', soop_id: 'danuri', main_position: 'mid', is_hidden: false },
        { name: '김레인', soop_id: 'kimrain', main_position: 'top', is_hidden: false },
        { name: '꿀탱탱', soop_id: 'kkultt', main_position: 'top', is_hidden: false },
        { name: '나라카일', soop_id: 'narakyle', main_position: 'mid', is_hidden: false },
        { name: '린다랑', soop_id: 'lindarang', main_position: 'top', is_hidden: false },
        { name: '데스티니', soop_id: 'destiny', main_position: 'sup', is_hidden: false },
        { name: '스맵', soop_id: 'smeb', main_position: 'top', is_hidden: false },
        { name: '쿠로', soop_id: 'kuro', main_position: 'mid', is_hidden: false },
        { name: '피글렛', soop_id: 'piglet', main_position: 'adc', is_hidden: false },
        { name: '상윤', soop_id: 'sangyoon', main_position: 'adc', is_hidden: false },
        { name: '나는상윤', soop_id: 'sangyoon', main_position: 'adc', is_hidden: false },
        { name: '눈꽃', soop_id: 'snowflower', main_position: 'sup', is_hidden: false },
        { name: '강소연', soop_id: 'kangsoyeon', main_position: 'top', is_hidden: false },
        { name: '푸린', soop_id: 'purin', main_position: 'top', is_hidden: false },
        { name: '인섹', soop_id: 'insec', main_position: 'jgl', is_hidden: false },
        { name: '러너', soop_id: 'runner', main_position: 'adc', is_hidden: false },
        { name: '꽃빈', soop_id: 'flowervin', main_position: 'sup', is_hidden: false },
        { name: '백크', soop_id: 'baekkeu', main_position: 'mid', is_hidden: false },
        { name: '제동빠', soop_id: 'jedongppa', main_position: 'jgl', is_hidden: false },
        { name: '스피릿', soop_id: 'spirit', main_position: 'jgl', is_hidden: false },
        { name: '이경민', soop_id: 'leekyeongmin', main_position: 'mid', is_hidden: false },
        { name: '애교용', soop_id: 'aegyoyong', main_position: 'sup', is_hidden: false },
        { name: '효딤', soop_id: 'hyodim', main_position: 'mid', is_hidden: false },
        { name: '디임', soop_id: 'diim', main_position: 'sup', is_hidden: false },
        { name: '박삐삐', soop_id: 'bbibbi', main_position: 'sup', is_hidden: false },
        { name: '트할', soop_id: 'thal', main_position: 'top', is_hidden: false },
        { name: '마린', soop_id: 'marin', main_position: 'top', is_hidden: false },
        { name: '안녕수야', soop_id: 'suyadi', main_position: 'mid', is_hidden: false },
        { name: '듀단', soop_id: 'dydan', main_position: 'mid', is_hidden: false },
        { name: '박잔디', soop_id: 'parkjandi', main_position: 'top', is_hidden: false },
        { name: '보혜', soop_id: 'bohe', main_position: 'mid', is_hidden: false },
        { name: '늑채', soop_id: 'neukchae', main_position: 'sup', is_hidden: false },
        { name: '모꿀몬', soop_id: 'moggulmon', main_position: 'mid', is_hidden: false },
        { name: '나무늘봉순', soop_id: 'namunlbong', main_position: 'mid', is_hidden: false },
        { name: '박나닝', soop_id: 'naning', main_position: 'sup', is_hidden: false },
        { name: '이유란', soop_id: 'yuran', main_position: 'sup', is_hidden: false },
        { name: '갱제', soop_id: 'gangje', main_position: 'adc', is_hidden: false },
        { name: '나는푸르', soop_id: 'puru', main_position: 'sup', is_hidden: false },
        { name: '미스마', soop_id: 'missma', main_position: 'sup', is_hidden: false },
        { name: '김윤환', soop_id: 'calm', main_position: 'top', is_hidden: false },
        { name: '조경훈', soop_id: 'rudgns', main_position: 'top', is_hidden: false },
        { name: '쿼드', soop_id: 'quad', main_position: 'mid', is_hidden: false },
        { name: '에디', soop_id: 'addy', main_position: 'top', is_hidden: false },
        { name: '무진', soop_id: 'moojin', main_position: 'jgl', is_hidden: false },
        { name: '호진', soop_id: 'hojin', main_position: 'jgl', is_hidden: false },
        { name: '김찬호', soop_id: 'ralpa', main_position: 'adc', is_hidden: false },
        { name: '랄로', soop_id: 'ralpa', main_position: 'adc', is_hidden: false },
        { name: '파카', soop_id: 'paka', main_position: 'mid', is_hidden: false },
        { name: '괴물쥐', soop_id: 'monsterrat', main_position: 'adc', is_hidden: false },
        { name: '도파', soop_id: 'dopa', main_position: 'mid', is_hidden: false },
        { name: '씨맥', soop_id: 'cvmax', main_position: 'top', is_hidden: false },
        { name: '클템', soop_id: 'cleartem', main_position: 'jgl', is_hidden: false },
        { name: '포니', soop_id: 'pony', main_position: 'jgl', is_hidden: false },
        { name: '캡틴잭', soop_id: 'captainjack', main_position: 'adc', is_hidden: false },
        { name: '운타라', soop_id: 'untara', main_position: 'top', is_hidden: false },
        { name: '칸', soop_id: 'khan', main_position: 'top', is_hidden: false },
        { name: '프레이', soop_id: 'pray', main_position: 'adc', is_hidden: false },
        { name: '고릴라', soop_id: 'gorilla', main_position: 'sup', is_hidden: false },
        { name: '뱅', soop_id: 'bang', main_position: 'adc', is_hidden: false },
        { name: '울프', soop_id: 'wolf', main_position: 'sup', is_hidden: false },
        { name: '매드라이프', soop_id: 'madlife', main_position: 'sup', is_hidden: false },
        { name: '샤이', soop_id: 'shy', main_position: 'top', is_hidden: false },
        { name: '앰비션', soop_id: 'ambition', main_position: 'mid', is_hidden: false },
        { name: '큐베', soop_id: 'cuvee', main_position: 'top', is_hidden: false },
        { name: '크라운', soop_id: 'crown', main_position: 'mid', is_hidden: false },
        { name: '코어장전', soop_id: 'corejj', main_position: 'sup', is_hidden: false },
        { name: '룰러', soop_id: 'ruler', main_position: 'adc', is_hidden: false },
        { name: '베릴', soop_id: 'beryl', main_position: 'sup', is_hidden: false },
        { name: '데프트', soop_id: 'deft', main_position: 'adc', is_hidden: false },
        { name: '표식', soop_id: 'pyosik', main_position: 'jgl', is_hidden: false },
        { name: '폰', soop_id: 'pawn', main_position: 'mid', is_hidden: false },
        { name: '기인', soop_id: 'kiin', main_position: 'top', is_hidden: false },
        { name: '캐니언', soop_id: 'canyon', main_position: 'jgl', is_hidden: false },
        { name: '쇼메이커', soop_id: 'showmaker', main_position: 'mid', is_hidden: false },
        { name: '쵸비', soop_id: 'chovy', main_position: 'mid', is_hidden: false },
        { name: '페이커', soop_id: 'faker', main_position: 'mid', is_hidden: false },
        { name: '제우스', soop_id: 'zeus', main_position: 'top', is_hidden: false },
        { name: '오너', soop_id: 'oner', main_position: 'jgl', is_hidden: false },
        { name: '구마유시', soop_id: 'gumayusi', main_position: 'adc', is_hidden: false },
        { name: '케리아', soop_id: 'keria', main_position: 'sup', is_hidden: false },
      ];

      const map = new Map<string, any>();
      for (const d of defaults) {
        map.set(d.name.toLowerCase().trim(), d);
      }
      for (const e of existing) {
        if (e?.name) {
          const key = e.name.toLowerCase().trim();
          map.set(key, { ...(map.get(key) || {}), ...e });
        }
      }
      writeStreamersToFile(Array.from(map.values()));
    } catch (err) {
      console.warn('[Server] Failed to ensure default streamers:', err);
    }
  }

  // Ensure streamers file exists on boot
  ensureDefaultStreamersFile();

  app.get('/api/streamers', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const list = readStreamersFromFile();
    return res.json({ success: true, streamers: list });
  });

  app.post('/api/streamers', (req, res) => {
    try {
      // Invalidate SOOP live cache immediately so new SOOP IDs are mapped freshly
      cachedLiveResponse = null;

      const { streamers, streamer, replace } = req.body || {};

      // If full replace is requested
      if (replace && Array.isArray(streamers)) {
        writeStreamersToFile(streamers);
        return res.json({ success: true, count: streamers.length, streamers });
      }

      const current = readStreamersFromFile();
      const map = new Map<string, any>();
      for (const item of current) {
        if (item?.name) map.set(item.name.toLowerCase().trim(), item);
      }

      const incoming = Array.isArray(streamers) ? streamers : streamer ? [streamer] : [];
      const nowIso = new Date().toISOString();

      for (const item of incoming) {
        if (!item?.name?.trim()) continue;
        const key = item.name.toLowerCase().trim();
        const existing = map.get(key) || {};
        map.set(key, {
          ...existing,
          ...item,
          name: item.name.trim(),
          soop_id: typeof item.soop_id === 'string' ? item.soop_id.trim() : (existing.soop_id || '').trim(),
          main_position: item.main_position || existing.main_position || 'mid',
          is_hidden: item.is_hidden !== undefined ? Boolean(item.is_hidden) : Boolean(existing.is_hidden),
          updated_at: nowIso,
        });
      }

      const updated = Array.from(map.values());
      writeStreamersToFile(updated);
      return res.json({ success: true, count: updated.length, streamers: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update streamers' });
    }
  });

  app.delete('/api/streamers', (req, res) => {
    try {
      cachedLiveResponse = null;
      const name = (req.query.name || req.body?.name || '') as string;
      if (!name) return res.status(400).json({ success: false, error: 'Streamer name is required' });
      const targetKey = name.toLowerCase().trim();
      const current = readStreamersFromFile();
      const updated = current.filter((s: any) => (s?.name || '').toLowerCase().trim() !== targetKey);
      writeStreamersToFile(updated);
      return res.json({ success: true, count: updated.length, streamers: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete streamer' });
    }
  });

  app.post('/api/streamers/delete', (req, res) => {
    try {
      cachedLiveResponse = null;
      const name = (req.body?.name || req.query.name || '') as string;
      if (!name) return res.status(400).json({ success: false, error: 'Streamer name is required' });
      const targetKey = name.toLowerCase().trim();
      const current = readStreamersFromFile();
      const updated = current.filter((s: any) => (s?.name || '').toLowerCase().trim() !== targetKey);
      writeStreamersToFile(updated);
      return res.json({ success: true, count: updated.length, streamers: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete streamer' });
    }
  });

  app.post('/api/analyze-screenshot', async (req, res) => {
    try {
      const { image, team, fileName, teamAStreamers, teamBStreamers } = req.body || {};
      if (!image) {
        return res.status(400).json({ success: false, error: '이미지 데이터(base64)가 필요합니다.' });
      }

      const result = await analyzeScreenshotWithGemini({
        imageBase64: image,
        teamTarget: team,
        fileName,
        teamAStreamers,
        teamBStreamers,
      });

      return res.json(result);
    } catch (err: any) {
      const msg = err?.message || '분석 중 오류가 발생했습니다.';
      const isQuota =
        msg.includes('크레딧') ||
        msg.includes('할당량') ||
        msg.includes('prepayment') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('429');
      return res.status(200).json({
        success: false,
        isQuotaExhausted: isQuota,
        error: msg,
        message: isQuota
          ? 'Gemini API 선불 크레딧/할당량이 모두 소진되었습니다. AI Studio(https://ai.studio/projects)에서 확인 또는 충전 후 이용하실 수 있습니다.'
          : msg,
      });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
