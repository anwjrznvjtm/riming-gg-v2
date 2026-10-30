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
  const SOOP_CLIENT_ID = '6746e3e1945b4cd93b1fba5fd28afc34';
  let cachedLiveResponse: { total_cnt: number; broad: any[]; cachedAt: number } | null = null;
  const CACHE_TTL_MS = 40 * 1000; // 40 seconds cache

  app.get('/api/soop/live', async (req, res) => {
    try {
      const now = Date.now();
      if (cachedLiveResponse && now - cachedLiveResponse.cachedAt < CACHE_TTL_MS) {
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
      fs.writeFileSync(streamersFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Server] Error writing streamers.json:', err);
    }
  }

  app.get('/api/streamers', (req, res) => {
    const list = readStreamersFromFile();
    return res.json({ success: true, streamers: list });
  });

  app.post('/api/streamers', (req, res) => {
    try {
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
