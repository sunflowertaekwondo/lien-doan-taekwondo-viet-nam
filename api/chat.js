// api/chat.js - tro ly AI "LinhKate" (thu ky VTF) cho website, goi API cua Kira AI (https://kiraai.vn/api/v1, chuan OpenAI).
// - Khoa API KHONG nam trong ma nguon hay trinh duyet: chi doc tu bien moi truong KIRA_API_KEY tren Vercel.
// - Noi dung tra loi lay tu chat-kb.json (toan bo noi dung website, do build tao), chon cac doan lien quan roi dua cho mo hinh.
// - GET  /api/chat  -> { ready } (website chi hien nut chat khi ready = true)
// - POST /api/chat  { messages: [{role, content}] } -> { ok, answer, sources, links, images }
import { buildIndex, search } from './_lib/retrieve.mjs';
import { systemPrompt, chatMessages, parseAnswer, NAME } from './_lib/prompt.mjs';
import { allowedFacts, guardAnswer, snapToCanon } from './_lib/guard.mjs';
import { plain, clip, tokens } from './_lib/text.mjs';

const ORIGIN_OK = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(www\.)?tkdai\.vn|lien-doan-taekwondo-viet-nam[a-z0-9-]*\.vercel\.app)$/i;
const HOST_OK = /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(www\.)?tkdai\.vn|[a-z0-9-]+\.vercel\.app)$/i;
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const cfg = env => ({
  key: (env.KIRA_API_KEY || '').trim(),
  base: (env.KIRA_BASE_URL || 'https://kiraai.vn/api/v1').replace(/\/$/, ''),
  model: env.KIRA_MODEL || 'kira-3.5-flash',
  rpm: num(env.CHAT_RPM, 10), perDay: num(env.CHAT_DAILY_PER_IP, 60), cap: num(env.CHAT_DAILY_CAP, 3000),
  maxTokens: num(env.CHAT_MAX_TOKENS, 600),
  budget: num(env.CHAT_TIMEOUT_MS, 27000),      // tong thoi gian cho phep (Vercel Function toi da 30 giay)
  attempt: num(env.CHAT_ATTEMPT_MS, 13000),     // thoi gian toi da cho moi lan goi; cham hon thi thu lai 1 lan
  fallback: String(env.KIRA_FALLBACK_MODELS ?? 'kira-2.5-flash,kira-flash').split(',').map(x => x.trim()).filter(Boolean),   // mo hinh du phong khi mo hinh chinh loi
  backoff: num(env.CHAT_BACKOFF_MS, 600),
  pauseMs: num(env.CHAT_PAUSE_MS, 10 * 60e3),   // het so du / khoa sai: tam dung de website an nut chat
});

const SAY = {
  origin: 'Dạ, yêu cầu này không đến từ website của Liên đoàn nên em chưa thể trả lời ạ.',
  bad: 'Dạ, em chưa đọc được câu hỏi. Anh/chị vui lòng nhập lại ngắn gọn giúp em ạ.',
  busy: 'Dạ, hiện có nhiều anh/chị đang nhắn cho em nên em xin phép anh/chị chờ ít phút rồi hỏi lại giúp em nhé.',
  off: 'Dạ, trợ lý ảo hiện chưa hoạt động. Anh/chị vui lòng xem thông tin trên website hoặc liên hệ Văn phòng Liên đoàn ạ.',
  fail: 'Dạ, em đang gặp trục trặc nên chưa trả lời được ngay.',
};
const contactLine = site => {
  const parts = [site.dienThoai && `điện thoại ${site.dienThoai}`, site.email && `email ${site.email}`].filter(Boolean);
  return parts.length ? ` Anh/chị vui lòng liên hệ Văn phòng Liên đoàn (${parts.join(', ')}) để được hỗ trợ ạ.` : '';
};

const hits = new Map();      // ip -> { t: [thoi diem trong 60s], day, n }
const daily = { day: '', n: 0 };
const dayKey = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
function limited(ip, c, ms) {
  const day = dayKey(ms);
  if (daily.day !== day) { daily.day = day; daily.n = 0; }
  if (daily.n >= c.cap) return true;
  if (hits.size > 5000) hits.clear();
  const h = hits.get(ip) || { t: [], day, n: 0 };
  if (h.day !== day) { h.day = day; h.n = 0; }
  h.t = h.t.filter(t => ms - t < 60000);
  if (h.t.length >= c.rpm || h.n >= c.perDay) { hits.set(ip, h); return true; }
  h.t.push(ms); h.n++; daily.n++; hits.set(ip, h);
  return false;
}

