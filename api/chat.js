// api/chat.js - tro ly AI "LinhKate" (thu ky VTF) cho website, goi API cua Kira AI (https://kiraai.vn/api/v1, chuan OpenAI).
// - Khoa API KHONG nam trong ma nguon hay trinh duyet: chi doc tu bien moi truong KIRA_API_KEY tren Vercel.
// - Noi dung tra loi lay tu chat-kb.json (toan bo noi dung website, do build tao), chon cac doan lien quan roi dua cho mo hinh.
// - GET  /api/chat  -> { ready } (website chi hien nut chat khi ready = true)
// - POST /api/chat  { messages: [{role, content}] } -> { ok, answer, sources, links, images }
import { buildIndex, search } from './_lib/retrieve.mjs';
import { systemPrompt, chatMessages, parseAnswer, NAME } from './_lib/prompt.mjs';
import { plain, clip, tokens } from './_lib/text.mjs';

const ORIGIN_OK = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(www\.)?tkdai\.vn|lien-doan-taekwondo-viet-nam[a-z0-9-]*\.vercel\.app)$/i;
const HOST_OK = /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(www\.)?tkdai\.vn|[a-z0-9-]+\.vercel\.app)$/i;
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const cfg = env => ({
  key: (env.KIRA_API_KEY || '').trim(),
  base: (env.KIRA_BASE_URL || 'https://kiraai.vn/api/v1').replace(/\/$/, ''),
  model: env.KIRA_MODEL || 'kira-chatbox',
  rpm: num(env.CHAT_RPM, 10), perDay: num(env.CHAT_DAILY_PER_IP, 60), cap: num(env.CHAT_DAILY_CAP, 3000),
  maxTokens: num(env.CHAT_MAX_TOKENS, 600), timeout: num(env.CHAT_TIMEOUT_MS, 25000),
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

export function createHandler(deps = {}) {
  const env = deps.env || process.env;
  const doFetch = deps.fetch || fetch;
  const now = deps.now || (() => Date.now());
  return async function handler(req, res) {
    const send = (code, body) => { res.status(code).json(body); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const c = cfg(env);
    const origin = req.headers.origin;
    if (origin && !ORIGIN_OK.test(origin)) return send(403, { ok: false, code: 'origin', answer: SAY.origin });
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
      return send(200, { ok: true, ready: Boolean(c.key), name: NAME });
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
    if (!c.key) return send(503, { ok: false, code: 'not_configured', answer: SAY.off });
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (limited(fwd || req.socket?.remoteAddress || 'unknown', c, now())) { res.setHeader('Retry-After', '60'); return send(429, { ok: false, code: 'busy', answer: SAY.busy }); }

    // ---- tim noi dung website lien quan
    let kbc;
    try { kbc = await getKb(req, deps); }
    catch (e) { console.error('chat: khong doc duoc chat-kb.json:', e.message); return send(502, { ok: false, code: 'kb', answer: SAY.fail }); }
    const site = kbc.kb.site || {};
    const top = search(kbc.index, last.content, { k: 6, history });
    const chunks = top.map(r => r.c);

    // ---- goi Kira AI
    const messages = chatMessages({ system: systemPrompt({ site, now: new Date(now()), chunks }), history, question: last.content });
    let data;
    try {
      const r = await doFetch(`${c.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` },
        body: JSON.stringify({ model: c.model, messages, temperature: 0.3, max_tokens: c.maxTokens, stream: false }),
        signal: AbortSignal.timeout(c.timeout),
      });
      data = await r.json().catch(() => null);
      if (!r.ok) {
        console.error(`chat: Kira tra ${r.status}: ${clip(String(data?.error?.message || data?.error?.code || ''), 160)}`);
        const busy = r.status === 429 || r.status === 402;
        return send(busy ? 429 : 502, { ok: false, code: busy ? 'busy' : 'upstream', answer: busy ? SAY.busy : SAY.fail + contactLine(site) });
      }
    } catch (e) {
      console.error('chat: loi goi Kira:', e.name, e.message);
      return send(504, { ok: false, code: 'timeout', answer: SAY.fail + contactLine(site) });
    }
    let raw = data?.choices?.[0]?.message?.content;
    if (Array.isArray(raw)) raw = raw.map(p => (typeof p === 'string' ? p : p?.text || '')).join('');
    const parsed = parseAnswer(plain(raw));
    if (!parsed.answer) { console.error('chat: Kira tra noi dung rong'); return send(502, { ok: false, code: 'empty', answer: SAY.fail + contactLine(site) }); }

    // ---- lien ket + hinh anh lien quan (lay tu chinh cac doan website da dung, khong de mo hinh tu bia)
    let used = parsed.used.map(n => chunks[n - 1]).filter(Boolean);
    if (!used.length && !parsed.hasLine && top[0] && top[0].score >= 6) used = chunks.slice(0, 2);
    const sources = uniq(used.map(x => ({ title: srcTitle(x), url: srcUrl(x) })), s => s.url).slice(0, 3);
    const links = uniq(used.flatMap(x => x.l.map(l => ({ title: l.t, url: l.h }))), l => l.url).slice(0, 3);
    const qTok = new Set(tokens(last.content).filter(t => t.length > 1));   // hinh nao co chu thich khop cau hoi nhat thi dua len truoc
    const rank = alt => tokens(alt).filter(t => qTok.has(t)).length;
    const images = uniq(used.flatMap(x => x.i.map(i => ({ src: i.s, alt: i.a, url: srcUrl(x) }))), i => i.src).sort((x, y) => rank(y.alt) - rank(x.alt)).slice(0, 2);
    return send(200, { ok: true, answer: clip(parsed.answer, 1600), sources, links, images, model: c.model });
  };
}

export default createHandler();
