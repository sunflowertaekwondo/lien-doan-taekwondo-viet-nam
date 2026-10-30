// build-chat-kb.mjs - tao dist/chat-kb.json: toan bo noi dung website cat thanh cac doan nho (kem lien ket, hinh anh) de tro ly AI LinhKate tra loi.
// Chay cuoi build.mjs, doc cac trang HTML da dung xong trong dist. Khong bia noi dung: chi trich lai chu co tren website.
import fs from 'node:fs';
import path from 'node:path';

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'noscript', 'iframe', 'form', 'button', 'select', 'textarea', 'template', 'head', 'nav']);
const INLINE_GAP = new Set(['a', 'span', 'strong', 'b', 'em', 'i', 'small', 'label', 'th', 'td', 'time', 'code', 'mark']);
const BLOCK = new Set(['p', 'div', 'li', 'tr', 'ul', 'ol', 'table', 'section', 'article', 'details', 'summary', 'blockquote', 'figure', 'figcaption', 'caption', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'main', 'aside', 'header', 'footer']);
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'use', 'wbr', 'col']);
const HEADING = new Set(['h1', 'h2', 'h3', 'h4']);
const MAX_CHUNK = 1100; // ky tu / doan

const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const attr = (a, name) => { const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(a); return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null; };
const clean = s => s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

// "/van-ban#x" -> trang + neo; bo ten mien cua chinh website
function localHref(h, siteUrl) {
  if (!h) return null;
  if (siteUrl && h.startsWith(siteUrl)) h = h.slice(siteUrl.length) || '/';
  return h.startsWith('/') && !h.startsWith('//') ? h : null;
}

export function parsePage(html, pageUrl, siteUrl) {
  const mm = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (!mm) return null;
  const title = clean(decode((/<title>([\s\S]*?)<\/title>/i.exec(html) || [, ''])[1]).replace(/\s*[|–-]\s*Liên đoàn Taekwondo Việt Nam\s*$/i, ''));
  const desc = decode((/<meta[^>]+name="description"[^>]+content="([^"]*)"/i.exec(html) || [, ''])[1]);
  const body = mm[1];
  const chunks = [];
  let anchor = '', heading = '', h1 = '', cur = null;
  const flush = () => {
    if (cur) { cur.t = clean(cur.t); if (cur.t.length > 25 || cur.i.length) chunks.push(cur); }
    cur = null;
  };
  const start = () => { if (!cur) cur = { a: anchor, h: heading, t: '', i: [], l: [] }; return cur; };
  const skipStack = [];
  let inHeading = null, headingText = '', headingId = '', crumbs = 0;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[4] !== undefined) {   // chu
      if (skipStack.length) continue;
      const txt = decode(m[4]);
      if (inHeading) { headingText += txt; continue; }
      if (crumbs) continue;
      if (txt.trim()) { start(); cur.t += txt; }
      continue;
    }
    const closing = m[1] === '/', tag = m[2].toLowerCase(), a = m[3] || '';
    if (skipStack.length) {   // trong vung bo qua: chi theo doi dong/mo cung ten the
      if (tag === skipStack[skipStack.length - 1]) { if (closing) skipStack.pop(); else if (!VOID.has(tag) && !/\/\s*$/.test(a)) skipStack.push(tag); }
      continue;
    }
    if (!closing && SKIP_TAGS.has(tag) && !/\/\s*$/.test(a)) { skipStack.push(tag); continue; }
    const id = attr(a, 'id');
    if (!closing && id && !/^h-/.test(id) && /^(section|article|details|div|dl|table|figure|li)$/.test(tag)) { anchor = id; if (tag === 'section' || tag === 'article') { flush(); heading = ''; } }
    if (HEADING.has(tag)) {
      if (!closing) { flush(); inHeading = tag; headingText = ''; headingId = id || ''; }
      else if (inHeading === tag) {
        const t = clean(decode(headingText));
        inHeading = null;
        if (tag === 'h1') { h1 = t; heading = t; }
        else { heading = t; if (headingId && !/^h-/.test(headingId)) anchor = headingId; else if (headingId) anchor = headingId.replace(/^h-/, ''); }
        if (t) { start(); cur.t += t + '\n'; }
      }
      continue;
    }
    if (tag === 'br') { start().t += '\n'; continue; }
    if (tag === 'img' && !closing) {
      const alt = attr(a, 'alt'), src = attr(a, 'src');
      if (alt && src && /^\/img\//.test(src) && !/logo|og-|icon|favicon/i.test(src)) start().i.push({ s: src, a: alt });
      continue;
    }
    if (tag === 'a' && !closing) {
      const href = attr(a, 'href');
      cur = cur || start();
      if (href && !/^(#|javascript:|mailto:|tel:)/i.test(href)) {
        const abs = /^https?:/i.test(href) && !href.startsWith(siteUrl || '\u0000');
        const local = localHref(href, siteUrl);
        if (abs || (local && /\.pdf($|#|\?)/i.test(local))) cur.l.push({ h: abs ? href : local, t: '' });
      }
      cur._open = true; continue;
    }
    if (tag === 'a' && closing) { if (cur) { cur._open = false; cur.t += ' '; } continue; }
    if (BLOCK.has(tag)) {
      if (closing || tag === 'li' || tag === 'tr') { if (cur) cur.t += '\n'; }
      if (!closing && tag === 'li' && cur !== null) cur.t += '- ';
      if (cur && cur.t.length > MAX_CHUNK && closing && /^(p|li|tr|div)$/.test(tag)) { const keep = { a: cur.a, h: cur.h }; flush(); cur = { a: keep.a, h: keep.h, t: '', i: [], l: [] }; }
      continue;
    }
    if ((tag === 'td' || tag === 'th') && closing && cur) { cur.t += ' | '; continue; }
    if (closing && cur && INLINE_GAP.has(tag)) { cur.t += ' '; continue; }
  }
  flush();
  // gan chu hien thi cho lien ket: lay lai tu HTML (the a ... /a) theo thu tu
  const linkText = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(x => ({ h: attr(x[1], 'href'), t: clean(decode(x[2].replace(/<[^>]+>/g, ' '))) }));
  const byHref = new Map(linkText.filter(x => x.h && x.t).map(x => [localHref(x.h, siteUrl) || x.h, x.t]));
  for (const c of chunks) {
    const seen = new Set();
    c.l = c.l.filter(l => !seen.has(l.h) && seen.add(l.h)).slice(0, 6).map(l => ({ h: l.h, t: (byHref.get(l.h) || l.h).slice(0, 90) }));
    delete c._open;
    c.t = clean(c.t.replace(/(?:\s*\|\s*)+\n/g, '\n').replace(/\n(?:\s*\|\s*)+$/g, '').replace(/ ([,.;:!?)])/g, '$1').replace(/\( /g, '(')).trim();
  }
  // gop cac doan qua ngan (tieu de rieng le) vao doan truoc de moi doan du y nghia
  const merged = [];
  for (const c of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && prev.t.length < 380 && prev.t.length + c.t.length < MAX_CHUNK * 1.15) {
      prev.t += '\n' + (c.h && c.h !== prev.h && !c.t.startsWith(c.h) ? c.h + '\n' : '') + c.t;
      prev.i.push(...c.i); prev.l.push(...c.l);
    } else merged.push(c);
  }
  chunks.length = 0; chunks.push(...merged);
  // dan dau: tong quan trang
  const first = { a: '', h: h1 || title, t: `${h1 || title}${desc ? '\n' + desc : ''}`, i: [], l: [] };
  return { path: pageUrl, title: h1 || title, chunks: [first, ...chunks] };
}

// Tep chu thuan trong data/kb-docs (tu PDF/Word da dang tren website): "---\ntrang: ..\nneo: ..\ntieuDe: ..\npdf: ..\n---\n<noi dung>"
// Cat theo "Điều N." / "Chương", tieu de khoan ngan ("7.5.1. Thi lên Nhất (01) đẳng:") va gioi han ~1100 ky tu; moi doan kem lien ket ban PDF.
export function chunkDocText(raw) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, '\n'));
  if (!m) return [];
  const meta = Object.fromEntries(m[1].split('\n').map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const lines = m[2].split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let hDieu = '', hKhoan = '', cur = '';
  const flush = () => {
    if (cur.trim().length > 25) out.push({ p: meta.trang, a: meta.neo, pt: meta.tieuDe, h: [hDieu, hKhoan].filter(Boolean).join(' › '), t: cur.trim(), i: [], l: meta.pdf ? [{ h: meta.pdf, t: 'Xem hoặc tải toàn văn (PDF)' }] : [] });
    cur = '';
  };
  const reDieu = /^(Điều \d+\.|Chương [IVXLC]+\b)/, reKhoan = /^\d+\.\d+(\.\d+)*\.?\s+\S/;
  for (const line of lines) {
    if (reDieu.test(line)) { flush(); hDieu = line.slice(0, 120); hKhoan = ''; cur = line + '\n'; continue; }
    if (reKhoan.test(line) && line.length < 110 && /:$|^[^.;]*$/.test(line)) { if (cur.length > 300) flush(); hKhoan = line.replace(/:$/, ''); cur += line + '\n'; continue; }
    cur += line + '\n';
    if (cur.length > 1100) flush();
  }
  flush();
  return out;
}