let kbCache = { at: 0, key: '', kb: null, index: null };
async function getKb(req, deps) {
  let kb, key;
  if (deps.loadKb) { kb = await deps.loadKb(); key = 'local:' + kb.built + kb.chunks.length; }
  else {
    const host = String(req.headers.host || '');
    const origin = HOST_OK.test(host) ? `${/^(localhost|127\.)/.test(host) ? 'http' : 'https'}://${host}` : 'https://tkdai.vn';
    key = origin;
    if (kbCache.kb && kbCache.key === key && Date.now() - kbCache.at < 10 * 60e3) return kbCache;
    const r = await fetch(`${origin}/chat-kb.json`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`kb ${r.status}`);
    kb = await r.json();
  }
  if (!kbCache.kb || kbCache.key !== key || kbCache.kb.built !== kb.built || kbCache.kb.chunks.length !== kb.chunks.length) kbCache = { at: Date.now(), key, kb, index: buildIndex(kb) };
  else kbCache.at = Date.now();
  return kbCache;
}

const uniq = (arr, f) => { const s = new Set(); return arr.filter(x => { const k = f(x); if (s.has(k)) return false; s.add(k); return true; }); };
const srcTitle = c => c.pt + (c.h && c.h !== c.pt ? ' › ' + c.h : '');
const srcUrl = c => c.p + (c.a ? '#' + c.a : '');
const textOf = r => { let t = r?.choices?.[0]?.message?.content; if (Array.isArray(t)) t = t.map(p => (typeof p === 'string' ? p : p?.text || '')).join(''); return typeof t === 'string' ? t : ''; };

