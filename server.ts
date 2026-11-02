import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { analyzeScreenshotWithGemini } from './server/geminiVision';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Strong anti-cache middleware for mobile browsers & proxy layers
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

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

  // Cloudflare Worker & D1 Match Database endpoint (Single Source of Truth)
  const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';

  async function fetchWorkerMatches(): Promise<any[]> {
    try {
      const res = await fetch(WORKER_BASE_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data: any = await res.json();
      return Array.isArray(data) ? data : data?.matches || data?.data || [];
    } catch (err) {
      console.warn('[Server] Failed to fetch matches from Worker:', err);
      return [];
    }
  }

  // Streamers persistence (file-backed JSON)
  function getStreamersFilePath(): string {
    const candidates = [
      path.join(process.cwd(), 'server', 'streamers.json'),
      path.join(process.cwd(), 'dist', 'server', 'streamers.json'),
      path.join(__dirname, 'server', 'streamers.json'),
      path.join(process.cwd(), 'src', 'data', 'streamers.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return path.join(process.cwd(), 'server', 'streamers.json');
  }

  function readStreamersFromFile(): any[] {
    try {
      const targetPath = getStreamersFilePath();
      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[Server] Error reading streamers file:', err);
    }
    return [];
  }

  function writeStreamersToFile(data: any[]): boolean {
    const targetPaths = [
      path.join(process.cwd(), 'server', 'streamers.json'),
      path.join(process.cwd(), 'src', 'data', 'streamers.json'),
    ];

    const distTarget = path.join(process.cwd(), 'dist', 'server', 'streamers.json');
    if (fs.existsSync(path.dirname(distTarget))) {
      targetPaths.push(distTarget);
    }

    let writtenPrimary = false;
    for (const filePath of targetPaths) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const tmpPath = path.join(dir, `.streamers.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`);
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
        writtenPrimary = true;
      } catch (err) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
          writtenPrimary = true;
        } catch (err2) {
          console.warn(`[Server] Failed to write streamers to ${filePath}:`, err2);
        }
      }
    }

    cachedLiveResponse = null;
    return writtenPrimary;
  }

  const LINE_KEYS = ['top', 'jgl', 'mid', 'adc', 'sup'] as const;

  const KNOWN_SOOP_IDS: Record<string, string> = {
    '우리밍_': 'kmj05317',
    '우리밍': 'kmj05317',
    '상어녀': 'eun7432',
    '김세아': 'kimseah94',
    '디임': 'diim',
    '앵지': 'angji',
    '듀단.': 'dydan',
    '듀단': 'dydan',
    '효딤': 'hyodim',
    '꿀탱탱': 'kkultt',
    '김레인♥': 'kimrain',
    '김레인': 'kimrain',
    '임선비.': 'sunbi1024',
    '임선비': 'sunbi1024',
    '저라뎃': 'jradet',
    '김민교.': 'minkyo1994',
    '김민교': 'minkyo1994',
    '준밧드': 'junbadd',
    '나무늘봉순': 'namunlbong',
    '나는상윤': 'sangyoon',
    '이경민+_+': 'leekyeongmin',
    '이경민': 'leekyeongmin',
    '주보리♥': 'jubori',
    '주보리': 'jubori',
    '샤코타임0': 'shacotime',
    '샤코타임': 'shacotime',
    '쏘대장': 'ssodaezang',
    '오뀨': 'oggyu',
    '스맵임': 'smeb',
    '스맵': 'smeb',
    '린다랑b': 'lindarang',
    '나는눈꽃.': 'snowflower',
    '하로로.': 'haroro',
    '하두링': 'haduring',
    '감블러': 'gambler',
    '#김동하': 'khan',
    '김동하': 'khan',
    '#민찬기': 'minchanki',
    '민찬기': 'minchanki',
  };

  /**
   * Synchronize streamers strictly from real CK match database in Cloudflare D1
   */
  function extractStreamersFromMatches(matches: any[], currentProfiles: any[] = []): any[] {
    const profileMap = new Map<string, any>();
    for (const p of currentProfiles) {
      if (p?.name && typeof p.name === 'string') {
        const clean = p.name.trim();
        profileMap.set(clean.toLowerCase(), {
          name: clean,
          soop_id: typeof p.soop_id === 'string' ? p.soop_id.trim() : '',
          main_position: p.main_position || 'mid',
          is_hidden: Boolean(p.is_hidden),
          memo: p.memo,
          updated_at: p.updated_at,
        });
      }
    }

    // Match position frequency
    const positionCounts = new Map<string, Record<string, number>>();
    const matchDisplayNames = new Map<string, string>();

    for (const m of matches) {
      for (const team of [m?.team_a, m?.team_b]) {
        if (!team) continue;
        for (const line of LINE_KEYS) {
          const rawName = team[line];
          if (!rawName || typeof rawName !== 'string') continue;
          const cleanName = rawName.trim();
          if (!cleanName) continue;
          const normKey = cleanName.toLowerCase();
          if (!positionCounts.has(normKey)) {
            positionCounts.set(normKey, { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 });
            matchDisplayNames.set(normKey, cleanName);
          }
          positionCounts.get(normKey)![line]++;
        }
      }
    }

    const nowIso = new Date().toISOString();

    for (const [normKey, counts] of positionCounts.entries()) {
      let bestLine = 'mid';
      let maxPlayed = -1;
      for (const line of LINE_KEYS) {
        if (counts[line] > maxPlayed) {
          maxPlayed = counts[line];
          bestLine = line;
        }
      }

      const displayName = matchDisplayNames.get(normKey) || normKey;
      const stripped = normKey.replace(/[\.\_\#\^\*\♥\-]/g, '');
      const existing = profileMap.get(normKey) || (stripped ? profileMap.get(stripped) : undefined);

      let soopId = existing?.soop_id ? existing.soop_id.trim() : '';
      if (!soopId) {
        soopId = KNOWN_SOOP_IDS[normKey] || KNOWN_SOOP_IDS[stripped] || '';
      }
      if (normKey === '우리밍_' || normKey === '우리밍') {
        soopId = 'kmj05317';
      }

      profileMap.set(normKey, {
        name: displayName,
        soop_id: soopId,
        main_position: existing?.main_position || bestLine,
        is_hidden: existing?.is_hidden !== undefined ? Boolean(existing.is_hidden) : false,
        updated_at: existing?.updated_at || nowIso,
        memo: existing?.memo,
      });
    }

    // Single source of truth filtering:
    // Retain only streamers who have CK match records OR a valid SOOP ID (manually added) OR benchmark streamer 우리밍_
    const result: any[] = [];
    for (const [key, p] of profileMap.entries()) {
      const hasMatches = positionCounts.has(key);
      const hasSoopId = Boolean(p.soop_id && p.soop_id.trim());
      const isWooriming = p.name === '우리밍_' || p.name === '우리밍';

      if (hasMatches || hasSoopId || isWooriming) {
        result.push(p);
      }
    }

    return result.sort((a: any, b: any) => {
      if (a.name === '우리밍_' || a.name === '우리밍') return -1;
      if (b.name === '우리밍_' || b.name === '우리밍') return 1;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
  }

  // Core D1 Database Sync & Migration Function
  async function performD1DatabaseSyncAndMigration() {
    try {
      console.log('[Server/D1] Initiating D1 DB match & streamer synchronization...');
      const matches = await fetchWorkerMatches();
      const current = readStreamersFromFile();
      const synced = extractStreamersFromMatches(matches, current);

      // Save to server/streamers.json and src/data/streamers.json
      writeStreamersToFile(synced);
      cachedLiveResponse = null;

      // Best-effort push to upstream Cloudflare Worker D1 endpoint if it handles init-db
      try {
        await fetch(`${WORKER_BASE_URL}/api/admin/init-db`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: synced.length, streamers: synced }),
          signal: AbortSignal.timeout(3000),
        }).catch(() => {});
      } catch {}

      console.log(`[Server/D1] D1 DB synchronization complete: count=${synced.length}, matches=${matches.length}`);
      return {
        success: true,
        message: 'D1 DB streamers table initialized and synchronized successfully',
        count: synced.length,
        matchesCount: matches.length,
        streamers: synced,
        source: 'cloudflare-d1',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('[Server/D1] D1 database sync warning:', err);
      const fallback = readStreamersFromFile();
      return {
        success: true,
        message: 'D1 DB sync completed with local cached state',
        count: fallback.length,
        matchesCount: 0,
        streamers: fallback,
        source: 'local-fallback',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Automatic 1-time execution on server deploy/startup
  performD1DatabaseSyncAndMigration().catch((err) => {
    console.warn('[Server/D1] Initial boot synchronization error:', err);
  });

  // D1 DB Initialization & Migration API (POST & GET /api/admin/init-db)
  const handleAdminInitDb = async (req: any, res: any) => {
    try {
      const result = await performD1DatabaseSyncAndMigration();
      return res.json(result);
    } catch (err: any) {
      console.error('[Server/D1] Init-db endpoint error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to initialize D1 database' });
    }
  };

  app.post('/api/admin/init-db', handleAdminInitDb);
  app.get('/api/admin/init-db', handleAdminInitDb);

  app.get('/api/streamers', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const matches = await fetchWorkerMatches();
      const current = readStreamersFromFile();

      if (Array.isArray(matches) && matches.length > 0) {
        const synced = extractStreamersFromMatches(matches, current);
        writeStreamersToFile(synced);
        return res.json({ success: true, count: synced.length, streamers: synced, source: 'cloudflare-d1' });
      }

      return res.json({ success: true, count: current.length, streamers: current, source: 'file' });
    } catch (err: any) {
      console.warn('[Server] Error in GET /api/streamers:', err);
      const fallback = readStreamersFromFile();
      return res.json({ success: true, count: fallback.length, streamers: fallback, source: 'fallback' });
    }
  });

  app.post('/api/streamers', (req, res) => {
    try {
      cachedLiveResponse = null;

      const { streamers, streamer, replace } = req.body || {};

      // If full replace is requested (e.g. from handleSaveAll)
      if (replace && Array.isArray(streamers)) {
        const cleanList = streamers
          .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
          .map((s: any) => ({
            name: s.name.trim(),
            soop_id: typeof s.soop_id === 'string' ? s.soop_id.trim() : '',
            main_position: s.main_position || 'mid',
            is_hidden: Boolean(s.is_hidden),
            memo: s.memo,
            updated_at: s.updated_at || new Date().toISOString(),
          }))
          .sort((a: any, b: any) => {
            if (a.name === '우리밍_' || a.name === '우리밍') return -1;
            if (b.name === '우리밍_' || b.name === '우리밍') return 1;
            return a.name.localeCompare(b.name);
          });

        const success = writeStreamersToFile(cleanList);
        if (!success) {
          return res.status(500).json({ success: false, error: 'Failed to write streamers to disk' });
        }
        console.log(`[Server] Streamers replaced and saved: count=${cleanList.length}`);
        return res.json({ success: true, count: cleanList.length, streamers: cleanList });
      }

      // Safe Incremental Append / Update mode (for individual save, add new streamer, etc.)
      const current = readStreamersFromFile();
      const map = new Map<string, any>();
      for (const item of current) {
        if (item?.name) map.set(item.name.toLowerCase().trim(), item);
      }

      const incoming = Array.isArray(streamers) ? streamers : streamer ? [streamer] : [];
      const nowIso = new Date().toISOString();

      for (const item of incoming) {
        if (!item?.name || typeof item.name !== 'string' || !item.name.trim()) continue;
        const key = item.name.toLowerCase().trim();
        const existing = map.get(key) || {};
        map.set(key, {
          ...existing,
          ...item,
          name: item.name.trim(),
          soop_id: typeof item.soop_id === 'string' ? item.soop_id.trim() : (existing.soop_id || '').trim(),
          main_position: item.main_position || existing.main_position || 'mid',
          is_hidden: item.is_hidden !== undefined ? Boolean(item.is_hidden) : Boolean(existing.is_hidden),
          updated_at: item.updated_at || nowIso,
          memo: item.memo || existing.memo,
        });
      }

      const updated = Array.from(map.values()).sort((a: any, b: any) => {
        if (a.name === '우리밍_' || a.name === '우리밍') return -1;
        if (b.name === '우리밍_' || b.name === '우리밍') return 1;
        return a.name.localeCompare(b.name);
      });

      const success = writeStreamersToFile(updated);
      if (!success) {
        return res.status(500).json({ success: false, error: 'Failed to write streamers to disk' });
      }
      console.log(`[Server] Streamers appended/updated: count=${updated.length}, incomingCount=${incoming.length}`);
      return res.json({ success: true, count: updated.length, streamers: updated });
    } catch (err: any) {
      console.error('[Server] POST /api/streamers error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update streamers' });
    }
  });

  app.put('/api/streamers', (req, res) => {
    try {
      cachedLiveResponse = null;
      const { streamers, streamer } = req.body || {};
      const current = readStreamersFromFile();
      const map = new Map<string, any>();
      for (const item of current) {
        if (item?.name) map.set(item.name.toLowerCase().trim(), item);
      }

      const incoming = Array.isArray(streamers) ? streamers : streamer ? [streamer] : [];
      const nowIso = new Date().toISOString();

      for (const item of incoming) {
        if (!item?.name || typeof item.name !== 'string' || !item.name.trim()) continue;
        const key = item.name.toLowerCase().trim();
        const existing = map.get(key) || {};
        map.set(key, {
          ...existing,
          ...item,
          name: item.name.trim(),
          soop_id: typeof item.soop_id === 'string' ? item.soop_id.trim() : (existing.soop_id || '').trim(),
          main_position: item.main_position || existing.main_position || 'mid',
          is_hidden: item.is_hidden !== undefined ? Boolean(item.is_hidden) : Boolean(existing.is_hidden),
          updated_at: item.updated_at || nowIso,
          memo: item.memo || existing.memo,
        });
      }

      const updated = Array.from(map.values()).sort((a: any, b: any) => {
        if (a.name === '우리밍_' || a.name === '우리밍') return -1;
        if (b.name === '우리밍_' || b.name === '우리밍') return 1;
        return a.name.localeCompare(b.name);
      });

      const success = writeStreamersToFile(updated);
      if (!success) {
        return res.status(500).json({ success: false, error: 'Failed to write streamers to disk on PUT' });
      }
      console.log(`[Server] Streamers updated via PUT: count=${updated.length}`);
      return res.json({ success: true, count: updated.length, streamers: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update streamers' });
    }
  });

  // Batch or single delete helper
  function handleDeleteStreamers(req: any, res: any) {
    try {
      cachedLiveResponse = null;
      const rawNames = req.body?.names || (req.query?.names ? (Array.isArray(req.query.names) ? req.query.names : [req.query.names]) : null);
      const singleName = (req.body?.name || req.query?.name || '') as string;
      const targetNames: string[] = Array.isArray(rawNames)
        ? rawNames.map((n: any) => String(n).toLowerCase().trim()).filter(Boolean)
        : singleName
        ? [singleName.toLowerCase().trim()]
        : [];

      if (targetNames.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one streamer name is required for deletion' });
      }

      const deleteSet = new Set(targetNames);
      const current = readStreamersFromFile();
      const updated = current.filter((s: any) => !deleteSet.has((s?.name || '').toLowerCase().trim()));

      const success = writeStreamersToFile(updated);
      if (!success) {
        return res.status(500).json({ success: false, error: 'Failed to write streamers to disk on delete' });
      }

      console.log(`[Server] Streamer(s) deleted: count=${targetNames.length}, remaining=${updated.length}`);
      return res.json({ success: true, count: updated.length, deletedCount: targetNames.length, streamers: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete streamer(s)' });
    }
  }

  app.delete('/api/streamers', handleDeleteStreamers);
  app.post('/api/streamers/delete', handleDeleteStreamers);

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

  // Matches Cloudflare Worker proxy & Cascade Delete endpoints
  app.get('/api/matches', async (req, res) => {
    try {
      const matches = await fetchWorkerMatches();
      return res.json({ success: true, count: matches.length, matches });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch matches' });
    }
  });

  app.post('/api/matches', async (req, res) => {
    try {
      const payload = req.body;
      const workerRes = await fetch(WORKER_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await workerRes.json().catch(() => ({}));
      return res.status(workerRes.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to save match to Worker' });
    }
  });

  app.put(['/api/matches', '/api/matches/:id'], async (req, res) => {
    try {
      const payload = req.body;
      const workerRes = await fetch(WORKER_BASE_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await workerRes.json().catch(() => ({}));
      return res.status(workerRes.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update match on Worker' });
    }
  });

  // Cascade Delete for matches and connected BO3/BO5 sets
  app.delete(['/api/matches/:id', '/api/matches'], async (req, res) => {
    try {
      const targetId = (req.params?.id || req.query?.id || req.body?.id || '') as string;
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'Match id is required for deletion' });
      }

      const allMatches = await fetchWorkerMatches();
      const target = allMatches.find((m: any) => String(m.id) === String(targetId));

      const set = new Set<string>();
      set.add(String(targetId));

      if (target) {
        const rootParentId = target.parent_match_id ? String(target.parent_match_id) : '';
        const isSeries = target.match_format === '3판2선승' || target.match_format === '5판3선승';

        for (const m of allMatches) {
          const mId = String(m.id);
          const mParent = m.parent_match_id ? String(m.parent_match_id) : '';

          if (rootParentId && mId === rootParentId) {
            set.add(mId);
          } else if (mParent && mParent === String(target.id)) {
            set.add(mId);
          } else if (rootParentId && mParent && mParent === rootParentId) {
            set.add(mId);
          } else if (
            isSeries &&
            m.date === target.date &&
            (m.ck_name || '').trim() === (target.ck_name || '').trim()
          ) {
            set.add(mId);
          }
        }
      }

      const idsToDelete = Array.from(set);
      console.log(`[Server] Cascade deleting match series: target=${targetId}, count=${idsToDelete.length}`, idsToDelete);

      // Concurrently delete all series set IDs from Cloudflare Worker
      const deletePromises = idsToDelete.map(async (mid) => {
        try {
          const dRes = await fetch(`${WORKER_BASE_URL}?id=${encodeURIComponent(mid)}`, {
            method: 'DELETE',
          });
          return { id: mid, ok: dRes.ok };
        } catch {
          return { id: mid, ok: false };
        }
      });

      const results = await Promise.all(deletePromises);
      const anySuccess = results.some((r) => r.ok);

      return res.json({
        success: anySuccess || idsToDelete.length === 0,
        id: targetId,
        deletedIds: idsToDelete,
        results,
      });
    } catch (err: any) {
      console.error('[Server] Match delete error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Cascade delete failed' });
    }
  });

  // Cleanup orphan / corrupted match records (e.g., ghost 10-25 matches)
  app.post('/api/matches/cleanup-orphans', async (req, res) => {
    try {
      const allMatches = await fetchWorkerMatches();
      const orphanIds: string[] = [];

      for (const m of allMatches) {
        const isOct25 = (m.date || '').includes('10-25') || (m.date || '').includes('2026-10-25');
        const isCorrupted = !m.team_a || !m.team_b || (!m.team_a.top && !m.team_b.top);
        if (isOct25 || isCorrupted) {
          orphanIds.push(String(m.id));
        }
      }

      if (orphanIds.length > 0) {
        console.log(`[Server] Cleaning up ${orphanIds.length} orphan matches:`, orphanIds);
        await Promise.all(
          orphanIds.map((oid) =>
            fetch(`${WORKER_BASE_URL}?id=${encodeURIComponent(oid)}`, { method: 'DELETE' }).catch(() => {})
          )
        );
      }

      return res.json({
        success: true,
        deletedCount: orphanIds.length,
        deletedIds: orphanIds,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Cleanup orphans failed' });
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
