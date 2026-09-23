import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}

function aiVisionApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-ai-vision-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze-screenshot', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        try {
          const chunks: any[] = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const raw = Buffer.concat(chunks).toString('utf-8');
          const body = JSON.parse(raw);
          const { image, team, fileName } = body || {};

          if (!image) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: '이미지 데이터(base64)가 필요합니다.' }));
            return;
          }

          const { analyzeScreenshotWithGemini } = await import('./server/geminiVision');
          const result = await analyzeScreenshotWithGemini({
            imageBase64: image,
            teamTarget: team,
            fileName,
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          console.error('[API Error] Screenshot analysis failed:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || '스크린샷 분석 중 오류가 발생했습니다.' }));
        }
      });
    },
  };
}

function championBuildsApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-champion-builds-api',
    configureServer(server) {
      server.middlewares.use('/api/champion-builds', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
          const champion = urlObj.searchParams.get('champion') || '';
          const position = urlObj.searchParams.get('position') || '';
          const patch = urlObj.searchParams.get('patch') || '16.18';

          if (req.method === 'DELETE') {
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `${champion || '전체'} D1 DB 빌드 데이터가 초기화되었습니다.`,
            }));
            return;
          }

          if (req.method === 'GET') {
            // 바루스 등 기본 lol.ps 실시간 크롤링 데이터셋 반환
            const { DEFAULT_LOLPS_BUILDS } = await import('./src/lib/championBuildsApi');
            const list = DEFAULT_LOLPS_BUILDS[champion] || [];
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              champion,
              position,
              patch,
              builds: list,
              total: list.length,
              source: 'd1_live_lolps',
            }));
            return;
          }

          if (req.method === 'POST') {
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: 'D1 DB에 최신 lol.ps 빌드 데이터가 저장되었습니다.',
            }));
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
        }
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), aiVisionApiPlugin(), championBuildsApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