export function createHandler(deps = {}) {
  const env = deps.env || process.env;
  const doFetch = deps.fetch || fetch;
  const now = deps.now || (() => Date.now());
  let pausedUntil = 0;         // > 0: Kira bao het so du hoac khoa sai -> tam an tro ly, do goi lien tuc
  return async function handler(req, res) {
    const send = (code, body) => { res.status(code).json(body); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const c = cfg(env);
    const origin = req.headers.origin;
    if (origin && !ORIGIN_OK.test(origin)) return send(403, { ok: false, code: 'origin', answer: SAY.origin });
    const paused = now() < pausedUntil;
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
      return send(200, { ok: true, ready: Boolean(c.key) && !paused, name: NAME });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { ok: false, code: 'method', answer: SAY.bad }); }

    // ---- kiem tra dau vao
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const list = Array.isArray(body?.messages) ? body.messages : null;
    if (!list || list.length === 0 || list.length > 40) return send(400, { ok: false, code: 'bad', answer: SAY.bad });
    const msgs = list.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: plain(m.content.slice(0, 2000)).trim() })).filter(m => m.content);
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'user' || last.content.length > 500) return send(400, { ok: false, code: 'bad', answer: SAY.bad });
    const history = msgs.slice(0, -1).slice(-8);
    if (!c.key || paused) return send(503, { ok: false, code: paused ? 'paused' : 'not_configured', answer: SAY.off });
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (limited(fwd || req.socket?.remoteAddress || 'unknown', c, now())) { res.setHeader('Retry-After', '60'); return send(429, { ok: false, code: 'busy', answer: SAY.busy }); }

    // ---- tim noi dung website lien quan
    let kbc;
    try { kbc = await getKb(req, deps); }
    catch (e) { console.error('chat: khong doc duoc chat-kb.json:', e.message); return send(502, { ok: false, code: 'kb', answer: SAY.fail }); }
    const site = kbc.kb.site || {};
    const top = search(kbc.index, last.content, { k: 5, history });
    const chunks = top.map(r => r.c);

    // ---- goi Kira AI (toi da 2 lan neu cham / loi may chu / tra noi dung rong; khong thu lai khi loi 4xx)
    const messages = chatMessages({ system: systemPrompt({ site, now: new Date(now()), chunks }), history, question: last.content });
    const t0 = Date.now();
    let raw = '', lastErr = null;
    // Thuc te: Kira dong thoi co luc bao "Unable to connect to the AI model server" (500) vai phut. Thu toi da 3 lan, lan sau doi sang mo hinh du phong.
    const models = [...new Set([c.model, ...c.fallback])];
    let usedModel = c.model;
    for (let attempt = 1; attempt <= 3 && !raw; attempt++) {
      const left = c.budget - (Date.now() - t0);
      if (left < 3000) break;
      if (attempt > 1) await new Promise(r => setTimeout(r, c.backoff * (attempt - 1)));
      const model = models[Math.min(attempt - 1, models.length - 1)];
      try {
        const r = await doFetch(`${c.base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` },
          body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: c.maxTokens, stream: false }),
          signal: AbortSignal.timeout(Math.min(c.attempt, left)),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          const msg = clip(String(data?.error?.message || data?.error?.code || ''), 160);
          console.error(`chat: Kira tra ${r.status} (lan ${attempt}, ${model}): ${msg}`);
          if (r.status === 402 || r.status === 401 || r.status === 403) { pausedUntil = now() + c.pauseMs; return send(503, { ok: false, code: r.status === 402 ? 'quota' : 'auth', answer: SAY.off }); }
          if (r.status === 429) return send(429, { ok: false, code: 'busy', answer: SAY.busy });
          lastErr = { status: r.status };
          if (r.status < 500 && ![400, 404, 422].includes(r.status)) break;      // loi tu phia yeu cau khac: thu lai vo ich; 400/404/422 co the do mo hinh nay -> thu mo hinh khac
          continue;
        }
        raw = textOf(data).trim();
        if (raw) usedModel = model; else { console.error(`chat: Kira tra noi dung rong (lan ${attempt}, ${model})`); lastErr = { status: 'empty' }; }
      } catch (e) {
        console.error(`chat: loi goi Kira (lan ${attempt}, ${model}):`, e.name, e.message);
        lastErr = { status: e.name === 'TimeoutError' ? 'timeout' : 'network' };
      }
    }
    if (!raw) return send(lastErr?.status === 'timeout' ? 504 : 502, { ok: false, code: lastErr?.status === 'timeout' ? 'timeout' : 'upstream', answer: SAY.fail + contactLine(site) });

    // ---- ra soat: khong cho phep so dien thoai/email/duong dan ngoai noi dung website
    const parsed = parseAnswer(plain(raw));
    const facts = allowedFacts([site.dienThoai, site.email, site.diaChi, site.url, ...chunks.map(x => x.t + ' ' + x.l.map(l => l.h).join(' '))].filter(Boolean));
    const diaChiDuong = String(site.diaChi || '').split(',').slice(0, 1).join(',');   // "Số 219 Lý Thường Kiệt"
    const guarded = guardAnswer(snapToCanon(parsed.answer, [site.diaChi, diaChiDuong, site.ten]), facts, site);
    if (guarded.fixed) console.error('chat: da loai thong tin lien he khong co tren website khoi cau tra loi');
    if (!guarded.answer) return send(502, { ok: false, code: 'empty', answer: SAY.fail + contactLine(site) });

    // ---- lien ket + hinh anh lien quan (lay tu chinh cac doan website da dung, khong de mo hinh tu bia)
    let used = parsed.used.map(n => chunks[n - 1]).filter(Boolean);
    if (!used.length && !parsed.hasLine && top[0] && top[0].score >= 6) used = chunks.slice(0, 2);
    const sources = uniq(used.map(x => ({ title: srcTitle(x), url: srcUrl(x) })), s => s.url).slice(0, 3);
    const links = uniq(used.flatMap(x => x.l.map(l => ({ title: l.t, url: l.h }))), l => l.url).slice(0, 3);
    const qTok = new Set(tokens(last.content).filter(t => t.length > 1));   // hinh nao co chu thich khop cau hoi nhat thi dua len truoc
    const rank = alt => tokens(alt).filter(t => qTok.has(t)).length;
    const images = uniq(used.flatMap(x => x.i.map(i => ({ src: i.s, alt: i.a, url: srcUrl(x) }))), i => i.src).sort((x, y) => rank(y.alt) - rank(x.alt)).slice(0, 2);
    return send(200, { ok: true, answer: guarded.answer, sources, links, images, model: usedModel });
  };
}

export default createHandler();