export function buildChatKb({ dist, siteUrl, site = {}, extraChunks = [], docsDir = '', log = false }) {
  const pages = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (['assets', 'docs', 'fonts', 'img'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
  for (const f of walk(dist).filter(f => f.endsWith('.html')).sort()) {
    const rel = path.relative(dist, f).split(path.sep).join('/');
    if (/^(404|admin|offline)\.html$/.test(rel)) continue;
    const url = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
    const pg = parsePage(fs.readFileSync(f, 'utf8'), url, siteUrl);
    if (pg) pages.push(pg);
  }
  const chunks = [];
  const seen = new Set();
  for (const pg of pages) for (const c of pg.chunks) {
    const key = pg.path + '|' + c.t.slice(0, 160);
    if (seen.has(key)) continue; seen.add(key);
    // dan dau moi doan bang ten trang + muc de tim kiem/hien thi
    chunks.push({ id: chunks.length + 1, p: pg.path, a: c.a || '', pt: pg.title, h: c.h || '', t: c.t, i: c.i, l: c.l });
  }
  let docChunks = 0;
  if (docsDir && fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir).filter(f => f.endsWith('.txt')).sort()) {
      for (const c of chunkDocText(fs.readFileSync(path.join(docsDir, f), 'utf8'))) { chunks.push({ id: chunks.length + 1, ...c }); docChunks++; }
    }
  }
  for (const c of extraChunks) chunks.push({ id: chunks.length + 1, i: [], l: [], a: '', ...c });
  const kb = { v: 1, built: new Date().toISOString().slice(0, 10), site, chunks };
  const out = JSON.stringify(kb);
  fs.writeFileSync(path.join(dist, 'chat-kb.json'), out, 'utf8');
  if (log) console.log(`chat-kb.json: ${pages.length} trang + ${docChunks} doan tu van ban PDF, ${chunks.length} doan, ${(out.length / 1024).toFixed(0)} KB`);
  return { pages: pages.length, chunks: chunks.length, bytes: out.length };
}
