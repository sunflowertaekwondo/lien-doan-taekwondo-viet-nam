// markdown.mjs - doc bai Tin tuc viet bang Markdown (front matter + noi dung). Tu viet, khong phu thuoc thu vien.
// Ho tro: ## / ### tieu de, doan van, danh sach - va 1., > trich dan, **dam**, *nghieng*, [lien ket](url), ![anh](url "chu thich"), ---
// Moi HTML trong bai deu duoc escape (an toan khi nhieu nguoi soan bai).
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
export const safeUrl = u => (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(String(u).trim()) ? String(u).trim() : '#');
// URL cho phep mot cap ngoac don ben trong, vd https://vi.wikipedia.org/wiki/Taekwondo_(mon)
const URL_RE = '((?:[^()\\s]|\\([^()\\s]*\\))+)';
const IMG_RE = new RegExp(`!\\[([^\\]]*)\\]\\(${URL_RE}(?:\\s+&quot;(.*?)&quot;)?\\)`, 'g');
const LINK_RE = new RegExp(`\\[([^\\]]+)\\]\\(${URL_RE}\\)`, 'g');
const IMG_LINE = new RegExp(`^!\\[([^\\]]*)\\]\\(${URL_RE}(?:\\s+"(.*)")?\\)$`);

export function parseFrontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src.replace(/^﻿/, '')); // bo BOM do Notepad them
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    const q = /^(["'])(.*)\1$/.exec(v); // chi bo ngoac kep khi bao tron gia tri
    if (q) v = q[2];
    data[kv[1]] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return { data, body: m[2] };
}

const emph = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

// Anh va lien ket duoc dung truoc roi thay bang ma giu cho, nen in dam/nghieng khong lot vao href/src/alt
function inline(s, resolve) {
  const parts = [];
  const keep = h => `\u0000${parts.push(h) - 1}\u0000`;
  let out = esc(String(s).replace(/\u0000/g, ''));
  out = out.replace(IMG_RE, (m, alt, url, title) =>
    keep(`<img src="${esc(resolve(safeUrl(unesc(url))))}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" decoding="async">`));
  out = out.replace(LINK_RE, (m, txt, url) => {
    const u = safeUrl(unesc(url));
    const ext = /^https?:\/\//i.test(u);
    return keep(`<a href="${esc(ext ? u : resolve(u))}"${ext ? ' target="_blank" rel="noopener"' : ''}>${emph(txt)}</a>`);
  });
  out = emph(out);
  while (/\u0000\d+\u0000/.test(out)) out = out.replace(/\u0000(\d+)\u0000/g, (m, i) => parts[i]);
  return out;
}

export function renderMarkdown(md, resolve = u => u) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(' '), resolve)}</p>`); para = []; } };
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i, resolve)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(' '), resolve)}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) { flushAll(); continue; }
    if ((m = /^(#{2,4})\s+(.*)$/.exec(l))) { flushAll(); const n = m[1].length; html.push(`<h${n}>${inline(m[2], resolve)}</h${n}>`); continue; }
    if (/^---+$/.test(l.trim())) { flushAll(); html.push('<hr>'); continue; }
    if ((m = /^>\s?(.*)$/.exec(l))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(l))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    // dong chi co mot anh -> anh lon co chu thich; anh nam giua doan van -> anh trong dong (xu ly o inline)
    if ((m = IMG_LINE.exec(l.trim()))) {
      flushAll();
      html.push(`<figure><img src="${esc(resolve(safeUrl(m[2])))}" alt="${esc(m[1])}" loading="lazy" decoding="async">${m[3] ? `<figcaption>${inline(m[3], resolve)}</figcaption>` : ''}</figure>`);
      continue;
    }
    flushList(); flushQuote(); para.push(l.trim());
  }
  flushAll();
  return html.join('\n');
}

// van ban thuan (cho RSS, mo ta): chi bo cu phap Markdown that su, giu gach noi trong ngay thang, so hieu
export const plainText = md => md
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/^\s*(#{2,4}|>|[-*]|\d+[.)])\s+/gm, '').replace(/^-{3,}\s*$/gm, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2').replace(/`/g, '')
  .replace(/\s+/g, ' ').trim();

// cat doan van o ranh gioi tu, them dau ba cham
export const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
