// serve.mjs - xem thu vtf-site/dist tren may, mo phong Vercel cleanUrls (/gioi-thieu -> gioi-thieu.html) va 404.html
import http from 'node:http';
import { pipeline } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SERVE_DIR: thu muc can phuc vu (mac dinh dist)
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.env.SERVE_DIR || 'dist');
const PORT = Number(process.env.PORT || 8700);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

// Tro ly ao LinhKate: /api/chat chay dung ma cua Vercel (api/chat.mjs). CHAT_MOCK=1 -> dung Kira AI "gia" (kiem thu, khong ton tien); neu khong, can KIRA_API_KEY that.
if (process.env.CHAT_MOCK) {
  const { startMockKira, MOCK_KEY } = await import('./tools/mock-kira.mjs');
  const m = await startMockKira(0);
  process.env.KIRA_BASE_URL = `${m.url}/api/v1`; process.env.KIRA_API_KEY = MOCK_KEY;
}
let chatHandler;
async function apiChat(req, res) {
  if (!chatHandler) {
    const { createHandler } = await import('./api/chat.js');
    chatHandler = createHandler({ loadKb: async () => JSON.parse(fs.readFileSync(path.join(DIST, 'chat-kb.json'), 'utf8')) });
  }
  const parts = []; for await (const d of req) parts.push(d);
  const raw = Buffer.concat(parts).toString('utf8');
  let body; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
  const shim = { status(c) { res.statusCode = c; return shim; }, setHeader: (k, v) => res.setHeader(k, v), json(o) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); } };
  await chatHandler({ method: req.method, headers: req.headers, body, socket: req.socket }, shim);
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(u.pathname);
  if (p === '/api/chat' || (process.env.SERVE_BASE && p === process.env.SERVE_BASE.replace(/\/$/, '') + '/api/chat')) return void apiChat(req, res).catch(e => { console.error(e); res.statusCode = 500; res.end('{}'); });
  // SERVE_BASE: mo phong site nam o duong dan con (vd /lien-doan-taekwondo-viet-nam) nhu GitHub Pages
  const SB = (process.env.SERVE_BASE || '').replace(/\/$/, '');
  if (SB) { if (p === SB) p = '/'; else if (p.startsWith(SB + '/')) p = p.slice(SB.length) || '/'; else { res.writeHead(404); return res.end('Not found'); } }
  if (p.length > 1 && p.endsWith('/')) { res.writeHead(308, { Location: p.replace(/\/+$/, '') + u.search }); return res.end(); }
  const candidates = p === '/' ? ['index.html'] : [p.slice(1), p.slice(1) + '.html'];
  for (const c of candidates) {
    const f = path.normalize(path.join(DIST, c));
    if (!f.startsWith(DIST)) break;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      return pipeline(fs.createReadStream(f), res, () => {}); // pipeline dong tep ca khi trinh duyet huy tai giua chung
    }
  }
  res.writeHead(404, { 'Content-Type': MIME['.html'] });
  pipeline(fs.createReadStream(path.join(DIST, '404.html')), res, () => {});
}).listen(PORT, () => console.log(`VTF site: http://localhost:${PORT}/`));
